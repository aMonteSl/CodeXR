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
const serverControl_1 = require("../../active_servers/runtime/serverControl");
const activeServerRegistry_1 = require("../../active_servers/registry/activeServerRegistry");
const panelManager_1 = require("../../active_servers/services/panelManager");
suite('Server Control Panel Integration Tests', () => {
    let mockPanel;
    setup(() => {
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
        // Clean up any servers in the registry and panels
        (0, activeServerRegistry_1.getActiveServerRegistry)().clearAll();
        (0, panelManager_1.getPanelManager)().removeAllPanels();
    });
    test('Should close lateral panel when stopping server', async () => {
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const panelManager = (0, panelManager_1.getPanelManager)();
        // Create test server with lateral panel mode
        const testServer = {
            id: 'test-lateral-server',
            port: 3001,
            url: 'http://localhost:3001',
            launchMode: 'lateralPanel',
            certMode: 'http',
            timestamp: Date.now(),
            status: 'running',
            htmlFile: '/test/file.html',
            serverInstance: {
                stop: async () => { }
            }
        };
        // Register server and panel
        registry.registerServer(testServer);
        panelManager.registerPanel(testServer.id, mockPanel);
        // Verify setup
        assert.strictEqual(registry.hasServer(testServer.id), true);
        assert.strictEqual(panelManager.hasPanel(testServer.id), true);
        // Stop the server
        const success = await serverControl_1.ServerControl.stopServer(testServer.id);
        // Verify server was stopped and panel was closed
        assert.strictEqual(success, true);
        assert.strictEqual(registry.hasServer(testServer.id), false);
        assert.strictEqual(panelManager.hasPanel(testServer.id), false);
    });
    test('Should not affect browser mode servers when stopping', async () => {
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const panelManager = (0, panelManager_1.getPanelManager)();
        // Create test server with browser mode (should not affect panels)
        const testServer = {
            id: 'test-browser-server',
            port: 3002,
            url: 'http://localhost:3002',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now(),
            status: 'running',
            htmlFile: '/test/file.html',
            serverInstance: {
                stop: async () => { }
            }
        };
        // Register server (no panel for browser mode)
        registry.registerServer(testServer);
        // Register an unrelated panel
        panelManager.registerPanel('unrelated-panel', mockPanel);
        // Verify setup
        assert.strictEqual(registry.hasServer(testServer.id), true);
        assert.strictEqual(panelManager.hasPanel('unrelated-panel'), true);
        assert.strictEqual(panelManager.getPanelCount(), 1);
        // Stop the browser mode server
        const success = await serverControl_1.ServerControl.stopServer(testServer.id);
        // Verify server was stopped but unrelated panel remains
        assert.strictEqual(success, true);
        assert.strictEqual(registry.hasServer(testServer.id), false);
        assert.strictEqual(panelManager.hasPanel('unrelated-panel'), true);
        assert.strictEqual(panelManager.getPanelCount(), 1);
    });
    test('Should close all lateral panels when stopping all servers', async () => {
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const panelManager = (0, panelManager_1.getPanelManager)();
        // Create multiple test servers with different modes
        const lateralServer1 = {
            id: 'lateral-server-1',
            port: 3001,
            url: 'http://localhost:3001',
            launchMode: 'lateralPanel',
            certMode: 'http',
            timestamp: Date.now(),
            status: 'running',
            serverInstance: { stop: async () => { } }
        };
        const lateralServer2 = {
            id: 'lateral-server-2',
            port: 3002,
            url: 'http://localhost:3002',
            launchMode: 'lateralPanel',
            certMode: 'http',
            timestamp: Date.now(),
            status: 'running',
            serverInstance: { stop: async () => { } }
        };
        const browserServer = {
            id: 'browser-server',
            port: 3003,
            url: 'http://localhost:3003',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now(),
            status: 'running',
            serverInstance: { stop: async () => { } }
        };
        // Create additional mock panels
        const mockPanel2 = { ...mockPanel };
        // Register servers and panels
        registry.registerServer(lateralServer1);
        registry.registerServer(lateralServer2);
        registry.registerServer(browserServer);
        panelManager.registerPanel(lateralServer1.id, mockPanel);
        panelManager.registerPanel(lateralServer2.id, mockPanel2);
        // Verify setup
        assert.strictEqual(registry.getServersByStatus('running').length, 3);
        assert.strictEqual(panelManager.getPanelCount(), 2);
        // Stop all servers
        const stoppedCount = await serverControl_1.ServerControl.stopAllServers();
        // Verify all servers were stopped and all panels were closed
        assert.strictEqual(stoppedCount, 3);
        assert.strictEqual(registry.getServersByStatus('running').length, 0);
        assert.strictEqual(panelManager.getPanelCount(), 0);
    });
    test('Should handle missing panels gracefully when stopping servers', async () => {
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const panelManager = (0, panelManager_1.getPanelManager)();
        // Create test server with lateral panel mode but no registered panel
        const testServer = {
            id: 'test-no-panel-server',
            port: 3001,
            url: 'http://localhost:3001',
            launchMode: 'lateralPanel',
            certMode: 'http',
            timestamp: Date.now(),
            status: 'running',
            serverInstance: {
                stop: async () => { }
            }
        };
        // Register server but no panel
        registry.registerServer(testServer);
        // Verify setup
        assert.strictEqual(registry.hasServer(testServer.id), true);
        assert.strictEqual(panelManager.hasPanel(testServer.id), false);
        // Stop the server (should not throw error for missing panel)
        const success = await serverControl_1.ServerControl.stopServer(testServer.id);
        // Verify server was stopped
        assert.strictEqual(success, true);
        assert.strictEqual(registry.hasServer(testServer.id), false);
    });
});
//# sourceMappingURL=serverControlPanelIntegration.test.js.map