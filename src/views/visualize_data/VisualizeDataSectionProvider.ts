import * as vscode from 'vscode';
import { SectionProvider } from '../common/baseInterfaces';
import { VisualizeDataModularTreeItem, VisualizeDataModularItemFactory } from './items/visualizeDataItems';
import { VisualizeDataClickHandler } from './interactions/handleVisualizeDataClicks';
import { VisualizeDataStateManager } from '../../visualize_data/state/visualizeDataState';
import { VisualizeDataModel } from '../../visualize_data/model/visualizeDataModel';

/**
 * Visualize Data section provider - manages data visualization configuration and launch
 */
export class VisualizeDataSectionProvider implements SectionProvider<VisualizeDataModularTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<VisualizeDataModularTreeItem | undefined | null | void> =
        new vscode.EventEmitter<VisualizeDataModularTreeItem | undefined | null | void>();

    readonly onDidChangeTreeData: vscode.Event<VisualizeDataModularTreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private clickHandler: VisualizeDataClickHandler;
    private stateSubscription: vscode.Disposable | null = null;

    constructor(private context: vscode.ExtensionContext) {
        this.clickHandler = new VisualizeDataClickHandler(context);
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
            'error',
            undefined,
            new vscode.ThemeIcon('open-preview', new vscode.ThemeColor('charts.foreground')),
            'Data visualization configuration and launch',
            undefined,
            'visualizeDataSection',
        );
    }

    /**
     * Get children items for the Visualize Data section
     */
    async getChildren(element?: VisualizeDataModularTreeItem): Promise<VisualizeDataModularTreeItem[]> {
        this.ensureStateSubscription();
        VisualizeDataModel.validateAndCleanState(this.context);

        if (!element) {
            return VisualizeDataModularItemFactory.createVisualizeDataItems(this.context);
        }

        switch (element.visualizeDataItemType) {
            case 'dimension-mapping':
                return this.getDimensionMappingChildren();
            case 'browse-visualizations':
                return this.getBrowseVisualizationChildren();
            default:
                return [];
        }
    }

    /**
     * Get dimension mapping children
     */
    private getDimensionMappingChildren(): VisualizeDataModularTreeItem[] {
        let state = undefined;
        if (VisualizeDataStateManager.hasInstance()) {
            const stateManager = VisualizeDataStateManager.getInstance(this.context);
            state = stateManager.getState();
        }

        return VisualizeDataModularItemFactory.createDimensionMappingItems(this.context, state);
    }

    /**
     * Get browse visualization children
     */
    private async getBrowseVisualizationChildren(): Promise<VisualizeDataModularTreeItem[]> {
        return VisualizeDataModularItemFactory.createBrowseVisualizationItems(this.context);
    }

    /**
     * Refresh the section
     */
    refresh(): void {
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

    /**
     * Get current settings (for external access)
     */
    getCurrentSettings() {
        if (!VisualizeDataStateManager.hasInstance()) {
            return undefined;
        }

        return VisualizeDataStateManager.getInstance(this.context).getState();
    }

    /**
     * Update a single setting (for external access)
     */
    async updateSetting(key: string, value: any): Promise<void> {
        void key;
        void value;
        this.refresh();
    }

    dispose(): void {
        this.stateSubscription?.dispose();
        this.stateSubscription = null;
    }

    private ensureStateSubscription(): void {
        if (this.stateSubscription) {
            return;
        }

        const stateManager = VisualizeDataStateManager.getInstance(this.context);
        this.stateSubscription = stateManager.onStateChanged(() => {
            this.refresh();
        });
    }
}
