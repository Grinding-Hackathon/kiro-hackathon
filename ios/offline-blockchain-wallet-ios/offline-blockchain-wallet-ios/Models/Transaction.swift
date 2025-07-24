//
//  Transaction.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation

struct Transaction: Codable, Identifiable {
    let id: String
    let type: TransactionType
    let senderId: String
    let receiverId: String
    let amount: Double
    let timestamp: Date
    var status: TransactionStatus
    let tokenIds: [String]
    var senderSignature: String?
    var receiverSignature: String?
    var metadata: TransactionMetadata?
    
    init(id: String = UUID().uuidString,
         type: TransactionType,
         senderId: String,
         receiverId: String,
         amount: Double,
         timestamp: Date = Date(),
         status: TransactionStatus = .pending,
         tokenIds: [String],
         senderSignature: String? = nil,
         receiverSignature: String? = nil,
         metadata: TransactionMetadata? = nil) {
        self.id = id
        self.type = type
        self.senderId = senderId
        self.receiverId = receiverId
        self.amount = amount
        self.timestamp = timestamp
        self.status = status
        self.tokenIds = tokenIds
        self.senderSignature = senderSignature
        self.receiverSignature = receiverSignature
        self.metadata = metadata
    }
}

enum TransactionType: String, Codable, CaseIterable {
    case offlineTransfer = "offline_transfer"
    case onlineTransfer = "online_transfer"
    case tokenPurchase = "token_purchase"
    case tokenRedemption = "token_redemption"
}

enum TransactionStatus: String, Codable, CaseIterable {
    case pending = "pending"
    case completed = "completed"
    case failed = "failed"
    case cancelled = "cancelled"
}

struct TransactionMetadata: Codable {
    let connectionType: String?
    let deviceInfo: String?
    let bluetoothDeviceId: String?
    let errorMessage: String?
    
    init(connectionType: String? = nil,
         deviceInfo: String? = nil,
         bluetoothDeviceId: String? = nil,
         errorMessage: String? = nil) {
        self.connectionType = connectionType
        self.deviceInfo = deviceInfo
        self.bluetoothDeviceId = bluetoothDeviceId
        self.errorMessage = errorMessage
    }
}