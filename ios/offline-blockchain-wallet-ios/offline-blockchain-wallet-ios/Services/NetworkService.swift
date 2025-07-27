//
//  NetworkService.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation
import Alamofire
import web3swift

protocol NetworkServiceProtocol {
    func connectToBlockchain() async throws -> Web3Connection
    func callSmartContract(method: String, params: [Any]) async throws -> Any
    func broadcastTransaction(transaction: SignedTransaction) async throws -> String
    func getBlockchainBalance(address: String) async throws -> Double
    func fetchPublicKeys() async throws -> PublicKeyDatabase
    func authenticateUser(credentials: UserCredentials) async throws -> AuthToken
    func purchaseOfflineTokens(request: TokenPurchaseRequest) async throws -> TokenPurchaseResponse
    func redeemOfflineTokens(request: TokenRedemptionRequest) async throws -> TokenRedemptionResponse
    func refreshAuthToken() async throws -> AuthToken
    func syncTransactions() async throws -> [Transaction]
    func getWalletBalance(walletId: String) async throws -> WalletBalanceResponse
    func submitTransaction(transaction: Transaction) async throws -> TransactionSubmissionResponse
    func getTransactionStatus(transactionId: String) async throws -> TransactionStatusResponse
    func queueOfflineRequest(_ request: OfflineAPIRequest)
    func processOfflineQueue() async
    func isOnline() -> Bool
}

class NetworkService: NetworkServiceProtocol {
    private let baseURL: String
    private let session: Session
    private var authToken: String?
    private var tokenExpirationDate: Date?
    
    // Expose authToken for the interceptor
    internal var currentAuthToken: String? {
        return authToken
    }
    private let offlineQueue: OfflineRequestQueue
    private let reachabilityManager: NetworkReachabilityManager?
    private var backgroundSyncTimer: Timer?
    
    // Retry configuration
    private let maxRetryAttempts = 3
    private let retryDelay: TimeInterval = 2.0
    
    init(baseURL: String = "https://api.offlineblockchainwallet.com") {
        self.baseURL = baseURL
        
        // Configure session with interceptors for authentication and retry
        let interceptor = AuthenticationInterceptor(networkService: nil)
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 60
        
        self.session = Session(configuration: configuration, interceptor: interceptor)
        self.offlineQueue = OfflineRequestQueue()
        self.reachabilityManager = NetworkReachabilityManager()
        
        // Set self reference for interceptor after initialization
        if let authInterceptor = interceptor as? AuthenticationInterceptor {
            // Note: This creates a weak reference cycle that's handled by the weak reference in the interceptor
        }
        
        setupNetworkMonitoring()
        startBackgroundSync()
    }
    
    deinit {
        backgroundSyncTimer?.invalidate()
        reachabilityManager?.stopListening()
    }
    
    // MARK: - Network Monitoring
    
    private func setupNetworkMonitoring() {
        reachabilityManager?.startListening { [weak self] status in
            switch status {
            case .reachable:
                Logger.shared.log("Network connection restored", level: .info)
                Task {
                    await self?.processOfflineQueue()
                }
            case .notReachable:
                Logger.shared.log("Network connection lost", level: .warning)
            case .unknown:
                Logger.shared.log("Network status unknown", level: .warning)
            }
        }
    }
    
    func isOnline() -> Bool {
        return reachabilityManager?.isReachable ?? false
    }
    
    // MARK: - Background Sync
    
    private func startBackgroundSync() {
        backgroundSyncTimer = Timer.scheduledTimer(withTimeInterval: 300, repeats: true) { [weak self] _ in
            Task {
                await self?.performBackgroundSync()
            }
        }
    }
    
    private func performBackgroundSync() async {
        guard isOnline() else { return }
        
        do {
            // Process offline queue
            await processOfflineQueue()
            
            // Sync transactions
            let _ = try await syncTransactions()
            
            Logger.shared.log("Background sync completed successfully", level: .info)
        } catch {
            Logger.shared.log("Background sync failed: \(error)", level: .error)
        }
    }
    
    // MARK: - Authentication
    
    private func ensureValidToken() async throws {
        if let token = authToken,
           let expirationDate = tokenExpirationDate,
           expirationDate > Date().addingTimeInterval(300) { // 5 minutes buffer
            return
        }
        
        // Token is expired or about to expire, refresh it
        let _ = try await refreshAuthToken()
    }
    
    private func addAuthenticationHeaders(to request: inout URLRequest) {
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }
    
    func refreshAuthToken() async throws -> AuthToken {
        let url = "\(baseURL)/api/auth/refresh"
        
        let response = try await performRequestWithRetry {
            try await self.session.request(url, method: .post)
                .validate()
                .serializingDecodable(AuthToken.self)
                .value
        }
        
        self.authToken = response.token
        self.tokenExpirationDate = response.expiresAt
        
        Logger.shared.log("Auth token refreshed successfully", level: .info)
        return response
    }
    
    func connectToBlockchain() async throws -> Web3Connection {
        // Implementation placeholder - will be completed in later tasks
        throw NetworkError.notImplemented
    }
    
    func callSmartContract(method: String, params: [Any]) async throws -> Any {
        // Implementation placeholder - will be completed in later tasks
        throw NetworkError.notImplemented
    }
    
    func broadcastTransaction(transaction: SignedTransaction) async throws -> String {
        // Implementation placeholder - will be completed in later tasks
        throw NetworkError.notImplemented
    }
    
    func getBlockchainBalance(address: String) async throws -> Double {
        // Implementation placeholder - will be completed in later tasks
        return 0.0
    }
    
    func fetchPublicKeys() async throws -> PublicKeyDatabase {
        guard isOnline() else {
            throw NetworkError.offline
        }
        
        try await ensureValidToken()
        
        let url = "\(baseURL)/api/keys/public"
        
        let response = try await performRequestWithRetry {
            try await self.session.request(url, method: .get)
                .validate()
                .serializingDecodable(PublicKeyDatabase.self)
                .value
        }
        
        Logger.shared.log("Public keys fetched successfully", level: .info)
        return response
    }
    
    // MARK: - Retry Mechanism
    
    private func performRequestWithRetry<T>(_ request: @escaping () async throws -> T) async throws -> T {
        var lastError: Error?
        
        for attempt in 1...maxRetryAttempts {
            do {
                return try await request()
            } catch let error as AFError {
                lastError = error
                
                // Don't retry for certain errors
                if case .responseValidationFailed(reason: .unacceptableStatusCode(let code)) = error {
                    if code == 401 {
                        // Unauthorized - try to refresh token once
                        if attempt == 1 {
                            do {
                                let _ = try await refreshAuthToken()
                                continue // Retry with new token
                            } catch {
                                throw NetworkError.authenticationFailed
                            }
                        } else {
                            throw NetworkError.authenticationFailed
                        }
                    } else if code >= 400 && code < 500 {
                        // Client errors - don't retry
                        throw NetworkError.clientError(code)
                    }
                }
                
                // Log the attempt
                Logger.shared.log("Network request attempt \(attempt) failed: \(error)", level: .warning)
                
                // Wait before retrying (exponential backoff)
                if attempt < maxRetryAttempts {
                    let delay = retryDelay * pow(2.0, Double(attempt - 1))
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                }
            } catch {
                lastError = error
                Logger.shared.log("Network request attempt \(attempt) failed: \(error)", level: .warning)
                
                if attempt < maxRetryAttempts {
                    let delay = retryDelay * pow(2.0, Double(attempt - 1))
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                }
            }
        }
        
        // All attempts failed
        Logger.shared.log("All network request attempts failed", level: .error)
        throw lastError ?? NetworkError.connectionFailed
    }
    
    // MARK: - Offline Queue Management
    
    func queueOfflineRequest(_ request: OfflineAPIRequest) {
        offlineQueue.enqueue(request)
        Logger.shared.log("Request queued for offline processing: \(request)", level: .info)
    }
    
    func processOfflineQueue() async {
        guard isOnline() else { return }
        
        Logger.shared.log("Processing offline queue", level: .info)
        
        while let request = offlineQueue.dequeue() {
            do {
                switch request {
                case .tokenPurchase(let purchaseRequest):
                    let _ = try await purchaseOfflineTokens(request: purchaseRequest)
                    
                case .tokenRedemption(let redemptionRequest):
                    let _ = try await redeemOfflineTokens(request: redemptionRequest)
                    
                case .transactionSync:
                    let _ = try await syncTransactions()
                    
                case .transactionSubmission(let transaction):
                    let _ = try await submitTransaction(transaction: transaction)
                    
                case .balanceUpdate(let walletId):
                    let _ = try await getWalletBalance(walletId: walletId)
                }
                
                Logger.shared.log("Offline request processed successfully: \(request)", level: .info)
                
            } catch {
                Logger.shared.log("Failed to process offline request: \(request), error: \(error)", level: .error)
                
                // Re-queue the request if it's a temporary failure
                if shouldRetryRequest(error: error) {
                    offlineQueue.enqueue(request)
                }
            }
        }
    }
    
    private func shouldRetryRequest(error: Error) -> Bool {
        if let networkError = error as? NetworkError {
            switch networkError {
            case .connectionFailed, .timeout, .serverError:
                return true
            case .authenticationFailed, .clientError, .invalidResponse, .offline, .notImplemented:
                return false
            case .rateLimited:
                return true // Retry rate limited requests after delay
            }
        }
        
        // Check for specific HTTP status codes
        if let afError = error as? AFError,
           case .responseValidationFailed(reason: .unacceptableStatusCode(let code)) = afError {
            // Retry server errors (5xx) but not client errors (4xx)
            return code >= 500
        }
        
        return true // Retry unknown errors
    }
    
    // MARK: - Network Configuration
    
    func updateBaseURL(_ newBaseURL: String) {
        // This would require recreating the session, which is complex
        // For now, log the request
        Logger.shared.log("Base URL update requested: \(newBaseURL)", level: .info)
    }
    
    func clearAuthToken() {
        authToken = nil
        tokenExpirationDate = nil
        Logger.shared.log("Auth token cleared", level: .info)
    }
    
    func getAuthTokenExpirationDate() -> Date? {
        return tokenExpirationDate
    }
    
    func isAuthTokenValid() -> Bool {
        guard let token = authToken,
              let expirationDate = tokenExpirationDate else {
            return false
        }
        
        return !token.isEmpty && expirationDate > Date()
    }
    
    func authenticateUser(credentials: UserCredentials) async throws -> AuthToken {
        let url = "\(baseURL)/api/auth/login"
        
        let parameters: [String: Any] = [
            "walletAddress": credentials.walletAddress,
            "signature": credentials.signature,
            "timestamp": Date().timeIntervalSince1970
        ]
        
        let response = try await performRequestWithRetry {
            try await self.session.request(url, method: .post, parameters: parameters)
                .validate()
                .serializingDecodable(AuthToken.self)
                .value
        }
        
        self.authToken = response.token
        self.tokenExpirationDate = response.expiresAt
        
        Logger.shared.log("User authenticated successfully", level: .info)
        return response
    }
    
    func purchaseOfflineTokens(request: TokenPurchaseRequest) async throws -> TokenPurchaseResponse {
        guard isOnline() else {
            queueOfflineRequest(.tokenPurchase(request))
            throw NetworkError.offline
        }
        
        try await ensureValidToken()
        
        let url = "\(baseURL)/api/tokens/purchase"
        
        let parameters: [String: Any] = [
            "amount": request.amount,
            "walletId": request.walletId,
            "timestamp": request.timestamp.timeIntervalSince1970
        ]
        
        let response = try await performRequestWithRetry {
            try await self.session.request(url, method: .post, parameters: parameters)
                .validate()
                .serializingDecodable(TokenPurchaseResponse.self)
                .value
        }
        
        Logger.shared.log("Offline tokens purchased successfully: \(response.tokens.count) tokens", level: .info)
        return response
    }
    
    func redeemOfflineTokens(request: TokenRedemptionRequest) async throws -> TokenRedemptionResponse {
        guard isOnline() else {
            queueOfflineRequest(.tokenRedemption(request))
            throw NetworkError.offline
        }
        
        try await ensureValidToken()
        
        let url = "\(baseURL)/api/tokens/redeem"
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let requestData = try encoder.encode(request)
        
        let response = try await performRequestWithRetry {
            try await self.session.upload(requestData, to: url, method: .post)
                .validate()
                .serializingDecodable(TokenRedemptionResponse.self)
                .value
        }
        
        Logger.shared.log("Offline tokens redeemed successfully: \(request.tokens.count) tokens", level: .info)
        return response
    }
    
    func syncTransactions() async throws -> [Transaction] {
        guard isOnline() else {
            throw NetworkError.offline
        }
        
        try await ensureValidToken()
        
        let url = "\(baseURL)/api/transactions/sync"
        
        // Get last sync timestamp for incremental sync
        let lastSyncTimestamp = UserDefaults.standard.object(forKey: "lastTransactionSync") as? Date ?? Date.distantPast
        
        let parameters: [String: Any] = [
            "since": lastSyncTimestamp.timeIntervalSince1970
        ]
        
        let response = try await performRequestWithRetry {
            try await self.session.request(url, method: .get, parameters: parameters)
                .validate()
                .serializingDecodable(TransactionSyncResponse.self)
                .value
        }
        
        // Update last sync timestamp
        UserDefaults.standard.set(response.lastSyncTimestamp, forKey: "lastTransactionSync")
        
        Logger.shared.log("Transaction sync completed: \(response.transactions.count) transactions", level: .info)
        return response.transactions
    }
    
    // MARK: - Additional API Methods
    
    func getWalletBalance(walletId: String) async throws -> WalletBalanceResponse {
        guard isOnline() else {
            throw NetworkError.offline
        }
        
        try await ensureValidToken()
        
        let url = "\(baseURL)/api/wallet/\(walletId)/balance"
        
        let response = try await performRequestWithRetry {
            try await self.session.request(url, method: .get)
                .validate()
                .serializingDecodable(WalletBalanceResponse.self)
                .value
        }
        
        Logger.shared.log("Wallet balance fetched: \(response.blockchainBalance)", level: .info)
        return response
    }
    
    func submitTransaction(transaction: Transaction) async throws -> TransactionSubmissionResponse {
        guard isOnline() else {
            queueOfflineRequest(.transactionSubmission(transaction))
            throw NetworkError.offline
        }
        
        try await ensureValidToken()
        
        let url = "\(baseURL)/api/transactions/submit"
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let transactionData = try encoder.encode(transaction)
        
        let response = try await performRequestWithRetry {
            try await self.session.upload(transactionData, to: url, method: .post)
                .validate()
                .serializingDecodable(TransactionSubmissionResponse.self)
                .value
        }
        
        Logger.shared.log("Transaction submitted successfully: \(response.transactionId)", level: .info)
        return response
    }
    
    func getTransactionStatus(transactionId: String) async throws -> TransactionStatusResponse {
        guard isOnline() else {
            throw NetworkError.offline
        }
        
        try await ensureValidToken()
        
        let url = "\(baseURL)/api/transactions/\(transactionId)/status"
        
        let response = try await performRequestWithRetry {
            try await self.session.request(url, method: .get)
                .validate()
                .serializingDecodable(TransactionStatusResponse.self)
                .value
        }
        
        Logger.shared.log("Transaction status fetched: \(response.status)", level: .info)
        return response
    }
}

// MARK: - Supporting Types
struct Web3Connection {
    let provider: String
    let chainId: Int
}

struct SignedTransaction {
    let hash: String
    let signature: String
    let data: Data
}



struct UserCredentials {
    let walletAddress: String
    let signature: String
}

struct AuthToken: Codable {
    let token: String
    let expiresAt: Date
}

struct TokenPurchaseRequest: Codable {
    let amount: Double
    let walletId: String
    let timestamp: Date
}

struct TokenPurchaseResponse: Codable {
    let tokens: [OfflineToken]
    let transactionId: String
}

struct TokenRedemptionRequest: Codable {
    let tokens: [OfflineToken]
    let walletId: String
    let timestamp: Date
}

struct TokenRedemptionResponse: Codable {
    let transactionHash: String
    let blockchainBalance: Double
}

enum NetworkError: Error {
    case notImplemented
    case connectionFailed
    case invalidResponse
    case authenticationFailed
    case rateLimited
    case offline
    case timeout
    case serverError(Int)
    case clientError(Int)
    
    var localizedDescription: String {
        switch self {
        case .notImplemented:
            return "Feature not implemented"
        case .connectionFailed:
            return "Connection failed"
        case .invalidResponse:
            return "Invalid response from server"
        case .authenticationFailed:
            return "Authentication failed"
        case .rateLimited:
            return "Rate limit exceeded"
        case .offline:
            return "Device is offline"
        case .timeout:
            return "Request timed out"
        case .serverError(let code):
            return "Server error: \(code)"
        case .clientError(let code):
            return "Client error: \(code)"
        }
    }
}

// MARK: - Offline Request Queue

enum OfflineAPIRequest: Codable {
    case tokenPurchase(TokenPurchaseRequest)
    case tokenRedemption(TokenRedemptionRequest)
    case transactionSync
    case transactionSubmission(Transaction)
    case balanceUpdate(String) // wallet ID
}

class OfflineRequestQueue {
    private var queue: [OfflineAPIRequest] = []
    private let queueKey = "OfflineRequestQueue"
    private let userDefaults = UserDefaults.standard
    
    init() {
        loadQueue()
    }
    
    func enqueue(_ request: OfflineAPIRequest) {
        queue.append(request)
        saveQueue()
    }
    
    func dequeue() -> OfflineAPIRequest? {
        guard !queue.isEmpty else { return nil }
        let request = queue.removeFirst()
        saveQueue()
        return request
    }
    
    func isEmpty() -> Bool {
        return queue.isEmpty
    }
    
    func count() -> Int {
        return queue.count
    }
    
    private func saveQueue() {
        do {
            let data = try JSONEncoder().encode(queue)
            userDefaults.set(data, forKey: queueKey)
        } catch {
            Logger.shared.log("Failed to save offline queue: \(error)", level: .error)
        }
    }
    
    private func loadQueue() {
        guard let data = userDefaults.data(forKey: queueKey) else { return }
        
        do {
            queue = try JSONDecoder().decode([OfflineAPIRequest].self, from: data)
        } catch {
            Logger.shared.log("Failed to load offline queue: \(error)", level: .error)
            queue = []
        }
    }
}

// MARK: - Authentication Interceptor

final class AuthenticationInterceptor: RequestInterceptor {
    private weak var networkService: NetworkService?
    
    init(networkService: NetworkService? = nil) {
        self.networkService = networkService
    }
    
    func adapt(_ urlRequest: URLRequest, for session: Session, completion: @escaping (Result<URLRequest, Error>) -> Void) {
        var urlRequest = urlRequest
        
        // Add common headers
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue("OfflineBlockchainWallet/1.0", forHTTPHeaderField: "User-Agent")
        
        // Add authentication header if available
        if let token = networkService?.currentAuthToken {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        completion(.success(urlRequest))
    }
    
    func retry(_ request: Request, for session: Session, dueTo error: Error, completion: @escaping (RetryResult) -> Void) {
        // Handle 401 errors by attempting token refresh
        if let afError = error as? AFError,
           case .responseValidationFailed(reason: .unacceptableStatusCode(let code)) = afError,
           code == 401 {
            
            // Attempt to refresh token
            Task {
                do {
                    let _ = try await networkService?.refreshAuthToken()
                    completion(.retry)
                } catch {
                    completion(.doNotRetry)
                }
            }
        } else {
            // Let the NetworkService handle other retries
            completion(.doNotRetry)
        }
    }
}

// MARK: - Additional Response Types

struct TransactionSyncResponse: Codable {
    let transactions: [Transaction]
    let lastSyncTimestamp: Date
}

struct WalletBalanceResponse: Codable {
    let walletId: String
    let blockchainBalance: Double
    let offlineTokenBalance: Double
    let lastUpdated: Date
}

struct TransactionSubmissionResponse: Codable {
    let transactionId: String
    let status: String
    let blockchainTxHash: String?
    let timestamp: Date
}

struct TransactionStatusResponse: Codable {
    let transactionId: String
    let status: TransactionStatus
    let blockchainTxHash: String?
    let confirmations: Int?
    let lastUpdated: Date
}