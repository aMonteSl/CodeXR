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
const handleServerActions_1 = require("../../active_servers/views/interactions/handleServerActions");
const serverItems_1 = require("../../active_servers/views/items/serverItems");
suite('Enhanced Context Menu Tests', () => {
    let mockContext;
    suiteSetup(() => {
        // Create a mock extension context for testing
        mockContext = {
            subscriptions: [],
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => []
            },
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                setKeysForSync: () => { },
                keys: () => []
            },
            extensionPath: '/mock/path',
            extensionUri: vscode.Uri.file('/mock/path'),
            storagePath: '/mock/storage',
            globalStorageUri: vscode.Uri.file('/mock/global-storage'),
            logUri: vscode.Uri.file('/mock/log'),
            extensionMode: vscode.ExtensionMode.Test,
            globalStoragePath: '/mock/global-storage',
            secrets: {},
            environmentVariableCollection: {},
            asAbsolutePath: (relativePath) => `/mock/path/${relativePath}`,
            storageUri: vscode.Uri.file('/mock/storage'),
            logPath: '/mock/log',
            extension: {
                id: 'mock.extension',
                extensionUri: vscode.Uri.file('/mock/path'),
                extensionPath: '/mock/path',
                isActive: true,
                packageJSON: {},
                exports: undefined,
                activate: () => Promise.resolve(),
                extensionKind: vscode.ExtensionKind.Workspace
            },
            languageModelAccessInformation: {
                onDidChange: new vscode.EventEmitter().event,
                canSendRequest: () => undefined
            }
        };
    });
    suite('Context Value Assignment', () => {
        test('HTTP server gets activeServerHttp context value', () => {
            console.log('ACTIVE_SERVER: Testing HTTP server context value assignment');
            const httpServer = {
                id: 'test-http-1',
                port: 3000,
                url: 'http://localhost:3000',
                launchMode: 'browser',
                certMode: 'http',
                timestamp: Date.now(),
                status: 'running'
            };
            const treeItem = serverItems_1.ServerItemFactory.createServerItem(httpServer);
            console.log(`ACTIVE_SERVER: HTTP server context value: ${treeItem.contextValue}`);
            assert.strictEqual(treeItem.contextValue, 'activeServerHttp');
        });
        test('HTTPS server gets activeServerHttps context value', () => {
            console.log('ACTIVE_SERVER: Testing HTTPS server context value assignment');
            const httpsServer = {
                id: 'test-https-1',
                port: 3001,
                url: 'https://localhost:3001',
                launchMode: 'browser',
                certMode: 'https-default',
                timestamp: Date.now(),
                status: 'running'
            };
            const treeItem = serverItems_1.ServerItemFactory.createServerItem(httpsServer);
            console.log(`ACTIVE_SERVER: HTTPS server context value: ${treeItem.contextValue}`);
            assert.strictEqual(treeItem.contextValue, 'activeServerHttps');
        });
        test('HTTPS custom server gets activeServerHttps context value', () => {
            console.log('ACTIVE_SERVER: Testing HTTPS custom server context value assignment');
            const httpsCustomServer = {
                id: 'test-https-custom-1',
                port: 3002,
                url: 'https://localhost:3002',
                launchMode: 'browser',
                certMode: 'https-custom',
                timestamp: Date.now(),
                status: 'running'
            };
            const treeItem = serverItems_1.ServerItemFactory.createServerItem(httpsCustomServer);
            console.log(`ACTIVE_SERVER: HTTPS custom server context value: ${treeItem.contextValue}`);
            assert.strictEqual(treeItem.contextValue, 'activeServerHttps');
        });
    });
    suite('Context Menu Actions', () => {
        test('HTTP server actions include lateral panel option', () => {
            console.log('ACTIVE_SERVER: Testing HTTP server available actions');
            const httpServer = {
                id: 'test-http-2',
                port: 3003,
                url: 'http://localhost:3003',
                launchMode: 'browser',
                certMode: 'http',
                timestamp: Date.now(),
                status: 'running'
            };
            // Use reflection to access private method for testing
            const actions = handleServerActions_1.ServerActionHandlers.getAvailableActions(httpServer);
            const actionLabels = actions.map((action) => action.label);
            console.log(`ACTIVE_SERVER: HTTP server actions: ${actionLabels.join(', ')}`);
            assert.ok(actionLabels.includes('🌐 Open in Browser'));
            assert.ok(actionLabels.includes('📱 Open in Panel'));
            assert.ok(actionLabels.includes('📋 Copy URL'));
            assert.ok(actionLabels.includes('ℹ️ Server Info'));
            assert.ok(actionLabels.includes('⏹️ Stop Server'));
        });
        test('HTTPS server actions exclude lateral panel option', () => {
            console.log('ACTIVE_SERVER: Testing HTTPS server available actions');
            const httpsServer = {
                id: 'test-https-2',
                port: 3004,
                url: 'https://localhost:3004',
                launchMode: 'browser',
                certMode: 'https-default',
                timestamp: Date.now(),
                status: 'running'
            };
            // Use reflection to access private method for testing
            const actions = handleServerActions_1.ServerActionHandlers.getAvailableActions(httpsServer);
            const actionLabels = actions.map((action) => action.label);
            console.log(`ACTIVE_SERVER: HTTPS server actions: ${actionLabels.join(', ')}`);
            assert.ok(actionLabels.includes('🌐 Open in Browser'));
            assert.ok(!actionLabels.includes('📱 Open in Panel')); // Should NOT include panel option
            assert.ok(actionLabels.includes('📋 Copy URL'));
            assert.ok(actionLabels.includes('ℹ️ Server Info'));
            assert.ok(actionLabels.includes('⏹️ Stop Server'));
        });
    });
    suite('Command Registration', () => {
        test('Commands are registered correctly', () => {
            console.log('ACTIVE_SERVER: Testing command registration');
            const initialSubscriptionCount = mockContext.subscriptions.length;
            activeServersCommands_1.ActiveServersCommands.registerCommands(mockContext);
            const finalSubscriptionCount = mockContext.subscriptions.length;
            const commandsRegistered = finalSubscriptionCount - initialSubscriptionCount;
            console.log(`ACTIVE_SERVER: Registered ${commandsRegistered} commands`);
            assert.strictEqual(commandsRegistered, 9);
        });
        test('Command IDs are accessible', () => {
            console.log('ACTIVE_SERVER: Testing command ID accessibility');
            const commandIds = activeServersCommands_1.ActiveServersCommands.getCommandIds();
            console.log(`ACTIVE_SERVER: Available command IDs: ${Object.keys(commandIds).join(', ')}`);
            assert.ok(commandIds.openInBrowser);
            assert.ok(commandIds.openInPanel);
            assert.ok(commandIds.showDetails);
            assert.ok(commandIds.stopServer);
            assert.strictEqual(commandIds.openInBrowser, 'codeXR.activeServers.openInBrowser');
            assert.strictEqual(commandIds.openInPanel, 'codeXR.activeServers.openInPanel');
        });
    });
    suite('Package.json Menu Configuration', () => {
        test('Menu configuration matches implementation expectations', () => {
            console.log('ACTIVE_SERVER: Testing menu configuration expectations');
            // These are the expected context values that should be used in package.json
            const expectedHttpContextValue = 'activeServerHttp';
            const expectedHttpsContextValue = 'activeServerHttps';
            // Verify our implementation produces these values
            const httpServer = {
                id: 'test-context-http',
                port: 3005,
                url: 'http://localhost:3005',
                launchMode: 'browser',
                certMode: 'http',
                timestamp: Date.now(),
                status: 'running'
            };
            const httpsServer = {
                id: 'test-context-https',
                port: 3006,
                url: 'https://localhost:3006',
                launchMode: 'browser',
                certMode: 'https-default',
                timestamp: Date.now(),
                status: 'running'
            };
            const httpTreeItem = serverItems_1.ServerItemFactory.createServerItem(httpServer);
            const httpsTreeItem = serverItems_1.ServerItemFactory.createServerItem(httpsServer);
            console.log(`ACTIVE_SERVER: HTTP context value: ${httpTreeItem.contextValue}`);
            console.log(`ACTIVE_SERVER: HTTPS context value: ${httpsTreeItem.contextValue}`);
            assert.strictEqual(httpTreeItem.contextValue, expectedHttpContextValue);
            assert.strictEqual(httpsTreeItem.contextValue, expectedHttpsContextValue);
        });
    });
});
//# sourceMappingURL=enhancedContextMenu.test.js.map