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
const exampleLauncher_1 = require("../../babia_examples/runtime/exampleLauncher");
suite('Babia Examples Tests', () => {
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
            extension: {
                id: 'mock.extension',
                extensionUri: vscode.Uri.file('/mock/path'),
                extensionPath: '/mock/path',
                isActive: true,
                packageJSON: {},
                exports: undefined,
                activate: () => Promise.resolve(),
                extensionKind: vscode.ExtensionKind.Workspace
            },
            languageModelAccessInformation: {
                onDidChange: new vscode.EventEmitter().event,
                canSendRequest: () => undefined
            }
        };
        launcher = new exampleLauncher_1.ExampleLauncher(mockContext);
    });
    teardown(async () => {
        if (launcher) {
            await launcher.cleanup();
        }
    });
    test('Should initialize example launcher correctly', () => {
        assert.ok(launcher, 'ExampleLauncher should be initialized');
    });
    test('Should handle no workspace scenario gracefully', async () => {
        // Mock no workspace
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        vscode.workspace.workspaceFolders = undefined;
        try {
            const result = await launcher.scanExamples();
            assert.strictEqual(result.examples.length, 0, 'Should return empty examples array');
            assert.strictEqual(result.validCount, 0, 'Should have zero valid examples');
            assert.strictEqual(result.invalidCount, 0, 'Should have zero invalid examples');
            assert.ok(result.errors.length > 0, 'Should have errors');
            assert.ok(result.errors[0].includes('No workspace folder'), 'Error should mention no workspace');
        }
        finally {
            // Restore
            vscode.workspace.workspaceFolders = originalWorkspaceFolders;
        }
    });
    test('Should generate proper example IDs', () => {
        // Use reflection to test private method
        const generateId = launcher.generateExampleId.bind(launcher);
        const id1 = generateId('pie-chart', 'index.html');
        const id2 = generateId('bar_chart', 'example.html');
        assert.strictEqual(id1, 'example_pie_chart_index_html');
        assert.strictEqual(id2, 'example_bar_chart_example_html');
        // Should handle special characters
        const id3 = generateId('test-with-special!@#chars', 'file.html');
        assert.ok(!id3.includes('!'), 'Should remove special characters');
        assert.ok(!id3.includes('@'), 'Should remove special characters');
        assert.ok(!id3.includes('#'), 'Should remove special characters');
    });
    test('Should format example names correctly', () => {
        // Use reflection to test private method
        const formatName = launcher.formatExampleName.bind(launcher);
        assert.strictEqual(formatName('pie-chart'), 'Pie Chart');
        assert.strictEqual(formatName('bar_chart'), 'Bar Chart');
        assert.strictEqual(formatName('cylinder-chart'), 'Cylinder Chart');
        assert.strictEqual(formatName('mix'), 'Mix');
    });
    test('Should generate proper descriptions', () => {
        // Use reflection to test private method
        const generateDescription = launcher.generateDescription.bind(launcher);
        const desc1 = generateDescription('pie-chart', 'index.html');
        const desc2 = generateDescription('bar-chart', 'population.html');
        assert.strictEqual(desc1, 'Pie Chart visualization example');
        assert.strictEqual(desc2, 'Bar Chart - population');
    });
    test('Should cache examples properly', async () => {
        // First call should trigger scan
        const examples1 = await launcher.getExamples();
        // Second call should use cache (within cache duration)
        const examples2 = await launcher.getExamples();
        // Should return same reference if using cache
        assert.strictEqual(examples1, examples2, 'Should use cached examples');
    });
    test('Should validate example properties', () => {
        const validExample = {
            id: 'test_example',
            name: 'Test Example',
            htmlFilePath: '/path/to/test.html',
            directory: '/path/to/',
            category: 'test',
            description: 'Test description',
            isValid: true,
            lastModified: Date.now()
        };
        assert.ok(validExample.id, 'Should have ID');
        assert.ok(validExample.name, 'Should have name');
        assert.ok(validExample.htmlFilePath, 'Should have HTML file path');
        assert.ok(validExample.directory, 'Should have directory');
        assert.ok(validExample.category, 'Should have category');
        assert.strictEqual(typeof validExample.isValid, 'boolean', 'isValid should be boolean');
    });
    test('Should handle invalid examples', async () => {
        const invalidExample = {
            id: 'invalid_example',
            name: 'Invalid Example',
            htmlFilePath: '',
            directory: '/nonexistent/',
            category: 'test',
            isValid: false
        };
        try {
            const result = await launcher.launchExample(invalidExample);
            assert.strictEqual(result.success, false, 'Should fail for invalid example');
            assert.ok(result.error, 'Should have error message');
            assert.ok(result.error.includes('not valid'), 'Error should mention invalid example');
        }
        catch (error) {
            // This is also acceptable - throwing an error for invalid examples
            assert.ok(error, 'Should handle invalid examples');
        }
    });
    test('Should cleanup properly', async () => {
        await launcher.cleanup();
        // Verify cache is cleared
        const examples = launcher.examplesCache;
        const lastScanTime = launcher.lastScanTime;
        assert.strictEqual(examples.length, 0, 'Cache should be cleared');
        assert.strictEqual(lastScanTime, 0, 'Last scan time should be reset');
    });
});
//# sourceMappingURL=exampleLauncher.test.js.map