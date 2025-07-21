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
    ViewTheme,
    AutoAnalysisDelayConfig,
    DEFAULT_CONFIGURATION_FILE,
    DEFAULT_ANALYSIS_CONFIGURATION
} from './models/analysisConfiguration';

export class AnalysisConfigurationStorage {
    private static instance: AnalysisConfigurationStorage;
    private readonly STORAGE_FOLDER = 'codexr_analysis';
    private readonly CONFIG_FILE = 'configuration_analysis.json';
    private context: vscode.ExtensionContext;
    private cachedConfiguration: AnalysisConfiguration | null = null;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        console.log('NEW_CODE_ANALYSIS: Initializing configuration storage');
    }

    /**
     * Get singleton instance
     */
    public static getInstance(context: vscode.ExtensionContext): AnalysisConfigurationStorage {
        if (!AnalysisConfigurationStorage.instance) {
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
                const configuration = {
                    ...DEFAULT_ANALYSIS_CONFIGURATION,
                    ...configFile.configuration
                };
                
                this.cachedConfiguration = configuration;
                console.log('NEW_CODE_ANALYSIS: Configuration loaded from storage:', configuration);
                return configuration;
                
            } catch (readError) {
                // File doesn't exist or is corrupted, return defaults
                console.log('NEW_CODE_ANALYSIS: Configuration file not found, using defaults');
                this.cachedConfiguration = DEFAULT_ANALYSIS_CONFIGURATION;
                
                // Create default file
                await this.saveConfiguration(DEFAULT_ANALYSIS_CONFIGURATION);
                return DEFAULT_ANALYSIS_CONFIGURATION;
            }
            
        } catch (error) {
            console.error('NEW_CODE_ANALYSIS: Error loading configuration:', error);
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
            
            console.log('NEW_CODE_ANALYSIS: Configuration saved to storage:', configuration);
            
        } catch (error) {
            console.error('NEW_CODE_ANALYSIS: Error saving configuration:', error);
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
    }

    /**
     * Update multiple settings at once
     */
    public async updateConfiguration(updates: Partial<AnalysisConfiguration>): Promise<void> {
        const currentConfig = await this.loadConfiguration();
        const updatedConfig = {
            ...currentConfig,
            ...updates
        };
        await this.saveConfiguration(updatedConfig);
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
}
