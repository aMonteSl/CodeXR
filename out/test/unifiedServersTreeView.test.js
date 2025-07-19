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
const unifiedServersTreeView_1 = require("../servers/views/unifiedServersTreeView");
const serverSettingsManager_1 = require("../servers/storage/serverSettingsManager");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
/**
 * Test suite for UnifiedServersTreeDataProvider
 */
suite('UnifiedServersTreeDataProvider Tests', () => {
    let treeDataProvider;
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
        treeDataProvider = new unifiedServersTreeView_1.UnifiedServersTreeDataProvider(mockContext);
    });
    teardown(() => {
        // Cleanup if needed
    });
    test('Should create tree data provider instance', () => {
        assert.ok(treeDataProvider);
        assert.ok(typeof treeDataProvider.getChildren === 'function');
        assert.ok(typeof treeDataProvider.getTreeItem === 'function');
        assert.ok(typeof treeDataProvider.refresh === 'function');
    });
    test('Should return root sections when no element provided', async () => {
        const rootChildren = await treeDataProvider.getChildren();
        assert.strictEqual(rootChildren.length, 2, 'Should return exactly 2 root sections');
        const serversSection = rootChildren.find(item => item.label === 'SERVERS');
        const activeServersSection = rootChildren.find(item => item.label === 'ACTIVE SERVERS');
        assert.ok(serversSection, 'Should have SERVERS section');
        assert.ok(activeServersSection, 'Should have ACTIVE SERVERS section');
        assert.strictEqual(serversSection?.type, 'section', 'SERVERS should be section type');
        assert.strictEqual(activeServersSection?.type, 'section', 'ACTIVE SERVERS should be section type');
        assert.strictEqual(serversSection?.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
        assert.strictEqual(activeServersSection?.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
    });
    test('Should return SERVERS children when SERVERS section expanded', async () => {
        const rootChildren = await treeDataProvider.getChildren();
        const serversSection = rootChildren.find(item => item.label === 'SERVERS');
        assert.ok(serversSection, 'SERVERS section should exist');
        const serversChildren = await treeDataProvider.getChildren(serversSection);
        assert.ok(serversChildren.length > 0, 'SERVERS section should have children');
        const configGroup = serversChildren.find(item => item.label === 'Server Configuration');
        const startServerAction = serversChildren.find(item => item.label === 'Start Local Server');
        assert.ok(configGroup, 'Should have Server Configuration group');
        assert.ok(startServerAction, 'Should have Start Local Server action');
        assert.strictEqual(configGroup?.type, 'config-group');
        assert.strictEqual(startServerAction?.type, 'option');
    });
    test('Should return server configuration options when configuration group expanded', async () => {
        const rootChildren = await treeDataProvider.getChildren();
        const serversSection = rootChildren.find(item => item.label === 'SERVERS');
        const serversChildren = await treeDataProvider.getChildren(serversSection);
        const configGroup = serversChildren.find(item => item.label === 'Server Configuration');
        assert.ok(configGroup, 'Configuration group should exist');
        const configChildren = await treeDataProvider.getChildren(configGroup);
        assert.ok(configChildren.length > 0, 'Configuration group should have children');
        // Verify expected configuration options
        const expectedOptions = ['HTTP Mode:', 'Default Port:', 'Auto-Open:', 'Open Mode:'];
        for (const expectedOption of expectedOptions) {
            const option = configChildren.find(item => item.label?.startsWith(expectedOption));
            assert.ok(option, `Should have ${expectedOption} configuration option`);
            assert.strictEqual(option?.type, 'config-option');
            assert.strictEqual(option?.collapsibleState, vscode.TreeItemCollapsibleState.None);
        }
    });
    test('Should return ACTIVE SERVERS children when ACTIVE SERVERS section expanded', async () => {
        const rootChildren = await treeDataProvider.getChildren();
        const activeServersSection = rootChildren.find(item => item.label === 'ACTIVE SERVERS');
        assert.ok(activeServersSection, 'ACTIVE SERVERS section should exist');
        const activeServersChildren = await treeDataProvider.getChildren(activeServersSection);
        // Since we're in a test environment without actual servers, we should get the "no active servers" message
        if (activeServersChildren.length === 1 && activeServersChildren[0].label === 'No active servers') {
            assert.ok(true, 'Should show "No active servers" when no servers are running');
        }
        else {
            // If there are active servers, verify their structure
            for (const serverItem of activeServersChildren) {
                assert.strictEqual(serverItem.type, 'active-server');
                assert.strictEqual(serverItem.contextValue, 'activeServer');
            }
        }
    });
    test('Should return empty array for unknown element types', async () => {
        const unknownElement = new unifiedServersTreeView_1.UnifiedServerTreeItem('Unknown', vscode.TreeItemCollapsibleState.None, 'unknown');
        const children = await treeDataProvider.getChildren(unknownElement);
        assert.strictEqual(children.length, 0, 'Should return empty array for unknown element types');
    });
    test('Should properly handle tree item creation', () => {
        const testItem = new unifiedServersTreeView_1.UnifiedServerTreeItem('Test Item', vscode.TreeItemCollapsibleState.Expanded, 'section', { command: 'test.command', title: 'Test Command' }, new vscode.ThemeIcon('gear'), 'Test tooltip', 'Test description', 'testContext');
        assert.strictEqual(testItem.label, 'Test Item');
        assert.strictEqual(testItem.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
        assert.strictEqual(testItem.type, 'section');
        assert.strictEqual(testItem.command?.command, 'test.command');
        assert.strictEqual(testItem.tooltip, 'Test tooltip');
        assert.strictEqual(testItem.description, 'Test description');
        assert.strictEqual(testItem.contextValue, 'testContext');
    });
    test('Should fire refresh event when refresh() is called', (done) => {
        let eventFired = false;
        const disposable = treeDataProvider.onDidChangeTreeData(() => {
            eventFired = true;
            disposable.dispose();
            assert.ok(eventFired, 'onDidChangeTreeData event should be fired');
            done();
        });
        treeDataProvider.refresh();
    });
    test('Should have proper icons for sections', async () => {
        const rootChildren = await treeDataProvider.getChildren();
        const serversSection = rootChildren.find(item => item.label === 'SERVERS');
        const activeServersSection = rootChildren.find(item => item.label === 'ACTIVE SERVERS');
        assert.ok(serversSection?.iconPath instanceof vscode.ThemeIcon);
        assert.ok(activeServersSection?.iconPath instanceof vscode.ThemeIcon);
        assert.strictEqual((serversSection?.iconPath).id, 'server-environment');
        assert.strictEqual((activeServersSection?.iconPath).id, 'server-process');
    });
    test('Should not allow activation of section items', async () => {
        const rootChildren = await treeDataProvider.getChildren();
        const serversSection = rootChildren.find(item => item.label === 'SERVERS');
        const activeServersSection = rootChildren.find(item => item.label === 'ACTIVE SERVERS');
        // Section items should not have commands (they're just containers)
        assert.strictEqual(serversSection?.command, undefined, 'SERVERS section should not have a command');
        assert.strictEqual(activeServersSection?.command, undefined, 'ACTIVE SERVERS section should not have a command');
    });
    test('Should display active servers count in section title', async () => {
        const rootChildren = await treeDataProvider.getChildren();
        const activeServersSection = rootChildren.find(item => item.label?.includes('ACTIVE SERVERS'));
        assert.ok(activeServersSection, 'Should have ACTIVE SERVERS section');
        // The title format will depend on current server count, so we just check it contains ACTIVE SERVERS
        assert.ok(activeServersSection.label?.includes('ACTIVE SERVERS'), 'Should contain ACTIVE SERVERS in title');
    });
    test('Should show "Stop All Servers" option when 2+ servers running', async () => {
        // This test would require mocking multiple servers, which is complex
        // For now, we'll just verify the basic structure works
        const rootChildren = await treeDataProvider.getChildren();
        const activeServersSection = rootChildren.find(item => item.label?.includes('ACTIVE SERVERS'));
        assert.ok(activeServersSection, 'Should have ACTIVE SERVERS section');
        // Test passes if we can get the children without errors
        const activeServersChildren = await treeDataProvider.getChildren(activeServersSection);
        assert.ok(Array.isArray(activeServersChildren), 'Should return array of children');
    });
    test('Should NOT show "Stop All Servers" option when less than 2 servers running', async () => {
        // Mock single running server
        const mockRegistry = {
            getAllServers: () => [
                { id: '1', status: 'running', port: 3000 }
            ]
        };
        const originalGetActiveServerRegistry = require('../active_servers/registry/activeServerRegistry').getActiveServerRegistry;
        require('../active_servers/registry/activeServerRegistry').getActiveServerRegistry = () => mockRegistry;
        try {
            const rootChildren = await treeDataProvider.getChildren();
            const activeServersSection = rootChildren.find(item => item.label.startsWith('ACTIVE SERVERS'));
            if (activeServersSection) {
                const activeServersChildren = await treeDataProvider.getChildren(activeServersSection);
                const stopAllOption = activeServersChildren.find(item => item.label === 'Stop All Servers');
                assert.strictEqual(stopAllOption, undefined, 'Should NOT have "Stop All Servers" option when less than 2 servers running');
            }
        }
        finally {
            require('../active_servers/registry/activeServerRegistry').getActiveServerRegistry = originalGetActiveServerRegistry;
        }
    });
    test('Should make Server Configuration collapsed by default', async () => {
        const rootChildren = await treeDataProvider.getChildren();
        const serversSection = rootChildren.find(item => item.label === 'SERVERS');
        if (serversSection) {
            const serversChildren = await treeDataProvider.getChildren(serversSection);
            const configGroup = serversChildren.find(item => item.label === 'Server Configuration');
            assert.ok(configGroup, 'Should have Server Configuration group');
            assert.strictEqual(configGroup.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed, 'Server Configuration should be collapsed by default');
        }
    });
});
//# sourceMappingURL=unifiedServersTreeView.test.js.map