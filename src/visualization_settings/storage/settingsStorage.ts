import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { VisualizationSettings, DEFAULT_VISUALIZATION_SETTINGS } from '../model/settingsModel';

/**
 * Visualization Settings Storage
 * Manages persistent storage and retrieval of visualization configuration using file system
 */
export class VisualizationSettingsStorage {
    private static readonly VISUALIZATION_CONFIG_DIR = 'visualization-configuration';
    private static readonly SETTINGS_FILE = 'visualization-settings.json';
    private static readonly LEGACY_STORAGE_KEY = 'visualizationSettings'; // For migration
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        console.log('VISUALIZATION-SETTINGS: Storage manager initialized with file-based storage');
    }

    /**
     * Get the visualization configuration directory path
     */
    private getConfigDirectory(): string {
        const globalStorageUri = this.context.globalStorageUri;
        return path.join(globalStorageUri.fsPath, VisualizationSettingsStorage.VISUALIZATION_CONFIG_DIR);
    }

    /**
     * Get the settings file path
     */
    private getSettingsFilePath(): string {
        return path.join(this.getConfigDirectory(), VisualizationSettingsStorage.SETTINGS_FILE);
    }

    /**
     * Ensure the configuration directory exists
     */
    private ensureConfigDirectory(): void {
        const configDir = this.getConfigDirectory();
        
        try {
            if (!fs.existsSync(configDir)) {
                console.log(`VISUALIZATION-SETTINGS: Creating configuration directory: ${configDir}`);
                fs.mkdirSync(configDir, { recursive: true });
            }
        } catch (error) {
            console.error('VISUALIZATION-SETTINGS: Error creating configuration directory:', error);
            throw new Error(`Failed to create configuration directory: ${error}`);
        }
    }

    /**
     * Migrate legacy settings from globalState to file system
     */
    private migrateLegacySettings(): void {
        try {
            const legacySettings = this.context.globalState.get<VisualizationSettings>(
                VisualizationSettingsStorage.LEGACY_STORAGE_KEY
            );

            if (legacySettings && !fs.existsSync(this.getSettingsFilePath())) {
                console.log('VISUALIZATION-SETTINGS: Migrating legacy settings to file system');
                
                const settingsFilePath = this.getSettingsFilePath();
                const jsonSettings = {
                    backgroundColor: legacySettings.backgroundColor,
                    groundColor: legacySettings.groundColor,
                    environment: legacySettings.environmentPreset,
                    palette: legacySettings.chartPalette
                };

                fs.writeFileSync(settingsFilePath, JSON.stringify(jsonSettings, null, 2), 'utf8');
                console.log('VISUALIZATION-SETTINGS: Legacy settings migration completed with all settings');
            }
        } catch (error) {
            console.error('VISUALIZATION-SETTINGS: Error during legacy migration:', error);
            // Don't throw - migration failure shouldn't prevent normal operation
        }
    }

    /**
     * Get current visualization settings from file system
     */
    public getSettings(): VisualizationSettings {
        try {
            // Ensure directory exists and migrate legacy settings if needed
            this.ensureConfigDirectory();
            this.migrateLegacySettings();

            const settingsFilePath = this.getSettingsFilePath();
            
            if (fs.existsSync(settingsFilePath)) {
                const fileContent = fs.readFileSync(settingsFilePath, 'utf8');
                const jsonSettings = JSON.parse(fileContent) as { 
                    backgroundColor?: string; 
                    groundColor?: string;
                    environment: string; 
                    palette: string 
                };

                // Build complete settings from JSON with fallbacks to defaults
                const settings: VisualizationSettings = {
                    backgroundColor: jsonSettings.backgroundColor || DEFAULT_VISUALIZATION_SETTINGS.backgroundColor,
                    groundColor: jsonSettings.groundColor || DEFAULT_VISUALIZATION_SETTINGS.groundColor,
                    environmentPreset: jsonSettings.environment as any,
                    chartPalette: jsonSettings.palette as any
                };
                
                console.log('VISUALIZATION-SETTINGS: Loaded settings from file', settings);
                return settings;
            }
        } catch (error) {
            console.error('VISUALIZATION-SETTINGS: Failed to load settings from file:', error);
        }

        console.log('VISUALIZATION-SETTINGS: Using default settings');
        return { ...DEFAULT_VISUALIZATION_SETTINGS };
    }

    /**
     * Save visualization settings to file system
     */
    public async saveSettings(settings: VisualizationSettings): Promise<void> {
        try {
            this.ensureConfigDirectory();
            
            const settingsFilePath = this.getSettingsFilePath();
            
            // Create settings object for JSON file (all four settings)
            const jsonSettings = {
                backgroundColor: settings.backgroundColor,
                groundColor: settings.groundColor,
                environment: settings.environmentPreset,
                palette: settings.chartPalette
            };

            // Save to JSON file
            fs.writeFileSync(settingsFilePath, JSON.stringify(jsonSettings, null, 2), 'utf8');
            
            // Also save complete settings to globalState for backward compatibility
            await this.context.globalState.update(
                VisualizationSettingsStorage.LEGACY_STORAGE_KEY,
                settings
            );
            
            console.log('VISUALIZATION-SETTINGS: Settings saved to file and globalState', settings);
        } catch (error) {
            console.error('VISUALIZATION-SETTINGS: Failed to save settings:', error);
            throw new Error(`Failed to save visualization settings: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Update a single setting field
     */
    public async updateSetting<K extends keyof VisualizationSettings>(
        key: K,
        value: VisualizationSettings[K]
    ): Promise<void> {
        const currentSettings = this.getSettings();
        const updatedSettings = {
            ...currentSettings,
            [key]: value
        };

        await this.saveSettings(updatedSettings);
        console.log(`VISUALIZATION-SETTINGS: Updated ${key} to '${value}'`);
    }

    /**
     * Reset settings to defaults
     */
    public async resetSettings(): Promise<void> {
        await this.saveSettings({ ...DEFAULT_VISUALIZATION_SETTINGS });
        console.log('VISUALIZATION-SETTINGS: Settings reset to defaults');
    }

    /**
     * Check if settings exist in storage
     */
    public hasStoredSettings(): boolean {
        const settingsFilePath = this.getSettingsFilePath();
        return fs.existsSync(settingsFilePath);
    }

    /**
     * Get formatted settings for display
     */
    public getFormattedSettings(): Record<string, string> {
        const settings = this.getSettings();
        return {
            backgroundColor: settings.backgroundColor,
            groundColor: settings.groundColor,
            environmentPreset: settings.environmentPreset,
            chartPalette: settings.chartPalette
        };
    }

    /**
     * Validate settings structure
     */
    public validateSettings(settings: any): settings is VisualizationSettings {
        return (
            typeof settings === 'object' &&
            typeof settings.backgroundColor === 'string' &&
            typeof settings.groundColor === 'string' &&
            typeof settings.environmentPreset === 'string' &&
            typeof settings.chartPalette === 'string'
        );
    }
}
