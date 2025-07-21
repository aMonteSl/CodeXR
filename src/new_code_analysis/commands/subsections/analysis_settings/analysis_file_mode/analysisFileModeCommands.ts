/**
 * Analysis File Mode Commands
 * Commands specific to the Analysis File Mode setting
 */

import * as vscode from 'vscode';
import { AnalysisFileSetting } from '../../../../views/subsections/analysis_settings/analysis_file_mode';

export interface CommandRegistration {
    commandId: string;
    callback: (...args: any[]) => any;
    description: string;
}

export class AnalysisFileModeCommands {

    constructor(
        private context: vscode.ExtensionContext,
        private analysisFileSetting: AnalysisFileSetting
    ) {}

    /**
     * Get command registrations (don't register them yet)
     * This follows the "nested dolls" architecture pattern
     */
    static getCommandRegistrations(
        context: vscode.ExtensionContext, 
        analysisFileSetting: AnalysisFileSetting,
        refreshCallback: () => void
    ): CommandRegistration[] {
        const commands = new AnalysisFileModeCommands(context, analysisFileSetting);

        return [
            {
                commandId: 'newCodeAnalysis.toggleAnalysisFileMode',
                callback: () => commands.toggleAnalysisFileMode(refreshCallback),
                description: 'Toggle Analysis File Mode between XR and LivePanel'
            },
            {
                commandId: 'newCodeAnalysis.setAnalysisFileModeXR',
                callback: () => commands.setAnalysisFileMode('XR', refreshCallback),
                description: 'Set Analysis File Mode to XR'
            },
            {
                commandId: 'newCodeAnalysis.setAnalysisFileModeHivePanel',
                callback: () => commands.setAnalysisFileMode('LivePanel', refreshCallback),
                description: 'Set Analysis File Mode to LivePanel'
            }
        ];
    }

    /**
     * Toggle analysis file mode command handler
     */
    private async toggleAnalysisFileMode(refreshCallback: () => void): Promise<void> {
        try {
            const newMode = await this.analysisFileSetting.toggleMode();
            
            // Show notification to user
            vscode.window.showInformationMessage(
                `Analysis File mode switched to: ${newMode}`,
                { modal: false }
            );

            // Refresh the tree view to show updated state
            refreshCallback();

            console.log(`NEW_CODE_ANALYSIS: Command executed - Analysis file mode: ${newMode}`);
            
        } catch (error) {
            console.error('NEW_CODE_ANALYSIS: Error toggling analysis file mode:', error);
            vscode.window.showErrorMessage(`Failed to toggle analysis file mode: ${error}`);
        }
    }

    /**
     * Set specific analysis file mode command handler
     */
    private async setAnalysisFileMode(
        mode: 'XR' | 'LivePanel', 
        refreshCallback: () => void
    ): Promise<void> {
        try {
            await this.analysisFileSetting.setMode(mode);
            
            // Show notification to user
            vscode.window.showInformationMessage(
                `Analysis File mode set to: ${mode}`,
                { modal: false }
            );

            // Refresh the tree view to show updated state
            refreshCallback();

            console.log(`NEW_CODE_ANALYSIS: Command executed - Analysis file mode set to: ${mode}`);
            
        } catch (error) {
            console.error(`NEW_CODE_ANALYSIS: Error setting analysis file mode to ${mode}:`, error);
            vscode.window.showErrorMessage(`Failed to set analysis file mode to ${mode}: ${error}`);
        }
    }
}
