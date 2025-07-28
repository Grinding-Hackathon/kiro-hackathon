//
//  Logger.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation
import os.log

enum LogLevel: String, CaseIterable {
    case debug = "DEBUG"
    case info = "INFO"
    case warning = "WARNING"
    case error = "ERROR"
    case critical = "CRITICAL"
    
    var priority: Int {
        switch self {
        case .debug: return 0
        case .info: return 1
        case .warning: return 2
        case .error: return 3
        case .critical: return 4
        }
    }
}

protocol LoggerProtocol {
    func log(_ message: String, level: LogLevel)
    func debug(_ message: String, file: String, function: String, line: Int)
    func info(_ message: String, file: String, function: String, line: Int)
    func warning(_ message: String, file: String, function: String, line: Int)
    func error(_ message: String, error: Error?, file: String, function: String, line: Int)
    func critical(_ message: String, error: Error?, file: String, function: String, line: Int)
}

class Logger: LoggerProtocol {
    static let shared = Logger()
    
    private let osLog: OSLog
    private let dateFormatter: DateFormatter
    
    private init() {
        self.osLog = OSLog(subsystem: Constants.App.bundleIdentifier, category: "WalletApp")
        self.dateFormatter = DateFormatter()
        self.dateFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss.SSS"
    }
    
    // MARK: - Public Logging Methods
    func log(_ message: String, level: LogLevel) {
        log(level: level, message: message, file: "", function: "", line: 0)
    }
    
    func debug(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(level: .debug, message: message, file: file, function: function, line: line)
    }
    
    func info(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(level: .info, message: message, file: file, function: function, line: line)
    }
    
    func warning(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(level: .warning, message: message, file: file, function: function, line: line)
    }
    
    func error(_ message: String, error: Error? = nil, file: String = #file, function: String = #function, line: Int = #line) {
        var fullMessage = message
        if let error = error {
            fullMessage += " - Error: \(error.localizedDescription)"
        }
        log(level: .error, message: fullMessage, file: file, function: function, line: line)
    }
    
    func critical(_ message: String, error: Error? = nil, file: String = #file, function: String = #function, line: Int = #line) {
        var fullMessage = message
        if let error = error {
            fullMessage += " - Error: \(error.localizedDescription)"
        }
        log(level: .critical, message: fullMessage, file: file, function: function, line: line)
    }
    
    // MARK: - Private Methods
    private func log(level: LogLevel, message: String, file: String, function: String, line: Int) {
        let fileName = URL(fileURLWithPath: file).lastPathComponent
        let timestamp = dateFormatter.string(from: Date())
        let logMessage = "[\(timestamp)] [\(level.rawValue)] [\(fileName):\(line)] \(function) - \(message)"
        
        #if DEBUG
        print(logMessage)
        #endif
        
        // Log to system log
        switch level {
        case .debug:
            os_log("%{public}@", log: osLog, type: .debug, logMessage)
        case .info:
            os_log("%{public}@", log: osLog, type: .info, logMessage)
        case .warning:
            os_log("%{public}@", log: osLog, type: .default, logMessage)
        case .error:
            os_log("%{public}@", log: osLog, type: .error, logMessage)
        case .critical:
            os_log("%{public}@", log: osLog, type: .fault, logMessage)
        }
    }
}

// MARK: - Convenience Extensions
extension Logger {
    func logTransaction(_ transaction: Transaction, action: String) {
        info("Transaction \(action): ID=\(transaction.id), Type=\(transaction.type.rawValue), Amount=\(transaction.amount)")
    }
    
    func logTokenOperation(_ tokenId: String, operation: String, amount: Double? = nil) {
        var message = "Token \(operation): ID=\(tokenId)"
        if let amount = amount {
            message += ", Amount=\(amount)"
        }
        info(message)
    }
    
    func logBluetoothEvent(_ event: String, deviceId: String? = nil) {
        var message = "Bluetooth \(event)"
        if let deviceId = deviceId {
            message += ": Device=\(deviceId)"
        }
        info(message)
    }
    
    func logNetworkRequest(_ endpoint: String, method: String, statusCode: Int? = nil) {
        var message = "Network \(method) \(endpoint)"
        if let statusCode = statusCode {
            message += " - Status: \(statusCode)"
        }
        info(message)
    }
}