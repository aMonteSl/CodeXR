import * as vscode from 'vscode';
import { VisualizationSettingsInteractionHandler } from '../views/interactions/handleSettingsInteraction';
import { initializeSettingsAccessors } from '../utils/settingsAccessors';
import { ExtensionCommandRegistration } from '../../commands/shared';

export class VisualizationSettingsCommands {
    private interactionHandler: VisualizationSettingsInteractionHandler;

    constructor(private context: vscode.ExtensionContext) {
        initializeSettingsAccessors(context);
        this.interactionHandler = new VisualizationSettingsInteractionHandler(context);
    }

    static getCommandRegistrations(
        context: vscode.ExtensionContext,
    ): ExtensionCommandRegistration[] {
        const commandsInstance = new VisualizationSettingsCommands(context);
        context.subscriptions.push({
            dispose: () => commandsInstance.dispose(),
        });

        return [
            {
                id: 'codeXR.visualizationSettings.configure',
                module: 'VISUALIZATION-SETTINGS',
                description: 'Configure visualization setting',
                errorMessage: 'Failed to configure visualization setting',
                handler: async (settingKey: string) => {
                    await commandsInstance.interactionHandler.handleSettingConfiguration(settingKey as never);
                },
            },
            {
                id: 'codeXR.visualizationSettings.resetAll',
                module: 'VISUALIZATION-SETTINGS',
                description: 'Reset visualization settings to their default values',
                errorMessage: 'Failed to reset visualization settings',
                handler: async () => {
                    await commandsInstance.interactionHandler.handleResetToDefaults();
                },
            }
        ];
    }

    dispose(): void {
        this.interactionHandler.dispose();
    }
}
