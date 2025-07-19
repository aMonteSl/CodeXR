"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisualizationSettingsStorage = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const settingsModel_1 = require("../model/settingsModel");
/**
 * Visualization Settings Storage
 * Manages persistent storage and retrieval of visualization configuration using file system
 */
class VisualizationSettingsStorage {
    static VISUALIZATION_CONFIG_DIR = 'visualization-configuration';
    static SETTINGS_FILE = 'visualization-settings.json';
    static LEGACY_STORAGE_KEY = 'visualizationSettings'; // For migration
    context;
    constructor(context) {
        this.context = context;
        console.log('VISUALIZATION-SETTINGS: Storage manager initialized with file-based storage');
    }
    /**
     * Get the visualization configuration directory path
     */
    getConfigDirectory() {
        const globalStorageUri = this.context.globalStorageUri;
        return path.join(globalStorageUri.fsPath, VisualizationSettingsStorage.VISUALIZATION_CONFIG_DIR);
    }
    /**
     * Get the settings file path
     */
    getSettingsFilePath() {
        return path.join(this.getConfigDirectory(), VisualizationSettingsStorage.SETTINGS_FILE);
    }
    /**
     * Ensure the configuration directory exists
     */
    ensureConfigDirectory() {
        const configDir = this.getConfigDirectory();
        try {
            if (!fs.existsSync(configDir)) {
                console.log(`VISUALIZATION-SETTINGS: Creating configuration directory: ${configDir}`);
                fs.mkdirSync(configDir, { recursive: true });
            }
        }
        catch (error) {
            console.error('VISUALIZATION-SETTINGS: Error creating configuration directory:', error);
            throw new Error(`Failed to create configuration directory: ${error}`);
        }
    }
    /**
     * Migrate legacy settings from globalState to file system
     */
    migrateLegacySettings() {
        try {
            const legacySettings = this.context.globalState.get(VisualizationSettingsStorage.LEGACY_STORAGE_KEY);
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
        }
        catch (error) {
            console.error('VISUALIZATION-SETTINGS: Error during legacy migration:', error);
            // Don't throw - migration failure shouldn't prevent normal operation
        }
    }
    /**
     * Get current visualization settings from file system
     */
    getSettings() {
        try {
            // Ensure directory exists and migrate legacy settings if needed
            this.ensureConfigDirectory();
            this.migrateLegacySettings();
            const settingsFilePath = this.getSettingsFilePath();
            if (fs.existsSync(settingsFilePath)) {
                const fileContent = fs.readFileSync(settingsFilePath, 'utf8');
                const jsonSettings = JSON.parse(fileContent);
                // Build complete settings from JSON with fallbacks to defaults
                const settings = {
                    backgroundColor: jsonSettings.backgroundColor || settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS.backgroundColor,
                    groundColor: jsonSettings.groundColor || settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS.groundColor,
                    environmentPreset: jsonSettings.environment,
                    chartPalette: jsonSettings.palette
                };
                console.log('VISUALIZATION-SETTINGS: Loaded settings from file', settings);
                return settings;
            }
        }
        catch (error) {
            console.error('VISUALIZATION-SETTINGS: Failed to load settings from file:', error);
        }
        console.log('VISUALIZATION-SETTINGS: Using default settings');
        return { ...settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS };
    }
    /**
     * Save visualization settings to file system
     */
    async saveSettings(settings) {
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
            await this.context.globalState.update(VisualizationSettingsStorage.LEGACY_STORAGE_KEY, settings);
            console.log('VISUALIZATION-SETTINGS: Settings saved to file and globalState', settings);
        }
        catch (error) {
            console.error('VISUALIZATION-SETTINGS: Failed to save settings:', error);
            throw new Error(`Failed to save visualization settings: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Update a single setting field
     */
    async updateSetting(key, value) {
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
    async resetSettings() {
        await this.saveSettings({ ...settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS });
        console.log('VISUALIZATION-SETTINGS: Settings reset to defaults');
    }
    /**
     * Check if settings exist in storage
     */
    hasStoredSettings() {
        const settingsFilePath = this.getSettingsFilePath();
        return fs.existsSync(settingsFilePath);
    }
    /**
     * Get formatted settings for display
     */
    getFormattedSettings() {
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
    validateSettings(settings) {
        return (typeof settings === 'object' &&
            typeof settings.backgroundColor === 'string' &&
            typeof settings.groundColor === 'string' &&
            typeof settings.environmentPreset === 'string' &&
            typeof settings.chartPalette === 'string');
    }
}
exports.VisualizationSettingsStorage = VisualizationSettingsStorage;
//# sourceMappingURL=settingsStorage.js.map