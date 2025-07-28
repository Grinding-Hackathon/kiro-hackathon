//
//  OfflineToken.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation

struct OfflineToken: Codable, Identifiable {
    let id: String
    let amount: Double
    let signature: String
    let issuer: String
    let issuedAt: Date
    let expirationDate: Date
    var isSpent: Bool
    var spentAt: Date?
    var divisions: [TokenDivision]
    
    init(id: String = UUID().uuidString, 
         amount: Double, 
         signature: String, 
         issuer: String, 
         issuedAt: Date = Date(), 
         expirationDate: Date,
         isSpent: Bool = false,
         spentAt: Date? = nil,
         divisions: [TokenDivision] = []) {
        self.id = id
        self.amount = amount
        self.signature = signature
        self.issuer = issuer
        self.issuedAt = issuedAt
        self.expirationDate = expirationDate
        self.isSpent = isSpent
        self.spentAt = spentAt
        self.divisions = divisions
    }
    
    var isExpired: Bool {
        return Date() > expirationDate
    }
    
    var isValid: Bool {
        return !isExpired && !isSpent
    }
}

// TokenDivision is now defined in TokenDivision.swift to avoid duplication