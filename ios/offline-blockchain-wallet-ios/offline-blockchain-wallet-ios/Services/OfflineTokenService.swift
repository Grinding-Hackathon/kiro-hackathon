//
//  OfflineTokenService.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation
import Combine

protocol OfflineTokenServiceProtocol {
    func purchaseTokens(amount: Double) async throws -> [OfflineToken]
    func validateToken(_ token: OfflineToken) -> Bool
    func divideToken(_ token: OfflineToken, amount: Double) throws -> TokenDivisionResult
    func markTokenAsSpent(tokenId: String) async throws
    func getAvailableBalance() async -> Double
    func handleExpiredTokens() async throws
    func redeemTokens(_ tokens: [OfflineToken]) async throws -> String
    func startAutomaticTokenManagement()
    func stopAutomaticTokenManagement()
}

class OfflineTokenService: OfflineTokenServiceProtocol {
    private let cryptographyService: CryptographyServiceProtocol
    private let networkService: NetworkServiceProtocol
    private let storageService: StorageServiceProtocol
    private let logger = Logger.shared
    
    private var automaticManagementTimer: Timer?
    internal var otmPublicKey: String?
    
    init(cryptographyService: CryptographyServiceProtocol,
         networkService: NetworkServiceProtocol,
         storageService: StorageServiceProtocol) {
        self.cryptographyService = cryptographyService
        self.networkService = networkService
        self.storageService = storageService
        
        // Start automatic token management
        startAutomaticTokenManagement()
        
        // Load OTM public key
        Task {
            await loadOTMPublicKey()
        }
    }
    
    deinit {
        stopAutomaticTokenManagement()
    }
    
    // MARK: - Token Purchase
    
    func purchaseTokens(amount: Double) async throws -> [OfflineToken] {
        logger.info("Purchasing tokens for amount: \(amount)")
        
        guard amount >= Constants.Token.minTokenAmount && amount <= Constants.Token.maxTokenAmount else {
            throw OfflineTokenError.invalidAmount
        }
        
        do {
            // Create purchase request
            let purchaseRequest = TokenPurchaseRequest(
                amount: amount,
                walletId: try await getWalletId(),
                timestamp: Date()
            )
            
            // Send request to backend API
            let response = try await sendTokenPurchaseRequest(purchaseRequest)
            
            // Validate received tokens
            let validTokens = response.tokens.filter { validateToken($0) }
            
            if validTokens.count != response.tokens.count {
                logger.warning("Some tokens failed validation during purchase")
            }
            
            // Store tokens locally
            try await storageService.saveOfflineTokens(validTokens)
            
            // Update wallet state
            try await updateOfflineBalance()
            
            // Create transaction record
            let transaction = Transaction(
                type: .tokenPurchase,
                senderId: "otm",
                receiverId: try await getWalletId(),
                amount: amount,
                status: .completed,
                tokenIds: validTokens.map { $0.id }
            )
            try await storageService.saveTransaction(transaction)
            
            logger.info("Successfully purchased \(validTokens.count) tokens")
            return validTokens
            
        } catch {
            logger.error("Failed to purchase tokens: \(error)")
            throw OfflineTokenError.purchaseFailed(error)
        }
    }
    
    // MARK: - Token Validation
    
    func validateToken(_ token: OfflineToken) -> Bool {
        // Check if token is expired
        if token.isExpired {
            logger.debug("Token \(token.id) is expired")
            return false
        }
        
        // Check if token is already spent
        if token.isSpent {
            logger.debug("Token \(token.id) is already spent")
            return false
        }
        
        // Validate token signature using OTM public key
        guard let otmPublicKey = otmPublicKey else {
            logger.error("OTM public key not available for validation")
            return false
        }
        
        do {
            let tokenData = createTokenDataForSigning(token)
            let isValid = try cryptographyService.verifySignature(
                token.signature,
                for: tokenData,
                with: otmPublicKey
            )
            
            if !isValid {
                logger.warning("Token \(token.id) has invalid signature")
            }
            
            return isValid
        } catch {
            logger.error("Failed to validate token signature: \(error)")
            return false
        }
    }
    
    // MARK: - Token Division
    
    func divideToken(_ token: OfflineToken, amount: Double) throws -> TokenDivisionResult {
        logger.info("Dividing token \(token.id) for amount: \(amount)")
        
        // Validate token
        guard validateToken(token) else {
            throw OfflineTokenError.invalidToken
        }
        
        // Check if token has sufficient amount
        guard token.amount >= amount else {
            throw OfflineTokenError.insufficientBalance
        }
        
        // Check minimum amount
        guard amount >= Constants.Token.minTokenAmount else {
            throw OfflineTokenError.invalidAmount
        }
        
        let changeAmount = token.amount - amount
        
        // Create payment token
        let paymentToken = OfflineToken(
            amount: amount,
            signature: try createDivisionSignature(originalToken: token, amount: amount),
            issuer: token.issuer,
            issuedAt: token.issuedAt,
            expirationDate: token.expirationDate
        )
        
        // Create change token if there's remaining amount
        var changeToken: OfflineToken?
        if changeAmount > 0 {
            changeToken = OfflineToken(
                amount: changeAmount,
                signature: try createDivisionSignature(originalToken: token, amount: changeAmount),
                issuer: token.issuer,
                issuedAt: token.issuedAt,
                expirationDate: token.expirationDate
            )
        }
        
        // Record division in original token
        var updatedOriginalToken = token
        let division = TokenDivision(
            amount: amount,
            signature: paymentToken.signature
        )
        updatedOriginalToken.divisions.append(division)
        
        let result = TokenDivisionResult(
            originalToken: updatedOriginalToken,
            paymentToken: paymentToken,
            changeToken: changeToken,
            requestedAmount: amount
        )
        
        logger.info("Successfully divided token into payment: \(amount), change: \(changeAmount)")
        return result
    }
    
    // MARK: - Token Management
    
    func markTokenAsSpent(tokenId: String) async throws {
        logger.info("Marking token as spent: \(tokenId)")
        
        try await storageService.markTokenAsSpent(id: tokenId, spentAt: Date())
        try await updateOfflineBalance()
        
        logger.info("Successfully marked token as spent: \(tokenId)")
    }
    
    func getAvailableBalance() async -> Double {
        do {
            return try await storageService.getTotalOfflineBalance()
        } catch {
            logger.error("Failed to get available balance: \(error)")
            return 0.0
        }
    }
    
    // MARK: - Expired Token Handling
    
    func handleExpiredTokens() async throws {
        logger.info("Handling expired tokens")
        
        let expiredTokenIds = try await storageService.deleteExpiredTokens()
        
        if !expiredTokenIds.isEmpty {
            logger.info("Removed \(expiredTokenIds.count) expired tokens")
            
            // Update balance after removing expired tokens
            try await updateOfflineBalance()
            
            // If auto-recharge is enabled, check if we need to purchase new tokens
            let walletState = try await storageService.loadWalletState()
            if let state = walletState, state.autoRechargeEnabled {
                let currentBalance = await getAvailableBalance()
                if currentBalance < state.autoRechargeThreshold {
                    logger.info("Balance below threshold, triggering auto-recharge")
                    try await purchaseTokens(amount: state.autoRechargeAmount)
                }
            }
        }
    }
    
    // MARK: - Token Redemption
    
    func redeemTokens(_ tokens: [OfflineToken]) async throws -> String {
        logger.info("Redeeming \(tokens.count) tokens")
        
        // Validate all tokens before redemption
        let validTokens = tokens.filter { validateToken($0) }
        
        guard !validTokens.isEmpty else {
            throw OfflineTokenError.noValidTokens
        }
        
        if validTokens.count != tokens.count {
            logger.warning("Some tokens failed validation during redemption")
        }
        
        do {
            // Create redemption request
            let redemptionRequest = TokenRedemptionRequest(
                tokens: validTokens,
                walletId: try await getWalletId(),
                timestamp: Date()
            )
            
            // Send redemption request to backend
            let response = try await sendTokenRedemptionRequest(redemptionRequest)
            
            // Mark tokens as spent locally
            for token in validTokens {
                try await markTokenAsSpent(tokenId: token.id)
            }
            
            // Create transaction record
            let transaction = Transaction(
                type: .tokenRedemption,
                senderId: try await getWalletId(),
                receiverId: "blockchain",
                amount: validTokens.reduce(0) { $0 + $1.amount },
                status: .completed,
                tokenIds: validTokens.map { $0.id }
            )
            try await storageService.saveTransaction(transaction)
            
            logger.info("Successfully redeemed tokens, transaction hash: \(response.transactionHash)")
            return response.transactionHash
            
        } catch {
            logger.error("Failed to redeem tokens: \(error)")
            throw OfflineTokenError.redemptionFailed(error)
        }
    }
    
    // MARK: - Automatic Token Management
    
    func startAutomaticTokenManagement() {
        logger.info("Starting automatic token management")
        
        automaticManagementTimer = Timer.scheduledTimer(withTimeInterval: 300, repeats: true) { [weak self] _ in
            Task {
                await self?.performAutomaticManagement()
            }
        }
    }
    
    func stopAutomaticTokenManagement() {
        logger.info("Stopping automatic token management")
        
        automaticManagementTimer?.invalidate()
        automaticManagementTimer = nil
    }
    
    // MARK: - Private Methods
    
    private func performAutomaticManagement() async {
        do {
            // Handle expired tokens
            try await handleExpiredTokens()
            
            // Check if auto-recharge is needed
            guard let walletState = try await storageService.loadWalletState(),
                  walletState.autoRechargeEnabled else {
                return
            }
            
            let currentBalance = await getAvailableBalance()
            if currentBalance < walletState.autoRechargeThreshold {
                logger.info("Auto-recharge triggered: balance \(currentBalance) < threshold \(walletState.autoRechargeThreshold)")
                try await purchaseTokens(amount: walletState.autoRechargeAmount)
            }
            
        } catch {
            logger.error("Automatic token management failed: \(error)")
        }
    }
    
    private func loadOTMPublicKey() async {
        do {
            let publicKeyDatabase = try await networkService.fetchPublicKeys()
            otmPublicKey = publicKeyDatabase.keys["otm"]
            logger.info("Loaded OTM public key successfully")
        } catch {
            logger.error("Failed to load OTM public key: \(error)")
        }
    }
    
    private func getWalletId() async throws -> String {
        guard let walletState = try await storageService.loadWalletState() else {
            throw OfflineTokenError.walletNotInitialized
        }
        return walletState.walletId
    }
    
    private func updateOfflineBalance() async throws {
        let newBalance = try await storageService.getTotalOfflineBalance()
        
        guard var walletState = try await storageService.loadWalletState() else {
            throw OfflineTokenError.walletNotInitialized
        }
        
        let updatedState = WalletState(
            walletId: walletState.walletId,
            publicKey: walletState.publicKey,
            offlineBalance: newBalance,
            blockchainBalance: walletState.blockchainBalance,
            lastSyncTimestamp: walletState.lastSyncTimestamp,
            autoRechargeEnabled: walletState.autoRechargeEnabled,
            autoRechargeThreshold: walletState.autoRechargeThreshold,
            autoRechargeAmount: walletState.autoRechargeAmount
        )
        
        try await storageService.saveWalletState(updatedState)
    }
    
    private func createTokenDataForSigning(_ token: OfflineToken) -> Data {
        let tokenString = "\(token.id)|\(token.amount)|\(token.issuer)|\(token.issuedAt.timeIntervalSince1970)|\(token.expirationDate.timeIntervalSince1970)"
        return tokenString.data(using: .utf8) ?? Data()
    }
    
    private func createDivisionSignature(originalToken: OfflineToken, amount: Double) throws -> String {
        // For token division, we create a new signature based on the division
        // This would typically involve the user's private key to authorize the division
        let divisionData = "\(originalToken.id)|\(amount)|\(Date().timeIntervalSince1970)"
        guard let data = divisionData.data(using: .utf8) else {
            throw OfflineTokenError.invalidData
        }
        
        // Get user's private key for signing
        guard let privateKey = try cryptographyService.retrievePrivateKey(for: "user_signing_key") else {
            throw OfflineTokenError.privateKeyNotFound
        }
        
        return try cryptographyService.signData(data, with: privateKey)
    }
    
    private func sendTokenPurchaseRequest(_ request: TokenPurchaseRequest) async throws -> TokenPurchaseResponse {
        return try await networkService.purchaseOfflineTokens(request: request)
    }
    
    private func sendTokenRedemptionRequest(_ request: TokenRedemptionRequest) async throws -> TokenRedemptionResponse {
        return try await networkService.redeemOfflineTokens(request: request)
    }
}

// MARK: - Supporting Types

enum OfflineTokenError: Error, LocalizedError {
    case invalidToken
    case insufficientBalance
    case tokenExpired
    case networkError
    case invalidAmount
    case purchaseFailed(Error)
    case redemptionFailed(Error)
    case noValidTokens
    case walletNotInitialized
    case privateKeyNotFound
    case invalidData
    case networkNotImplemented
    
    var errorDescription: String? {
        switch self {
        case .invalidToken:
            return "Invalid token"
        case .insufficientBalance:
            return "Insufficient token balance"
        case .tokenExpired:
            return "Token has expired"
        case .networkError:
            return "Network connection error"
        case .invalidAmount:
            return "Invalid token amount"
        case .purchaseFailed(let error):
            return "Token purchase failed: \(error.localizedDescription)"
        case .redemptionFailed(let error):
            return "Token redemption failed: \(error.localizedDescription)"
        case .noValidTokens:
            return "No valid tokens available"
        case .walletNotInitialized:
            return "Wallet not initialized"
        case .privateKeyNotFound:
            return "Private key not found"
        case .invalidData:
            return "Invalid data format"
        case .networkNotImplemented:
            return "Network functionality not yet implemented"
        }
    }
}