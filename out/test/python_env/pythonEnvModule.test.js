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
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const venvManager_1 = require("../../python_env/runtime/venvManager");
const pythonEnvStorage_1 = require("../../python_env/storage/pythonEnvStorage");
const pythonEnvUtils_1 = require("../../python_env/utils/pythonEnvUtils");
suite('Python Environment Module Tests', () => {
    let mockContext;
    let tempDir;
    suiteSetup(() => {
        // Create a unique temporary directory for this test run
        const timestamp = Date.now();
        tempDir = path.join(__dirname, '../../..', `test-python-env-${timestamp}`);
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        fs.mkdirSync(tempDir, { recursive: true });
    });
    suiteTeardown(() => {
        // Clean up test directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
    setup(() => {
        // Clean up before each test
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        fs.mkdirSync(tempDir, { recursive: true });
        // Create mock VS Code extension context
        mockContext = {
            globalStorageUri: vscode.Uri.file(tempDir),
            subscriptions: [],
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve()
            },
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve()
            },
            extensionUri: vscode.Uri.file(tempDir),
            extensionPath: tempDir,
            asAbsolutePath: (relativePath) => path.join(tempDir, relativePath),
            storagePath: tempDir,
            storageUri: vscode.Uri.file(tempDir),
            globalStoragePath: tempDir,
            secrets: {},
            extensionMode: vscode.ExtensionMode.Test,
            environmentVariableCollection: {},
            extension: {},
            logUri: vscode.Uri.file(tempDir),
            logPath: tempDir,
            languageModelAccessInformation: {}
        };
    });
    teardown(() => {
        // Clean up after each test to ensure isolation
        if (fs.existsSync(tempDir)) {
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
            catch (error) {
                console.warn('Test teardown cleanup warning:', error);
            }
        }
    });
    test('PythonEnvUtils should provide correct commands for Linux', () => {
        const pythonCommand = pythonEnvUtils_1.PythonEnvUtils.getPythonCommand();
        assert.strictEqual(pythonCommand, 'python3', 'Should use python3 on Linux');
        const venvPath = '/test/venv';
        const activationCommand = pythonEnvUtils_1.PythonEnvUtils.getActivationCommand(venvPath);
        assert.strictEqual(activationCommand, 'source /test/venv/bin/activate', 'Should use source command on Linux');
        const pythonPath = pythonEnvUtils_1.PythonEnvUtils.getVenvPythonPath(venvPath);
        assert.strictEqual(pythonPath, '/test/venv/bin/python', 'Should use bin/python on Linux');
        const pipPath = pythonEnvUtils_1.PythonEnvUtils.getVenvPipPath(venvPath);
        assert.strictEqual(pipPath, '/test/venv/bin/pip', 'Should use bin/pip on Linux');
    });
    test('PythonEnvStorage should initialize correctly', () => {
        const storage = new pythonEnvStorage_1.PythonEnvStorage(mockContext);
        const venvPath = storage.getVenvPath();
        const expectedVenvPath = path.join(tempDir, 'python-env', 'venv');
        assert.strictEqual(venvPath, expectedVenvPath, 'Venv path should be correct');
        const pythonEnvPath = storage.getPythonEnvPath();
        const expectedPythonEnvPath = path.join(tempDir, 'python-env');
        assert.strictEqual(pythonEnvPath, expectedPythonEnvPath, 'Python env path should be correct');
        // Check that directory was created
        assert.strictEqual(fs.existsSync(pythonEnvPath), true, 'Python env directory should exist');
    });
    test('PythonEnvStorage should handle metadata correctly', async () => {
        const storage = new pythonEnvStorage_1.PythonEnvStorage(mockContext);
        // Initially no metadata should exist
        const initialMetadata = storage.loadMetadata();
        assert.strictEqual(initialMetadata, null, 'No metadata should exist initially');
        // Create and save metadata
        const testMetadata = storage.createInitialMetadata('3.12.3');
        await storage.saveMetadata(testMetadata);
        // Load and verify metadata
        const loadedMetadata = storage.loadMetadata();
        assert.notStrictEqual(loadedMetadata, null, 'Metadata should be loaded');
        assert.strictEqual(loadedMetadata.pythonVersion, '3.12.3', 'Python version should match');
        assert.strictEqual(loadedMetadata.isActive, true, 'Should be active');
        assert.strictEqual(Array.isArray(loadedMetadata.dependencies), true, 'Dependencies should be array');
    });
    test('VenvManager should initialize correctly', () => {
        const venvManager = new venvManager_1.VenvManager(mockContext);
        const status = venvManager.getEnvironmentStatus();
        assert.strictEqual(status.exists, false, 'Environment should not exist initially');
        assert.strictEqual(status.isValid, false, 'Environment should not be valid initially');
        assert.strictEqual(status.metadata, null, 'No metadata should exist initially');
    });
    test('PythonEnvUtils should validate paths correctly', () => {
        // Valid path (parent exists, target doesn't)
        const validPath = path.join(tempDir, 'new-venv');
        assert.strictEqual(pythonEnvUtils_1.PythonEnvUtils.isValidPath(validPath), true, 'Should accept valid path');
        // Invalid path (parent doesn't exist)
        const invalidPath = path.join('/nonexistent/path', 'venv');
        assert.strictEqual(pythonEnvUtils_1.PythonEnvUtils.isValidPath(invalidPath), false, 'Should reject invalid path');
        // Path exists but is not empty
        const existingDir = path.join(tempDir, 'existing');
        fs.mkdirSync(existingDir);
        fs.writeFileSync(path.join(existingDir, 'file.txt'), 'content');
        assert.strictEqual(pythonEnvUtils_1.PythonEnvUtils.isValidPath(existingDir), false, 'Should reject non-empty existing directory');
    });
    test('VenvManager should provide lizard functionality', () => {
        const venvManager = new venvManager_1.VenvManager(mockContext);
        // Test lizard command generation
        const lizardCommand = venvManager.getLizardCommand();
        // Should be null initially since no environment exists
        assert.strictEqual(lizardCommand, null, 'Lizard command should be null when no environment exists');
    });
    test('Storage stats should work correctly', () => {
        const storage = new pythonEnvStorage_1.PythonEnvStorage(mockContext);
        const stats = storage.getStorageStats();
        assert.strictEqual(stats.envExists, true, 'Environment directory should exist');
        assert.strictEqual(stats.stateExists, false, 'State file should not exist initially');
        assert.strictEqual(stats.venvSize, undefined, 'Venv size should be undefined when venv does not exist');
    });
});
//# sourceMappingURL=pythonEnvModule.test.js.map