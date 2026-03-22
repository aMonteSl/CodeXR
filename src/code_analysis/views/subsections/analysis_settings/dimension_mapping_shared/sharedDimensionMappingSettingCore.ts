import * as vscode from 'vscode';
import { CodeAnalysisTreeItem } from '../../../items/analysisItems';
import { AnalysisConfigurationStorage } from '../../../../configuration';
import { chartTemplates } from '../../../../../babia_templates/charts/templateCharts';
import { ChartDimension, ChartMetadata } from '../../../../../babia_templates/models/chartModels';
import { DimensionMappingValidator } from '../dimension_mapping_file/dimensionMappingValidator';
import { XRFieldDefinition, XRFieldSchemaService, XRSchemaTargetType } from '../../../../services/xrFieldSchemaService';

export interface DimensionMappingSettingAdapter {
    targetType: XRSchemaTargetType;
    settingLabel: string;
    settingContextValue: string;
    selectMappingCommandId: string;
    selectChartCommandId: string;
    selectChartCommandTitle: string;
    selectChartItemLabel: string;
    selectChartTooltip: string;
    selectChartDescription: string;
    noDimensionsContextValue: string;
    schemaUnavailableContextValue: string;
    dimensionContextPrefix: string;
    getChartType(storage: AnalysisConfigurationStorage): Promise<string | undefined>;
    getMappings(storage: AnalysisConfigurationStorage): Promise<Record<string, string> | undefined>;
    setMappings(storage: AnalysisConfigurationStorage, mappings: Record<string, string>): Promise<void>;
    getSettingTooltip(chartType?: string): string;
    getSettingDescription(chartType?: string): string;
}

export class SharedDimensionMappingSettingCore {
    private readonly storage: AnalysisConfigurationStorage;
    private readonly schemaService: XRFieldSchemaService;

    constructor(
        context: vscode.ExtensionContext,
        private readonly adapter: DimensionMappingSettingAdapter,
    ) {
        this.storage = AnalysisConfigurationStorage.getInstance(context);
        this.schemaService = XRFieldSchemaService.getInstance(context);
    }

    async getSettingItem(): Promise<CodeAnalysisTreeItem> {
        const chartType = await this.adapter.getChartType(this.storage);

        return new CodeAnalysisTreeItem(
            this.adapter.settingLabel,
            vscode.TreeItemCollapsibleState.Collapsed,
            'subsection',
            undefined,
            new vscode.ThemeIcon('symbol-misc', new vscode.ThemeColor('charts.purple')),
            this.adapter.getSettingTooltip(chartType),
            this.adapter.getSettingDescription(chartType),
            this.adapter.settingContextValue,
        );
    }

    async getChildren(): Promise<CodeAnalysisTreeItem[]> {
        const chartType = await this.adapter.getChartType(this.storage);
        if (!chartType) {
            return [new CodeAnalysisTreeItem(
                this.adapter.selectChartItemLabel,
                vscode.TreeItemCollapsibleState.None,
                'subsection',
                {
                    command: this.adapter.selectChartCommandId,
                    title: this.adapter.selectChartCommandTitle,
                    arguments: [],
                },
                new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow')),
                this.adapter.selectChartTooltip,
                this.adapter.selectChartDescription,
                `${this.adapter.dimensionContextPrefix}-select-chart-type-first`,
            )];
        }

        const chart = this.getChartMetadata(chartType);
        if (!chart || !chart.dimensions) {
            return [new CodeAnalysisTreeItem(
                'No dimensions available',
                vscode.TreeItemCollapsibleState.None,
                'subsection',
                undefined,
                new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red')),
                'This chart type has no configurable dimensions.',
                undefined,
                this.adapter.noDimensionsContextValue,
            )];
        }

        const fieldDefinitions = await this.schemaService.getFields(this.adapter.targetType, true);
        if (!fieldDefinitions) {
            return [this.createSchemaUnavailableItem()];
        }

        return Promise.all(
            chart.dimensions.map((dimension) => this.createDimensionItem(chartType, dimension, fieldDefinitions)),
        );
    }

    async showDimensionMappingSelection(dimensionName: string): Promise<void> {
        const chartType = await this.adapter.getChartType(this.storage);
        const chart = chartType ? this.getChartMetadata(chartType) : undefined;
        if (!chart) {
            vscode.window.showErrorMessage('Chart type not found. Please select a valid chart type first.');
            return;
        }

        const dimension = chart.dimensions.find((candidate) => candidate.name === dimensionName);
        if (!dimension) {
            vscode.window.showErrorMessage(`Dimension ${dimensionName} not found in chart ${chartType}.`);
            return;
        }

        const availableFields = await this.schemaService.getFieldsForDataType(
            this.adapter.targetType,
            dimension.dataType,
            true,
        );
        if (!availableFields) {
            vscode.window.showWarningMessage('Python Environment Not Ready. CodeXR could not load the XR field schema yet.');
            return;
        }

        const currentMappings = await this.getCurrentMappings();
        const currentMapping = currentMappings[dimension.name];

        const quickPickItems: (vscode.QuickPickItem & { fieldId: string })[] = availableFields.map((field) => ({
            label: field.label,
            description: field.description,
            detail: this.getFieldDetail(field, currentMapping),
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
            canPickMany: false,
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

    async getCurrentMappings(): Promise<Record<string, string>> {
        return (await this.adapter.getMappings(this.storage)) || {};
    }

    async validateMappings(): Promise<boolean> {
        const chartType = await this.adapter.getChartType(this.storage);
        if (!chartType) {
            return false;
        }

        const mappings = await this.getCurrentMappings();
        const fieldTypes = await this.schemaService.getFieldTypeMap(this.adapter.targetType, true);
        const validation = DimensionMappingValidator.validateMappingsForChart(chartType, mappings, fieldTypes);
        return validation.isValid;
    }

    async setDimensionMapping(dimensionName: string, dataField: string): Promise<void> {
        const currentMappings = await this.getCurrentMappings();
        await this.adapter.setMappings(this.storage, {
            ...currentMappings,
            [dimensionName]: dataField,
        });
    }

    async clearDimensionMapping(dimensionName: string): Promise<void> {
        const currentMappings = await this.getCurrentMappings();
        const updatedMappings = { ...currentMappings };
        delete updatedMappings[dimensionName];
        await this.adapter.setMappings(this.storage, updatedMappings);
    }

    async getDimensionMapping(dimensionName: string): Promise<string | undefined> {
        const currentMappings = await this.getCurrentMappings();
        return currentMappings[dimensionName];
    }

    private getChartMetadata(chartType: string): ChartMetadata | undefined {
        return chartTemplates.find((candidate) => candidate.id === chartType);
    }

    private async createDimensionItem(
        chartType: string,
        dimension: ChartDimension,
        fieldDefinitions: XRFieldDefinition[],
    ): Promise<CodeAnalysisTreeItem> {
        const mappedValue = await this.getDimensionMapping(dimension.name);
        const mappedField = fieldDefinitions.find((field) => field.id === mappedValue);
        const mappedLabel = mappedField?.label ?? mappedValue ?? 'Not mapped';
        const iconPath = await this.getDimensionIcon(chartType, dimension);

        return new CodeAnalysisTreeItem(
            `${dimension.label}: ${mappedLabel}`,
            vscode.TreeItemCollapsibleState.None,
            'subsection',
            {
                command: this.adapter.selectMappingCommandId,
                title: `Map ${dimension.label}`,
                arguments: [dimension.name],
            },
            iconPath,
            this.getDimensionTooltip(dimension, mappedLabel, Boolean(mappedValue)),
            mappedValue ? `→ ${mappedLabel}` : 'Click to map',
            `${this.adapter.dimensionContextPrefix}-${dimension.name}`,
        );
    }

    private getDimensionTooltip(
        dimension: ChartDimension,
        mappedLabel: string,
        hasMapping: boolean,
    ): string {
        const typeStr = dimension.dataType === 'numeric' ? 'numerical only' : 'any value';
        const requiredStr = dimension.required ? 'Required' : 'Optional';
        const mappingStr = hasMapping ? `Currently mapped to: ${mappedLabel}.` : 'Click to configure mapping.';
        return `(${typeStr}) • ${requiredStr} • ${dimension.description} ${mappingStr}`;
    }

    private async getDimensionIcon(
        chartType: string,
        dimension: ChartDimension,
    ): Promise<vscode.ThemeIcon> {
        const dimensionMappings = await this.getCurrentMappings();
        const fieldTypes = await this.schemaService.getFieldTypeMap(this.adapter.targetType, true);
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
            this.adapter.schemaUnavailableContextValue,
        );
    }
}

