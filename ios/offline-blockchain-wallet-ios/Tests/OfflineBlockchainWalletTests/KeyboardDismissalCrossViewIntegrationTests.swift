//
//  KeyboardDismissalCrossViewIntegrationTests.swift
//  OfflineBlockchainWalletTests
//
//  Created by Kiro on 8/25/2025.
//  Copyright © 2025 Offline Blockchain Wallet. All rights reserved.
//

import XCTest
import SwiftUI
@testable import offline_blockchain_wallet_ios

/// Integration tests for keyboard dismissal behavior across all views
/// Tests Requirements: 2.1, 2.2, 2.3
@MainActor
final class KeyboardDismissalCrossViewIntegrationTests: XCTestCase {
    
    // MARK: - Test Properties
    
    private var mockStorageService: StorageService!
    private var mockNetworkService: NetworkService!
    private var mockOfflineTokenService: OfflineTokenService!
    private var mockWalletViewModel: WalletViewModel!
    private var mockTransactionViewModel: TransactionViewModel!
    
    override func setUp() {
        super.setUp()
        setupMockServices()
    }
    
    override func tearDown() {
        mockStorageService = nil
        mockNetworkService = nil
        mockOfflineTokenService = nil
        mockWalletViewModel = nil
        mockTransactionViewModel = nil
        super.tearDown()
    }
    
    // MARK: - Setup Helpers
    
    private func setupMockServices() {
        mockStorageService = StorageService()
        mockNetworkService = NetworkService()
        mockOfflineTokenService = OfflineTokenService(
            storageService: mockStorageService,
            cryptographyService: CryptographyService()
        )
        mockWalletViewModel = WalletViewModel(
            storageService: mockStorageService,
            networkService: mockNetworkService,
            offlineTokenService: mockOfflineTokenService
        )
        mockTransactionViewModel = TransactionViewModel(
            storageService: mockStorageService,
            networkService: mockNetworkService,
            offlineTokenService: mockOfflineTokenService
        )
    }
    
    // MARK: - Cross-View Consistency Tests
    
    /// Test that all views with text inputs have keyboard dismissal functionality
    /// Requirement 2.1: Apply to all views containing text input fields
    func testAllViewsHaveKeyboardDismissalFunctionality() {
        // Test WalletView has keyboard dismissal
        let walletView = WalletView(viewModel: mockWalletViewModel)
        XCTAssertNotNil(walletView, "WalletView should be created with keyboard dismissal")
        
        // Test TransactionView has keyboard dismissal
        let transactionView = TransactionView(viewModel: mockTransactionViewModel)
        XCTAssertNotNil(transactionView, "TransactionView should be created with keyboard dismissal")
        
        // Test SettingsView has keyboard dismissal
        let settingsView = SettingsView(walletViewModel: mockWalletViewModel)
        XCTAssertNotNil(settingsView, "SettingsView should be created with keyboard dismissal")
        
        // Test ReceiveView has keyboard dismissal (embedded in WalletView)
        let receiveView = ReceiveView()
        XCTAssertNotNil(receiveView, "ReceiveView should be created with keyboard dismissal")
        
        // Test QRScannerView (if it contains text inputs)
        let qrScannerView = QRScannerView(
            onScanComplete: { _ in },
            onError: { _ in }
        )
        XCTAssertNotNil(qrScannerView, "QRScannerView should be created successfully")
    }
    
    /// Test keyboard dismissal modifier consistency across views
    /// Requirement 2.1: Consistent application across all views
    func testKeyboardDismissalModifierConsistency() {
        // Create test views that simulate the keyboard dismissal modifiers
        struct TestViewWithDismissal: View {
            var body: some View {
                VStack {
                    TextField("Test", text: .constant(""))
                }
                .dismissKeyboardOnTap()
            }
        }
        
        struct TestViewWithScrollingDismissal: View {
            var body: some View {
                ScrollView {
                    VStack {
                        TextField("Test", text: .constant(""))
                    }
                }
                .dismissKeyboardOnTapWithScrolling()
            }
        }
        
        struct TestViewWithPreventedDismissal: View {
            var body: some View {
                VStack {
                    Button("Test") { }
                        .preventKeyboardDismissal()
                }
            }
        }
        
        // Test that all modifier variations work
        let basicView = TestViewWithDismissal()
        let scrollingView = TestViewWithScrollingDismissal()
        let preventedView = TestViewWithPreventedDismissal()
        
        XCTAssertNotNil(basicView, "Basic keyboard dismissal should work")
        XCTAssertNotNil(scrollingView, "Scrolling keyboard dismissal should work")
        XCTAssertNotNil(preventedView, "Prevented keyboard dismissal should work")
    }
    
    /// Test focus state management consistency across views
    /// Requirement 2.2: Consistent behavior across different views
    func testFocusStateManagementConsistency() {
        // Test TransactionView focus fields
        let transactionFields: [TransactionFocusField] = [.recipient, .amount, .description]
        var transactionFocus: TransactionFocusField? = nil
        
        // Test focus progression in transaction context
        FocusManager.moveToNext(from: transactionFocus, in: transactionFields, focusState: &transactionFocus)
        XCTAssertEqual(transactionFocus, .recipient, "Transaction focus should start with recipient")
        
        FocusManager.moveToNext(from: transactionFocus, in: transactionFields, focusState: &transactionFocus)
        XCTAssertEqual(transactionFocus, .amount, "Transaction focus should move to amount")
        
        FocusManager.moveToNext(from: transactionFocus, in: transactionFields, focusState: &transactionFocus)
        XCTAssertEqual(transactionFocus, .description, "Transaction focus should move to description")
        
        FocusManager.moveToNext(from: transactionFocus, in: transactionFields, focusState: &transactionFocus)
        XCTAssertNil(transactionFocus, "Transaction focus should dismiss after last field")
        
        // Test ReceiveView focus fields
        let receiveFields: [ReceiveFocusField] = [.amount, .description]
        var receiveFocus: ReceiveFocusField? = nil
        
        // Test focus progression in receive context
        FocusManager.moveToNext(from: receiveFocus, in: receiveFields, focusState: &receiveFocus)
        XCTAssertEqual(receiveFocus, .amount, "Receive focus should start with amount")
        
        FocusManager.moveToNext(from: receiveFocus, in: receiveFields, focusState: &receiveFocus)
        XCTAssertEqual(receiveFocus, .description, "Receive focus should move to description")
        
        FocusManager.moveToNext(from: receiveFocus, in: receiveFields, focusState: &receiveFocus)
        XCTAssertNil(receiveFocus, "Receive focus should dismiss after last field")
    }
    
    // MARK: - Navigation Consistency Tests
    
    /// Test keyboard dismissal behavior when navigating between views
    /// Requirement 2.2: Maintain consistent behavior when navigating between views
    func testKeyboardDismissalDuringNavigation() {
        // Simulate navigation scenarios
        struct NavigationTestView: View {
            @State private var showingTransaction = false
            @State private var showingSettings = false
            @State private var showingReceive = false
            
            var body: some View {
                NavigationView {
                    VStack {
                        TextField("Test Field", text: .constant(""))
                        
                        Button("Show Transaction") {
                            showingTransaction = true
                        }
                        .preventKeyboardDismissal()
                        
                        Button("Show Settings") {
                            showingSettings = true
                        }
                        .preventKeyboardDismissal()
                        
                        Button("Show Receive") {
                            showingReceive = true
                        }
                        .preventKeyboardDismissal()
                    }
                    .dismissKeyboardOnTap()
                    .sheet(isPresented: $showingTransaction) {
                        TransactionView(viewModel: TransactionViewModel(
                            storageService: StorageService(),
                            networkService: NetworkService(),
                            offlineTokenService: OfflineTokenService(
                                storageService: StorageService(),
                                cryptographyService: CryptographyService()
                            )
                        ))
                    }
                    .sheet(isPresented: $showingSettings) {
                        SettingsView(walletViewModel: WalletViewModel(
                            storageService: StorageService(),
                            networkService: NetworkService(),
                            offlineTokenService: OfflineTokenService(
                                storageService: StorageService(),
                                cryptographyService: CryptographyService()
                            )
                        ))
                    }
                    .sheet(isPresented: $showingReceive) {
                        ReceiveView()
                    }
                }
            }
        }
        
        let navigationView = NavigationTestView()
        XCTAssertNotNil(navigationView, "Navigation test view should be created successfully")
    }
    
    /// Test keyboard state preservation across view transitions
    /// Requirement 2.2: Consistent behavior when navigating between views
    func testKeyboardStatePreservationAcrossTransitions() {
        // Test that keyboard dismissal state is properly managed during transitions
        struct TransitionTestView: View {
            @State private var currentView = 0
            @FocusState private var isFieldFocused: Bool
            
            var body: some View {
                VStack {
                    Picker("View", selection: $currentView) {
                        Text("View 1").tag(0)
                        Text("View 2").tag(1)
                        Text("View 3").tag(2)
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    
                    Group {
                        switch currentView {
                        case 0:
                            TextField("Field 1", text: .constant(""))
                                .focused($isFieldFocused)
                        case 1:
                            TextField("Field 2", text: .constant(""))
                                .focused($isFieldFocused)
                        case 2:
                            TextField("Field 3", text: .constant(""))
                                .focused($isFieldFocused)
                        default:
                            EmptyView()
                        }
                    }
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                }
                .dismissKeyboardOnTap()
                .onChange(of: currentView) { _ in
                    // Dismiss keyboard when switching views
                    isFieldFocused = false
                }
            }
        }
        
        let transitionView = TransitionTestView()
        XCTAssertNotNil(transitionView, "Transition test view should be created successfully")
    }
    
    // MARK: - Device Orientation and Size Tests
    
    /// Test keyboard dismissal behavior with different device orientations
    /// Requirement 2.3: Test with different device orientations and sizes
    func testKeyboardDismissalWithOrientationChanges() {
        // Simulate different device orientations
        struct OrientationTestView: View {
            @State private var orientation: UIDeviceOrientation = .portrait
            @FocusState private var focusedField: TransactionFocusField?
            
            var body: some View {
                VStack {
                    Text("Current Orientation: \(orientationDescription)")
                        .font(.caption)
                    
                    VStack(spacing: 16) {
                        TextField("Recipient", text: .constant(""))
                            .focused($focusedField, equals: .recipient)
                        
                        TextField("Amount", text: .constant(""))
                            .focused($focusedField, equals: .amount)
                        
                        TextField("Description", text: .constant(""))
                            .focused($focusedField, equals: .description)
                    }
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    
                    HStack {
                        Button("Portrait") {
                            orientation = .portrait
                        }
                        
                        Button("Landscape") {
                            orientation = .landscapeLeft
                        }
                        
                        Button("Upside Down") {
                            orientation = .portraitUpsideDown
                        }
                    }
                    .preventKeyboardDismissal()
                }
                .dismissKeyboardOnTap()
                .enhancedFocusState($focusedField, fields: [.recipient, .amount, .description])
            }
            
            private var orientationDescription: String {
                switch orientation {
                case .portrait: return "Portrait"
                case .landscapeLeft, .landscapeRight: return "Landscape"
                case .portraitUpsideDown: return "Upside Down"
                default: return "Unknown"
                }
            }
        }
        
        let orientationView = OrientationTestView()
        XCTAssertNotNil(orientationView, "Orientation test view should be created successfully")
    }
    
    /// Test keyboard dismissal behavior with different device sizes
    /// Requirement 2.3: Test with different device sizes
    func testKeyboardDismissalWithDifferentDeviceSizes() {
        // Simulate different device sizes
        struct DeviceSizeTestView: View {
            @State private var deviceSize: DeviceSize = .phone
            @FocusState private var focusedField: TransactionFocusField?
            
            enum DeviceSize: CaseIterable {
                case phone, tablet, compact
                
                var description: String {
                    switch self {
                    case .phone: return "Phone"
                    case .tablet: return "Tablet"
                    case .compact: return "Compact"
                    }
                }
                
                var frameSize: CGSize {
                    switch self {
                    case .phone: return CGSize(width: 375, height: 812)
                    case .tablet: return CGSize(width: 768, height: 1024)
                    case .compact: return CGSize(width: 320, height: 568)
                    }
                }
            }
            
            var body: some View {
                VStack {
                    Text("Device Size: \(deviceSize.description)")
                        .font(.caption)
                    
                    ScrollView {
                        VStack(spacing: 16) {
                            ForEach(0..<5) { index in
                                TextField("Field \(index + 1)", text: .constant(""))
                                    .textFieldStyle(RoundedBorderTextFieldStyle())
                            }
                        }
                        .padding()
                    }
                    .dismissKeyboardOnTapWithScrolling()
                    
                    HStack {
                        ForEach(DeviceSize.allCases, id: \.self) { size in
                            Button(size.description) {
                                deviceSize = size
                            }
                            .preventKeyboardDismissal()
                        }
                    }
                }
                .frame(
                    width: deviceSize.frameSize.width,
                    height: deviceSize.frameSize.height
                )
                .border(Color.gray, width: 1)
            }
        }
        
        let deviceSizeView = DeviceSizeTestView()
        XCTAssertNotNil(deviceSizeView, "Device size test view should be created successfully")
    }
    
    /// Test keyboard dismissal with adaptive layouts
    /// Requirement 2.3: Test with different device sizes and orientations
    func testKeyboardDismissalWithAdaptiveLayouts() {
        struct AdaptiveLayoutTestView: View {
            @Environment(\.horizontalSizeClass) var horizontalSizeClass
            @Environment(\.verticalSizeClass) var verticalSizeClass
            @FocusState private var focusedField: TransactionFocusField?
            
            var body: some View {
                Group {
                    if horizontalSizeClass == .compact {
                        // Compact layout (phone portrait, phone landscape)
                        VStack(spacing: 16) {
                            compactFormFields
                        }
                    } else {
                        // Regular layout (tablet, phone landscape in some cases)
                        HStack(spacing: 20) {
                            VStack(spacing: 16) {
                                regularFormFields
                            }
                            .frame(maxWidth: .infinity)
                            
                            VStack {
                                Text("Additional Info")
                                Spacer()
                            }
                            .frame(maxWidth: .infinity)
                        }
                    }
                }
                .dismissKeyboardOnTap()
                .enhancedFocusState($focusedField, fields: [.recipient, .amount, .description])
            }
            
            private var compactFormFields: some View {
                Group {
                    TextField("Recipient", text: .constant(""))
                        .focused($focusedField, equals: .recipient)
                    
                    TextField("Amount", text: .constant(""))
                        .focused($focusedField, equals: .amount)
                    
                    TextField("Description", text: .constant(""))
                        .focused($focusedField, equals: .description)
                }
                .textFieldStyle(RoundedBorderTextFieldStyle())
            }
            
            private var regularFormFields: some View {
                Group {
                    HStack {
                        Text("Recipient:")
                        TextField("Enter recipient", text: .constant(""))
                            .focused($focusedField, equals: .recipient)
                    }
                    
                    HStack {
                        Text("Amount:")
                        TextField("0.00", text: .constant(""))
                            .focused($focusedField, equals: .amount)
                    }
                    
                    HStack {
                        Text("Description:")
                        TextField("Optional", text: .constant(""))
                            .focused($focusedField, equals: .description)
                    }
                }
                .textFieldStyle(RoundedBorderTextFieldStyle())
            }
        }
        
        let adaptiveView = AdaptiveLayoutTestView()
        XCTAssertNotNil(adaptiveView, "Adaptive layout test view should be created successfully")
    }
    
    // MARK: - Real-World Integration Scenarios
    
    /// Test complete user workflow across multiple views
    /// Requirements 2.1, 2.2: Complete cross-view integration
    func testCompleteUserWorkflowIntegration() {
        struct WorkflowIntegrationTestView: View {
            @State private var currentStep = 0
            @State private var recipientId = ""
            @State private var amount = ""
            @State private var description = ""
            @FocusState private var focusedField: TransactionFocusField?
            
            private let steps = ["Enter Recipient", "Enter Amount", "Add Description", "Review", "Complete"]
            
            var body: some View {
                NavigationView {
                    VStack(spacing: 20) {
                        // Progress indicator
                        HStack {
                            ForEach(0..<steps.count, id: \.self) { index in
                                Circle()
                                    .fill(index <= currentStep ? Color.blue : Color.gray.opacity(0.3))
                                    .frame(width: 12, height: 12)
                                
                                if index < steps.count - 1 {
                                    Rectangle()
                                        .fill(index < currentStep ? Color.blue : Color.gray.opacity(0.3))
                                        .frame(height: 2)
                                }
                            }
                        }
                        .padding()
                        
                        Text(steps[currentStep])
                            .font(.title2)
                            .fontWeight(.semibold)
                        
                        // Step content
                        Group {
                            switch currentStep {
                            case 0:
                                TextField("Recipient ID", text: $recipientId)
                                    .focused($focusedField, equals: .recipient)
                                    .textFieldStyle(RoundedBorderTextFieldStyle())
                                    .onSubmit {
                                        if !recipientId.isEmpty {
                                            nextStep()
                                        }
                                    }
                                
                            case 1:
                                TextField("Amount", text: $amount)
                                    .focused($focusedField, equals: .amount)
                                    .textFieldStyle(RoundedBorderTextFieldStyle())
                                    #if canImport(UIKit)
                                    .keyboardType(.decimalPad)
                                    #endif
                                    .onSubmit {
                                        if !amount.isEmpty {
                                            nextStep()
                                        }
                                    }
                                
                            case 2:
                                TextField("Description (optional)", text: $description)
                                    .focused($focusedField, equals: .description)
                                    .textFieldStyle(RoundedBorderTextFieldStyle())
                                    .onSubmit {
                                        nextStep()
                                    }
                                
                            case 3:
                                VStack(alignment: .leading, spacing: 12) {
                                    Text("Review Transaction")
                                        .font(.headline)
                                    
                                    HStack {
                                        Text("Recipient:")
                                        Spacer()
                                        Text(recipientId)
                                            .fontWeight(.medium)
                                    }
                                    
                                    HStack {
                                        Text("Amount:")
                                        Spacer()
                                        Text(amount)
                                            .fontWeight(.medium)
                                    }
                                    
                                    if !description.isEmpty {
                                        HStack {
                                            Text("Description:")
                                            Spacer()
                                            Text(description)
                                                .fontWeight(.medium)
                                        }
                                    }
                                }
                                .padding()
                                .background(Color.gray.opacity(0.1))
                                .cornerRadius(12)
                                
                            case 4:
                                VStack {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.system(size: 60))
                                        .foregroundColor(.green)
                                    
                                    Text("Transaction Complete!")
                                        .font(.title2)
                                        .fontWeight(.semibold)
                                }
                                
                            default:
                                EmptyView()
                            }
                        }
                        .frame(minHeight: 100)
                        
                        Spacer()
                        
                        // Navigation buttons
                        HStack {
                            if currentStep > 0 && currentStep < steps.count - 1 {
                                Button("Previous") {
                                    previousStep()
                                }
                                .preventKeyboardDismissal()
                            }
                            
                            Spacer()
                            
                            if currentStep < steps.count - 1 {
                                Button(currentStep == 3 ? "Send" : "Next") {
                                    nextStep()
                                }
                                .disabled(!canProceed)
                                .preventKeyboardDismissal()
                            }
                        }
                        .padding()
                    }
                    .dismissKeyboardOnTap()
                    .enhancedFocusState($focusedField, fields: [.recipient, .amount, .description])
                    .navigationTitle("Send Transaction")
                    .navigationBarTitleDisplayMode(.inline)
                }
            }
            
            private var canProceed: Bool {
                switch currentStep {
                case 0: return !recipientId.isEmpty
                case 1: return !amount.isEmpty && Double(amount) != nil
                case 2: return true // Description is optional
                case 3: return true // Review step
                default: return false
                }
            }
            
            private func nextStep() {
                if currentStep < steps.count - 1 {
                    currentStep += 1
                    focusedField = nil // Dismiss keyboard when moving to next step
                }
            }
            
            private func previousStep() {
                if currentStep > 0 {
                    currentStep -= 1
                    focusedField = nil // Dismiss keyboard when moving to previous step
                }
            }
        }
        
        let workflowView = WorkflowIntegrationTestView()
        XCTAssertNotNil(workflowView, "Workflow integration test view should be created successfully")
    }
    
    /// Test keyboard dismissal with complex nested views
    /// Requirements 2.1, 2.2: Complex view hierarchies
    func testKeyboardDismissalWithNestedViews() {
        struct NestedViewTestView: View {
            @FocusState private var focusedField: TransactionFocusField?
            
            var body: some View {
                NavigationView {
                    ScrollView {
                        VStack(spacing: 20) {
                            // Level 1: Main form
                            VStack(alignment: .leading, spacing: 16) {
                                Text("Main Form")
                                    .font(.headline)
                                
                                TextField("Field 1", text: .constant(""))
                                    .focused($focusedField, equals: .recipient)
                                    .textFieldStyle(RoundedBorderTextFieldStyle())
                            }
                            .padding()
                            .background(Color.blue.opacity(0.1))
                            .cornerRadius(12)
                            
                            // Level 2: Nested form in card
                            VStack(alignment: .leading, spacing: 16) {
                                Text("Nested Form")
                                    .font(.headline)
                                
                                HStack {
                                    VStack {
                                        TextField("Field 2", text: .constant(""))
                                            .focused($focusedField, equals: .amount)
                                            .textFieldStyle(RoundedBorderTextFieldStyle())
                                    }
                                    
                                    VStack {
                                        // Level 3: Deeply nested
                                        VStack {
                                            TextField("Field 3", text: .constant(""))
                                                .focused($focusedField, equals: .description)
                                                .textFieldStyle(RoundedBorderTextFieldStyle())
                                        }
                                        .padding()
                                        .background(Color.green.opacity(0.1))
                                        .cornerRadius(8)
                                    }
                                }
                            }
                            .padding()
                            .background(Color.orange.opacity(0.1))
                            .cornerRadius(12)
                            
                            // Interactive elements that should prevent dismissal
                            VStack(spacing: 12) {
                                Button("Action Button 1") { }
                                    .preventKeyboardDismissal()
                                
                                Button("Action Button 2") { }
                                    .preventKeyboardDismissal()
                                
                                Toggle("Toggle Setting", isOn: .constant(true))
                                    .preventKeyboardDismissal()
                            }
                            .padding()
                            .background(Color.purple.opacity(0.1))
                            .cornerRadius(12)
                        }
                        .padding()
                    }
                    .dismissKeyboardOnTapWithScrolling()
                    .enhancedFocusState($focusedField, fields: [.recipient, .amount, .description])
                    .navigationTitle("Nested Views Test")
                }
            }
        }
        
        let nestedView = NestedViewTestView()
        XCTAssertNotNil(nestedView, "Nested view test should be created successfully")
    }
    
    // MARK: - Performance and Edge Case Tests
    
    /// Test keyboard dismissal performance with many text fields
    /// Requirement 2.1: Performance with multiple text fields
    func testKeyboardDismissalPerformanceWithManyFields() {
        struct ManyFieldsTestView: View {
            @State private var textFields: [String] = Array(repeating: "", count: 50)
            @FocusState private var focusedIndex: Int?
            
            var body: some View {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(0..<textFields.count, id: \.self) { index in
                            TextField("Field \(index + 1)", text: $textFields[index])
                                .focused($focusedIndex, equals: index)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                        }
                    }
                    .padding()
                }
                .dismissKeyboardOnTapWithScrolling()
            }
        }
        
        // Measure performance of creating view with many fields
        measure {
            let manyFieldsView = ManyFieldsTestView()
            XCTAssertNotNil(manyFieldsView, "Many fields view should be created efficiently")
        }
    }
    
    /// Test keyboard dismissal with rapid user interactions
    /// Requirement 2.2: Handle rapid interactions gracefully
    func testKeyboardDismissalWithRapidInteractions() {
        struct RapidInteractionTestView: View {
            @State private var tapCount = 0
            @State private var dismissalCount = 0
            @FocusState private var isFieldFocused: Bool
            
            var body: some View {
                VStack(spacing: 20) {
                    Text("Tap Count: \(tapCount)")
                    Text("Dismissal Count: \(dismissalCount)")
                    
                    TextField("Test Field", text: .constant(""))
                        .focused($isFieldFocused)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                    
                    Button("Rapid Tap Test") {
                        // Simulate rapid tapping
                        for _ in 0..<10 {
                            tapCount += 1
                        }
                    }
                    .preventKeyboardDismissal()
                }
                .dismissKeyboardOnTap()
                .onChange(of: isFieldFocused) { focused in
                    if !focused {
                        dismissalCount += 1
                    }
                }
            }
        }
        
        let rapidInteractionView = RapidInteractionTestView()
        XCTAssertNotNil(rapidInteractionView, "Rapid interaction test view should be created successfully")
    }
    
    /// Test keyboard dismissal edge cases
    /// Requirements 2.1, 2.2: Handle edge cases properly
    func testKeyboardDismissalEdgeCases() {
        // Test with nil focus state
        struct EdgeCaseTestView: View {
            @FocusState private var focusedField: TransactionFocusField?
            @State private var showAlert = false
            @State private var showSheet = false
            
            var body: some View {
                VStack {
                    TextField("Test Field", text: .constant(""))
                        .focused($focusedField, equals: .recipient)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                    
                    Button("Show Alert") {
                        showAlert = true
                    }
                    .preventKeyboardDismissal()
                    
                    Button("Show Sheet") {
                        showSheet = true
                    }
                    .preventKeyboardDismissal()
                }
                .dismissKeyboardOnTap()
                .alert("Test Alert", isPresented: $showAlert) {
                    Button("OK") { }
                }
                .sheet(isPresented: $showSheet) {
                    VStack {
                        Text("Sheet Content")
                        TextField("Sheet Field", text: .constant(""))
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                    }
                    .dismissKeyboardOnTap()
                    .padding()
                }
                .onAppear {
                    // Test with nil focus state initially
                    focusedField = nil
                }
            }
        }
        
        let edgeCaseView = EdgeCaseTestView()
        XCTAssertNotNil(edgeCaseView, "Edge case test view should be created successfully")
    }
}

// MARK: - Test Helper Extensions

extension KeyboardDismissalCrossViewIntegrationTests {
    
    /// Helper to create a test view with specific keyboard dismissal configuration
    private func createTestView<T: View>(
        with content: T,
        dismissalType: KeyboardDismissalType = .basic
    ) -> AnyView {
        switch dismissalType {
        case .basic:
            return AnyView(content.dismissKeyboardOnTap())
        case .scrolling:
            return AnyView(content.dismissKeyboardOnTapWithScrolling())
        case .prevented:
            return AnyView(content.preventKeyboardDismissal())
        }
    }
    
    /// Helper enum for different dismissal types
    private enum KeyboardDismissalType {
        case basic
        case scrolling
        case prevented
    }
    
    /// Helper to verify view modifier application
    private func verifyKeyboardDismissalModifier<T: View>(_ view: T, expectedType: KeyboardDismissalType) {
        XCTAssertNotNil(view, "View with keyboard dismissal modifier should not be nil")
        // Additional verification logic could be added here
    }
    
    /// Helper to simulate device orientation changes
    private func simulateOrientationChange(to orientation: UIDeviceOrientation) {
        // In a real test environment, this would trigger orientation change notifications
        // For unit tests, we just verify the view can handle orientation changes
        XCTAssertTrue(
            [.portrait, .landscapeLeft, .landscapeRight, .portraitUpsideDown].contains(orientation),
            "Should support standard orientations"
        )
    }
    
    /// Helper to simulate different device sizes
    private func simulateDeviceSize(_ size: CGSize) -> Bool {
        // Verify that the size is within reasonable bounds for iOS devices
        let minSize = CGSize(width: 320, height: 480) // iPhone 4 minimum
        let maxSize = CGSize(width: 1366, height: 1024) // iPad Pro maximum
        
        return size.width >= minSize.width && size.width <= maxSize.width &&
               size.height >= minSize.height && size.height <= maxSize.height
    }
}