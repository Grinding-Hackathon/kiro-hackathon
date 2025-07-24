//
//  DependencyContainer.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation

class DependencyContainer {
    static let shared = DependencyContainer()
    
    // Services
    lazy var logger: LoggerProtocol = Logger.shared
    private lazy var cryptographyService: CryptographyServiceProtocol = CryptographyService()
    private lazy var networkService: NetworkServiceProtocol = NetworkService()
    private lazy var storageService: StorageServiceProtocol = StorageService()
    private lazy var bluetoothService: BluetoothServiceProtocol = BluetoothService()
    lazy var qrCodeService: QRCodeServiceProtocol = QRCodeService(
        cryptographyService: cryptographyService,
        logger: logger
    )
    private lazy var qrBluetoothIntegrationService: QRBluetoothIntegrationServiceProtocol = QRBluetoothIntegrationService(
        bluetoothService: bluetoothService,
        qrCodeService: qrCodeService,
        logger: logger
    )
    private lazy var offlineTokenService: OfflineTokenServiceProtocol = OfflineTokenService(
        cryptographyService: cryptographyService,
        networkService: networkService,
        storageService: storageService
    )
    
    private init() {}
    
    // MARK: - Service Getters
    func getCryptographyService() -> CryptographyServiceProtocol {
        return cryptographyService
    }
    
    func getNetworkService() -> NetworkServiceProtocol {
        return networkService
    }
    
    func getStorageService() -> StorageServiceProtocol {
        return storageService
    }
    
    func getBluetoothService() -> BluetoothServiceProtocol {
        return bluetoothService
    }
    
    func getQRCodeService() -> QRCodeServiceProtocol {
        return qrCodeService
    }
    
    func getQRBluetoothIntegrationService() -> QRBluetoothIntegrationServiceProtocol {
        return qrBluetoothIntegrationService
    }
    
    func getLogger() -> LoggerProtocol {
        return logger
    }
    
    func getOfflineTokenService() -> OfflineTokenServiceProtocol {
        return offlineTokenService
    }
    
    // MARK: - ViewModel Factory
    @MainActor func createWalletViewModel() -> WalletViewModel {
        return WalletViewModel(
            offlineTokenService: offlineTokenService,
            networkService: networkService,
            storageService: storageService
        )
    }
    
    @MainActor func createTransactionViewModel() -> TransactionViewModel {
        return TransactionViewModel(
            transactionService: createTransactionService(),
            storageService: storageService,
            bluetoothService: bluetoothService,
            cryptographyService: cryptographyService
        )
    }
    
    func createTransactionService() -> TransactionService {
        return TransactionService(
            storageService: storageService,
            cryptographyService: cryptographyService,
            offlineTokenService: offlineTokenService
        )
    }
}
