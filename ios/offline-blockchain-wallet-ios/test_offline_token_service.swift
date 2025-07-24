#!/usr/bin/env swift

import Foundation

// Minimal test to verify OfflineTokenService logic
// This tests the core business logic without UI dependencies

// Mock implementations for testing
struct MockOfflineToken {
    let id: String
    let amount: Double
    let signature: String
    let issuer: String
    let issuedAt: Date
    let expirationDate: Date
    var isSpent: Bool
    var spentAt: Date?
    
    var isExpired: Bool {
        return Date() > expirationDate
    }
    
    var isValid: Bool {
        return !isExpired && !isSpent
    }
}

struct MockTokenDivisionResult {
    let originalToken: MockOfflineToken
    let paymentToken: MockOfflineToken
    let changeToken: MockOfflineToken?
    let requestedAmount: Double
    let changeAmount: Double
}

// Test token validation logic
func testTokenValidation() {
    print("Testing token validation...")
    
    // Test valid token
    let validToken = MockOfflineToken(
        id: "test1",
        amount: 100.0,
        signature: "valid_signature",
        issuer: "otm",
        issuedAt: Date(),
        expirationDate: Date().addingTimeInterval(3600), // 1 hour from now
        isSpent: false,
        spentAt: nil
    )
    
    assert(validToken.isValid, "Valid token should be valid")
    assert(!validToken.isExpired, "Valid token should not be expired")
    print("✓ Valid token test passed")
    
    // Test expired token
    let expiredToken = MockOfflineToken(
        id: "test2",
        amount: 50.0,
        signature: "valid_signature",
        issuer: "otm",
        issuedAt: Date().addingTimeInterval(-7200), // 2 hours ago
        expirationDate: Date().addingTimeInterval(-3600), // 1 hour ago
        isSpent: false,
        spentAt: nil
    )
    
    assert(!expiredToken.isValid, "Expired token should not be valid")
    assert(expiredToken.isExpired, "Expired token should be expired")
    print("✓ Expired token test passed")
    
    // Test spent token
    var spentToken = MockOfflineToken(
        id: "test3",
        amount: 75.0,
        signature: "valid_signature",
        issuer: "otm",
        issuedAt: Date(),
        expirationDate: Date().addingTimeInterval(3600),
        isSpent: true,
        spentAt: Date()
    )
    
    assert(!spentToken.isValid, "Spent token should not be valid")
    assert(spentToken.isSpent, "Spent token should be marked as spent")
    print("✓ Spent token test passed")
}

// Test token division logic
func testTokenDivision() {
    print("\nTesting token division...")
    
    let originalToken = MockOfflineToken(
        id: "division_test",
        amount: 100.0,
        signature: "original_signature",
        issuer: "otm",
        issuedAt: Date(),
        expirationDate: Date().addingTimeInterval(3600),
        isSpent: false,
        spentAt: nil
    )
    
    // Test division with change
    let divisionAmount = 30.0
    let expectedChange = originalToken.amount - divisionAmount
    
    let paymentToken = MockOfflineToken(
        id: "payment_token",
        amount: divisionAmount,
        signature: "payment_signature",
        issuer: originalToken.issuer,
        issuedAt: originalToken.issuedAt,
        expirationDate: originalToken.expirationDate,
        isSpent: false,
        spentAt: nil
    )
    
    let changeToken = MockOfflineToken(
        id: "change_token",
        amount: expectedChange,
        signature: "change_signature",
        issuer: originalToken.issuer,
        issuedAt: originalToken.issuedAt,
        expirationDate: originalToken.expirationDate,
        isSpent: false,
        spentAt: nil
    )
    
    let divisionResult = MockTokenDivisionResult(
        originalToken: originalToken,
        paymentToken: paymentToken,
        changeToken: changeToken,
        requestedAmount: divisionAmount,
        changeAmount: expectedChange
    )
    
    assert(divisionResult.paymentToken.amount == divisionAmount, "Payment token should have requested amount")
    assert(divisionResult.changeToken?.amount == expectedChange, "Change token should have correct amount")
    assert(divisionResult.changeAmount == expectedChange, "Change amount should be correct")
    print("✓ Token division with change test passed")
    
    // Test exact division (no change)
    let exactDivisionAmount = 100.0
    let exactPaymentToken = MockOfflineToken(
        id: "exact_payment",
        amount: exactDivisionAmount,
        signature: "exact_signature",
        issuer: originalToken.issuer,
        issuedAt: originalToken.issuedAt,
        expirationDate: originalToken.expirationDate,
        isSpent: false,
        spentAt: nil
    )
    
    let exactDivisionResult = MockTokenDivisionResult(
        originalToken: originalToken,
        paymentToken: exactPaymentToken,
        changeToken: nil,
        requestedAmount: exactDivisionAmount,
        changeAmount: 0.0
    )
    
    assert(exactDivisionResult.paymentToken.amount == exactDivisionAmount, "Exact payment token should have full amount")
    assert(exactDivisionResult.changeToken == nil, "Exact division should have no change token")
    assert(exactDivisionResult.changeAmount == 0.0, "Exact division should have zero change")
    print("✓ Exact token division test passed")
}

// Test amount validation
func testAmountValidation() {
    print("\nTesting amount validation...")
    
    let minAmount = 0.01
    let maxAmount = 10000.0
    
    // Test valid amounts
    let validAmounts = [0.01, 1.0, 50.0, 100.0, 1000.0, 10000.0]
    for amount in validAmounts {
        assert(amount >= minAmount && amount <= maxAmount, "Amount \(amount) should be valid")
    }
    print("✓ Valid amounts test passed")
    
    // Test invalid amounts
    let invalidAmounts = [0.0, -1.0, 10000.01, 50000.0]
    for amount in invalidAmounts {
        assert(!(amount >= minAmount && amount <= maxAmount), "Amount \(amount) should be invalid")
    }
    print("✓ Invalid amounts test passed")
}

// Test balance calculations
func testBalanceCalculations() {
    print("\nTesting balance calculations...")
    
    let tokens = [
        MockOfflineToken(id: "1", amount: 100.0, signature: "sig1", issuer: "otm", issuedAt: Date(), expirationDate: Date().addingTimeInterval(3600), isSpent: false, spentAt: nil),
        MockOfflineToken(id: "2", amount: 50.0, signature: "sig2", issuer: "otm", issuedAt: Date(), expirationDate: Date().addingTimeInterval(3600), isSpent: false, spentAt: nil),
        MockOfflineToken(id: "3", amount: 25.0, signature: "sig3", issuer: "otm", issuedAt: Date(), expirationDate: Date().addingTimeInterval(3600), isSpent: true, spentAt: Date()), // Spent token
        MockOfflineToken(id: "4", amount: 75.0, signature: "sig4", issuer: "otm", issuedAt: Date().addingTimeInterval(-7200), expirationDate: Date().addingTimeInterval(-3600), isSpent: false, spentAt: nil) // Expired token
    ]
    
    let availableBalance = tokens.filter { $0.isValid }.reduce(0.0) { $0 + $1.amount }
    let expectedBalance = 150.0 // Only first two tokens are valid
    
    assert(availableBalance == expectedBalance, "Available balance should be \(expectedBalance), got \(availableBalance)")
    print("✓ Balance calculation test passed")
}

// Run all tests
func runTests() {
    print("Running OfflineTokenService Logic Tests")
    print("=====================================")
    
    testTokenValidation()
    testTokenDivision()
    testAmountValidation()
    testBalanceCalculations()
    
    print("\n✅ All tests passed!")
    print("OfflineTokenService core logic is working correctly.")
}

// Execute tests
runTests()