/**
 * Dimension Mapping File Commands
 * Commands specific to the Dimension Mapping (File) setting.
 */

import * as vscode from 'vscode';
import { DimensionMappingFileSetting } from '../../../../views/subsections/analysis_settings/dimension_mapping_file/dimensionMappingFile';
import { CommandRegistration } from '../analysis_file_mode';

export class DimensionMappingFileCommands {
    constructor(private readonly dimensionMappingSetting: DimensionMappingFileSetting) {}

    static getCommandRegistrations(
        context: vscode.ExtensionContext,
        dimensionMappingSetting: DimensionMappingFileSetting,
        refreshCallback: () => void,
    ): CommandRegistration[] {
        void context;
        const commands = new DimensionMappingFileCommands(dimensionMappingSetting);

        return [
            {
                commandId: 'codeXR.analysis.selectDimensionMappingFile',
                callback: async (dimensionName: string) => {
                    await commands.selectDimensionMapping(dimensionName);
                    refreshCallback();
                },
                description: 'Select dimension mapping for a specific chart dimension',
            },
        ];
    }

    private async selectDimensionMapping(dimensionName: string): Promise<void> {
        try {
            await this.dimensionMappingSetting.showDimensionMappingSelection(dimensionName);
        } catch (error) {
            console.error('DIMENSION_MAPPING_FILE_COMMANDS: Error selecting dimension mapping:', error);
            vscode.window.showErrorMessage(`Failed to select dimension mapping: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
