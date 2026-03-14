/**
 * Dimension Mapping File Setting Item
 * Manages the dimension mapping configuration for file XR analysis.
 */

import * as vscode from 'vscode';
import { CodeAnalysisTreeItem } from '../../../items/analysisItems';
import { SharedDimensionMappingSettingCore } from '../dimension_mapping_shared/sharedDimensionMappingSettingCore';

export class DimensionMappingFileSetting {
    private readonly core: SharedDimensionMappingSettingCore;

    constructor(context: vscode.ExtensionContext) {
        this.core = new SharedDimensionMappingSettingCore(context, {
            targetType: 'file',
            settingLabel: 'Dimension Mapping (File)',
            settingContextValue: 'dimensionMappingFileSetting',
            selectMappingCommandId: 'codeXR.analysis.selectDimensionMappingFile',
            selectChartCommandId: 'codeXR.analysis.selectChartTypeFile',
            selectChartCommandTitle: 'Select Chart Type',
            selectChartItemLabel: 'Select Chart Type First',
            selectChartTooltip: 'You must select a chart type before configuring dimensions.',
            selectChartDescription: 'Click to select chart type',
            noDimensionsContextValue: 'no-dimensions',
            schemaUnavailableContextValue: 'file-schema-unavailable',
            dimensionContextPrefix: 'dimension-file',
            getChartType: (storage) => storage.getChartTypeFile(),
            getMappings: (storage) => storage.getDimensionMappingFile(),
            setMappings: (storage, mappings) => storage.setDimensionMappingFile(mappings),
            getSettingTooltip: (chartType) => chartType ? `Dimensions for ${chartType} chart` : 'Select chart type first',
            getSettingDescription: (chartType) => chartType ? `Configure ${chartType} dimensions` : 'Select chart type first',
        });
    }

    async getSettingItem(): Promise<CodeAnalysisTreeItem> {
        return this.core.getSettingItem();
    }

    async getChildren(): Promise<CodeAnalysisTreeItem[]> {
        return this.core.getChildren();
    }

    async showDimensionMappingSelection(dimensionName: string): Promise<void> {
        await this.core.showDimensionMappingSelection(dimensionName);
    }

    async setDimensionMapping(dimensionName: string, dataField: string): Promise<void> {
        await this.core.setDimensionMapping(dimensionName, dataField);
    }

    async clearDimensionMapping(dimensionName: string): Promise<void> {
        await this.core.clearDimensionMapping(dimensionName);
    }

    async getDimensionMapping(dimensionName: string): Promise<string | undefined> {
        return this.core.getDimensionMapping(dimensionName);
    }

    async getCurrentMappings(): Promise<Record<string, string>> {
        return this.core.getCurrentMappings();
    }
}
