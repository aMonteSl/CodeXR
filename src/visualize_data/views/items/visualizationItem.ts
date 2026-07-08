import * as vscode from 'vscode';
import { StoredVisualization } from '../../runtime/visualizationRestorer';

/**
 * Tree item types for browse visualizations
 */
export type BrowseVisualizationItemType = 'browse-section' | 'stored-visualization';

/**
 * Tree item for browse visualizations
 */
export class BrowseVisualizationTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: BrowseVisualizationItemType,
        public readonly visualization?: StoredVisualization,
        public readonly command?: vscode.Command,
        public readonly iconPath?: vscode.ThemeIcon,
        public readonly tooltip?: string,
        public readonly description?: string,
        public readonly contextValue?: string
    ) {
        super(label, collapsibleState);
        
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip;
        this.description = description;
        this.contextValue = contextValue;
    }
}

/**
 * Factory for creating browse visualization items
 */
export class BrowseVisualizationItemFactory {
    /**
     * Create browse visualizations section
     */
    public static createBrowseVisualizationsSection(): BrowseVisualizationTreeItem {
        return new BrowseVisualizationTreeItem(
            'Browse Visualizations',
            vscode.TreeItemCollapsibleState.Expanded,
            'browse-section',
            undefined,
            undefined,
            new vscode.ThemeIcon('folder-opened'),
            'Browse previously generated visualizations',
            undefined,
            'browse-visualizations-section'
        );
    }

    /**
     * Create items for stored visualizations
     */
    public static createStoredVisualizationItems(visualizations: StoredVisualization[]): BrowseVisualizationTreeItem[] {
        if (visualizations.length === 0) {
            return [
                new BrowseVisualizationTreeItem(
                    'No visualizations found',
                    vscode.TreeItemCollapsibleState.None,
                    'stored-visualization',
                    undefined,
                    undefined,
                    new vscode.ThemeIcon('info'),
                    'No stored visualizations available. Generate some visualizations first.',
                    undefined,
                    'no-visualizations'
                )
            ];
        }

        return visualizations.map(visualization => {
            const isValid = visualization.isValid;
            const icon = isValid ? new vscode.ThemeIcon('play') : new vscode.ThemeIcon('warning');
            const tooltip = isValid 
                ? `Launch visualization: ${visualization.name}\nPath: ${visualization.folderPath}`
                : `Invalid visualization: ${visualization.name}\nMissing required files in: ${visualization.folderPath}`;
            
            const description = isValid ? undefined : 'Invalid';

            return new BrowseVisualizationTreeItem(
                visualization.name,
                vscode.TreeItemCollapsibleState.None,
                'stored-visualization',
                visualization,
                isValid ? {
                    command: 'codeXR.browseVisualizations.launch',
                    title: 'Launch Visualization',
                    arguments: [visualization]
                } : undefined,
                icon,
                tooltip,
                description,
                'stored-visualization'
            );
        });
    }

    /**
     * Create reset all visualizations item
     */
    public static createResetAllItem(): BrowseVisualizationTreeItem {
        return new BrowseVisualizationTreeItem(
            'Reset All Visualizations',
            vscode.TreeItemCollapsibleState.None,
            'stored-visualization',
            undefined,
            {
                command: 'codeXR.browseVisualizations.resetAll',
                title: 'Reset All Visualizations',
                arguments: []
            },
            new vscode.ThemeIcon('trash'),
            'Delete all stored visualizations',
            undefined,
            'reset-all-visualizations'
        );
    }
}
