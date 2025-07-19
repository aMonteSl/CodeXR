/**
 * Visualization Settings Module
 * Main entry point for visualization configuration management
 */

export { VisualizationSettings, DEFAULT_VISUALIZATION_SETTINGS, SettingFieldType } from './model/settingsModel';
export { VisualizationSettingsStorage } from './storage/settingsStorage';
export { VisualizationSettingsItemFactory, VisualizationSettingsTreeItem } from './views/items/visualizationSettingsItems';
export { VisualizationSettingsInteractionHandler } from './views/interactions/handleSettingsInteraction';

// Export settings accessors for babia-templates integration
export { 
    initializeSettingsAccessors,
    getSelectedBackgroundColor,
    getSelectedGroundColor,
    getSelectedEnvironment,
    getSelectedPalette,
    getAllSelectedSettings
} from './utils/settingsAccessors';

import * as vscode from 'vscode';
import { VisualizationSettingsInteractionHandler } from './views/interactions/handleSettingsInteraction';
import { initializeSettingsAccessors } from './utils/settingsAccessors';

/**
 * Register visualization settings commands
 */
export function registerVisualizationSettingsCommands(context: vscode.ExtensionContext): void {
    console.log('VISUALIZATION-SETTINGS: Registering commands...');

    // Initialize settings accessors for global use
    initializeSettingsAccessors(context);

    // Initialize the interaction handler
    const interactionHandler = new VisualizationSettingsInteractionHandler(context);

    // Command: Configure setting
    const configureSettingCmd = vscode.commands.registerCommand(
        'codeXR.visualizationSettings.configure',
        async (settingKey: string) => {
            try {
                console.log(`VISUALIZATION-SETTINGS: Configure command triggered for: ${settingKey}`);
                await interactionHandler.handleSettingConfiguration(settingKey as any);
            } catch (error) {
                console.error('VISUALIZATION-SETTINGS: Error in configure command:', error);
                vscode.window.showErrorMessage(`Failed to configure setting: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    );

    // Register commands with the extension context
    context.subscriptions.push(configureSettingCmd);

    // Store interaction handler for cleanup
    context.subscriptions.push({
        dispose: () => interactionHandler.dispose()
    });

    console.log('VISUALIZATION-SETTINGS: Commands registered successfully');
}
