//
//  TokenDivision.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation

// MARK: - Token Division Record
// Used to store division history in OfflineToken.divisions array
struct TokenDivision: Codable, Identifiable {
    let id: String
    let amount: Double
    let signature: String
    let createdAt: Date
    
    init(id: String = UUID().uuidString, amount: Double, signature: String, createdAt: Date = Date()) {
        self.id = id
        self.amount = amount
        self.signature = signature
        self.createdAt = createdAt
    }
}

// MARK: - Token Division Operation Result
// Used as return type for token division operations
struct TokenDivisionResult {
    let originalToken: OfflineToken
    let paymentToken: OfflineToken
    let changeToken: OfflineToken?
    let requestedAmount: Double
    let changeAmount: Double
    
    init(originalToken: OfflineToken, paymentToken: OfflineToken, changeToken: OfflineToken?, requestedAmount: Double) {
        self.originalToken = originalToken
        self.paymentToken = paymentToken
        self.changeToken = changeToken
        self.requestedAmount = requestedAmount
        self.changeAmount = changeToken?.amount ?? 0.0
    }
}