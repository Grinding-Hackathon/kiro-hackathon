//
//  OfflineTokenServiceTests.swift
//  OfflineBlockchainWalletTests
//
//  Created by Kiro on 7/21/25.
//

import XCTest
@testable import offline_blockchain_wallet_ios

final class OfflineTokenServiceTests: XCTestCase {
    
    var offlineTokenService: OfflineTokenService!
    var mockCryptographyService: MockCryptographyService!
    var mockNetworkService: MockNetworkService!
    var mockStorageService: MockStorageService!
    
    override func setUpWithError() throws {
        mockCryptographyService = MockCryptographyService()
        mockNetworkService = MockNetworkService()
        mockStorageService = MockStorageService()
        
        offlineTokenService = OfflineTokenService(
            cryptographyService: mockCryptographyService,
            networkService: mockNetworkService,
            storageService: mockStorageService
        )
    }
    
    override func tearDownWithError() throws {
        offlineTokenService.stopAutomaticTokenManagement()
        offlineTokenService = nil
        mockCryptographyService = nil
        mockNetworkService = nil
        mockStorageService = nil
    }
    
    // MARK: - Token Purchase Tests
    
    func testPurchaseTokensSuccess() async throws {
        // Given
        let amount = 100.0
        let mockTokens = [createMockToken(amount: amount)]
        let mockResponse = TokenPurchaseResponse(tokens: mockTokens, transactionId: "tx123")
        
        mockNetworkService.purchaseTokensResult = .success(mockResponse)
        mockStorageService.walletState = createMockWalletState()
        mockCryptographyService.verifySignatureResult = true
        
        // When
        let result = try await offlineTokenService.purchaseTokens(amount: amount)
        
        // Then
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.amount, amount)
        XCTAssertTrue(mockStorageService.saveOfflineTokensCalled)
        XCTAssertTrue(mockStorageService.saveTransactionCalled)
    }
    
    func testPurchaseTokensInvalidAmount() async {
        // Given
        let invalidAmount = -10.0
        
        // When & Then
        do {
            _ = try await offlineTokenService.purchaseTokens(amount: invalidAmount)
            XCTFail("Should have thrown invalidAmount error")
        } catch OfflineTokenError.invalidAmount {
            // Expected
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
    
    func testPurchaseTokensNetworkFailure() async {
        // Given
        let amount = 100.0
        mockNetworkService.purchaseTokensResult = .failure(NetworkError.connectionFailed)
        mockStorageService.walletState = createMockWalletState()
        
        // When & Then
        do {
            _ = try await offlineTokenService.purchaseTokens(amount: amount)
            XCTFail("Should have thrown purchaseFailed error")
        } catch OfflineTokenError.purchaseFailed {
            // Expected
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
    
    // MARK: - Token Validation Tests
    
    func testValidateTokenSuccess() {
        // Given
        let token = createMockToken()
        mockCryptographyService.verifySignatureResult = true
        offlineTokenService.otmPublicKey = "mock_otm_public_key"
        
        // When
        let result = offlineTokenService.validateToken(token)
        
        // Then
        XCTAssertTrue(result)
        XCTAssertTrue(mockCryptographyService.verifySignatureCalled)
    }
    
    func testValidateTokenExpired() {
        // Given
        let expiredToken = createMockToken(expirationDate: Date().addingTimeInterval(-3600))
        
        // When
        let result = offlineTokenService.validateToken(expiredToken)
        
        // Then
        XCTAssertFalse(result)
    }
    
    func testValidateTokenSpent() {
        // Given
        let spentToken = createMockToken(isSpent: true)
        
        // When
        let result = offlineTokenService.validateToken(spentToken)
        
        // Then
        XCTAssertFalse(result)
    }
    
    func testValidateTokenInvalidSignature() {
        // Given
        let token = createMockToken()
        mockCryptographyService.verifySignatureResult = false
        offlineTokenService.otmPublicKey = "mock_otm_public_key"
        
        // When
        let result = offlineTokenService.validateToken(token)
        
        // Then
        XCTAssertFalse(result)
    }
    
    // MARK: - Token Division Tests
    
    func testDivideTokenSuccess() throws {
        // Given
        let originalToken = createMockToken(amount: 100.0)
        let divisionAmount = 30.0
        mockCryptographyService.verifySignatureResult = true
        mockCryptographyService.signDataResult = "mock_division_signature"
        mockCryptographyService.retrievePrivateKeyResult = "mock_private_key"
        offlineTokenService.otmPublicKey = "mock_otm_public_key"
        
        // When
        let result = try offlineTokenService.divideToken(originalToken, amount: divisionAmount)
        
        // Then
        XCTAssertEqual(result.paymentToken.amount, divisionAmount)
        XCTAssertEqual(result.changeToken?.amount, 70.0)
        XCTAssertEqual(result.requestedAmount, divisionAmount)
        XCTAssertEqual(result.changeAmount, 70.0)
        XCTAssertEqual(result.originalToken.divisions.count, 1)
    }
    
    func testDivideTokenExactAmount() throws {
        // Given
        let originalToken = createMockToken(amount: 50.0)
        let divisionAmount = 50.0
        mockCryptographyService.verifySignatureResult = true
        mockCryptographyService.signDataResult = "mock_division_signature"
        mockCryptographyService.retrievePrivateKeyResult = "mock_private_key"
        offlineTokenService.otmPublicKey = "mock_otm_public_key"
        
        // When
        let result = try offlineTokenService.divideToken(originalToken, amount: divisionAmount)
        
        // Then
        XCTAssertEqual(result.paymentToken.amount, divisionAmount)
        XCTAssertNil(result.changeToken)
        XCTAssertEqual(result.changeAmount, 0.0)
    }
    
    func testDivideTokenInsufficientBalance() {
        // Given
        let originalToken = createMockToken(amount: 50.0)
        let divisionAmount = 100.0
        mockCryptographyService.verifySignatureResult = true
        offlineTokenService.otmPublicKey = "mock_otm_public_key"
        
        // When & Then
        XCTAssertThrowsError(try offlineTokenService.divideToken(originalToken, amount: divisionAmount)) { error in
            XCTAssertTrue(error is OfflineTokenError)
            if case OfflineTokenError.insufficientBalance = error {
                // Expected
            } else {
                XCTFail("Unexpected error: \(error)")
            }
        }
    }
    
    func testDivideTokenInvalidToken() {
        // Given
        let invalidToken = createMockToken()
        mockCryptographyService.verifySignatureResult = false
        offlineTokenService.otmPublicKey = "mock_otm_public_key"
        
        // When & Then
        XCTAssertThrowsError(try offlineTokenService.divideToken(invalidToken, amount: 10.0)) { error in
            XCTAssertTrue(error is OfflineTokenError)
            if case OfflineTokenError.invalidToken = error {
                // Expected
            } else {
                XCTFail("Unexpected error: \(error)")
            }
        }
    }
    
    // MARK: - Token Management Tests
    
    func testMarkTokenAsSpentSuccess() async throws {
        // Given
        let tokenId = "token123"
        mockStorageService.markTokenAsSpentResult = .success(())
        mockStorageService.totalOfflineBalance = 150.0
        mockStorageService.walletState = createMockWalletState()
        
        // When
        try await offlineTokenService.markTokenAsSpent(tokenId: tokenId)
        
        // Then
        XCTAssertTrue(mockStorageService.markTokenAsSpentCalled)
        XCTAssertTrue(mockStorageService.saveWalletStateCalled)
    }
    
    func testGetAvailableBalanceSuccess() async {
        // Given
        let expectedBalance = 250.0
        mockStorageService.totalOfflineBalance = expectedBalance
        
        // When
        let result = await offlineTokenService.getAvailableBalance()
        
        // Then
        XCTAssertEqual(result, expectedBalance)
    }
    
    func testGetAvailableBalanceError() async {
        // Given
        mockStorageService.getTotalOfflineBalanceResult = .failure(StorageError.coreDataError(NSError()))
        
        // When
        let result = await offlineTokenService.getAvailableBalance()
        
        // Then
        XCTAssertEqual(result, 0.0)
    }
    
    // MARK: - Expired Token Handling Tests
    
    func testHandleExpiredTokensSuccess() async throws {
        // Given
        let expiredTokenIds = ["token1", "token2"]
        mockStorageService.deleteExpiredTokensResult = .success(expiredTokenIds)
        mockStorageService.totalOfflineBalance = 100.0
        mockStorageService.walletState = createMockWalletState()
        
        // When
        try await offlineTokenService.handleExpiredTokens()
        
        // Then
        XCTAssertTrue(mockStorageService.deleteExpiredTokensCalled)
        XCTAssertTrue(mockStorageService.saveWalletStateCalled)
    }
    
    func testHandleExpiredTokensWithAutoRecharge() async throws {
        // Given
        let expiredTokenIds = ["token1"]
        let walletState = createMockWalletState(
            autoRechargeEnabled: true,
            autoRechargeThreshold: 50.0,
            autoRechargeAmount: 100.0
        )
        
        mockStorageService.deleteExpiredTokensResult = .success(expiredTokenIds)
        mockStorageService.totalOfflineBalance = 30.0 // Below threshold
        mockStorageService.walletState = walletState
        
        let mockTokens = [createMockToken(amount: 100.0)]
        let mockResponse = TokenPurchaseResponse(tokens: mockTokens, transactionId: "tx123")
        mockNetworkService.purchaseTokensResult = .success(mockResponse)
        mockCryptographyService.verifySignatureResult = true
        
        // When
        try await offlineTokenService.handleExpiredTokens()
        
        // Then
        XCTAssertTrue(mockStorageService.deleteExpiredTokensCalled)
        XCTAssertTrue(mockNetworkService.purchaseTokensCalled)
    }
    
    // MARK: - Token Redemption Tests
    
    func testRedeemTokensSuccess() async throws {
        // Given
        let tokens = [createMockToken(amount: 50.0), createMockToken(amount: 30.0)]
        let mockResponse = TokenRedemptionResponse(transactionHash: "0x123", blockchainBalance: 1000.0)
        
        mockCryptographyService.verifySignatureResult = true
        offlineTokenService.otmPublicKey = "mock_otm_public_key"
        mockNetworkService.redeemTokensResult = .success(mockResponse)
        mockStorageService.walletState = createMockWalletState()
        
        // When
        let result = try await offlineTokenService.redeemTokens(tokens)
        
        // Then
        XCTAssertEqual(result, "0x123")
        XCTAssertTrue(mockNetworkService.redeemTokensCalled)
        XCTAssertTrue(mockStorageService.saveTransactionCalled)
    }
    
    func testRedeemTokensNoValidTokens() async {
        // Given
        let invalidTokens = [createMockToken()]
        mockCryptographyService.verifySignatureResult = false
        offlineTokenService.otmPublicKey = "mock_otm_public_key"
        
        // When & Then
        do {
            _ = try await offlineTokenService.redeemTokens(invalidTokens)
            XCTFail("Should have thrown noValidTokens error")
        } catch OfflineTokenError.noValidTokens {
            // Expected
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
    
    // MARK: - Helper Methods
    
    private func createMockToken(
        amount: Double = 100.0,
        expirationDate: Date = Date().addingTimeInterval(3600),
        isSpent: Bool = false
    ) -> OfflineToken {
        return OfflineToken(
            amount: amount,
            signature: "mock_signature",
            issuer: "mock_otm",
            expirationDate: expirationDate,
            isSpent: isSpent
        )
    }
    
    private func createMockWalletState(
        autoRechargeEnabled: Bool = true,
        autoRechargeThreshold: Double = 50.0,
        autoRechargeAmount: Double = 200.0
    ) -> WalletState {
        return WalletState(
            walletId: "wallet123",
            publicKey: "mock_public_key",
            offlineBalance: 100.0,
            blockchainBalance: 500.0,
            autoRechargeEnabled: autoRechargeEnabled,
            autoRechargeThreshold: autoRechargeThreshold,
            autoRechargeAmount: autoRechargeAmount
        )
    }
}

// MARK: - Mock Services

class MockCryptographyService: CryptographyServiceProtocol {
    var verifySignatureResult = false
    var verifySignatureCalled = false
    var signDataResult = "mock_signature"
    var signDataCalled = false
    var retrievePrivateKeyResult: String? = "mock_private_key"
    var retrievePrivateKeyCalled = false
    
    func generateKeyPair() throws -> (privateKey: String, publicKey: String) {
        return ("mock_private", "mock_public")
    }
    
    func generateKeyPairForSigning() throws -> (privateKey: String, publicKey: String) {
        return ("mock_private", "mock_public")
    }
    
    func generateKeyPairForEncryption() throws -> (privateKey: String, publicKey: String) {
        return ("mock_private", "mock_public")
    }
    
    func signData(_ data: Data, with privateKey: String) throws -> String {
        signDataCalled = true
        return signDataResult
    }
    
    func verifySignature(_ signature: String, for data: Data, with publicKey: String) throws -> Bool {
        verifySignatureCalled = true
        return verifySignatureResult
    }
    
    func signMessage(_ message: String, with privateKey: String) throws -> String {
        return signDataResult
    }
    
    func verifyMessageSignature(_ signature: String, for message: String, with publicKey: String) throws -> Bool {
        return verifySignatureResult
    }
    
    func encryptData(_ data: Data, with publicKey: String) throws -> Data {
        return data
    }
    
    func decryptData(_ encryptedData: Data, with privateKey: String) throws -> Data {
        return encryptedData
    }
    
    func encryptMessage(_ message: String, with publicKey: String) throws -> String {
        return message
    }
    
    func decryptMessage(_ encryptedMessage: String, with privateKey: String) throws -> String {
        return encryptedMessage
    }
    
    func storePrivateKey(_ privateKey: String, for identifier: String) throws {
        // Mock implementation
    }
    
    func retrievePrivateKey(for identifier: String) throws -> String? {
        retrievePrivateKeyCalled = true
        return retrievePrivateKeyResult
    }
    
    func deletePrivateKey(for identifier: String) throws {
        // Mock implementation
    }
    
    func keyExists(for identifier: String) -> Bool {
        return true
    }
    
    func hashData(_ data: Data) -> String {
        return "mock_hash"
    }
    
    func hashMessage(_ message: String) -> String {
        return "mock_hash"
    }
    
    func validatePrivateKey(_ privateKey: String) -> Bool {
        return true
    }
    
    func validatePublicKey(_ publicKey: String) -> Bool {
        return true
    }
    
    func validateKeyPair(privateKey: String, publicKey: String) -> Bool {
        return true
    }
}

class MockNetworkService: NetworkServiceProtocol {
    var purchaseTokensResult: Result<TokenPurchaseResponse, Error> = .failure(NetworkError.notImplemented)
    var purchaseTokensCalled = false
    var redeemTokensResult: Result<TokenRedemptionResponse, Error> = .failure(NetworkError.notImplemented)
    var redeemTokensCalled = false
    
    func connectToBlockchain() async throws -> Web3Connection {
        throw NetworkError.notImplemented
    }
    
    func callSmartContract(method: String, params: [Any]) async throws -> Any {
        throw NetworkError.notImplemented
    }
    
    func broadcastTransaction(transaction: SignedTransaction) async throws -> String {
        throw NetworkError.notImplemented
    }
    
    func getBlockchainBalance(address: String) async throws -> Double {
        return 0.0
    }
    
    func fetchPublicKeys() async throws -> PublicKeyDatabase {
        return PublicKeyDatabase(keys: ["otm": "mock_otm_public_key"], lastUpdated: Date())
    }
    
    func authenticateUser(credentials: UserCredentials) async throws -> AuthToken {
        throw NetworkError.notImplemented
    }
    
    func purchaseOfflineTokens(request: TokenPurchaseRequest) async throws -> TokenPurchaseResponse {
        purchaseTokensCalled = true
        return try purchaseTokensResult.get()
    }
    
    func redeemOfflineTokens(request: TokenRedemptionRequest) async throws -> TokenRedemptionResponse {
        redeemTokensCalled = true
        return try redeemTokensResult.get()
    }
}

class MockStorageService: StorageServiceProtocol {
    var walletState: WalletState?
    var offlineTokens: [OfflineToken] = []
    var transactions: [Transaction] = []
    var totalOfflineBalance: Double = 0.0
    
    var saveOfflineTokensCalled = false
    var saveTransactionCalled = false
    var markTokenAsSpentCalled = false
    var saveWalletStateCalled = false
    var deleteExpiredTokensCalled = false
    
    var markTokenAsSpentResult: Result<Void, Error> = .success(())
    var getTotalOfflineBalanceResult: Result<Double, Error> = .success(0.0)
    var deleteExpiredTokensResult: Result<[String], Error> = .success([])
    
    func loadOfflineTokens() async throws -> [OfflineToken] {
        return offlineTokens
    }
    
    func saveOfflineToken(_ token: OfflineToken) async throws {
        offlineTokens.append(token)
    }
    
    func saveOfflineTokens(_ tokens: [OfflineToken]) async throws {
        saveOfflineTokensCalled = true
        offlineTokens.append(contentsOf: tokens)
    }
    
    func updateOfflineToken(_ token: OfflineToken) async throws {
        // Mock implementation
    }
    
    func deleteOfflineToken(id: String) async throws {
        offlineTokens.removeAll { $0.id == id }
    }
    
    func loadTransactions() async throws -> [Transaction] {
        return transactions
    }
    
    func saveTransaction(_ transaction: Transaction) async throws {
        saveTransactionCalled = true
        transactions.append(transaction)
    }
    
    func updateTransaction(_ transaction: Transaction) async throws {
        // Mock implementation
    }
    
    func deleteTransaction(id: String) async throws {
        transactions.removeAll { $0.id == id }
    }
    
    func loadWalletState() async throws -> WalletState? {
        return walletState
    }
    
    func saveWalletState(_ state: WalletState) async throws {
        saveWalletStateCalled = true
        walletState = state
    }
    
    func deleteExpiredTokens() async throws -> [String] {
        deleteExpiredTokensCalled = true
        return try deleteExpiredTokensResult.get()
    }
    
    func markTokenAsSpent(id: String, spentAt: Date) async throws {
        markTokenAsSpentCalled = true
        try markTokenAsSpentResult.get()
    }
    
    func getUnspentTokens() async throws -> [OfflineToken] {
        return offlineTokens.filter { !$0.isSpent && !$0.isExpired }
    }
    
    func getTransactionsByStatus(_ status: TransactionStatus) async throws -> [Transaction] {
        return transactions.filter { $0.status == status }
    }
    
    func getTotalOfflineBalance() async throws -> Double {
        return try getTotalOfflineBalanceResult.get()
    }
    
    func getPendingSyncTransactions() async throws -> [Transaction] {
        return []
    }
    
    func markTransactionAsSynced(id: String) async throws {
        // Mock implementation
    }
    
    func getLastSyncTimestamp() async throws -> Date? {
        return walletState?.lastSyncTimestamp
    }
    
    func updateLastSyncTimestamp(_ timestamp: Date) async throws {
        // Mock implementation
    }
    
    func clearAllData() async throws {
        offlineTokens.removeAll()
        transactions.removeAll()
        walletState = nil
    }
    
    func exportData() async throws -> Data {
        return Data()
    }
    
    func importData(_ data: Data) async throws {
        // Mock implementation
    }
    
    func performDataMigration() async throws {
        // Mock implementation
    }
}