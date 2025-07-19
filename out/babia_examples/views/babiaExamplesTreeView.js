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
exports.BabiaExamplesTreeDataProvider = void 0;
const vscode = __importStar(require("vscode"));
const exampleLauncher_1 = require("../runtime/exampleLauncher");
const exampleItems_1 = require("./items/exampleItems");
/**
 * Babia Examples Tree Data Provider
 * Provides the tree view for Babia visualization examples
 */
class BabiaExamplesTreeDataProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    exampleLauncher;
    isLoading = false;
    constructor(context) {
        this.context = context;
        this.exampleLauncher = new exampleLauncher_1.ExampleLauncher(context);
        console.log('EXAMPLES_UI: Babia examples tree data provider initialized for direct example display');
    }
    /**
     * Refresh the tree view
     */
    refresh() {
        console.log('EXAMPLES_UI: Refreshing tree view');
        this._onDidChangeTreeData.fire();
    }
    /**
     * Get tree item representation
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Get children for the tree view
     */
    async getChildren(element) {
        if (!element) {
            // Root level - return examples directly (no nested container)
            console.log('EXAMPLES_UI: Loading examples directly at root level for clean UI');
            return this.getExampleItems();
        }
        // No nested items for now
        return [];
    }
    /**
     * Get example items
     * @private
     */
    async getExampleItems() {
        console.log('EXAMPLES_UI: Loading example items directly in tree view...');
        if (this.isLoading) {
            return [exampleItems_1.ExampleItemFactory.createLoadingItem()];
        }
        try {
            this.isLoading = true;
            const examples = await this.exampleLauncher.getExamples();
            if (examples.length === 0) {
                console.log('EXAMPLES_UI: No examples found for direct display');
                return [exampleItems_1.ExampleItemFactory.createNoExamplesItem()];
            }
            // Sort examples by category and name
            const sortedExamples = examples.sort((a, b) => {
                if (a.category !== b.category) {
                    return a.category.localeCompare(b.category);
                }
                return a.name.localeCompare(b.name);
            });
            console.log(`EXAMPLES_UI: Creating tree items for ${sortedExamples.length} examples for direct display`);
            const items = sortedExamples.map(example => exampleItems_1.ExampleItemFactory.createExampleItem(example));
            // Add valid count to console
            const validCount = examples.filter(ex => ex.isValid).length;
            const invalidCount = examples.length - validCount;
            console.log(`EXAMPLES_UI: Loaded ${validCount} valid and ${invalidCount} invalid examples for direct display`);
            return items;
        }
        catch (error) {
            console.error('EXAMPLES_UI: Error loading examples for direct display:', error);
            // Return error item
            return [
                new exampleItems_1.BabiaExampleTreeItem('Error loading examples', vscode.TreeItemCollapsibleState.None, 'noExamples', {
                    command: 'codeXR.babiaExamples.refresh',
                    title: 'Retry'
                }, new vscode.ThemeIcon('error'), `Error: ${error instanceof Error ? error.message : String(error)}. Click to retry.`, undefined, 'error')
            ];
        }
        finally {
            this.isLoading = false;
        }
    }
    /**
     * Force rescan of examples
     */
    async rescan() {
        console.log('EXAMPLES_UI: Force rescanning examples for direct display...');
        this.isLoading = true;
        this.refresh(); // Show loading state
        try {
            await this.exampleLauncher.scanExamples();
        }
        finally {
            this.isLoading = false;
            this.refresh(); // Show results
        }
    }
    /**
     * Get example launcher instance
     */
    getExampleLauncher() {
        return this.exampleLauncher;
    }
    /**
     * Cleanup method
     */
    async cleanup() {
        console.log('EXAMPLES_UI: Cleaning up tree data provider...');
        await this.exampleLauncher.cleanup();
    }
}
exports.BabiaExamplesTreeDataProvider = BabiaExamplesTreeDataProvider;
//# sourceMappingURL=babiaExamplesTreeView.js.map