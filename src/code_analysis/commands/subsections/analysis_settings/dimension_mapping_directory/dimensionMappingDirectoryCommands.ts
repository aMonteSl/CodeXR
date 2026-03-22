/**
 * Dimension Mapping Directory Commands
 * Commands specific to the Dimension Mapping (Directory) setting
 */

import * as vscode from 'vscode';
import { DimensionMappingDirectorySetting } from '../../../../views/subsections/analysis_settings/dimension_mapping_directory';
import { CommandRegistration } from '../analysis_file_mode';

export class DimensionMappingDirectoryCommands {
    constructor(private readonly dimensionMappingDirectorySetting: DimensionMappingDirectorySetting) {}

    static getCommandRegistrations(
        context: vscode.ExtensionContext,
        dimensionMappingDirectorySetting: DimensionMappingDirectorySetting,
        refreshCallback: () => void,
    ): CommandRegistration[] {
        void context;
        const commands = new DimensionMappingDirectoryCommands(dimensionMappingDirectorySetting);

        return [
            {
                commandId: 'codeXR.analysis.selectDimensionMappingDirectory',
                callback: async (dimensionName: string) => {
                    await commands.selectDimensionMapping(dimensionName);
                    refreshCallback();
                },
                description: 'Select dimension mapping for directory analysis visualization',
            },
        ];
    }

    private async selectDimensionMapping(dimensionName: string): Promise<void> {
        try {
            await this.dimensionMappingDirectorySetting.showDimensionMappingSelection(dimensionName);
        } catch (error) {
            console.error('DIMENSION_MAPPING_DIRECTORY_COMMANDS: Error in selectDimensionMapping:', error);
            vscode.window.showErrorMessage(`Failed to show dimension mapping selection: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
