/**
 * Dimension Mapping Directory Commands
 * Commands specific to the Dimension Mapping (Directory) setting
 */

import * as vscode from 'vscode';
import { DimensionMappingDirectorySetting } from '../../../../views/subsections/analysis_settings/dimension_mapping_directory';
import { CommandRegistration } from '../analysis_file_mode';

export class DimensionMappingDirectoryCommands {

    constructor(
        private context: vscode.ExtensionContext,
        private dimensionMappingDirectorySetting: DimensionMappingDirectorySetting
    ) {}

    /**
     * Get command registrations (don't register them yet)
     * This follows the "nested dolls" architecture pattern
     */
    static getCommandRegistrations(
        context: vscode.ExtensionContext, 
        dimensionMappingDirectorySetting: DimensionMappingDirectorySetting,
        refreshCallback: () => void
    ): CommandRegistration[] {
        console.log('DIMENSION_MAPPING_DIRECTORY_COMMANDS: Creating command registrations');
        const commands = new DimensionMappingDirectoryCommands(context, dimensionMappingDirectorySetting);

        const registrations = [
            {
                commandId: 'newCodeAnalysis.selectDimensionMappingDirectory',
                callback: async (dimensionName: string, dimensionLabel: string) => {
                    console.log(`DIMENSION_MAPPING_DIRECTORY_COMMANDS: Command TRIGGERED for ${dimensionName} (${dimensionLabel})`);
                    await commands.selectDimensionMapping(dimensionName, dimensionLabel);
                    refreshCallback();
                },
                description: 'Select dimension mapping for directory analysis visualization'
            }
        ];

        console.log(`DIMENSION_MAPPING_DIRECTORY_COMMANDS: Created ${registrations.length} command registrations`);
        return registrations;
    }

    /**
     * Show dimension mapping selection from quick pick menu
     */
    private async selectDimensionMapping(dimensionName: string, dimensionLabel: string): Promise<void> {
        console.log(`DIMENSION_MAPPING_DIRECTORY_COMMANDS: Dimension mapping selection command executed for ${dimensionName} (${dimensionLabel})`);
        
        try {
            // Add safety check
            if (!this.dimensionMappingDirectorySetting) {
                console.error('DIMENSION_MAPPING_DIRECTORY_COMMANDS: dimensionMappingDirectorySetting is not initialized');
                vscode.window.showErrorMessage('Dimension mapping setting not initialized. Please reload the window.');
                return;
            }

            // Use the dimension mapping setting's built-in selection dialog
            await this.dimensionMappingDirectorySetting.showDimensionMappingSelection(dimensionName, dimensionLabel);
            
        } catch (error) {
            console.error(`DIMENSION_MAPPING_DIRECTORY_COMMANDS: Error in selectDimensionMapping:`, error);
            vscode.window.showErrorMessage(`Failed to show dimension mapping selection: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
