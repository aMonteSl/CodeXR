/**
 * Dimension Mapping Directory Setting Item
 * Manages the dimension mapping configuration for directory XR analysis.
 */

import * as vscode from 'vscode';
import { CodeAnalysisTreeItem } from '../../../items/analysisItems';
import { AnalysisConfigurationStorage } from '../../../../configuration';
import { chartTemplates } from '../../../../../babia_templates/charts/templateCharts';
import { ChartDimension, ChartMetadata } from '../../../../../babia_templates/models/chartModels';
import { DimensionMappingValidator } from '../dimension_mapping_file/dimensionMappingValidator';
import { XRFieldDefinition, XRFieldSchemaService } from '../../../../services/xrFieldSchemaService';

export class DimensionMappingDirectorySetting {
    private readonly storage: AnalysisConfigurationStorage;
    private readonly schemaService: XRFieldSchemaService;

    constructor(context: vscode.ExtensionContext) {
        this.storage = AnalysisConfigurationStorage.getInstance(context);
        this.schemaService = XRFieldSchemaService.getInstance(context);
    }

    async getSettingItem(): Promise<CodeAnalysisTreeItem> {
        const chartType = await this.storage.getDirectoryChartType();

        return new CodeAnalysisTreeItem(
            'Dimension Mapping (Directory)',
            vscode.TreeItemCollapsibleState.Collapsed,
            'subsection',
            undefined,
            new vscode.ThemeIcon('symbol-misc', new vscode.ThemeColor('charts.purple')),
            chartType ? `Dimensions for ${chartType} chart` : 'Select Chart Type (Directory) first',
            chartType ? `Configure ${chartType} dimensions` : 'You must first select a chart type in Chart Type (Directory)',
            'dimensionMappingDirectorySetting',
        );
    }

    async getChildren(): Promise<CodeAnalysisTreeItem[]> {
        const chartType = await this.storage.getDirectoryChartType();
        if (!chartType) {
            return [new CodeAnalysisTreeItem(
                'Select Chart Type (Directory) First',
                vscode.TreeItemCollapsibleState.None,
                'subsection',
                {
                    command: 'codeXR.analysis.selectChartTypeDirectory',
                    title: 'Select Chart Type for Directory Analysis',
                    arguments: [],
                },
                new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow')),
                'You must first select a chart type in Chart Type (Directory) before configuring dimension mappings.',
                'Click to go to Chart Type (Directory) setting',
                'select-chart-type-directory-first',
            )];
        }

        const chart = chartTemplates.find((candidate: ChartMetadata) => candidate.id === chartType);
        if (!chart || !chart.dimensions) {
            return [new CodeAnalysisTreeItem(
                'No dimensions available',
                vscode.TreeItemCollapsibleState.None,
                'subsection',
                undefined,
                new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red')),
                'This chart type has no configurable dimensions.',
                undefined,
                'no-dimensions-directory',
            )];
        }

        const fieldDefinitions = await this.schemaService.getFields('directory', true);
        if (!fieldDefinitions) {
            return [this.createSchemaUnavailableItem()];
        }

        return Promise.all(chart.dimensions.map((dimension) => this.createDimensionItem(chartType, dimension, fieldDefinitions)));
    }

    async showDimensionMappingSelection(dimensionName: string, dimensionLabel: string): Promise<void> {
        const chartType = await this.storage.getDirectoryChartType();
        const chart = chartTemplates.find((candidate: ChartMetadata) => candidate.id === chartType);
        if (!chart) {
            vscode.window.showErrorMessage('Chart type not found. Please select a valid chart type first.');
            return;
        }

        const dimension = chart.dimensions.find((candidate) => candidate.name === dimensionName);
        if (!dimension) {
            vscode.window.showErrorMessage(`Dimension ${dimensionName} not found in chart ${chartType}.`);
            return;
        }

        const availableFields = await this.schemaService.getFieldsForDataType('directory', dimension.dataType, true);
        if (!availableFields) {
            vscode.window.showWarningMessage('Python Environment Not Ready. CodeXR could not load the XR field schema yet.');
            return;
        }

        const currentMappings = await this.getDirectoryDimensionMappings();
        const currentMapping = currentMappings[dimensionName];

        const quickPickItems: (vscode.QuickPickItem & { fieldId: string })[] = availableFields.map((field) => ({
            label: field.label,
            description: field.description,
            detail: this.getFieldDetail(field, currentMapping),
            fieldId: field.id,
        }));

        quickPickItems.unshift({
            label: '$(clear-all) Clear mapping',
            description: 'Remove the mapping for this dimension',
            detail: currentMapping ? 'Clear current selection' : 'No mapping to clear',
            fieldId: '',
        });

        const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: `Select data field to map to ${dimensionLabel} dimension`,
            title: `Dimension Mapping: ${dimensionLabel}`,
            canPickMany: false,
            matchOnDescription: true,
            matchOnDetail: true,
        });

        if (selectedItem === undefined) {
            return;
        }

        const newMappings = { ...currentMappings };
        if (selectedItem.fieldId === '') {
            delete newMappings[dimensionName];
            await this.setDirectoryDimensionMappings(newMappings);
            vscode.window.showInformationMessage(`Dimension "${dimensionLabel}" mapping cleared`);
            return;
        }

        const conflictDimension = Object.keys(newMappings).find(
            (key) => key !== dimensionName && newMappings[key] === selectedItem.fieldId,
        );

        if (conflictDimension) {
            const shouldProceed = await vscode.window.showWarningMessage(
                `The field "${selectedItem.label}" is already mapped to another dimension. Do you want to proceed? This will clear the previous mapping.`,
                'Proceed',
                'Cancel',
            );

            if (shouldProceed !== 'Proceed') {
                return;
            }

            delete newMappings[conflictDimension];
        }

        newMappings[dimensionName] = selectedItem.fieldId;
        await this.setDirectoryDimensionMappings(newMappings);
        vscode.window.showInformationMessage(`Dimension "${dimensionLabel}" mapped to "${selectedItem.label}"`);
    }

    async validateMappings(): Promise<boolean> {
        const chartType = await this.storage.getDirectoryChartType();
        if (!chartType) {
            return false;
        }

        const mappings = await this.getDirectoryDimensionMappings();
        const fieldTypes = await this.schemaService.getFieldTypeMap('directory', true);
        const validation = DimensionMappingValidator.validateMappingsForChart(chartType, mappings, fieldTypes);
        return validation.isValid;
    }

    async getCurrentMappings(): Promise<Record<string, string>> {
        return this.getDirectoryDimensionMappings();
    }

    private async createDimensionItem(
        chartType: string,
        dimension: ChartDimension,
        fieldDefinitions: XRFieldDefinition[],
    ): Promise<CodeAnalysisTreeItem> {
        const currentMappings = await this.getDirectoryDimensionMappings();
        const currentMapping = currentMappings[dimension.name];
        const mappedField = fieldDefinitions.find((field) => field.id === currentMapping);
        const mappedLabel = mappedField?.label ?? currentMapping ?? 'Not mapped';
        const iconPath = await this.getDimensionIcon(chartType, dimension);

        return new CodeAnalysisTreeItem(
            `${dimension.label}: ${mappedLabel}`,
            vscode.TreeItemCollapsibleState.None,
            'subsection',
            {
                command: 'codeXR.analysis.selectDimensionMappingDirectory',
                title: `Map ${dimension.label} dimension`,
                arguments: [dimension.name, dimension.label],
            },
            iconPath,
            `${dimension.description}. Currently mapped to: ${mappedLabel}. Click to change mapping.`,
            currentMapping ? `→ ${mappedLabel}` : 'Click to map',
            `dimension-mapping-directory-${dimension.name}`,
        );
    }

    private async getDirectoryDimensionMappings(): Promise<Record<string, string>> {
        return (await this.storage.getDimensionMappingDirectory()) || {};
    }

    private async setDirectoryDimensionMappings(mappings: Record<string, string>): Promise<void> {
        await this.storage.setDimensionMappingDirectory(mappings);
    }

    private async getDimensionIcon(chartType: string, dimension: ChartDimension): Promise<vscode.ThemeIcon> {
        const mappings = await this.getDirectoryDimensionMappings();
        const fieldTypes = await this.schemaService.getFieldTypeMap('directory', true);
        const validation = DimensionMappingValidator.validateMappingsForChart(chartType, mappings, fieldTypes);

        if (!mappings[dimension.name]) {
            return dimension.required
                ? new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'))
                : new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.foreground'));
        }

        const hasConflict = validation.conflicts.some((conflict) => conflict.conflictingDimensions.includes(dimension.name));
        const hasInvalidType = validation.invalidTypeMappings.some((mapping) => mapping.dimension === dimension.name);
        if (hasConflict || hasInvalidType) {
            return new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
        }

        return new vscode.ThemeIcon('symbol-field', new vscode.ThemeColor('charts.purple'));
    }

    private getFieldDetail(field: XRFieldDefinition, currentMapping?: string): string {
        const selectedText = currentMapping === field.id ? 'Currently selected' : field.id;
        const typeText = field.valueType === 'numeric' ? 'Numeric' : 'Text';
        return `${typeText} • ${selectedText}`;
    }

    private createSchemaUnavailableItem(): CodeAnalysisTreeItem {
        return new CodeAnalysisTreeItem(
            'Python Environment Not Ready',
            vscode.TreeItemCollapsibleState.None,
            'subsection',
            undefined,
            new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow')),
            'CodeXR could not load the XR field schema yet. Wait for the Python environment to finish initializing and reopen this setting.',
            'XR field schema unavailable',
            'directory-schema-unavailable',
        );
    }
}
