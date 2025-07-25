/**
 * Dimension Mapping File Commands
 * Commands specific to the Dimension Mapping (File) setting with real BabiaXR dimension mapping
 */

import * as vscode from 'vscode';
import { DimensionMappingFileSetting } from '../../../../views/subsections/analysis_settings/dimension_mapping_file/dimensionMappingFile';
import { CommandRegistration } from '../analysis_file_mode';
import { ChartDimension } from '../../../../../babia_templates/models/chartModels';
import { DimensionValidator } from '../../../../../babia_templates/processing/dimensionValidator';
import { chartTemplates } from '../../../../../babia_templates/charts/templateCharts';

export class DimensionMappingFileCommands {

    constructor(
        private context: vscode.ExtensionContext,
        private dimensionMappingSetting: DimensionMappingFileSetting
    ) {}

    /**
     * Get command registrations (don't register them yet)
     * This follows the "nested dolls" architecture pattern
     */
    static getCommandRegistrations(
        context: vscode.ExtensionContext, 
        dimensionMappingSetting: DimensionMappingFileSetting,
        refreshCallback: () => void
    ): CommandRegistration[] {
        const commands = new DimensionMappingFileCommands(context, dimensionMappingSetting);

        return [
            {
                commandId: 'newCodeAnalysis.selectDimensionMappingFile',
                callback: async (dimension: ChartDimension) => {
                    await commands.selectDimensionMapping(dimension);
                    refreshCallback();
                },
                description: 'Select dimension mapping for a specific chart dimension'
            }
        ];
    }

    /**
     * Select dimension mapping for a specific dimension
     */
    private async selectDimensionMapping(dimension: ChartDimension): Promise<void> {
        try {
            console.log(`DIMENSION_MAPPING_FILE_COMMANDS: Selecting dimension mapping for dimension: "${dimension.name}"`);
            console.log(`DIMENSION_MAPPING_FILE_COMMANDS: Dimension details - Label: "${dimension.label}", DataType: "${dimension.dataType}", Required: ${dimension.required}`);

            // Get available fields for this dimension type using the filtering logic
            const availableFields = this.dimensionMappingSetting.getAvailableFieldsForDimension(dimension);
            
            if (availableFields.length === 0) {
                vscode.window.showWarningMessage(`No available fields for dimension: ${dimension.label} (requires ${dimension.dataType} fields)`);
                return;
            }

            console.log(`DIMENSION_MAPPING_FILE_COMMANDS: Available fields for "${dimension.name}":`, availableFields);

            // Create quick pick items with detailed descriptions
            const quickPickItems = availableFields.map(field => ({
                label: field,
                description: this.getFieldDescription(field),
                detail: this.getFieldTypeDescription(field, dimension)
            }));

            // Add "Clear mapping" option
            quickPickItems.unshift({
                label: '$(clear-all) Clear mapping',
                description: 'Remove the mapping for this dimension',
                detail: dimension.required ? 'Note: This is a required dimension' : 'This optional dimension will not be mapped to any data field'
            });

            // Show validation info in the placeholder
            const typeInfo = dimension.dataType === 'numeric' ? 'numeric fields only' : 'any field type';
            const requiredInfo = dimension.required ? 'REQUIRED' : 'optional';

            const selection = await vscode.window.showQuickPick(quickPickItems, {
                title: `Map ${dimension.label}`,
                placeHolder: `Select a data field for ${dimension.label} (${typeInfo}, ${requiredInfo})`,
                ignoreFocusOut: true,
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (!selection) {
                console.log(`DIMENSION_MAPPING_FILE_COMMANDS: User cancelled dimension mapping for "${dimension.name}"`);
                return; // User cancelled
            }

            if (selection.label.includes('Clear mapping')) {
                console.log(`DIMENSION_MAPPING_FILE_COMMANDS: Clearing mapping for dimension "${dimension.name}"`);
                await this.dimensionMappingSetting.clearDimensionMapping(dimension.name);
                vscode.window.showInformationMessage(`Cleared mapping for ${dimension.label}`);
            } else {
                console.log(`DIMENSION_MAPPING_FILE_COMMANDS: Mapping dimension "${dimension.name}" to field "${selection.label}"`);
                
                // Check for conflicts with other dimensions before setting
                const currentMappings = await this.dimensionMappingSetting.getCurrentMappings();
                const conflictDimension = Object.keys(currentMappings).find(
                    key => key !== dimension.name && currentMappings[key] === selection.label
                );

                if (conflictDimension) {
                    const shouldProceed = await vscode.window.showWarningMessage(
                        `The field "${selection.label}" is already mapped to another dimension. Do you want to proceed? This will clear the previous mapping.`,
                        'Proceed', 'Cancel'
                    );

                    if (shouldProceed !== 'Proceed') {
                        console.log('DIMENSION_MAPPING_FILE_COMMANDS: Mapping cancelled due to conflict');
                        return;
                    }

                    // Clear the conflicting mapping
                    await this.dimensionMappingSetting.clearDimensionMapping(conflictDimension);
                    console.log(`DIMENSION_MAPPING_FILE_COMMANDS: Cleared conflicting mapping for dimension "${conflictDimension}"`);
                }
                
                // Set the mapping using persistent storage
                await this.dimensionMappingSetting.setDimensionMapping(dimension.name, selection.label);
                
                vscode.window.showInformationMessage(`Mapped ${dimension.label} → ${selection.label}`);
            }

            console.log(`DIMENSION_MAPPING_FILE_COMMANDS: Dimension mapping operation completed for "${dimension.name}"`);
        } catch (error) {
            console.error('DIMENSION_MAPPING_FILE_COMMANDS: Error selecting dimension mapping:', error);
            vscode.window.showErrorMessage(`Failed to select dimension mapping: ${error}`);
        }
    }

    /**
     * Get detailed description for a data field (real analysis data fields)
     */
    private getFieldDescription(field: string): string {
        const descriptions: Record<string, string> = {
            'functionName': 'Unique identifier name of the function or method',
            'parameters': 'Total count of input parameters in the function signature',
            'lineCount': 'Total number of source code lines within the function body',
            'complexity': 'Cyclomatic Complexity Number - measure of code complexity based on decision points',
            'cyclomaticDensity': 'Cyclomatic Complexity Density ratio (complexity divided by line count)'
        };
        return descriptions[field] || 'Analysis data field';
    }

    /**
     * Get type compatibility description (removed compatibility info, now just empty)
     */
    private getFieldTypeDescription(field: string, dimension: ChartDimension): string {
        // No type compatibility description in detail - that's now shown in dimension description
        return '';
    }
}
