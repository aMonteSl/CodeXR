/**
 * Dimension Mapping Directory Setting Item
 * Manages the dimension mapping configuration for directory analysis with real BabiaXR chart integration
 */

import * as vscode from 'vscode';
import { NewCodeAnalysisTreeItem } from '../../../items/newCodeAnalysisItems';
import { AnalysisConfigurationStorage } from '../../../../configuration';
import { chartTemplates } from '../../../../../babia_templates/charts/templateCharts';
import { ChartDimension, ChartMetadata } from '../../../../../babia_templates/models/chartModels';
import { DimensionMappingValidator } from '../dimension_mapping_file/dimensionMappingValidator';

/**
 * Available data fields for directory analysis
 */
export const DIRECTORY_DATA_FIELDS = [
    // File identification fields
    { id: 'fileName', label: 'File Name', description: 'Name of the file' },
    { id: 'filePath', label: 'File Path', description: 'Full path to the file' },
    { id: 'relativePath', label: 'Relative Path', description: 'Relative path from analysis root' },
    { id: 'language', label: 'Language', description: 'Programming language of the file' },
    
    // File size and basic metrics
    { id: 'fileSizeBytes', label: 'File Size (Bytes)', description: 'Size of the file in bytes' },
    { id: 'totalLines', label: 'Total Lines', description: 'Total number of lines in the file' },
    { id: 'codeLines', label: 'Code Lines', description: 'Number of lines containing code' },
    { id: 'commentLines', label: 'Comment Lines', description: 'Number of lines containing comments' },
    { id: 'blankLines', label: 'Blank Lines', description: 'Number of blank lines in the file' },
    
    // Code structure metrics
    { id: 'functionCount', label: 'Function Count', description: 'Number of functions in the file' },
    { id: 'classCount', label: 'Class Count', description: 'Number of classes in the file' },
    
    // Complexity metrics - EXACT names from data.json
    { id: 'cyclomaticComplexityNumber', label: 'Mean Complexity', description: 'Average cyclomatic complexity of the file' },
    { id: 'maxComplexity', label: 'Max Complexity', description: 'Maximum cyclomatic complexity in the file' },
    { id: 'cyclomaticComplexityDensity', label: 'Complexity Density', description: 'Cyclomatic complexity density of the file' },
    
    // Function parameter metrics
    { id: 'maxFunctionParameters', label: 'Max Function Parameters', description: 'Maximum number of parameters in any function' },
    { id: 'averageFunctionParameters', label: 'Average Function Parameters', description: 'Average number of parameters across functions' }
];

export class DimensionMappingDirectorySetting {
    private storage: AnalysisConfigurationStorage;

    constructor(context: vscode.ExtensionContext) {
        this.storage = AnalysisConfigurationStorage.getInstance(context);
    }

    /**
     * Get the tree item for this setting
     */
    async getSettingItem(): Promise<NewCodeAnalysisTreeItem> {
        console.log('DIMENSION_MAPPING_DIRECTORY: getSettingItem() called');
        const currentMode = await this.storage.getAnalysisDirectoryMode();
        const chartType = await this.storage.getDirectoryChartType();
        console.log(`DIMENSION_MAPPING_DIRECTORY: Got chart type: "${chartType}" for setting item`);
        
        const label = `Dimension Mapping (Directory)`;
        const description = chartType ? `Dimensions for ${chartType} chart` : '⚠️ Select Chart Type (Directory) first';
        const tooltip = chartType ? `Configure ${chartType} dimensions` : 'You must first select a chart type in "Chart Type (Directory)"';
        
        // Always use purple color for chart-related icons as requested
        const iconPath = new vscode.ThemeIcon('symbol-misc', new vscode.ThemeColor('charts.purple'));
        
        return new NewCodeAnalysisTreeItem(
            label,
            vscode.TreeItemCollapsibleState.Collapsed,
            'subsection',
            undefined, // No command on the main item
            iconPath,
            description,
            tooltip,
            'dimensionMappingDirectorySetting'
        );
    }

    /**
     * Get children items (chart dimensions)
     */
    async getChildren(): Promise<NewCodeAnalysisTreeItem[]> {
        console.log('DIMENSION_MAPPING_DIRECTORY: getChildren() called - START');
        const chartType = await this.storage.getDirectoryChartType();
        
        console.log(`DIMENSION_MAPPING_DIRECTORY: Getting children for chart type: "${chartType}" (type: ${typeof chartType})`);
        
        if (!chartType) {
            console.log('DIMENSION_MAPPING_DIRECTORY: No valid chart type selected, showing warning');
            return [new NewCodeAnalysisTreeItem(
                '⚠️ Select Chart Type (Directory) First',
                vscode.TreeItemCollapsibleState.None,
                'subsection',
                {
                    command: 'newCodeAnalysis.selectChartTypeDirectory',
                    title: 'Select Chart Type for Directory Analysis',
                    arguments: []
                },
                new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow')),
                'You must first select a chart type in "Chart Type (Directory)" before configuring dimension mappings',
                'Click to go to Chart Type (Directory) setting',
                'select-chart-type-first'
            )];
        }

        return await this.getDimensionItemsForChart(chartType);
    }

    private async getDimensionItemsForChart(chartType: string): Promise<NewCodeAnalysisTreeItem[]> {
        console.log(`DIMENSION_MAPPING_DIRECTORY: Looking for chart template for type: ${chartType}`);
        console.log(`DIMENSION_MAPPING_DIRECTORY: Available chart templates:`, chartTemplates.map(c => `${c.id} (${c.name})`));
        
        const chart = chartTemplates.find((c: ChartMetadata) => c.id === chartType);
        
        if (!chart || !chart.dimensions) {
            console.log(`DIMENSION_MAPPING_DIRECTORY: No chart found or no dimensions for chart type: ${chartType}`);
            console.log(`DIMENSION_MAPPING_DIRECTORY: Chart found:`, chart ? `Yes (${chart.name})` : 'No');
            console.log(`DIMENSION_MAPPING_DIRECTORY: Chart has dimensions:`, chart?.dimensions ? `Yes (${chart.dimensions.length})` : 'No');
            return [new NewCodeAnalysisTreeItem(
                'No dimensions available',
                vscode.TreeItemCollapsibleState.None,
                'subsection',
                undefined,
                new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red')),
                'This chart type has no configurable dimensions',
                undefined,
                'no-dimensions'
            )];
        }

        console.log(`DIMENSION_MAPPING_DIRECTORY: Found chart "${chart.name}" with ${chart.dimensions.length} dimensions:`, 
                   chart.dimensions.map(d => d.name));

        const dimensionMappings = await this.getDirectoryDimensionMappings();
        console.log('DIMENSION_MAPPING_DIRECTORY: Current dimension mappings:', dimensionMappings);
        const items: NewCodeAnalysisTreeItem[] = [];

        for (const dimension of chart.dimensions) {
            const currentMapping = dimensionMappings[dimension.name];
            
            // Find the display label for the mapped field
            let mappedFieldDisplay = 'Not mapped';
            let iconPath = new vscode.ThemeIcon('symbol-field', new vscode.ThemeColor('charts.purple'));
            if (currentMapping) {
                const mappedField = DIRECTORY_DATA_FIELDS.find(field => field.id === currentMapping);
                mappedFieldDisplay = mappedField ? mappedField.label : currentMapping;
            } else {
                // Use warning icon if dimension is required but not mapped
                if (dimension.required) {
                    iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
                }
            }
            
            console.log(`DIMENSION_MAPPING_DIRECTORY: Dimension "${dimension.name}" mapped to "${currentMapping}" (display: "${mappedFieldDisplay}")`);
            
            const dimensionItem = new NewCodeAnalysisTreeItem(
                `${dimension.label}: ${mappedFieldDisplay}`,
                vscode.TreeItemCollapsibleState.None,
                'subsection',
                {
                    command: 'newCodeAnalysis.selectDimensionMappingDirectory',
                    title: `Map ${dimension.label} dimension`,
                    arguments: [dimension.name, dimension.label]
                },
                iconPath,
                `${dimension.description}. Currently mapped to: ${mappedFieldDisplay}. Click to change mapping.`,
                currentMapping ? `→ ${mappedFieldDisplay}` : 'Click to map',
                `dimension-mapping-directory-${dimension.name}`
            );
            
            items.push(dimensionItem);
        }

        return items;
    }

    /**
     * Get directory dimension mappings from storage
     */
    private async getDirectoryDimensionMappings(): Promise<Record<string, string>> {
        try {
            const mappings = await this.storage.getDimensionMappingDirectory();
            console.log('DIMENSION_MAPPING_DIRECTORY: Retrieved mappings:', mappings);
            return mappings || {};
        } catch (error) {
            console.error('DIMENSION_MAPPING_DIRECTORY: Error getting mappings:', error);
            return {};
        }
    }

    /**
     * Set directory dimension mappings in storage
     */
    private async setDirectoryDimensionMappings(mappings: Record<string, string>): Promise<void> {
        try {
            await this.storage.setDimensionMappingDirectory(mappings);
            console.log('DIMENSION_MAPPING_DIRECTORY: Set mappings:', mappings);
        } catch (error) {
            console.error('DIMENSION_MAPPING_DIRECTORY: Error setting mappings:', error);
            throw error;
        }
    }

    /**
     * Show dimension mapping selection dialog
     */
    async showDimensionMappingSelection(dimensionName: string, dimensionLabel: string): Promise<void> {
        console.log(`DIMENSION_MAPPING_DIRECTORY: Opening mapping selection for dimension: ${dimensionName} (${dimensionLabel})`);
        
        try {
            const chartType = await this.storage.getDirectoryChartType();
            const chart = chartTemplates.find((c: ChartMetadata) => c.id === chartType);
            
            if (!chart) {
                vscode.window.showErrorMessage('Chart type not found. Please select a valid chart type first.');
                return;
            }
            
            const dimension = chart.dimensions.find(d => d.name === dimensionName);
            if (!dimension) {
                vscode.window.showErrorMessage(`Dimension ${dimensionName} not found in chart ${chartType}.`);
                return;
            }
            
            const currentMappings = await this.getDirectoryDimensionMappings();
            const currentMapping = currentMappings[dimensionName];
            console.log(`DIMENSION_MAPPING_DIRECTORY: Current mapping for ${dimensionName}:`, currentMapping);
            
            // Filter available fields based on dimension data type
            let availableFields = DIRECTORY_DATA_FIELDS;
            if (dimension.dataType === 'numeric') {
                // Only numeric fields (exclude fileName, filePath, relativePath, and language - all string fields)
                availableFields = DIRECTORY_DATA_FIELDS.filter(field => 
                    field.id !== 'fileName' && 
                    field.id !== 'filePath' && 
                    field.id !== 'relativePath' && 
                    field.id !== 'language'
                );
                console.log(`DIMENSION_MAPPING_DIRECTORY: Filtered to ${availableFields.length} numeric fields for dimension ${dimensionName} (excluded string fields: fileName, filePath, relativePath, language)`);
            } else {
                console.log(`DIMENSION_MAPPING_DIRECTORY: Using all ${availableFields.length} fields for dimension ${dimensionName} (accepts any data type)`);
            }

            // Create quick pick items from available directory data fields
            const quickPickItems: (vscode.QuickPickItem & { fieldId: string })[] = availableFields.map(field => ({
                label: field.label,
                description: field.description,
                detail: currentMapping === field.id ? '✓ Currently selected' : '',
                fieldId: field.id
            }));

            console.log(`DIMENSION_MAPPING_DIRECTORY: Created ${quickPickItems.length} quick pick items`);

            // Add "Clear mapping" option
            quickPickItems.unshift({
                label: '$(clear-all) Clear mapping',
                description: 'Remove the mapping for this dimension',
                detail: currentMapping ? 'Clear current selection' : 'No mapping to clear',
                fieldId: ''
            });

            console.log(`DIMENSION_MAPPING_DIRECTORY: Showing quick pick with ${quickPickItems.length} items`);

            // Show quick pick
            const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: `Select data field to map to ${dimensionLabel} dimension`,
                title: `Dimension Mapping: ${dimensionLabel}`,
                canPickMany: false
            });

            if (selectedItem !== undefined) {
                const newMappings = { ...currentMappings };
                
                if (selectedItem.fieldId === '') {
                    // Clear mapping
                    delete newMappings[dimensionName];
                    console.log(`DIMENSION_MAPPING_DIRECTORY: Cleared mapping for dimension: ${dimensionName}`);
                } else {
                    // Check for conflicts with other dimensions
                    const conflictDimension = Object.keys(newMappings).find(
                        key => key !== dimensionName && newMappings[key] === selectedItem.fieldId
                    );

                    if (conflictDimension) {
                        const shouldProceed = await vscode.window.showWarningMessage(
                            `The field "${selectedItem.label}" is already mapped to another dimension. Do you want to proceed? This will clear the previous mapping.`,
                            'Proceed', 'Cancel'
                        );

                        if (shouldProceed !== 'Proceed') {
                            console.log('DIMENSION_MAPPING_DIRECTORY: Mapping cancelled due to conflict');
                            return;
                        }

                        // Clear the conflicting mapping
                        delete newMappings[conflictDimension];
                    }

                    // Set new mapping
                    newMappings[dimensionName] = selectedItem.fieldId;
                    console.log(`DIMENSION_MAPPING_DIRECTORY: Mapped dimension "${dimensionName}" to field "${selectedItem.fieldId}"`);
                }

                // Save mappings
                await this.setDirectoryDimensionMappings(newMappings);
                
                const mappingText = selectedItem.fieldId ? 
                    `mapped to "${selectedItem.label}"` : 
                    'mapping cleared';
                
                vscode.window.showInformationMessage(
                    `Dimension "${dimensionLabel}" ${mappingText}`
                );
            } else {
                console.log('DIMENSION_MAPPING_DIRECTORY: Dimension mapping selection cancelled');
            }
        } catch (error) {
            console.error('DIMENSION_MAPPING_DIRECTORY: Error in dimension mapping selection:', error);
            vscode.window.showErrorMessage(`Failed to configure dimension mapping: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Validate current mappings
     */
    async validateMappings(): Promise<boolean> {
        const chartType = await this.storage.getDirectoryChartType();
        if (!chartType) {
            return false;
        }

        const chart = chartTemplates.find((c: ChartMetadata) => c.id === chartType);
        if (!chart) {
            return false;
        }

        const mappings = await this.getDirectoryDimensionMappings();
        
        // Check if all required dimensions are mapped
        const requiredDimensions = chart.dimensions.filter(d => d.required);
        const missingMappings = requiredDimensions.filter(d => !mappings[d.name]);

        if (missingMappings.length > 0) {
            console.log(`DIMENSION_MAPPING_DIRECTORY: Missing required mappings: ${missingMappings.map(d => d.name).join(', ')}`);
            return false;
        }

        return true;
    }

    /**
     * Get current directory dimension mappings for external use
     */
    async getCurrentMappings(): Promise<Record<string, string>> {
        return await this.getDirectoryDimensionMappings();
    }
}
