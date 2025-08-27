# iOS Integration Guide

## 🎯 Overview

This guide provides comprehensive instructions for integrating the iOS Offline Blockchain Wallet app with the backend API. It covers all new endpoints, response formats, and best practices for seamless communication.

## 📋 Prerequisites

- iOS 14.0 or later
- Xcode 13.0 or later
- Swift 5.5 or later
- Backend API running on compatible server

## 🔧 NetworkService Integration

### Updated NetworkService Methods

The iOS `NetworkService` has been enhanced with new methods to support all API integration fixes:

#### Authentication Methods

```swift
// Enhanced token refresh with proper error handling
func refreshToken(refreshToken: String) async throws -> AuthResponse {
    let request = RefreshTokenRequest(refreshToken: refreshToken)
    return try await performRequest(
        endpoint: "/auth/refresh",
        method: .POST,
        body: request,
        requiresAuth: false
    )
}

// Session validation
func validateSession() async throws -> SessionValidationResponse {
    return try await performRequest(
        endpoint: "/auth/validate-session",
        method: .GET,
        requiresAuth: true
    )
}

// Secure logout with token invalidation
func logout(refreshToken: String) async throws -> LogoutResponse {
    let request = LogoutRequest(refreshToken: refreshToken)
    return try await performRequest(
        endpoint: "/auth/logout",
        method: .POST,
        body: request,
        requiresAuth: true
    )
}
```

#### Enhanced Wallet Methods

```swift
// Get balance for specific wallet ID
func getWalletBalance(walletId: String) async throws -> WalletBalanceResponse {
    return try await performRequest(
        endpoint: "/wallet/\(walletId)/balance",
        method: .GET,
        requiresAuth: true
    )
}

// Get transaction history with pagination
func getWalletHistory(
    page: Int = 1,
    limit: Int = 20,
    type: TransactionType? = nil,
    status: TransactionStatus? = nil,
    startDate: Date? = nil,
    endDate: Date? = nil
) async throws -> WalletHistoryResponse {
    var queryItems: [URLQueryItem] = [
        URLQueryItem(name: "page", value: "\(page)"),
        URLQueryItem(name: "limit", value: "\(limit)")
    ]
    
    if let type = type {
        queryItems.append(URLQueryItem(name: "type", value: type.rawValue))
    }
    if let status = status {
        queryItems.append(URLQueryItem(name: "status", value: status.rawValue))
    }
    if let startDate = startDate {
        queryItems.append(URLQueryItem(name: "startDate", value: ISO8601DateFormatter().string(from: startDate)))
    }
    if let endDate = endDate {
        queryItems.append(URLQueryItem(name: "endDate", value: ISO8601DateFormatter().string(from: endDate)))
    }
    
    return try await performRequest(
        endpoint: "/wallet/history",
        method: .GET,
        queryItems: queryItems,
        requiresAuth: true
    )
}
```

#### New Token Management Methods

```swift
// Validate offline token
func validateToken(tokenId: String, signature: String, amount: Double) async throws -> TokenValidationResponse {
    let request = TokenValidationRequest(
        tokenId: tokenId,
        signature: signature,
        amount: amount
    )
    return try await performRequest(
        endpoint: "/tokens/validate",
        method: .POST,
        body: request,
        requiresAuth: true
    )
}

// Divide token for change-making
func divideToken(tokenId: String, paymentAmount: Double, signature: String) async throws -> TokenDivisionResponse {
    let request = TokenDivisionRequest(
        tokenId: tokenId,
        paymentAmount: paymentAmount,
        signature: signature
    )
    return try await performRequest(
        endpoint: "/tokens/divide",
        method: .POST,
        body: request,
        requiresAuth: true
    )
}

// Get public key database
func fetchPublicKeys() async throws -> PublicKeyDatabase {
    let response: ApiResponse<PublicKeyDatabase> = try await performRequest(
        endpoint: "/tokens/public-keys",
        method: .GET,
        requiresAuth: true
    )
    return response.data
}
```

#### Transaction Management Methods

```swift
// Submit new transaction
func submitTransaction(
    type: TransactionType,
    senderId: String,
    receiverId: String,
    amount: Double,
    tokenIds: [String],
    senderSignature: String,
    metadata: TransactionMetadata? = nil
) async throws -> TransactionSubmissionResponse {
    let request = TransactionSubmissionRequest(
        type: type,
        senderId: senderId,
        receiverId: receiverId,
        amount: amount,
        tokenIds: tokenIds,
        senderSignature: senderSignature,
        metadata: metadata
    )
    return try await performRequest(
        endpoint: "/transactions/submit",
        method: .POST,
        body: request,
        requiresAuth: true
    )
}

// Synchronize transactions
func syncTransactions(
    lastSyncTimestamp: Date? = nil,
    limit: Int = 50
) async throws -> TransactionSyncResponse {
    var queryItems: [URLQueryItem] = [
        URLQueryItem(name: "limit", value: "\(limit)")
    ]
    
    if let lastSync = lastSyncTimestamp {
        queryItems.append(URLQueryItem(name: "lastSyncTimestamp", value: ISO8601DateFormatter().string(from: lastSync)))
    }
    
    return try await performRequest(
        endpoint: "/transactions/sync",
        method: .GET,
        queryItems: queryItems,
        requiresAuth: true
    )
}

// Get transaction status
func getTransactionStatus(transactionId: String) async throws -> TransactionStatusResponse {
    return try await performRequest(
        endpoint: "/transactions/\(transactionId)/status",
        method: .GET,
        requiresAuth: true
    )
}

// Sync offline transactions
func syncOfflineTransactions(transactions: [OfflineTransaction]) async throws -> OfflineTransactionSyncResponse {
    let request = OfflineTransactionSyncRequest(transactions: transactions)
    return try await performRequest(
        endpoint: "/transactions/sync-offline",
        method: .POST,
        body: request,
        requiresAuth: true
    )
}
```

#### Security Integration Methods

```swift
// Get mobile security status
func getMobileSecurityStatus() async throws -> MobileSecurityStatusResponse {
    return try await performRequest(
        endpoint: "/security/mobile/status",
        method: .GET,
        requiresAuth: true
    )
}

// Report security event
func reportSecurityEvent(
    eventType: SecurityEventType,
    severity: SecuritySeverity,
    description: String,
    metadata: [String: Any]? = nil
) async throws -> SecurityEventResponse {
    let request = SecurityEventRequest(
        eventType: eventType,
        severity: severity,
        description: description,
        metadata: metadata
    )
    return try await performRequest(
        endpoint: "/security/events",
        method: .POST,
        body: request,
        requiresAuth: true
    )
}

// Get security recommendations
func getSecurityRecommendations() async throws -> SecurityRecommendationsResponse {
    return try await performRequest(
        endpoint: "/security/recommendations",
        method: .GET,
        requiresAuth: true
    )
}
```

## 📱 Updated iOS Models

### Enhanced Response Models

```swift
// Enhanced wallet balance response
struct WalletBalanceResponse: Codable {
    let walletId: String
    let walletAddress: String
    let balances: WalletBalances
    let totalBalance: Double
}

struct WalletBalances: Codable {
    let blockchain: BlockchainBalance
    let offline: OfflineBalance
    let pending: PendingBalance
}

struct BlockchainBalance: Codable {
    let amount: Double
    let currency: String
    let lastUpdated: Date
}

struct OfflineBalance: Codable {
    let amount: Double
    let tokenCount: Int
    let lastUpdated: Date
}

struct PendingBalance: Codable {
    let amount: Double
    let transactionCount: Int
}

// Transaction sync response
struct TransactionSyncResponse: Codable {
    let transactions: [Transaction]
    let lastSyncTimestamp: Date
    let totalCount: Int
    let hasMore: Bool
}

// Token validation response
struct TokenValidationResponse: Codable {
    let valid: Bool
    let token: ValidatedToken
    let validationDetails: TokenValidationDetails
}

struct ValidatedToken: Codable {
    let id: String
    let amount: Double
    let ownerId: String
    let signature: String
    let isSpent: Bool
    let expiresAt: Date
    let createdAt: Date
}

struct TokenValidationDetails: Codable {
    let signatureValid: Bool
    let notExpired: Bool
    let notSpent: Bool
    let ownershipValid: Bool
}

// Token division response
struct TokenDivisionResponse: Codable {
    let originalToken: TokenStatus
    let paymentToken: OfflineToken
    let changeToken: OfflineToken?
}

struct TokenStatus: Codable {
    let id: String
    let amount: Double
    let status: String
}

// Public key database
struct PublicKeyDatabase: Codable {
    let publicKeys: [String: PublicKeyInfo]
    let otmPublicKey: String
    let version: String
}

struct PublicKeyInfo: Codable {
    let publicKey: String
    let walletAddress: String
    let lastUpdated: Date
}

// Security status response
struct MobileSecurityStatusResponse: Codable {
    let overallStatus: SecurityStatus
    let securityScore: Int
    let alerts: [SecurityAlert]
    let recommendations: [SecurityRecommendation]
    let lastSecurityScan: Date
}

enum SecurityStatus: String, Codable {
    case healthy
    case warning
    case critical
}

struct SecurityAlert: Codable {
    let id: String
    let type: AlertType
    let message: String
    let timestamp: Date
}

enum AlertType: String, Codable {
    case info
    case warning
    case error
}

struct SecurityRecommendation: Codable {
    let id: String
    let priority: RecommendationPriority
    let title: String
    let description: String
}

enum RecommendationPriority: String, Codable {
    case low
    case medium
    case high
}
```

## 🔄 Error Handling

### Enhanced Error Handling

```swift
// Updated error handling for new error codes
enum APIError: Error, LocalizedError {
    case authenticationRequired
    case authorizationFailed
    case validationError(details: [ValidationError])
    case resourceNotFound
    case rateLimitExceeded
    case blockchainError(message: String)
    case insufficientBalance
    case tokenExpired
    case tokenAlreadySpent
    case doubleSpendingDetected
    case invalidSignature
    case networkError
    case transactionFailed(reason: String)
    case syncError(message: String)
    case securityViolation
    case internalServerError
    
    var errorDescription: String? {
        switch self {
        case .authenticationRequired:
            return "Authentication required. Please log in."
        case .authorizationFailed:
            return "You don't have permission to perform this action."
        case .validationError(let details):
            return "Validation failed: \(details.map { $0.message }.joined(separator: ", "))"
        case .resourceNotFound:
            return "The requested resource was not found."
        case .rateLimitExceeded:
            return "Too many requests. Please try again later."
        case .blockchainError(let message):
            return "Blockchain error: \(message)"
        case .insufficientBalance:
            return "Insufficient balance for this transaction."
        case .tokenExpired:
            return "Token has expired."
        case .tokenAlreadySpent:
            return "Token has already been spent."
        case .doubleSpendingDetected:
            return "Double spending attempt detected."
        case .invalidSignature:
            return "Invalid cryptographic signature."
        case .networkError:
            return "Network connection error."
        case .transactionFailed(let reason):
            return "Transaction failed: \(reason)"
        case .syncError(let message):
            return "Synchronization error: \(message)"
        case .securityViolation:
            return "Security policy violation detected."
        case .internalServerError:
            return "Internal server error. Please try again."
        }
    }
}

// Error parsing from API responses
extension NetworkService {
    private func parseError(from response: ErrorResponse) -> APIError {
        switch response.error.code {
        case "AUTHENTICATION_REQUIRED":
            return .authenticationRequired
        case "AUTHORIZATION_FAILED":
            return .authorizationFailed
        case "VALIDATION_ERROR":
            if let details = response.error.details as? [ValidationError] {
                return .validationError(details: details)
            }
            return .validationError(details: [])
        case "RESOURCE_NOT_FOUND":
            return .resourceNotFound
        case "RATE_LIMIT_EXCEEDED":
            return .rateLimitExceeded
        case "BLOCKCHAIN_ERROR":
            return .blockchainError(message: response.error.message)
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
        case "NETWORK_ERROR":
            return .networkError
        case "TRANSACTION_FAILED":
            return .transactionFailed(reason: response.error.message)
        case "SYNC_ERROR":
            return .syncError(message: response.error.message)
        case "SECURITY_VIOLATION":
            return .securityViolation
        default:
            return .internalServerError
        }
    }
}
```

## 🔄 Retry Logic and Resilience

### Enhanced Retry Mechanism

```swift
extension NetworkService {
    private func performRequestWithRetry<T: Codable>(
        endpoint: String,
        method: HTTPMethod,
        body: Encodable? = nil,
        queryItems: [URLQueryItem]? = nil,
        requiresAuth: Bool = true,
        maxRetries: Int = 3
    ) async throws -> T {
        var lastError: Error?
        
        for attempt in 0..<maxRetries {
            do {
                return try await performRequest(
                    endpoint: endpoint,
                    method: method,
                    body: body,
                    queryItems: queryItems,
                    requiresAuth: requiresAuth
                )
            } catch let error as APIError {
                lastError = error
                
                // Don't retry certain errors
                switch error {
                case .authenticationRequired, .authorizationFailed, .validationError, .tokenExpired, .tokenAlreadySpent:
                    throw error
                default:
                    if attempt < maxRetries - 1 {
                        let delay = pow(2.0, Double(attempt)) // Exponential backoff
                        try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                    }
                }
            } catch {
                lastError = error
                if attempt < maxRetries - 1 {
                    let delay = pow(2.0, Double(attempt))
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                }
            }
        }
        
        throw lastError ?? APIError.networkError
    }
}
```

## 📊 Performance Monitoring

### iOS Performance Metrics

```swift
class PerformanceMonitor {
    static let shared = PerformanceMonitor()
    
    private var requestMetrics: [String: [TimeInterval]] = [:]
    
    func recordRequest(endpoint: String, duration: TimeInterval) {
        if requestMetrics[endpoint] == nil {
            requestMetrics[endpoint] = []
        }
        requestMetrics[endpoint]?.append(duration)
        
        // Keep only last 100 requests per endpoint
        if requestMetrics[endpoint]!.count > 100 {
            requestMetrics[endpoint]?.removeFirst()
        }
    }
    
    func getAverageResponseTime(for endpoint: String) -> TimeInterval? {
        guard let metrics = requestMetrics[endpoint], !metrics.isEmpty else {
            return nil
        }
        return metrics.reduce(0, +) / Double(metrics.count)
    }
    
    func getSlowRequests(threshold: TimeInterval = 2.0) -> [String: TimeInterval] {
        var slowEndpoints: [String: TimeInterval] = [:]
        
        for (endpoint, metrics) in requestMetrics {
            if let average = getAverageResponseTime(for: endpoint), average > threshold {
                slowEndpoints[endpoint] = average
            }
        }
        
        return slowEndpoints
    }
}

// Usage in NetworkService
extension NetworkService {
    private func performRequest<T: Codable>(
        endpoint: String,
        method: HTTPMethod,
        body: Encodable? = nil,
        queryItems: [URLQueryItem]? = nil,
        requiresAuth: Bool = true
    ) async throws -> T {
        let startTime = CFAbsoluteTimeGetCurrent()
        
        defer {
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            PerformanceMonitor.shared.recordRequest(endpoint: endpoint, duration: duration)
        }
        
        // ... existing request logic
    }
}
```

## 🧪 Testing Integration

### Unit Tests for New Methods

```swift
import XCTest
@testable import OfflineBlockchainWallet

class NetworkServiceIntegrationTests: XCTestCase {
    var networkService: NetworkService!
    var mockSession: MockURLSession!
    
    override func setUp() {
        super.setUp()
        mockSession = MockURLSession()
        networkService = NetworkService(session: mockSession)
    }
    
    func testTokenValidation() async throws {
        // Mock successful token validation response
        let mockResponse = TokenValidationResponse(
            valid: true,
            token: ValidatedToken(
                id: "test-token-id",
                amount: 25.0,
                ownerId: "test-user-id",
                signature: "test-signature",
                isSpent: false,
                expiresAt: Date().addingTimeInterval(86400),
                createdAt: Date()
            ),
            validationDetails: TokenValidationDetails(
                signatureValid: true,
                notExpired: true,
                notSpent: true,
                ownershipValid: true
            )
        )
        
        mockSession.mockResponse(mockResponse, for: "/tokens/validate")
        
        let result = try await networkService.validateToken(
            tokenId: "test-token-id",
            signature: "test-signature",
            amount: 25.0
        )
        
        XCTAssertTrue(result.valid)
        XCTAssertEqual(result.token.id, "test-token-id")
        XCTAssertTrue(result.validationDetails.signatureValid)
    }
    
    func testTransactionSync() async throws {
        let mockResponse = TransactionSyncResponse(
            transactions: [
                Transaction(
                    id: "test-tx-id",
                    type: .offlineTransfer,
                    senderId: "sender-id",
                    receiverId: "receiver-id",
                    amount: 15.0,
                    status: .completed,
                    blockchainTxHash: "0xabc123",
                    timestamp: Date(),
                    completedAt: Date()
                )
            ],
            lastSyncTimestamp: Date(),
            totalCount: 1,
            hasMore: false
        )
        
        mockSession.mockResponse(mockResponse, for: "/transactions/sync")
        
        let result = try await networkService.syncTransactions()
        
        XCTAssertEqual(result.transactions.count, 1)
        XCTAssertEqual(result.transactions.first?.id, "test-tx-id")
        XCTAssertFalse(result.hasMore)
    }
    
    func testSecurityStatusRetrieval() async throws {
        let mockResponse = MobileSecurityStatusResponse(
            overallStatus: .healthy,
            securityScore: 85,
            alerts: [],
            recommendations: [
                SecurityRecommendation(
                    id: "rec-1",
                    priority: .medium,
                    title: "Enable biometric authentication",
                    description: "Use Face ID for enhanced security"
                )
            ],
            lastSecurityScan: Date()
        )
        
        mockSession.mockResponse(mockResponse, for: "/security/mobile/status")
        
        let result = try await networkService.getMobileSecurityStatus()
        
        XCTAssertEqual(result.overallStatus, .healthy)
        XCTAssertEqual(result.securityScore, 85)
        XCTAssertEqual(result.recommendations.count, 1)
    }
}
```

## 🚀 Migration Guide

### Updating Existing iOS Code

1. **Update NetworkService calls:**
   ```swift
   // Old way
   let balance = try await networkService.getWalletBalance()
   
   // New way - now includes walletId and enhanced structure
   let balance = try await networkService.getWalletBalance()
   // Access new fields: balance.walletId, balance.balances.pending, etc.
   ```

2. **Handle new error types:**
   ```swift
   do {
       let result = try await networkService.validateToken(...)
   } catch APIError.tokenExpired {
       // Handle expired token
       showTokenExpiredAlert()
   } catch APIError.doubleSpendingDetected {
       // Handle double spending
       showDoubleSpendingAlert()
   }
   ```

3. **Implement new security features:**
   ```swift
   // Add security monitoring to your app
   Task {
       let securityStatus = try await networkService.getMobileSecurityStatus()
       updateSecurityUI(with: securityStatus)
   }
   ```

## 📋 Best Practices

1. **Always handle authentication token refresh:**
   ```swift
   private func handleAuthenticationError() async {
       do {
           try await authService.refreshToken()
           // Retry the original request
       } catch {
           // Redirect to login
           await MainActor.run {
               showLoginScreen()
           }
       }
   }
   ```

2. **Implement proper offline queue management:**
   ```swift
   class OfflineTransactionQueue {
       func addTransaction(_ transaction: OfflineTransaction) {
           // Store locally
           persistTransaction(transaction)
       }
       
       func syncWhenOnline() async {
           let pendingTransactions = loadPendingTransactions()
           if !pendingTransactions.isEmpty {
               try await networkService.syncOfflineTransactions(transactions: pendingTransactions)
               clearPendingTransactions()
           }
       }
   }
   ```

3. **Monitor performance and report issues:**
   ```swift
   // Report slow API responses
   if let averageTime = PerformanceMonitor.shared.getAverageResponseTime(for: endpoint),
      averageTime > 2.0 {
       await networkService.reportSecurityEvent(
           eventType: .performanceIssue,
           severity: .medium,
           description: "Slow API response detected",
           metadata: ["endpoint": endpoint, "averageTime": averageTime]
       )
   }
   ```

## 🔍 Troubleshooting

### Common Issues and Solutions

1. **Token validation failures:**
   - Ensure token signatures are properly generated
   - Check token expiration dates
   - Verify token hasn't been spent already

2. **Transaction sync issues:**
   - Check network connectivity
   - Verify authentication tokens are valid
   - Ensure proper timestamp formatting

3. **Security event reporting failures:**
   - Validate event type and severity values
   - Check metadata format
   - Ensure proper authentication

4. **Performance issues:**
   - Implement request caching where appropriate
   - Use pagination for large data sets
   - Monitor and report slow endpoints

---

*This integration guide is updated with each API release. For the latest information, refer to the API documentation and changelog.*