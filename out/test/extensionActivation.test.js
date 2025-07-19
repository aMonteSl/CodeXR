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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const serverSettingsManager_1 = require("../servers/storage/serverSettingsManager");
/**
 * Test suite for extension activation and settings restoration
 */
suite('Extension Activation Tests', () => {
    const testStorageDir = path.join(os.tmpdir(), 'codexr-test-storage');
    const testSettingsPath = path.join(testStorageDir, 'server-settings.json');
    // Mock VS Code context
    const mockContext = {
        globalStorageUri: {
            fsPath: testStorageDir
        }
    };
    // Clean up before each test
    function cleanupTestFiles() {
        if (fs.existsSync(testSettingsPath)) {
            fs.unlinkSync(testSettingsPath);
        }
        if (fs.existsSync(testStorageDir)) {
            fs.rmSync(testStorageDir, { recursive: true, force: true });
        }
    }
    // Setup test directory
    function setupTestDirectory() {
        cleanupTestFiles();
        fs.mkdirSync(testStorageDir, { recursive: true });
    }
    test('should restore default settings when no file exists', async () => {
        setupTestDirectory();
        // Create instance and restore settings
        const manager = serverSettingsManager_1.ServerSettingsManager.getInstance(mockContext);
        await manager.restoreServerSettings();
        // Verify default settings are used
        const settings = manager.getServerSettings();
        assert.strictEqual(settings.mode, serverSettingsManager_1.DEFAULT_SERVER_SETTINGS.mode);
        assert.strictEqual(settings.defaultPort, serverSettingsManager_1.DEFAULT_SERVER_SETTINGS.defaultPort);
        assert.strictEqual(settings.https.certSource, serverSettingsManager_1.DEFAULT_SERVER_SETTINGS.https.certSource);
        assert.strictEqual(settings.launch.autoOpen, serverSettingsManager_1.DEFAULT_SERVER_SETTINGS.launch.autoOpen);
        assert.strictEqual(settings.launch.openMode, serverSettingsManager_1.DEFAULT_SERVER_SETTINGS.launch.openMode);
        // Verify file was created
        assert.ok(fs.existsSync(testSettingsPath), 'Settings file should be created');
        cleanupTestFiles();
    });
    test('should restore custom settings from existing file', async () => {
        setupTestDirectory();
        // Create a test settings file with custom values
        const customSettings = {
            mode: 'HTTP',
            https: {
                certSource: 'custom',
                certPath: '/custom/cert.pem',
                keyPath: '/custom/key.pem'
            },
            defaultPort: 8080,
            launch: {
                autoOpen: false,
                openMode: 'lateralPanel'
            },
            configNonce: 'existing-nonce-123',
            version: '1.0.0'
        };
        fs.writeFileSync(testSettingsPath, JSON.stringify(customSettings, null, 2));
        // Create instance and restore settings
        const manager = serverSettingsManager_1.ServerSettingsManager.getInstance(mockContext);
        await manager.restoreServerSettings();
        // Verify custom settings are loaded
        const settings = manager.getServerSettings();
        assert.strictEqual(settings.mode, 'HTTP');
        assert.strictEqual(settings.defaultPort, 8080);
        assert.strictEqual(settings.https.certSource, 'custom');
        assert.strictEqual(settings.https.certPath, '/custom/cert.pem');
        assert.strictEqual(settings.https.keyPath, '/custom/key.pem');
        assert.strictEqual(settings.launch.autoOpen, false);
        assert.strictEqual(settings.launch.openMode, 'lateralPanel');
        // Nonce should be regenerated (different from the original)
        assert.notStrictEqual(settings.configNonce, 'existing-nonce-123');
        cleanupTestFiles();
    });
    test('should handle malformed settings file gracefully', async () => {
        setupTestDirectory();
        // Create a malformed JSON file
        fs.writeFileSync(testSettingsPath, '{ invalid json content');
        // Create instance and restore settings
        const manager = serverSettingsManager_1.ServerSettingsManager.getInstance(mockContext);
        await manager.restoreServerSettings();
        // Should fall back to defaults
        const settings = manager.getServerSettings();
        assert.strictEqual(settings.mode, serverSettingsManager_1.DEFAULT_SERVER_SETTINGS.mode);
        assert.strictEqual(settings.defaultPort, serverSettingsManager_1.DEFAULT_SERVER_SETTINGS.defaultPort);
        // File should be overwritten with valid defaults
        const fileContent = fs.readFileSync(testSettingsPath, 'utf8');
        const parsedContent = JSON.parse(fileContent);
        assert.strictEqual(parsedContent.mode, serverSettingsManager_1.DEFAULT_SERVER_SETTINGS.mode);
        cleanupTestFiles();
    });
    test('should merge partial settings with defaults', async () => {
        setupTestDirectory();
        // Create a settings file with only some fields
        const partialSettings = {
            mode: 'HTTP',
            defaultPort: 4000,
            configNonce: 'partial-nonce-456'
            // Missing https and launch objects
        };
        fs.writeFileSync(testSettingsPath, JSON.stringify(partialSettings, null, 2));
        // Create instance and restore settings
        const manager = serverSettingsManager_1.ServerSettingsManager.getInstance(mockContext);
        await manager.restoreServerSettings();
        // Verify merging worked correctly
        const settings = manager.getServerSettings();
        // Custom values should be preserved
        assert.strictEqual(settings.mode, 'HTTP');
        assert.strictEqual(settings.defaultPort, 4000);
        // Missing values should use defaults
        assert.strictEqual(settings.https.certSource, serverSettingsManager_1.DEFAULT_SERVER_SETTINGS.https.certSource);
        assert.strictEqual(settings.https.certPath, serverSettingsManager_1.DEFAULT_SERVER_SETTINGS.https.certPath);
        assert.strictEqual(settings.launch.autoOpen, serverSettingsManager_1.DEFAULT_SERVER_SETTINGS.launch.autoOpen);
        assert.strictEqual(settings.launch.openMode, serverSettingsManager_1.DEFAULT_SERVER_SETTINGS.launch.openMode);
        cleanupTestFiles();
    });
    test('should display correct legacy config format', async () => {
        setupTestDirectory();
        // Create settings with custom HTTPS certificates
        const customSettings = {
            mode: 'HTTPS',
            https: {
                certSource: 'custom',
                certPath: '/path/to/cert.pem',
                keyPath: '/path/to/key.pem'
            },
            defaultPort: 3443,
            launch: {
                autoOpen: true,
                openMode: 'browser'
            },
            configNonce: 'display-test-nonce',
            version: '1.0.0'
        };
        fs.writeFileSync(testSettingsPath, JSON.stringify(customSettings, null, 2));
        // Create instance and restore settings
        const manager = serverSettingsManager_1.ServerSettingsManager.getInstance(mockContext);
        await manager.restoreServerSettings();
        // Get legacy config for UI display
        const legacyConfig = manager.getLegacyConfig();
        assert.strictEqual(legacyConfig.port, 3443);
        assert.strictEqual(legacyConfig.autoOpen, true);
        assert.strictEqual(legacyConfig.openMode, 'Browser');
        // Should show custom certificate paths in HTTP mode display
        assert.ok(legacyConfig.httpMode.includes('custom certificates'));
        assert.ok(legacyConfig.httpMode.includes('/path/to/cert.pem'));
        assert.ok(legacyConfig.httpMode.includes('/path/to/key.pem'));
        cleanupTestFiles();
    });
    test('should handle concurrent access correctly', async () => {
        setupTestDirectory();
        // Create multiple instances (should return same singleton)
        const manager1 = serverSettingsManager_1.ServerSettingsManager.getInstance(mockContext);
        const manager2 = serverSettingsManager_1.ServerSettingsManager.getInstance();
        assert.strictEqual(manager1, manager2, 'Should return same singleton instance');
        // Both should have same settings
        await manager1.restoreServerSettings();
        const settings1 = manager1.getServerSettings();
        const settings2 = manager2.getServerSettings();
        assert.deepStrictEqual(settings1, settings2);
        cleanupTestFiles();
    });
});
//# sourceMappingURL=extensionActivation.test.js.map