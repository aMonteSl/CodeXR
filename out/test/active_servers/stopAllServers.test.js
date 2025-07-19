"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
const handleServerActions_1 = require("../../active_servers/views/interactions/handleServerActions");
const activeServerRegistry_1 = require("../../active_servers/registry/activeServerRegistry");
/**
 * Test suite for Stop All Servers functionality
 */
suite('Stop All Servers Tests', () => {
    let registry;
    setup(() => {
        registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        // Clear any existing servers
        const allServers = registry.getAllServers();
        allServers.forEach((server) => {
            registry.unregisterServer(server.id);
        });
    });
    teardown(() => {
        // Clean up after each test
        const allServers = registry.getAllServers();
        allServers.forEach((server) => {
            registry.unregisterServer(server.id);
        });
    });
    test('Should show message when no servers to stop', async () => {
        let messageShown = false;
        const originalShowInformationMessage = vscode.window.showInformationMessage;
        vscode.window.showInformationMessage = async (message) => {
            messageShown = true;
            assert.strictEqual(message, 'No active servers to stop');
            return undefined;
        };
        try {
            await handleServerActions_1.ServerActionHandlers.stopAllServers();
            assert.ok(messageShown, 'Should show information message when no servers to stop');
        }
        finally {
            vscode.window.showInformationMessage = originalShowInformationMessage;
        }
    });
    test('Should prompt for confirmation before stopping servers', async () => {
        // Register test servers
        registry.registerServer({
            port: 3000,
            url: 'http://localhost:3000',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now()
        });
        registry.registerServer({
            port: 3001,
            url: 'http://localhost:3001',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now()
        });
        let confirmationShown = false;
        const originalShowWarningMessage = vscode.window.showWarningMessage;
        vscode.window.showWarningMessage = async (message) => {
            confirmationShown = true;
            assert.ok(message.includes('Stop all 2 active servers?'));
            return 'Cancel'; // User cancels
        };
        try {
            await handleServerActions_1.ServerActionHandlers.stopAllServers();
            assert.ok(confirmationShown, 'Should show confirmation prompt');
            // Verify servers are still registered (not stopped due to cancellation)
            const remainingServers = registry.getAllServers();
            assert.strictEqual(remainingServers.length, 2, 'Servers should remain when user cancels');
        }
        finally {
            vscode.window.showWarningMessage = originalShowWarningMessage;
        }
    });
    test('Should stop all servers when confirmed', async () => {
        // Register test servers
        const server1 = registry.registerServer({
            port: 3000,
            url: 'http://localhost:3000',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now(),
            serverInstance: { stop: async () => { } } // Mock server instance
        });
        const server2 = registry.registerServer({
            port: 3001,
            url: 'http://localhost:3001',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now(),
            serverInstance: { stop: async () => { } } // Mock server instance
        });
        // Mock confirmation
        const originalShowWarningMessage = vscode.window.showWarningMessage;
        vscode.window.showWarningMessage = async () => 'Stop All';
        let progressReported = false;
        const originalWithProgress = vscode.window.withProgress;
        vscode.window.withProgress = async (options, task) => {
            progressReported = true;
            assert.ok(options.title.includes('Stopping servers'));
            // Mock progress reporter
            const progress = {
                report: (value) => {
                    assert.ok(value.message || value.increment);
                }
            };
            return await task(progress);
        };
        let successMessageShown = false;
        const originalShowInformationMessage = vscode.window.showInformationMessage;
        vscode.window.showInformationMessage = async (message) => {
            if (message.includes('successfully stopped')) {
                successMessageShown = true;
            }
            return undefined;
        };
        try {
            await handleServerActions_1.ServerActionHandlers.stopAllServers();
            assert.ok(progressReported, 'Should show progress during stop operation');
            assert.ok(successMessageShown, 'Should show success message after stopping');
            // Verify servers are marked as stopped
            const server1Updated = registry.getServer(server1.id);
            const server2Updated = registry.getServer(server2.id);
            assert.strictEqual(server1Updated?.status, 'stopped', 'Server 1 should be marked as stopped');
            assert.strictEqual(server2Updated?.status, 'stopped', 'Server 2 should be marked as stopped');
        }
        finally {
            vscode.window.showWarningMessage = originalShowWarningMessage;
            vscode.window.withProgress = originalWithProgress;
            vscode.window.showInformationMessage = originalShowInformationMessage;
        }
    });
    test('Should handle errors during server stop gracefully', async () => {
        // Register test server with failing stop method
        const server = registry.registerServer({
            port: 3000,
            url: 'http://localhost:3000',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now(),
            serverInstance: {
                stop: async () => {
                    throw new Error('Stop failed');
                }
            }
        });
        // Mock confirmation
        const originalShowWarningMessage = vscode.window.showWarningMessage;
        vscode.window.showWarningMessage = async () => 'Stop All';
        const originalWithProgress = vscode.window.withProgress;
        vscode.window.withProgress = async (options, task) => {
            const progress = { report: () => { } };
            return await task(progress);
        };
        let errorMessageShown = false;
        const originalShowErrorMessage = vscode.window.showErrorMessage;
        vscode.window.showErrorMessage = async (message) => {
            errorMessageShown = true;
            assert.ok(message.includes('Some servers could not be stopped'));
            return undefined;
        };
        try {
            await handleServerActions_1.ServerActionHandlers.stopAllServers();
            assert.ok(errorMessageShown, 'Should show error message when servers fail to stop');
        }
        finally {
            vscode.window.showWarningMessage = originalShowWarningMessage;
            vscode.window.withProgress = originalWithProgress;
            vscode.window.showErrorMessage = originalShowErrorMessage;
        }
    });
});
//# sourceMappingURL=stopAllServers.test.js.map