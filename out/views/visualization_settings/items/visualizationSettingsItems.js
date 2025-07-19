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
exports.VisualizationSettingsModularItemFactory = exports.VisualizationSettingsModularTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const visualizationSettingsItems_1 = require("../../../visualization_settings/views/items/visualizationSettingsItems");
/**
 * Visualization Settings tree items for the Visualization Settings section
 */
class VisualizationSettingsModularTreeItem extends vscode.TreeItem {
    visualizationSettingsItemType;
    originalSettingsItem;
    constructor(label, collapsibleState, visualizationSettingsItemType, command, iconPath, tooltip, description, contextValue, originalSettingsItem) {
        super(label, collapsibleState);
        this.visualizationSettingsItemType = visualizationSettingsItemType;
        this.originalSettingsItem = originalSettingsItem;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip || label;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.VisualizationSettingsModularTreeItem = VisualizationSettingsModularTreeItem;
/**
 * Factory for creating Visualization Settings-related tree items
 */
class VisualizationSettingsModularItemFactory {
    /**
     * Create "Error loading settings" message item
     */
    static createErrorItem() {
        console.log('VISUALIZATION_SETTINGS_MODULAR: Creating error loading settings item');
        return new VisualizationSettingsModularTreeItem('Error loading settings', vscode.TreeItemCollapsibleState.None, 'error', undefined, new vscode.ThemeIcon('error'), 'Failed to load visualization settings');
    }
    /**
     * Create visualization settings items with dynamic color icons
     */
    static async createVisualizationSettingsItems(settings, context) {
        console.log('VISUALIZATION_SETTINGS_MODULAR: Creating visualization settings items with dynamic color icons');
        try {
            const settingsItems = await visualizationSettingsItems_1.VisualizationSettingsItemFactory.createVisualizationSettingsItems(settings, context);
            const children = settingsItems.map(item => {
                return new VisualizationSettingsModularTreeItem(item.label, vscode.TreeItemCollapsibleState.None, 'settings-field', item.command, item.iconPath, item.tooltip, item.description, item.contextValue, item);
            });
            console.log(`VISUALIZATION_SETTINGS_MODULAR: Created ${children.length} visualization settings items with dynamic icons`);
            return children;
        }
        catch (error) {
            console.error('VISUALIZATION_SETTINGS_MODULAR: Error creating visualization settings items:', error);
            return [VisualizationSettingsModularItemFactory.createErrorItem()];
        }
    }
}
exports.VisualizationSettingsModularItemFactory = VisualizationSettingsModularItemFactory;
//# sourceMappingURL=visualizationSettingsItems.js.map