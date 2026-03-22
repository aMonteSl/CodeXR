/**
 * Chart Type Directory Commands
 * Commands specific to the Chart Type (Directory) setting
 */

import * as vscode from 'vscode';
import { ChartTypeDirectorySetting } from '../../../../views/subsections/analysis_settings/chart_type_directory';
import { CommandRegistration } from '../analysis_file_mode';

export class ChartTypeDirectoryCommands {

    constructor(
        private context: vscode.ExtensionContext,
        private chartTypeDirectorySetting: ChartTypeDirectorySetting
    ) {}

    /**
     * Get command registrations (don't register them yet)
     * This follows the "nested dolls" architecture pattern
     */
    static getCommandRegistrations(
        context: vscode.ExtensionContext, 
        chartTypeDirectorySetting: ChartTypeDirectorySetting,
        refreshCallback: () => void
    ): CommandRegistration[] {
        const commands = new ChartTypeDirectoryCommands(context, chartTypeDirectorySetting);

        return [
            {
                commandId: 'codeXR.analysis.selectChartTypeDirectory',
                callback: async () => {
                    await commands.selectChartType();
                    refreshCallback();
                },
                description: 'Select chart type for directory analysis visualization'
            }
        ];
    }

    /**
     * Show chart type selection from quick pick menu
     * Shows different chart types available for XR and LivePanel modes
     */
    private async selectChartType(): Promise<void> {
        console.log('CHART_TYPE_DIRECTORY_COMMANDS: Chart type selection command executed');
        
        try {
            // Use the chart type setting's built-in selection dialog
            await this.chartTypeDirectorySetting.showChartTypeSelection();
            
        } catch (error) {
            console.error('CHART_TYPE_DIRECTORY_COMMANDS: Error in chart type selection:', error);
            vscode.window.showErrorMessage(`Failed to select chart type: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
