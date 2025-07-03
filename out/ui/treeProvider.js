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
exports.LocalServerProvider = exports.TreeItemType = void 0;
const vscode = __importStar(require("vscode"));
const baseItems_1 = require("./treeItems/baseItems");
const babiaTreeProvider_1 = require("../babiaxr/providers/babiaTreeProvider");
const serverTreeProvider_1 = require("../server/providers/serverTreeProvider");
const analysisTreeProvider_1 = require("../analysis/tree/analysisTreeProvider");
const settingsItems_1 = require("./treeItems/settingsItems");
const serverModel_1 = require("../server/models/serverModel");
const dimensionMappingTreeItem_1 = require("../analysis/tree/dimensionMappingTreeItem");
// Types of tree items for context handling - as string literals
var TreeItemType;
(function (TreeItemType) {
    TreeItemType["SERVER_SECTION"] = "SERVER_SECTION";
    TreeItemType["SERVER_CONFIG"] = "SERVER_CONFIG";
    TreeItemType["SERVER_STATUS"] = "SERVER_STATUS";
    TreeItemType["SERVERS_SECTION"] = "SERVERS_SECTION";
    TreeItemType["SERVERS_CONTAINER"] = "SERVERS_CONTAINER";
    TreeItemType["START_SERVER"] = "START_SERVER";
    TreeItemType["SERVER_MODE"] = "SERVER_MODE";
    TreeItemType["ACTIVE_SERVER"] = "ACTIVE_SERVER";
    TreeItemType["STOP_ALL_SERVERS"] = "STOP_ALL_SERVERS";
    TreeItemType["BABIAXR_SECTION"] = "BABIAXR_SECTION";
    TreeItemType["BABIAXR_CONFIG"] = "BABIAXR_CONFIG";
    TreeItemType["CREATE_VISUALIZATION"] = "CREATE_VISUALIZATION";
    TreeItemType["CHART_TYPE"] = "CHART_TYPE";
    TreeItemType["ANALYSIS_SECTION"] = "ANALYSIS_SECTION";
    TreeItemType["ANALYSIS_SETTINGS"] = "analysis_settings";
    TreeItemType["ANALYSIS_LANGUAGE_GROUP"] = "ANALYSIS_LANGUAGE_GROUP";
    TreeItemType["ANALYSIS_FILE"] = "ANALYSIS_FILE";
    TreeItemType["ANALYSIS_SETTING_OPTION"] = "analysis_setting_option";
    TreeItemType["ANALYSIS_MESSAGE"] = "ANALYSIS_MESSAGE";
    TreeItemType["ANALYSIS_RESET"] = "analysis_reset";
    TreeItemType["FILES_PER_LANGUAGE_CONTAINER"] = "FILES_PER_LANGUAGE_CONTAINER";
    TreeItemType["VISUALIZATION_SETTINGS"] = "VISUALIZATION_SETTINGS";
    TreeItemType["BABIAXR_EXAMPLES_CONTAINER"] = "BABIAXR_EXAMPLES_CONTAINER";
    TreeItemType["BABIAXR_EXAMPLE_CATEGORY"] = "BABIAXR_EXAMPLE_CATEGORY";
    TreeItemType["BABIAXR_EXAMPLE"] = "BABIAXR_EXAMPLE";
    TreeItemType["BABIAXR_CONFIG_ITEM"] = "BABIAXR_CONFIG_ITEM";
    TreeItemType["DIMENSION_MAPPING"] = "dimension_mapping";
    TreeItemType["DIMENSION_MAPPING_OPTION"] = "dimension_mapping_option";
    TreeItemType["ACTIVE_ANALYSES_SECTION"] = "ACTIVE_ANALYSES_SECTION";
    TreeItemType["ACTIVE_ANALYSIS"] = "ACTIVE_ANALYSIS";
})(TreeItemType || (exports.TreeItemType = TreeItemType = {}));
/**
 * Tree data provider implementation for the sidebar view
 */
class LocalServerProvider {
    // Event emitter to notify data changes
    _onDidChangeTreeData = new vscode.EventEmitter();
    // Event that VS Code listens to for view updates
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    // Extension context for storage access
    context;
    // Specialized tree providers
    babiaTreeProvider;
    serverTreeProvider;
    analysisTreeProvider;
    constructor(context) {
        this.context = context;
        // Initialize specialized providers
        this.babiaTreeProvider = new babiaTreeProvider_1.BabiaTreeProvider(context);
        this.serverTreeProvider = new serverTreeProvider_1.ServerTreeProvider(context);
        this.analysisTreeProvider = new analysisTreeProvider_1.AnalysisTreeProvider(context);
        // Subscribe to analysis tree provider changes
        this.analysisTreeProvider.onDidChangeTreeData(() => {
            console.log('🔄 Analysis tree data changed, refreshing main tree...');
            this.refresh();
        });
        // Initialize with default values if no previous configuration exists
        if (!this.context.globalState.get('serverMode')) {
            this.context.globalState.update('serverMode', serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS);
        }
        console.log('✅ LocalServerProvider initialized with automatic file system watching');
    }
    /**
     * Refreshes the tree view
     * @param element Optional element to refresh, or undefined to refresh all
     */
    refresh(element) {
        console.log('🔄 LocalServerProvider: Refreshing main tree view...');
        console.log(`🔄 LocalServerProvider: Refresh element type: ${element?.type || 'ROOT'}`);
        this._onDidChangeTreeData.fire(element);
        console.log('✅ LocalServerProvider: Main tree refresh event fired');
    }
    /**
     * Returns the UI element for an item
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Gets the child elements of an element or root elements
     */
    getChildren(element) {
        console.log(`🔍 [LocalServerProvider] getChildren called for: ${element ? `${element.type} - "${element.label}"` : 'ROOT'}`);
        // Root level items
        if (!element) {
            console.log('🏠 [LocalServerProvider] Returning root level items');
            return Promise.resolve([
                this.serverTreeProvider.getServersSectionItem(),
                new baseItems_1.TreeItem("BabiaXR Visualizations", "Create 3D data visualizations", TreeItemType.BABIAXR_SECTION, vscode.TreeItemCollapsibleState.Expanded, undefined, new vscode.ThemeIcon('graph')),
                new baseItems_1.TreeItem('Code Analysis', 'Analyze code metrics and complexity', TreeItemType.ANALYSIS_SECTION, vscode.TreeItemCollapsibleState.Expanded, undefined, new vscode.ThemeIcon('microscope')),
                new settingsItems_1.VisualizationSettingsItem(this.context)
            ]);
        }
        console.log(`🔍 [LocalServerProvider] Handling element type: ${element.type}`);
        switch (element.type) {
            case TreeItemType.SERVERS_SECTION:
                return this.serverTreeProvider.getServersChildren();
            case TreeItemType.SERVER_CONFIG:
                return this.serverTreeProvider.getServerConfigChildren();
            case TreeItemType.SERVERS_CONTAINER:
                return this.serverTreeProvider.getActiveServersChildren();
            case TreeItemType.BABIAXR_SECTION:
                return this.babiaTreeProvider.getBabiaXRChildren();
            case TreeItemType.CREATE_VISUALIZATION:
                return this.babiaTreeProvider.getCreateVisualizationChildren();
            case TreeItemType.BABIAXR_CONFIG:
                return this.babiaTreeProvider.getBabiaXRConfigChildren();
            case TreeItemType.BABIAXR_EXAMPLES_CONTAINER:
                console.log('🔍 [LocalServerProvider] Handling BABIAXR_EXAMPLES_CONTAINER, delegating to babiaTreeProvider');
                return this.babiaTreeProvider.getBabiaXRExamplesChildren();
            case TreeItemType.BABIAXR_EXAMPLE_CATEGORY:
                console.log('🔍 [LocalServerProvider] Handling BABIAXR_EXAMPLE_CATEGORY');
                // If element has children array, return it directly
                if (element.children && Array.isArray(element.children)) {
                    return Promise.resolve(element.children);
                }
                return Promise.resolve([]);
            case TreeItemType.ANALYSIS_SECTION:
                return this.analysisTreeProvider.getChildren(element);
            case TreeItemType.ACTIVE_ANALYSES_SECTION:
                console.log('🔍 [LocalServerProvider] Handling ACTIVE_ANALYSES_SECTION, delegating to analysisTreeProvider');
                return this.analysisTreeProvider.getChildren(element);
            case TreeItemType.ACTIVE_ANALYSIS:
                return this.analysisTreeProvider.getChildren(element);
            case TreeItemType.FILES_PER_LANGUAGE_CONTAINER:
                return this.analysisTreeProvider.getChildren(element);
            case TreeItemType.ANALYSIS_LANGUAGE_GROUP:
                return this.analysisTreeProvider.getChildren(element);
            case TreeItemType.ANALYSIS_SETTINGS:
                return this.analysisTreeProvider.getChildren(element);
            case TreeItemType.DIMENSION_MAPPING:
                // ✅ FIX: Check for DimensionMappingItem and call the correct method
                if (element instanceof dimensionMappingTreeItem_1.DimensionMappingItem) {
                    return element.getChildren();
                }
                return Promise.resolve([]);
            case TreeItemType.VISUALIZATION_SETTINGS:
                if (element instanceof settingsItems_1.VisualizationSettingsItem) {
                    return element.getChildren();
                }
                return Promise.resolve([]);
            default:
                return Promise.resolve([]);
        }
    }
    /**
     * Changes the server mode - delegated to ServerTreeProvider
     */
    async changeServerMode(mode) {
        await this.serverTreeProvider.changeServerMode(mode);
        this.refresh();
    }
    // Get file system watcher status for debugging
    getFileSystemWatcherStatus() {
        return this.analysisTreeProvider.getFileSystemWatcherStatus();
    }
    // Dispose method to cleanup resources
    dispose() {
        console.log('🧹 Disposing LocalServerProvider...');
        this.analysisTreeProvider.dispose();
    }
}
exports.LocalServerProvider = LocalServerProvider;
//# sourceMappingURL=treeProvider.js.map