/**
 * Chart Type File Commands
 * Commands specific to the Chart Type (File) setting
 */

import * as vscode from 'vscode';
import { ChartTypeFileSetting } from '../../../../views/subsections/analysis_settings/chart_type_file';
import { CommandRegistration } from '../analysis_file_mode';

export class ChartTypeFileCommands {

    constructor(
        private context: vscode.ExtensionContext,
        private chartTypeFileSetting: ChartTypeFileSetting
    ) {}

    /**
     * Get command registrations (don't register them yet)
     * This follows the "nested dolls" architecture pattern
     */
    static getCommandRegistrations(
        context: vscode.ExtensionContext, 
        chartTypeFileSetting: ChartTypeFileSetting,
        refreshCallback: () => void
    ): CommandRegistration[] {
        const commands = new ChartTypeFileCommands(context, chartTypeFileSetting);

        return [
            {
                commandId: 'newCodeAnalysis.selectChartTypeFile',
                callback: async () => {
                    await commands.selectChartType();
                    refreshCallback();
                },
                description: 'Select chart type for file analysis visualization'
            }
        ];
    }

    /**
     * Show chart type selection from quick pick menu
     * Shows different chart types available for XR and LivePanel modes
     */
    private async selectChartType(): Promise<void> {
        console.log('CHART_TYPE_FILE_COMMANDS: Chart type selection command executed');
        
        try {
            // Use the chart type setting's built-in selection dialog
            await this.chartTypeFileSetting.showChartTypeSelection();
            
        } catch (error) {
            console.error('CHART_TYPE_FILE_COMMANDS: Error selecting chart type:', error);
            vscode.window.showErrorMessage(`Failed to select chart type: ${error}`);
        }
    }
}
