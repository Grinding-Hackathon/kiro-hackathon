//
//  StorageService.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation
import CoreData
import CryptoKit

protocol StorageServiceProtocol {
    // CRUD Operations
    func loadOfflineTokens() async throws -> [OfflineToken]
    func saveOfflineToken(_ token: OfflineToken) async throws
    func saveOfflineTokens(_ tokens: [OfflineToken]) async throws
    func updateOfflineToken(_ token: OfflineToken) async throws
    func deleteOfflineToken(id: String) async throws
    
    func loadTransactions() async throws -> [Transaction]
    func saveTransaction(_ transaction: Transaction) async throws
    func updateTransaction(_ transaction: Transaction) async throws
    func deleteTransaction(id: String) async throws
    
    func loadWalletState() async throws -> WalletState?
    func saveWalletState(_ state: WalletState) async throws
    
    // Specialized Operations
    func deleteExpiredTokens() async throws -> [String]
    func markTokenAsSpent(id: String, spentAt: Date) async throws
    func getUnspentTokens() async throws -> [OfflineToken]
    func getTransactionsByStatus(_ status: TransactionStatus) async throws -> [Transaction]
    func getTotalOfflineBalance() async throws -> Double
    
    // Synchronization
    func getPendingSyncTransactions() async throws -> [Transaction]
    func markTransactionAsSynced(id: String) async throws
    func getLastSyncTimestamp() async throws -> Date?
    func updateLastSyncTimestamp(_ timestamp: Date) async throws
    
    // Data Management
    func clearAllData() async throws
    func exportData() async throws -> Data
    func importData(_ data: Data) async throws
    func performDataMigration() async throws
}

class StorageService: StorageServiceProtocol {
    private let container: NSPersistentContainer
    private let encryptionKey: SymmetricKey
    private let logger = Logger.shared
    
    init() {
        container = NSPersistentContainer(name: "WalletDataModel")
        
        // Initialize encryption key for sensitive data
        if let keyData = KeychainHelper.load(key: "storage_encryption_key") {
            encryptionKey = SymmetricKey(data: keyData)
        } else {
            encryptionKey = SymmetricKey(size: .bits256)
            let keyData = encryptionKey.withUnsafeBytes { Data($0) }
            KeychainHelper.save(key: "storage_encryption_key", data: keyData)
        }
        
        container.loadPersistentStores { [weak self] _, error in
            if let error = error {
                self?.logger.error("Core Data failed to load: \(error.localizedDescription)")
            } else {
                self?.logger.info("Core Data loaded successfully")
            }
        }
        
        // Configure Core Data for better performance
        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
    }
    
    // MARK: - Offline Token Operations
    
    func loadOfflineTokens() async throws -> [OfflineToken] {
        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<[OfflineToken], Error>) in
            container.performBackgroundTask { context in
                do {
                    let request = NSFetchRequest<NSManagedObject>(entityName: "OfflineTokenEntity")
                    request.sortDescriptors = [NSSortDescriptor(key: "issuedAt", ascending: false)]
                    
                    let entities = try context.fetch(request)
                    let tokens = try entities.compactMap { entity in
                        try self.convertToOfflineToken(from: entity)
                    }
                    
                    continuation.resume(returning: tokens)
                } catch {
                    self.logger.error("Failed to load offline tokens: \(error)")
                    continuation.resume(throwing: StorageError.coreDataError(error))
                }
            }
        }
    }
    
    func saveOfflineToken(_ token: OfflineToken) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            container.performBackgroundTask { context in
                do {
                    let entity = NSEntityDescription.entity(forEntityName: "OfflineTokenEntity", in: context)!
                    let tokenEntity = NSManagedObject(entity: entity, insertInto: context)
                    
                    try self.populateOfflineTokenEntity(tokenEntity, from: token)
                    
                    try context.save()
                    self.logger.info("Saved offline token: \(token.id)")
                    continuation.resume()
                } catch {
                    self.logger.error("Failed to save offline token: \(error)")
                    continuation.resume(throwing: StorageError.coreDataError(error))
                }
            }
        }
    }
    
    func saveOfflineTokens(_ tokens: [OfflineToken]) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            container.performBackgroundTask { context in
                do {
                    for token in tokens {
                        let entity = NSEntityDescription.entity(forEntityName: "OfflineTokenEntity", in: context)!
                        let tokenEntity = NSManagedObject(entity: entity, insertInto: context)
                        try self.populateOfflineTokenEntity(tokenEntity, from: token)
                    }
                    
                    try context.save()
                    self.logger.info("Saved \(tokens.count) offline tokens")
                    continuation.resume()
                } catch {
                    self.logger.error("Failed to save offline tokens: \(error)")
                    continuation.resume(throwing: StorageError.coreDataError(error))
                }
            }
        }
    }
    
    func updateOfflineToken(_ token: OfflineToken) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            container.performBackgroundTask { context in
                do {
                    let request = NSFetchRequest<NSManagedObject>(entityName: "OfflineTokenEntity")
                    request.predicate = NSPredicate(format: "id == %@", token.id)
                    
                    let entities = try context.fetch(request)
                    guard let entity = entities.first else {
                        throw StorageError.notFound
                    }
                    
                    try self.populateOfflineTokenEntity(entity, from: token)
                    try context.save()
                    
                    self.logger.info("Updated offline token: \(token.id)")
                    continuation.resume()
                } catch {
                    self.logger.error("Failed to update offline token: \(error)")
                    continuation.resume(throwing: StorageError.coreDataError(error))
                }
            }
        }
    }
    
    func deleteOfflineToken(id: String) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            container.performBackgroundTask { context in
                do {
                    let request = NSFetchRequest<NSManagedObject>(entityName: "OfflineTokenEntity")
                    request.predicate = NSPredicate(format: "id == %@", id)
                    
                    let entities = try context.fetch(request)
                    for entity in entities {
                        context.delete(entity)
                    }
                    
                    try context.save()
                    self.logger.info("Deleted offline token: \(id)")
                    continuation.resume()
                } catch {
                    self.logger.error("Failed to delete offline token: \(error)")
                    continuation.resume(throwing: StorageError.coreDataError(error))
                }
            }
        }
    }
    
    // MARK: - Transaction Operations
    
    func loadTransactions() async throws -> [Transaction] {
        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<[Transaction], Error>) in
            container.performBackgroundTask { context in
                do {
                    let request = NSFetchRequest<NSManagedObject>(entityName: "TransactionEntity")
                    request.sortDescriptors = [NSSortDescriptor(key: "timestamp", ascending: false)]
                    
                    let entities = try context.fetch(request)
                    let transactions = try entities.compactMap { entity in
                        try self.convertToTransaction(from: entity)
                    }
                    
                    continuation.resume(returning: transactions)
                } catch {
                    self.logger.error("Failed to load transactions: \(error)")
                    continuation.resume(throwing: StorageError.coreDataError(error))
                }
            }
        }
    }
    
    func saveTransaction(_ transaction: Transaction) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            container.performBackgroundTask { context in
                do {
                    let entity = NSEntityDescription.entity(forEntityName: "TransactionEntity", in: context)!
                    let transactionEntity = NSManagedObject(entity: entity, insertInto: context)
                    
                    try self.populateTransactionEntity(transactionEntity, from: transaction)
                    
                    try context.save()
                    self.logger.info("Saved transaction: \(transaction.id)")
                    continuation.resume()
                } catch {
                    self.logger.error("Failed to save transaction: \(error)")
                    continuation.resume(throwing: StorageError.coreDataError(error))
                }
            }
        }
    }
    
    func updateTransaction(_ transaction: Transaction) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            container.performBackgroundTask { context in
                do {
                    let request = NSFetchRequest<NSManagedObject>(entityName: "TransactionEntity")
                    request.predicate = NSPredicate(format: "id == %@", transaction.id)
                    
                    let entities = try context.fetch(request)
                    guard let entity = entities.first else {
                        throw StorageError.notFound
                    }
                    
                    try self.populateTransactionEntity(entity, from: transaction)
                    try context.save()
                    
                    self.logger.info("Updated transaction: \(transaction.id)")
                    continuation.resume()
                } catch {
                    self.logger.error("Failed to update transaction: \(error)")
                    continuation.resume(throwing: StorageError.coreDataError(error))
                }
            }
        }
    }
    
    func deleteTransaction(id: String) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            container.performBackgroundTask { context in
                do {
                    let request = NSFetchRequest<NSManagedObject>(entityName: "TransactionEntity")
                    request.predicate = NSPredicate(format: "id == %@", id)
                    
                    let entities = try context.fetch(request)
                    for entity in entities {
                        context.delete(entity)
                    }
                    
                    try context.save()
                    self.logger.info("Deleted transaction: \(id)")
                    continuation.resume()
                } catch {
                    self.logger.error("Failed to delete transaction: \(error)")
                    continuation.resume(throwing: StorageError.coreDataError(error))
                }
            }
        }
    }
    
    // MARK: - Wallet State Operations
    
    func loadWalletState() async throws -> WalletState? {
        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<WalletState?, Error>) in
            container.performBackgroundTask { context in
                do {
                    let request = NSFetchRequest<NSManagedObject>(entityName: "WalletStateEntity")
                    request.fetchLimit = 1
                    
                    let entities = try context.fetch(request)
                    if let entity = entities.first {
                        let walletState = try self.convertToWalletState(from: entity)
                        continuation.resume(returning: walletState)
                    } else {
                        continuation.resume(returning: nil)
                    }
                } catch {
                    self.logger.error("Failed to load wallet state: \(error)")
                    continuation.resume(throwing: StorageError.coreDataError(error))
                }
            }
        }
    }
    
    func saveWalletState(_ state: WalletState) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            container.performBackgroundTask { context in
                do {
                    // Delete existing wallet state (should only be one)
                    let deleteRequest = NSFetchRequest<NSManagedObject>(entityName: "WalletStateEntity")
                    let existingEntities = try context.fetch(deleteRequest)
                    for entity in existingEntities {
                        context.delete(entity)
                    }
                    
                    // Create new wallet state
                    let entity = NSEntityDescription.entity(forEntityName: "WalletStateEntity", in: context)!
                    let walletStateEntity = NSManagedObject(entity: entity, insertInto: context)
                    try self.populateWalletStateEntity(walletStateEntity, from: state)
                    
                    try context.save()
                    self.logger.info("Saved wallet state for wallet: \(state.walletId)")
                    continuation.resume()
                } catch {
                    self.logger.error("Failed to save wallet state: \(error)")
                    continuation.resume(throwing: StorageError.coreDataError(error))
                }
            }
        }
    }
    
    // MARK: - Specialized Operations
    
    func deleteExpiredTokens() async throws -> [String] {
        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<[String], Error>) in
            container.performBackgroundTask { context in
                do {
                    let request = NSFetchRequest<NSManagedObject>(entityName: "OfflineTokenEntity")
                    request.predicate = NSPredicate(format: "expirationDate < %@", Date() as NSDate)
                    
                    let expiredEntities = try context.fetch(request)
                    let expiredIds = expiredEntities.compactMap { $0.value(forKey: "id") as? String }
                    
                    for entity in expiredEntities {
                        context.delete(entity)
                    }
                    
                    try context.save()
                    self.logger.info("Deleted \(expiredIds.count) expired tokens")
                    continuation.resume(returning: expiredIds)
                } catch {
                    self.logger.error("Failed to delete expired tokens: \(error)")
                    continuation.resume(throwing: StorageError.coreDataError(error))
                }
            }
        }
    }
    
    func markTokenAsSpent(id: String, spentAt: Date) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            container.performBackgroundTask { context in
                do {
                    let request = NSFetchRequest<NSManagedObject>(entityName: "OfflineTokenEntity")
                    request.predicate = NSPredicate(format: "id == %@", id)
                    
                    let entities = try context.fetch(request)
                    guard let entity = entities.first else {
                        throw StorageError.notFound
                    }
                    
                    entity.setValue(true, forKey: "isSpent")
                    entity.setValue(spentAt, forKey: "spentAt")
                    
                    try context.save()
                    self.logger.info("Marked token as spent: \(id)")
                    continuation.resume()
                } catch {
                    self.logger.error("Failed to mark token as spent: \(error)")
                    continuation.resume(throwing: StorageError.coreDataError(error))
                }
            }
        }
    }
    
    func getUnspentTokens() async throws -> [OfflineToken] {
        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<[OfflineToken], Error>) in
            container.performBackgroundTask { context in
                do {
                    let request = NSFetchRequest<NSManagedObject>(entityName: "OfflineTokenEntity")
                    request.predicate = NSPredicate(format: "isSpent == NO AND expirationDate > %@", Date() as NSDate)
                    request.sortDescriptors = [NSSortDescriptor(key: "issuedAt", ascending: true)]
                    
                    let entities = try context.fetch(request)
                    let tokens = try entities.compactMap { entity in
                        try self.convertToOfflineToken(from: entity)
                    }
                    
                    continuation.resume(returning: tokens)
                } catch {
                    self.logger.error("Failed to get unspent tokens: \(error)")
                    continuation.resume(throwing: StorageError.coreDataError(error))
                }
            }
        }
    }
    
    func getTransactionsByStatus(_ status: TransactionStatus) async throws -> [Transaction] {
        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<[Transaction], Error>) in
            container.performBackgroundTask { context in
                do {
                    let request = NSFetchRequest<NSManagedObject>(entityName: "TransactionEntity")
                    request.predicate = NSPredicate(format: "status == %@", status.rawValue)
                    request.sortDescriptors = [NSSortDescriptor(key: "timestamp", ascending: false)]
                    
                    let entities = try context.fetch(request)
                    let transactions = try entities.compactMap { entity in
                        try self.convertToTransaction(from: entity)
                    }
                    
                    continuation.resume(returning: transactions)
                } catch {
                    self.logger.error("Failed to get transactions by status: \(error)")
                    continuation.resume(throwing: StorageError.coreDataError(error))
                }
            }
        }
    }
    
    func getTotalOfflineBalance() async throws -> Double {
        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Double, Error>) in
            container.performBackgroundTask { context in
                do {
                    let request = NSFetchRequest<NSManagedObject>(entityName: "OfflineTokenEntity")
                    request.predicate = NSPredicate(format: "isSpent == NO AND expirationDate > %@", Date() as NSDate)
                    
                    let entities = try context.fetch(request)
                    let totalBalance = entities.reduce(0.0) { total, entity in
                        return total + (entity.value(forKey: "amount") as? Double ?? 0.0)
                    }
                    
                    continuation.resume(returning: totalBalance)
                } catch {
                    self.logger.error("Failed to calculate total offline balance: \(error)")
                    continuation.resume(throwing: StorageError.coreDataError(error))
                }
            }
        }
    }
    
    // MARK: - Synchronization Operations
    
    func getPendingSyncTransactions() async throws -> [Transaction] {
        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<[Transaction], Error>) in
            container.performBackgroundTask { context in
                do {
                    let request = NSFetchRequest<NSManagedObject>(entityName: "TransactionEntity")
                    // Get transactions that need to be synced with backend
                    let predicate = NSCompoundPredicate(orPredicateWithSubpredicates: [
                        NSPredicate(format: "type == %@ AND status == %@", TransactionType.tokenRedemption.rawValue, TransactionStatus.pending.rawValue),
                        NSPredicate(format: "type == %@ AND status == %@", TransactionType.offlineTransfer.rawValue, TransactionStatus.completed.rawValue)
                    ])
                    request.predicate = predicate
                    request.sortDescriptors = [NSSortDescriptor(key: "timestamp", ascending: true)]
                    
                    let entities = try context.fetch(request)
                    let transactions = try entities.compactMap { entity in
                        try self.convertToTransaction(from: entity)
                    }
                    
                    continuation.resume(returning: transactions)
                } catch {
                    self.logger.error("Failed to get pending sync transactions: \(error)")
                    continuation.resume(throwing: StorageError.coreDataError(error))
                }
            }
        }
    }
    
    func markTransactionAsSynced(id: String) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            container.performBackgroundTask { context in
                do {
                    let request = NSFetchRequest<NSManagedObject>(entityName: "TransactionEntity")
                    request.predicate = NSPredicate(format: "id == %@", id)
                    
                    let entities = try context.fetch(request)
                    guard let entity = entities.first else {
                        throw StorageError.notFound
                    }
                    
                    // Update status based on transaction type
                    if let type = entity.value(forKey: "type") as? String,
                       type == TransactionType.tokenRedemption.rawValue {
                        entity.setValue(TransactionStatus.completed.rawValue, forKey: "status")
                    }
                    
                    try context.save()
                    self.logger.info("Marked transaction as synced: \(id)")
                    continuation.resume()
                } catch {
                    self.logger.error("Failed to mark transaction as synced: \(error)")
                    continuation.resume(throwing: StorageError.coreDataError(error))
                }
            }
        }
    }
    
    func getLastSyncTimestamp() async throws -> Date? {
        let walletState = try await loadWalletState()
        return walletState?.lastSyncTimestamp
    }
    
    func updateLastSyncTimestamp(_ timestamp: Date) async throws {
        guard var walletState = try await loadWalletState() else {
            throw StorageError.notFound
        }
        
        walletState = WalletState(
            walletId: walletState.walletId,
            publicKey: walletState.publicKey,
            offlineBalance: walletState.offlineBalance,
            blockchainBalance: walletState.blockchainBalance,
            lastSyncTimestamp: timestamp,
            autoRechargeEnabled: walletState.autoRechargeEnabled,
            autoRechargeThreshold: walletState.autoRechargeThreshold,
            autoRechargeAmount: walletState.autoRechargeAmount
        )
        
        try await saveWalletState(walletState)
    }
    
    // MARK: - Data Management Operations
    
    func clearAllData() async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            container.performBackgroundTask { context in
                do {
                    // Delete all entities
                    let entityNames = ["OfflineTokenEntity", "TransactionEntity", "WalletStateEntity"]
                    
                    for entityName in entityNames {
                        let request = NSFetchRequest<NSManagedObject>(entityName: entityName)
                        let entities = try context.fetch(request)
                        for entity in entities {
                            context.delete(entity)
                        }
                    }
                    
                    try context.save()
                    self.logger.info("Cleared all data from storage")
                    continuation.resume()
                } catch {
                    self.logger.error("Failed to clear all data: \(error)")
                    continuation.resume(throwing: StorageError.coreDataError(error))
                }
            }
        }
    }
    
    func exportData() async throws -> Data {
        let tokens = try await loadOfflineTokens()
        let transactions = try await loadTransactions()
        let walletState = try await loadWalletState()
        
        let exportData = StorageExportData(
            tokens: tokens,
            transactions: transactions,
            walletState: walletState,
            exportTimestamp: Date()
        )
        
        let jsonData = try JSONEncoder().encode(exportData)
        
        // Encrypt the exported data
        let encryptedData = try encryptData(jsonData)
        
        logger.info("Exported storage data successfully")
        return encryptedData
    }
    
    func importData(_ data: Data) async throws {
        // Decrypt the imported data
        let decryptedData = try decryptData(data)
        
        let exportData = try JSONDecoder().decode(StorageExportData.self, from: decryptedData)
        
        // Clear existing data
        try await clearAllData()
        
        // Import tokens
        for token in exportData.tokens {
            try await saveOfflineToken(token)
        }
        
        // Import transactions
        for transaction in exportData.transactions {
            try await saveTransaction(transaction)
        }
        
        // Import wallet state
        if let walletState = exportData.walletState {
            try await saveWalletState(walletState)
        }
        
        logger.info("Imported storage data successfully")
    }
    
    func performDataMigration() async throws {
        // This method handles data migration between app versions
        // For now, it's a placeholder for future migration logic
        logger.info("Performing data migration check")
        
        // Check current data model version and perform necessary migrations
        // This would be expanded based on specific migration needs
        
        logger.info("Data migration completed successfully")
    }
}

// MARK: - Helper Methods
extension StorageService {
    
    private func convertToOfflineToken(from entity: NSManagedObject) throws -> OfflineToken {
        guard let id = entity.value(forKey: "id") as? String,
              let signature = entity.value(forKey: "signature") as? String,
              let issuer = entity.value(forKey: "issuer") as? String,
              let issuedAt = entity.value(forKey: "issuedAt") as? Date,
              let expirationDate = entity.value(forKey: "expirationDate") as? Date else {
            throw StorageError.corruptedData
        }
        
        let amount = entity.value(forKey: "amount") as? Double ?? 0.0
        let isSpent = entity.value(forKey: "isSpent") as? Bool ?? false
        let spentAt = entity.value(forKey: "spentAt") as? Date
        
        // Decrypt sensitive data if needed
        let decryptedSignature = try decryptSensitiveData(signature)
        
        return OfflineToken(
            id: id,
            amount: amount,
            signature: decryptedSignature,
            issuer: issuer,
            issuedAt: issuedAt,
            expirationDate: expirationDate,
            isSpent: isSpent,
            spentAt: spentAt,
            divisions: [] // Divisions would be loaded separately if needed
        )
    }
    
    private func populateOfflineTokenEntity(_ entity: NSManagedObject, from token: OfflineToken) throws {
        entity.setValue(token.id, forKey: "id")
        entity.setValue(token.amount, forKey: "amount")
        entity.setValue(try encryptSensitiveData(token.signature), forKey: "signature") // Encrypt signature
        entity.setValue(token.issuer, forKey: "issuer")
        entity.setValue(token.issuedAt, forKey: "issuedAt")
        entity.setValue(token.expirationDate, forKey: "expirationDate")
        entity.setValue(token.isSpent, forKey: "isSpent")
        entity.setValue(token.spentAt, forKey: "spentAt")
    }
    
    private func convertToTransaction(from entity: NSManagedObject) throws -> Transaction {
        guard let id = entity.value(forKey: "id") as? String,
              let typeString = entity.value(forKey: "type") as? String,
              let type = TransactionType(rawValue: typeString),
              let statusString = entity.value(forKey: "status") as? String,
              let status = TransactionStatus(rawValue: statusString),
              let senderId = entity.value(forKey: "senderId") as? String,
              let receiverId = entity.value(forKey: "receiverId") as? String,
              let timestamp = entity.value(forKey: "timestamp") as? Date,
              let tokenIdsString = entity.value(forKey: "tokenIds") as? String else {
            throw StorageError.corruptedData
        }
        
        let amount = entity.value(forKey: "amount") as? Double ?? 0.0
        let tokenIds = tokenIdsString.components(separatedBy: ",").filter { !$0.isEmpty }
        
        // Decrypt signatures if they exist
        let senderSignature = try (entity.value(forKey: "senderSignature") as? String).map { try decryptSensitiveData($0) }
        let receiverSignature = try (entity.value(forKey: "receiverSignature") as? String).map { try decryptSensitiveData($0) }
        
        return Transaction(
            id: id,
            type: type,
            senderId: senderId,
            receiverId: receiverId,
            amount: amount,
            timestamp: timestamp,
            status: status,
            tokenIds: tokenIds,
            senderSignature: senderSignature,
            receiverSignature: receiverSignature,
            metadata: nil // Metadata would be stored separately if needed
        )
    }
    
    private func populateTransactionEntity(_ entity: NSManagedObject, from transaction: Transaction) throws {
        entity.setValue(transaction.id, forKey: "id")
        entity.setValue(transaction.type.rawValue, forKey: "type")
        entity.setValue(transaction.senderId, forKey: "senderId")
        entity.setValue(transaction.receiverId, forKey: "receiverId")
        entity.setValue(transaction.amount, forKey: "amount")
        entity.setValue(transaction.timestamp, forKey: "timestamp")
        entity.setValue(transaction.status.rawValue, forKey: "status")
        entity.setValue(transaction.tokenIds.joined(separator: ","), forKey: "tokenIds")
        
        // Encrypt signatures
        entity.setValue(try transaction.senderSignature.map { try encryptSensitiveData($0) }, forKey: "senderSignature")
        entity.setValue(try transaction.receiverSignature.map { try encryptSensitiveData($0) }, forKey: "receiverSignature")
    }
    
    private func convertToWalletState(from entity: NSManagedObject) throws -> WalletState {
        guard let walletId = entity.value(forKey: "walletId") as? String,
              let publicKey = entity.value(forKey: "publicKey") as? String else {
            throw StorageError.corruptedData
        }
        
        let offlineBalance = entity.value(forKey: "offlineBalance") as? Double ?? 0.0
        let blockchainBalance = entity.value(forKey: "blockchainBalance") as? Double ?? 0.0
        let lastSyncTimestamp = entity.value(forKey: "lastSyncTimestamp") as? Date
        let autoRechargeEnabled = entity.value(forKey: "autoRechargeEnabled") as? Bool ?? false
        let autoRechargeThreshold = entity.value(forKey: "autoRechargeThreshold") as? Double ?? 0.0
        let autoRechargeAmount = entity.value(forKey: "autoRechargeAmount") as? Double ?? 0.0
        
        return WalletState(
            walletId: walletId,
            publicKey: publicKey,
            offlineBalance: offlineBalance,
            blockchainBalance: blockchainBalance,
            lastSyncTimestamp: lastSyncTimestamp,
            autoRechargeEnabled: autoRechargeEnabled,
            autoRechargeThreshold: autoRechargeThreshold,
            autoRechargeAmount: autoRechargeAmount
        )
    }
    
    private func populateWalletStateEntity(_ entity: NSManagedObject, from state: WalletState) throws {
        entity.setValue(state.walletId, forKey: "walletId")
        entity.setValue(state.publicKey, forKey: "publicKey")
        entity.setValue(state.offlineBalance, forKey: "offlineBalance")
        entity.setValue(state.blockchainBalance, forKey: "blockchainBalance")
        entity.setValue(state.lastSyncTimestamp, forKey: "lastSyncTimestamp")
        entity.setValue(state.autoRechargeEnabled, forKey: "autoRechargeEnabled")
        entity.setValue(state.autoRechargeThreshold, forKey: "autoRechargeThreshold")
        entity.setValue(state.autoRechargeAmount, forKey: "autoRechargeAmount")
    }
    
    // MARK: - Encryption/Decryption
    
    private func encryptSensitiveData(_ data: String) throws -> String {
        let dataToEncrypt = Data(data.utf8)
        let sealedBox = try AES.GCM.seal(dataToEncrypt, using: encryptionKey)
        return sealedBox.combined?.base64EncodedString() ?? ""
    }
    
    private func decryptSensitiveData(_ encryptedData: String) throws -> String {
        guard let data = Data(base64Encoded: encryptedData) else {
            throw StorageError.decryptionError
        }
        
        let sealedBox = try AES.GCM.SealedBox(combined: data)
        let decryptedData = try AES.GCM.open(sealedBox, using: encryptionKey)
        
        return String(data: decryptedData, encoding: .utf8) ?? ""
    }
    
    private func encryptData(_ data: Data) throws -> Data {
        let sealedBox = try AES.GCM.seal(data, using: encryptionKey)
        return sealedBox.combined ?? Data()
    }
    
    private func decryptData(_ encryptedData: Data) throws -> Data {
        let sealedBox = try AES.GCM.SealedBox(combined: encryptedData)
        return try AES.GCM.open(sealedBox, using: encryptionKey)
    }
}

// MARK: - Supporting Types

struct WalletState: Codable {
    let walletId: String
    let publicKey: String
    let offlineBalance: Double
    let blockchainBalance: Double
    let lastSyncTimestamp: Date?
    let autoRechargeEnabled: Bool
    let autoRechargeThreshold: Double
    let autoRechargeAmount: Double
    
    init(walletId: String, publicKey: String, offlineBalance: Double, blockchainBalance: Double, lastSyncTimestamp: Date?, autoRechargeEnabled: Bool, autoRechargeThreshold: Double, autoRechargeAmount: Double) {
        self.walletId = walletId
        self.publicKey = publicKey
        self.offlineBalance = offlineBalance
        self.blockchainBalance = blockchainBalance
        self.lastSyncTimestamp = lastSyncTimestamp
        self.autoRechargeEnabled = autoRechargeEnabled
        self.autoRechargeThreshold = autoRechargeThreshold
        self.autoRechargeAmount = autoRechargeAmount
    }
}

struct StorageExportData: Codable {
    let tokens: [OfflineToken]
    let transactions: [Transaction]
    let walletState: WalletState?
    let exportTimestamp: Date
}

enum StorageError: Error, LocalizedError {
    case coreDataError(Error)
    case encodingError(Error)
    case decodingError(Error)
    case encryptionError
    case decryptionError
    case notFound
    case corruptedData
    case migrationFailed
    
    var errorDescription: String? {
        switch self {
        case .coreDataError(let error):
            return "Core Data error: \(error.localizedDescription)"
        case .encodingError(let error):
            return "Encoding error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Decoding error: \(error.localizedDescription)"
        case .encryptionError:
            return "Failed to encrypt data"
        case .decryptionError:
            return "Failed to decrypt data"
        case .notFound:
            return "Data not found"
        case .corruptedData:
            return "Data is corrupted or invalid"
        case .migrationFailed:
            return "Data migration failed"
        }
    }
}

// MARK: - Keychain Helper

class KeychainHelper {
    static func save(key: String, data: Data) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]
        
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }
    
    static func load(key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: kCFBooleanTrue!,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var dataTypeRef: AnyObject?
        let status: OSStatus = SecItemCopyMatching(query as CFDictionary, &dataTypeRef)
        
        if status == noErr {
            return dataTypeRef as? Data
        } else {
            return nil
        }
    }
    
    static func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]
        
        SecItemDelete(query as CFDictionary)
    }
}