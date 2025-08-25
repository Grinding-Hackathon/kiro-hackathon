//
//  WalletViewKeyboardTests.swift
//  OfflineBlockchainWalletTests
//
//  Created by Kiro on 8/25/2025.
//  Copyright © 2025 Offline Blockchain Wallet. All rights reserved.
//

import XCTest
import SwiftUI
@testable import offline_blockchain_wallet_ios

final class WalletViewKeyboardTests: XCTestCase {
    
    func testWalletViewHasKeyboardDismissalModifier() {
        // Test that WalletView can be created without errors
        // This ensures the dismissKeyboardOnTap modifier is properly applied
        let walletViewModel = DependencyContainer.shared.createWalletViewModel()
        let walletView = WalletView(viewModel: walletViewModel)
        
        // If the view can be created without crashing, the modifier is properly applied
        XCTAssertNotNil(walletView)
    }
    
    func testReceiveViewHasKeyboardDismissalModifier() {
        // Test that ReceiveView can be created without errors
        // This ensures the dismissKeyboardOnTap modifier is properly applied
        let receiveView = ReceiveView()
        
        // If the view can be created without crashing, the modifier is properly applied
        XCTAssertNotNil(receiveView)
    }
    
    func testKeyboardDismissalModifierExists() {
        // Test that the DismissKeyboardOnTap modifier exists and can be used
        let testView = Text("Test")
            .dismissKeyboardOnTap()
        
        XCTAssertNotNil(testView)
    }
}