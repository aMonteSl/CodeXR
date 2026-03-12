/**
 * Dimension Mapping File Setting Item
 * Manages the dimension mapping configuration for file XR analysis.
 */

import * as vscode from 'vscode';
import { CodeAnalysisTreeItem } from '../../../items/analysisItems';
import { AnalysisConfigurationStorage } from '../../../../configuration';
import { chartTemplates } from '../../../../../babia_templates/charts/templateCharts';
import { ChartDimension, ChartMetadata } from '../../../../../babia_templates/models/chartModels';
import { DimensionMappingValidator } from './dimensionMappingValidator';
import { XRFieldDefinition, XRFieldSchemaService } from '../../../../services/xrFieldSchemaService';

export class DimensionMappingFileSetting {
    private readonly storage: AnalysisConfigurationStorage;
    private readonly schemaService: XRFieldSchemaService;

    constructor(context: vscode.ExtensionContext) {
        this.storage = AnalysisConfigurationStorage.getInstance(context);
        this.schemaService = XRFieldSchemaService.getInstance(context);
    }

    async getSettingItem(): Promise<CodeAnalysisTreeItem> {
        const chartType = await this.storage.getChartTypeFile();

        return new CodeAnalysisTreeItem(
            'Dimension Mapping (File)',
            vscode.TreeItemCollapsibleState.Collapsed,
            'subsection',
            undefined,
            new vscode.ThemeIcon('symbol-misc', new vscode.ThemeColor('charts.purple')),
            chartType ? `Dimensions for ${chartType} chart` : 'Select chart type first',
            chartType ? `Configure ${chartType} dimensions` : 'Select chart type first',
            'dimensionMappingFileSetting',
        );
    }

    async getChildren(): Promise<CodeAnalysisTreeItem[]> {
        const chartType = await this.storage.getChartTypeFile();

        if (!chartType) {
            return [new CodeAnalysisTreeItem(
                'Select Chart Type First',
                vscode.TreeItemCollapsibleState.None,
                'subsection',
                {
                    command: 'codeXR.analysis.selectChartTypeFile',
                    title: 'Select Chart Type',
                    arguments: [],
                },
                new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow')),
                'You must select a chart type before configuring dimensions.',
                'Click to select chart type',
                'select-chart-type-first',
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
                'no-dimensions',
            )];
        }

        const fieldDefinitions = await this.schemaService.getFields('file', true);
        if (!fieldDefinitions) {
            return [this.createSchemaUnavailableItem()];
        }

        return Promise.all(chart.dimensions.map((dimension) => this.createDimensionItem(chartType, dimension, fieldDefinitions)));
    }

    async showDimensionMappingSelection(dimension: ChartDimension): Promise<void> {
        const availableFields = await this.schemaService.getFieldsForDataType('file', dimension.dataType, true);
        if (!availableFields) {
            vscode.window.showWarningMessage('Python Environment Not Ready. CodeXR could not load the XR field schema yet.');
            return;
        }

        const currentMappings = await this.getCurrentMappings();
        const currentMapping = currentMappings[dimension.name];

        const quickPickItems: (vscode.QuickPickItem & { fieldId: string })[] = availableFields.map((field) => ({
            label: field.label,
            description: field.description,
            detail: this.getFieldDetail(field, dimension, currentMapping),
            fieldId: field.id,
        }));

        quickPickItems.unshift({
            label: '$(clear-all) Clear mapping',
            description: 'Remove the mapping for this dimension',
            detail: dimension.required ? 'Required dimensions must be remapped before launching XR.' : 'This optional dimension will not be mapped.',
            fieldId: '',
        });

        const selection = await vscode.window.showQuickPick(quickPickItems, {
            title: `Map ${dimension.label}`,
            placeHolder: `Select a data field for ${dimension.label}`,
            ignoreFocusOut: true,
            matchOnDescription: true,
            matchOnDetail: true,
        });

        if (!selection) {
            return;
        }

        if (selection.fieldId === '') {
            await this.clearDimensionMapping(dimension.name);
            vscode.window.showInformationMessage(`Cleared mapping for ${dimension.label}`);
            return;
        }

        const conflictDimension = Object.keys(currentMappings).find(
            (key) => key !== dimension.name && currentMappings[key] === selection.fieldId,
        );

        if (conflictDimension) {
            const shouldProceed = await vscode.window.showWarningMessage(
                `The field "${selection.label}" is already mapped to another dimension. Do you want to proceed? This will clear the previous mapping.`,
                'Proceed',
                'Cancel',
            );

            if (shouldProceed !== 'Proceed') {
                return;
            }

            await this.clearDimensionMapping(conflictDimension);
        }

        await this.setDimensionMapping(dimension.name, selection.fieldId);
        vscode.window.showInformationMessage(`Mapped ${dimension.label} → ${selection.label}`);
    }

    async setDimensionMapping(dimensionName: string, dataField: string): Promise<void> {
        const currentMappings = await this.storage.getDimensionMappingFile();
        await this.storage.setDimensionMappingFile({
            ...currentMappings,
            [dimensionName]: dataField,
        });
    }

    async clearDimensionMapping(dimensionName: string): Promise<void> {
        const currentMappings = await this.storage.getDimensionMappingFile();
        const updatedMappings = { ...currentMappings };
        delete updatedMappings[dimensionName];
        await this.storage.setDimensionMappingFile(updatedMappings);
    }

    async getDimensionMapping(dimensionName: string): Promise<string | undefined> {
        const currentMappings = await this.storage.getDimensionMappingFile();
        return currentMappings[dimensionName];
    }

    async getCurrentMappings(): Promise<Record<string, string>> {
        return this.storage.getDimensionMappingFile();
    }

    private async createDimensionItem(
        chartType: string,
        dimension: ChartDimension,
        fieldDefinitions: XRFieldDefinition[],
    ): Promise<CodeAnalysisTreeItem> {
        const mappedValue = await this.getDimensionMapping(dimension.name);
        const mappedField = fieldDefinitions.find((field) => field.id === mappedValue);
        const mappedLabel = mappedField?.label ?? mappedValue ?? 'Not configured';
        const iconPath = await this.getDimensionIcon(chartType, dimension);

        return new CodeAnalysisTreeItem(
            `${dimension.label}: ${mappedLabel}`,
            vscode.TreeItemCollapsibleState.None,
            'subsection',
            {
                command: 'codeXR.analysis.selectDimensionMappingFile',
                title: 'Select Dimension Mapping',
                arguments: [dimension],
            },
            iconPath,
            this.getDimensionDescription(dimension),
            'Click to configure dimension mapping',
            `dimension-${dimension.name}`,
        );
    }

    private getDimensionDescription(dimension: ChartDimension): string {
        const typeStr = dimension.dataType === 'numeric' ? 'numerical only' : 'any value';
        const requiredStr = dimension.required ? 'Required' : 'Optional';
        return `(${typeStr}) • ${requiredStr} • ${dimension.description}`;
    }

    private async getDimensionIcon(
        chartType: string,
        dimension: ChartDimension,
    ): Promise<vscode.ThemeIcon> {
        const dimensionMappings = await this.storage.getDimensionMappingFile();
        const fieldTypes = await this.schemaService.getFieldTypeMap('file', true);
        const validationResult = DimensionMappingValidator.validateMappingsForChart(chartType, dimensionMappings, fieldTypes);

        if (!dimensionMappings[dimension.name]) {
            return dimension.required
                ? new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'))
                : new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.foreground'));
        }

        const hasConflict = validationResult.conflicts.some((conflict) =>
            conflict.conflictingDimensions.includes(dimension.name),
        );
        const hasInvalidType = validationResult.invalidTypeMappings.some((mapping) => mapping.dimension === dimension.name);

        if (hasConflict || hasInvalidType) {
            return new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
        }

        return new vscode.ThemeIcon('symbol-field', new vscode.ThemeColor('charts.purple'));
    }

    private getFieldDetail(
        field: XRFieldDefinition,
        dimension: ChartDimension,
        currentMapping?: string,
    ): string {
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
            'file-schema-unavailable',
        );
    }
}
