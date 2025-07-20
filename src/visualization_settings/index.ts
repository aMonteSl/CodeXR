/**
 * Visualization Settings Module
 * Main entry point for visualization configuration management
 */

export { VisualizationSettings, DEFAULT_VISUALIZATION_SETTINGS, SettingFieldType } from './model/settingsModel';
export { VisualizationSettingsStorage } from './storage/settingsStorage';
export { VisualizationSettingsItemFactory, VisualizationSettingsTreeItem } from './views/items/visualizationSettingsItems';
export { VisualizationSettingsInteractionHandler } from './views/interactions/handleSettingsInteraction';

// Export settings accessors for babia-templates integration
export { 
    initializeSettingsAccessors,
    getSelectedBackgroundColor,
    getSelectedGroundColor,
    getSelectedEnvironment,
    getSelectedPalette,
    getAllSelectedSettings
} from './utils/settingsAccessors';
