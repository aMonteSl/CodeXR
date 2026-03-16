/**
 * Babia UI XR Commands
 */

import * as vscode from 'vscode';
import { BabiaUiSetting } from '../../../../views/subsections/analysis_settings/babia_ui';
import { CommandRegistration } from '../analysis_file_mode';

export class BabiaUiCommands {
    constructor(private readonly setting: BabiaUiSetting) {}

    static getCommandRegistrations(
        context: vscode.ExtensionContext,
        setting: BabiaUiSetting,
        refreshCallback: () => void,
    ): CommandRegistration[] {
        void context;
        const commands = new BabiaUiCommands(setting);

        return [
            {
                commandId: 'codeXR.analysis.toggleBabiaUiXR',
                callback: async () => {
                    await commands.toggleBabiaUiXR(refreshCallback);
                },
                description: 'Toggle Babia UI injection in XR analyses',
            },
        ];
    }

    private async toggleBabiaUiXR(refreshCallback: () => void): Promise<void> {
        try {
            const enabled = await this.setting.toggleEnabled();
            vscode.window.showInformationMessage(
                enabled
                    ? 'Babia UI enabled for XR analyses.'
                    : 'Babia UI disabled for XR analyses.',
            );
            refreshCallback();
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to toggle Babia UI XR setting: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
}
