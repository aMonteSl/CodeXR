import * as vscode from 'vscode';
import { VisualizeDataTreeItem, VisualizeDataItemFactory } from '../../../visualize_data/views/items/visualizeDataItems';
import { VisualizeDataState } from '../../../visualize_data/state/visualizeDataState';
import { VisualizationRestorer } from '../../../visualize_data/runtime/visualizationRestorer';
import { BrowseVisualizationItemFactory } from '../../../visualize_data/views/items/visualizationItem';

/**
 * Visualize Data tree items for the Visualize Data section
 */
export class VisualizeDataModularTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly visualizeDataItemType: 'chart-type' | 'select-json' | 'dimension-mapping' | 'dimension-item' | 'launch-visualization' | 'browse-visualizations' | 'stored-visualization' | 'error',
        command?: vscode.Command,
        iconPath?: vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri },
        tooltip?: string,
        description?: string,
        contextValue?: string,
        public readonly visualizeDataItem?: VisualizeDataTreeItem
    ) {
        super(label, collapsibleState);
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip || label;
        this.description = description;
        this.contextValue = contextValue;
    }
}

/**
 * Factory for creating Visualize Data-related tree items
 */
export class VisualizeDataModularItemFactory {
    /**
     * Create "Error loading visualize data" message item
     */
    static createErrorItem(): VisualizeDataModularTreeItem {
        console.log('VISUALIZE_DATA_MODULAR: Creating error loading visualize data item');
        
        return new VisualizeDataModularTreeItem(
            'Error loading visualize data',
            vscode.TreeItemCollapsibleState.None,
            'error',
            undefined,
            new vscode.ThemeIcon('error'),
            'Failed to load visualize data items'
        );
    }
    
    /**
     * Create main visualize data items
     */
    static createVisualizeDataItems(context: vscode.ExtensionContext): VisualizeDataModularTreeItem[] {
        console.log('VISUALIZE_DATA_MODULAR: Creating visualize data items');
        
        try {
            const visualizeDataItems = VisualizeDataItemFactory.createVisualizeDataItems(context);
            
            const children = visualizeDataItems.map(item => {
                // Handle collapsible dimension mapping and browse visualizations
                let collapsibleState = vscode.TreeItemCollapsibleState.None;
                let itemType: 'chart-type' | 'select-json' | 'dimension-mapping' | 'dimension-item' | 'launch-visualization' | 'browse-visualizations' | 'stored-visualization' | 'error' = item.type as any;
                
                if (item.type === 'dimension-mapping' && item.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
                    collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                } else if (item.type === 'browse-visualizations' && item.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
                    collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                }
                
                return new VisualizeDataModularTreeItem(
                    item.label,
                    collapsibleState,
                    itemType,
                    item.command,
                    item.iconPath,
                    item.tooltip,
                    item.description,
                    item.contextValue,
                    item
                );
            });

            console.log(`VISUALIZE_DATA_MODULAR: Created ${children.length} visualize data items`);
            return children;

        } catch (error) {
            console.error('VISUALIZE_DATA_MODULAR: Error creating visualize data items:', error);
            return [VisualizeDataModularItemFactory.createErrorItem()];
        }
    }
    
    /**
     * Create dimension mapping sub-items
     */
    static createDimensionMappingItems(context: vscode.ExtensionContext, state?: VisualizeDataState): VisualizeDataModularTreeItem[] {
        console.log('VISUALIZE_DATA_MODULAR: Creating dimension mapping items');
        
        try {
            // Provide a default state if none provided
            const stateToUse: VisualizeDataState = state || {
                selectedChart: undefined,
                selectedJsonPath: undefined,
                selectedJsonName: undefined,
                jsonAnalysis: undefined,
                dimensionMappings: [],
                isDimensionMappingConfigured: false,
                isReadyToLaunch: false
            };
            
            const dimensionItems = VisualizeDataItemFactory.createDimensionItems(stateToUse);
            
            const children = dimensionItems.map(item => {
                return new VisualizeDataModularTreeItem(
                    item.label,
                    vscode.TreeItemCollapsibleState.None,
                    'dimension-item',
                    item.command,
                    item.iconPath,
                    item.tooltip,
                    item.description,
                    item.contextValue,
                    item
                );
            });

            console.log(`VISUALIZE_DATA_MODULAR: Created ${children.length} dimension mapping items`);
            return children;

        } catch (error) {
            console.error('VISUALIZE_DATA_MODULAR: Error creating dimension mapping items:', error);
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
     * Create browse visualizations sub-items
     */
    static async createBrowseVisualizationItems(context: vscode.ExtensionContext): Promise<VisualizeDataModularTreeItem[]> {
        console.log('VISUALIZE_DATA_MODULAR: Creating browse visualization items');
        
        try {
            const visualizationRestorer = new VisualizationRestorer(context);
            
            // Scan for stored visualizations
            const visualizations = await visualizationRestorer.scanStoredVisualizations();
            
            // Create items for visualizations
            const visualizationItems = BrowseVisualizationItemFactory.createStoredVisualizationItems(visualizations);
            
            // Add reset button if there are visualizations
            if (visualizations.length > 0) {
                visualizationItems.push(BrowseVisualizationItemFactory.createResetAllItem());
            }
            
            // Convert to modular tree items
            const children = visualizationItems.map((item: any) => {
                return new VisualizeDataModularTreeItem(
                    item.label,
                    vscode.TreeItemCollapsibleState.None,
                    'stored-visualization',
                    item.command,
                    item.iconPath,
                    item.tooltip,
                    item.description,
                    item.contextValue
                );
            });

            console.log(`VISUALIZE_DATA_MODULAR: Created ${children.length} browse visualization items`);
            return children;

        } catch (error) {
            console.error('VISUALIZE_DATA_MODULAR: Error loading browse visualizations:', error);
            return [new VisualizeDataModularTreeItem(
                'Error loading visualizations',
                vscode.TreeItemCollapsibleState.None,
                'error',
                undefined,
                new vscode.ThemeIcon('error'),
                'Failed to load stored visualizations'
            )];
        }
    }
}
