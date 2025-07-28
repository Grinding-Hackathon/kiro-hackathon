# Dark Mode Support Design

## Overview

This design document outlines the comprehensive implementation of dark mode support for the offline blockchain wallet iOS application. The solution provides automatic system integration, manual override capabilities, and ensures all UI components are properly adapted for both light and dark appearances.

## Architecture

### Theme Management System

```
ThemeManager
├── AppearanceMode (enum)
│   ├── system
│   ├── light
│   └── dark
├── ColorScheme Management
├── Preference Persistence
└── System Integration
```

### Color System Architecture

```
ColorPalette
├── Semantic Colors
│   ├── Primary Colors
│   ├── Secondary Colors
│   ├── Background Colors
│   ├── Surface Colors
│   └── Text Colors
├── Brand Colors
│   ├── Blue (Primary)
│   ├── Green (Success)
│   ├── Orange (Warning)
│   └── Red (Error)
└── System Colors
    ├── Label Colors
    ├── Fill Colors
    └── Separator Colors
```

## Components and Interfaces

### 1. Theme Manager

```swift
protocol ThemeManagerProtocol {
    var currentAppearanceMode: AppearanceMode { get set }
    var effectiveColorScheme: ColorScheme { get }
    
    func setAppearanceMode(_ mode: AppearanceMode)
    func observeSystemAppearanceChanges()
    func applyTheme()
}

class ThemeManager: ObservableObject, ThemeManagerProtocol {
    @Published var currentAppearanceMode: AppearanceMode
    @Published var effectiveColorScheme: ColorScheme
    
    private let userDefaults: UserDefaults
    private let notificationCenter: NotificationCenter
}
```

### 2. Color Palette System

```swift
struct ColorPalette {
    // Semantic Colors
    static let primaryBackground: Color
    static let secondaryBackground: Color
    static let tertiaryBackground: Color
    
    static let primaryText: Color
    static let secondaryText: Color
    static let tertiaryText: Color
    
    static let primarySurface: Color
    static let secondarySurface: Color
    
    // Brand Colors (adapted for dark mode)
    static let brandBlue: Color
    static let brandGreen: Color
    static let brandOrange: Color
    static let brandRed: Color
    
    // Interactive Colors
    static let buttonPrimary: Color
    static let buttonSecondary: Color
    static let buttonDestructive: Color
    
    // Border and Separator Colors
    static let border: Color
    static let separator: Color
}
```

### 3. Appearance Mode Enum

```swift
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
```

### 4. Theme-Aware View Modifier

```swift
struct ThemedView: ViewModifier {
    @EnvironmentObject private var themeManager: ThemeManager
    
    func body(content: Content) -> some View {
        content
            .preferredColorScheme(themeManager.effectiveColorScheme)
            .environment(\.colorScheme, themeManager.effectiveColorScheme)
    }
}

extension View {
    func themed() -> some View {
        modifier(ThemedView())
    }
}
```

## Data Models

### 1. Theme Configuration

```swift
struct ThemeConfiguration: Codable {
    let appearanceMode: AppearanceMode
    let customColors: [String: String]?
    let lastModified: Date
    
    static let `default` = ThemeConfiguration(
        appearanceMode: .system,
        customColors: nil,
        lastModified: Date()
    )
}
```

### 2. Color Definitions

```swift
extension Color {
    // Light/Dark adaptive colors
    static let adaptiveBackground = Color("AdaptiveBackground")
    static let adaptiveSurface = Color("AdaptiveSurface")
    static let adaptiveText = Color("AdaptiveText")
    static let adaptiveBorder = Color("AdaptiveBorder")
    
    // Brand colors with dark mode variants
    static let walletBlue = Color("WalletBlue")
    static let walletGreen = Color("WalletGreen")
    static let walletOrange = Color("WalletOrange")
    static let walletRed = Color("WalletRed")
}
```

## Error Handling

### Theme Loading Errors

```swift
enum ThemeError: LocalizedError {
    case invalidConfiguration
    case colorAssetMissing(String)
    case systemIntegrationFailed
    
    var errorDescription: String? {
        switch self {
        case .invalidConfiguration:
            return "Invalid theme configuration"
        case .colorAssetMissing(let colorName):
            return "Missing color asset: \(colorName)"
        case .systemIntegrationFailed:
            return "Failed to integrate with system appearance"
        }
    }
}
```

### Fallback Mechanisms

1. **Color Fallbacks**: If custom colors fail to load, fall back to system colors
2. **Configuration Fallbacks**: If saved configuration is corrupted, use system default
3. **Asset Fallbacks**: If color assets are missing, use hardcoded color values

## Testing Strategy

### 1. Unit Tests

```swift
class ThemeManagerTests: XCTestCase {
    func testAppearanceModeChanges()
    func testSystemAppearanceIntegration()
    func testColorSchemeApplication()
    func testPreferencePersistence()
}

class ColorPaletteTests: XCTestCase {
    func testColorAccessibility()
    func testContrastRatios()
    func testBrandColorConsistency()
}
```

### 2. UI Tests

```swift
class DarkModeUITests: XCTestCase {
    func testWalletViewDarkMode()
    func testTransactionViewDarkMode()
    func testSettingsViewDarkMode()
    func testQRCodeViewsDarkMode()
    func testAppearanceToggling()
}
```

### 3. Accessibility Tests

```swift
class DarkModeAccessibilityTests: XCTestCase {
    func testContrastRatios()
    func testVoiceOverCompatibility()
    func testHighContrastSupport()
}
```

### 4. Performance Tests

```swift
class ThemePerformanceTests: XCTestCase {
    func testAppearanceTransitionPerformance()
    func testColorResolutionPerformance()
    func testMemoryUsage()
}
```

## Implementation Details

### 1. Color Asset Catalog Structure

```
Colors.xcassets/
├── Backgrounds/
│   ├── PrimaryBackground.colorset
│   ├── SecondaryBackground.colorset
│   └── TertiaryBackground.colorset
├── Text/
│   ├── PrimaryText.colorset
│   ├── SecondaryText.colorset
│   └── TertiaryText.colorset
├── Surfaces/
│   ├── PrimarySurface.colorset
│   └── SecondarySurface.colorset
├── Brand/
│   ├── WalletBlue.colorset
│   ├── WalletGreen.colorset
│   ├── WalletOrange.colorset
│   └── WalletRed.colorset
└── Interactive/
    ├── ButtonPrimary.colorset
    ├── ButtonSecondary.colorset
    └── ButtonDestructive.colorset
```

### 2. SwiftUI Environment Integration

```swift
struct ContentView: View {
    @StateObject private var themeManager = ThemeManager()
    
    var body: some View {
        TabView {
            // Tab content
        }
        .environmentObject(themeManager)
        .themed()
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
            themeManager.observeSystemAppearanceChanges()
        }
    }
}
```

### 3. Component Adaptation Strategy

Each UI component will be updated to use semantic colors:

```swift
// Before
.background(Color.white)
.foregroundColor(Color.black)

// After
.background(Color.adaptiveBackground)
.foregroundColor(Color.adaptiveText)
```

### 4. Settings Integration

```swift
struct AppearanceSettingsView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    
    var body: some View {
        Section("Appearance") {
            Picker("Theme", selection: $themeManager.currentAppearanceMode) {
                ForEach(AppearanceMode.allCases, id: \.self) { mode in
                    Label(mode.displayName, systemImage: mode.systemImage)
                        .tag(mode)
                }
            }
            .pickerStyle(.segmented)
        }
    }
}
```

## Migration Strategy

### Phase 1: Foundation
1. Create color asset catalog
2. Implement ThemeManager
3. Add appearance settings

### Phase 2: Core Components
1. Update WalletView
2. Update TransactionView
3. Update SettingsView

### Phase 3: Supporting Components
1. Update QR code views
2. Update custom components
3. Update modal presentations

### Phase 4: Polish and Testing
1. Accessibility testing
2. Performance optimization
3. Edge case handling

## Accessibility Considerations

### 1. Contrast Ratios
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- Interactive elements: 3:1 minimum

### 2. High Contrast Support
- Respect system high contrast settings
- Provide additional contrast when needed
- Maintain visual hierarchy

### 3. VoiceOver Integration
- Ensure all elements remain accessible
- Provide appropriate labels and hints
- Test with VoiceOver enabled

## Performance Considerations

### 1. Color Resolution
- Cache resolved colors
- Minimize color calculations
- Use efficient color representations

### 2. Transition Performance
- Use hardware-accelerated animations
- Batch color updates
- Minimize layout changes

### 3. Memory Management
- Release unused color resources
- Optimize color asset loading
- Monitor memory usage during transitions