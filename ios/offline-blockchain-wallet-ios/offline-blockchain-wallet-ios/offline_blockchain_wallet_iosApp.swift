//
//  offline_blockchain_wallet_iosApp.swift
//  offline-blockchain-wallet-ios
//
//  Created by danny santoso on 7/21/25.
//

import SwiftUI
import CoreData
import BackgroundTasks
import UserNotifications

@main
struct offline_blockchain_wallet_iosApp: App {
    // Initialize dependency container
    let dependencyContainer = DependencyContainer.shared
    
    // Background service coordinator
    private var backgroundServiceCoordinator: BackgroundServiceCoordinatorProtocol {
        return dependencyContainer.getBackgroundServiceCoordinator()
    }
    
    init() {
        // Configure app on launch
        configureApp()
        
        // Register background tasks immediately during app initialization
        // This must happen before the app finishes launching
        setupBackgroundTasks()
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(dependencyContainer.createWalletViewModel())
                .onAppear {
                    // Request notification permissions after app appears
                    Task {
                        await requestNotificationPermissions()
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
                    backgroundServiceCoordinator.handleAppWillEnterForeground()
                }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.didEnterBackgroundNotification)) { _ in
                    backgroundServiceCoordinator.handleAppDidEnterBackground()
                }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.willTerminateNotification)) { _ in
                    backgroundServiceCoordinator.handleAppWillTerminate()
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
        // Initialize all background services
        backgroundServiceCoordinator.initializeBackgroundServices()
        
        // Start background services
        backgroundServiceCoordinator.startAllBackgroundServices()
        
        Logger.shared.info("Background services configured successfully")
    }
    
    private func requestNotificationPermissions() async {
        let granted = await dependencyContainer.getBackgroundTaskManager().requestNotificationPermissions()
        if granted {
            Logger.shared.info("Notification permissions granted")
        } else {
            Logger.shared.warning("Notification permissions denied")
        }
    }
}
