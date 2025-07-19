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
exports.BabiaExampleItemFactory = exports.BabiaExampleTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const exampleItems_1 = require("../../../babia_examples/views/items/exampleItems");
/**
 * Babia Example tree items for the Babia Examples section
 */
class BabiaExampleTreeItem extends vscode.TreeItem {
    babiaItemType;
    babiaExample;
    constructor(label, collapsibleState, babiaItemType, command, iconPath, tooltip, description, contextValue, babiaExample) {
        super(label, collapsibleState);
        this.babiaItemType = babiaItemType;
        this.babiaExample = babiaExample;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip || label;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.BabiaExampleTreeItem = BabiaExampleTreeItem;
/**
 * Factory for creating Babia example-related tree items
 */
class BabiaExampleItemFactory {
    /**
     * Create "No examples found" message item
     */
    static createNoExamplesItem() {
        console.log('BABIA_EXAMPLES: Creating "No examples found" message item');
        return new BabiaExampleTreeItem('No examples found', vscode.TreeItemCollapsibleState.None, 'no-examples', undefined, new vscode.ThemeIcon('warning'), 'No Babia examples are available');
    }
    /**
     * Create "Error loading examples" message item
     */
    static createErrorItem() {
        console.log('BABIA_EXAMPLES: Creating error loading examples item');
        return new BabiaExampleTreeItem('Error loading examples', vscode.TreeItemCollapsibleState.None, 'error', undefined, new vscode.ThemeIcon('error'), 'Failed to load Babia examples');
    }
    /**
     * Create individual Babia example item
     */
    static createExampleItem(example) {
        console.log(`BABIA_EXAMPLES: Creating example item: ${example.name} (${example.category})`);
        const icon = BabiaExampleItemFactory.getExampleIcon(example);
        const statusSuffix = example.isValid ? '' : ' (Invalid)';
        const label = `${example.name}${statusSuffix}`;
        // Create command to launch example (only if valid)
        const command = example.isValid ? {
            command: 'codeXR.babiaExamples.launchExample',
            title: 'Launch Example',
            arguments: [example]
        } : undefined;
        const tooltip = example.isValid ?
            `${example.category} example - Click to launch` :
            `${example.category} example - Invalid configuration`;
        return new BabiaExampleTreeItem(label, vscode.TreeItemCollapsibleState.None, 'example-item', command, icon, tooltip, example.category, 'babia-example', example);
    }
    /**
     * Get the appropriate icon for a Babia example
     */
    static getExampleIcon(example) {
        // Use the existing ExampleIcons mapping
        return exampleItems_1.ExampleIcons.getExampleIcon(example.category);
    }
    /**
     * Create sorted example items from a list of examples
     */
    static createSortedExampleItems(examples) {
        console.log(`BABIA_EXAMPLES: Creating sorted tree items for ${examples.length} examples`);
        // Sort examples by category and name
        const sortedExamples = examples.sort((a, b) => {
            if (a.category !== b.category) {
                return a.category.localeCompare(b.category);
            }
            return a.name.localeCompare(b.name);
        });
        return sortedExamples.map(example => BabiaExampleItemFactory.createExampleItem(example));
    }
}
exports.BabiaExampleItemFactory = BabiaExampleItemFactory;
//# sourceMappingURL=babiaExampleItems.js.map