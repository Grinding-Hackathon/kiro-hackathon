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
    private lazy var cryptographyService: CryptographyServiceProtocol = CryptographyService()
    private lazy var networkService: NetworkServiceProtocol = NetworkService()
    private lazy var storageService: StorageServiceProtocol = StorageService()
    private lazy var bluetoothService: BluetoothServiceProtocol = BluetoothService()
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
            storageService: storageService,
            bluetoothService: bluetoothService,
            cryptographyService: cryptographyService
        )
    }
}
