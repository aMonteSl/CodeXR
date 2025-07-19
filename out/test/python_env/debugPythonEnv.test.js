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
suite('Python Environment Debug Tests', () => {
    let mockContext;
    let tempDir;
    setup(() => {
        // Create a temporary directory for testing
        tempDir = path.join(__dirname, '../../..', 'test-python-env-debug');
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
        // Clean up test directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
    test('Debug environment status initialization', () => {
        console.log('PYTHON_ENV_DEBUG: Starting test...');
        console.log('PYTHON_ENV_DEBUG: Temp dir:', tempDir);
        console.log('PYTHON_ENV_DEBUG: Temp dir contents before VenvManager:', fs.readdirSync(tempDir));
        const venvManager = new venvManager_1.VenvManager(mockContext);
        console.log('PYTHON_ENV_DEBUG: Temp dir contents after VenvManager:', fs.readdirSync(tempDir));
        const status = venvManager.getEnvironmentStatus();
        console.log('PYTHON_ENV_DEBUG: Status:', JSON.stringify(status, null, 2));
        // We expect exists to be false initially
        assert.strictEqual(status.exists, false, 'Environment should not exist initially');
    });
});
//# sourceMappingURL=debugPythonEnv.test.js.map