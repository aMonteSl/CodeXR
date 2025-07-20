import * as vscode from 'vscode';
import { VisualizationSettingsInteractionHandler } from '../views/interactions/handleSettingsInteraction';
import { initializeSettingsAccessors } from '../utils/settingsAccessors';

/**
 * Visualization Settings Commands Class
 * Defines what each visualization settings command does
 */
export class VisualizationSettingsCommands {
    private interactionHandler: VisualizationSettingsInteractionHandler;

    constructor(private context: vscode.ExtensionContext) {
        console.log('VISUALIZATION-SETTINGS: Initializing visualization settings commands...');
        
        // Initialize settings accessors for global use
        initializeSettingsAccessors(context);

        // Initialize the interaction handler
        this.interactionHandler = new VisualizationSettingsInteractionHandler(context);
    }

    /**
     * Register all visualization settings commands
     */
    static registerCommands(context: vscode.ExtensionContext): void {
        console.log('VISUALIZATION-SETTINGS: Registering visualization settings commands...');
        
        const commandsInstance = new VisualizationSettingsCommands(context);
        commandsInstance.registerAllCommands();
        
        console.log('VISUALIZATION-SETTINGS: Visualization settings commands registration complete');
    }

    /**
     * Register individual commands
     */
    private registerAllCommands(): void {
        // Command: Configure setting
        const configureSettingCmd = vscode.commands.registerCommand(
            'codeXR.visualizationSettings.configure',
            async (settingKey: string) => {
                try {
                    console.log(`VISUALIZATION-SETTINGS: Configure command triggered for: ${settingKey}`);
                    await this.interactionHandler.handleSettingConfiguration(settingKey as any);
                } catch (error) {
                    console.error('VISUALIZATION-SETTINGS: Error in configure command:', error);
                    vscode.window.showErrorMessage(`Failed to configure setting: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        );

        // Register commands with the extension context
        this.context.subscriptions.push(configureSettingCmd);

        // Store interaction handler for cleanup
        this.context.subscriptions.push({
            dispose: () => this.interactionHandler.dispose()
        });

        console.log('VISUALIZATION-SETTINGS: All commands registered successfully');
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.interactionHandler.dispose();
    }
}
