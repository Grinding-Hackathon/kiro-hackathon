//
//  KeyboardDismissal.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 8/25/2025.
//  Copyright © 2025 Offline Blockchain Wallet. All rights reserved.
//

import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

// MARK: - Focus Field Enumerations

/// Focus field enumeration for TransactionView
enum TransactionFocusField: Hashable, CaseIterable {
    case recipient
    case amount
    case description
    
    var title: String {
        switch self {
        case .recipient: return "Recipient"
        case .amount: return "Amount"
        case .description: return "Description"
        }
    }
    
    var placeholder: String {
        switch self {
        case .recipient: return "Enter recipient ID or scan QR"
        case .amount: return "0.00"
        case .description: return "Optional description"
        }
    }
    
    #if canImport(UIKit)
    var keyboardType: UIKeyboardType {
        switch self {
        case .recipient: return .default
        case .amount: return .decimalPad
        case .description: return .default
        }
    }
    #endif
}

/// Focus field enumeration for ReceiveView
enum ReceiveFocusField: Hashable, CaseIterable {
    case amount
    case description
    
    var title: String {
        switch self {
        case .amount: return "Amount"
        case .description: return "Description"
        }
    }
    
    var placeholder: String {
        switch self {
        case .amount: return "0.00"
        case .description: return "Optional description"
        }
    }
    
    #if canImport(UIKit)
    var keyboardType: UIKeyboardType {
        switch self {
        case .amount: return .decimalPad
        case .description: return .default
        }
    }
    #endif
}

/// Focus field enumeration for SettingsView (for future text inputs)
enum SettingsFocusField: Hashable, CaseIterable {
    case walletName
    case customThreshold
    case customAmount
    
    var title: String {
        switch self {
        case .walletName: return "Wallet Name"
        case .customThreshold: return "Custom Threshold"
        case .customAmount: return "Custom Amount"
        }
    }
    
    var placeholder: String {
        switch self {
        case .walletName: return "My Wallet"
        case .customThreshold: return "Enter threshold"
        case .customAmount: return "Enter amount"
        }
    }
    
    #if canImport(UIKit)
    var keyboardType: UIKeyboardType {
        switch self {
        case .walletName: return .default
        case .customThreshold, .customAmount: return .decimalPad
        }
    }
    #endif
}

// MARK: - Focus Management Utilities

/// Utility struct for managing focus transitions between fields
struct FocusManager {
    /// Moves focus to the next field in the sequence
    static func moveToNext<T: CaseIterable & Hashable>(
        from currentField: T?,
        in fields: [T],
        focusState: inout T?
    ) where T.AllCases.Element == T {
        guard let current = currentField,
              let currentIndex = fields.firstIndex(of: current) else {
            // If no current field, focus on first field
            focusState = fields.first
            return
        }
        
        let nextIndex = currentIndex + 1
        if nextIndex < fields.count {
            focusState = fields[nextIndex]
        } else {
            // If at last field, dismiss keyboard
            focusState = nil
        }
    }
    
    /// Moves focus to the previous field in the sequence
    static func moveToPrevious<T: CaseIterable & Hashable>(
        from currentField: T?,
        in fields: [T],
        focusState: inout T?
    ) where T.AllCases.Element == T {
        guard let current = currentField,
              let currentIndex = fields.firstIndex(of: current) else {
            // If no current field, focus on last field
            focusState = fields.last
            return
        }
        
        let previousIndex = currentIndex - 1
        if previousIndex >= 0 {
            focusState = fields[previousIndex]
        }
    }
    
    /// Validates if all required fields have content
    static func validateRequiredFields<T: Hashable>(
        fields: [T],
        values: [T: String],
        requiredFields: Set<T>
    ) -> Bool {
        return requiredFields.allSatisfy { field in
            guard let value = values[field] else { return false }
            return !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
    }
}

// MARK: - Enhanced Focus State View Modifier

/// View modifier that provides enhanced focus state management with navigation
struct EnhancedFocusStateManagement<FocusField: Hashable & CaseIterable>: ViewModifier 
where FocusField.AllCases.Element == FocusField {
    
    let focusedFieldBinding: Binding<FocusField?>
    let fields: [FocusField]
    let onFieldChange: ((FocusField?) -> Void)?
    
    init(
        focusedField: Binding<FocusField?>,
        fields: [FocusField],
        onFieldChange: ((FocusField?) -> Void)? = nil
    ) {
        self.focusedFieldBinding = focusedField
        self.fields = fields
        self.onFieldChange = onFieldChange
    }
    
    func body(content: Content) -> some View {
        content
            .onChange(of: focusedFieldBinding.wrappedValue) { newValue in
                onFieldChange?(newValue)
            }
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    HStack {
                        // Previous button
                        Button(action: {
                            var currentFocus = focusedFieldBinding.wrappedValue
                            FocusManager.moveToPrevious(
                                from: currentFocus,
                                in: fields,
                                focusState: &currentFocus
                            )
                            focusedFieldBinding.wrappedValue = currentFocus
                        }) {
                            Image(systemName: "chevron.up")
                                .font(.title3)
                        }
                        .disabled(focusedFieldBinding.wrappedValue == fields.first)
                        
                        // Next button
                        Button(action: {
                            var currentFocus = focusedFieldBinding.wrappedValue
                            FocusManager.moveToNext(
                                from: currentFocus,
                                in: fields,
                                focusState: &currentFocus
                            )
                            focusedFieldBinding.wrappedValue = currentFocus
                        }) {
                            Image(systemName: "chevron.down")
                                .font(.title3)
                        }
                        .disabled(focusedFieldBinding.wrappedValue == fields.last)
                        
                        Spacer()
                        
                        // Done button
                        Button("Done") {
                            focusedFieldBinding.wrappedValue = nil
                        }
                        .fontWeight(.medium)
                    }
                }
            }
    }
}

/// A view modifier that adds tap-to-dismiss keyboard functionality with gesture conflict handling
struct DismissKeyboardOnTap: ViewModifier {
    /// Tracks if a keyboard dismissal is in progress to prevent rapid taps
    @State private var isDismissing = false
    
    func body(content: Content) -> some View {
        content
            .simultaneousGesture(
                // Use simultaneousGesture to allow other gestures to work alongside keyboard dismissal
                TapGesture()
                    .onEnded { _ in
                        dismissKeyboardSafely()
                    }
            )
    }
    
    /// Safely dismisses the keyboard with debouncing to handle rapid taps
    private func dismissKeyboardSafely() {
        // Prevent multiple rapid dismissal attempts
        guard !isDismissing else { return }
        
        isDismissing = true
        
        #if canImport(UIKit)
        // Use UIKit's sendAction to dismiss the keyboard
        // This sends the resignFirstResponder action to the first responder
        UIApplication.shared.sendAction(
            #selector(UIResponder.resignFirstResponder),
            to: nil,
            from: nil,
            for: nil
        )
        #endif
        
        // Reset the dismissing flag after a short delay to allow for smooth animations
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            isDismissing = false
        }
    }
}

/// Enhanced view modifier for scrollable content that handles both scrolling and keyboard dismissal
struct DismissKeyboardOnTapWithScrolling: ViewModifier {
    @State private var isDismissing = false
    
    func body(content: Content) -> some View {
        content
            .simultaneousGesture(
                // Use simultaneousGesture to allow scrolling while also enabling keyboard dismissal
                TapGesture()
                    .onEnded { _ in
                        dismissKeyboardSafely()
                    }
            )
    }
    
    private func dismissKeyboardSafely() {
        guard !isDismissing else { return }
        
        isDismissing = true
        
        #if canImport(UIKit)
        UIApplication.shared.sendAction(
            #selector(UIResponder.resignFirstResponder),
            to: nil,
            from: nil,
            for: nil
        )
        #endif
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            isDismissing = false
        }
    }
}

/// View modifier that prevents keyboard dismissal for interactive elements
struct PreventKeyboardDismissal: ViewModifier {
    func body(content: Content) -> some View {
        content
            .onTapGesture {
                // This empty tap gesture with higher priority prevents the parent's
                // keyboard dismissal gesture from firing when tapping interactive elements
            }
    }
}

/// Extension to make the keyboard dismissal modifiers easily accessible
extension View {
    /// Adds tap-to-dismiss keyboard functionality to any view
    /// - Returns: A view with tap gesture that dismisses the keyboard when tapped outside text fields
    func dismissKeyboardOnTap() -> some View {
        self.modifier(DismissKeyboardOnTap())
    }
    
    /// Adds tap-to-dismiss keyboard functionality optimized for scrollable content
    /// - Returns: A view that allows scrolling while also dismissing keyboard on tap
    func dismissKeyboardOnTapWithScrolling() -> some View {
        self.modifier(DismissKeyboardOnTapWithScrolling())
    }
    
    /// Prevents keyboard dismissal when tapping on this view
    /// Use this for buttons, links, and other interactive elements
    /// - Returns: A view that won't trigger keyboard dismissal when tapped
    func preventKeyboardDismissal() -> some View {
        self.modifier(PreventKeyboardDismissal())
    }
    
    /// Adds enhanced focus state management with keyboard navigation toolbar
    /// - Parameters:
    ///   - focusedField: FocusState binding to the currently focused field
    ///   - fields: Array of fields in the focus sequence
    ///   - onFieldChange: Optional callback when focus changes
    /// - Returns: A view with enhanced focus management capabilities
    func enhancedFocusState<FocusField: Hashable & CaseIterable>(
        _ focusedField: FocusState<FocusField?>.Binding,
        fields: [FocusField],
        onFieldChange: ((FocusField?) -> Void)? = nil
    ) -> some View where FocusField.AllCases.Element == FocusField {
        self.modifier(EnhancedFocusStateManagement(
            focusedField: Binding(
                get: { focusedField.wrappedValue },
                set: { focusedField.wrappedValue = $0 }
            ),
            fields: fields,
            onFieldChange: onFieldChange
        ))
    }
}