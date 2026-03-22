/**
 * Chart Type Directory Setting Item
 * Manages the chart type configuration for directory analysis
 */

import * as vscode from 'vscode';
import { CodeAnalysisTreeItem } from '../../../items/analysisItems';
import { AnalysisConfigurationStorage } from '../../../../configuration';
import { BabiaChartRegistry } from '../../../../../babia_templates/registry/chartRegistry';
import { ChartMetadata } from '../../../../../babia_templates/models/chartModels';

export type AnalysisMode = 'XR' | 'XRDeep' | 'LivePanel' | 'LivePanelDeep';
export type ChartType = 'bars' | 'barsmap' | 'cyls' | 'cylsmap' | 'donut' | 'pie' | 'bubbles' | 'boats';

export interface ChartTypeInfo {
    id: string;
    name: string;
    description: string;
    category: string;
    supportsMode: AnalysisMode[];
}

export class ChartTypeDirectorySetting {
    private storage: AnalysisConfigurationStorage;
    private chartRegistry: BabiaChartRegistry;

    constructor(context: vscode.ExtensionContext) {
        this.storage = AnalysisConfigurationStorage.getInstance(context);
        this.chartRegistry = BabiaChartRegistry.getInstance();
    }

    /**
     * Get the tree item for this setting
     */
    async getSettingItem(): Promise<CodeAnalysisTreeItem> {
        const currentChartType = await this.getCurrentChartType();
        const currentMode = await this.getCurrentAnalysisMode();
        
        // Get chart metadata
        const chartMetadata = this.chartRegistry.getChart(currentChartType);
        const chartName = chartMetadata ? chartMetadata.name : 'Unknown Chart';
        
        // Create label and description based on current mode
        const label = `Chart Type (Directory): ${chartName}`;
        const description = `${currentMode} Mode`;
        
        // Use purple color for the graph icon as requested
        const iconPath = new vscode.ThemeIcon('graph', new vscode.ThemeColor('charts.purple'));
        
        return new CodeAnalysisTreeItem(
            label,
            vscode.TreeItemCollapsibleState.None,
            'subsection',
            {
                command: 'codeXR.analysis.selectChartTypeDirectory',
                title: 'Select Chart Type for Directory Analysis',
                arguments: []
            },
            iconPath,
            `Current chart type: ${chartName} for ${currentMode} mode. Click to change chart type.`,
            description,
            'chartTypeDirectorySetting'
        );
    }

    /**
     * Get current chart type for directory analysis
     */
    async getCurrentChartType(): Promise<ChartType> {
        return await this.storage.getDirectoryChartType();
    }

    /**
     * Set chart type for current mode
     */
    async setChartType(chartType: ChartType): Promise<void> {
        await this.storage.setDirectoryChartType(chartType);
        console.log(`CHART_TYPE_DIRECTORY: Set chart type: ${chartType}`);
        
        // Clear all dimension mappings when chart type changes
        await this.storage.setDimensionMappingDirectory({});
        console.log(`CHART_TYPE_DIRECTORY: Dimension mappings cleared for new chart type: ${chartType}`);
    }

    /**
     * Get current analysis mode (directory mode)
     */
    private async getCurrentAnalysisMode(): Promise<AnalysisMode> {
        return await this.storage.getAnalysisDirectoryMode();
    }

    /**
     * Get available chart types for the given mode
     */
    async getAvailableChartTypes(mode: AnalysisMode): Promise<ChartTypeInfo[]> {
        const allCharts = this.chartRegistry.getAllCharts();
        
        return allCharts.map(chart => ({
            id: chart.id as ChartType,
            name: chart.name,
            description: chart.description,
            category: chart.category,
            supportsMode: ['XR', 'XRDeep', 'LivePanel', 'LivePanelDeep'] as AnalysisMode[] // All charts support all modes for directories
        })).filter(chart => chart.supportsMode.includes(mode));
    }

    /**
     * Show chart type selection dialog
     */
    async showChartTypeSelection(): Promise<void> {
        console.log('CHART_TYPE_DIRECTORY: Opening chart type selection dialog');
        
        try {
            const currentMode = await this.getCurrentAnalysisMode();
            const availableCharts = await this.getAvailableChartTypes(currentMode);
            
            if (availableCharts.length === 0) {
                console.error('CHART_TYPE_DIRECTORY: No chart types found');
                vscode.window.showErrorMessage('No chart templates available');
                return;
            }

            // Create quick pick items for available charts
            const quickPickItems: (vscode.QuickPickItem & { chart: ChartTypeInfo })[] = availableCharts.map(chart => ({
                label: chart.name,
                description: chart.description,
                detail: `Category: ${chart.category} | Supports: ${chart.supportsMode.join(', ')}`,
                chart: chart
            }));

            // Show quick pick
            const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: 'Select a chart type for directory analysis visualization',
                title: `Chart Type Selection for ${currentMode} Directory Analysis`,
                canPickMany: false
            });

            if (selectedItem && selectedItem.chart) {
                const selectedChart = selectedItem.chart;
                
                // Set the selected chart type
                await this.setChartType(selectedChart.id as ChartType);
                
                console.log(`CHART_TYPE_DIRECTORY: Chart type selected: ${selectedChart.name} (${selectedChart.id})`);
                vscode.window.showInformationMessage(
                    `Chart type set to: ${selectedChart.name} for ${currentMode} directory analysis`
                );
            } else {
                console.log('CHART_TYPE_DIRECTORY: Chart type selection cancelled');
            }
        } catch (error) {
            console.error('CHART_TYPE_DIRECTORY: Error in chart type selection:', error);
            vscode.window.showErrorMessage(`Failed to select chart type: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

