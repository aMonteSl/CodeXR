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
const panelManager_1 = require("../../active_servers/services/panelManager");
const activeServerRegistry_1 = require("../../active_servers/registry/activeServerRegistry");
suite('Panel Manager Tests', () => {
    let panelManager;
    let mockPanel;
    setup(() => {
        panelManager = panelManager_1.PanelManager.getInstance();
        // Create mock WebviewPanel
        mockPanel = {
            dispose: () => { },
            onDidDispose: (callback) => ({ dispose: () => { } }),
            webview: {},
            viewType: 'test',
            title: 'Test Panel',
            viewColumn: vscode.ViewColumn.One,
            active: true,
            visible: true,
            reveal: () => { }
        };
    });
    teardown(() => {
        // Clean up any servers in the registry
        activeServerRegistry_1.ActiveServerRegistry.getInstance().clearAll();
    });
    test('Should register panel successfully', () => {
        const serverId = 'test-server-1';
        panelManager.registerPanel(serverId, mockPanel);
        assert.strictEqual(panelManager.hasPanel(serverId), true);
        assert.strictEqual(panelManager.getPanelCount(), 1);
        assert.strictEqual(panelManager.getPanel(serverId), mockPanel);
    });
    test('Should remove panel successfully', () => {
        const serverId = 'test-server-2';
        panelManager.registerPanel(serverId, mockPanel);
        assert.strictEqual(panelManager.hasPanel(serverId), true);
        const removed = panelManager.removePanel(serverId);
        assert.strictEqual(removed, true);
        assert.strictEqual(panelManager.hasPanel(serverId), false);
        assert.strictEqual(panelManager.getPanelCount(), 0);
    });
    test('Should handle removing non-existent panel', () => {
        const serverId = 'non-existent-server';
        const removed = panelManager.removePanel(serverId);
        assert.strictEqual(removed, false);
        assert.strictEqual(panelManager.getPanelCount(), 0);
    });
    test('Should register multiple panels', () => {
        const serverId1 = 'test-server-1';
        const serverId2 = 'test-server-2';
        const mockPanel2 = { ...mockPanel };
        panelManager.registerPanel(serverId1, mockPanel);
        panelManager.registerPanel(serverId2, mockPanel2);
        assert.strictEqual(panelManager.getPanelCount(), 2);
        assert.strictEqual(panelManager.hasPanel(serverId1), true);
        assert.strictEqual(panelManager.hasPanel(serverId2), true);
        const serverIds = panelManager.getServerIdsWithPanels();
        assert.strictEqual(serverIds.includes(serverId1), true);
        assert.strictEqual(serverIds.includes(serverId2), true);
    });
    test('Should remove all panels', () => {
        const serverId1 = 'test-server-1';
        const serverId2 = 'test-server-2';
        const serverId3 = 'test-server-3';
        const mockPanel2 = { ...mockPanel };
        const mockPanel3 = { ...mockPanel };
        panelManager.registerPanel(serverId1, mockPanel);
        panelManager.registerPanel(serverId2, mockPanel2);
        panelManager.registerPanel(serverId3, mockPanel3);
        assert.strictEqual(panelManager.getPanelCount(), 3);
        const removedCount = panelManager.removeAllPanels();
        assert.strictEqual(removedCount, 3);
        assert.strictEqual(panelManager.getPanelCount(), 0);
        assert.strictEqual(panelManager.hasPanel(serverId1), false);
        assert.strictEqual(panelManager.hasPanel(serverId2), false);
        assert.strictEqual(panelManager.hasPanel(serverId3), false);
    });
    test('Should remove panels for specific servers', () => {
        const serverId1 = 'test-server-1';
        const serverId2 = 'test-server-2';
        const serverId3 = 'test-server-3';
        const mockPanel2 = { ...mockPanel };
        const mockPanel3 = { ...mockPanel };
        panelManager.registerPanel(serverId1, mockPanel);
        panelManager.registerPanel(serverId2, mockPanel2);
        panelManager.registerPanel(serverId3, mockPanel3);
        assert.strictEqual(panelManager.getPanelCount(), 3);
        const removedCount = panelManager.removePanelsForServers([serverId1, serverId3]);
        assert.strictEqual(removedCount, 2);
        assert.strictEqual(panelManager.getPanelCount(), 1);
        assert.strictEqual(panelManager.hasPanel(serverId1), false);
        assert.strictEqual(panelManager.hasPanel(serverId2), true);
        assert.strictEqual(panelManager.hasPanel(serverId3), false);
    });
    test('Should replace existing panel when registering same server ID', () => {
        const serverId = 'test-server-1';
        const mockPanel2 = { ...mockPanel };
        panelManager.registerPanel(serverId, mockPanel);
        assert.strictEqual(panelManager.getPanelCount(), 1);
        assert.strictEqual(panelManager.getPanel(serverId), mockPanel);
        panelManager.registerPanel(serverId, mockPanel2);
        assert.strictEqual(panelManager.getPanelCount(), 1);
        assert.strictEqual(panelManager.getPanel(serverId), mockPanel2);
    });
    test('Should provide debug information', () => {
        const serverId1 = 'test-server-1';
        const serverId2 = 'test-server-2';
        const mockPanel2 = { ...mockPanel };
        panelManager.registerPanel(serverId1, mockPanel);
        panelManager.registerPanel(serverId2, mockPanel2);
        const debugInfo = panelManager.getDebugInfo();
        assert.strictEqual(debugInfo.serverCount, 2);
        assert.strictEqual(debugInfo.serverIds.includes(serverId1), true);
        assert.strictEqual(debugInfo.serverIds.includes(serverId2), true);
    });
    test('Should be singleton', () => {
        const instance1 = panelManager_1.PanelManager.getInstance();
        const instance2 = panelManager_1.PanelManager.getInstance();
        assert.strictEqual(instance1, instance2);
    });
});
//# sourceMappingURL=panelManager.test.js.map