/**
 * Dimension Mapping Directory Setting Item
 * Manages the dimension mapping configuration for directory XR analysis.
 */

import * as vscode from 'vscode';
import { CodeAnalysisTreeItem } from '../../../items/analysisItems';
import { SharedDimensionMappingSettingCore } from '../dimension_mapping_shared/sharedDimensionMappingSettingCore';

export class DimensionMappingDirectorySetting {
    private readonly core: SharedDimensionMappingSettingCore;

    constructor(context: vscode.ExtensionContext) {
        this.core = new SharedDimensionMappingSettingCore(context, {
            targetType: 'directory',
            settingLabel: 'Dimension Mapping (Directory)',
            settingContextValue: 'dimensionMappingDirectorySetting',
            selectMappingCommandId: 'codeXR.analysis.selectDimensionMappingDirectory',
            selectChartCommandId: 'codeXR.analysis.selectChartTypeDirectory',
            selectChartCommandTitle: 'Select Chart Type for Directory Analysis',
            selectChartItemLabel: 'Select Chart Type (Directory) First',
            selectChartTooltip: 'You must first select a chart type in Chart Type (Directory) before configuring dimension mappings.',
            selectChartDescription: 'Click to go to Chart Type (Directory) setting',
            noDimensionsContextValue: 'no-dimensions-directory',
            schemaUnavailableContextValue: 'directory-schema-unavailable',
            dimensionContextPrefix: 'dimension-directory',
            getChartType: (storage) => storage.getDirectoryChartType(),
            getMappings: (storage) => storage.getDimensionMappingDirectory(),
            setMappings: (storage, mappings) => storage.setDimensionMappingDirectory(mappings),
            getSettingTooltip: (chartType) => chartType ? `Dimensions for ${chartType} chart` : 'Select Chart Type (Directory) first',
            getSettingDescription: (chartType) => chartType ? `Configure ${chartType} dimensions` : 'You must first select a chart type in Chart Type (Directory)',
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

    async validateMappings(): Promise<boolean> {
        return this.core.validateMappings();
    }

    async getCurrentMappings(): Promise<Record<string, string>> {
        return this.core.getCurrentMappings();
    }
}

