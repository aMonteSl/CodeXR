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
exports.initializeSettingsAccessors = initializeSettingsAccessors;
exports.getSelectedBackgroundColor = getSelectedBackgroundColor;
exports.getSelectedGroundColor = getSelectedGroundColor;
exports.getSelectedEnvironment = getSelectedEnvironment;
exports.getSelectedPalette = getSelectedPalette;
exports.getAllSelectedSettings = getAllSelectedSettings;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const settingsModel_1 = require("../model/settingsModel");
/**
 * Settings Accessors
 * Clean utility functions to access visualization settings for babia-templates integration
 */
// Module-level cache for context
let extensionContext = null;
/**
 * Initialize the settings accessors with extension context
 * Must be called during extension activation
 */
function initializeSettingsAccessors(context) {
    extensionContext = context;
    console.log('VISUALIZATION-SETTINGS: Settings accessors initialized');
}
/**
 * Get the visualization configuration directory path
 */
function getConfigDirectory() {
    if (!extensionContext) {
        throw new Error('Settings accessors not initialized. Call initializeSettingsAccessors() first.');
    }
    const globalStorageUri = extensionContext.globalStorageUri;
    return path.join(globalStorageUri.fsPath, 'visualization-configuration');
}
/**
 * Get the settings file path
 */
function getSettingsFilePath() {
    return path.join(getConfigDirectory(), 'visualization-settings.json');
}
/**
 * Read settings from the JSON file
 */
function readSettingsFromFile() {
    try {
        const settingsFilePath = getSettingsFilePath();
        if (fs.existsSync(settingsFilePath)) {
            const fileContent = fs.readFileSync(settingsFilePath, 'utf8');
            const jsonSettings = JSON.parse(fileContent);
            console.log('VISUALIZATION-SETTINGS: Read settings from file:', jsonSettings);
            return jsonSettings;
        }
    }
    catch (error) {
        console.error('VISUALIZATION-SETTINGS: Error reading settings file:', error);
    }
    return null;
}
/**
 * Get current background color from file storage or globalState fallback
 */
async function getBackgroundColorFromStorage() {
    try {
        // First try to read from JSON file
        const fileSettings = readSettingsFromFile();
        if (fileSettings && fileSettings.backgroundColor) {
            return fileSettings.backgroundColor;
        }
        // Fallback to globalState for backward compatibility
        if (extensionContext) {
            const legacySettings = extensionContext.globalState.get('visualizationSettings');
            if (legacySettings && legacySettings.backgroundColor) {
                return legacySettings.backgroundColor;
            }
        }
    }
    catch (error) {
        console.error('VISUALIZATION-SETTINGS: Error reading background color from storage:', error);
    }
    return settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS.backgroundColor;
}
/**
 * Get current ground color from file storage or globalState fallback
 */
async function getGroundColorFromStorage() {
    try {
        // First try to read from JSON file
        const fileSettings = readSettingsFromFile();
        if (fileSettings && fileSettings.groundColor) {
            return fileSettings.groundColor;
        }
        // Fallback to globalState for backward compatibility
        if (extensionContext) {
            const legacySettings = extensionContext.globalState.get('visualizationSettings');
            if (legacySettings && legacySettings.groundColor) {
                return legacySettings.groundColor;
            }
        }
    }
    catch (error) {
        console.error('VISUALIZATION-SETTINGS: Error reading ground color from storage:', error);
    }
    return settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS.groundColor;
}
/**
 * Get the currently selected background color
 * @returns Promise<string> Hex color value (e.g., "#B10DC9")
 */
async function getSelectedBackgroundColor() {
    console.log('VISUALIZATION-SETTINGS: Getting selected background color');
    const color = await getBackgroundColorFromStorage();
    console.log(`VISUALIZATION-SETTINGS: Background color: ${color}`);
    return color;
}
/**
 * Get the currently selected ground color
 * @returns Promise<string> Hex color value (e.g., "#FFFFFF")
 */
async function getSelectedGroundColor() {
    console.log('VISUALIZATION-SETTINGS: Getting selected ground color');
    const color = await getGroundColorFromStorage();
    console.log(`VISUALIZATION-SETTINGS: Ground color: ${color}`);
    return color;
}
/**
 * Get the currently selected environment preset
 * @returns Promise<string> Environment preset name (e.g., "forest")
 */
async function getSelectedEnvironment() {
    console.log('VISUALIZATION-SETTINGS: Getting selected environment');
    const settings = readSettingsFromFile();
    const environment = settings?.environment || settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS.environmentPreset;
    console.log(`VISUALIZATION-SETTINGS: Environment: ${environment}`);
    return environment;
}
/**
 * Get the currently selected chart palette
 * @returns Promise<string> Chart palette name (e.g., "ubuntu")
 */
async function getSelectedPalette() {
    console.log('VISUALIZATION-SETTINGS: Getting selected chart palette');
    const settings = readSettingsFromFile();
    const palette = settings?.palette || settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS.chartPalette;
    console.log(`VISUALIZATION-SETTINGS: Palette: ${palette}`);
    return palette;
}
/**
 * Get all current settings in a single call (for efficiency)
 * @returns Promise<object> Object containing all current settings
 */
async function getAllSelectedSettings() {
    console.log('VISUALIZATION-SETTINGS: Getting all selected settings');
    const [backgroundColor, groundColor] = await Promise.all([
        getSelectedBackgroundColor(),
        getSelectedGroundColor()
    ]);
    const settings = readSettingsFromFile();
    const environment = settings?.environment || settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS.environmentPreset;
    const palette = settings?.palette || settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS.chartPalette;
    const allSettings = {
        backgroundColor,
        groundColor,
        environment,
        palette
    };
    console.log('VISUALIZATION-SETTINGS: All settings:', allSettings);
    return allSettings;
}
//# sourceMappingURL=settingsAccessors.js.map