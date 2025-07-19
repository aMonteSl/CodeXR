import * as vscode from 'vscode';
import * as path from 'path';
import { DimensionMapping } from '../babia_templates/models/chartModels';

/**
 * Analysis mode types
 */
export type AnalysisMode = 'XR' | 'Static';

/**
 * Theme mode types
 */
export type ThemeMode = 'light' | 'dark';

/**
 * Auto-analysis delay presets in milliseconds
 */
export const AUTO_ANALYSIS_DELAYS = {
    REAL_TIME: 0,
    HALF_SECOND: 500,
    ONE_SECOND: 1000,
    THREE_SECONDS: 3000,
    FIVE_SECONDS: 5000,
    TEN_SECONDS: 10000
} as const;

/**
 * Auto-analysis delay type
 */
export type AutoAnalysisDelay = typeof AUTO_ANALYSIS_DELAYS[keyof typeof AUTO_ANALYSIS_DELAYS] | number;

/**
 * Configuration structure for analysis settings
 */
export interface AnalysisConfiguration {
    analysisModeFile: AnalysisMode;
    theme: ThemeMode;
    autoAnalysisDelay: AutoAnalysisDelay;
    // New XR File Analysis settings
    chartTypeFile: string;
    dimensionMappingFile: DimensionMapping[];
}

/**
 * Default analysis configuration
 */
const DEFAULT_CONFIG: AnalysisConfiguration = {
    analysisModeFile: 'XR',
    theme: 'light',
    autoAnalysisDelay: AUTO_ANALYSIS_DELAYS.REAL_TIME,
    // Default chart and dimension mapping for file analysis - using boats chart with XR field names
    chartTypeFile: 'boats', // Default to boats chart for file analysis
    dimensionMappingFile: [
        {
            dimension: 'area',
            dataField: 'parameters'  // Same in XR format
        },
        {
            dimension: 'height', 
            dataField: 'lineCount'   // Updated to XR field name
        },
        {
            dimension: 'color',
            dataField: 'complexity'  // Updated to XR field name (was 'ccn')
        }
    ]
};

/**
 * Utility class for managing analysis settings storage
 * Stores configuration in globalStorage/codexr_analysis/configuration.json
 */
export class AnalysisSettingsStorage {
    private static readonly STORAGE_FOLDER = 'codexr_analysis';
    private static readonly CONFIG_FILE = 'configuration.json';
    
    /**
     * Get the full path to the configuration file
     */
    private static getConfigPath(context: vscode.ExtensionContext): vscode.Uri {
        return vscode.Uri.joinPath(
            context.globalStorageUri,
            this.STORAGE_FOLDER,
            this.CONFIG_FILE
        );
    }

    /**
     * Load analysis configuration from storage
     */
    static async loadConfiguration(context: vscode.ExtensionContext): Promise<AnalysisConfiguration> {
        try {
            const configPath = this.getConfigPath(context);
            console.log(`ANALYSIS: Loading configuration from ${configPath.fsPath}`);
            
            const configData = await vscode.workspace.fs.readFile(configPath);
            const configString = Buffer.from(configData).toString('utf8');
            const loadedConfig = JSON.parse(configString) as AnalysisConfiguration;
            
            // Validate and merge with defaults
            const config: AnalysisConfiguration = {
                analysisModeFile: loadedConfig.analysisModeFile || DEFAULT_CONFIG.analysisModeFile,
                theme: loadedConfig.theme || DEFAULT_CONFIG.theme,
                autoAnalysisDelay: loadedConfig.autoAnalysisDelay !== undefined ? loadedConfig.autoAnalysisDelay : DEFAULT_CONFIG.autoAnalysisDelay,
                chartTypeFile: loadedConfig.chartTypeFile || DEFAULT_CONFIG.chartTypeFile,
                dimensionMappingFile: loadedConfig.dimensionMappingFile || DEFAULT_CONFIG.dimensionMappingFile
            };
            
            console.log(`ANALYSIS: Loaded configuration:`, config);
            return config;
            
        } catch (error) {
            console.log(`ANALYSIS: Could not load configuration, using defaults:`, error);
            // Try to detect theme from VS Code when config is not available
            const detectedTheme = this.getDefaultThemeFromVscode();
            console.log(`ANALYSIS: Detected VS Code theme: ${detectedTheme}`);
            return { 
                ...DEFAULT_CONFIG,
                theme: detectedTheme
            };
        }
    }

    /**
     * Save analysis configuration to storage
     */
    static async saveConfiguration(
        context: vscode.ExtensionContext, 
        config: AnalysisConfiguration
    ): Promise<void> {
        try {
            const configPath = this.getConfigPath(context);
            console.log(`ANALYSIS: Saving configuration to ${configPath.fsPath}:`, config);
            
            // Ensure the storage folder exists
            const storageFolder = vscode.Uri.joinPath(context.globalStorageUri, this.STORAGE_FOLDER);
            try {
                await vscode.workspace.fs.createDirectory(storageFolder);
            } catch (error) {
                // Directory might already exist, that's fine
            }
            
            // Save configuration
            const configString = JSON.stringify(config, null, 2);
            const configData = Buffer.from(configString, 'utf8');
            await vscode.workspace.fs.writeFile(configPath, configData);
            
            console.log(`ANALYSIS: Configuration saved successfully`);
            
        } catch (error) {
            console.error(`ANALYSIS: Failed to save configuration:`, error);
            vscode.window.showErrorMessage(`Failed to save analysis configuration: ${error}`);
        }
    }

    /**
     * Get the current analysis mode
     */
    static async getCurrentAnalysisMode(context: vscode.ExtensionContext): Promise<AnalysisMode> {
        const config = await this.loadConfiguration(context);
        return config.analysisModeFile;
    }

    /**
     * Set the analysis mode and save configuration
     */
    static async setAnalysisMode(
        context: vscode.ExtensionContext, 
        mode: AnalysisMode
    ): Promise<void> {
        console.log(`ANALYSIS: Setting analysis mode to: ${mode}`);
        
        const config = await this.loadConfiguration(context);
        config.analysisModeFile = mode;
        await this.saveConfiguration(context, config);
        
        // Show confirmation message
        const modeDisplay = mode === 'XR' ? 'XR Analysis Mode' : 'Static Analysis Mode';
        vscode.window.showInformationMessage(`Switched to ${modeDisplay}`);
    }

    /**
     * Toggle between XR and Static analysis modes
     */
    static async toggleAnalysisMode(context: vscode.ExtensionContext): Promise<AnalysisMode> {
        const currentMode = await this.getCurrentAnalysisMode(context);
        const newMode: AnalysisMode = currentMode === 'XR' ? 'Static' : 'XR';
        
        await this.setAnalysisMode(context, newMode);
        return newMode;
    }

    /**
     * Get icon for analysis mode
     */
    static getAnalysisModeIcon(mode: AnalysisMode): vscode.ThemeIcon {
        switch (mode) {
            case 'XR':
                return new vscode.ThemeIcon('file', new vscode.ThemeColor('charts.purple'));
            case 'Static':
                return new vscode.ThemeIcon('file', new vscode.ThemeColor('charts.green'));
            default:
                return new vscode.ThemeIcon('file');
        }
    }

    /**
     * Get display label for analysis mode
     */
    static getAnalysisModeLabel(mode: AnalysisMode): string {
        return `Analysis Mode (${mode})`;
    }

    /**
     * Get the current theme mode
     */
    static async getCurrentTheme(context: vscode.ExtensionContext): Promise<ThemeMode> {
        const config = await this.loadConfiguration(context);
        return config.theme;
    }

    /**
     * Set the theme mode and save configuration
     */
    static async setTheme(
        context: vscode.ExtensionContext, 
        theme: ThemeMode
    ): Promise<void> {
        console.log(`ANALYSIS: Setting theme to: ${theme}`);
        
        const config = await this.loadConfiguration(context);
        config.theme = theme;
        await this.saveConfiguration(context, config);
        
        console.log(`ANALYSIS: Theme updated to ${theme}`);
    }

    /**
     * Toggle between light and dark themes
     */
    static async toggleTheme(context: vscode.ExtensionContext): Promise<ThemeMode> {
        const currentTheme = await this.getCurrentTheme(context);
        const newTheme: ThemeMode = currentTheme === 'light' ? 'dark' : 'light';
        
        await this.setTheme(context, newTheme);
        return newTheme;
    }

    /**
     * Get default theme from VS Code's active color theme
     */
    static getDefaultThemeFromVscode(): ThemeMode {
        const theme = vscode.window.activeColorTheme.kind;
        if (theme === vscode.ColorThemeKind.Dark || theme === vscode.ColorThemeKind.HighContrast) {
            return 'dark';
        }
        return 'light';
    }

    /**
     * Get the current auto-analysis delay
     */
    static async getAutoAnalysisDelay(context: vscode.ExtensionContext): Promise<AutoAnalysisDelay> {
        const config = await this.loadConfiguration(context);
        return config.autoAnalysisDelay;
    }

    /**
     * Set the auto-analysis delay and save configuration
     */
    static async setAutoAnalysisDelay(
        context: vscode.ExtensionContext, 
        delay: AutoAnalysisDelay
    ): Promise<void> {
        console.log(`ANALYSIS: Setting auto-analysis delay to: ${delay}ms`);
        
        const config = await this.loadConfiguration(context);
        config.autoAnalysisDelay = delay;
        await this.saveConfiguration(context, config);
        
        // Show confirmation message
        const delayDisplay = delay === 0 ? 'Real Time' : `${delay}ms`;
        vscode.window.showInformationMessage(`Auto-analysis delay set to ${delayDisplay}`);
    }

    /**
     * Get display label for auto-analysis delay
     */
    static getAutoAnalysisDelayLabel(delay: AutoAnalysisDelay): string {
        switch (delay) {
            case AUTO_ANALYSIS_DELAYS.REAL_TIME:
                return 'Real Time (0s)';
            case AUTO_ANALYSIS_DELAYS.HALF_SECOND:
                return '0.5s';
            case AUTO_ANALYSIS_DELAYS.ONE_SECOND:
                return '1s';
            case AUTO_ANALYSIS_DELAYS.THREE_SECONDS:
                return '3s';
            case AUTO_ANALYSIS_DELAYS.FIVE_SECONDS:
                return '5s';
            case AUTO_ANALYSIS_DELAYS.TEN_SECONDS:
                return '10s';
            default:
                return `${delay}ms (Custom)`;
        }
    }

    /**
     * Get preset delay options for UI
     */
    static getAutoAnalysisDelayOptions(): { label: string; value: AutoAnalysisDelay }[] {
        return [
            { label: 'Real Time (0s)', value: AUTO_ANALYSIS_DELAYS.REAL_TIME },
            { label: '0.5s', value: AUTO_ANALYSIS_DELAYS.HALF_SECOND },
            { label: '1s', value: AUTO_ANALYSIS_DELAYS.ONE_SECOND },
            { label: '3s', value: AUTO_ANALYSIS_DELAYS.THREE_SECONDS },
            { label: '5s', value: AUTO_ANALYSIS_DELAYS.FIVE_SECONDS },
            { label: '10s', value: AUTO_ANALYSIS_DELAYS.TEN_SECONDS },
            { label: 'Custom...', value: -1 } // Special value to indicate custom input
        ];
    }

    /**
     * Get the current chart type for file analysis
     */
    static async getChartTypeFile(context: vscode.ExtensionContext): Promise<string> {
        const config = await this.loadConfiguration(context);
        return config.chartTypeFile;
    }

    /**
     * Set the chart type for file analysis and save configuration
     */
    static async setChartTypeFile(
        context: vscode.ExtensionContext, 
        chartType: string
    ): Promise<void> {
        console.log(`ANALYSIS: Setting chart type for file analysis to: ${chartType}`);
        
        const config = await this.loadConfiguration(context);
        config.chartTypeFile = chartType;
        // Reset dimension mappings when chart type changes
        config.dimensionMappingFile = [];
        await this.saveConfiguration(context, config);
        
        vscode.window.showInformationMessage(`Chart type set to ${chartType}`);
    }

    /**
     * Get the current dimension mapping for file analysis
     */
    static async getDimensionMappingFile(context: vscode.ExtensionContext): Promise<DimensionMapping[]> {
        const config = await this.loadConfiguration(context);
        return config.dimensionMappingFile;
    }

    /**
     * Set the dimension mapping for file analysis and save configuration
     */
    static async setDimensionMappingFile(
        context: vscode.ExtensionContext, 
        dimensionMappings: DimensionMapping[]
    ): Promise<void> {
        console.log(`ANALYSIS: Setting dimension mapping for file analysis:`, dimensionMappings);
        
        const config = await this.loadConfiguration(context);
        config.dimensionMappingFile = dimensionMappings;
        await this.saveConfiguration(context, config);
        
        const mappedCount = dimensionMappings.length;
        vscode.window.showInformationMessage(`${mappedCount} dimension mappings configured`);
    }

    /**
     * Update a single dimension mapping for file analysis
     */
    static async updateDimensionMappingFile(
        context: vscode.ExtensionContext,
        dimensionName: string,
        dataField: string
    ): Promise<void> {
        const config = await this.loadConfiguration(context);
        
        // Remove any existing mapping for this dimension
        config.dimensionMappingFile = config.dimensionMappingFile.filter(m => m.dimension !== dimensionName);
        
        // Add the new mapping
        config.dimensionMappingFile.push({
            dimension: dimensionName,
            dataField: dataField
        });
        
        await this.saveConfiguration(context, config);
        console.log(`ANALYSIS: Updated dimension mapping: ${dimensionName} → ${dataField}`);
    }

    /**
     * Reset all settings to default values
     */
    static async resetToDefaults(context: vscode.ExtensionContext): Promise<void> {
        console.log('[ANALYSIS] Resetting all settings to default values...');
        await this.saveConfiguration(context, DEFAULT_CONFIG);
        console.log('[ANALYSIS] Settings reset to defaults successfully');
    }
}
