/**
 * Auto-Analysis Enabled Commands
 * Commands specific to the Auto-Analysis Enabled setting
 */

import * as vscode from 'vscode';
import { AutoAnalysisEnabledSetting } from '../../../../views/subsections/analysis_settings/auto_analysis_enabled';
import { CommandRegistration } from '../analysis_file_mode';
import { SessionWatcherManager } from '../../../../engine/watchers/sessionWatcherManager';

export class AutoAnalysisEnabledCommands {

    constructor(
        private context: vscode.ExtensionContext,
        private autoAnalysisEnabledSetting: AutoAnalysisEnabledSetting
    ) {}

    /**
     * Get command registrations (don't register them yet)
     * This follows the "nested dolls" architecture pattern
     */
    static getCommandRegistrations(
        context: vscode.ExtensionContext, 
        autoAnalysisEnabledSetting: AutoAnalysisEnabledSetting,
        refreshCallback: () => void
    ): CommandRegistration[] {
        const commands = new AutoAnalysisEnabledCommands(context, autoAnalysisEnabledSetting);

        return [
            {
                commandId: 'codeXR.analysis.toggleAutoAnalysisEnabled',
                callback: () => commands.toggleAutoAnalysisEnabled(refreshCallback),
                description: 'Toggle Auto-Analysis Enabled/Disabled state'
            },
            {
                commandId: 'codeXR.analysis.enableAutoAnalysis',
                callback: () => commands.setAutoAnalysisEnabled(true, refreshCallback),
                description: 'Enable Auto-Analysis (watchers and debounce time)'
            },
            {
                commandId: 'codeXR.analysis.disableAutoAnalysis',
                callback: () => commands.setAutoAnalysisEnabled(false, refreshCallback),
                description: 'Disable Auto-Analysis (pause watchers and debounce time)'
            }
        ];
    }

    private async refreshActiveWatchers(): Promise<void> {
        await SessionWatcherManager.refreshActiveWatcherConfigurations(this.context);
    }

    /**
     * Toggle auto-analysis enabled state command handler
     */
    private async toggleAutoAnalysisEnabled(refreshCallback: () => void): Promise<void> {
        try {
            console.log('ANALYSIS: Toggling auto-analysis enabled state');
            
            const newState = await this.autoAnalysisEnabledSetting.toggleEnabled();
            await this.refreshActiveWatchers();
            console.log(`ANALYSIS: Auto-analysis enabled toggled to: ${newState}`);
            
            refreshCallback();
            
        } catch (error) {
            console.error('ANALYSIS: Error toggling auto-analysis enabled state:', error);
            vscode.window.showErrorMessage(`Failed to toggle auto-analysis state: ${error}`);
        }
    }

    /**
     * Set specific auto-analysis enabled state command handler
     */
    private async setAutoAnalysisEnabled(enabled: boolean, refreshCallback: () => void): Promise<void> {
        try {
            console.log(`ANALYSIS: Setting auto-analysis enabled to: ${enabled}`);
            
            await this.autoAnalysisEnabledSetting.setEnabled(enabled);
            await this.refreshActiveWatchers();
            console.log(`ANALYSIS: Auto-analysis enabled set to: ${enabled}`);
            
            refreshCallback();
            
        } catch (error) {
            console.error('ANALYSIS: Error setting auto-analysis enabled state:', error);
            vscode.window.showErrorMessage(`Failed to set auto-analysis state: ${error}`);
        }
    }
}
