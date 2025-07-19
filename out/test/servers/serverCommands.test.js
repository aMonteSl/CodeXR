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
const serverCommands_1 = require("../../servers/commands/serverCommands");
const serverSettingsManager_1 = require("../../servers/storage/serverSettingsManager");
/**
 * Test suite for Server Configuration Commands
 */
suite('Server Configuration Commands Tests', () => {
    let mockContext;
    let settingsManager;
    setup(() => {
        // Create a mock VS Code extension context
        mockContext = {
            globalStorageUri: { fsPath: '/tmp/test-storage' },
            subscriptions: []
        };
        // Initialize settings manager
        settingsManager = serverSettingsManager_1.ServerSettingsManager.getInstance(mockContext);
    });
    teardown(() => {
        // Clean up after each test
        try {
            // Reset the singleton instance for clean tests
            serverSettingsManager_1.ServerSettingsManager.instance = null;
        }
        catch (error) {
            // Ignore cleanup errors
        }
    });
    test('Should reset server configuration to defaults', async () => {
        // First, modify some settings
        await settingsManager.updateServerSettings({
            mode: 'HTTP',
            defaultPort: 8080,
            launch: {
                autoOpen: false,
                openMode: 'lateralPanel'
            }
        });
        // Verify settings were changed
        const modifiedSettings = settingsManager.getServerSettings();
        assert.strictEqual(modifiedSettings.mode, 'HTTP');
        assert.strictEqual(modifiedSettings.defaultPort, 8080);
        assert.strictEqual(modifiedSettings.launch.autoOpen, false);
        assert.strictEqual(modifiedSettings.launch.openMode, 'lateralPanel');
        // Mock user confirmation for reset
        const originalShowWarningMessage = vscode.window.showWarningMessage;
        vscode.window.showWarningMessage = async () => 'Reset to Default';
        try {
            // Execute reset command
            await (0, serverCommands_1.resetToDefault)();
            // Verify settings were reset to defaults
            const resetSettings = settingsManager.getServerSettings();
            assert.strictEqual(resetSettings.mode, serverSettingsManager_1.DEFAULT_SERVER_SETTINGS.mode);
            assert.strictEqual(resetSettings.defaultPort, serverSettingsManager_1.DEFAULT_SERVER_SETTINGS.defaultPort);
            assert.strictEqual(resetSettings.launch.autoOpen, serverSettingsManager_1.DEFAULT_SERVER_SETTINGS.launch.autoOpen);
            assert.strictEqual(resetSettings.launch.openMode, serverSettingsManager_1.DEFAULT_SERVER_SETTINGS.launch.openMode);
            assert.strictEqual(resetSettings.https.certSource, serverSettingsManager_1.DEFAULT_SERVER_SETTINGS.https.certSource);
        }
        finally {
            // Restore original showWarningMessage
            vscode.window.showWarningMessage = originalShowWarningMessage;
        }
    });
    test('Should not reset when user cancels confirmation', async () => {
        // First, modify some settings
        await settingsManager.updateServerSettings({
            mode: 'HTTP',
            defaultPort: 8080
        });
        const modifiedSettings = settingsManager.getServerSettings();
        assert.strictEqual(modifiedSettings.mode, 'HTTP');
        assert.strictEqual(modifiedSettings.defaultPort, 8080);
        // Mock user cancellation
        const originalShowWarningMessage = vscode.window.showWarningMessage;
        vscode.window.showWarningMessage = async () => 'Cancel';
        try {
            // Execute reset command
            await (0, serverCommands_1.resetToDefault)();
            // Verify settings were NOT reset
            const unchangedSettings = settingsManager.getServerSettings();
            assert.strictEqual(unchangedSettings.mode, 'HTTP', 'Settings should remain unchanged when user cancels');
            assert.strictEqual(unchangedSettings.defaultPort, 8080, 'Settings should remain unchanged when user cancels');
        }
        finally {
            // Restore original showWarningMessage
            vscode.window.showWarningMessage = originalShowWarningMessage;
        }
    });
    test('Should handle missing extension context gracefully', async () => {
        // Temporarily clear the extension context
        const originalSetExtensionContext = require('../../servers/commands/serverCommands').setExtensionContext;
        require('../../servers/commands/serverCommands').setExtensionContext(null);
        // Mock user confirmation
        const originalShowWarningMessage = vscode.window.showWarningMessage;
        vscode.window.showWarningMessage = async () => 'Reset to Default';
        const originalShowErrorMessage = vscode.window.showErrorMessage;
        let errorShown = false;
        vscode.window.showErrorMessage = async (message) => {
            errorShown = true;
            assert.ok(message.includes('Extension context not available'));
            return undefined;
        };
        try {
            await (0, serverCommands_1.resetToDefault)();
            assert.ok(errorShown, 'Should show error when extension context is not available');
        }
        finally {
            // Restore original functions
            vscode.window.showWarningMessage = originalShowWarningMessage;
            vscode.window.showErrorMessage = originalShowErrorMessage;
            originalSetExtensionContext(mockContext);
        }
    });
    test('Should refresh tree view after successful reset', async () => {
        let commandExecuted = false;
        const originalExecuteCommand = vscode.commands.executeCommand;
        vscode.commands.executeCommand = async (command) => {
            if (command === 'codexr.servers.refresh') {
                commandExecuted = true;
            }
            return undefined;
        };
        // Mock user confirmation
        const originalShowWarningMessage = vscode.window.showWarningMessage;
        vscode.window.showWarningMessage = async () => 'Reset to Default';
        try {
            await (0, serverCommands_1.resetToDefault)();
            assert.ok(commandExecuted, 'Should execute refresh command after successful reset');
        }
        finally {
            // Restore original functions
            vscode.window.showWarningMessage = originalShowWarningMessage;
            vscode.commands.executeCommand = originalExecuteCommand;
        }
    });
});
//# sourceMappingURL=serverCommands.test.js.map