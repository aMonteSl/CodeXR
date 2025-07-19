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
exports.VisualizationSettingsSectionProvider = void 0;
const vscode = __importStar(require("vscode"));
const visualizationSettingsItems_1 = require("./items/visualizationSettingsItems");
const handleVisualizationSettingsClicks_1 = require("./interactions/handleVisualizationSettingsClicks");
const settingsStorage_1 = require("../../visualization_settings/storage/settingsStorage");
/**
 * Visualization Settings section provider - manages visualization rendering preferences
 */
class VisualizationSettingsSectionProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    clickHandler;
    visualizationSettingsStorage;
    constructor(context) {
        this.context = context;
        console.log('VISUALIZATION_SETTINGS_MODULAR: Initializing Visualization Settings section provider');
        this.clickHandler = new handleVisualizationSettingsClicks_1.VisualizationSettingsClickHandler(context);
        this.visualizationSettingsStorage = new settingsStorage_1.VisualizationSettingsStorage(context);
    }
    /**
     * Get the section name for identification
     */
    getSectionName() {
        return 'visualizationSettings';
    }
    /**
     * Get the section header item
     */
    getSectionItem() {
        return new visualizationSettingsItems_1.VisualizationSettingsModularTreeItem('VISUALIZATION SETTINGS', vscode.TreeItemCollapsibleState.Collapsed, 'error', // Using this as section header type
        undefined, new vscode.ThemeIcon('settings-gear'), 'Configure visualization rendering preferences', undefined, 'visualizationSettingsSection');
    }
    /**
     * Get children items for the Visualization Settings section
     */
    async getChildren(element) {
        // If element is provided, it means we're getting children for a specific item
        // For the Visualization Settings section, we only have flat items, so return empty for sub-items
        if (element) {
            return [];
        }
        console.log('VISUALIZATION_SETTINGS_MODULAR: Loading visualization settings section children with dynamic color icons');
        try {
            const currentSettings = this.visualizationSettingsStorage.getSettings();
            console.log(`VISUALIZATION_SETTINGS_MODULAR: Loading settings for dynamic icons: ${JSON.stringify(currentSettings)}`);
            const children = await visualizationSettingsItems_1.VisualizationSettingsModularItemFactory.createVisualizationSettingsItems(currentSettings, this.context);
            console.log(`VISUALIZATION_SETTINGS_MODULAR: Created ${children.length} visualization settings items with dynamic icons`);
            return children;
        }
        catch (error) {
            console.error('VISUALIZATION_SETTINGS_MODULAR: Error loading visualization settings items:', error);
            return [visualizationSettingsItems_1.VisualizationSettingsModularItemFactory.createErrorItem()];
        }
    }
    /**
     * Refresh the section
     */
    refresh() {
        console.log('VISUALIZATION_SETTINGS_MODULAR: Refreshing Visualization Settings section');
        this._onDidChangeTreeData.fire();
    }
    /**
     * Handle item clicks (additional method for interaction)
     */
    async handleClick(item) {
        await this.clickHandler.handleVisualizationSettingsClick(item);
    }
    /**
     * Handle context menu actions (additional method for interaction)
     */
    async handleContextMenu(action, item) {
        await this.clickHandler.handleContextMenuAction(action, item);
    }
    /**
     * Get current settings (for external access)
     */
    getCurrentSettings() {
        return this.visualizationSettingsStorage.getSettings();
    }
    /**
     * Update a single setting (for external access)
     */
    async updateSetting(key, value) {
        await this.visualizationSettingsStorage.updateSetting(key, value);
        this.refresh();
    }
}
exports.VisualizationSettingsSectionProvider = VisualizationSettingsSectionProvider;
//# sourceMappingURL=VisualizationSettingsSectionProvider.js.map