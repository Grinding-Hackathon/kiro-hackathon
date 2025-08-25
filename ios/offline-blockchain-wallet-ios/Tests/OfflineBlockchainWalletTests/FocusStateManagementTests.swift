//
//  FocusStateManagementTests.swift
//  OfflineBlockchainWalletTests
//
//  Created by Kiro on 8/25/2025.
//  Copyright © 2025 Offline Blockchain Wallet. All rights reserved.
//

import XCTest
import SwiftUI
@testable import offline_blockchain_wallet_ios

final class FocusStateManagementTests: XCTestCase {
    
    // MARK: - Focus Field Enumeration Tests
    
    func testTransactionFocusFieldProperties() {
        // Test that all focus fields have proper properties
        let recipientField = TransactionFocusField.recipient
        XCTAssertEqual(recipientField.title, "Recipient")
        XCTAssertEqual(recipientField.placeholder, "Enter recipient ID or scan QR")
        XCTAssertEqual(recipientField.keyboardType, .default)
        
        let amountField = TransactionFocusField.amount
        XCTAssertEqual(amountField.title, "Amount")
        XCTAssertEqual(amountField.placeholder, "0.00")
        XCTAssertEqual(amountField.keyboardType, .decimalPad)
        
        let descriptionField = TransactionFocusField.description
        XCTAssertEqual(descriptionField.title, "Description")
        XCTAssertEqual(descriptionField.placeholder, "Optional description")
        XCTAssertEqual(descriptionField.keyboardType, .default)
    }
    
    func testReceiveFocusFieldProperties() {
        let amountField = ReceiveFocusField.amount
        XCTAssertEqual(amountField.title, "Amount")
        XCTAssertEqual(amountField.placeholder, "0.00")
        XCTAssertEqual(amountField.keyboardType, .decimalPad)
        
        let descriptionField = ReceiveFocusField.description
        XCTAssertEqual(descriptionField.title, "Description")
        XCTAssertEqual(descriptionField.placeholder, "Optional description")
        XCTAssertEqual(descriptionField.keyboardType, .default)
    }
    
    func testSettingsFocusFieldProperties() {
        let walletNameField = SettingsFocusField.walletName
        XCTAssertEqual(walletNameField.title, "Wallet Name")
        XCTAssertEqual(walletNameField.placeholder, "My Wallet")
        XCTAssertEqual(walletNameField.keyboardType, .default)
        
        let thresholdField = SettingsFocusField.customThreshold
        XCTAssertEqual(thresholdField.title, "Custom Threshold")
        XCTAssertEqual(thresholdField.placeholder, "Enter threshold")
        XCTAssertEqual(thresholdField.keyboardType, .decimalPad)
        
        let amountField = SettingsFocusField.customAmount
        XCTAssertEqual(amountField.title, "Custom Amount")
        XCTAssertEqual(amountField.placeholder, "Enter amount")
        XCTAssertEqual(amountField.keyboardType, .decimalPad)
    }
    
    // MARK: - Focus Manager Tests
    
    func testMoveToNextField() {
        let fields: [TransactionFocusField] = [.recipient, .amount, .description]
        var focusState: TransactionFocusField? = .recipient
        
        // Test moving from first to second field
        FocusManager.moveToNext(from: focusState, in: fields, focusState: &focusState)
        XCTAssertEqual(focusState, .amount)
        
        // Test moving from second to third field
        FocusManager.moveToNext(from: focusState, in: fields, focusState: &focusState)
        XCTAssertEqual(focusState, .description)
        
        // Test moving from last field (should dismiss keyboard)
        FocusManager.moveToNext(from: focusState, in: fields, focusState: &focusState)
        XCTAssertNil(focusState)
    }
    
    func testMoveToNextFieldFromNil() {
        let fields: [TransactionFocusField] = [.recipient, .amount, .description]
        var focusState: TransactionFocusField? = nil
        
        // Test moving from nil (should focus first field)
        FocusManager.moveToNext(from: focusState, in: fields, focusState: &focusState)
        XCTAssertEqual(focusState, .recipient)
    }
    
    func testMoveToPreviousField() {
        let fields: [TransactionFocusField] = [.recipient, .amount, .description]
        var focusState: TransactionFocusField? = .description
        
        // Test moving from last to second field
        FocusManager.moveToPrevious(from: focusState, in: fields, focusState: &focusState)
        XCTAssertEqual(focusState, .amount)
        
        // Test moving from second to first field
        FocusManager.moveToPrevious(from: focusState, in: fields, focusState: &focusState)
        XCTAssertEqual(focusState, .recipient)
        
        // Test moving from first field (should stay at first)
        FocusManager.moveToPrevious(from: focusState, in: fields, focusState: &focusState)
        XCTAssertEqual(focusState, .recipient)
    }
    
    func testMoveToPreviousFieldFromNil() {
        let fields: [TransactionFocusField] = [.recipient, .amount, .description]
        var focusState: TransactionFocusField? = nil
        
        // Test moving from nil (should focus last field)
        FocusManager.moveToPrevious(from: focusState, in: fields, focusState: &focusState)
        XCTAssertEqual(focusState, .description)
    }
    
    func testValidateRequiredFields() {
        let fields: [TransactionFocusField] = [.recipient, .amount, .description]
        let requiredFields: Set<TransactionFocusField> = [.recipient, .amount]
        
        // Test with all required fields filled
        var values: [TransactionFocusField: String] = [
            .recipient: "test-recipient-id",
            .amount: "100.50",
            .description: ""
        ]
        
        var isValid = FocusManager.validateRequiredFields(
            fields: fields,
            values: values,
            requiredFields: requiredFields
        )
        XCTAssertTrue(isValid)
        
        // Test with missing required field
        values[.recipient] = ""
        isValid = FocusManager.validateRequiredFields(
            fields: fields,
            values: values,
            requiredFields: requiredFields
        )
        XCTAssertFalse(isValid)
        
        // Test with whitespace-only required field
        values[.recipient] = "   "
        isValid = FocusManager.validateRequiredFields(
            fields: fields,
            values: values,
            requiredFields: requiredFields
        )
        XCTAssertFalse(isValid)
        
        // Test with missing value for required field
        values.removeValue(forKey: .amount)
        isValid = FocusManager.validateRequiredFields(
            fields: fields,
            values: values,
            requiredFields: requiredFields
        )
        XCTAssertFalse(isValid)
    }
    
    // MARK: - Focus Field Sequence Tests
    
    func testTransactionFocusFieldSequence() {
        let fields = TransactionFocusField.allCases
        XCTAssertEqual(fields.count, 3)
        XCTAssertTrue(fields.contains(.recipient))
        XCTAssertTrue(fields.contains(.amount))
        XCTAssertTrue(fields.contains(.description))
    }
    
    func testReceiveFocusFieldSequence() {
        let fields = ReceiveFocusField.allCases
        XCTAssertEqual(fields.count, 2)
        XCTAssertTrue(fields.contains(.amount))
        XCTAssertTrue(fields.contains(.description))
    }
    
    func testSettingsFocusFieldSequence() {
        let fields = SettingsFocusField.allCases
        XCTAssertEqual(fields.count, 3)
        XCTAssertTrue(fields.contains(.walletName))
        XCTAssertTrue(fields.contains(.customThreshold))
        XCTAssertTrue(fields.contains(.customAmount))
    }
    
    // MARK: - Edge Cases
    
    func testEmptyFieldsArray() {
        let fields: [TransactionFocusField] = []
        var focusState: TransactionFocusField? = nil
        
        // Test moving next with empty fields
        FocusManager.moveToNext(from: focusState, in: fields, focusState: &focusState)
        XCTAssertNil(focusState)
        
        // Test moving previous with empty fields
        FocusManager.moveToPrevious(from: focusState, in: fields, focusState: &focusState)
        XCTAssertNil(focusState)
    }
    
    func testSingleFieldArray() {
        let fields: [TransactionFocusField] = [.recipient]
        var focusState: TransactionFocusField? = .recipient
        
        // Test moving next from single field (should dismiss)
        FocusManager.moveToNext(from: focusState, in: fields, focusState: &focusState)
        XCTAssertNil(focusState)
        
        // Reset and test moving previous from single field
        focusState = .recipient
        FocusManager.moveToPrevious(from: focusState, in: fields, focusState: &focusState)
        XCTAssertEqual(focusState, .recipient) // Should stay at the same field
    }
    
    func testInvalidCurrentField() {
        let fields: [TransactionFocusField] = [.recipient, .amount]
        var focusState: TransactionFocusField? = .description // Not in fields array
        
        // Test moving next with invalid current field (should focus first)
        FocusManager.moveToNext(from: focusState, in: fields, focusState: &focusState)
        XCTAssertEqual(focusState, .recipient)
        
        // Reset and test moving previous with invalid current field (should focus last)
        focusState = .description
        FocusManager.moveToPrevious(from: focusState, in: fields, focusState: &focusState)
        XCTAssertEqual(focusState, .amount)
    }
    
    // MARK: - Performance Tests
    
    func testFocusManagerPerformance() {
        let fields: [TransactionFocusField] = [.recipient, .amount, .description]
        var focusState: TransactionFocusField? = .recipient
        
        measure {
            // Perform many focus transitions
            for _ in 0..<1000 {
                FocusManager.moveToNext(from: focusState, in: fields, focusState: &focusState)
                if focusState == nil {
                    focusState = .recipient
                }
            }
        }
    }
    
    func testValidationPerformance() {
        let fields: [TransactionFocusField] = [.recipient, .amount, .description]
        let requiredFields: Set<TransactionFocusField> = [.recipient, .amount]
        let values: [TransactionFocusField: String] = [
            .recipient: "test-recipient-id",
            .amount: "100.50",
            .description: "Test description"
        ]
        
        measure {
            // Perform many validations
            for _ in 0..<1000 {
                _ = FocusManager.validateRequiredFields(
                    fields: fields,
                    values: values,
                    requiredFields: requiredFields
                )
            }
        }
    }
}