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
exports.TreeViewUtils = exports.ModularTreeItem = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Base tree item for modular sections
 */
class ModularTreeItem extends vscode.TreeItem {
    sectionType;
    itemType;
    // Server-specific properties for compatibility
    serverItemType;
    // Active Server-specific properties for compatibility
    activeServerItemType;
    activeServer;
    // Babia Examples-specific properties for compatibility
    babiaItemType;
    babiaExample;
    // Visualize Data-specific properties for compatibility
    visualizeDataItemType;
    visualizeDataItem;
    // Code Analysis-specific properties for compatibility
    codeAnalysisItemType;
    originalCodeAnalysisItem;
    // Visualization Settings-specific properties for compatibility
    visualizationSettingsItemType;
    originalSettingsItem;
    constructor(label, collapsibleState, sectionType, itemType, command, iconPath, tooltip, description, contextValue) {
        super(label, collapsibleState);
        this.sectionType = sectionType;
        this.itemType = itemType;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip || label;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.ModularTreeItem = ModularTreeItem;
/**
 * Common tree view utilities
 */
class TreeViewUtils {
    /**
     * Create a standard error item
     */
    static createErrorItem(message, sectionType) {
        return new ModularTreeItem(message, vscode.TreeItemCollapsibleState.None, sectionType, 'error', undefined, new vscode.ThemeIcon('error'), `Error: ${message}`, 'Error');
    }
    /**
     * Create a standard loading item
     */
    static createLoadingItem(message, sectionType) {
        return new ModularTreeItem(message, vscode.TreeItemCollapsibleState.None, sectionType, 'loading', undefined, new vscode.ThemeIcon('loading~spin'), `Loading: ${message}`, 'Loading...');
    }
    /**
     * Create a standard info item
     */
    static createInfoItem(message, sectionType) {
        return new ModularTreeItem(message, vscode.TreeItemCollapsibleState.None, sectionType, 'info', undefined, new vscode.ThemeIcon('info'), message);
    }
}
exports.TreeViewUtils = TreeViewUtils;
//# sourceMappingURL=baseInterfaces.js.map