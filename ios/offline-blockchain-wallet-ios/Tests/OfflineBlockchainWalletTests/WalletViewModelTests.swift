//
//  WalletViewModelTests.swift
//  OfflineBlockchainWalletTests
//
//  Created by Kiro on 7/21/25.
//

import XCTest
import Combine
@testable import OfflineBlockchainWallet

@MainActor
final class WalletViewModelTests: XCTestCase {
    var viewModel: WalletViewModel!
    var mockOfflineTokenService: MockOfflineTokenService!
    var mockNetworkService: MockNetworkService!
    var mockStorageService: MockStorageService!
    var cancellables: Set<AnyCancellable>!
    
    override func setUpWithError() throws {
        mockOfflineTokenService = MockOfflineTokenService()
        mockNetworkService = MockNetworkService()
        mockStorageService = MockStorageService()
        
        viewModel = WalletViewModel(
            offlineTokenService: mockOfflineTokenService,
            networkService: mockNetworkService,
            storageService: mockStorageService
        )
        
        cancellables = Set<AnyCancellable>()
    }
    
    override func tearDownWithError() throws {
        viewModel = nil
        mockOfflineTokenService = nil
        mockNetworkService = nil
        mockStorageService = nil
        cancellables = nil
    }
    
    func testInitialState() {
        XCTAssertEqual(viewModel.offlineBalance, 0.0)
        XCTAssertEqual(viewModel.blockchainBalance, 0.0)
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNil(viewModel.errorMessage)
        XCTAssertNil(viewModel.lastSyncTimestamp)
        XCTAssertFalse(viewModel.autoRechargeEnabled)
        XCTAssertEqual(viewModel.autoRechargeThreshold, 50.0)
        XCTAssertEqual(viewModel.autoRechargeAmount, 200.0)
    }
    
    func testToggleAutoRecharge() {
        XCTAssertFalse(viewModel.autoRechargeEnabled)
        
        viewModel.toggleAutoRecharge()
        XCTAssertTrue(viewModel.autoRechargeEnabled)
        
        viewModel.toggleAutoRecharge()
        XCTAssertFalse(viewModel.autoRechargeEnabled)
    }
    
    func testUpdateAutoRechargeSettings() {
        let newThreshold = 75.0
        let newAmount = 300.0
        
        viewModel.updateAutoRechargeSettings(threshold: newThreshold, amount: newAmount)
        
        XCTAssertEqual(viewModel.autoRechargeThreshold, newThreshold)
        XCTAssertEqual(viewModel.autoRechargeAmount, newAmount)
    }
    
    func testRefreshBalances() async {
        mockOfflineTokenService.mockBalance = 150.0
        mockNetworkService.mockBalance = 250.0
        
        await viewModel.refreshBalances()
        
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNotNil(viewModel.lastSyncTimestamp)
        XCTAssertNil(viewModel.errorMessage)
    }
    
    func testPurchaseOfflineTokens() async {
        let purchaseAmount = 100.0
        mockOfflineTokenService.shouldSucceed = true
        
        await viewModel.purchaseOfflineTokens(amount: purchaseAmount)
        
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNil(viewModel.errorMessage)
        XCTAssertTrue(mockOfflineTokenService.purchaseTokensCalled)
        XCTAssertEqual(mockOfflineTokenService.lastPurchaseAmount, purchaseAmount)
    }
    
    func testPurchaseOfflineTokensError() async {
        let purchaseAmount = 100.0
        mockOfflineTokenService.shouldSucceed = false
        
        await viewModel.purchaseOfflineTokens(amount: purchaseAmount)
        
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNotNil(viewModel.errorMessage)
    }
}

// MARK: - Mock Services
class MockOfflineTokenService: OfflineTokenServiceProtocol {
    var shouldSucceed = true
    var mockBalance: Double = 0.0
    var purchaseTokensCalled = false
    var lastPurchaseAmount: Double = 0.0
    
    func purchaseTokens(amount: Double) async throws -> [OfflineToken] {
        purchaseTokensCalled = true
        lastPurchaseAmount = amount
        
        if !shouldSucceed {
            throw OfflineTokenError.networkError
        }
        
        return []
    }
    
    func validateToken(_ token: OfflineToken) -> Bool {
        return shouldSucceed
    }
    
    func divideToken(_ token: OfflineToken, amount: Double) throws -> TokenDivisionResult {
        if !shouldSucceed {
            throw OfflineTokenError.invalidToken
        }
        
        let paymentToken = OfflineToken(
            amount: amount,
            signature: "mock-signature",
            issuer: "mock-issuer",
            expirationDate: Date().addingTimeInterval(86400)
        )
        
        return TokenDivisionResult(
            originalToken: token,
            paymentToken: paymentToken,
            changeToken: nil,
            requestedAmount: amount
        )
    }
    
    func markTokenAsSpent(tokenId: String) async throws {
        if !shouldSucceed {
            throw OfflineTokenError.invalidToken
        }
    }
    
    func getAvailableBalance() async -> Double {
        return mockBalance
    }
    
    func handleExpiredTokens() async throws {
        if !shouldSucceed {
            throw OfflineTokenError.networkError
        }
    }
}

class MockNetworkService: NetworkServiceProtocol {
    var shouldSucceed = true
    var mockBalance: Double = 0.0
    
    func connectToBlockchain() async throws -> Web3Connection {
        if !shouldSucceed {
            throw NetworkError.connectionFailed
        }
        return Web3Connection(provider: "mock", chainId: 1)
    }
    
    func callSmartContract(method: String, params: [Any]) async throws -> Any {
        if !shouldSucceed {
            throw NetworkError.invalidResponse
        }
        return "mock-result"
    }
    
    func broadcastTransaction(transaction: SignedTransaction) async throws -> String {
        if !shouldSucceed {
            throw NetworkError.connectionFailed
        }
        return "mock-tx-hash"
    }
    
    func getBlockchainBalance(address: String) async throws -> Double {
        if !shouldSucceed {
            throw NetworkError.connectionFailed
        }
        return mockBalance
    }
    
    func fetchPublicKeys() async throws -> PublicKeyDatabase {
        if !shouldSucceed {
            throw NetworkError.connectionFailed
        }
        return PublicKeyDatabase(keys: [:], lastUpdated: Date())
    }
    
    func authenticateUser(credentials: UserCredentials) async throws -> AuthToken {
        if !shouldSucceed {
            throw NetworkError.authenticationFailed
        }
        return AuthToken(token: "mock-token", expiresAt: Date().addingTimeInterval(3600))
    }
}

class MockStorageService: StorageServiceProtocol {
    var shouldSucceed = true
    var mockTokens: [OfflineToken] = []
    var mockTransactions: [Transaction] = []
    var mockWalletState: WalletState?
    
    func loadOfflineTokens() async throws -> [OfflineToken] {
        if !shouldSucceed {
            throw StorageError.coreDataError
        }
        return mockTokens
    }
    
    func saveOfflineTokens(_ tokens: [OfflineToken]) async throws {
        if !shouldSucceed {
            throw StorageError.coreDataError
        }
        mockTokens = tokens
    }
    
    func loadTransactions() async throws -> [Transaction] {
        if !shouldSucceed {
            throw StorageError.coreDataError
        }
        return mockTransactions
    }
    
    func saveTransaction(_ transaction: Transaction) async throws {
        if !shouldSucceed {
            throw StorageError.coreDataError
        }
        mockTransactions.append(transaction)
    }
    
    func loadWalletState() async throws -> WalletState? {
        if !shouldSucceed {
            throw StorageError.coreDataError
        }
        return mockWalletState
    }
    
    func saveWalletState(_ state: WalletState) async throws {
        if !shouldSucceed {
            throw StorageError.coreDataError
        }
        mockWalletState = state
    }
    
    func deleteExpiredTokens() async throws {
        if !shouldSucceed {
            throw StorageError.coreDataError
        }
    }
    
    func clearAllData() async throws {
        if !shouldSucceed {
            throw StorageError.coreDataError
        }
        mockTokens.removeAll()
        mockTransactions.removeAll()
        mockWalletState = nil
    }
}