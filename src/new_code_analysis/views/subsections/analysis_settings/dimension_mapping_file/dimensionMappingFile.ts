/**
 * Dimension Mapping File Setting Item
 * Manages the dimension mapping configuration for file analysis with real BabiaXR chart integration
 */

import * as vscode from 'vscode';
import { NewCodeAnalysisTreeItem } from '../../../items/newCodeAnalysisItems';
import { AnalysisConfigurationStorage } from '../../../../configuration';
import { chartTemplates } from '../../../../../babia_templates/charts/templateCharts';
import { ChartDimension, ChartMetadata } from '../../../../../babia_templates/models/chartModels';
import { DimensionMappingValidator } from './dimensionMappingValidator';

export class DimensionMappingFileSetting {
    private storage: AnalysisConfigurationStorage;

    constructor(context: vscode.ExtensionContext) {
        this.storage = AnalysisConfigurationStorage.getInstance(context);
    }

    /**
     * Get the tree item for this setting
     */
    async getSettingItem(): Promise<NewCodeAnalysisTreeItem> {
        const currentMode = await this.storage.getAnalysisMode();
        const chartType = await this.storage.getChartTypeFile();
        
        const label = `Dimension Mapping (File)`;
        const description = chartType ? `Dimensions for ${chartType} chart` : 'Select chart type first';
        
        // Always use purple color for chart-related icons as requested
        const iconPath = new vscode.ThemeIcon('symbol-misc', new vscode.ThemeColor('charts.purple'));
        
        return new NewCodeAnalysisTreeItem(
            label,
            vscode.TreeItemCollapsibleState.Collapsed,
            'subsection',
            undefined, // No command on the main item
            iconPath,
            description,
            chartType ? `Configure ${chartType} dimensions` : 'Select chart type first',
            'dimensionMappingFileSetting'
        );
    }

    /**
     * Get children items (chart dimensions)
     */
    async getChildren(): Promise<NewCodeAnalysisTreeItem[]> {
        const chartType = await this.storage.getChartTypeFile();
        
        console.log(`DIMENSION_MAPPING_FILE: Getting children for chart type: ${chartType}`);
        
        if (!chartType) {
            console.log('DIMENSION_MAPPING_FILE: No chart type selected, showing warning');
            return [new NewCodeAnalysisTreeItem(
                'Select Chart Type First',
                vscode.TreeItemCollapsibleState.None,
                'subsection',
                {
                    command: 'newCodeAnalysis.selectChartTypeFile',
                    title: 'Select Chart Type',
                    arguments: []
                },
                new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow')),
                'You must select a chart type before configuring dimensions',
                'Click to select chart type',
                'select-chart-type-first'
            )];
        }

        return await this.getDimensionItemsForChart(chartType);
    }

    private async getDimensionItemsForChart(chartType: string): Promise<NewCodeAnalysisTreeItem[]> {
        console.log(`DIMENSION_MAPPING_FILE: Looking for chart template for type: ${chartType}`);
        
        const chart = chartTemplates.find((c: ChartMetadata) => c.id === chartType);
        
        if (!chart || !chart.dimensions) {
            console.log(`DIMENSION_MAPPING_FILE: No chart found or no dimensions for chart type: ${chartType}`);
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

        console.log(`DIMENSION_MAPPING_FILE: Found chart "${chart.name}" with ${chart.dimensions.length} dimensions:`, 
                   chart.dimensions.map(d => d.name).join(', '));

        const dimensionItems = await Promise.all(
            chart.dimensions.map((dimension: ChartDimension) => this.createDimensionItem(dimension))
        );
        
        return dimensionItems;
    }

    private async createDimensionItem(dimension: ChartDimension): Promise<NewCodeAnalysisTreeItem> {
        // Check if we have a persistent mapping for this dimension
        const mappedValue = await this.getDimensionMapping(dimension.name) || 'Not configured';
        
        const label = `${dimension.label}: ${mappedValue}`;
        const description = this.getDimensionDescription(dimension);
        
        console.log(`DIMENSION_MAPPING_FILE: Creating dimension item for "${dimension.name}" - ${dimension.label}, mapped to: ${mappedValue}`);
        
        // Use warning icon if dimension is required but not mapped
        let iconPath = await this.getDimensionIcon(dimension);
        if (mappedValue === 'Not configured' && dimension.required) {
            iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
        }
        
        return new NewCodeAnalysisTreeItem(
            label,
            vscode.TreeItemCollapsibleState.None,
            'subsection',
            {
                command: 'newCodeAnalysis.selectDimensionMappingFile',
                title: 'Select Dimension Mapping',
                arguments: [dimension]
            },
            iconPath,
            description,
            'Click to configure dimension mapping',
            `dimension-${dimension.name}`
        );
    }

    private getDimensionDescription(dimension: ChartDimension): string {
        const typeStr = dimension.dataType === 'numeric' ? 'numerical only' : 'any value';
        const requiredStr = dimension.required ? 'Required' : 'Optional';
        return `(${typeStr}) • ${requiredStr} • ${dimension.description}`;
    }

    private async getDimensionIcon(dimension: ChartDimension): Promise<vscode.ThemeIcon> {
        const chartType = await this.storage.getChartTypeFile();
        
        if (!chartType) {
            return new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.foreground'));
        }
        
        // Get current dimension mappings
        const dimensionMappings = await this.storage.getDimensionMappingFile();
        
        // Get validation result using the validator
        const validationResult = DimensionMappingValidator.validateMappingsForChart(
            chartType,
            dimensionMappings
        );
        
        // Check if this dimension is mapped
        const mapping = dimensionMappings[dimension.name];
        if (!mapping) {
            // Check if it's required
            const isRequired = dimension.required === true;
            return isRequired 
                ? new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'))
                : new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.foreground'));
        }
        
        // Check if this dimension has conflicts
        const hasConflict = validationResult.conflicts.some((conflict: any) => 
            conflict.conflictingDimensions.includes(dimension.name)
        );
        
        if (hasConflict) {
            return new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
        }
        
        // Dimension is mapped without conflicts
        return new vscode.ThemeIcon('symbol-field', new vscode.ThemeColor('charts.purple'));
    }

    /**
     * Available data fields for file analysis (real analysis output fields)
     */
    getAvailableDataFields(): string[] {
        return ['functionName', 'parameters', 'lineCount', 'complexity', 'cyclomaticDensity'];
    }

    /**
     * Get numeric-only fields (fields that contain numeric values)
     */
    getNumericDataFields(): string[] {
        return ['parameters', 'lineCount', 'complexity', 'cyclomaticDensity'];
    }

    /**
     * Get fields available for a specific dimension based on its dataType
     */
    getAvailableFieldsForDimension(dimension: ChartDimension): string[] {
        console.log(`DIMENSION_MAPPING_FILE: Getting available fields for dimension "${dimension.name}" with dataType: ${dimension.dataType}`);
        
        const allFields = this.getAvailableDataFields();
        const numericFields = this.getNumericDataFields();
        
        if (dimension.dataType === 'numeric') {
            console.log(`DIMENSION_MAPPING_FILE: Dimension "${dimension.name}" requires numeric fields only:`, numericFields);
            return numericFields;
        }
        
        console.log(`DIMENSION_MAPPING_FILE: Dimension "${dimension.name}" accepts any field type:`, allFields);
        return allFields;
    }

    /**
     * Set dimension mapping (persistent storage)
     */
    async setDimensionMapping(dimensionName: string, dataField: string): Promise<void> {
        console.log(`DIMENSION_MAPPING_FILE: Setting mapping for "${dimensionName}" to "${dataField}"`);
        
        // Get current mappings
        const currentMappings = await this.storage.getDimensionMappingFile();
        
        // Update the mapping
        const updatedMappings = { ...currentMappings, [dimensionName]: dataField };
        
        // Save to persistent storage
        await this.storage.setDimensionMappingFile(updatedMappings);
        
        console.log(`DIMENSION_MAPPING_FILE: Successfully saved mapping for "${dimensionName}" to storage`);
    }

    /**
     * Clear dimension mapping (persistent storage)
     */
    async clearDimensionMapping(dimensionName: string): Promise<void> {
        console.log(`DIMENSION_MAPPING_FILE: Clearing mapping for "${dimensionName}"`);
        
        // Get current mappings
        const currentMappings = await this.storage.getDimensionMappingFile();
        
        // Remove the mapping
        const updatedMappings = { ...currentMappings };
        delete updatedMappings[dimensionName];
        
        // Save to persistent storage
        await this.storage.setDimensionMappingFile(updatedMappings);
        
        console.log(`DIMENSION_MAPPING_FILE: Successfully cleared mapping for "${dimensionName}" from storage`);
    }

    /**
     * Get current dimension mapping (persistent storage)
     */
    async getDimensionMapping(dimensionName: string): Promise<string | undefined> {
        const currentMappings = await this.storage.getDimensionMappingFile();
        return currentMappings[dimensionName];
    }

    /**
     * Get current dimension mappings for external use
     */
    async getCurrentMappings(): Promise<Record<string, string>> {
        return await this.storage.getDimensionMappingFile();
    }
}
