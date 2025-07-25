import * as vscode from 'vscode';
import { SectionProvider } from '../common/baseInterfaces';
import { VisualizeDataModularTreeItem, VisualizeDataModularItemFactory } from './items/visualizeDataItems';
import { VisualizeDataClickHandler } from './interactions/handleVisualizeDataClicks';
import { VisualizeDataStateManager } from '../../visualize_data/state/visualizeDataState';

/**
 * Visualize Data section provider - manages data visualization configuration and launch
 */
export class VisualizeDataSectionProvider implements SectionProvider<VisualizeDataModularTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<VisualizeDataModularTreeItem | undefined | null | void> = 
        new vscode.EventEmitter<VisualizeDataModularTreeItem | undefined | null | void>();
    
    readonly onDidChangeTreeData: vscode.Event<VisualizeDataModularTreeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private clickHandler: VisualizeDataClickHandler;

    constructor(private context: vscode.ExtensionContext) {
        console.log('VISUALIZE_DATA_MODULAR: Initializing Visualize Data section provider');
        this.clickHandler = new VisualizeDataClickHandler(context);
        
        // Listen to state changes if state manager is available
        if (VisualizeDataStateManager.hasInstance()) {
            const stateManager = VisualizeDataStateManager.getInstance(context);
            stateManager.onStateChanged(() => {
                console.log('VISUALIZE_DATA_MODULAR: Visualize data state changed, refreshing section');
                this.refresh();
            });
        }
    }

    /**
     * Get the section name for identification
     */
    getSectionName(): string {
        return 'visualizeData';
    }

    /**
     * Get the section header item
     */
    getSectionItem(): VisualizeDataModularTreeItem {
        return new VisualizeDataModularTreeItem(
            'VISUALIZE DATA',
            vscode.TreeItemCollapsibleState.Collapsed,
            'error', // Using this as section header type
            undefined,
            new vscode.ThemeIcon('open-preview', new vscode.ThemeColor('charts.foreground')),
            'Data visualization configuration and launch',
            undefined,
            'visualizeDataSection'
        );
    }

    /**
     * Get children items for the Visualize Data section
     */
    async getChildren(element?: VisualizeDataModularTreeItem): Promise<VisualizeDataModularTreeItem[]> {
        if (!element) {
            // Root level - return main visualize data items
            console.log('VISUALIZE_DATA_MODULAR: Loading visualize data section children');
            return VisualizeDataModularItemFactory.createVisualizeDataItems(this.context);
        }

        // Handle sub-items for collapsible sections
        switch (element.visualizeDataItemType) {
            case 'dimension-mapping':
                return this.getDimensionMappingChildren();
                
            case 'browse-visualizations':
                return this.getBrowseVisualizationChildren();
                
            default:
                // Most items don't have children
                return [];
        }
    }

    /**
     * Get dimension mapping children
     */
    private getDimensionMappingChildren(): VisualizeDataModularTreeItem[] {
        console.log('VISUALIZE_DATA_MODULAR: Loading dimension mapping children');

        try {
            // Get current state if available
            let state = undefined;
            if (VisualizeDataStateManager.hasInstance()) {
                const stateManager = VisualizeDataStateManager.getInstance(this.context);
                state = stateManager.getState();
            }

            return VisualizeDataModularItemFactory.createDimensionMappingItems(this.context, state);

        } catch (error) {
            console.error('VISUALIZE_DATA_MODULAR: Error loading dimension mapping items:', error);
            return [new VisualizeDataModularTreeItem(
                'Error loading dimensions',
                vscode.TreeItemCollapsibleState.None,
                'error',
                undefined,
                new vscode.ThemeIcon('error'),
                'Failed to load dimension items'
            )];
        }
    }

    /**
     * Get browse visualization children
     */
    private async getBrowseVisualizationChildren(): Promise<VisualizeDataModularTreeItem[]> {
        console.log('VISUALIZE_DATA_MODULAR: Loading browse visualization children');
        return VisualizeDataModularItemFactory.createBrowseVisualizationItems(this.context);
    }

    /**
     * Refresh the section
     */
    refresh(): void {
        console.log('VISUALIZE_DATA_MODULAR: Refreshing Visualize Data section');
        this._onDidChangeTreeData.fire();
    }

    /**
     * Handle item clicks (additional method for interaction)
     */
    async handleClick(item: VisualizeDataModularTreeItem): Promise<void> {
        await this.clickHandler.handleVisualizeDataClick(item);
    }

    /**
     * Handle context menu actions (additional method for interaction)
     */
    async handleContextMenu(action: string, item: VisualizeDataModularTreeItem): Promise<void> {
        await this.clickHandler.handleContextMenuAction(action, item);
    }
}
