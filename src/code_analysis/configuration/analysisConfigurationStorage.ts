/**
 * Analysis Configuration Storage Manager
 * Handles reading/writing configuration to VS Code globalStorage
 * Path: codexr_analysis/configuration_analysis.json
 */

import * as vscode from 'vscode';
import {
    AnalysisConfiguration,
    AnalysisConfigurationFile,
    AnalysisFileMode,
    AnalysisDirectoryMode,
    ViewTheme,
    AutoAnalysisDelayConfig,
    ChartType,
    DimensionMapping,
    FilesByLanguageSortingConfig,
    XRBabiaUiConfig,
    DEFAULT_CONFIGURATION_FILE,
    DEFAULT_ANALYSIS_CONFIGURATION
} from './models/analysisConfiguration';

function cloneDimensionMapping(mapping: DimensionMapping): DimensionMapping {
    return { ...mapping };
}

function hasCompleteCodeCityMapping(mapping: DimensionMapping | undefined): boolean {
    return !!mapping
        && typeof mapping.area === 'string'
        && mapping.area.trim().length > 0
        && typeof mapping.height === 'string'
        && mapping.height.trim().length > 0
        && typeof mapping.color === 'string'
        && mapping.color.trim().length > 0;
}

function normalizeCodeCityMappings(configuration: AnalysisConfiguration): AnalysisConfiguration {
    const normalized: AnalysisConfiguration = { ...configuration };
    if (normalized.chartTypeFile === 'code-city' && !hasCompleteCodeCityMapping(normalized.dimensionMappingFile)) {
        normalized.dimensionMappingFile = cloneDimensionMapping(DEFAULT_ANALYSIS_CONFIGURATION.dimensionMappingFile);
    }
    if (normalized.chartTypeDirectory === 'code-city' && !hasCompleteCodeCityMapping(normalized.dimensionMappingDirectory)) {
        normalized.dimensionMappingDirectory = cloneDimensionMapping(DEFAULT_ANALYSIS_CONFIGURATION.dimensionMappingDirectory);
    }
    return normalized;
}

export class AnalysisConfigurationStorage {
    private static instance: AnalysisConfigurationStorage;
    private readonly STORAGE_FOLDER = 'codexr_analysis';
    private readonly CONFIG_FILE = 'configuration_analysis.json';
    private context: vscode.ExtensionContext;
    private cachedConfiguration: AnalysisConfiguration | null = null;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        console.log('ANALYSIS: Initializing configuration storage');
    }

    /**
     * Initialize the singleton with the extension context.
     * Must be called once during extension activation before any getInstance() calls.
     */
    public static initialize(context: vscode.ExtensionContext): AnalysisConfigurationStorage {
        if (!AnalysisConfigurationStorage.instance) {
            AnalysisConfigurationStorage.instance = new AnalysisConfigurationStorage(context);
        }
        return AnalysisConfigurationStorage.instance;
    }

    /**
     * Get singleton instance.
     * @param context Optional — only needed if initialize() was not called yet (backward compatibility).
     */
    public static getInstance(context?: vscode.ExtensionContext): AnalysisConfigurationStorage {
        if (!AnalysisConfigurationStorage.instance) {
            if (!context) {
                throw new Error(
                    'AnalysisConfigurationStorage not initialized. Call initialize(context) during activation first.'
                );
            }
            AnalysisConfigurationStorage.instance = new AnalysisConfigurationStorage(context);
        }
        return AnalysisConfigurationStorage.instance;
    }

    /**
     * Get the full file path for configuration
     */
    private getConfigurationPath(): vscode.Uri {
        return vscode.Uri.joinPath(
            this.context.globalStorageUri,
            this.STORAGE_FOLDER,
            this.CONFIG_FILE
        );
    }

    /**
     * Load configuration from storage
     */
    public async loadConfiguration(): Promise<AnalysisConfiguration> {
        try {
            // Return cached if available
            if (this.cachedConfiguration) {
                return this.cachedConfiguration;
            }

            const configPath = this.getConfigurationPath();
            
            // Check if file exists
            try {
                const configData = await vscode.workspace.fs.readFile(configPath);
                const configString = Buffer.from(configData).toString('utf8');
                const configFile: AnalysisConfigurationFile = JSON.parse(configString);
                
                // Validate and merge with defaults (in case new settings were added)
                const configuration = normalizeCodeCityMappings({
                    ...DEFAULT_ANALYSIS_CONFIGURATION,
                    ...configFile.configuration
                });
                
                this.cachedConfiguration = configuration;
                console.log('ANALYSIS: Configuration loaded from storage:', configuration);
                return configuration;
                
            } catch (readError) {
                // File doesn't exist or is corrupted, return defaults
                console.log('ANALYSIS: Configuration file not found, using defaults');
                this.cachedConfiguration = DEFAULT_ANALYSIS_CONFIGURATION;
                
                // Create default file
                await this.saveConfiguration(DEFAULT_ANALYSIS_CONFIGURATION);
                return DEFAULT_ANALYSIS_CONFIGURATION;
            }
            
        } catch (error) {
            console.error('ANALYSIS: Error loading configuration:', error);
            return DEFAULT_ANALYSIS_CONFIGURATION;
        }
    }

    /**
     * Save configuration to storage
     */
    public async saveConfiguration(configuration: AnalysisConfiguration): Promise<void> {
        try {
            const configPath = this.getConfigurationPath();
            
            // Ensure directory exists
            const folderPath = vscode.Uri.joinPath(this.context.globalStorageUri, this.STORAGE_FOLDER);
            await vscode.workspace.fs.createDirectory(folderPath);
            
            // Create configuration file structure
            const configFile: AnalysisConfigurationFile = {
                metadata: {
                    version: '1.0.0',
                    lastModified: Date.now(),
                    createdBy: 'CodeXR New Code Analysis'
                },
                configuration: configuration
            };
            
            // Write to file
            const configString = JSON.stringify(configFile, null, 2);
            const configData = Buffer.from(configString, 'utf8');
            await vscode.workspace.fs.writeFile(configPath, configData);
            
            // Update cache
            this.cachedConfiguration = configuration;
            
            console.log('ANALYSIS: Configuration saved to storage:', configuration);
            
        } catch (error) {
            console.error('ANALYSIS: Error saving configuration:', error);
            throw error;
        }
    }

    /**
     * Get specific setting value
     */
    public async getAnalysisFileMode(): Promise<AnalysisFileMode> {
        const config = await this.loadConfiguration();
        return config.analysisFileMode;
    }

    /**
     * Set specific setting value
     */
    public async setAnalysisFileMode(mode: AnalysisFileMode): Promise<void> {
        const config = await this.loadConfiguration();
        const updatedConfig = {
            ...config,
            analysisFileMode: mode
        };
        await this.saveConfiguration(updatedConfig);
        console.log(`ANALYSIS: Analysis file mode changed to: ${mode}`);
    }

    /**
     * Get analysis directory mode setting
     */
    public async getAnalysisDirectoryMode(): Promise<AnalysisDirectoryMode> {
        const config = await this.loadConfiguration();
        return config.analysisDirectoryMode;
    }

    /**
     * Set analysis directory mode setting
     */
    public async setAnalysisDirectoryMode(mode: AnalysisDirectoryMode): Promise<void> {
        const config = await this.loadConfiguration();
        const updatedConfig = {
            ...config,
            analysisDirectoryMode: mode
        };
        await this.saveConfiguration(updatedConfig);
        console.log(`ANALYSIS: Analysis directory mode changed to: ${mode}`);
    }

    /**
     * Get view theme setting
     */
    public async getViewTheme(): Promise<ViewTheme> {
        const config = await this.loadConfiguration();
        return config.viewTheme;
    }

    /**
     * Set view theme setting
     */
    public async setViewTheme(theme: ViewTheme): Promise<void> {
        const config = await this.loadConfiguration();
        const updatedConfig = {
            ...config,
            viewTheme: theme
        };
        await this.saveConfiguration(updatedConfig);
        console.log(`ANALYSIS: View theme changed to: ${theme}`);
    }

    /**
     * Get auto-analysis delay setting
     */
    public async getAutoAnalysisDelay(): Promise<AutoAnalysisDelayConfig> {
        const config = await this.loadConfiguration();
        return config.autoAnalysisDelay;
    }

    /**
     * Set auto-analysis delay setting
     */
    public async setAutoAnalysisDelay(delayConfig: AutoAnalysisDelayConfig): Promise<void> {
        const config = await this.loadConfiguration();
        const updatedConfig = {
            ...config,
            autoAnalysisDelay: delayConfig
        };
        await this.saveConfiguration(updatedConfig);
        console.log(`ANALYSIS: Auto-analysis delay changed to: ${JSON.stringify(delayConfig)}`);
    }

    /**
     * Get auto-analysis enabled setting
     */
    public async getAutoAnalysisEnabled(): Promise<boolean> {
        const config = await this.loadConfiguration();
        return config.autoAnalysisDelay.autoAnalysisEnabled;
    }

    /**
     * Set auto-analysis enabled setting
     */
    public async setAutoAnalysisEnabled(enabled: boolean): Promise<void> {
        const config = await this.loadConfiguration();
        const updatedConfig = {
            ...config,
            autoAnalysisDelay: {
                ...config.autoAnalysisDelay,
                autoAnalysisEnabled: enabled
            }
        };
        await this.saveConfiguration(updatedConfig);
        console.log(`ANALYSIS: Auto-analysis enabled changed to: ${enabled}`);
    }

    /**
     * Update multiple settings at once
     */
    public async updateConfiguration(updates: Partial<AnalysisConfiguration>): Promise<void> {
        const currentConfig = await this.loadConfiguration();
        const updatedConfig = normalizeCodeCityMappings({
            ...currentConfig,
            ...updates
        });
        await this.saveConfiguration(updatedConfig);
        console.log(`ANALYSIS: Configuration updated with: ${JSON.stringify(updates)}`);
    }

    /**
     * Reset configuration to defaults
     */
    public async resetConfiguration(): Promise<void> {
        await this.saveConfiguration(DEFAULT_ANALYSIS_CONFIGURATION);
        this.cachedConfiguration = null; // Clear cache
    }

    /**
     * Get configuration file path for debugging
     */
    public getConfigurationFilePath(): string {
        return this.getConfigurationPath().fsPath;
    }

    /**
     * Check if configuration file exists
     */
    public async configurationExists(): Promise<boolean> {
        try {
            const configPath = this.getConfigurationPath();
            await vscode.workspace.fs.stat(configPath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Debug method to get current configuration file content
     */
    public async debugGetConfigurationFileContent(): Promise<string | null> {
        try {
            const configPath = this.getConfigurationPath();
            const configData = await vscode.workspace.fs.readFile(configPath);
            return Buffer.from(configData).toString('utf8');
        } catch (error) {
            console.log('ANALYSIS: Configuration file not found or error reading:', error);
            return null;
        }
    }

    /**
     * Force reload configuration from disk (bypassing cache)
     */
    public async forceReloadConfiguration(): Promise<AnalysisConfiguration> {
        this.cachedConfiguration = null;
        return await this.loadConfiguration();
    }

    /**
     * Get chart type for file analysis
     */
    public async getChartTypeFile(): Promise<ChartType> {
        const config = await this.loadConfiguration();
        return config.chartTypeFile;
    }

    /**
     * Set chart type for file analysis
     */
    public async setChartTypeFile(chartType: ChartType): Promise<void> {
        await this.updateConfiguration({ chartTypeFile: chartType });
    }

    /**
     * Get dimension mapping for file analysis
     */
    public async getDimensionMappingFile(): Promise<DimensionMapping> {
        const config = await this.loadConfiguration();
        return config.dimensionMappingFile;
    }

    /**
     * Set dimension mapping for file analysis
     */
    public async setDimensionMappingFile(mapping: DimensionMapping): Promise<void> {
        await this.updateConfiguration({ dimensionMappingFile: mapping });
    }

    /**
     * Get current analysis mode (alias for getAnalysisFileMode for compatibility)
     */
    public async getAnalysisMode(): Promise<AnalysisFileMode> {
        return await this.getAnalysisFileMode();
    }

    /**
     * Set analysis mode (alias for setAnalysisFileMode for compatibility)
     */
    public async setAnalysisMode(mode: AnalysisFileMode): Promise<void> {
        await this.setAnalysisFileMode(mode);
    }

    /**
     * Get Files by Language sorting configuration
     */
    public async getFilesByLanguageSorting(): Promise<FilesByLanguageSortingConfig> {
        const config = await this.loadConfiguration();
        return config.filesByLanguageSorting;
    }

    /**
     * Set Files by Language sorting configuration
     */
    public async setFilesByLanguageSorting(sortingConfig: FilesByLanguageSortingConfig): Promise<void> {
        await this.updateConfiguration({ filesByLanguageSorting: sortingConfig });
        console.log('ANALYSIS: Files by Language sorting configuration updated:', sortingConfig);
    }

    // ============================================================================
    // Directory Chart Type Methods
    // ============================================================================

    /**
     * Get chart type for directory analysis
     */
    public async getDirectoryChartType(): Promise<ChartType> {
        const config = await this.loadConfiguration();
        return config.chartTypeDirectory;
    }

    /**
     * Set chart type for directory analysis
     */
    public async setDirectoryChartType(chartType: ChartType): Promise<void> {
        await this.updateConfiguration({ chartTypeDirectory: chartType });
    }

    // ============================================================================
    // Directory Dimension Mapping Methods
    // ============================================================================

    /**
     * Get dimension mapping for directory analysis
     */
    public async getDimensionMappingDirectory(): Promise<DimensionMapping> {
        const config = await this.loadConfiguration();
        return config.dimensionMappingDirectory;
    }

    /**
     * Set dimension mapping for directory analysis
     */
    public async setDimensionMappingDirectory(mapping: DimensionMapping): Promise<void> {
        await this.updateConfiguration({ dimensionMappingDirectory: mapping });
    }

    /**
     * Get XR Babia UI configuration.
     */
    public async getXRBabiaUiConfig(): Promise<XRBabiaUiConfig> {
        const config = await this.loadConfiguration();
        return config.xrBabiaUi;
    }

    /**
     * Set XR Babia UI configuration.
     */
    public async setXRBabiaUiConfig(value: XRBabiaUiConfig): Promise<void> {
        await this.updateConfiguration({ xrBabiaUi: value });
    }

    /**
     * Get whether Babia UI is enabled for XR output injection.
     */
    public async getXRBabiaUiEnabled(): Promise<boolean> {
        const config = await this.loadConfiguration();
        return config.xrBabiaUi.enabled;
    }

    /**
     * Set whether Babia UI is enabled for XR output injection.
     */
    public async setXRBabiaUiEnabled(enabled: boolean): Promise<void> {
        const config = await this.loadConfiguration();
        await this.updateConfiguration({
            xrBabiaUi: {
                ...config.xrBabiaUi,
                enabled,
            },
        });
    }
}

