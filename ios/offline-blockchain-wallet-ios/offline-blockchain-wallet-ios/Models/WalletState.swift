//
//  WalletState.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation

struct WalletState: Codable {
    let walletId: String
    let publicKey: String
    var offlineBalance: Double
    var blockchainBalance: Double
    var lastSyncTimestamp: Date?
    var autoRechargeEnabled: Bool
    var autoRechargeThreshold: Double
    var autoRechargeAmount: Double
    var lastKnownOfflineBalance: Double?
    
    init(walletId: String,
         publicKey: String,
         offlineBalance: Double = 0.0,
         blockchainBalance: Double = 0.0,
         lastSyncTimestamp: Date? = nil,
         autoRechargeEnabled: Bool = true,
         autoRechargeThreshold: Double = Constants.Token.autoRechargeThreshold,
         autoRechargeAmount: Double = Constants.Token.autoRechargeAmount,
         lastKnownOfflineBalance: Double? = nil) {
        self.walletId = walletId
        self.publicKey = publicKey
        self.offlineBalance = offlineBalance
        self.blockchainBalance = blockchainBalance
        self.lastSyncTimestamp = lastSyncTimestamp
        self.autoRechargeEnabled = autoRechargeEnabled
        self.autoRechargeThreshold = autoRechargeThreshold
        self.autoRechargeAmount = autoRechargeAmount
        self.lastKnownOfflineBalance = lastKnownOfflineBalance
    }
}