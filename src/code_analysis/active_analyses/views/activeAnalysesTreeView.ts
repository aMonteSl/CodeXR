import * as vscode from 'vscode';
import { ActiveAnalysisRegistry } from '../registry/activeAnalysisRegistry';
import { ActiveAnalysisTreeItem, ActiveAnalysisItemFactory } from '../items/activeAnalysisItems';
import { CodeAnalysisTreeItem } from '../../views/items/analysisTreeItems';

/**
 * Tree data provider for the Active Analyses section
 * This handles the rendering and management of the Active Analyses tree view
 */
export class ActiveAnalysesTreeDataProvider implements vscode.TreeDataProvider<ActiveAnalysisTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ActiveAnalysisTreeItem | undefined | null | void> = 
        new vscode.EventEmitter<ActiveAnalysisTreeItem | undefined | null | void>();
    
    readonly onDidChangeTreeData: vscode.Event<ActiveAnalysisTreeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private registry: ActiveAnalysisRegistry;

    constructor(private context: vscode.ExtensionContext) {
        console.log('[ACTIVE_ANALYSES_TREE] Initializing Active Analyses tree data provider');
        
        // Get the registry instance
        this.registry = ActiveAnalysisRegistry.getInstance();
        
        // Listen for changes in the registry
        this.registry.onDidChangeAnalyses(() => {
            console.log('[ACTIVE_ANALYSES_TREE] Registry changed, refreshing tree view');
            this.refresh();
        });
    }

    /**
     * Refresh the tree view
     */
    refresh(): void {
        console.log('[ACTIVE_ANALYSES_TREE] Refreshing active analyses tree view');
        this._onDidChangeTreeData.fire();
    }

    /**
     * Get tree item representation
     */
    getTreeItem(element: ActiveAnalysisTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children for the tree view
     */
    getChildren(element?: ActiveAnalysisTreeItem): vscode.ProviderResult<ActiveAnalysisTreeItem[]> {
        console.log('[ACTIVE_ANALYSES_TREE_VIEW] 🌲 getChildren called, element:', element?.label);
        
        if (!element) {
            // Root level - return all active analyses
            const allAnalyses = this.registry.getAllAnalyses();
            console.log('[ACTIVE_ANALYSES_TREE_VIEW] 📊 Retrieved analyses from registry:', allAnalyses.length);
            
            const treeItems = ActiveAnalysisItemFactory.createActiveAnalysisItems(allAnalyses);
            
            console.log('[ACTIVE_ANALYSES_TREE_VIEW] 🔄 Created tree items:', treeItems.length);
            return treeItems;
        }
        
        // No children for individual analysis items
        return [];
    }

    /**
     * Get the active analyses items for display
     */
    private getActiveAnalysesItems(): ActiveAnalysisTreeItem[] {
        const analyses = this.registry.getAllAnalyses();
        console.log(`[ACTIVE_ANALYSES_TREE] Found ${analyses.length} active analyses`);
        
        // Create items for each analysis
        return ActiveAnalysisItemFactory.createActiveAnalysisItems(analyses);
    }

    /**
     * Get summary of active analyses for the parent tree view
     */
    getActiveAnalysesSummary(): string {
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
    getActiveAnalysesTreeItems(): CodeAnalysisTreeItem[] {
        const activeAnalysisItems = this.getActiveAnalysesItems();
        
        // Convert ActiveAnalysisTreeItem to CodeAnalysisTreeItem for compatibility
        return activeAnalysisItems.map(item => {
            return new CodeAnalysisTreeItem(
                item.label as string,
                item.collapsibleState || vscode.TreeItemCollapsibleState.None,
                'analysis-item', // Use generic analysis-item type for compatibility
                item.command,
                item.iconPath as vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | undefined,
                item.tooltip as string,
                item.description as string,
                item.contextValue
            );
        });
    }

    /**
     * Check if there are any active analyses
     */
    hasActiveAnalyses(): boolean {
        return this.registry.getAllAnalyses().length > 0;
    }

    /**
     * Get count of running analyses
     */
    getRunningCount(): number {
        return this.registry.getActiveCount();
    }

    /**
     * Get count of total analyses
     */
    getTotalCount(): number {
        return this.registry.getAllAnalyses().length;
    }

    /**
     * Start tracking a new file analysis
     */
    startFileAnalysis(filePath: string, mode: 'Static' | 'XR', language?: string): string {
        console.log(`[ACTIVE_ANALYSES_TREE] Starting file analysis for ${filePath} in ${mode} mode`);
        return this.registry.startFileAnalysis(filePath, mode, language);
    }

    /**
     * Start tracking a new directory analysis
     */
    startDirectoryAnalysis(directoryPath: string, mode: 'Static' | 'XR'): string {
        console.log(`[ACTIVE_ANALYSES_TREE] Starting directory analysis for ${directoryPath} in ${mode} mode`);
        return this.registry.startDirectoryAnalysis(directoryPath, mode);
    }

    /**
     * Complete an analysis
     */
    completeAnalysis(analysisId: string, metadata?: any): void {
        console.log(`[ACTIVE_ANALYSES_TREE] Completing analysis ${analysisId}`);
        this.registry.completeAnalysis(analysisId, metadata);
    }

    /**
     * Fail an analysis
     */
    failAnalysis(analysisId: string, error: string): void {
        console.log(`[ACTIVE_ANALYSES_TREE] Failing analysis ${analysisId}: ${error}`);
        this.registry.failAnalysis(analysisId, error);
    }

    /**
     * Remove an analysis from tracking
     */
    removeAnalysis(analysisId: string): void {
        console.log(`[ACTIVE_ANALYSES_TREE] Removing analysis ${analysisId}`);
        this.registry.unregisterAnalysis(analysisId);
    }

    /**
     * Clear all analyses
     */
    clearAllAnalyses(): void {
        console.log('[ACTIVE_ANALYSES_TREE] Clearing all analyses');
        this.registry.clearAll();
    }
}
