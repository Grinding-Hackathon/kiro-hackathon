//
//  BackupService.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation
import CloudKit
import CryptoKit

protocol BackupServiceProtocol {
    func createBackup() async throws -> BackupData
    func restoreFromBackup(_ backupData: BackupData) async throws
    func scheduleAutomaticBackup()
    func cancelAutomaticBackup()
    func uploadToiCloud(_ backupData: BackupData) async throws
    func downloadFromiCloud() async throws -> BackupData?
    func getBackupHistory() async throws -> [BackupMetadata]
    func deleteBackup(id: String) async throws
}

class BackupService: BackupServiceProtocol {
    private let storageService: StorageServiceProtocol
    private let logger = Logger.shared
    private let container = CKContainer.default()
    private var backupTimer: Timer?
    
    private let backupKey: SymmetricKey
    
    init(storageService: StorageServiceProtocol) {
        self.storageService = storageService
        
        // Initialize backup encryption key
        if let keyData = KeychainHelper.load(key: "backup_encryption_key") {
            backupKey = SymmetricKey(data: keyData)
        } else {
            backupKey = SymmetricKey(size: .bits256)
            let keyData = backupKey.withUnsafeBytes { Data($0) }
            KeychainHelper.save(key: "backup_encryption_key", data: keyData)
        }
    }
    
    deinit {
        cancelAutomaticBackup()
    }
    
    // MARK: - Backup Operations
    
    func createBackup() async throws -> BackupData {
        logger.info("Creating wallet backup")
        
        do {
            let exportData = try await storageService.exportData()
            
            let backupData = BackupData(
                id: UUID().uuidString,
                createdAt: Date(),
                version: getCurrentAppVersion(),
                encryptedData: exportData,
                checksum: calculateChecksum(exportData)
            )
            
            // Save backup metadata locally
            try await saveBackupMetadata(backupData.metadata)
            
            logger.info("Wallet backup created successfully: \(backupData.id)")
            return backupData
        } catch {
            logger.error("Failed to create backup: \(error)")
            throw BackupError.creationFailed(error)
        }
    }
    
    func restoreFromBackup(_ backupData: BackupData) async throws {
        logger.info("Restoring wallet from backup: \(backupData.id)")
        
        do {
            // Verify backup integrity
            let calculatedChecksum = calculateChecksum(backupData.encryptedData)
            guard calculatedChecksum == backupData.checksum else {
                throw BackupError.corruptedBackup
            }
            
            // Check version compatibility
            guard isVersionCompatible(backupData.version) else {
                throw BackupError.incompatibleVersion
            }
            
            // Restore data
            try await storageService.importData(backupData.encryptedData)
            
            // Perform any necessary data migration
            try await storageService.performDataMigration()
            
            logger.info("Wallet restored successfully from backup: \(backupData.id)")
        } catch {
            logger.error("Failed to restore from backup: \(error)")
            throw BackupError.restorationFailed(error)
        }
    }
    
    // MARK: - Automatic Backup
    
    func scheduleAutomaticBackup() {
        cancelAutomaticBackup() // Cancel any existing timer
        
        // Schedule backup every 24 hours
        backupTimer = Timer.scheduledTimer(withTimeInterval: 86400, repeats: true) { [weak self] _ in
            Task {
                do {
                    let backup = try await self?.createBackup()
                    if let backup = backup {
                        try await self?.uploadToiCloud(backup)
                    }
                } catch {
                    self?.logger.error("Automatic backup failed: \(error)")
                }
            }
        }
        
        logger.info("Automatic backup scheduled")
    }
    
    func cancelAutomaticBackup() {
        backupTimer?.invalidate()
        backupTimer = nil
        logger.info("Automatic backup cancelled")
    }
    
    // MARK: - iCloud Operations
    
    func uploadToiCloud(_ backupData: BackupData) async throws {
        logger.info("Uploading backup to iCloud: \(backupData.id)")
        
        do {
            let database = container.privateCloudDatabase
            
            let record = CKRecord(recordType: "WalletBackup", recordID: CKRecord.ID(recordName: backupData.id))
            record["createdAt"] = backupData.createdAt
            record["version"] = backupData.version
            record["checksum"] = backupData.checksum
            record["encryptedData"] = backupData.encryptedData
            
            _ = try await database.save(record)
            
            logger.info("Backup uploaded to iCloud successfully: \(backupData.id)")
        } catch {
            logger.error("Failed to upload backup to iCloud: \(error)")
            throw BackupError.iCloudUploadFailed(error)
        }
    }
    
    func downloadFromiCloud() async throws -> BackupData? {
        logger.info("Downloading latest backup from iCloud")
        
        do {
            let database = container.privateCloudDatabase
            
            let query = CKQuery(recordType: "WalletBackup", predicate: NSPredicate(value: true))
            query.sortDescriptors = [NSSortDescriptor(key: "createdAt", ascending: false)]
            
            let (matchResults, _) = try await database.records(matching: query)
            
            guard let firstResult = matchResults.first,
                  case .success(let record) = firstResult.1 else {
                logger.info("No backup found in iCloud")
                return nil
            }
            
            guard let createdAt = record["createdAt"] as? Date,
                  let version = record["version"] as? String,
                  let checksum = record["checksum"] as? String,
                  let encryptedData = record["encryptedData"] as? Data else {
                throw BackupError.corruptedBackup
            }
            
            let backupData = BackupData(
                id: record.recordID.recordName,
                createdAt: createdAt,
                version: version,
                encryptedData: encryptedData,
                checksum: checksum
            )
            
            logger.info("Downloaded backup from iCloud: \(backupData.id)")
            return backupData
        } catch {
            logger.error("Failed to download backup from iCloud: \(error)")
            throw BackupError.iCloudDownloadFailed(error)
        }
    }
    
    func getBackupHistory() async throws -> [BackupMetadata] {
        logger.info("Retrieving backup history")
        
        do {
            let database = container.privateCloudDatabase
            
            let query = CKQuery(recordType: "WalletBackup", predicate: NSPredicate(value: true))
            query.sortDescriptors = [NSSortDescriptor(key: "createdAt", ascending: false)]
            
            let (matchResults, _) = try await database.records(matching: query)
            
            let backupHistory = matchResults.compactMap { result -> BackupMetadata? in
                guard case .success(let record) = result.1,
                      let createdAt = record["createdAt"] as? Date,
                      let version = record["version"] as? String else {
                    return nil
                }
                
                return BackupMetadata(
                    id: record.recordID.recordName,
                    createdAt: createdAt,
                    version: version,
                    size: (record["encryptedData"] as? Data)?.count ?? 0
                )
            }
            
            logger.info("Retrieved \(backupHistory.count) backup records")
            return backupHistory
        } catch {
            logger.error("Failed to retrieve backup history: \(error)")
            throw BackupError.historyRetrievalFailed(error)
        }
    }
    
    func deleteBackup(id: String) async throws {
        logger.info("Deleting backup: \(id)")
        
        do {
            let database = container.privateCloudDatabase
            let recordID = CKRecord.ID(recordName: id)
            
            _ = try await database.deleteRecord(withID: recordID)
            
            logger.info("Backup deleted successfully: \(id)")
        } catch {
            logger.error("Failed to delete backup: \(error)")
            throw BackupError.deletionFailed(error)
        }
    }
    
    // MARK: - Helper Methods
    
    private func getCurrentAppVersion() -> String {
        return Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }
    
    private func calculateChecksum(_ data: Data) -> String {
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }
    
    private func isVersionCompatible(_ version: String) -> Bool {
        // Simple version compatibility check
        // In a real implementation, this would be more sophisticated
        let currentVersion = getCurrentAppVersion()
        return version <= currentVersion
    }
    
    private func saveBackupMetadata(_ metadata: BackupMetadata) async throws {
        // Save backup metadata to local storage for quick access
        let metadataKey = "backup_metadata_\(metadata.id)"
        let data = try JSONEncoder().encode(metadata)
        KeychainHelper.save(key: metadataKey, data: data)
    }
}

// MARK: - Supporting Types

struct BackupData {
    let id: String
    let createdAt: Date
    let version: String
    let encryptedData: Data
    let checksum: String
    
    var metadata: BackupMetadata {
        BackupMetadata(
            id: id,
            createdAt: createdAt,
            version: version,
            size: encryptedData.count
        )
    }
}

struct BackupMetadata: Codable {
    let id: String
    let createdAt: Date
    let version: String
    let size: Int
}

enum BackupError: Error, LocalizedError {
    case creationFailed(Error)
    case restorationFailed(Error)
    case corruptedBackup
    case incompatibleVersion
    case iCloudUploadFailed(Error)
    case iCloudDownloadFailed(Error)
    case historyRetrievalFailed(Error)
    case deletionFailed(Error)
    
    var errorDescription: String? {
        switch self {
        case .creationFailed(let error):
            return "Failed to create backup: \(error.localizedDescription)"
        case .restorationFailed(let error):
            return "Failed to restore backup: \(error.localizedDescription)"
        case .corruptedBackup:
            return "Backup data is corrupted"
        case .incompatibleVersion:
            return "Backup version is incompatible with current app version"
        case .iCloudUploadFailed(let error):
            return "Failed to upload to iCloud: \(error.localizedDescription)"
        case .iCloudDownloadFailed(let error):
            return "Failed to download from iCloud: \(error.localizedDescription)"
        case .historyRetrievalFailed(let error):
            return "Failed to retrieve backup history: \(error.localizedDescription)"
        case .deletionFailed(let error):
            return "Failed to delete backup: \(error.localizedDescription)"
        }
    }
}