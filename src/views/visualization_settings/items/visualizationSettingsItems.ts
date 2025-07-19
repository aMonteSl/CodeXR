import * as vscode from 'vscode';
import { VisualizationSettingsTreeItem, VisualizationSettingsItemFactory } from '../../../visualization_settings/views/items/visualizationSettingsItems';
import { VisualizationSettings } from '../../../visualization_settings/model/settingsModel';

/**
 * Visualization Settings tree items for the Visualization Settings section
 */
export class VisualizationSettingsModularTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly visualizationSettingsItemType: 'settings-field' | 'error',
        command?: vscode.Command,
        iconPath?: vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri },
        tooltip?: string,
        description?: string,
        contextValue?: string,
        public readonly originalSettingsItem?: VisualizationSettingsTreeItem
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
 * Factory for creating Visualization Settings-related tree items
 */
export class VisualizationSettingsModularItemFactory {
    /**
     * Create "Error loading settings" message item
     */
    static createErrorItem(): VisualizationSettingsModularTreeItem {
        console.log('VISUALIZATION_SETTINGS_MODULAR: Creating error loading settings item');
        
        return new VisualizationSettingsModularTreeItem(
            'Error loading settings',
            vscode.TreeItemCollapsibleState.None,
            'error',
            undefined,
            new vscode.ThemeIcon('error'),
            'Failed to load visualization settings'
        );
    }
    
    /**
     * Create visualization settings items with dynamic color icons
     */
    static async createVisualizationSettingsItems(settings: VisualizationSettings, context: vscode.ExtensionContext): Promise<VisualizationSettingsModularTreeItem[]> {
        console.log('VISUALIZATION_SETTINGS_MODULAR: Creating visualization settings items with dynamic color icons');
        
        try {
            const settingsItems = await VisualizationSettingsItemFactory.createVisualizationSettingsItems(
                settings, 
                context
            );
            
            const children = settingsItems.map(item => {
                return new VisualizationSettingsModularTreeItem(
                    item.label,
                    vscode.TreeItemCollapsibleState.None,
                    'settings-field',
                    item.command,
                    item.iconPath,
                    item.tooltip,
                    item.description,
                    item.contextValue,
                    item
                );
            });

            console.log(`VISUALIZATION_SETTINGS_MODULAR: Created ${children.length} visualization settings items with dynamic icons`);
            return children;

        } catch (error) {
            console.error('VISUALIZATION_SETTINGS_MODULAR: Error creating visualization settings items:', error);
            return [VisualizationSettingsModularItemFactory.createErrorItem()];
        }
    }
}
