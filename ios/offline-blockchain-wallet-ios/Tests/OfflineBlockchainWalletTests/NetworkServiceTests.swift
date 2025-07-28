//
//  NetworkServiceTests.swift
//  OfflineBlockchainWalletTests
//
//  Created by Kiro on 7/21/25.
//

import XCTest
import Alamofire
@testable import offline_blockchain_wallet_ios

class NetworkServiceTests: XCTestCase {
    var networkService: NetworkService!
    var mockSession: Session!
    
    override func setUp() {
        super.setUp()
        
        // Use a test base URL
        networkService = NetworkService(baseURL: "https://test-api.offlineblockchainwallet.com")
    }
    
    override func tearDown() {
        networkService = nil
        super.tearDown()
    }
    
    // MARK: - Authentication Tests
    
    func testAuthenticateUser() async throws {
        let credentials = UserCredentials(
            walletAddress: "0x1234567890123456789012345678901234567890",
            signature: "test_signature"
        )
        
        // This test would require a mock server or network stubbing
        // For now, we test that the method exists and handles offline state
        XCTAssertFalse(networkService.isOnline())
        
        do {
            let _ = try await networkService.authenticateUser(credentials: credentials)
            XCTFail("Should throw offline error")
        } catch NetworkError.offline {
            // Expected behavior when offline
            XCTAssertTrue(true)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
    
    func testRefreshAuthToken() async throws {
        // Test offline behavior
        do {
            let _ = try await networkService.refreshAuthToken()
            XCTFail("Should throw offline error")
        } catch NetworkError.offline {
            // Expected behavior when offline
            XCTAssertTrue(true)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
    
    // MARK: - Token Management Tests
    
    func testPurchaseOfflineTokensOffline() async throws {
        let request = TokenPurchaseRequest(
            amount: 100.0,
            walletId: "test_wallet",
            timestamp: Date()
        )
        
        // Test offline behavior - should queue the request
        do {
            let _ = try await networkService.purchaseOfflineTokens(request: request)
            XCTFail("Should throw offline error")
        } catch NetworkError.offline {
            // Expected behavior when offline
            XCTAssertTrue(true)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
    
    func testRedeemOfflineTokensOffline() async throws {
        let token = OfflineToken(
            id: "test_token",
            amount: 50.0,
            signature: "test_signature",
            issuer: "test_issuer",
            issuedAt: Date(),
            expirationDate: Date().addingTimeInterval(86400),
            isSpent: false
        )
        
        let request = TokenRedemptionRequest(
            tokens: [token],
            walletId: "test_wallet",
            timestamp: Date()
        )
        
        // Test offline behavior - should queue the request
        do {
            let _ = try await networkService.redeemOfflineTokens(request: request)
            XCTFail("Should throw offline error")
        } catch NetworkError.offline {
            // Expected behavior when offline
            XCTAssertTrue(true)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
    
    // MARK: - Offline Queue Tests
    
    func testOfflineQueueManagement() {
        let request = TokenPurchaseRequest(
            amount: 100.0,
            walletId: "test_wallet",
            timestamp: Date()
        )
        
        // Queue a request
        networkService.queueOfflineRequest(.tokenPurchase(request))
        
        // The queue should be managed internally
        // We can't directly test the queue state without exposing it
        // But we can verify the method doesn't crash
        XCTAssertTrue(true)
    }
    
    func testProcessOfflineQueueWhenOffline() async {
        // Should not process when offline
        await networkService.processOfflineQueue()
        
        // Method should complete without error
        XCTAssertTrue(true)
    }
    
    // MARK: - Network Status Tests
    
    func testIsOnlineStatus() {
        // In test environment, should typically be false
        let isOnline = networkService.isOnline()
        XCTAssertFalse(isOnline)
    }
    
    // MARK: - Sync Tests
    
    func testSyncTransactionsOffline() async throws {
        do {
            let _ = try await networkService.syncTransactions()
            XCTFail("Should throw offline error")
        } catch NetworkError.offline {
            // Expected behavior when offline
            XCTAssertTrue(true)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
    
    func testFetchPublicKeysOffline() async throws {
        do {
            let _ = try await networkService.fetchPublicKeys()
            XCTFail("Should throw offline error")
        } catch NetworkError.offline {
            // Expected behavior when offline
            XCTAssertTrue(true)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
    
    // MARK: - Additional API Tests
    
    func testGetWalletBalanceOffline() async throws {
        do {
            let _ = try await networkService.getWalletBalance(walletId: "test_wallet")
            XCTFail("Should throw offline error")
        } catch NetworkError.offline {
            // Expected behavior when offline
            XCTAssertTrue(true)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
    
    func testSubmitTransactionOffline() async throws {
        let transaction = Transaction(
            type: .offlineTransfer,
            senderId: "sender_id",
            receiverId: "receiver_id",
            amount: 50.0,
            tokenIds: ["token_1"]
        )
        
        do {
            let _ = try await networkService.submitTransaction(transaction: transaction)
            XCTFail("Should throw offline error")
        } catch NetworkError.offline {
            // Expected behavior when offline - should queue the request
            XCTAssertTrue(true)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
    
    func testGetTransactionStatusOffline() async throws {
        do {
            let _ = try await networkService.getTransactionStatus(transactionId: "test_tx_id")
            XCTFail("Should throw offline error")
        } catch NetworkError.offline {
            // Expected behavior when offline
            XCTAssertTrue(true)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
    
    // MARK: - Authentication Management Tests
    
    func testAuthTokenManagement() {
        // Initially no token
        XCTAssertFalse(networkService.isAuthTokenValid())
        XCTAssertNil(networkService.getAuthTokenExpirationDate())
        
        // Clear token (should not crash)
        networkService.clearAuthToken()
        XCTAssertFalse(networkService.isAuthTokenValid())
    }
    
    // MARK: - Error Handling Tests
    
    func testNetworkErrorDescriptions() {
        XCTAssertEqual(NetworkError.connectionFailed.localizedDescription, "Connection failed")
        XCTAssertEqual(NetworkError.authenticationFailed.localizedDescription, "Authentication failed")
        XCTAssertEqual(NetworkError.offline.localizedDescription, "Device is offline")
        XCTAssertEqual(NetworkError.timeout.localizedDescription, "Request timed out")
        XCTAssertEqual(NetworkError.serverError(500).localizedDescription, "Server error: 500")
        XCTAssertEqual(NetworkError.clientError(404).localizedDescription, "Client error: 404")
        XCTAssertEqual(NetworkError.rateLimited.localizedDescription, "Rate limit exceeded")
        XCTAssertEqual(NetworkError.notImplemented.localizedDescription, "Feature not implemented")
    }
    
    // MARK: - Offline Request Queue Tests
    
    func testOfflineRequestQueueOperations() {
        let queue = OfflineRequestQueue()
        
        // Test empty queue
        XCTAssertTrue(queue.isEmpty())
        XCTAssertEqual(queue.count(), 0)
        XCTAssertNil(queue.dequeue())
        
        // Test enqueue/dequeue
        let request = OfflineAPIRequest.transactionSync
        queue.enqueue(request)
        
        XCTAssertFalse(queue.isEmpty())
        XCTAssertEqual(queue.count(), 1)
        
        let dequeuedRequest = queue.dequeue()
        XCTAssertNotNil(dequeuedRequest)
        
        if case .transactionSync = dequeuedRequest! {
            XCTAssertTrue(true)
        } else {
            XCTFail("Wrong request type dequeued")
        }
        
        XCTAssertTrue(queue.isEmpty())
        XCTAssertEqual(queue.count(), 0)
    }
    
    func testOfflineRequestQueuePersistence() {
        let queue1 = OfflineRequestQueue()
        let request = OfflineAPIRequest.transactionSync
        
        queue1.enqueue(request)
        XCTAssertEqual(queue1.count(), 1)
        
        // Create new queue instance - should load persisted data
        let queue2 = OfflineRequestQueue()
        XCTAssertEqual(queue2.count(), 1)
        
        let dequeuedRequest = queue2.dequeue()
        XCTAssertNotNil(dequeuedRequest)
        
        if case .transactionSync = dequeuedRequest! {
            XCTAssertTrue(true)
        } else {
            XCTFail("Wrong request type dequeued")
        }
    }
    
    func testOfflineRequestQueueWithDifferentRequestTypes() {
        let queue = OfflineRequestQueue()
        
        // Test different request types
        let purchaseRequest = TokenPurchaseRequest(
            amount: 100.0,
            walletId: "test_wallet",
            timestamp: Date()
        )
        
        let transaction = Transaction(
            type: .offlineTransfer,
            senderId: "sender",
            receiverId: "receiver",
            amount: 25.0,
            tokenIds: ["token_1"]
        )
        
        queue.enqueue(.tokenPurchase(purchaseRequest))
        queue.enqueue(.transactionSubmission(transaction))
        queue.enqueue(.balanceUpdate("wallet_id"))
        queue.enqueue(.transactionSync)
        
        XCTAssertEqual(queue.count(), 4)
        
        // Dequeue and verify order
        let request1 = queue.dequeue()
        if case .tokenPurchase = request1! {
            XCTAssertTrue(true)
        } else {
            XCTFail("Wrong request type dequeued")
        }
        
        let request2 = queue.dequeue()
        if case .transactionSubmission = request2! {
            XCTAssertTrue(true)
        } else {
            XCTFail("Wrong request type dequeued")
        }
        
        let request3 = queue.dequeue()
        if case .balanceUpdate = request3! {
            XCTAssertTrue(true)
        } else {
            XCTFail("Wrong request type dequeued")
        }
        
        let request4 = queue.dequeue()
        if case .transactionSync = request4! {
            XCTAssertTrue(true)
        } else {
            XCTFail("Wrong request type dequeued")
        }
        
        XCTAssertTrue(queue.isEmpty())
    }
}

// MARK: - Mock Types for Testing

extension NetworkServiceTests {
    
    struct MockTokenPurchaseResponse: Codable {
        let tokens: [OfflineToken]
        let transactionId: String
    }
    
    struct MockTokenRedemptionResponse: Codable {
        let transactionHash: String
        let blockchainBalance: Double
    }
    
    struct MockAuthToken: Codable {
        let token: String
        let expiresAt: Date
    }
}