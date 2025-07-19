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
exports.ActiveAnalysesTreeDataProvider = void 0;
const vscode = __importStar(require("vscode"));
const activeAnalysisRegistry_1 = require("../registry/activeAnalysisRegistry");
const activeAnalysisItems_1 = require("../items/activeAnalysisItems");
const analysisTreeItems_1 = require("../../views/items/analysisTreeItems");
/**
 * Tree data provider for the Active Analyses section
 * This handles the rendering and management of the Active Analyses tree view
 */
class ActiveAnalysesTreeDataProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    registry;
    constructor(context) {
        this.context = context;
        console.log('[ACTIVE_ANALYSES_TREE] Initializing Active Analyses tree data provider');
        // Get the registry instance
        this.registry = activeAnalysisRegistry_1.ActiveAnalysisRegistry.getInstance();
        // Listen for changes in the registry
        this.registry.onDidChangeAnalyses(() => {
            console.log('[ACTIVE_ANALYSES_TREE] Registry changed, refreshing tree view');
            this.refresh();
        });
    }
    /**
     * Refresh the tree view
     */
    refresh() {
        console.log('[ACTIVE_ANALYSES_TREE] Refreshing active analyses tree view');
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
    getChildren(element) {
        console.log('[ACTIVE_ANALYSES_TREE_VIEW] 🌲 getChildren called, element:', element?.label);
        if (!element) {
            // Root level - return all active analyses
            const allAnalyses = this.registry.getAllAnalyses();
            console.log('[ACTIVE_ANALYSES_TREE_VIEW] 📊 Retrieved analyses from registry:', allAnalyses.length);
            const treeItems = activeAnalysisItems_1.ActiveAnalysisItemFactory.createActiveAnalysisItems(allAnalyses);
            console.log('[ACTIVE_ANALYSES_TREE_VIEW] 🔄 Created tree items:', treeItems.length);
            return treeItems;
        }
        // No children for individual analysis items
        return [];
    }
    /**
     * Get the active analyses items for display
     */
    getActiveAnalysesItems() {
        const analyses = this.registry.getAllAnalyses();
        console.log(`[ACTIVE_ANALYSES_TREE] Found ${analyses.length} active analyses`);
        // Create items for each analysis
        return activeAnalysisItems_1.ActiveAnalysisItemFactory.createActiveAnalysisItems(analyses);
    }
    /**
     * Get summary of active analyses for the parent tree view
     */
    getActiveAnalysesSummary() {
        const summary = this.registry.getSummary();
        if (summary.total === 0) {
            return 'Active Analyses';
        }
        if (summary.running > 0) {
            return `Active Analyses (${summary.running} running)`;
        }
        return `Active Analyses (${summary.total} total)`;
    }
    /**
     * Get the tree items that should be displayed when this section is expanded
     * This method is called by the parent code analysis tree view
     * Returns CodeAnalysisTreeItem for compatibility with parent tree
     */
    getActiveAnalysesTreeItems() {
        const activeAnalysisItems = this.getActiveAnalysesItems();
        // Convert ActiveAnalysisTreeItem to CodeAnalysisTreeItem for compatibility
        return activeAnalysisItems.map(item => {
            return new analysisTreeItems_1.CodeAnalysisTreeItem(item.label, item.collapsibleState || vscode.TreeItemCollapsibleState.None, 'analysis-item', // Use generic analysis-item type for compatibility
            item.command, item.iconPath, item.tooltip, item.description, item.contextValue);
        });
    }
    /**
     * Check if there are any active analyses
     */
    hasActiveAnalyses() {
        return this.registry.getAllAnalyses().length > 0;
    }
    /**
     * Get count of running analyses
     */
    getRunningCount() {
        return this.registry.getActiveCount();
    }
    /**
     * Get count of total analyses
     */
    getTotalCount() {
        return this.registry.getAllAnalyses().length;
    }
    /**
     * Start tracking a new file analysis
     */
    startFileAnalysis(filePath, mode, language) {
        console.log(`[ACTIVE_ANALYSES_TREE] Starting file analysis for ${filePath} in ${mode} mode`);
        return this.registry.startFileAnalysis(filePath, mode, language);
    }
    /**
     * Start tracking a new directory analysis
     */
    startDirectoryAnalysis(directoryPath, mode) {
        console.log(`[ACTIVE_ANALYSES_TREE] Starting directory analysis for ${directoryPath} in ${mode} mode`);
        return this.registry.startDirectoryAnalysis(directoryPath, mode);
    }
    /**
     * Complete an analysis
     */
    completeAnalysis(analysisId, metadata) {
        console.log(`[ACTIVE_ANALYSES_TREE] Completing analysis ${analysisId}`);
        this.registry.completeAnalysis(analysisId, metadata);
    }
    /**
     * Fail an analysis
     */
    failAnalysis(analysisId, error) {
        console.log(`[ACTIVE_ANALYSES_TREE] Failing analysis ${analysisId}: ${error}`);
        this.registry.failAnalysis(analysisId, error);
    }
    /**
     * Remove an analysis from tracking
     */
    removeAnalysis(analysisId) {
        console.log(`[ACTIVE_ANALYSES_TREE] Removing analysis ${analysisId}`);
        this.registry.unregisterAnalysis(analysisId);
    }
    /**
     * Clear all analyses
     */
    clearAllAnalyses() {
        console.log('[ACTIVE_ANALYSES_TREE] Clearing all analyses');
        this.registry.clearAll();
    }
}
exports.ActiveAnalysesTreeDataProvider = ActiveAnalysesTreeDataProvider;
//# sourceMappingURL=activeAnalysesTreeView.js.map