/**
 * Analysis Settings Subsection Provider
 * Manages the Analysis Settings subsection of New Code Analysis
 */

import * as vscode from 'vscode';
import { CodeAnalysisTreeItem } from '../../items/analysisItems';
import { AnalysisFileSetting } from './analysis_file_mode';
import { AnalysisDirectorySetting } from './analysis_directory_mode';
import { ViewThemeSetting } from './view_theme';
import { ChartTypeFileSetting } from './chart_type_file/chartTypeFile';
import { ChartTypeDirectorySetting } from './chart_type_directory/chartTypeDirectory';
import { DimensionMappingFileSetting } from './dimension_mapping_file/dimensionMappingFile';
import { DimensionMappingDirectorySetting } from './dimension_mapping_directory/dimensionMappingDirectory';
import { AutoAnalysisDelaySetting } from './auto_analysis_delay';
import { AutoAnalysisEnabledSetting } from './auto_analysis_enabled';
import { BabiaUiSetting } from './babia_ui';
import { FilesByLanguageSortingSetting } from './files_by_language_sorting';
import { ProfileConfigurationSetting } from './profile_configuration';
import { AnalysisConfigurationStorage } from '../../../configuration/analysisConfigurationStorage';

export class AnalysisSettingsSubsectionProvider {
    private analysisFileSetting: AnalysisFileSetting;
    private analysisDirectorySetting: AnalysisDirectorySetting;
    private viewThemeSetting: ViewThemeSetting;
    private chartTypeFileSetting: ChartTypeFileSetting;
    private chartTypeDirectorySetting: ChartTypeDirectorySetting;
    private dimensionMappingFileSetting: DimensionMappingFileSetting;
    private dimensionMappingDirectorySetting: DimensionMappingDirectorySetting;
    private autoAnalysisDelaySetting: AutoAnalysisDelaySetting;
    private autoAnalysisEnabledSetting: AutoAnalysisEnabledSetting;
    private babiaUiSetting: BabiaUiSetting;
    private filesByLanguageSortingSetting: FilesByLanguageSortingSetting;
    private profileConfigurationSetting: ProfileConfigurationSetting;
    
    constructor(private context: vscode.ExtensionContext) {
        console.log('ANALYSIS: Initializing Analysis Settings subsection provider');
        
        // Initialize setting components
        this.analysisFileSetting = new AnalysisFileSetting(context);
        this.analysisDirectorySetting = new AnalysisDirectorySetting(context);
        this.viewThemeSetting = new ViewThemeSetting(context);
        this.chartTypeFileSetting = new ChartTypeFileSetting(context);
        this.chartTypeDirectorySetting = new ChartTypeDirectorySetting(context);
        this.dimensionMappingFileSetting = new DimensionMappingFileSetting(context);
        this.dimensionMappingDirectorySetting = new DimensionMappingDirectorySetting(context);
        this.autoAnalysisDelaySetting = new AutoAnalysisDelaySetting(context);
        this.autoAnalysisEnabledSetting = new AutoAnalysisEnabledSetting(context);
        this.babiaUiSetting = new BabiaUiSetting(context);
        this.filesByLanguageSortingSetting = new FilesByLanguageSortingSetting(context);
        
        // Initialize profile configuration setting with storage
        const storage = AnalysisConfigurationStorage.getInstance(context);
        this.profileConfigurationSetting = new ProfileConfigurationSetting(context, storage);
    }

    /**
     * Get subsection item for Analysis Settings
     */
    async getSubsectionItem(): Promise<CodeAnalysisTreeItem> {
        return new CodeAnalysisTreeItem(
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
    async getChildren(): Promise<CodeAnalysisTreeItem[]> {
        console.log('ANALYSIS: Getting Analysis Settings children');
        
        try {
            const children: CodeAnalysisTreeItem[] = [];
            
            // Analysis File Mode setting
            const analysisFileItem = await this.analysisFileSetting.getSettingItem();
            children.push(analysisFileItem);
            
            // Analysis Directory Mode setting
            const analysisDirectoryItem = await this.analysisDirectorySetting.getSettingItem();
            children.push(analysisDirectoryItem);
            
            // View Theme setting
            const viewThemeItem = await this.viewThemeSetting.getSettingItem();
            children.push(viewThemeItem);

            // Chart Type (File) setting
            const chartTypeFileItem = await this.chartTypeFileSetting.getSettingItem();
            children.push(chartTypeFileItem);

            // Chart Type (Directory) setting - NEW
            const chartTypeDirectoryItem = await this.chartTypeDirectorySetting.getSettingItem();
            children.push(chartTypeDirectoryItem);

            // Dimension Mapping (File) setting
            const dimensionMappingFileItem = await this.dimensionMappingFileSetting.getSettingItem();
            children.push(dimensionMappingFileItem);

            // Dimension Mapping (Directory) setting - NEW
            console.log('ANALYSIS: Getting Dimension Mapping Directory setting item');
            const dimensionMappingDirectoryItem = await this.dimensionMappingDirectorySetting.getSettingItem();
            children.push(dimensionMappingDirectoryItem);
            console.log('ANALYSIS: Dimension Mapping Directory setting item added to children');
            
            // Auto Analysis Delay setting
            const autoAnalysisDelayItem = await this.autoAnalysisDelaySetting.getSettingItem();
            children.push(autoAnalysisDelayItem);

            // CodeXR Mapping UI (XR) setting
            const babiaUiItem = await this.babiaUiSetting.getSettingItem();
            children.push(babiaUiItem);
            
            // Auto Analysis Enabled setting
            const autoAnalysisEnabledItem = await this.autoAnalysisEnabledSetting.getSettingItem();
            children.push(autoAnalysisEnabledItem);
            
            // Files by Language Sorting setting - NEW
            const filesByLanguageSortingItem = await this.filesByLanguageSortingSetting.getSettingItem();
            children.push(filesByLanguageSortingItem);
            
            // Profile Configuration setting - NEW
            const profileConfigurationItem = await this.profileConfigurationSetting.getSettingItem();
            children.push(profileConfigurationItem);
            
            console.log(`ANALYSIS: Analysis Settings children count: ${children.length}`);
            return children;
            
        } catch (error) {
            console.error('ANALYSIS: Error getting Analysis Settings children:', error);
            
            // Return error item
            return [new CodeAnalysisTreeItem(
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
    async getSettingChildren(element: CodeAnalysisTreeItem): Promise<CodeAnalysisTreeItem[]> {
        console.log(`ANALYSIS: Getting children for setting: ${element.contextValue}`);
        
        try {
            switch (element.contextValue) {
                case 'dimensionMappingFileSetting':
                    // Return children for Dimension Mapping (File) - TODO1, TODO2, TODO3
                    return await this.dimensionMappingFileSetting.getChildren();

                case 'dimensionMappingDirectorySetting':
                    // Return children for Dimension Mapping (Directory)
                    return await this.dimensionMappingDirectorySetting.getChildren();
                
                case 'filesByLanguageSortingSetting':
                    // Return children for Files by Language Sorting
                    return await this.filesByLanguageSortingSetting.getChildren();
                
                case 'profileConfigurationSetting':
                    // Return children for Profile Configuration
                    return await this.profileConfigurationSetting.getChildren();
                
                default:
                    console.log(`ANALYSIS: No children available for setting: ${element.contextValue}`);
                    return [];
            }
        } catch (error) {
            console.error(`ANALYSIS: Error getting children for setting ${element.contextValue}:`, error);
            return [];
        }
    }

    /**
     * Refresh all settings (can be called when configuration changes)
     */
    async refresh(): Promise<void> {
        console.log('ANALYSIS: Refreshing Analysis Settings subsection');
        // Settings will be refreshed automatically when getChildren() is called
    }

    /**
     * Get analysis file setting instance (for command integration)
     */
    getAnalysisFileSetting(): AnalysisFileSetting {
        return this.analysisFileSetting;
    }

    /**
     * Get analysis directory setting instance (for command integration)
     */
    getAnalysisDirectorySetting(): AnalysisDirectorySetting {
        return this.analysisDirectorySetting;
    }

    /**
     * Get view theme setting instance (for command integration)
     */
    getViewThemeSetting(): ViewThemeSetting {
        return this.viewThemeSetting;
    }

    /**
     * Get chart type file setting instance (for command integration)
     */
    getChartTypeFileSetting(): ChartTypeFileSetting {
        return this.chartTypeFileSetting;
    }

    /**
     * Get chart type directory setting instance (for command integration)
     */
    getChartTypeDirectorySetting(): ChartTypeDirectorySetting {
        return this.chartTypeDirectorySetting;
    }

    /**
     * Get dimension mapping file setting instance (for command integration)
     */
    getDimensionMappingFileSetting(): DimensionMappingFileSetting {
        return this.dimensionMappingFileSetting;
    }

    /**
     * Get dimension mapping directory setting instance (for command integration)
     */
    getDimensionMappingDirectorySetting(): DimensionMappingDirectorySetting {
        return this.dimensionMappingDirectorySetting;
    }

    /**
     * Get auto analysis delay setting instance (for command integration)
     */
    getAutoAnalysisDelaySetting(): AutoAnalysisDelaySetting {
        return this.autoAnalysisDelaySetting;
    }

    /**
     * Get auto analysis enabled setting instance (for command integration)
     */
    getAutoAnalysisEnabledSetting(): AutoAnalysisEnabledSetting {
        return this.autoAnalysisEnabledSetting;
    }

    /**
     * Get Babia UI setting instance (for command integration)
     */
    getBabiaUiSetting(): BabiaUiSetting {
        return this.babiaUiSetting;
    }

    /**
     * Get files by language sorting setting instance (for command integration)
     */
    getFilesByLanguageSortingSetting(): FilesByLanguageSortingSetting {
        return this.filesByLanguageSortingSetting;
    }
}

