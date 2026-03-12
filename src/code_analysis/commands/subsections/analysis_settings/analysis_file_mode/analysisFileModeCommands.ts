/**
 * Analysis File Mode Commands
 * Commands specific to the Analysis File Mode setting
 */

import * as vscode from 'vscode';
import { AnalysisFileSetting } from '../../../../views/subsections/analysis_settings/analysis_file_mode';

export interface CommandRegistration {
    commandId: string;
    callback: (...args: any[]) => Promise<void> | void;
    description: string;
    module?: string;
    errorMessage?: string;
    silentErrors?: boolean;
}

export class AnalysisFileModeCommands {
    constructor(
        private context: vscode.ExtensionContext,
        private analysisFileSetting: AnalysisFileSetting,
    ) {}

    static getCommandRegistrations(
        context: vscode.ExtensionContext,
        analysisFileSetting: AnalysisFileSetting,
        refreshCallback: () => void,
    ): CommandRegistration[] {
        const commands = new AnalysisFileModeCommands(context, analysisFileSetting);

        return [
            {
                commandId: 'codeXR.analysis.toggleAnalysisFileMode',
                callback: () => commands.toggleAnalysisFileMode(refreshCallback),
                description: 'Toggle analysis file mode between XR and LivePanel',
                module: 'ANALYSIS',
                errorMessage: 'Failed to toggle analysis file mode'
            },
            {
                commandId: 'codeXR.analysis.setAnalysisFileModeXR',
                callback: () => commands.setAnalysisFileMode('XR', refreshCallback),
                description: 'Set analysis file mode to XR',
                module: 'ANALYSIS',
                errorMessage: 'Failed to set analysis file mode to XR'
            },
            {
                commandId: 'codeXR.analysis.setAnalysisFileModeHivePanel',
                callback: () => commands.setAnalysisFileMode('LivePanel', refreshCallback),
                description: 'Set analysis file mode to LivePanel',
                module: 'ANALYSIS',
                errorMessage: 'Failed to set analysis file mode to LivePanel'
            }
        ];
    }

    private async toggleAnalysisFileMode(refreshCallback: () => void): Promise<void> {
        try {
            const newMode = await this.analysisFileSetting.toggleMode();
            vscode.window.showInformationMessage(`Analysis File mode switched to: ${newMode}`, { modal: false });
            refreshCallback();
            console.log(`ANALYSIS: Command executed - Analysis file mode: ${newMode}`);
        } catch (error) {
            console.error('ANALYSIS: Error toggling analysis file mode:', error);
            vscode.window.showErrorMessage(`Failed to toggle analysis file mode: ${error}`);
        }
    }

    private async setAnalysisFileMode(
        mode: 'XR' | 'LivePanel',
        refreshCallback: () => void,
    ): Promise<void> {
        try {
            await this.analysisFileSetting.setMode(mode);
            vscode.window.showInformationMessage(`Analysis File mode set to: ${mode}`, { modal: false });
            refreshCallback();
            console.log(`ANALYSIS: Command executed - Analysis file mode set to: ${mode}`);
        } catch (error) {
            console.error(`ANALYSIS: Error setting analysis file mode to ${mode}:`, error);
            vscode.window.showErrorMessage(`Failed to set analysis file mode to ${mode}: ${error}`);
        }
    }
}

