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
exports.ExampleIcons = exports.ExampleItemFactory = exports.BabiaExampleTreeItem = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Tree item for Babia examples display
 */
class BabiaExampleTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    type;
    command;
    iconPath;
    tooltip;
    description;
    contextValue;
    example;
    constructor(label, collapsibleState, type, command, iconPath, tooltip, description, contextValue, example) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.type = type;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip;
        this.description = description;
        this.contextValue = contextValue;
        this.example = example;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.BabiaExampleTreeItem = BabiaExampleTreeItem;
/**
 * Example item factory for creating tree items
 */
class ExampleItemFactory {
    /**
     * Create tree item for a Babia example
     */
    static createExampleItem(example) {
        const command = {
            command: 'codeXR.babiaExamples.launchExample',
            title: 'Launch Example',
            arguments: [example]
        };
        const icon = ExampleIcons.getExampleIcon(example.category);
        const tooltip = ExampleItemFactory.createTooltip(example);
        const description = example.isValid ? undefined : '(Invalid)';
        return new BabiaExampleTreeItem(example.name, vscode.TreeItemCollapsibleState.None, 'example', command, icon, tooltip, description, example.isValid ? 'validExample' : 'invalidExample', example);
    }
    /**
     * Create "No examples found" item
     */
    static createNoExamplesItem() {
        return new BabiaExampleTreeItem('No examples found', vscode.TreeItemCollapsibleState.None, 'noExamples', undefined, new vscode.ThemeIcon('info'), 'No Babia examples were found in examples/charts/', undefined, 'noExamples');
    }
    /**
     * Create loading item
     */
    static createLoadingItem() {
        return new BabiaExampleTreeItem('Loading examples...', vscode.TreeItemCollapsibleState.None, 'loading', undefined, new vscode.ThemeIcon('loading~spin'), 'Scanning for Babia examples', undefined, 'loading');
    }
    /**
     * Create tooltip for example
     * @private
     */
    static createTooltip(example) {
        const lines = [
            `Example: ${example.name}`,
            `Category: ${example.category}`,
            `File: ${example.htmlFilePath}`
        ];
        if (example.description) {
            lines.push(`Description: ${example.description}`);
        }
        if (!example.isValid) {
            lines.push('⚠️ This example has issues and may not work properly');
        }
        else {
            lines.push('✅ Click to launch this example');
        }
        return lines.join('\\n');
    }
}
exports.ExampleItemFactory = ExampleItemFactory;
/**
 * Example icons utility
 */
class ExampleIcons {
    /**
     * Get appropriate icon for example category
     */
    static getExampleIcon(category) {
        switch (category.toLowerCase()) {
            case 'pie':
                return new vscode.ThemeIcon('pie-chart');
            case 'bar-chart':
            case 'barsmap':
                return new vscode.ThemeIcon('graph');
            case 'bubble-chart':
                return new vscode.ThemeIcon('circle-large-outline');
            case 'cylinder-chart':
            case 'cylindermap-chart':
                return new vscode.ThemeIcon('package');
            case 'mix':
                return new vscode.ThemeIcon('combine');
            default:
                return new vscode.ThemeIcon('file-code');
        }
    }
    /**
     * Get section icon
     */
    static getSectionIcon() {
        return new vscode.ThemeIcon('library');
    }
}
exports.ExampleIcons = ExampleIcons;
//# sourceMappingURL=exampleItems.js.map