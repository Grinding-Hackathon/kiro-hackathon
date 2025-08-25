//
//  FocusStateIntegrationTests.swift
//  OfflineBlockchainWalletTests
//
//  Created by Kiro on 8/25/2025.
//  Copyright © 2025 Offline Blockchain Wallet. All rights reserved.
//

import XCTest
import SwiftUI
@testable import offline_blockchain_wallet_ios

final class FocusStateIntegrationTests: XCTestCase {
    
    // MARK: - Integration Tests for Focus Transitions
    
    func testTransactionViewFocusTransitions() {
        // Test that focus transitions work correctly in TransactionView context
        let fields: [TransactionFocusField] = [.recipient, .amount, .description]
        var focusState: TransactionFocusField? = nil
        
        // Test initial focus (should go to first field)
        FocusManager.moveToNext(from: focusState, in: fields, focusState: &focusState)
        XCTAssertEqual(focusState, .recipient, "Initial focus should move to recipient field")
        
        // Test progression through all fields
        FocusManager.moveToNext(from: focusState, in: fields, focusState: &focusState)
        XCTAssertEqual(focusState, .amount, "Focus should move from recipient to amount")
        
        FocusManager.moveToNext(from: focusState, in: fields, focusState: &focusState)
        XCTAssertEqual(focusState, .description, "Focus should move from amount to description")
        
        // Test final transition (should dismiss keyboard)
        FocusManager.moveToNext(from: focusState, in: fields, focusState: &focusState)
        XCTAssertNil(focusState, "Focus should be dismissed after last field")
    }
    
    func testReceiveViewFocusTransitions() {
        // Test that focus transitions work correctly in ReceiveView context
        let fields: [ReceiveFocusField] = [.amount, .description]
        var focusState: ReceiveFocusField? = nil
        
        // Test initial focus
        FocusManager.moveToNext(from: focusState, in: fields, focusState: &focusState)
        XCTAssertEqual(focusState, .amount, "Initial focus should move to amount field")
        
        // Test progression
        FocusManager.moveToNext(from: focusState, in: fields, focusState: &focusState)
        XCTAssertEqual(focusState, .description, "Focus should move from amount to description")
        
        // Test final transition
        FocusManager.moveToNext(from: focusState, in: fields, focusState: &focusState)
        XCTAssertNil(focusState, "Focus should be dismissed after last field")
    }
    
    func testBackwardFocusTransitions() {
        // Test backward navigation through fields
        let fields: [TransactionFocusField] = [.recipient, .amount, .description]
        var focusState: TransactionFocusField? = .description
        
        // Test backward progression
        FocusManager.moveToPrevious(from: focusState, in: fields, focusState: &focusState)
        XCTAssertEqual(focusState, .amount, "Focus should move from description to amount")
        
        FocusManager.moveToPrevious(from: focusState, in: fields, focusState: &focusState)
        XCTAssertEqual(focusState, .recipient, "Focus should move from amount to recipient")
        
        // Test staying at first field
        FocusManager.moveToPrevious(from: focusState, in: fields, focusState: &focusState)
        XCTAssertEqual(focusState, .recipient, "Focus should stay at recipient (first field)")
    }
    
    // MARK: - Form Validation Integration Tests
    
    func testTransactionFormValidation() {
        let fields: [TransactionFocusField] = [.recipient, .amount, .description]
        let requiredFields: Set<TransactionFocusField> = [.recipient, .amount]
        
        // Test valid form
        var values: [TransactionFocusField: String] = [
            .recipient: "test-wallet-id-12345",
            .amount: "100.50",
            .description: "Test payment"
        ]
        
        var isValid = FocusManager.validateRequiredFields(
            fields: fields,
            values: values,
            requiredFields: requiredFields
        )
        XCTAssertTrue(isValid, "Form should be valid with all required fields filled")
        
        // Test with empty optional field (should still be valid)
        values[.description] = ""
        isValid = FocusManager.validateRequiredFields(
            fields: fields,
            values: values,
            requiredFields: requiredFields
        )
        XCTAssertTrue(isValid, "Form should be valid with empty optional field")
        
        // Test with missing required field
        values[.recipient] = ""
        isValid = FocusManager.validateRequiredFields(
            fields: fields,
            values: values,
            requiredFields: requiredFields
        )
        XCTAssertFalse(isValid, "Form should be invalid with empty required field")
        
        // Test with whitespace-only required field
        values[.recipient] = "   "
        isValid = FocusManager.validateRequiredFields(
            fields: fields,
            values: values,
            requiredFields: requiredFields
        )
        XCTAssertFalse(isValid, "Form should be invalid with whitespace-only required field")
    }
    
    func testReceiveFormValidation() {
        let fields: [ReceiveFocusField] = [.amount, .description]
        let requiredFields: Set<ReceiveFocusField> = [] // No required fields for receive form
        
        // Test form with no required fields
        let values: [ReceiveFocusField: String] = [
            .amount: "",
            .description: ""
        ]
        
        let isValid = FocusManager.validateRequiredFields(
            fields: fields,
            values: values,
            requiredFields: requiredFields
        )
        XCTAssertTrue(isValid, "Receive form should be valid even with empty fields")
    }
    
    // MARK: - Focus Field Properties Integration Tests
    
    func testTransactionFocusFieldIntegration() {
        // Test that all transaction focus fields have proper properties
        let allFields = TransactionFocusField.allCases
        
        for field in allFields {
            XCTAssertFalse(field.title.isEmpty, "Field \(field) should have a non-empty title")
            XCTAssertFalse(field.placeholder.isEmpty, "Field \(field) should have a non-empty placeholder")
            
            #if canImport(UIKit)
            // Test keyboard types are appropriate
            switch field {
            case .recipient, .description:
                XCTAssertEqual(field.keyboardType, .default, "Text fields should use default keyboard")
            case .amount:
                XCTAssertEqual(field.keyboardType, .decimalPad, "Amount field should use decimal pad")
            }
            #endif
        }
    }
    
    func testReceiveFocusFieldIntegration() {
        // Test that all receive focus fields have proper properties
        let allFields = ReceiveFocusField.allCases
        
        for field in allFields {
            XCTAssertFalse(field.title.isEmpty, "Field \(field) should have a non-empty title")
            XCTAssertFalse(field.placeholder.isEmpty, "Field \(field) should have a non-empty placeholder")
            
            #if canImport(UIKit)
            // Test keyboard types are appropriate
            switch field {
            case .description:
                XCTAssertEqual(field.keyboardType, .default, "Text fields should use default keyboard")
            case .amount:
                XCTAssertEqual(field.keyboardType, .decimalPad, "Amount field should use decimal pad")
            }
            #endif
        }
    }
    
    // MARK: - Real-world Scenario Tests
    
    func testCompleteTransactionFormFlow() {
        // Simulate a complete transaction form filling flow
        let fields: [TransactionFocusField] = [.recipient, .amount, .description]
        let requiredFields: Set<TransactionFocusField> = [.recipient, .amount]
        var focusState: TransactionFocusField? = nil
        var values: [TransactionFocusField: String] = [:]
        
        // Start form filling
        FocusManager.moveToNext(from: focusState, in: fields, focusState: &focusState)
        XCTAssertEqual(focusState, .recipient)
        
        // Fill recipient field
        values[.recipient] = "wallet-abc123"
        
        // Move to amount field
        FocusManager.moveToNext(from: focusState, in: fields, focusState: &focusState)
        XCTAssertEqual(focusState, .amount)
        
        // Fill amount field
        values[.amount] = "50.00"
        
        // Check validation at this point (should be valid)
        var isValid = FocusManager.validateRequiredFields(
            fields: fields,
            values: values,
            requiredFields: requiredFields
        )
        XCTAssertTrue(isValid, "Form should be valid with required fields filled")
        
        // Move to description field
        FocusManager.moveToNext(from: focusState, in: fields, focusState: &focusState)
        XCTAssertEqual(focusState, .description)
        
        // Fill optional description
        values[.description] = "Payment for services"
        
        // Final validation
        isValid = FocusManager.validateRequiredFields(
            fields: fields,
            values: values,
            requiredFields: requiredFields
        )
        XCTAssertTrue(isValid, "Form should be valid with all fields filled")
        
        // Submit form (dismiss keyboard)
        FocusManager.moveToNext(from: focusState, in: fields, focusState: &focusState)
        XCTAssertNil(focusState, "Keyboard should be dismissed after form completion")
    }
    
    func testFormValidationWithUserCorrections() {
        // Simulate user making corrections to form
        let fields: [TransactionFocusField] = [.recipient, .amount, .description]
        let requiredFields: Set<TransactionFocusField> = [.recipient, .amount]
        var values: [TransactionFocusField: String] = [
            .recipient: "",  // Initially empty
            .amount: "invalid", // Invalid amount
            .description: "Test"
        ]
        
        // Initial validation should fail
        var isValid = FocusManager.validateRequiredFields(
            fields: fields,
            values: values,
            requiredFields: requiredFields
        )
        XCTAssertFalse(isValid, "Form should be invalid initially")
        
        // User corrects recipient field
        values[.recipient] = "valid-wallet-id"
        
        // Still invalid due to amount field being empty in required fields check
        // (Note: This test focuses on required field presence, not format validation)
        values[.amount] = "" // Empty required field
        isValid = FocusManager.validateRequiredFields(
            fields: fields,
            values: values,
            requiredFields: requiredFields
        )
        XCTAssertFalse(isValid, "Form should still be invalid with empty amount")
        
        // User corrects amount field
        values[.amount] = "25.75"
        isValid = FocusManager.validateRequiredFields(
            fields: fields,
            values: values,
            requiredFields: requiredFields
        )
        XCTAssertTrue(isValid, "Form should be valid after corrections")
    }
}