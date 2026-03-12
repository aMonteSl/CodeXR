/**
 * Chart Type File Setting Item
 * Manages the chart type configuration for file analysis
 */

import * as vscode from 'vscode';
import { CodeAnalysisTreeItem } from '../../../items/analysisItems';
import { AnalysisConfigurationStorage } from '../../../../configuration';
import { BabiaChartRegistry } from '../../../../../babia_templates/registry/chartRegistry';
import { ChartMetadata } from '../../../../../babia_templates/models/chartModels';
import { DimensionMappingCleaner } from './dimensionMappingCleaner';

export type AnalysisMode = 'XR' | 'LivePanel';
export type ChartType = 'bars' | 'barsmap' | 'cyls' | 'cylsmap' | 'donut' | 'pie' | 'bubbles' | 'boats';

export interface ChartTypeInfo {
    id: string;
    name: string;
    description: string;
    category: string;
    supportsMode: AnalysisMode[];
}

export class ChartTypeFileSetting {
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
        // Get current values from storage
        const currentMode = await this.storage.getAnalysisMode();
        const currentChartType = await this.storage.getChartTypeFile();
        
        // Get chart metadata for better display
        const chartMetadata = this.chartRegistry.getChart(currentChartType);
        const chartName = chartMetadata ? chartMetadata.name : currentChartType;
        
        const label = `Chart Type (File): ${chartName}`;
        const description = `${chartName} for XR mode`;
        
        // Always use purple color for chart type icons as requested
        const iconPath = new vscode.ThemeIcon('graph', new vscode.ThemeColor('charts.purple'));
        
        return new CodeAnalysisTreeItem(
            label,
            vscode.TreeItemCollapsibleState.None,
            'subsection',
            {
                command: 'codeXR.analysis.selectChartTypeFile',
                title: 'Select Chart Type for File Analysis',
                arguments: []
            },
            iconPath,
            `Current chart type: ${chartName} for ${currentMode} mode. Click to change chart type.`,
            description,
            'chartTypeFileSetting'
        );
    }

    /**
     * Get current analysis mode
     */
    async getCurrentAnalysisMode(): Promise<AnalysisMode> {
        return this.storage.getAnalysisMode();
    }

    /**
     * Get available chart types based on analysis mode
     */
    async getAvailableChartTypes(mode: AnalysisMode): Promise<ChartTypeInfo[]> {
        console.log(`CHART_TYPE_FILE: Getting available charts for mode: ${mode}`);
        
        // Get all charts from registry
        const allCharts = this.chartRegistry.getAllCharts();
        
        // Convert to ChartTypeInfo format
        const chartTypeInfos: ChartTypeInfo[] = allCharts.map((chart: ChartMetadata) => ({
            id: chart.id,
            name: chart.name,
            description: chart.description,
            category: chart.category,
            supportsMode: ['XR', 'LivePanel'] // All charts support both modes
        }));

        console.log(`CHART_TYPE_FILE: Found ${chartTypeInfos.length} available charts`);
        return chartTypeInfos;
    }

    /**
     * Show chart type selection dialog
     */
    async showChartTypeSelection(): Promise<void> {
        console.log('CHART_TYPE_FILE: Opening chart type selection dialog');
        
        try {
            const currentMode = await this.getCurrentAnalysisMode();
            const availableCharts = await this.getAvailableChartTypes(currentMode);
            
            if (availableCharts.length === 0) {
                console.error('CHART_TYPE_FILE: No chart types found');
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
                placeHolder: 'Select a chart type for file analysis visualization',
                title: `Chart Type Selection for ${currentMode} Analysis`,
                canPickMany: false
            });

            if (selectedItem && selectedItem.chart) {
                const selectedChart = selectedItem.chart;
                
                // Set the selected chart type
                await this.setChartType(selectedChart.id);
                
                console.log(`CHART_TYPE_FILE: Chart type selected: ${selectedChart.name} (${selectedChart.id})`);
                vscode.window.showInformationMessage(
                    `Chart type set to: ${selectedChart.name} for ${currentMode} mode`
                );
            } else {
                console.log('CHART_TYPE_FILE: Chart type selection cancelled');
            }
        } catch (error) {
            console.error('CHART_TYPE_FILE: Error in chart type selection:', error);
            vscode.window.showErrorMessage(`Failed to select chart type: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Set chart type and intelligently clean dimension mappings
     */
    async setChartType(chartType: string): Promise<void> {
        console.log(`CHART_TYPE_FILE: Setting chart type to: ${chartType}`);
        
        // Validate chart type exists
        if (!this.chartRegistry.hasChart(chartType)) {
            throw new Error(`Invalid chart type: ${chartType}`);
        }
        
        // Get current dimension mappings before changing chart type
        const currentMappings = await this.storage.getDimensionMappingFile();
        console.log(`[DIMENSION_CLEANER] Current mappings before chart change:`, currentMappings);
        
        // Save the new chart type
        const validChartType = chartType as ChartType;
        await this.storage.setChartTypeFile(validChartType);
        console.log(`CHART_TYPE_FILE: Chart type saved successfully: ${chartType}`);
        
        // Clear all dimension mappings when chart type changes
        await this.storage.setDimensionMappingFile({});
        console.log(`CHART_TYPE_FILE: Dimension mappings cleared for new chart type: ${chartType}`);
    }

    /**
     * Get current chart type
     */
    async getCurrentChartType(): Promise<ChartType> {
        return this.storage.getChartTypeFile();
    }

    /**
     * Get current chart metadata
     */
    async getCurrentChartMetadata(): Promise<ChartMetadata | undefined> {
        const currentChartType = await this.getCurrentChartType();
        return this.chartRegistry.getChart(currentChartType);
    }

    /**
     * Save configuration
     */
    async saveConfiguration(configuration: any): Promise<void> {
        console.log('CHART_TYPE_FILE: Saving configuration:', configuration);
        
        if (configuration.chartType) {
            await this.setChartType(configuration.chartType);
        }
    }

    /**
     * Load configuration
     */
    async loadConfiguration(): Promise<any> {
        const currentChartType = await this.storage.getChartTypeFile();
        const currentMode = await this.storage.getAnalysisMode();
        const chartMetadata = await this.getCurrentChartMetadata();
        
        return {
            chartType: currentChartType,
            analysisMode: currentMode,
            chartMetadata: chartMetadata
        };
    }
}

