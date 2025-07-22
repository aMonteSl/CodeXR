/**
 * Analysis Settings Subsection Provider
 * Manages the Analysis Settings subsection of New Code Analysis
 */

import * as vscode from 'vscode';
import { NewCodeAnalysisTreeItem } from '../../items/newCodeAnalysisItems';
import { AnalysisFileSetting } from './analysis_file_mode';
import { ViewThemeSetting } from './view_theme';
import { ChartTypeFileSetting } from './chart_type_file/chartTypeFile';
import { DimensionMappingFileSetting } from './dimension_mapping_file/dimensionMappingFile';
import { AutoAnalysisDelaySetting } from './auto_analysis_delay';

export class AnalysisSettingsSubsectionProvider {
    private analysisFileSetting: AnalysisFileSetting;
    private viewThemeSetting: ViewThemeSetting;
    private chartTypeFileSetting: ChartTypeFileSetting;
    private dimensionMappingFileSetting: DimensionMappingFileSetting;
    private autoAnalysisDelaySetting: AutoAnalysisDelaySetting;
    
    constructor(private context: vscode.ExtensionContext) {
        console.log('NEW_CODE_ANALYSIS: Initializing Analysis Settings subsection provider');
        
        // Initialize setting components
        this.analysisFileSetting = new AnalysisFileSetting(context);
        this.viewThemeSetting = new ViewThemeSetting(context);
        this.chartTypeFileSetting = new ChartTypeFileSetting(context);
        this.dimensionMappingFileSetting = new DimensionMappingFileSetting(context);
        this.autoAnalysisDelaySetting = new AutoAnalysisDelaySetting(context);
    }

    /**
     * Get subsection item for Analysis Settings
     */
    async getSubsectionItem(): Promise<NewCodeAnalysisTreeItem> {
        return new NewCodeAnalysisTreeItem(
            'Analysis Settings',
            vscode.TreeItemCollapsibleState.Expanded, // Expanded by default as requested
            'subsection',
            undefined,
            new vscode.ThemeIcon('gear'),
            'Configure analysis behavior and preferences',
            'Configuration options',
            'analysisSettingsSubsection'
        );
    }

    /**
     * Get children items for Analysis Settings
     */
    async getChildren(): Promise<NewCodeAnalysisTreeItem[]> {
        console.log('NEW_CODE_ANALYSIS: Getting Analysis Settings children');
        
        try {
            const children: NewCodeAnalysisTreeItem[] = [];
            
            // Analysis File Mode setting
            const analysisFileItem = await this.analysisFileSetting.getSettingItem();
            children.push(analysisFileItem);
            
            // View Theme setting
            const viewThemeItem = await this.viewThemeSetting.getSettingItem();
            children.push(viewThemeItem);

            // Chart Type (File) setting - NEW
            const chartTypeFileItem = await this.chartTypeFileSetting.getSettingItem();
            children.push(chartTypeFileItem);

            // Dimension Mapping (File) setting - NEW
            const dimensionMappingFileItem = await this.dimensionMappingFileSetting.getSettingItem();
            children.push(dimensionMappingFileItem);
            
            // Auto Analysis Delay setting
            const autoAnalysisDelayItem = await this.autoAnalysisDelaySetting.getSettingItem();
            children.push(autoAnalysisDelayItem);
            
            console.log(`NEW_CODE_ANALYSIS: Analysis Settings children count: ${children.length}`);
            return children;
            
        } catch (error) {
            console.error('NEW_CODE_ANALYSIS: Error getting Analysis Settings children:', error);
            
            // Return error item
            return [new NewCodeAnalysisTreeItem(
                'Error loading settings',
                vscode.TreeItemCollapsibleState.None,
                'error',
                undefined,
                new vscode.ThemeIcon('error'),
                `Failed to load analysis settings: ${error}`,
                'Configuration error',
                'analysisSettingsError'
            )];
        }
    }

    /**
     * Get specific children for a setting item (for nested items like Dimension Mapping)
     */
    async getSettingChildren(element: NewCodeAnalysisTreeItem): Promise<NewCodeAnalysisTreeItem[]> {
        console.log(`NEW_CODE_ANALYSIS: Getting children for setting: ${element.contextValue}`);
        
        try {
            switch (element.contextValue) {
                case 'dimensionMappingFileSetting':
                    // Return children for Dimension Mapping (File) - TODO1, TODO2, TODO3
                    return await this.dimensionMappingFileSetting.getChildren();
                
                default:
                    console.log(`NEW_CODE_ANALYSIS: No children available for setting: ${element.contextValue}`);
                    return [];
            }
        } catch (error) {
            console.error(`NEW_CODE_ANALYSIS: Error getting children for setting ${element.contextValue}:`, error);
            return [];
        }
    }

    /**
     * Refresh all settings (can be called when configuration changes)
     */
    async refresh(): Promise<void> {
        console.log('NEW_CODE_ANALYSIS: Refreshing Analysis Settings subsection');
        // Settings will be refreshed automatically when getChildren() is called
    }
}
