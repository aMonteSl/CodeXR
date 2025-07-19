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
const activeServersTreeView_1 = require("../../active_servers/views/activeServersTreeView");
const serverItems_1 = require("../../active_servers/views/items/serverItems");
const activeServerRegistry_1 = require("../../active_servers/registry/activeServerRegistry");
suite('Active Servers Tree View Tests', () => {
    let treeDataProvider;
    let registry;
    setup(() => {
        registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        // Clear any existing servers
        const allServers = registry.getAllServers();
        allServers.forEach((server) => {
            registry.unregisterServer(server.id);
        });
        treeDataProvider = new activeServersTreeView_1.ActiveServersTreeDataProvider();
    });
    teardown(() => {
        // Clean up after each test
        const allServers = registry.getAllServers();
        allServers.forEach((server) => {
            registry.unregisterServer(server.id);
        });
    });
    test('Should create tree data provider', () => {
        assert.ok(treeDataProvider);
        assert.ok(typeof treeDataProvider.getTreeItem === 'function');
        assert.ok(typeof treeDataProvider.getChildren === 'function');
    });
    test('Should return empty children when no servers', async () => {
        const children = await treeDataProvider.getChildren();
        assert.ok(Array.isArray(children));
        assert.strictEqual(children.length, 0);
    });
    test('Should return server items when servers exist', async () => {
        // Register a test server
        const config = {
            port: 5000,
            url: 'http://localhost:5000',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now(),
            htmlFile: 'test.html'
        };
        (0, activeServerRegistry_1.registerActiveServer)(config);
        const children = await treeDataProvider.getChildren();
        assert.strictEqual(children.length, 1);
        // Check tree item properties
        const treeItem = treeDataProvider.getTreeItem(children[0]);
        assert.ok(treeItem.label);
        assert.ok(treeItem.tooltip);
        assert.strictEqual(treeItem.contextValue, 'activeServer');
    });
    test('Should handle multiple servers', async () => {
        // Register multiple test servers
        const configs = [
            {
                port: 5001,
                url: 'http://localhost:5001',
                launchMode: 'browser',
                certMode: 'http',
                timestamp: Date.now()
            },
            {
                port: 5002,
                url: 'https://localhost:5002',
                launchMode: 'lateralPanel',
                certMode: 'https-default',
                timestamp: Date.now()
            }
        ];
        configs.forEach(config => (0, activeServerRegistry_1.registerActiveServer)(config));
        const children = await treeDataProvider.getChildren();
        assert.strictEqual(children.length, 2);
    });
    test('ServerItemFactory should create correct tree items', () => {
        const mockServer = {
            id: 'test-server-123',
            port: 5003,
            url: 'http://localhost:5003',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now() - 60000, // 1 minute ago
            status: 'running',
            htmlFile: 'index.html',
            metadata: {
                host: 'localhost',
                description: 'Test server'
            }
        };
        const treeItem = serverItems_1.ServerItemFactory.createServerItem(mockServer);
        assert.ok(treeItem.label);
        assert.ok(treeItem.tooltip);
        assert.strictEqual(treeItem.contextValue, 'activeServer');
        assert.strictEqual(treeItem.collapsibleState, vscode.TreeItemCollapsibleState.None);
        // Check that label includes port
        assert.ok(treeItem.label?.toString().includes('5003'));
    });
    test('Should use correct icons for different cert modes', () => {
        const httpServer = {
            id: 'http-server',
            port: 5004,
            url: 'http://localhost:5004',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now(),
            status: 'running'
        };
        const httpsServer = {
            id: 'https-server',
            port: 5005,
            url: 'https://localhost:5005',
            launchMode: 'browser',
            certMode: 'https-default',
            timestamp: Date.now(),
            status: 'running'
        };
        const httpItem = serverItems_1.ServerItemFactory.createServerItem(httpServer);
        const httpsItem = serverItems_1.ServerItemFactory.createServerItem(httpsServer);
        // HTTP should use browser icon, HTTPS should use shield icon
        assert.notStrictEqual(httpItem.iconPath, httpsItem.iconPath);
    });
    test('Should include uptime in tooltip', () => {
        const server = {
            id: 'uptime-test',
            port: 5006,
            url: 'http://localhost:5006',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now() - 120000, // 2 minutes ago
            status: 'running'
        };
        const treeItem = serverItems_1.ServerItemFactory.createServerItem(server);
        assert.ok(treeItem.tooltip);
        const tooltip = treeItem.tooltip;
        assert.ok(tooltip.includes('Uptime:'));
        assert.ok(tooltip.includes('2m') || tooltip.includes('min'));
    });
    test('Should handle stopped servers differently', () => {
        const runningServer = {
            id: 'running-server',
            port: 5007,
            url: 'http://localhost:5007',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now(),
            status: 'running'
        };
        const stoppedServer = {
            id: 'stopped-server',
            port: 5008,
            url: 'http://localhost:5008',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now(),
            status: 'stopped'
        };
        const runningItem = serverItems_1.ServerItemFactory.createServerItem(runningServer);
        const stoppedItem = serverItems_1.ServerItemFactory.createServerItem(stoppedServer);
        // Items should be different for running vs stopped servers
        assert.notStrictEqual(runningItem.iconPath, stoppedItem.iconPath);
        // Tooltips should indicate status
        const runningTooltip = runningItem.tooltip;
        const stoppedTooltip = stoppedItem.tooltip;
        assert.ok(runningTooltip.includes('running'));
        assert.ok(stoppedTooltip.includes('stopped'));
    });
});
//# sourceMappingURL=activeServersTreeView.test.js.map