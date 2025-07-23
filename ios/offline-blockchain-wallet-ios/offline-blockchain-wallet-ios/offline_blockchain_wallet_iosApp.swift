//
//  offline_blockchain_wallet_iosApp.swift
//  offline-blockchain-wallet-ios
//
//  Created by danny santoso on 7/21/25.
//

import SwiftUI
import CoreData

@main
struct offline_blockchain_wallet_iosApp: App {
    // Initialize dependency container
    let dependencyContainer = DependencyContainer.shared
    
    init() {
        // Configure app on launch
        configureApp()
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(dependencyContainer.createWalletViewModel())
                .onAppear {
                    setupApp()
                }
                .handleWalletErrors()
        }
    }
    
    private func configureApp() {
        // Configure app-wide settings
        configureAppearance()
        
        // Initialize logging
        Logger.shared.info("App launched successfully")
    }
    
    private func setupApp() {
        // Initialize background tasks
        setupBackgroundTasks()
    }
    
    private func configureAppearance() {
        // Configure navigation bar appearance
        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor.systemBackground
        appearance.titleTextAttributes = [.foregroundColor: UIColor.label]
        appearance.largeTitleTextAttributes = [.foregroundColor: UIColor.label]
        
        UINavigationBar.appearance().standardAppearance = appearance
        UINavigationBar.appearance().compactAppearance = appearance
        UINavigationBar.appearance().scrollEdgeAppearance = appearance
        
        // Configure tab bar appearance
        let tabBarAppearance = UITabBarAppearance()
        tabBarAppearance.configureWithOpaqueBackground()
        tabBarAppearance.backgroundColor = UIColor.systemBackground
        
        UITabBar.appearance().standardAppearance = tabBarAppearance
        UITabBar.appearance().scrollEdgeAppearance = tabBarAppearance
    }
    
    private func setupBackgroundTasks() {
        // Background task setup will be implemented in later tasks
        // This includes token expiration monitoring and auto-purchase
    }
}
