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
const unifiedServersTreeView_1 = require("../../servers/views/unifiedServersTreeView");
const activeServerRegistry_1 = require("../../active_servers/registry/activeServerRegistry");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const serverSettingsManager_1 = require("../../servers/storage/serverSettingsManager");
/**
 * Test to verify that active servers are properly displayed in the unified tree view
 */
suite('Active Servers Display Integration Test', () => {
    let treeDataProvider;
    let registry;
    const testStorageDir = path.join(os.tmpdir(), 'codexr-test-storage');
    // Mock VS Code context
    const mockContext = {
        globalStorageUri: {
            fsPath: testStorageDir
        }
    };
    setup(async () => {
        // Initialize ServerSettingsManager with context
        await serverSettingsManager_1.ServerSettingsManager.getInstance(mockContext);
        // Get fresh registry and clean it
        registry = activeServerRegistry_1.ActiveServerRegistry.getInstance();
        const existingServers = registry.getAllServers();
        for (const server of existingServers) {
            registry.unregisterServer(server.id);
        }
        // Initialize tree data provider
        treeDataProvider = new unifiedServersTreeView_1.UnifiedServersTreeDataProvider(mockContext);
    });
    teardown(() => {
        // Clean up registered servers
        const existingServers = registry.getAllServers();
        for (const server of existingServers) {
            registry.unregisterServer(server.id);
        }
    });
    test('Should display individual active servers in ACTIVE SERVERS section', async () => {
        console.log('SERVER: Testing active servers display in unified tree view');
        // Register test servers
        const server1 = registry.registerServer({
            port: 3000,
            url: 'http://localhost:3000',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now(),
            htmlFile: '/test/file1.html',
            metadata: { description: 'Test server 1' }
        });
        const server2 = registry.registerServer({
            port: 3001,
            url: 'https://localhost:3001',
            launchMode: 'lateralPanel',
            certMode: 'https-default',
            timestamp: Date.now(),
            htmlFile: '/test/file2.html',
            metadata: { description: 'Test server 2' }
        });
        // Verify servers are registered
        const allServers = registry.getAllServers();
        assert.strictEqual(allServers.length, 2, 'Should have two registered servers');
        // Get root sections
        const rootChildren = await treeDataProvider.getChildren();
        assert.strictEqual(rootChildren.length, 2, 'Should have SERVERS and ACTIVE SERVERS sections');
        // Find Active Servers section
        const activeServersSection = rootChildren.find(item => item.label.startsWith('ACTIVE SERVERS'));
        assert.ok(activeServersSection, 'Should have ACTIVE SERVERS section');
        assert.strictEqual(activeServersSection.label, 'ACTIVE SERVERS (2 running)', 'Should show correct count');
        // Get children of Active Servers section
        const activeServersChildren = await treeDataProvider.getChildren(activeServersSection);
        console.log(`SERVER: Active servers children count: ${activeServersChildren.length}`);
        console.log('SERVER: Active servers children:', activeServersChildren.map(child => child.label));
        // Should have: Stop All Servers + 2 server items = 3 children
        assert.strictEqual(activeServersChildren.length, 3, 'Should have Stop All Servers option plus 2 server items');
        // Verify Stop All Servers option
        const stopAllOption = activeServersChildren.find(item => item.label === 'Stop All Servers');
        assert.ok(stopAllOption, 'Should have "Stop All Servers" option');
        // Verify individual server items
        const serverItems = activeServersChildren.filter(item => item.label.startsWith('localhost:'));
        assert.strictEqual(serverItems.length, 2, 'Should have 2 individual server items');
        // Verify server details
        const server1Item = serverItems.find(item => item.label === 'localhost:3000');
        const server2Item = serverItems.find(item => item.label === 'localhost:3001');
        assert.ok(server1Item, 'Should have localhost:3000 server item');
        assert.ok(server2Item, 'Should have localhost:3001 server item');
        // Verify server item properties
        assert.strictEqual(server1Item.description, 'Browser', 'Server 1 should show Browser mode');
        assert.strictEqual(server2Item.description, 'Panel', 'Server 2 should show Panel mode');
        assert.strictEqual(server1Item.contextValue, 'activeServer', 'Server 1 should have activeServer context');
        assert.strictEqual(server2Item.contextValue, 'activeServer', 'Server 2 should have activeServer context');
        // Verify commands are set
        assert.ok(server1Item.command, 'Server 1 should have a command');
        assert.ok(server2Item.command, 'Server 2 should have a command');
        assert.strictEqual(server1Item.command.command, 'codeXR.activeServers.showDetails');
        assert.strictEqual(server2Item.command.command, 'codeXR.activeServers.showDetails');
        console.log('SERVER: ✅ Active servers are properly displayed in unified tree view!');
    });
    test('Should show "No active servers" when no servers running', async () => {
        // Ensure no servers are registered
        const allServers = registry.getAllServers();
        assert.strictEqual(allServers.length, 0, 'Should start with no servers');
        // Get root sections
        const rootChildren = await treeDataProvider.getChildren();
        const activeServersSection = rootChildren.find(item => item.label.startsWith('ACTIVE SERVERS'));
        assert.ok(activeServersSection, 'Should have ACTIVE SERVERS section');
        assert.strictEqual(activeServersSection.label, 'ACTIVE SERVERS', 'Should show basic title when no servers');
        // Get children of Active Servers section
        const activeServersChildren = await treeDataProvider.getChildren(activeServersSection);
        assert.strictEqual(activeServersChildren.length, 1, 'Should have one child (no servers message)');
        assert.strictEqual(activeServersChildren[0].label, 'No active servers', 'Should show no servers message');
    });
    test('Should update tree view when servers are added and removed', async () => {
        // Start with no servers
        let rootChildren = await treeDataProvider.getChildren();
        let activeServersSection = rootChildren.find(item => item.label.startsWith('ACTIVE SERVERS'));
        let activeServersChildren = await treeDataProvider.getChildren(activeServersSection);
        assert.strictEqual(activeServersChildren.length, 1, 'Should start with no servers message');
        assert.strictEqual(activeServersChildren[0].label, 'No active servers');
        // Register a server
        const server = registry.registerServer({
            port: 3000,
            url: 'http://localhost:3000',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now()
        });
        // Check updated tree view
        rootChildren = await treeDataProvider.getChildren();
        activeServersSection = rootChildren.find(item => item.label.startsWith('ACTIVE SERVERS'));
        activeServersChildren = await treeDataProvider.getChildren(activeServersSection);
        assert.strictEqual(activeServersChildren.length, 1, 'Should have one server item');
        assert.strictEqual(activeServersChildren[0].label, 'localhost:3000');
        // Remove the server
        registry.unregisterServer(server.id);
        // Check tree view returns to empty state
        rootChildren = await treeDataProvider.getChildren();
        activeServersSection = rootChildren.find(item => item.label.startsWith('ACTIVE SERVERS'));
        activeServersChildren = await treeDataProvider.getChildren(activeServersSection);
        assert.strictEqual(activeServersChildren.length, 1, 'Should return to no servers message');
        assert.strictEqual(activeServersChildren[0].label, 'No active servers');
    });
});
//# sourceMappingURL=activeServersDisplayIntegration.test.js.map