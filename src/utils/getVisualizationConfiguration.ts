/**
 * Visualization Configuration Utility
 * Common functions for retrieving visualization settings across templates
 */

export interface VisualizationSettings {
    palette: string;
    environment: string;
    backgroundColor: string;
    groundColor: string;
}

/**
 * Get visualization settings (palette, environment, colors)
 * Centralized function used by all template processors
 */
export async function getVisualizationConfiguration(): Promise<VisualizationSettings> {
    try {
        console.log('VISUALIZATION_CONFIG: Retrieving visualization settings...');
        
        // Import visualization settings functions directly (no dynamic import needed)
        const { 
            getSelectedPalette,
            getSelectedEnvironment,
            getSelectedBackgroundColor,
            getSelectedGroundColor
        } = require('../visualization_settings');

        const settings = {
            palette: await getSelectedPalette(),
            environment: await getSelectedEnvironment(),
            backgroundColor: await getSelectedBackgroundColor(),
            groundColor: await getSelectedGroundColor()
        };

        console.log('VISUALIZATION_CONFIG: Settings retrieved:', settings);
        return settings;

    } catch (error) {
        console.error('VISUALIZATION_CONFIG: Error retrieving settings:', error);
        
        // Return default settings if there's an error
        const defaultSettings = {
            palette: 'blues',
            environment: 'forest',
            backgroundColor: '#001122',
            groundColor: '#553311'
        };
        
        console.log('VISUALIZATION_CONFIG: Using default settings:', defaultSettings);
        return defaultSettings;
    }
}

/**
 * Get individual setting with fallback
 */
export async function getIndividualSetting(settingType: keyof VisualizationSettings): Promise<string> {
    try {
        const settings = await getVisualizationConfiguration();
        return settings[settingType];
    } catch (error) {
        console.error(`VISUALIZATION_CONFIG: Error getting ${settingType}:`, error);
        
        // Default fallbacks
        const defaults: VisualizationSettings = {
            palette: 'blues',
            environment: 'forest',
            backgroundColor: '#001122',
            groundColor: '#553311'
        };
        
        return defaults[settingType];
    }
}
