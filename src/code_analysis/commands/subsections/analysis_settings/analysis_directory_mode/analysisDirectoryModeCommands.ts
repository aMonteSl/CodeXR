/**
 * Analysis Directory Mode Commands
 * Command handlers for the analysis directory mode setting
 */

import * as vscode from 'vscode';
import { AnalysisDirectorySetting } from '../../../../views/subsections/analysis_settings/analysis_directory_mode';
import { CommandRegistration } from '../analysis_file_mode';

export class AnalysisDirectoryModeCommands {

    /**
     * Get command registrations for analysis directory mode (nested dolls pattern)
     */
    static getCommandRegistrations(
        context: vscode.ExtensionContext,
        analysisDirectorySetting: AnalysisDirectorySetting,
        refreshCallback: () => void
    ): CommandRegistration[] {
        console.log('ANALYSIS: Collecting Analysis Directory Mode command registrations');

        const commandRegistrations: CommandRegistration[] = [
            {
                commandId: 'codeXR.analysis.selectAnalysisDirectoryMode',
                callback: async () => {
                    try {
                        console.log('ANALYSIS: Select Analysis Directory Mode command executed');
                        
                        const selectedMode = await analysisDirectorySetting.selectMode();
                        
                        if (selectedMode) {
                            const modeText = selectedMode.includes('Deep') 
                                ? `${selectedMode.replace('Deep', '')} Deep`
                                : selectedMode;
                            
                            vscode.window.showInformationMessage(
                                `Directory analysis mode set to: ${modeText}`, 
                                'OK'
                            );
                            
                            // Refresh tree to show updated state
                            refreshCallback();
                        }
                        
                    } catch (error) {
                        console.error('ANALYSIS: Error selecting analysis directory mode:', error);
                        vscode.window.showErrorMessage(
                            `Failed to select directory analysis mode: ${error instanceof Error ? error.message : String(error)}`
                        );
                    }
                },
                description: 'Select between LivePanel, LivePanelDeep, XR, and XRDeep modes for directory analysis'
            }
        ];

        console.log(`ANALYSIS: Collected ${commandRegistrations.length} Analysis Directory Mode command registrations`);
        return commandRegistrations;
    }
}

