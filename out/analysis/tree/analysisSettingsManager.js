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
exports.TreeDisplayConfigItem = exports.AnalysisSettingsManager = void 0;
const vscode = __importStar(require("vscode"));
const baseItems_1 = require("../../ui/treeItems/baseItems");
const treeProvider_1 = require("../../ui/treeProvider");
const dimensionMappingTreeItem_1 = require("./dimensionMappingTreeItem");
const treeDisplayConfig_1 = require("./treeDisplayConfig");
const analysisTreeItems_1 = require("./analysisTreeItems");
/**
 * Manages analysis settings and provides tree items for configuration
 */
class AnalysisSettingsManager {
    context;
    constructor(context) {
        this.context = context;
    }
    /**
     * Gets current analysis settings from VS Code configuration
     */
    async getCurrentSettings() {
        const config = vscode.workspace.getConfiguration();
        return {
            mode: config.get('codexr.analysisMode', 'XR'), // ✅ CHANGED: Default from 'Static' to 'XR'
            debounceDelay: config.get('codexr.analysis.debounceDelay', 2000),
            autoAnalysis: config.get('codexr.analysis.autoAnalysis', true),
            chartType: this.context.globalState.get('codexr.analysis.chartType') ||
                config.get('codexr.analysis.chartType', 'boats')
        };
    }
    /**
     * Gets all settings children tree items
     */
    async getSettingsChildren() {
        const settings = await this.getCurrentSettings();
        const extensionPath = this.context.extensionPath;
        const items = [];
        // Analysis Mode Setting (Fixed to work properly)
        items.push(new analysisTreeItems_1.AnalysisModeOptionItem(settings.mode, settings.mode === 'Static', // This will be used to show current selection
        extensionPath));
        // Debounce Delay Setting
        items.push(new analysisTreeItems_1.AnalysisDelayOptionItem(settings.debounceDelay, extensionPath));
        // Auto-Analysis Toggle
        items.push(new analysisTreeItems_1.AnalysisAutoOptionItem(settings.autoAnalysis, extensionPath));
        // Chart Type Setting
        items.push(new analysisTreeItems_1.AnalysisChartTypeOptionItem(settings.chartType, extensionPath));
        // Dimension Mapping Setting
        items.push(new dimensionMappingTreeItem_1.DimensionMappingItem(settings.chartType, extensionPath, this.context));
        // Tree Display Configuration
        items.push(new TreeDisplayConfigItem(extensionPath, this.context));
        // Reset to Defaults
        items.push(new analysisTreeItems_1.AnalysisResetItem(extensionPath));
        return items;
    }
    /**
     * Updates a specific setting
     */
    async updateSetting(settingKey, value, isGlobalState = false) {
        if (isGlobalState) {
            await this.context.globalState.update(settingKey, value);
        }
        else {
            const config = vscode.workspace.getConfiguration();
            await config.update(settingKey, value, vscode.ConfigurationTarget.Global);
        }
    }
    /**
     * Resets all settings to defaults
     */
    async resetToDefaults() {
        try {
            const config = vscode.workspace.getConfiguration();
            // ✅ FIXED: Only reset registered VS Code configuration properties
            await config.update('codexr.analysisMode', 'XR', vscode.ConfigurationTarget.Global);
            await config.update('codexr.analysis.debounceDelay', 2000, vscode.ConfigurationTarget.Global);
            await config.update('codexr.analysis.autoAnalysis', true, vscode.ConfigurationTarget.Global);
            await config.update('codexr.analysis.chartType', 'boats', vscode.ConfigurationTarget.Global);
            // ✅ FIXED: Reset tree display settings with registered configuration keys
            await config.update('codexr.analysis.tree.maxFilesPerLanguage', 0, vscode.ConfigurationTarget.Global);
            await config.update('codexr.analysis.tree.languageSortMethod', 'fileCount', vscode.ConfigurationTarget.Global);
            await config.update('codexr.analysis.tree.languageSortDirection', 'descending', vscode.ConfigurationTarget.Global);
            await config.update('codexr.analysis.tree.fileSortMethod', 'alphabetical', vscode.ConfigurationTarget.Global);
            await config.update('codexr.analysis.tree.fileSortDirection', 'ascending', vscode.ConfigurationTarget.Global);
            // ✅ FIXED: Reset global state items (not VS Code configuration)
            await this.context.globalState.update('codexr.analysis.chartType', 'boats');
            // ✅ FIXED: Reset dimension mappings for all chart types
            const chartTypes = ['boats', 'bars', 'cylinders', 'pie', 'donut', 'barsmap'];
            for (const chartType of chartTypes) {
                await this.context.globalState.update(`codexr.analysis.dimensionMapping.${chartType}`, undefined);
            }
            console.log('✅ All analysis settings reset to defaults (XR mode, 2000ms delay, auto-analysis enabled)');
        }
        catch (error) {
            console.error('❌ Error resetting analysis settings:', error);
            throw error; // Re-throw to be handled by the command
        }
    }
}
exports.AnalysisSettingsManager = AnalysisSettingsManager;
/**
 * ✅ UPDATED: Tree item for tree display configuration with new sorting system
 */
class TreeDisplayConfigItem extends baseItems_1.TreeItem {
    context;
    constructor(extensionPath, context) {
        const config = (0, treeDisplayConfig_1.getTreeDisplayConfig)(context);
        // Create descriptive label showing current settings
        const languageSortText = (0, treeDisplayConfig_1.getSortMethodDisplayText)(config.languageSortMethod, config.languageSortDirection);
        const fileSortText = (0, treeDisplayConfig_1.getSortMethodDisplayText)(config.fileSortMethod, config.fileSortDirection);
        const limitText = config.maxFilesPerLanguage === 0 ? 'unlimited' : `max ${config.maxFilesPerLanguage}`;
        super('Tree Display Settings', `Configure how files are sorted and displayed in the tree`, treeProvider_1.TreeItemType.ANALYSIS_SETTING_OPTION, vscode.TreeItemCollapsibleState.None, {
            command: 'codexr.configureTreeDisplay',
            title: 'Configure Tree Display',
            arguments: []
        }, new vscode.ThemeIcon('settings-gear'));
        this.context = context;
        // ✅ SHOW CURRENT SETTINGS IN DESCRIPTION
        this.description = `${languageSortText} • ${fileSortText} • ${limitText}`;
        // ✅ DETAILED TOOLTIP
        this.tooltip = `Tree Display Settings
Languages: ${languageSortText}
Files: ${fileSortText}
Limit: ${limitText}

Click to configure sorting and display options`;
    }
}
exports.TreeDisplayConfigItem = TreeDisplayConfigItem;
//# sourceMappingURL=analysisSettingsManager.js.map