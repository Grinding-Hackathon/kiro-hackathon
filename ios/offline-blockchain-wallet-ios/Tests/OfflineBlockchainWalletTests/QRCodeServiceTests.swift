//
//  QRCodeServiceTests.swift
//  OfflineBlockchainWalletTests
//
//  Created by Kiro on 7/21/25.
//

import XCTest
@testable import OfflineBlockchainWallet

final class QRCodeServiceTests: XCTestCase {
    var qrCodeService: QRCodeService!
    var mockCryptographyService: MockCryptographyService!
    var mockLogger: MockLogger!
    
    override func setUp() {
        super.setUp()
        mockCryptographyService = MockCryptographyService()
        mockLogger = MockLogger()
        qrCodeService = QRCodeService(
            cryptographyService: mockCryptographyService,
            logger: mockLogger
        )
    }
    
    override func tearDown() {
        qrCodeService = nil
        mockCryptographyService = nil
        mockLogger = nil
        super.tearDown()
    }
    
    // MARK: - QR Code Generation Tests
    
    func testGeneratePaymentRequestQR_Success() throws {
        // Given
        let walletId = "test-wallet-id"
        let publicKey = "test-public-key"
        let deviceName = "Test Device"
        let paymentInfo = PaymentRequestInfo(
            requestedAmount: 25.50,
            description: "Test payment"
        )
        let options = QRCodeGenerationOptions()
        
        // When
        let qrData = try qrCodeService.generatePaymentRequestQR(
            walletId: walletId,
            publicKey: publicKey,
            deviceName: deviceName,
            paymentInfo: paymentInfo,
            options: options
        )
        
        // Then
        XCTAssertNotNil(qrData)
        XCTAssertGreaterThan(qrData.count, 0)
    }
    
    func testGenerateConnectionRequestQR_Success() throws {
        // Given
        let walletId = "test-wallet-id"
        let publicKey = "test-public-key"
        let deviceName = "Test Device"
        let options = QRCodeGenerationOptions()
        
        // When
        let qrData = try qrCodeService.generateConnectionRequestQR(
            walletId: walletId,
            publicKey: publicKey,
            deviceName: deviceName,
            options: options
        )
        
        // Then
        XCTAssertNotNil(qrData)
        XCTAssertGreaterThan(qrData.count, 0)
    }
    
    // MARK: - QR Code Validation Tests
    
    func testValidateQRCode_ValidPaymentRequest_Success() {
        // Given
        let paymentRequest = createValidPaymentRequest()
        let qrString = encodePaymentRequest(paymentRequest)
        
        // When
        let result = qrCodeService.validateQRCode(qrString)
        
        // Then
        XCTAssertTrue(result.isValid)
        XCTAssertNotNil(result.paymentRequest)
        XCTAssertNil(result.error)
        XCTAssertEqual(result.paymentRequest?.walletId, paymentRequest.walletId)
    }
    
    func testValidateQRCode_InvalidFormat_Failure() {
        // Given
        let invalidQRString = "invalid-qr-code-data"
        
        // When
        let result = qrCodeService.validateQRCode(invalidQRString)
        
        // Then
        XCTAssertFalse(result.isValid)
        XCTAssertNil(result.paymentRequest)
        XCTAssertEqual(result.error, .invalidFormat)
    }
    
    func testValidateQRCode_UnsupportedVersion_Failure() {
        // Given
        var paymentRequest = createValidPaymentRequest()
        // Create a modified version with unsupported version
        let modifiedJSON = """
        {
            "version": "2.0",
            "type": "payment_request",
            "walletId": "\(paymentRequest.walletId)",
            "publicKey": "\(paymentRequest.publicKey)",
            "deviceName": "\(paymentRequest.deviceName)",
            "bluetoothInfo": {
                "serviceUUID": "12345678-1234-1234-1234-123456789ABC",
                "characteristicUUID": "87654321-4321-4321-4321-CBA987654321",
                "connectionTimeout": 30.0
            },
            "timestamp": "2025-01-21T10:30:00Z"
        }
        """
        
        // When
        let result = qrCodeService.validateQRCode(modifiedJSON)
        
        // Then
        XCTAssertFalse(result.isValid)
        XCTAssertNil(result.paymentRequest)
        XCTAssertEqual(result.error, .unsupportedVersion)
    }
    
    func testValidateQRCode_MissingRequiredFields_Failure() {
        // Given
        let incompleteJSON = """
        {
            "version": "1.0",
            "type": "payment_request",
            "walletId": "",
            "publicKey": "test-public-key",
            "deviceName": "Test Device",
            "bluetoothInfo": {
                "serviceUUID": "12345678-1234-1234-1234-123456789ABC",
                "characteristicUUID": "87654321-4321-4321-4321-CBA987654321",
                "connectionTimeout": 30.0
            },
            "timestamp": "2025-01-21T10:30:00Z"
        }
        """
        
        // When
        let result = qrCodeService.validateQRCode(incompleteJSON)
        
        // Then
        XCTAssertFalse(result.isValid)
        XCTAssertNil(result.paymentRequest)
        XCTAssertEqual(result.error, .missingRequiredFields)
    }
    
    func testValidateQRCode_ExpiredRequest_Failure() {
        // Given
        let expiredPaymentInfo = PaymentRequestInfo(
            requestedAmount: 25.50,
            expirationTime: Date().addingTimeInterval(-3600) // 1 hour ago
        )
        let paymentRequest = QRCodePaymentRequest(
            walletId: "test-wallet-id",
            publicKey: "test-public-key",
            deviceName: "Test Device",
            bluetoothInfo: BluetoothConnectionInfo(),
            paymentInfo: expiredPaymentInfo
        )
        let qrString = encodePaymentRequest(paymentRequest)
        
        // When
        let result = qrCodeService.validateQRCode(qrString)
        
        // Then
        XCTAssertFalse(result.isValid)
        XCTAssertNil(result.paymentRequest)
        XCTAssertEqual(result.error, .expiredRequest)
    }
    
    func testValidateQRCode_InvalidSignature_Failure() {
        // Given
        mockCryptographyService.shouldReturnValidSignature = false
        let paymentRequest = QRCodePaymentRequest(
            walletId: "test-wallet-id",
            publicKey: "test-public-key",
            deviceName: "Test Device",
            bluetoothInfo: BluetoothConnectionInfo(),
            paymentInfo: nil,
            signature: "invalid-signature"
        )
        let qrString = encodePaymentRequest(paymentRequest)
        
        // When
        let result = qrCodeService.validateQRCode(qrString)
        
        // Then
        XCTAssertFalse(result.isValid)
        XCTAssertNil(result.paymentRequest)
        XCTAssertEqual(result.error, .invalidSignature)
    }
    
    // MARK: - QR Code Parsing Tests
    
    func testParseQRCodeData_ValidJSON_Success() throws {
        // Given
        let paymentRequest = createValidPaymentRequest()
        let qrString = encodePaymentRequest(paymentRequest)
        
        // When
        let parsedRequest = try qrCodeService.parseQRCodeData(qrString)
        
        // Then
        XCTAssertEqual(parsedRequest.walletId, paymentRequest.walletId)
        XCTAssertEqual(parsedRequest.publicKey, paymentRequest.publicKey)
        XCTAssertEqual(parsedRequest.deviceName, paymentRequest.deviceName)
        XCTAssertEqual(parsedRequest.type, paymentRequest.type)
    }
    
    func testParseQRCodeData_InvalidJSON_ThrowsError() {
        // Given
        let invalidJSON = "invalid-json-data"
        
        // When & Then
        XCTAssertThrowsError(try qrCodeService.parseQRCodeData(invalidJSON)) { error in
            XCTAssertTrue(error is QRCodeValidationError)
            XCTAssertEqual(error as? QRCodeValidationError, .invalidFormat)
        }
    }
    
    // MARK: - Helper Methods
    
    private func createValidPaymentRequest() -> QRCodePaymentRequest {
        return QRCodePaymentRequest(
            walletId: "test-wallet-id",
            publicKey: "test-public-key",
            deviceName: "Test Device",
            bluetoothInfo: BluetoothConnectionInfo(),
            paymentInfo: PaymentRequestInfo(requestedAmount: 25.50)
        )
    }
    
    private func encodePaymentRequest(_ paymentRequest: QRCodePaymentRequest) -> String {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        
        do {
            let data = try encoder.encode(paymentRequest)
            return String(data: data, encoding: .utf8) ?? ""
        } catch {
            XCTFail("Failed to encode payment request: \(error)")
            return ""
        }
    }
}

// MARK: - Mock Classes

class MockLogger: LoggerProtocol {
    var loggedMessages: [(String, LogLevel)] = []
    
    func log(_ message: String, level: LogLevel) {
        loggedMessages.append((message, level))
    }
}

class MockCryptographyService: CryptographyServiceProtocol {
    var shouldReturnValidSignature = true
    
    func generateKeyPair() throws -> KeyPair {
        return KeyPair(privateKey: "mock-private-key", publicKey: "mock-public-key")
    }
    
    func signData(_ data: Data, privateKey: String) throws -> String {
        return "mock-signature"
    }
    
    func verifySignature(data: Data, signature: String, publicKey: String) -> Bool {
        return shouldReturnValidSignature
    }
    
    func encryptData(_ data: Data, publicKey: String) throws -> Data {
        return data
    }
    
    func decryptData(_ encryptedData: Data, privateKey: String) throws -> Data {
        return encryptedData
    }
    
    func hashData(_ data: Data) -> String {
        return "mock-hash"
    }
}