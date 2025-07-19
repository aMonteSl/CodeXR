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
exports.BabiaExamplesSectionProvider = void 0;
const vscode = __importStar(require("vscode"));
const babiaExampleItems_1 = require("./items/babiaExampleItems");
const handleBabiaExampleClicks_1 = require("./interactions/handleBabiaExampleClicks");
const exampleLauncher_1 = require("../../babia_examples/runtime/exampleLauncher");
/**
 * Babia Examples section provider - manages example loading and launching
 */
class BabiaExamplesSectionProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    clickHandler;
    exampleLauncher;
    constructor(context) {
        this.context = context;
        console.log('BABIA_EXAMPLES_MODULAR: Initializing Babia Examples section provider');
        this.clickHandler = new handleBabiaExampleClicks_1.BabiaExampleClickHandler(context);
        this.exampleLauncher = new exampleLauncher_1.ExampleLauncher(context);
    }
    /**
     * Get the section name for identification
     */
    getSectionName() {
        return 'babiaExamples';
    }
    /**
     * Get the section header item
     */
    getSectionItem() {
        return new babiaExampleItems_1.BabiaExampleTreeItem('BABIA EXAMPLES', vscode.TreeItemCollapsibleState.Collapsed, 'no-examples', // Using this as section header type
        undefined, new vscode.ThemeIcon('library'), 'Interactive visualization examples', undefined, 'babiaExamplesSection');
    }
    /**
     * Get children items for the Babia Examples section
     */
    async getChildren(element) {
        // If element is provided, it means we're getting children for a specific item
        // For the Babia Examples section, we only have flat items, so return empty for sub-items
        if (element) {
            return [];
        }
        console.log('BABIA_EXAMPLES_MODULAR: Loading Babia examples section children');
        try {
            const examples = await this.exampleLauncher.getExamples();
            if (examples.length === 0) {
                console.log('BABIA_EXAMPLES_MODULAR: No examples found');
                return [babiaExampleItems_1.BabiaExampleItemFactory.createNoExamplesItem()];
            }
            console.log(`BABIA_EXAMPLES_MODULAR: Found ${examples.length} examples`);
            // Create sorted example items
            const children = babiaExampleItems_1.BabiaExampleItemFactory.createSortedExampleItems(examples);
            console.log(`BABIA_EXAMPLES_MODULAR: Returning ${children.length} children for Babia Examples section`);
            return children;
        }
        catch (error) {
            console.error('BABIA_EXAMPLES_MODULAR: Error loading Babia examples:', error);
            return [babiaExampleItems_1.BabiaExampleItemFactory.createErrorItem()];
        }
    }
    /**
     * Refresh the section
     */
    refresh() {
        console.log('BABIA_EXAMPLES_MODULAR: Refreshing Babia Examples section');
        this._onDidChangeTreeData.fire();
    }
    /**
     * Handle item clicks (additional method for interaction)
     */
    async handleClick(item) {
        await this.clickHandler.handleBabiaExampleClick(item);
    }
    /**
     * Handle context menu actions (additional method for interaction)
     */
    async handleContextMenu(action, item) {
        await this.clickHandler.handleContextMenuAction(action, item);
    }
}
exports.BabiaExamplesSectionProvider = BabiaExamplesSectionProvider;
//# sourceMappingURL=BabiaExamplesSectionProvider.js.map