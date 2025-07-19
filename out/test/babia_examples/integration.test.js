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
const babiaExamplesTreeView_1 = require("../../babia_examples/views/babiaExamplesTreeView");
const exampleLauncher_1 = require("../../babia_examples/runtime/exampleLauncher");
const handleExampleClicks_1 = require("../../babia_examples/views/interactions/handleExampleClicks");
suite('Babia Examples Integration Tests', () => {
    let treeDataProvider;
    let exampleLauncher;
    let clickHandler;
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
        treeDataProvider = new babiaExamplesTreeView_1.BabiaExamplesTreeDataProvider(mockContext);
        exampleLauncher = new exampleLauncher_1.ExampleLauncher(mockContext);
        clickHandler = new handleExampleClicks_1.ExampleClickHandler(mockContext);
    });
    teardown(async () => {
        if (treeDataProvider) {
            await treeDataProvider.cleanup();
        }
        if (exampleLauncher) {
            await exampleLauncher.cleanup();
        }
        if (clickHandler) {
            await clickHandler.cleanup();
        }
    });
    test('Should integrate all components correctly', () => {
        assert.ok(treeDataProvider, 'Tree data provider should be initialized');
        assert.ok(exampleLauncher, 'Example launcher should be initialized');
        assert.ok(clickHandler, 'Click handler should be initialized');
        // Verify tree data provider has launcher
        const providerLauncher = treeDataProvider.getExampleLauncher();
        assert.ok(providerLauncher, 'Tree data provider should have launcher');
        // Verify click handler has launcher
        const handlerLauncher = clickHandler.getExampleLauncher();
        assert.ok(handlerLauncher, 'Click handler should have launcher');
    });
    test('Should handle workspace-less environment gracefully', async () => {
        // Mock no workspace scenario
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        vscode.workspace.workspaceFolders = undefined;
        try {
            // Tree data provider should handle no workspace
            const children = await treeDataProvider.getChildren();
            assert.ok(Array.isArray(children), 'Should return array even with no workspace');
            // Example launcher should handle no workspace
            const scanResult = await exampleLauncher.scanExamples();
            assert.strictEqual(scanResult.examples.length, 0, 'Should return empty examples');
            assert.ok(scanResult.errors.length > 0, 'Should have errors for no workspace');
        }
        finally {
            // Restore
            vscode.workspace.workspaceFolders = originalWorkspaceFolders;
        }
    });
    test('Should handle error scenarios gracefully', async () => {
        // Test error handling doesn't throw uncaught exceptions
        assert.doesNotThrow(() => {
            treeDataProvider.refresh();
        });
        await assert.doesNotReject(async () => {
            await treeDataProvider.rescan();
        });
        await assert.doesNotReject(async () => {
            await exampleLauncher.getExamples();
        });
    });
    test('Should maintain state consistency', async () => {
        // Get examples from launcher
        const examples1 = await exampleLauncher.getExamples();
        // Get examples again (should use cache)
        const examples2 = await exampleLauncher.getExamples();
        // Should be consistent
        assert.strictEqual(examples1.length, examples2.length, 'Example counts should be consistent');
        // Force rescan
        await exampleLauncher.scanExamples();
        const examples3 = await exampleLauncher.getExamples();
        // Should still be consistent
        assert.strictEqual(examples1.length, examples3.length, 'Example counts should remain consistent after rescan');
    });
    test('Should handle concurrent operations', async () => {
        // Simulate concurrent access
        const promises = [
            exampleLauncher.getExamples(),
            exampleLauncher.getExamples(),
            exampleLauncher.getExamples()
        ];
        const results = await Promise.all(promises);
        // All should succeed
        results.forEach(result => {
            assert.ok(Array.isArray(result), 'Each result should be an array');
        });
        // All should have same length (consistency)
        const firstLength = results[0].length;
        results.forEach(result => {
            assert.strictEqual(result.length, firstLength, 'All results should have same length');
        });
    });
    test('Should provide appropriate logging', () => {
        // This is more of a smoke test to ensure logging doesn't break
        console.log('EXAMPLES: Integration test logging check');
        // Verify components can be created without throwing
        assert.doesNotThrow(() => {
            new babiaExamplesTreeView_1.BabiaExamplesTreeDataProvider(mockContext);
        });
        assert.doesNotThrow(() => {
            new exampleLauncher_1.ExampleLauncher(mockContext);
        });
        assert.doesNotThrow(() => {
            new handleExampleClicks_1.ExampleClickHandler(mockContext);
        });
    });
    test('Should cleanup resources properly', async () => {
        // Create new instances
        const testProvider = new babiaExamplesTreeView_1.BabiaExamplesTreeDataProvider(mockContext);
        const testLauncher = new exampleLauncher_1.ExampleLauncher(mockContext);
        const testHandler = new handleExampleClicks_1.ExampleClickHandler(mockContext);
        // Cleanup should not throw
        await assert.doesNotReject(async () => {
            await testProvider.cleanup();
        });
        await assert.doesNotReject(async () => {
            await testLauncher.cleanup();
        });
        await assert.doesNotReject(async () => {
            await testHandler.cleanup();
        });
    });
});
//# sourceMappingURL=integration.test.js.map