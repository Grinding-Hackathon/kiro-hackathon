# API Troubleshooting Guide

## 🎯 Overview

This guide provides solutions to common issues encountered when integrating with the Offline Blockchain Wallet API. It covers authentication problems, transaction failures, token validation issues, and performance optimization.

## 🔐 Authentication Issues

### Issue: "Authentication Required" Error

**Symptoms:**
- HTTP 401 responses
- Error code: `AUTHENTICATION_REQUIRED`
- Unable to access protected endpoints

**Common Causes:**
1. Missing Authorization header
2. Invalid JWT token format
3. Expired access token
4. Malformed Bearer token

**Solutions:**

```javascript
// ✅ Correct Authorization header format
const headers = {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
};

// ❌ Common mistakes
const wrongHeaders = {
  'Authorization': accessToken,           // Missing "Bearer "
  'Authorization': `Token ${accessToken}`, // Wrong prefix
  'Auth': `Bearer ${accessToken}`         // Wrong header name
};
```

**iOS Swift Example:**
```swift
// Proper token handling
private func addAuthHeaders(to request: inout URLRequest) {
    if let token = authService.currentAccessToken {
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
}
```

### Issue: Token Refresh Failures

**Symptoms:**
- Refresh token endpoint returns 401
- Unable to obtain new access tokens
- Forced logout loops

**Solutions:**

1. **Check refresh token validity:**
```javascript
// Verify refresh token hasn't expired
const refreshTokenPayload = jwt.decode(refreshToken);
const now = Date.now() / 1000;
if (refreshTokenPayload.exp < now) {
  // Refresh token expired, redirect to login
  redirectToLogin();
}
```

2. **Implement proper refresh flow:**
```swift
func refreshTokenIfNeeded() async throws {
    guard let refreshToken = keychain.refreshToken else {
        throw AuthError.noRefreshToken
    }
    
    do {
        let response = try await networkService.refreshToken(refreshToken: refreshToken)
        keychain.accessToken = response.accessToken
        keychain.refreshToken = response.refreshToken // If rotation enabled
    } catch APIError.authenticationRequired {
        // Refresh token invalid, clear tokens and redirect to login
        keychain.clearTokens()
        await MainActor.run { showLoginScreen() }
    }
}
```

## 💰 Token Validation Issues

### Issue: "Token Already Spent" Error

**Symptoms:**
- Error code: `TOKEN_ALREADY_SPENT`
- Token validation fails
- Unable to use previously valid tokens

**Debugging Steps:**

1. **Check token status in database:**
```sql
SELECT id, amount, is_spent, spent_at, owner_id 
FROM offline_tokens 
WHERE id = 'your-token-id';
```

2. **Verify token usage history:**
```sql
SELECT t.id, t.type, t.amount, t.status, t.created_at
FROM transactions t
JOIN transaction_tokens tt ON t.id = tt.transaction_id
WHERE tt.token_id = 'your-token-id'
ORDER BY t.created_at DESC;
```

**Solutions:**

```swift
// Handle spent token error gracefully
do {
    let validation = try await networkService.validateToken(
        tokenId: token.id,
        signature: token.signature,
        amount: token.amount
    )
} catch APIError.tokenAlreadySpent {
    // Remove token from local storage
    tokenStorage.removeToken(token.id)
    
    // Sync with server to get latest token state
    try await syncTokensWithServer()
    
    // Show user-friendly message
    showAlert("Token has been used in another transaction")
}
```

### Issue: "Invalid Signature" Error

**Symptoms:**
- Error code: `INVALID_SIGNATURE`
- Token validation fails despite correct token data
- Cryptographic verification errors

**Common Causes:**
1. Incorrect signature generation
2. Wrong private key used
3. Message format mismatch
4. Encoding issues

**Solutions:**

1. **Verify signature generation:**
```swift
// Correct signature generation
func generateTokenSignature(tokenData: TokenData, privateKey: String) -> String {
    let message = "\(tokenData.id):\(tokenData.amount):\(tokenData.ownerId):\(tokenData.expiresAt.timeIntervalSince1970)"
    let messageData = message.data(using: .utf8)!
    let signature = try! CryptographyService.sign(data: messageData, privateKey: privateKey)
    return signature.hexString
}
```

2. **Debug signature verification:**
```javascript
// Server-side debugging
const message = `${tokenId}:${amount}:${ownerId}:${expirationTimestamp}`;
const isValid = crypto.verify('sha256', Buffer.from(message), publicKey, signature);
console.log('Signature verification:', { message, isValid, signature });
```

## 🔄 Transaction Issues

### Issue: Transaction Sync Failures

**Symptoms:**
- Transactions not appearing after sync
- Sync endpoint returns empty results
- Offline transactions not processed

**Debugging Steps:**

1. **Check sync timestamp format:**
```swift
// ✅ Correct ISO 8601 format
let formatter = ISO8601DateFormatter()
formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
let timestamp = formatter.string(from: lastSyncDate)

// ❌ Wrong format
let wrongTimestamp = "\(lastSyncDate.timeIntervalSince1970)" // Unix timestamp
```

2. **Verify transaction data:**
```javascript
// Check transaction exists in database
const transaction = await db.query(
  'SELECT * FROM transactions WHERE user_id = ? AND created_at > ?',
  [userId, lastSyncTimestamp]
);
```

**Solutions:**

```swift
// Robust sync implementation
func syncTransactions() async throws -> [Transaction] {
    let lastSync = userDefaults.lastSyncTimestamp ?? Date.distantPast
    
    do {
        let response = try await networkService.syncTransactions(
            lastSyncTimestamp: lastSync,
            limit: 50
        )
        
        // Update local storage
        for transaction in response.transactions {
            try localDatabase.upsertTransaction(transaction)
        }
        
        // Update sync timestamp
        userDefaults.lastSyncTimestamp = response.lastSyncTimestamp
        
        return response.transactions
    } catch {
        // Log error for debugging
        logger.error("Transaction sync failed: \(error)")
        throw error
    }
}
```

### Issue: "Double Spending Detected" Error

**Symptoms:**
- Error code: `DOUBLE_SPENDING_DETECTED`
- Transaction submission fails
- Same token used in multiple transactions

**Prevention:**

```swift
class TokenManager {
    private var pendingTokens: Set<String> = []
    private let queue = DispatchQueue(label: "token-manager", attributes: .concurrent)
    
    func reserveToken(_ tokenId: String) -> Bool {
        return queue.sync(flags: .barrier) {
            if pendingTokens.contains(tokenId) {
                return false // Token already reserved
            }
            pendingTokens.insert(tokenId)
            return true
        }
    }
    
    func releaseToken(_ tokenId: String) {
        queue.async(flags: .barrier) {
            self.pendingTokens.remove(tokenId)
        }
    }
}

// Usage in transaction flow
func submitTransaction(using tokenId: String) async throws {
    guard tokenManager.reserveToken(tokenId) else {
        throw TransactionError.tokenAlreadyInUse
    }
    
    defer {
        tokenManager.releaseToken(tokenId)
    }
    
    try await networkService.submitTransaction(tokenIds: [tokenId])
}
```

## 🌐 Network and Connectivity Issues

### Issue: Request Timeouts

**Symptoms:**
- Requests taking longer than expected
- Timeout errors in mobile apps
- Intermittent connection failures

**Solutions:**

1. **Implement proper timeout handling:**
```swift
extension NetworkService {
    private func createURLRequest(for endpoint: String) -> URLRequest {
        var request = URLRequest(url: URL(string: baseURL + endpoint)!)
        request.timeoutInterval = 30.0 // 30 seconds
        request.cachePolicy = .reloadIgnoringLocalCacheData
        return request
    }
}
```

2. **Add retry logic with exponential backoff:**
```swift
func performRequestWithRetry<T: Codable>(
    endpoint: String,
    maxRetries: Int = 3
) async throws -> T {
    var lastError: Error?
    
    for attempt in 0..<maxRetries {
        do {
            return try await performRequest(endpoint: endpoint)
        } catch {
            lastError = error
            
            if attempt < maxRetries - 1 {
                let delay = min(pow(2.0, Double(attempt)), 10.0) // Max 10 seconds
                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            }
        }
    }
    
    throw lastError ?? NetworkError.maxRetriesExceeded
}
```

### Issue: SSL/TLS Certificate Errors

**Symptoms:**
- Certificate validation failures
- SSL handshake errors
- "Untrusted certificate" warnings

**Solutions:**

1. **For development environments:**
```swift
// ⚠️ Only for development - never use in production
class DevelopmentURLSessionDelegate: NSObject, URLSessionDelegate {
    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust {
            let credential = URLCredential(trust: challenge.protectionSpace.serverTrust!)
            completionHandler(.useCredential, credential)
        } else {
            completionHandler(.performDefaultHandling, nil)
        }
    }
}
```

2. **For production environments:**
```swift
// Proper certificate pinning
class SecureURLSessionDelegate: NSObject, URLSessionDelegate {
    private let pinnedCertificates: [Data]
    
    init(pinnedCertificates: [Data]) {
        self.pinnedCertificates = pinnedCertificates
    }
    
    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard let serverTrust = challenge.protectionSpace.serverTrust else {
            completionHandler(.performDefaultHandling, nil)
            return
        }
        
        // Verify certificate against pinned certificates
        if verifyCertificate(serverTrust: serverTrust) {
            let credential = URLCredential(trust: serverTrust)
            completionHandler(.useCredential, credential)
        } else {
            completionHandler(.rejectProtectionSpace, nil)
        }
    }
}
```

## 📊 Performance Issues

### Issue: Slow API Response Times

**Symptoms:**
- Requests taking longer than 2 seconds
- UI freezing during API calls
- Poor user experience

**Debugging:**

1. **Add performance monitoring:**
```swift
class APIPerformanceMonitor {
    static let shared = APIPerformanceMonitor()
    
    func measureRequest<T>(
        endpoint: String,
        operation: () async throws -> T
    ) async throws -> T {
        let startTime = CFAbsoluteTimeGetCurrent()
        
        defer {
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            if duration > 2.0 {
                logger.warning("Slow API request: \(endpoint) took \(duration)s")
            }
        }
        
        return try await operation()
    }
}
```

2. **Identify bottlenecks:**
```javascript
// Server-side performance logging
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  
  next();
});
```

**Solutions:**

1. **Implement request caching:**
```swift
class APICache {
    private let cache = NSCache<NSString, CachedResponse>()
    private let cacheQueue = DispatchQueue(label: "api-cache")
    
    func get<T: Codable>(key: String, type: T.Type) -> T? {
        return cacheQueue.sync {
            guard let cached = cache.object(forKey: key as NSString),
                  !cached.isExpired else {
                return nil
            }
            return try? JSONDecoder().decode(type, from: cached.data)
        }
    }
    
    func set<T: Codable>(_ value: T, forKey key: String, ttl: TimeInterval = 300) {
        cacheQueue.async {
            guard let data = try? JSONEncoder().encode(value) else { return }
            let cached = CachedResponse(data: data, expiresAt: Date().addingTimeInterval(ttl))
            self.cache.setObject(cached, forKey: key as NSString)
        }
    }
}
```

2. **Use pagination for large datasets:**
```swift
func loadTransactionHistory() async throws {
    var allTransactions: [Transaction] = []
    var currentPage = 1
    let pageSize = 20
    
    repeat {
        let response = try await networkService.getWalletHistory(
            page: currentPage,
            limit: pageSize
        )
        
        allTransactions.append(contentsOf: response.transactions)
        currentPage += 1
        
        // Update UI incrementally
        await MainActor.run {
            updateTransactionList(allTransactions)
        }
        
    } while response.pagination.currentPage < response.pagination.totalPages
}
```

## 🔍 Debugging Tools

### API Request Logging

```swift
class APILogger {
    static let shared = APILogger()
    
    func logRequest(_ request: URLRequest) {
        print("🚀 API Request:")
        print("URL: \(request.url?.absoluteString ?? "nil")")
        print("Method: \(request.httpMethod ?? "GET")")
        print("Headers: \(request.allHTTPHeaderFields ?? [:])")
        
        if let body = request.httpBody,
           let bodyString = String(data: body, encoding: .utf8) {
            print("Body: \(bodyString)")
        }
    }
    
    func logResponse(_ response: URLResponse?, data: Data?, error: Error?) {
        print("📥 API Response:")
        
        if let httpResponse = response as? HTTPURLResponse {
            print("Status: \(httpResponse.statusCode)")
            print("Headers: \(httpResponse.allHeaderFields)")
        }
        
        if let data = data,
           let responseString = String(data: data, encoding: .utf8) {
            print("Body: \(responseString)")
        }
        
        if let error = error {
            print("Error: \(error)")
        }
    }
}
```

### Health Check Endpoint Testing

```bash
#!/bin/bash
# health_check.sh - Test API health and connectivity

API_BASE_URL="https://api.wallet.com/api/v1"

echo "Testing API health..."

# Basic health check
curl -s "$API_BASE_URL/health" | jq '.'

# Detailed health check
curl -s "$API_BASE_URL/health/detailed" | jq '.'

# Test authentication endpoint
echo "Testing authentication..."
curl -s -X POST "$API_BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"invalid"}' | jq '.'

echo "Health check complete."
```

## 📋 Common Error Codes Reference

| Error Code | HTTP Status | Description | Solution |
|------------|-------------|-------------|----------|
| `AUTHENTICATION_REQUIRED` | 401 | Missing or invalid auth token | Refresh token or re-authenticate |
| `AUTHORIZATION_FAILED` | 403 | Insufficient permissions | Check user roles and permissions |
| `VALIDATION_ERROR` | 400 | Invalid input data | Validate request format and data |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource doesn't exist | Check resource ID and availability |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Implement rate limiting and retry logic |
| `TOKEN_EXPIRED` | 422 | Token has expired | Use fresh tokens or extend expiration |
| `TOKEN_ALREADY_SPENT` | 422 | Token already used | Sync token state and use valid tokens |
| `DOUBLE_SPENDING_DETECTED` | 422 | Same token used twice | Implement token reservation system |
| `INVALID_SIGNATURE` | 422 | Signature verification failed | Check signature generation and keys |
| `INSUFFICIENT_BALANCE` | 422 | Not enough funds | Check balance before transactions |
| `BLOCKCHAIN_ERROR` | 500 | Blockchain operation failed | Retry or check blockchain status |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error | Contact support with request ID |

## 🆘 Getting Help

### Support Channels

1. **API Documentation**: Check the latest API reference
2. **GitHub Issues**: Report bugs and feature requests
3. **Developer Forum**: Community support and discussions
4. **Support Email**: technical-support@offlinewallet.com

### Information to Include in Support Requests

1. **Request Details:**
   - Full request URL and method
   - Request headers and body
   - Response status and body
   - Request ID (if available)

2. **Environment Information:**
   - API version
   - Client platform (iOS version, device model)
   - Network conditions
   - Timestamp of the issue

3. **Steps to Reproduce:**
   - Detailed steps leading to the issue
   - Expected vs actual behavior
   - Frequency of occurrence

### Emergency Contacts

- **Critical Issues**: emergency@offlinewallet.com
- **Security Issues**: security@offlinewallet.com
- **On-call Support**: +1-555-WALLET-1 (24/7 for production issues)

---

*This troubleshooting guide is regularly updated based on common support requests and known issues. For the latest version, check the API documentation.*