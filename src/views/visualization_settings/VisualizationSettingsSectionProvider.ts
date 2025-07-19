import * as vscode from 'vscode';
import { SectionProvider } from '../common/baseInterfaces';
import { VisualizationSettingsModularTreeItem, VisualizationSettingsModularItemFactory } from './items/visualizationSettingsItems';
import { VisualizationSettingsClickHandler } from './interactions/handleVisualizationSettingsClicks';
import { VisualizationSettingsStorage } from '../../visualization_settings/storage/settingsStorage';

/**
 * Visualization Settings section provider - manages visualization rendering preferences
 */
export class VisualizationSettingsSectionProvider implements SectionProvider<VisualizationSettingsModularTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<VisualizationSettingsModularTreeItem | undefined | null | void> = 
        new vscode.EventEmitter<VisualizationSettingsModularTreeItem | undefined | null | void>();
    
    readonly onDidChangeTreeData: vscode.Event<VisualizationSettingsModularTreeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private clickHandler: VisualizationSettingsClickHandler;
    private visualizationSettingsStorage: VisualizationSettingsStorage;

    constructor(private context: vscode.ExtensionContext) {
        console.log('VISUALIZATION_SETTINGS_MODULAR: Initializing Visualization Settings section provider');
        this.clickHandler = new VisualizationSettingsClickHandler(context);
        this.visualizationSettingsStorage = new VisualizationSettingsStorage(context);
    }

    /**
     * Get the section name for identification
     */
    getSectionName(): string {
        return 'visualizationSettings';
    }

    /**
     * Get the section header item
     */
    getSectionItem(): VisualizationSettingsModularTreeItem {
        return new VisualizationSettingsModularTreeItem(
            'VISUALIZATION SETTINGS',
            vscode.TreeItemCollapsibleState.Collapsed,
            'error', // Using this as section header type
            undefined,
            new vscode.ThemeIcon('settings-gear'),
            'Configure visualization rendering preferences',
            undefined,
            'visualizationSettingsSection'
        );
    }

    /**
     * Get children items for the Visualization Settings section
     */
    async getChildren(element?: VisualizationSettingsModularTreeItem): Promise<VisualizationSettingsModularTreeItem[]> {
        // If element is provided, it means we're getting children for a specific item
        // For the Visualization Settings section, we only have flat items, so return empty for sub-items
        if (element) {
            return [];
        }

        console.log('VISUALIZATION_SETTINGS_MODULAR: Loading visualization settings section children with dynamic color icons');

        try {
            const currentSettings = this.visualizationSettingsStorage.getSettings();
            console.log(`VISUALIZATION_SETTINGS_MODULAR: Loading settings for dynamic icons: ${JSON.stringify(currentSettings)}`);
            
            const children = await VisualizationSettingsModularItemFactory.createVisualizationSettingsItems(
                currentSettings, 
                this.context
            );
            
            console.log(`VISUALIZATION_SETTINGS_MODULAR: Created ${children.length} visualization settings items with dynamic icons`);
            return children;

        } catch (error) {
            console.error('VISUALIZATION_SETTINGS_MODULAR: Error loading visualization settings items:', error);
            return [VisualizationSettingsModularItemFactory.createErrorItem()];
        }
    }

    /**
     * Refresh the section
     */
    refresh(): void {
        console.log('VISUALIZATION_SETTINGS_MODULAR: Refreshing Visualization Settings section');
        this._onDidChangeTreeData.fire();
    }

    /**
     * Handle item clicks (additional method for interaction)
     */
    async handleClick(item: VisualizationSettingsModularTreeItem): Promise<void> {
        await this.clickHandler.handleVisualizationSettingsClick(item);
    }

    /**
     * Handle context menu actions (additional method for interaction)
     */
    async handleContextMenu(action: string, item: VisualizationSettingsModularTreeItem): Promise<void> {
        await this.clickHandler.handleContextMenuAction(action, item);
    }

    /**
     * Get current settings (for external access)
     */
    getCurrentSettings() {
        return this.visualizationSettingsStorage.getSettings();
    }

    /**
     * Update a single setting (for external access)
     */
    async updateSetting(key: string, value: any): Promise<void> {
        await this.visualizationSettingsStorage.updateSetting(key as any, value);
        this.refresh();
    }
}
