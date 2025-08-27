//
//  NetworkService.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation
import Alamofire
import web3swift

#if canImport(UIKit)
import UIKit
#endif

protocol NetworkServiceProtocol {
    func connectToBlockchain() async throws -> Web3Connection
    func callSmartContract(method: String, params: [Any]) async throws -> Any
    func broadcastTransaction(transaction: SignedTransaction) async throws -> String
    func getBlockchainBalance(address: String) async throws -> Double
    func fetchPublicKeys() async throws -> NetworkPublicKeyDatabase
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
    
    // New token management methods
    func validateToken(tokenId: String) async throws -> TokenValidationResponse
    func divideToken(request: TokenDivisionRequest) async throws -> TokenDivisionResponse
    
    // Security integration methods
    func getMobileSecurityStatus() async throws -> MobileSecurityStatusResponse
    func reportSecurityEvent(event: SecurityEventRequest) async throws -> SecurityEventResponse
    func getSecurityRecommendations() async throws -> SecurityRecommendationsResponse
    
    // Performance monitoring methods
    func reportPerformanceMetrics(metrics: PerformanceMetricsRequest) async throws -> PerformanceMetricsResponse
    func getPerformanceInsights() async throws -> PerformanceInsightsResponse
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
    
    // Performance monitoring
    private var performanceMetrics: [PerformanceMetricsRequest.PerformanceMetric] = []
    private let sessionId = UUID().uuidString
    private var requestStartTimes: [String: Date] = [:]
    
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
    
    func fetchPublicKeys() async throws -> NetworkPublicKeyDatabase {
        guard isOnline() else {
            throw NetworkError.offline
        }
        
        try await ensureValidToken()
        
        let url = "\(baseURL)/api/v1/wallet/keys/public"
        
        let response = try await performRequestWithRetry {
            try await self.session.request(url, method: .get)
                .validate()
                .serializingDecodable(NetworkPublicKeyDatabase.self)
                .value
        }
        
        Logger.shared.log("Public keys fetched successfully: \(response.publicKeys.count) keys, version: \(response.version)", level: .info)
        return response
    }
    
    // MARK: - Retry Mechanism
    
    private func performRequestWithRetry<T>(_ request: @escaping () async throws -> T, endpoint: String = "unknown") async throws -> T {
        let requestId = UUID().uuidString
        trackRequestStart(for: requestId)
        var lastError: Error?
        
        for attempt in 1...maxRetryAttempts {
            do {
                let result = try await request()
                trackRequestEnd(for: requestId, endpoint: endpoint, success: true)
                return result
            } catch let error as AFError {
                lastError = error
                
                // Handle specific HTTP status codes
                if case .responseValidationFailed(reason: .unacceptableStatusCode(let code)) = error {
                    let parsedError = mapStatusCodeToNetworkError(code)
                    
                    // Handle specific error types
                    switch parsedError {
                    case .authenticationRequired, .authenticationFailed:
                        // Try to refresh token once
                        if attempt == 1 {
                            do {
                                let _ = try await refreshAuthToken()
                                continue // Retry with new token
                            } catch {
                                throw parsedError
                            }
                        } else {
                            throw parsedError
                        }
                    case .rateLimited:
                        // Wait longer for rate limit errors
                        if attempt < maxRetryAttempts {
                            let delay = retryDelay * pow(3.0, Double(attempt - 1)) // Longer backoff for rate limits
                            Logger.shared.log("Rate limited, waiting \(delay) seconds before retry", level: .warning)
                            try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                            continue
                        } else {
                            throw parsedError
                        }
                    case .validationError(_, _), .resourceNotFound, .authorizationFailed,
                         .insufficientBalance, .tokenExpired, .tokenAlreadySpent,
                         .doubleSpendingDetected, .invalidSignature:
                        // Don't retry client errors
                        throw parsedError
                    case .blockchainError(_), .internalServerError(_):
                        // Retry server errors
                        break
                    default:
                        if code >= 400 && code < 500 {
                            // Don't retry other client errors
                            throw parsedError
                        }
                        break
                    }
                } else if case .responseValidationFailed(reason: .unacceptableStatusCode(let code)) = error {
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
                
                // Don't retry NetworkError types that shouldn't be retried
                if let networkError = error as? NetworkError {
                    switch networkError {
                    case .validationError(_, _), .resourceNotFound, .authorizationFailed,
                         .insufficientBalance, .tokenExpired, .tokenAlreadySpent,
                         .doubleSpendingDetected, .invalidSignature:
                        throw networkError
                    default:
                        break
                    }
                }
                
                if attempt < maxRetryAttempts {
                    let delay = retryDelay * pow(2.0, Double(attempt - 1))
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                }
            }
        }
        
        // All attempts failed
        trackRequestEnd(for: requestId, endpoint: endpoint, success: false)
        Logger.shared.log("All network request attempts failed", level: .error)
        throw lastError ?? NetworkError.connectionFailed
    }
    
    private func performRequestWithRetry<T>(_ request: @escaping () async throws -> T) async throws -> T {
        return try await performRequestWithRetry(request, endpoint: "unknown")
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
                    
                case .tokenValidation(let tokenId):
                    let _ = try await validateToken(tokenId: tokenId)
                    
                case .tokenDivision(let request):
                    let _ = try await divideToken(request: request)
                    
                case .securityEvent(let event):
                    let _ = try await reportSecurityEvent(event: event)
                    
                case .performanceMetrics(let metrics):
                    let _ = try await reportPerformanceMetrics(metrics: metrics)
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
            case .connectionFailed, .timeout, .serverError, .blockchainError, .internalServerError:
                return true
            case .authenticationFailed, .authenticationRequired, .authorizationFailed,
                 .clientError, .invalidResponse, .offline, .notImplemented,
                 .validationError, .resourceNotFound, .insufficientBalance,
                 .tokenExpired, .tokenAlreadySpent, .doubleSpendingDetected, .invalidSignature:
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
    
    // MARK: - Error Handling
    
    private func parseStandardizedError(from data: Data?, statusCode: Int) -> NetworkError {
        guard let data = data else {
            return .serverError(statusCode)
        }
        
        do {
            let errorResponse = try JSONDecoder().decode(ApiErrorResponse.self, from: data)
            return mapErrorCodeToNetworkError(errorResponse.error)
        } catch {
            // Fallback to generic error if parsing fails
            Logger.shared.log("Failed to parse error response: \(error)", level: .warning)
            return statusCode >= 500 ? .serverError(statusCode) : .clientError(statusCode)
        }
    }
    
    private func mapErrorCodeToNetworkError(_ error: ApiErrorResponse.ErrorDetails) -> NetworkError {
        switch error.code {
        case "AUTHENTICATION_REQUIRED":
            return .authenticationRequired
        case "AUTHORIZATION_FAILED":
            return .authorizationFailed
        case "VALIDATION_ERROR":
            let field = error.details?.field
            return .validationError(error.message, field)
        case "RESOURCE_NOT_FOUND":
            return .resourceNotFound
        case "RATE_LIMIT_EXCEEDED":
            return .rateLimited
        case "BLOCKCHAIN_ERROR":
            return .blockchainError(error.message)
        case "INSUFFICIENT_BALANCE":
            return .insufficientBalance
        case "TOKEN_EXPIRED":
            return .tokenExpired
        case "TOKEN_ALREADY_SPENT":
            return .tokenAlreadySpent
        case "DOUBLE_SPENDING_DETECTED":
            return .doubleSpendingDetected
        case "INVALID_SIGNATURE":
            return .invalidSignature
        case "INTERNAL_SERVER_ERROR":
            return .internalServerError(error.message)
        default:
            return .invalidResponse
        }
    }
    
    private func mapStatusCodeToNetworkError(_ statusCode: Int) -> NetworkError {
        switch statusCode {
        case 401:
            return .authenticationRequired
        case 403:
            return .authorizationFailed
        case 404:
            return .resourceNotFound
        case 422:
            return .validationError("Validation failed", nil)
        case 429:
            return .rateLimited
        case 500...599:
            return .serverError(statusCode)
        default:
            return .clientError(statusCode)
        }
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
        
        let url = "\(baseURL)/api/wallet/tokens/purchase"
        
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
        
        let url = "\(baseURL)/api/wallet/tokens/redeem"
        
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
    
    // MARK: - New Token Management Methods
    
    func validateToken(tokenId: String) async throws -> TokenValidationResponse {
        guard isOnline() else {
            throw NetworkError.offline
        }
        
        try await ensureValidToken()
        
        let url = "\(baseURL)/api/v1/tokens/\(tokenId)/validate"
        
        let response = try await performRequestWithRetry {
            try await self.session.request(url, method: .get)
                .validate()
                .serializingDecodable(TokenValidationResponse.self)
                .value
        }
        
        Logger.shared.log("Token validation completed: \(response.valid ? "valid" : "invalid")", level: .info)
        return response
    }
    
    func divideToken(request: TokenDivisionRequest) async throws -> TokenDivisionResponse {
        guard isOnline() else {
            throw NetworkError.offline
        }
        
        try await ensureValidToken()
        
        let url = "\(baseURL)/api/v1/tokens/divide"
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let requestData = try encoder.encode(request)
        
        let response = try await performRequestWithRetry {
            try await self.session.upload(requestData, to: url, method: .post)
                .validate()
                .serializingDecodable(TokenDivisionResponse.self)
                .value
        }
        
        Logger.shared.log("Token division completed: payment=\(response.paymentToken.amount), change=\(response.changeToken?.amount ?? 0)", level: .info)
        return response
    }
    
    // MARK: - Security Integration Methods
    
    func getMobileSecurityStatus() async throws -> MobileSecurityStatusResponse {
        guard isOnline() else {
            throw NetworkError.offline
        }
        
        try await ensureValidToken()
        
        let url = "\(baseURL)/api/v1/security/mobile/status"
        
        let response = try await performRequestWithRetry {
            try await self.session.request(url, method: .get)
                .validate()
                .serializingDecodable(MobileSecurityStatusResponse.self)
                .value
        }
        
        Logger.shared.log("Mobile security status fetched: \(response.systemHealth.status), alerts: \(response.fraudAlerts.count)", level: .info)
        return response
    }
    
    func reportSecurityEvent(event: SecurityEventRequest) async throws -> SecurityEventResponse {
        guard isOnline() else {
            // Queue security events for later processing
            queueOfflineRequest(.securityEvent(event))
            throw NetworkError.offline
        }
        
        try await ensureValidToken()
        
        let url = "\(baseURL)/api/v1/security/events"
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let eventData = try encoder.encode(event)
        
        let response = try await performRequestWithRetry {
            try await self.session.upload(eventData, to: url, method: .post)
                .validate()
                .serializingDecodable(SecurityEventResponse.self)
                .value
        }
        
        Logger.shared.log("Security event reported: \(response.eventId), action required: \(response.actionRequired)", level: .info)
        return response
    }
    
    func getSecurityRecommendations() async throws -> SecurityRecommendationsResponse {
        guard isOnline() else {
            throw NetworkError.offline
        }
        
        try await ensureValidToken()
        
        let url = "\(baseURL)/api/v1/security/recommendations"
        
        let response = try await performRequestWithRetry {
            try await self.session.request(url, method: .get)
                .validate()
                .serializingDecodable(SecurityRecommendationsResponse.self)
                .value
        }
        
        Logger.shared.log("Security recommendations fetched: \(response.recommendations.count) recommendations, risk level: \(response.riskLevel)", level: .info)
        return response
    }
    
    // MARK: - Performance Monitoring Methods
    
    func reportPerformanceMetrics(metrics: PerformanceMetricsRequest) async throws -> PerformanceMetricsResponse {
        guard isOnline() else {
            // Store metrics locally for later reporting
            performanceMetrics.append(contentsOf: metrics.metrics)
            throw NetworkError.offline
        }
        
        try await ensureValidToken()
        
        let url = "\(baseURL)/api/v1/performance/metrics"
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let metricsData = try encoder.encode(metrics)
        
        let response = try await performRequestWithRetry {
            try await self.session.upload(metricsData, to: url, method: .post)
                .validate()
                .serializingDecodable(PerformanceMetricsResponse.self)
                .value
        }
        
        Logger.shared.log("Performance metrics reported: \(metrics.metrics.count) metrics", level: .info)
        return response
    }
    
    func getPerformanceInsights() async throws -> PerformanceInsightsResponse {
        guard isOnline() else {
            throw NetworkError.offline
        }
        
        try await ensureValidToken()
        
        let url = "\(baseURL)/api/v1/performance/insights"
        
        let response = try await performRequestWithRetry {
            try await self.session.request(url, method: .get)
                .validate()
                .serializingDecodable(PerformanceInsightsResponse.self)
                .value
        }
        
        Logger.shared.log("Performance insights fetched: \(response.insights.count) insights", level: .info)
        return response
    }
    
    // MARK: - Performance Tracking Helpers
    
    private func trackRequestStart(for requestId: String) {
        requestStartTimes[requestId] = Date()
    }
    
    private func trackRequestEnd(for requestId: String, endpoint: String, success: Bool) {
        guard let startTime = requestStartTimes.removeValue(forKey: requestId) else { return }
        
        let duration = Date().timeIntervalSince(startTime)
        let metric = PerformanceMetricsRequest.PerformanceMetric(
            name: "api_request_duration",
            value: duration * 1000, // Convert to milliseconds
            unit: "ms",
            timestamp: Date(),
            context: [
                "endpoint": endpoint,
                "success": success ? "true" : "false"
            ]
        )
        
        performanceMetrics.append(metric)
        
        // Auto-report metrics if we have enough data
        if performanceMetrics.count >= 10 {
            Task {
                await reportStoredMetrics()
            }
        }
    }
    
    private func reportStoredMetrics() async {
        guard !performanceMetrics.isEmpty, isOnline() else { return }
        
        let deviceInfo = PerformanceMetricsRequest.DevicePerformanceInfo(
            deviceModel: getDeviceModel(),
            osVersion: getOSVersion(),
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown",
            memoryUsage: getMemoryUsage(),
            batteryLevel: getBatteryLevel(),
            networkType: getNetworkType(),
            isLowPowerMode: ProcessInfo.processInfo.isLowPowerModeEnabled
        )
        
        let metricsRequest = PerformanceMetricsRequest(
            sessionId: sessionId,
            metrics: performanceMetrics,
            deviceInfo: deviceInfo
        )
        
        do {
            let _ = try await reportPerformanceMetrics(metrics: metricsRequest)
            performanceMetrics.removeAll()
        } catch {
            Logger.shared.log("Failed to report performance metrics: \(error)", level: .warning)
        }
    }
    
    private func getMemoryUsage() -> Double {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4
        
        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_,
                         task_flavor_t(MACH_TASK_BASIC_INFO),
                         $0,
                         &count)
            }
        }
        
        if kerr == KERN_SUCCESS {
            return Double(info.resident_size) / 1024.0 / 1024.0 // Convert to MB
        } else {
            return 0.0
        }
    }
    
    private func getNetworkType() -> String {
        guard let reachability = reachabilityManager else { return "unknown" }
        
        if reachability.isReachableOnEthernetOrWiFi {
            return "wifi"
        } else if reachability.isReachableOnCellular {
            return "cellular"
        } else {
            return "none"
        }
    }
    
    private func getDeviceModel() -> String {
        #if canImport(UIKit)
        return UIDevice.current.model
        #else
        return "unknown"
        #endif
    }
    
    private func getOSVersion() -> String {
        #if canImport(UIKit)
        return UIDevice.current.systemVersion
        #else
        return ProcessInfo.processInfo.operatingSystemVersionString
        #endif
    }
    
    private func getBatteryLevel() -> Double? {
        #if canImport(UIKit)
        let level = UIDevice.current.batteryLevel
        return level >= 0 ? Double(level) : nil
        #else
        return nil
        #endif
    }
}

// MARK: - New Token Management Response Types

struct TokenValidationResponse: Codable {
    let valid: Bool
    let token: TokenInfo
    let validationDetails: ValidationDetails
    
    struct TokenInfo: Codable {
        let id: String
        let amount: Double
        let ownerId: String
        let signature: String
        let isSpent: Bool
        let expiresAt: Date
        let createdAt: Date
    }
    
    struct ValidationDetails: Codable {
        let signatureValid: Bool
        let notExpired: Bool
        let notSpent: Bool
        let ownershipValid: Bool
    }
}

struct TokenDivisionRequest: Codable {
    let tokenId: String
    let paymentAmount: Double
    let recipientId: String
    let timestamp: Date
    
    init(tokenId: String, paymentAmount: Double, recipientId: String, timestamp: Date = Date()) {
        self.tokenId = tokenId
        self.paymentAmount = paymentAmount
        self.recipientId = recipientId
        self.timestamp = timestamp
    }
}

struct TokenDivisionResponse: Codable {
    let originalToken: OriginalTokenInfo
    let paymentToken: OfflineToken
    let changeToken: OfflineToken?
    
    struct OriginalTokenInfo: Codable {
        let id: String
        let amount: Double
        let status: String
    }
}

struct NetworkPublicKeyDatabase: Codable {
    let publicKeys: [String: PublicKeyInfo]
    let otmPublicKey: String
    let version: String
    
    struct PublicKeyInfo: Codable {
        let publicKey: String
        let walletAddress: String
        let lastUpdated: Date
    }
}

// MARK: - Security Integration Response Types

struct MobileSecurityStatusResponse: Codable {
    let systemHealth: SystemHealthInfo
    let fraudAlerts: [FraudAlert]
    let backupStatus: BackupStatusInfo
    let securityMetrics: SecurityMetricsInfo
    let lastUpdated: Date
    
    struct SystemHealthInfo: Codable {
        let status: String // "healthy", "warning", "critical"
        let uptime: Double
        let responseTime: Double
        let errorRate: Double
        let issues: [String]
    }
    
    struct FraudAlert: Codable {
        let id: String
        let type: String
        let severity: String // "low", "medium", "high", "critical"
        let message: String
        let timestamp: Date
        let resolved: Bool
        let actionRequired: Bool
    }
    
    struct BackupStatusInfo: Codable {
        let lastBackup: Date?
        let nextScheduledBackup: Date?
        let backupHealth: String // "healthy", "warning", "failed"
        let storageUsed: Double
        let storageLimit: Double
    }
    
    struct SecurityMetricsInfo: Codable {
        let failedLoginAttempts: Int
        let suspiciousActivities: Int
        let blockedTransactions: Int
        let securityScore: Double // 0.0 to 1.0
    }
}

struct SecurityEventRequest: Codable {
    let eventType: String
    let severity: String
    let description: String
    let metadata: [String: String]?
    let timestamp: Date
    let deviceInfo: DeviceInfo?
    
    struct DeviceInfo: Codable {
        let deviceId: String
        let platform: String
        let version: String
        let model: String?
    }
    
    init(eventType: String, severity: String, description: String, metadata: [String: String]? = nil, timestamp: Date = Date(), deviceInfo: DeviceInfo? = nil) {
        self.eventType = eventType
        self.severity = severity
        self.description = description
        self.metadata = metadata
        self.timestamp = timestamp
        self.deviceInfo = deviceInfo
    }
}

struct SecurityEventResponse: Codable {
    let eventId: String
    let status: String
    let message: String
    let actionRequired: Bool
    let recommendations: [String]?
    let timestamp: Date
}

struct SecurityRecommendationsResponse: Codable {
    let recommendations: [SecurityRecommendation]
    let securityScore: Double
    let riskLevel: String // "low", "medium", "high"
    let lastAssessment: Date
    
    struct SecurityRecommendation: Codable {
        let id: String
        let category: String
        let title: String
        let description: String
        let priority: String // "low", "medium", "high", "critical"
        let actionUrl: String?
        let completed: Bool
        let estimatedTime: String? // e.g., "5 minutes", "1 hour"
    }
}

// MARK: - Performance Monitoring Response Types

struct PerformanceMetricsRequest: Codable {
    let sessionId: String
    let metrics: [PerformanceMetric]
    let deviceInfo: DevicePerformanceInfo
    let timestamp: Date
    
    struct PerformanceMetric: Codable {
        let name: String
        let value: Double
        let unit: String
        let timestamp: Date
        let context: [String: String]?
    }
    
    struct DevicePerformanceInfo: Codable {
        let deviceModel: String
        let osVersion: String
        let appVersion: String
        let memoryUsage: Double
        let batteryLevel: Double?
        let networkType: String
        let isLowPowerMode: Bool
    }
    
    init(sessionId: String, metrics: [PerformanceMetric], deviceInfo: DevicePerformanceInfo, timestamp: Date = Date()) {
        self.sessionId = sessionId
        self.metrics = metrics
        self.deviceInfo = deviceInfo
        self.timestamp = timestamp
    }
}

struct PerformanceMetricsResponse: Codable {
    let received: Bool
    let processed: Int
    let insights: [String]?
    let recommendations: [String]?
    let timestamp: Date
}

struct PerformanceInsightsResponse: Codable {
    let insights: [PerformanceInsight]
    let benchmarks: PerformanceBenchmarks
    let recommendations: [PerformanceRecommendation]
    let lastUpdated: Date
    
    struct PerformanceInsight: Codable {
        let category: String
        let title: String
        let description: String
        let impact: String // "low", "medium", "high"
        let trend: String // "improving", "stable", "degrading"
        let value: Double
        let unit: String
    }
    
    struct PerformanceBenchmarks: Codable {
        let averageResponseTime: Double
        let p95ResponseTime: Double
        let errorRate: Double
        let throughput: Double
        let availability: Double
    }
    
    struct PerformanceRecommendation: Codable {
        let title: String
        let description: String
        let priority: String
        let estimatedImprovement: String
        let actionRequired: Bool
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

// MARK: - Standardized Error Response Models

struct ApiErrorResponse: Codable {
    let success: Bool
    let error: ErrorDetails
    
    struct ErrorDetails: Codable {
        let code: String
        let message: String
        let details: ErrorDetailsInfo?
        let timestamp: String
        let requestId: String?
        
        struct ErrorDetailsInfo: Codable {
            let field: String?
            let reason: String?
            let validationErrors: [ValidationError]?
        }
    }
}

struct ValidationError: Codable {
    let field: String
    let message: String
    let code: String?
}

public enum NetworkError: Error {
    case notImplemented
    case connectionFailed
    case invalidResponse
    case authenticationFailed
    case rateLimited
    case offline
    case timeout
    case serverError(Int)
    case clientError(Int)
    
    // New standardized error cases
    case authenticationRequired
    case authorizationFailed
    case validationError(String, String?)
    case resourceNotFound
    case blockchainError(String)
    case insufficientBalance
    case tokenExpired
    case tokenAlreadySpent
    case doubleSpendingDetected
    case invalidSignature
    case internalServerError(String?)
    
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
        case .authenticationRequired:
            return "Authentication is required"
        case .authorizationFailed:
            return "You don't have permission to perform this action"
        case .validationError(let message, let field):
            if let field = field {
                return "Validation error in \(field): \(message)"
            } else {
                return "Validation error: \(message)"
            }
        case .resourceNotFound:
            return "The requested resource was not found"
        case .blockchainError(let message):
            return "Blockchain error: \(message)"
        case .insufficientBalance:
            return "Insufficient balance to complete this transaction"
        case .tokenExpired:
            return "The token has expired"
        case .tokenAlreadySpent:
            return "The token has already been spent"
        case .doubleSpendingDetected:
            return "Double spending attempt detected"
        case .invalidSignature:
            return "Invalid signature provided"
        case .internalServerError(let message):
            return message ?? "An internal server error occurred"
        }
    }
    
    var userFriendlyMessage: String {
        switch self {
        case .connectionFailed, .timeout:
            return "Please check your internet connection and try again"
        case .authenticationRequired, .authenticationFailed:
            return "Please sign in again to continue"
        case .authorizationFailed:
            return "You don't have permission to perform this action"
        case .rateLimited:
            return "Too many requests. Please wait a moment and try again"
        case .offline:
            return "You're currently offline. This action will be completed when you're back online"
        case .validationError(let message, _):
            return message
        case .resourceNotFound:
            return "The requested item could not be found"
        case .insufficientBalance:
            return "You don't have enough funds for this transaction"
        case .tokenExpired:
            return "This token has expired and cannot be used"
        case .tokenAlreadySpent:
            return "This token has already been used"
        case .blockchainError(_):
            return "There was an issue with the blockchain network. Please try again later"
        default:
            return "Something went wrong. Please try again"
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
    case tokenValidation(String) // token ID
    case tokenDivision(TokenDivisionRequest)
    case securityEvent(SecurityEventRequest)
    case performanceMetrics(PerformanceMetricsRequest)
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