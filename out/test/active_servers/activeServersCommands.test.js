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
const activeServersCommands_1 = require("../../active_servers/commands/activeServersCommands");
suite('Active Servers Commands Tests', () => {
    test('Should get correct command IDs', () => {
        const commandIds = activeServersCommands_1.ActiveServersCommands.getCommandIds();
        // Check that all expected commands are present
        const expectedCommands = [
            'showActions',
            'openInBrowser',
            'openInPanel',
            'copyUrl',
            'stopServer',
            'showDetails',
            'stopAllServers',
            'refreshServers',
            'openView'
        ];
        expectedCommands.forEach(cmd => {
            assert.ok(commandIds[cmd], `Command ${cmd} should be present in command IDs`);
            assert.ok(commandIds[cmd].startsWith('codeXR.activeServers.'), `Command ${cmd} should have correct prefix`);
        });
        // Check specific command IDs
        assert.strictEqual(commandIds.showActions, 'codeXR.activeServers.showActions');
        assert.strictEqual(commandIds.openInBrowser, 'codeXR.activeServers.openInBrowser');
        assert.strictEqual(commandIds.openInPanel, 'codeXR.activeServers.openInPanel');
        assert.strictEqual(commandIds.copyUrl, 'codeXR.activeServers.copyUrl');
        assert.strictEqual(commandIds.stopServer, 'codeXR.activeServers.stopServer');
        assert.strictEqual(commandIds.showDetails, 'codeXR.activeServers.showDetails');
        assert.strictEqual(commandIds.stopAllServers, 'codeXR.activeServers.stopAllServers');
        assert.strictEqual(commandIds.refreshServers, 'codeXR.activeServers.refreshServers');
        assert.strictEqual(commandIds.openView, 'codeXR.activeServers.openView');
    });
    test('Should have 9 commands total', () => {
        const commandIds = activeServersCommands_1.ActiveServersCommands.getCommandIds();
        const commandCount = Object.keys(commandIds).length;
        assert.strictEqual(commandCount, 9, 'Should have exactly 9 commands');
    });
    test('Command IDs should be unique', () => {
        const commandIds = activeServersCommands_1.ActiveServersCommands.getCommandIds();
        const values = Object.values(commandIds);
        const uniqueValues = [...new Set(values)];
        assert.strictEqual(values.length, uniqueValues.length, 'All command IDs should be unique');
    });
    test('All command IDs should follow naming convention', () => {
        const commandIds = activeServersCommands_1.ActiveServersCommands.getCommandIds();
        const prefix = 'codeXR.activeServers.';
        Object.values(commandIds).forEach(commandId => {
            assert.ok(commandId.startsWith(prefix), `Command ID ${commandId} should start with ${prefix}`);
            // Should not have double dots or end with dot
            assert.ok(!commandId.includes('..'), `Command ID ${commandId} should not have double dots`);
            assert.ok(!commandId.endsWith('.'), `Command ID ${commandId} should not end with dot`);
        });
    });
    test('Command registration should not throw errors', () => {
        // Create a mock extension context
        const mockContext = {
            subscriptions: [],
            workspaceState: {},
            globalState: {},
            extensionUri: {},
            extensionPath: '',
            asAbsolutePath: (relativePath) => relativePath,
            storageUri: undefined,
            storagePath: undefined,
            globalStorageUri: {},
            globalStoragePath: '',
            logUri: {},
            logPath: '',
            secrets: {},
            environmentVariableCollection: {},
            extension: {},
            extensionMode: vscode.ExtensionMode.Test,
            languageModelAccessInformation: {}
        };
        // This should not throw any errors
        assert.doesNotThrow(() => {
            activeServersCommands_1.ActiveServersCommands.registerCommands(mockContext);
        }, 'Command registration should not throw errors');
        // Should have added commands to subscriptions
        assert.ok(mockContext.subscriptions.length > 0, 'Should have added commands to context subscriptions');
        assert.strictEqual(mockContext.subscriptions.length, 9, 'Should have added exactly 9 commands to subscriptions');
    });
});
//# sourceMappingURL=activeServersCommands.test.js.map