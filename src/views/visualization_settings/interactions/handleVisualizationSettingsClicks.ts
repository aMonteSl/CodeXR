import * as vscode from 'vscode';
import { VisualizationSettingsModularTreeItem } from '../items/visualizationSettingsItems';

/**
 * Handler for Visualization Settings section interactions
 */
export class VisualizationSettingsClickHandler {
    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Handle clicks on visualization settings items
     */
    async handleVisualizationSettingsClick(item: VisualizationSettingsModularTreeItem): Promise<void> {
        console.log(`VISUALIZATION_SETTINGS_MODULAR: Handling click on visualization settings item: ${item.label} (type: ${item.visualizationSettingsItemType})`);

        // For most visualization settings items, the command is already attached to the tree item
        // and will be executed automatically by VS Code
        switch (item.visualizationSettingsItemType) {
            case 'settings-field':
                console.log('VISUALIZATION_SETTINGS_MODULAR: Settings field clicked');
                // The command to open the color picker is already attached to the item
                // VS Code will execute it automatically
                break;
                
            case 'error':
                console.log('VISUALIZATION_SETTINGS_MODULAR: Error item clicked - no action');
                break;
                
            default:
                console.warn(`VISUALIZATION_SETTINGS_MODULAR: Unknown visualization settings item type: ${item.visualizationSettingsItemType}`);
        }
    }

    /**
     * Handle right-click context menu actions
     */
    async handleContextMenuAction(action: string, item: VisualizationSettingsModularTreeItem): Promise<void> {
        console.log(`VISUALIZATION_SETTINGS_MODULAR: Handling context menu action: ${action} on item: ${item.label}`);

        switch (action) {
            case 'refresh':
                console.log('VISUALIZATION_SETTINGS_MODULAR: Refreshing visualization settings view');
                // Refresh will be triggered by the provider
                break;
                
            case 'configure':
                await this.handleConfigureAction(item);
                break;
                
            case 'reset':
                await this.handleResetAction(item);
                break;
                
            case 'resetAll':
                await this.handleResetAllAction();
                break;
                
            case 'export':
                await this.handleExportSettings();
                break;
                
            case 'import':
                await this.handleImportSettings();
                break;
                
            default:
                console.warn(`VISUALIZATION_SETTINGS_MODULAR: Unknown context menu action: ${action}`);
        }
    }

    /**
     * Handle configure action (open color picker)
     */
    private async handleConfigureAction(item: VisualizationSettingsModularTreeItem): Promise<void> {
        console.log(`VISUALIZATION_SETTINGS_MODULAR: Configuring setting: ${item.label}`);
        
        if (item.command) {
            // Execute the item's command (usually opens color picker)
            await vscode.commands.executeCommand(item.command.command, ...(item.command.arguments || []));
        } else {
            // Fallback - try to extract setting field and use generic command
            if (item.originalSettingsItem?.settingField) {
                await vscode.commands.executeCommand('codeXR.visualizationSettings.configure', item.originalSettingsItem.settingField.key);
            } else {
                vscode.window.showWarningMessage(`Cannot configure: ${item.label}`);
            }
        }
    }

    /**
     * Handle reset single setting action
     */
    private async handleResetAction(item: VisualizationSettingsModularTreeItem): Promise<void> {
        console.log(`VISUALIZATION_SETTINGS_MODULAR: Resetting setting: ${item.label}`);
        
        try {
            if (item.originalSettingsItem?.settingField) {
                await vscode.commands.executeCommand('codeXR.visualizationSettings.reset', item.originalSettingsItem.settingField.key);
                vscode.window.showInformationMessage(`Reset ${item.label} to default value`);
            } else {
                vscode.window.showWarningMessage(`Cannot reset: ${item.label}`);
            }
        } catch (error) {
            console.error(`VISUALIZATION_SETTINGS_MODULAR: Error resetting setting:`, error);
            vscode.window.showErrorMessage(`Failed to reset ${item.label}: ${error}`);
        }
    }

    /**
     * Handle reset all settings action
     */
    private async handleResetAllAction(): Promise<void> {
        console.log('VISUALIZATION_SETTINGS_MODULAR: Resetting all settings');
        
        const confirmation = await vscode.window.showWarningMessage(
            'Reset all visualization settings to default values?',
            { modal: true },
            'Reset All',
            'Cancel'
        );

        if (confirmation === 'Reset All') {
            try {
                await vscode.commands.executeCommand('codeXR.visualizationSettings.resetAll');
                vscode.window.showInformationMessage('All visualization settings have been reset to default values');
            } catch (error) {
                console.error('VISUALIZATION_SETTINGS_MODULAR: Error resetting all settings:', error);
                vscode.window.showErrorMessage(`Failed to reset all settings: ${error}`);
            }
        }
    }

    /**
     * Handle export settings action
     */
    private async handleExportSettings(): Promise<void> {
        console.log('VISUALIZATION_SETTINGS_MODULAR: Exporting settings');
        
        try {
            await vscode.commands.executeCommand('codeXR.visualizationSettings.export');
        } catch (error) {
            console.error('VISUALIZATION_SETTINGS_MODULAR: Error exporting settings:', error);
            vscode.window.showErrorMessage(`Failed to export settings: ${error}`);
        }
    }

    /**
     * Handle import settings action
     */
    private async handleImportSettings(): Promise<void> {
        console.log('VISUALIZATION_SETTINGS_MODULAR: Importing settings');
        
        try {
            await vscode.commands.executeCommand('codeXR.visualizationSettings.import');
        } catch (error) {
            console.error('VISUALIZATION_SETTINGS_MODULAR: Error importing settings:', error);
            vscode.window.showErrorMessage(`Failed to import settings: ${error}`);
        }
    }
}
