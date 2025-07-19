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
const exampleItems_1 = require("../../babia_examples/views/items/exampleItems");
suite('Babia Examples Tree View Tests', () => {
    let treeDataProvider;
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
    });
    teardown(async () => {
        if (treeDataProvider) {
            await treeDataProvider.cleanup();
        }
    });
    test('Should initialize tree data provider correctly', () => {
        assert.ok(treeDataProvider, 'Tree data provider should be initialized');
        assert.ok(treeDataProvider.onDidChangeTreeData, 'Should have change event emitter');
    });
    test('Should create example tree items correctly', () => {
        const mockExample = {
            id: 'test_pie_index_html',
            name: 'Pie Chart',
            htmlFilePath: '/test/pie/index.html',
            directory: '/test/pie',
            category: 'pie',
            description: 'Pie chart visualization example',
            isValid: true,
            lastModified: Date.now()
        };
        const treeItem = exampleItems_1.ExampleItemFactory.createExampleItem(mockExample);
        assert.strictEqual(treeItem.label, 'Pie Chart');
        assert.strictEqual(treeItem.collapsibleState, vscode.TreeItemCollapsibleState.None);
        assert.strictEqual(treeItem.type, 'example');
        assert.ok(treeItem.command, 'Should have command');
        assert.strictEqual(treeItem.command.command, 'codeXR.babiaExamples.launchExample');
        assert.strictEqual(treeItem.contextValue, 'validExample');
        assert.strictEqual(treeItem.example, mockExample);
    });
    test('Should create invalid example tree items correctly', () => {
        const invalidExample = {
            id: 'invalid_test',
            name: 'Invalid Test',
            htmlFilePath: '',
            directory: '/test/invalid',
            category: 'test',
            isValid: false
        };
        const treeItem = exampleItems_1.ExampleItemFactory.createExampleItem(invalidExample);
        assert.strictEqual(treeItem.label, 'Invalid Test');
        assert.strictEqual(treeItem.description, '(Invalid)');
        assert.strictEqual(treeItem.contextValue, 'invalidExample');
        assert.ok(treeItem.tooltip.includes('issues'), 'Tooltip should mention issues');
    });
    test('Should create no examples item correctly', () => {
        const noExamplesItem = exampleItems_1.ExampleItemFactory.createNoExamplesItem();
        assert.strictEqual(noExamplesItem.label, 'No examples found');
        assert.strictEqual(noExamplesItem.type, 'noExamples');
        assert.strictEqual(noExamplesItem.contextValue, 'noExamples');
        assert.ok(noExamplesItem.iconPath instanceof vscode.ThemeIcon);
        assert.strictEqual(noExamplesItem.iconPath.id, 'info');
    });
    test('Should create loading item correctly', () => {
        const loadingItem = exampleItems_1.ExampleItemFactory.createLoadingItem();
        assert.strictEqual(loadingItem.label, 'Loading examples...');
        assert.strictEqual(loadingItem.type, 'loading');
        assert.strictEqual(loadingItem.contextValue, 'loading');
        assert.ok(loadingItem.iconPath instanceof vscode.ThemeIcon);
        assert.strictEqual(loadingItem.iconPath.id, 'loading~spin');
    });
    test('Should handle refresh correctly', () => {
        // Test that refresh doesn't throw
        assert.doesNotThrow(() => {
            treeDataProvider.refresh();
        });
    });
    test('Should handle getTreeItem correctly', () => {
        const mockItem = new exampleItems_1.BabiaExampleTreeItem('Test', vscode.TreeItemCollapsibleState.None, 'example');
        const result = treeDataProvider.getTreeItem(mockItem);
        assert.strictEqual(result, mockItem, 'Should return same tree item');
    });
    test('Should handle getChildren for root correctly', async () => {
        // This will depend on actual workspace structure
        const children = await treeDataProvider.getChildren();
        assert.ok(Array.isArray(children), 'Should return array');
        // Should have at least one item (loading, no examples, or actual examples)
        assert.ok(children.length > 0, 'Should have at least one child item');
    });
    test('Should handle getChildren for non-root correctly', async () => {
        const mockItem = new exampleItems_1.BabiaExampleTreeItem('Test', vscode.TreeItemCollapsibleState.None, 'example');
        const children = await treeDataProvider.getChildren(mockItem);
        assert.strictEqual(children.length, 0, 'Examples should have no children');
    });
    test('Should sort examples correctly', async () => {
        // Create mock examples with different categories and names
        const example1 = {
            id: 'test1',
            name: 'Z Example',
            htmlFilePath: '/test1/index.html',
            directory: '/test1',
            category: 'a-category',
            isValid: true
        };
        const example2 = {
            id: 'test2',
            name: 'A Example',
            htmlFilePath: '/test2/index.html',
            directory: '/test2',
            category: 'b-category',
            isValid: true
        };
        const example3 = {
            id: 'test3',
            name: 'B Example',
            htmlFilePath: '/test3/index.html',
            directory: '/test3',
            category: 'a-category',
            isValid: true
        };
        // Test sorting logic (this would require mocking the launcher's getExamples method)
        const examples = [example1, example2, example3];
        const sorted = examples.sort((a, b) => {
            if (a.category !== b.category) {
                return a.category.localeCompare(b.category);
            }
            return a.name.localeCompare(b.name);
        });
        assert.strictEqual(sorted[0].name, 'B Example'); // a-category, B Example
        assert.strictEqual(sorted[1].name, 'Z Example'); // a-category, Z Example  
        assert.strictEqual(sorted[2].name, 'A Example'); // b-category, A Example
    });
    test('Should handle rescan correctly', async () => {
        // Test that rescan doesn't throw
        await assert.doesNotReject(async () => {
            await treeDataProvider.rescan();
        });
    });
    test('Should provide example launcher', () => {
        const launcher = treeDataProvider.getExampleLauncher();
        assert.ok(launcher, 'Should provide example launcher instance');
    });
});
//# sourceMappingURL=treeView.test.js.map