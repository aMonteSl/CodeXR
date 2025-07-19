import * as vscode from 'vscode';
import { VisualizationRestorer, StoredVisualization } from '../runtime/visualizationRestorer';
import { BrowseVisualizationTreeItem, BrowseVisualizationItemFactory } from './items/visualizationItem';

/**
 * Browse Visualizations Tree Data Provider
 * Provides tree view data for browsing stored visualizations
 */
export class BrowseVisualizationsTreeDataProvider implements vscode.TreeDataProvider<BrowseVisualizationTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BrowseVisualizationTreeItem | undefined | null | void> = new vscode.EventEmitter<BrowseVisualizationTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<BrowseVisualizationTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private restorer: VisualizationRestorer;
    private visualizations: StoredVisualization[] = [];

    constructor(private context: vscode.ExtensionContext) {
        this.restorer = new VisualizationRestorer(context);
        console.log('BROWSE-VISUALIZATIONS: Tree data provider initialized');
        
        // Initial scan
        this.refresh();
    }

    /**
     * Refresh the tree view
     */
    public async refresh(): Promise<void> {
        console.log('BROWSE-VISUALIZATIONS: Refreshing tree view...');
        try {
            this.visualizations = await this.restorer.scanStoredVisualizations();
            this._onDidChangeTreeData.fire();
            console.log(`BROWSE-VISUALIZATIONS: Tree view refreshed with ${this.visualizations.length} visualizations`);
        } catch (error) {
            console.error('BROWSE-VISUALIZATIONS: Error refreshing tree view:', error);
        }
    }

    /**
     * Get tree item
     */
    getTreeItem(element: BrowseVisualizationTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children for tree view
     */
    getChildren(element?: BrowseVisualizationTreeItem): Thenable<BrowseVisualizationTreeItem[]> {
        if (!element) {
            // Root level - return Browse Visualizations section
            return Promise.resolve([BrowseVisualizationItemFactory.createBrowseVisualizationsSection()]);
        }

        if (element.type === 'browse-section') {
            // Return stored visualizations and reset option
            const visualizationItems = BrowseVisualizationItemFactory.createStoredVisualizationItems(this.visualizations);
            
            // Add reset button if there are visualizations
            if (this.visualizations.length > 0) {
                visualizationItems.push(BrowseVisualizationItemFactory.createResetAllItem());
            }
            
            return Promise.resolve(visualizationItems);
        }

        // No children for visualization items
        return Promise.resolve([]);
    }

    /**
     * Launch a visualization
     */
    public async launchVisualization(visualization: StoredVisualization): Promise<void> {
        console.log(`BROWSE-VISUALIZATIONS: Launch requested for: ${visualization.name}`);
        await this.restorer.launchVisualization(visualization);
    }

    /**
     * Reset all visualizations
     */
    public async resetAllVisualizations(): Promise<void> {
        console.log('BROWSE-VISUALIZATIONS: Reset all requested');
        await this.restorer.resetAllVisualizations();
        await this.refresh(); // Refresh the tree view after reset
    }

    /**
     * Get the visualization restorer instance
     */
    public getRestorer(): VisualizationRestorer {
        return this.restorer;
    }
}
