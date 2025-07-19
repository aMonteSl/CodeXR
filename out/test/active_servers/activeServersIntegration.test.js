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
const unifiedServersTreeView_1 = require("../../servers/views/unifiedServersTreeView");
const activeServerRegistry_1 = require("../../active_servers/registry/activeServerRegistry");
/**
 * Integration tests for Active Servers functionality with the unified tree view
 */
suite('Active Servers Integration Tests', () => {
    let treeDataProvider;
    let registry;
    const mockContext = {
        subscriptions: [],
        workspaceState: {
            get: () => undefined,
            update: () => Promise.resolve()
        },
        globalState: {
            get: () => undefined,
            update: () => Promise.resolve()
        },
        extensionPath: '/mock/path',
        asAbsolutePath: (path) => `/mock/path/${path}`
    };
    setup(() => {
        // Create tree data provider without registering commands to avoid conflicts
        treeDataProvider = new unifiedServersTreeView_1.UnifiedServersTreeDataProvider(mockContext);
        registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        // Clean up any existing servers
        try {
            registry.cleanupInactiveServers();
        }
        catch (error) {
            // Ignore cleanup errors in test setup
        }
    });
    teardown(() => {
        // Clean up after each test
        try {
            registry.cleanupInactiveServers();
        }
        catch (error) {
            // Ignore cleanup errors in test teardown
        }
    });
    test('Should show "No active servers" when no servers are running', async () => {
        const children = await treeDataProvider.getChildren();
        const activeServersSection = children.find(child => child.label === 'ACTIVE SERVERS');
        assert.ok(activeServersSection, 'Should have ACTIVE SERVERS section');
        const activeServerChildren = await treeDataProvider.getChildren(activeServersSection);
        assert.strictEqual(activeServerChildren.length, 1, 'Should have one child');
        assert.strictEqual(activeServerChildren[0].label, 'No active servers', 'Should show no active servers message');
    });
    test('Should dynamically list active servers', async () => {
        // Register a test server
        const testServer = (0, activeServerRegistry_1.registerActiveServer)({
            port: 3000,
            url: 'http://localhost:3000',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now(),
            metadata: { description: 'Test server' }
        });
        const children = await treeDataProvider.getChildren();
        const activeServersSection = children.find(child => child.label === 'ACTIVE SERVERS');
        assert.ok(activeServersSection, 'Should have ACTIVE SERVERS section');
        const activeServerChildren = await treeDataProvider.getChildren(activeServersSection);
        assert.strictEqual(activeServerChildren.length, 1, 'Should have one server');
        assert.ok(activeServerChildren[0].label.includes('localhost:3000'), 'Should show server URL');
        assert.strictEqual(activeServerChildren[0].contextValue, 'activeServer', 'Should have correct context value');
    });
    test('Should show multiple active servers', async () => {
        // Register multiple test servers
        const server1 = (0, activeServerRegistry_1.registerActiveServer)({
            port: 3000,
            url: 'http://localhost:3000',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now(),
            metadata: { description: 'Test server 1' }
        });
        const server2 = (0, activeServerRegistry_1.registerActiveServer)({
            port: 3001,
            url: 'https://localhost:3001',
            launchMode: 'lateralPanel',
            certMode: 'https-default',
            timestamp: Date.now(),
            metadata: { description: 'Test server 2' }
        });
        const children = await treeDataProvider.getChildren();
        const activeServersSection = children.find(child => child.label === 'ACTIVE SERVERS');
        assert.ok(activeServersSection, 'Should have ACTIVE SERVERS section');
        const activeServerChildren = await treeDataProvider.getChildren(activeServersSection);
        assert.strictEqual(activeServerChildren.length, 2, 'Should have two servers');
        const serverLabels = activeServerChildren.map(child => child.label);
        assert.ok(serverLabels.some(label => label.includes('localhost:3000')), 'Should show first server');
        assert.ok(serverLabels.some(label => label.includes('localhost:3001')), 'Should show second server');
    });
    test('Should have clickable servers with commands', async () => {
        // Register a test server
        const testServer = (0, activeServerRegistry_1.registerActiveServer)({
            port: 3000,
            url: 'http://localhost:3000',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now(),
            metadata: { description: 'Test server' }
        });
        const children = await treeDataProvider.getChildren();
        const activeServersSection = children.find(child => child.label === 'ACTIVE SERVERS');
        const activeServerChildren = await treeDataProvider.getChildren(activeServersSection);
        const serverItem = activeServerChildren[0];
        assert.ok(serverItem.command, 'Server item should have a command');
        assert.strictEqual(serverItem.command.command, 'codeXR.activeServers.showActions', 'Should use showActions command');
        assert.ok(Array.isArray(serverItem.command.arguments), 'Should have command arguments');
        assert.strictEqual(serverItem.command.arguments.length, 1, 'Should have server ID as argument');
    });
    test('Should refresh when registry changes', async () => {
        let refreshCalled = false;
        // Mock the refresh method to track calls
        const originalRefresh = treeDataProvider.refresh;
        treeDataProvider.refresh = () => {
            refreshCalled = true;
            originalRefresh.call(treeDataProvider);
        };
        // Register a server, which should trigger a refresh
        const testServer = (0, activeServerRegistry_1.registerActiveServer)({
            port: 3000,
            url: 'http://localhost:3000',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now(),
            metadata: { description: 'Test server' }
        });
        // Allow event propagation
        await new Promise(resolve => setTimeout(resolve, 10));
        assert.ok(refreshCalled, 'Tree view should refresh when server is registered');
        // Restore original method
        treeDataProvider.refresh = originalRefresh;
    });
    test('Should have correct tree structure hierarchy', async () => {
        const children = await treeDataProvider.getChildren();
        // Should have exactly 2 top-level sections
        assert.strictEqual(children.length, 2, 'Should have 2 root sections');
        const serversSection = children.find(child => child.label === 'SERVERS');
        const activeServersSection = children.find(child => child.label === 'ACTIVE SERVERS');
        assert.ok(serversSection, 'Should have SERVERS section');
        assert.ok(activeServersSection, 'Should have ACTIVE SERVERS section');
        // Verify section types
        assert.strictEqual(serversSection.type, 'section', 'SERVERS should be section type');
        assert.strictEqual(activeServersSection.type, 'section', 'ACTIVE SERVERS should be section type');
        // Verify collapsible states
        assert.strictEqual(serversSection.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
        assert.strictEqual(activeServersSection.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
    });
});
//# sourceMappingURL=activeServersIntegration.test.js.map