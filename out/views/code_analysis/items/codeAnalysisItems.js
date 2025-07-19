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
exports.CodeAnalysisModularItemFactory = exports.CodeAnalysisModularTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const analysisTreeItems_1 = require("../../../code_analysis/views/items/analysisTreeItems");
/**
 * Code Analysis tree items for the Code Analysis section
 */
class CodeAnalysisModularTreeItem extends vscode.TreeItem {
    codeAnalysisItemType;
    originalCodeAnalysisItem;
    constructor(label, collapsibleState, codeAnalysisItemType, command, iconPath, tooltip, description, contextValue, originalCodeAnalysisItem) {
        super(label, collapsibleState);
        this.codeAnalysisItemType = codeAnalysisItemType;
        this.originalCodeAnalysisItem = originalCodeAnalysisItem;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip || label;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.CodeAnalysisModularTreeItem = CodeAnalysisModularTreeItem;
/**
 * Factory for creating Code Analysis-related tree items
 */
class CodeAnalysisModularItemFactory {
    /**
     * Create "Error loading code analysis" message item
     */
    static createErrorItem() {
        console.log('CODE_ANALYSIS_MODULAR: Creating error loading code analysis item');
        return new CodeAnalysisModularTreeItem('Error loading code analysis', vscode.TreeItemCollapsibleState.None, 'error', undefined, new vscode.ThemeIcon('error'), 'Failed to load code analysis items');
    }
    /**
     * Create "Scanning files..." message item
     */
    static createScanningItem() {
        console.log('CODE_ANALYSIS_MODULAR: Creating scanning files item');
        return new CodeAnalysisModularTreeItem('Scanning files...', vscode.TreeItemCollapsibleState.None, 'scanning', undefined, new vscode.ThemeIcon('loading~spin'), 'Scanning workspace files for analysis');
    }
    /**
     * Create main code analysis section items
     */
    static createCodeAnalysisSections(filesByLanguage, isScanning, context) {
        console.log('CODE_ANALYSIS_MODULAR: Creating code analysis section items');
        if (isScanning) {
            return [CodeAnalysisModularItemFactory.createScanningItem()];
        }
        try {
            // Use the existing factory to get the sections with counts
            const analysisItems = analysisTreeItems_1.CodeAnalysisItemFactory.createCodeAnalysisSectionsWithCounts(filesByLanguage || undefined, isScanning);
            const children = analysisItems.map((item) => {
                // Handle iconPath type conversion
                const iconPath = typeof item.iconPath === 'string'
                    ? new vscode.ThemeIcon(item.iconPath)
                    : item.iconPath;
                // Handle tooltip type conversion
                const tooltip = typeof item.tooltip === 'string'
                    ? item.tooltip
                    : item.tooltip?.value || undefined;
                // Handle description type conversion
                const description = typeof item.description === 'string'
                    ? item.description
                    : undefined;
                // Determine collapsible state and item type
                let itemType = 'subsection';
                if (item.type === 'language-group') {
                    itemType = 'language-group';
                }
                else if (item.type === 'file-item') {
                    itemType = 'file-item';
                }
                return new CodeAnalysisModularTreeItem(typeof item.label === 'string' ? item.label : item.label?.label || 'Unknown', item.collapsibleState || vscode.TreeItemCollapsibleState.None, itemType, item.command, iconPath, tooltip, description, item.contextValue, item);
            });
            console.log(`CODE_ANALYSIS_MODULAR: Created ${children.length} code analysis section items`);
            return children;
        }
        catch (error) {
            console.error('CODE_ANALYSIS_MODULAR: Error creating code analysis sections:', error);
            return [CodeAnalysisModularItemFactory.createErrorItem()];
        }
    }
    /**
     * Create sub-items for a code analysis item (delegate to original provider)
     */
    static async createCodeAnalysisSubItems(item, codeAnalysisProvider) {
        console.log(`CODE_ANALYSIS_MODULAR: Creating sub-items for: ${item.label}`);
        try {
            // Delegate to the original code analysis provider
            const subItems = await codeAnalysisProvider.getChildren(item);
            const children = subItems.map((subItem) => {
                // Handle iconPath type conversion
                const iconPath = typeof subItem.iconPath === 'string'
                    ? new vscode.ThemeIcon(subItem.iconPath)
                    : subItem.iconPath;
                // Handle tooltip type conversion
                const tooltip = typeof subItem.tooltip === 'string'
                    ? subItem.tooltip
                    : subItem.tooltip?.value || undefined;
                // Handle description type conversion
                const description = typeof subItem.description === 'string'
                    ? subItem.description
                    : undefined;
                // Determine item type
                let itemType = 'subsection';
                if (subItem.type === 'language-group') {
                    itemType = 'language-group';
                }
                else if (subItem.type === 'file-item') {
                    itemType = 'file-item';
                }
                return new CodeAnalysisModularTreeItem(typeof subItem.label === 'string' ? subItem.label : subItem.label?.label || 'Unknown', subItem.collapsibleState || vscode.TreeItemCollapsibleState.None, itemType, subItem.command, iconPath, tooltip, description, subItem.contextValue, subItem);
            });
            console.log(`CODE_ANALYSIS_MODULAR: Created ${children.length} sub-items`);
            return children;
        }
        catch (error) {
            console.error('CODE_ANALYSIS_MODULAR: Error creating sub-items:', error);
            return [new CodeAnalysisModularTreeItem('Error loading sub-items', vscode.TreeItemCollapsibleState.None, 'error', undefined, new vscode.ThemeIcon('error'), 'Failed to load code analysis sub-items')];
        }
    }
}
exports.CodeAnalysisModularItemFactory = CodeAnalysisModularItemFactory;
//# sourceMappingURL=codeAnalysisItems.js.map