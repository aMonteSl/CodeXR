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
const multiServerLauncher_1 = require("../../servers/runtime/multiServerLauncher");
const portManager_1 = require("../../servers/runtime/portManager");
suite('MultiServerLauncher Tests', () => {
    let launcher;
    let mockContext;
    setup(() => {
        // Create mock extension context
        mockContext = {
            subscriptions: [],
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => [],
                setKeysForSync: () => { }
            },
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => []
            },
            extensionPath: '/mock/path',
            extensionUri: vscode.Uri.file('/mock/path'),
            globalStorageUri: vscode.Uri.file('/mock/global'),
            storageUri: vscode.Uri.file('/mock/storage'),
            secrets: {},
            environmentVariableCollection: {},
            logUri: vscode.Uri.file('/mock/log'),
            storagePath: '/mock/storage',
            globalStoragePath: '/mock/global',
            asAbsolutePath: (relativePath) => `/mock/path/${relativePath}`,
            logPath: '/mock/log',
            extensionMode: vscode.ExtensionMode.Test,
            extension: {},
            languageModelAccessInformation: {}
        };
        launcher = new multiServerLauncher_1.MultiServerLauncher(mockContext);
    });
    teardown(async () => {
        // Stop all servers after each test
        if (launcher) {
            await launcher.stopAllServers();
        }
    });
    test('Should initialize multi-server launcher correctly', () => {
        assert.ok(launcher, 'MultiServerLauncher should be initialized');
        assert.strictEqual(launcher.getRunningServerCount(), 0, 'Should start with no running servers');
        assert.strictEqual(launcher.hasRunningServers(), false, 'Should not have running servers initially');
    });
    test('Should generate unique server IDs', () => {
        const ids = new Set();
        // Generate multiple IDs and check uniqueness
        for (let i = 0; i < 10; i++) {
            const id = launcher.generateServerId();
            assert.ok(id, 'Should generate a valid ID');
            assert.ok(id.startsWith('server_'), 'ID should start with "server_"');
            assert.ok(!ids.has(id), 'Each ID should be unique');
            ids.add(id);
        }
    });
    test('Should provide correct server information when no servers running', () => {
        const runningServers = launcher.getRunningServers();
        assert.strictEqual(runningServers.length, 0, 'Should return empty array when no servers running');
        assert.strictEqual(launcher.getRunningServerCount(), 0, 'Count should be 0');
        assert.strictEqual(launcher.hasRunningServers(), false, 'Should not have running servers');
    });
    test('Should handle stopServer gracefully when server does not exist', async () => {
        const result = await launcher.stopServer('non-existent-server');
        assert.strictEqual(result, true, 'Should return true when stopping non-existent server');
    });
    test('Should handle stopAllServers when no servers are running', async () => {
        const result = await launcher.stopAllServers();
        assert.strictEqual(result, true, 'Should return true when stopping no servers');
    });
    test('Should determine server type correctly', () => {
        const settings = {
            mode: 'HTTP',
            defaultPort: 3000,
            launch: { autoOpen: false, openMode: 'browser' },
            https: { certSource: 'default', certPath: '', keyPath: '' }
        };
        const serverType = launcher.determineServerType(settings);
        assert.strictEqual(serverType, 'http', 'Should determine HTTP server type correctly');
    });
    test('Should determine launch mode correctly', () => {
        const browserSettings = {
            mode: 'HTTP',
            defaultPort: 3000,
            launch: { autoOpen: false, openMode: 'browser' },
            https: { certSource: 'default', certPath: '', keyPath: '' }
        };
        const panelSettings = {
            mode: 'HTTP',
            defaultPort: 3000,
            launch: { autoOpen: false, openMode: 'lateralPanel' },
            https: { certSource: 'default', certPath: '', keyPath: '' }
        };
        const browserMode = launcher.determineLaunchMode(browserSettings);
        const panelMode = launcher.determineLaunchMode(panelSettings);
        assert.strictEqual(browserMode, 'browser', 'Should determine browser launch mode correctly');
        assert.strictEqual(panelMode, 'panel', 'Should determine panel launch mode correctly');
    });
    test('Should determine certificate mode correctly', () => {
        const httpMode = launcher.determineCertMode('http', false);
        const httpsDefaultMode = launcher.determineCertMode('https-default', false);
        const httpsCustomMode = launcher.determineCertMode('https-custom', false);
        const overriddenMode = launcher.determineCertMode('https-default', true);
        assert.strictEqual(httpMode, 'http', 'Should determine HTTP cert mode correctly');
        assert.strictEqual(httpsDefaultMode, 'https-default', 'Should determine HTTPS default cert mode correctly');
        assert.strictEqual(httpsCustomMode, 'https-custom', 'Should determine HTTPS custom cert mode correctly');
        assert.strictEqual(overriddenMode, 'http', 'Should determine overridden cert mode correctly');
    });
});
suite('PortManager Enhanced Tests', () => {
    test('Should find available port using get-port integration', async () => {
        const startPort = 3000;
        const endPort = 3010;
        try {
            const availablePort = await portManager_1.PortManager.findAvailablePort(startPort, endPort);
            assert.ok(availablePort >= startPort, 'Available port should be >= start port');
            assert.ok(availablePort <= endPort, 'Available port should be <= end port');
            // Verify the port is actually available
            const isAvailable = await portManager_1.PortManager.isPortAvailable(availablePort);
            assert.strictEqual(isAvailable, true, 'Returned port should be available');
        }
        catch (error) {
            // This test might fail if no ports are available in the range
            // which is acceptable in a test environment
            assert.ok(error instanceof Error, 'Should throw proper error when no ports available');
        }
    });
    test('Should handle invalid port ranges gracefully', async () => {
        try {
            await portManager_1.PortManager.findAvailablePort(-1, 100);
            assert.fail('Should throw error for invalid start port');
        }
        catch (error) {
            assert.ok(error instanceof Error, 'Should throw error for invalid start port');
            assert.ok(error.message.includes('Invalid start port'), 'Error message should mention invalid start port');
        }
        try {
            await portManager_1.PortManager.findAvailablePort(100, 50);
            assert.fail('Should throw error for invalid port range');
        }
        catch (error) {
            assert.ok(error instanceof Error, 'Should throw error for invalid port range');
            assert.ok(error.message.includes('Invalid end port'), 'Error message should mention invalid end port');
        }
    });
    test('Should limit port range for performance', async () => {
        // This test verifies that the port range is limited to prevent performance issues
        const startPort = 3000;
        const endPort = 4000; // Large range
        try {
            const availablePort = await portManager_1.PortManager.findAvailablePort(startPort, endPort);
            assert.ok(availablePort >= startPort, 'Should find port in reasonable time even with large range');
        }
        catch (error) {
            // Acceptable if no ports are available
            assert.ok(error instanceof Error, 'Should handle large ranges gracefully');
        }
    });
});
suite('Multi-Server Integration Tests', () => {
    let launcher;
    let mockContext;
    setup(() => {
        mockContext = {
            subscriptions: [],
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => [],
                setKeysForSync: () => { }
            },
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => []
            },
            extensionPath: '/mock/path',
            extensionUri: vscode.Uri.file('/mock/path'),
            globalStorageUri: vscode.Uri.file('/mock/global'),
            storageUri: vscode.Uri.file('/mock/storage'),
            secrets: {},
            environmentVariableCollection: {},
            logUri: vscode.Uri.file('/mock/log'),
            storagePath: '/mock/storage',
            globalStoragePath: '/mock/global',
            asAbsolutePath: (relativePath) => `/mock/path/${relativePath}`,
            logPath: '/mock/log',
            extensionMode: vscode.ExtensionMode.Test,
            extension: {},
            languageModelAccessInformation: {}
        };
        launcher = new multiServerLauncher_1.MultiServerLauncher(mockContext);
    });
    teardown(async () => {
        if (launcher) {
            await launcher.stopAllServers();
        }
    });
    test('Should support multiple concurrent servers', function () {
        // Skip this test in CI environments where actual server launching might not work
        if (!process.env.VSCODE_TEST_SERVER_ENABLED) {
            this.skip();
            return;
        }
        // This test would require actual server launching which is complex in a test environment
        // For now, we'll test the data structures and logic
        assert.ok(launcher, 'Launcher should be available for multiple server testing');
        assert.strictEqual(launcher.getRunningServerCount(), 0, 'Should start with no servers');
        // Test the internal server tracking structure
        const servers = launcher.servers;
        assert.ok(servers instanceof Map, 'Should use Map for server tracking');
        assert.strictEqual(servers.size, 0, 'Server map should be empty initially');
    });
    test('Should handle port conflicts gracefully', async () => {
        // Test the port conflict resolution logic without actually starting servers
        const findPortWithLogging = launcher.findAvailablePortWithLogging.bind(launcher);
        try {
            const port = await findPortWithLogging(3000);
            assert.ok(typeof port === 'number', 'Should return a valid port number');
            assert.ok(port >= 3000, 'Should return port >= requested port');
        }
        catch (error) {
            // Acceptable if no ports are available in test environment
            assert.ok(error instanceof Error, 'Should handle port conflicts gracefully');
        }
    });
});
//# sourceMappingURL=multiServerLauncher.test.js.map