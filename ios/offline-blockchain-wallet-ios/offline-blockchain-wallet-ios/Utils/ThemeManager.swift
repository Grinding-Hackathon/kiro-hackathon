//
//  ThemeManager.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/26/25.
//

import SwiftUI
import Combine

enum AppearanceMode: String, CaseIterable {
    case system = "system"
    case light = "light"
    case dark = "dark"
    
    var displayName: String {
        switch self {
        case .system: return "System"
        case .light: return "Light"
        case .dark: return "Dark"
        }
    }
    
    var systemImage: String {
        switch self {
        case .system: return "circle.lefthalf.filled"
        case .light: return "sun.max"
        case .dark: return "moon"
        }
    }
}

protocol ThemeManagerProtocol: ObservableObject {
    var currentAppearanceMode: AppearanceMode { get set }
    var effectiveColorScheme: ColorScheme { get }
    
    func setAppearanceMode(_ mode: AppearanceMode)
    func observeSystemAppearanceChanges()
}

class ThemeManager: ObservableObject, ThemeManagerProtocol {
    @Published var currentAppearanceMode: AppearanceMode {
        didSet {
            saveAppearanceMode()
            updateEffectiveColorScheme()
        }
    }
    
    @Published var effectiveColorScheme: ColorScheme = .light
    
    private let userDefaults: UserDefaults
    private let logger = Logger.shared
    private var cancellables = Set<AnyCancellable>()
    
    private static let appearanceModeKey = "app_appearance_mode"
    
    init(userDefaults: UserDefaults = .standard) {
        self.userDefaults = userDefaults
        
        // Load saved appearance mode or default to system
        if let savedMode = userDefaults.string(forKey: Self.appearanceModeKey),
           let mode = AppearanceMode(rawValue: savedMode) {
            self.currentAppearanceMode = mode
        } else {
            self.currentAppearanceMode = .system
        }
        
        updateEffectiveColorScheme()
        observeSystemAppearanceChanges()
    }
    
    func setAppearanceMode(_ mode: AppearanceMode) {
        currentAppearanceMode = mode
        logger.info("Appearance mode changed to: \(mode.displayName)")
        
        // Immediately apply the appearance mode to all windows
        DispatchQueue.main.async { [weak self] in
            self?.applyAppearanceModeToWindows(mode)
        }
    }
    
    private func applyAppearanceModeToWindows(_ mode: AppearanceMode) {
        for scene in UIApplication.shared.connectedScenes {
            guard let windowScene = scene as? UIWindowScene else { continue }
            
            for window in windowScene.windows {
                switch mode {
                case .system:
                    window.overrideUserInterfaceStyle = .unspecified
                case .light:
                    window.overrideUserInterfaceStyle = .light
                case .dark:
                    window.overrideUserInterfaceStyle = .dark
                }
            }
        }
    }
    
    func observeSystemAppearanceChanges() {
        // Observe system appearance changes
        NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)
            .sink { [weak self] _ in
                self?.updateEffectiveColorScheme()
            }
            .store(in: &cancellables)
    }
    
    private func updateEffectiveColorScheme() {
        switch currentAppearanceMode {
        case .system:
            // Get system appearance
            if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
               let window = windowScene.windows.first {
                effectiveColorScheme = window.traitCollection.userInterfaceStyle == .dark ? .dark : .light
            } else {
                effectiveColorScheme = .light
            }
        case .light:
            effectiveColorScheme = .light
        case .dark:
            effectiveColorScheme = .dark
        }
        
        logger.info("Effective color scheme updated to: \(effectiveColorScheme == .dark ? "dark" : "light")")
    }
    
    private func saveAppearanceMode() {
        userDefaults.set(currentAppearanceMode.rawValue, forKey: Self.appearanceModeKey)
    }
}

// MARK: - Theme-Aware View Modifier

struct ThemedView: ViewModifier {
    func body(content: Content) -> some View {
        content
            .onAppear {
                // The themed modifier will just ensure the view respects system appearance
                // Individual views can use adaptive colors which automatically respond to system changes
            }
    }
}

extension View {
    func themed() -> some View {
        modifier(ThemedView())
    }
}

// MARK: - Color Extensions for Dark Mode Support

extension Color {
    // Adaptive background colors
    static let adaptiveBackground = Color(UIColor.systemBackground)
    static let adaptiveSecondaryBackground = Color(UIColor.secondarySystemBackground)
    static let adaptiveTertiaryBackground = Color(UIColor.tertiarySystemBackground)
    
    // Adaptive text colors
    static let adaptiveText = Color(UIColor.label)
    static let adaptiveSecondaryText = Color(UIColor.secondaryLabel)
    static let adaptiveTertiaryText = Color(UIColor.tertiaryLabel)
    
    // Adaptive surface colors
    static let adaptiveSurface = Color(UIColor.systemBackground)
    static let adaptiveSecondarySurface = Color(UIColor.secondarySystemBackground)
    
    // Adaptive border and separator colors
    static let adaptiveBorder = Color(UIColor.separator)
    static let adaptiveSeparator = Color(UIColor.separator)
    
    // Card background that adapts to theme
    static let adaptiveCardBackground = Color(UIColor { traitCollection in
        switch traitCollection.userInterfaceStyle {
        case .dark:
            return UIColor.secondarySystemBackground
        default:
            return UIColor.systemBackground
        }
    })
    
    // Enhanced card background with subtle elevation
    static let adaptiveElevatedCardBackground = Color(UIColor { traitCollection in
        switch traitCollection.userInterfaceStyle {
        case .dark:
            return UIColor.tertiarySystemBackground
        default:
            return UIColor.systemBackground
        }
    })
}