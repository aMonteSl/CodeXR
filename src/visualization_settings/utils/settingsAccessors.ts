import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_VISUALIZATION_SETTINGS } from '../model/settingsModel';

/**
 * Settings Accessors
 * Clean utility functions to access visualization settings for babia-templates integration
 */

// Module-level cache for context
let extensionContext: vscode.ExtensionContext | null = null;

/**
 * Initialize the settings accessors with extension context
 * Must be called during extension activation
 */
export function initializeSettingsAccessors(context: vscode.ExtensionContext): void {
    extensionContext = context;
    console.log('VISUALIZATION-SETTINGS: Settings accessors initialized');
}

/**
 * Get the visualization configuration directory path
 */
function getConfigDirectory(): string {
    if (!extensionContext) {
        throw new Error('Settings accessors not initialized. Call initializeSettingsAccessors() first.');
    }
    
    const globalStorageUri = extensionContext.globalStorageUri;
    return path.join(globalStorageUri.fsPath, 'visualization-configuration');
}

/**
 * Get the settings file path
 */
function getSettingsFilePath(): string {
    return path.join(getConfigDirectory(), 'visualization-settings.json');
}

/**
 * Read settings from the JSON file
 */
function readSettingsFromFile(): { 
    backgroundColor?: string; 
    groundColor?: string; 
    environment: string; 
    palette: string 
} | null {
    try {
        const settingsFilePath = getSettingsFilePath();
        
        if (fs.existsSync(settingsFilePath)) {
            const fileContent = fs.readFileSync(settingsFilePath, 'utf8');
            const jsonSettings = JSON.parse(fileContent) as { 
                backgroundColor?: string; 
                groundColor?: string; 
                environment: string; 
                palette: string 
            };
            
            console.log('VISUALIZATION-SETTINGS: Read settings from file:', jsonSettings);
            return jsonSettings;
        }
    } catch (error) {
        console.error('VISUALIZATION-SETTINGS: Error reading settings file:', error);
    }
    
    return null;
}

/**
 * Get current background color from file storage or globalState fallback
 */
async function getBackgroundColorFromStorage(): Promise<string> {
    try {
        // First try to read from JSON file
        const fileSettings = readSettingsFromFile();
        if (fileSettings && fileSettings.backgroundColor) {
            return fileSettings.backgroundColor;
        }
        
        // Fallback to globalState for backward compatibility
        if (extensionContext) {
            const legacySettings = extensionContext.globalState.get<any>('visualizationSettings');
            if (legacySettings && legacySettings.backgroundColor) {
                return legacySettings.backgroundColor;
            }
        }
    } catch (error) {
        console.error('VISUALIZATION-SETTINGS: Error reading background color from storage:', error);
    }
    
    return DEFAULT_VISUALIZATION_SETTINGS.backgroundColor;
}

/**
 * Get current ground color from file storage or globalState fallback
 */
async function getGroundColorFromStorage(): Promise<string> {
    try {
        // First try to read from JSON file
        const fileSettings = readSettingsFromFile();
        if (fileSettings && fileSettings.groundColor) {
            return fileSettings.groundColor;
        }
        
        // Fallback to globalState for backward compatibility
        if (extensionContext) {
            const legacySettings = extensionContext.globalState.get<any>('visualizationSettings');
            if (legacySettings && legacySettings.groundColor) {
                return legacySettings.groundColor;
            }
        }
    } catch (error) {
        console.error('VISUALIZATION-SETTINGS: Error reading ground color from storage:', error);
    }
    
    return DEFAULT_VISUALIZATION_SETTINGS.groundColor;
}

/**
 * Get the currently selected background color
 * @returns Promise<string> Hex color value (e.g., "#B10DC9")
 */
export async function getSelectedBackgroundColor(): Promise<string> {
    console.log('VISUALIZATION-SETTINGS: Getting selected background color');
    const color = await getBackgroundColorFromStorage();
    console.log(`VISUALIZATION-SETTINGS: Background color: ${color}`);
    return color;
}

/**
 * Get the currently selected ground color
 * @returns Promise<string> Hex color value (e.g., "#FFFFFF")
 */
export async function getSelectedGroundColor(): Promise<string> {
    console.log('VISUALIZATION-SETTINGS: Getting selected ground color');
    const color = await getGroundColorFromStorage();
    console.log(`VISUALIZATION-SETTINGS: Ground color: ${color}`);
    return color;
}

/**
 * Get the currently selected environment preset
 * @returns Promise<string> Environment preset name (e.g., "forest")
 */
export async function getSelectedEnvironment(): Promise<string> {
    console.log('VISUALIZATION-SETTINGS: Getting selected environment');
    
    const settings = readSettingsFromFile();
    const environment = settings?.environment || DEFAULT_VISUALIZATION_SETTINGS.environmentPreset;
    
    console.log(`VISUALIZATION-SETTINGS: Environment: ${environment}`);
    return environment;
}

/**
 * Get the currently selected chart palette
 * @returns Promise<string> Chart palette name (e.g., "ubuntu")
 */
export async function getSelectedPalette(): Promise<string> {
    console.log('VISUALIZATION-SETTINGS: Getting selected chart palette');
    
    const settings = readSettingsFromFile();
    const palette = settings?.palette || DEFAULT_VISUALIZATION_SETTINGS.chartPalette;
    
    console.log(`VISUALIZATION-SETTINGS: Palette: ${palette}`);
    return palette;
}

/**
 * Get all current settings in a single call (for efficiency)
 * @returns Promise<object> Object containing all current settings
 */
export async function getAllSelectedSettings(): Promise<{
    backgroundColor: string;
    groundColor: string;
    environment: string;
    palette: string;
}> {
    console.log('VISUALIZATION-SETTINGS: Getting all selected settings');
    
    const [backgroundColor, groundColor] = await Promise.all([
        getSelectedBackgroundColor(),
        getSelectedGroundColor()
    ]);
    
    const settings = readSettingsFromFile();
    const environment = settings?.environment || DEFAULT_VISUALIZATION_SETTINGS.environmentPreset;
    const palette = settings?.palette || DEFAULT_VISUALIZATION_SETTINGS.chartPalette;
    
    const allSettings = {
        backgroundColor,
        groundColor,
        environment,
        palette
    };
    
    console.log('VISUALIZATION-SETTINGS: All settings:', allSettings);
    return allSettings;
}
