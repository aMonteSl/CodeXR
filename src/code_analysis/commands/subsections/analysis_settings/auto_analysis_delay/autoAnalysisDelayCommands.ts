/**
 * Auto-Analysis Delay Commands
 * Commands specific to the Auto-Analysis Delay setting
 */

import * as vscode from 'vscode';
import { AutoAnalysisDelaySetting } from '../../../../views/subsections/analysis_settings/auto_analysis_delay';
import { CommandRegistration } from '../analysis_file_mode';

export class AutoAnalysisDelayCommands {

    constructor(
        private context: vscode.ExtensionContext,
        private autoAnalysisDelaySetting: AutoAnalysisDelaySetting
    ) {}

    /**
     * Get command registrations (don't register them yet)
     * This follows the "nested dolls" architecture pattern
     */
    static getCommandRegistrations(
        context: vscode.ExtensionContext, 
        autoAnalysisDelaySetting: AutoAnalysisDelaySetting,
        refreshCallback: () => void
    ): CommandRegistration[] {
        const commands = new AutoAnalysisDelayCommands(context, autoAnalysisDelaySetting);

        return [
            {
                commandId: 'codeXR.analysis.selectAutoAnalysisDelay',
                callback: () => commands.selectAutoAnalysisDelay(refreshCallback),
                description: 'Select Auto-Analysis Delay from options'
            },
            {
                commandId: 'codeXR.analysis.setAutoAnalysisDelayRealTime',
                callback: () => commands.setAutoAnalysisDelay('RealTime', refreshCallback),
                description: 'Set Auto-Analysis Delay to Real Time (0s)'
            },
            {
                commandId: 'codeXR.analysis.setAutoAnalysisDelay1s',
                callback: () => commands.setAutoAnalysisDelay('1s', refreshCallback),
                description: 'Set Auto-Analysis Delay to 1 second'
            },
            {
                commandId: 'codeXR.analysis.setAutoAnalysisDelay3s',
                callback: () => commands.setAutoAnalysisDelay('3s', refreshCallback),
                description: 'Set Auto-Analysis Delay to 3 seconds'
            },
            {
                commandId: 'codeXR.analysis.setAutoAnalysisDelay5s',
                callback: () => commands.setAutoAnalysisDelay('5s', refreshCallback),
                description: 'Set Auto-Analysis Delay to 5 seconds'
            },
            {
                commandId: 'codeXR.analysis.setAutoAnalysisDelay10s',
                callback: () => commands.setAutoAnalysisDelay('10s', refreshCallback),
                description: 'Set Auto-Analysis Delay to 10 seconds'
            }
        ];
    }

    /**
     * Select auto-analysis delay from QuickPick command handler
     */
    private async selectAutoAnalysisDelay(refreshCallback: () => void): Promise<void> {
        try {
            // Create QuickPick items for predefined options
            const predefinedItems = [
                {
                    label: '⚡ Real Time (0s)',
                    description: 'Instant analysis as you type',
                    detail: 'No delay - immediate response',
                    value: 'RealTime' as const
                },
                {
                    label: '🕐 1 Second',
                    description: 'Short delay for quick feedback',
                    detail: '1000ms delay',
                    value: '1s' as const
                },
                {
                    label: '🕒 3 Seconds',
                    description: 'Balanced delay for most users',
                    detail: '3000ms delay',
                    value: '3s' as const
                },
                {
                    label: '🕔 5 Seconds',
                    description: 'Longer delay for complex analysis',
                    detail: '5000ms delay',
                    value: '5s' as const
                },
                {
                    label: '🕙 10 Seconds',
                    description: 'Maximum predefined delay',
                    detail: '10000ms delay',
                    value: '10s' as const
                },
                {
                    label: '⚙️ Custom Value...',
                    description: 'Set your own delay (0-20000ms)',
                    detail: 'Enter custom milliseconds',
                    value: 'Custom' as const
                }
            ];

            const selectedItem = await vscode.window.showQuickPick(predefinedItems, {
                placeHolder: 'Select auto-analysis delay timing',
                title: 'Auto-Analysis Delay Configuration',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (!selectedItem) {
                return; // User cancelled
            }

            if (selectedItem.value === 'Custom') {
                // Handle custom input
                await this.setCustomAutoAnalysisDelay(refreshCallback);
            } else {
                // Handle predefined value
                await this.setAutoAnalysisDelay(selectedItem.value, refreshCallback);
            }
            
        } catch (error) {
            console.error('ANALYSIS: Error selecting auto-analysis delay:', error);
            vscode.window.showErrorMessage(`Failed to select auto-analysis delay: ${error}`);
        }
    }

    /**
     * Set custom auto-analysis delay command handler
     */
    private async setCustomAutoAnalysisDelay(refreshCallback: () => void): Promise<void> {
        try {
            // Show input box for custom delay
            const input = await vscode.window.showInputBox({
                prompt: 'Enter custom auto-analysis delay in milliseconds (0-20000)',
                placeHolder: '1000',
                validateInput: (value) => {
                    const num = parseInt(value);
                    if (isNaN(num)) {
                        return 'Please enter a valid number';
                    }
                    if (num < 0 || num > 20000) {
                        return 'Delay must be between 0 and 20000 milliseconds (20 seconds)';
                    }
                    return null;
                }
            });

            if (input === undefined) {
                return; // User cancelled
            }

            const customMs = parseInt(input);
            const newDelayConfig = await this.autoAnalysisDelaySetting.setCustomDelay(customMs);
            
            // Show notification to user
            vscode.window.showInformationMessage(
                `Auto-analysis delay set to custom: ${customMs}ms`,
                { modal: false }
            );

            // Refresh the tree view to show updated state
            refreshCallback();

            console.log(`ANALYSIS: Command executed - Custom auto-analysis delay: ${customMs}ms`);
            
        } catch (error) {
            console.error('ANALYSIS: Error setting custom auto-analysis delay:', error);
            vscode.window.showErrorMessage(`Failed to set custom auto-analysis delay: ${error}`);
        }
    }

    /**
     * Set specific auto-analysis delay command handler
     */
    private async setAutoAnalysisDelay(
        delayType: 'RealTime' | '1s' | '3s' | '5s' | '10s', 
        refreshCallback: () => void
    ): Promise<void> {
        try {
            await this.autoAnalysisDelaySetting.setDelay(delayType);
            
            // Show notification to user
            vscode.window.showInformationMessage(
                `Auto-analysis delay set to: ${delayType}`,
                { modal: false }
            );

            // Refresh the tree view to show updated state
            refreshCallback();

            console.log(`ANALYSIS: Command executed - Auto-analysis delay set to: ${delayType}`);
            
        } catch (error) {
            console.error(`ANALYSIS: Error setting auto-analysis delay to ${delayType}:`, error);
            vscode.window.showErrorMessage(`Failed to set auto-analysis delay to ${delayType}: ${error}`);
        }
    }
}

