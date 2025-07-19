/**
 * Visualization Settings Model
 * Defines the structure and interfaces for visualization configuration
 */

/**
 * Available environment presets for A-Frame scenes
 */
export type EnvironmentPreset = 
    | 'none' 
    | 'default' 
    | 'forest' 
    | 'egypt' 
    | 'dream' 
    | 'volcano' 
    | 'arches' 
    | 'tron' 
    | 'japan' 
    | 'threetowers' 
    | 'poison' 
    | 'contact';

/**
 * Available chart color palettes
 */
export type ChartPalette = 
    | 'ubuntu' 
    | 'blues' 
    | 'bussiness' 
    | 'commerce' 
    | 'flat' 
    | 'foxy' 
    | 'icecream' 
    | 'pearl' 
    | 'sunset';

/**
 * Visualization settings configuration
 */
export interface VisualizationSettings {
    /** Background color in hex format (e.g., #FFFFFF) */
    backgroundColor: string;
    
    /** Ground color in hex format (e.g., #000000) */
    groundColor: string;
    
    /** Environment preset for A-Frame scene */
    environmentPreset: EnvironmentPreset;
    
    /** Chart color palette */
    chartPalette: ChartPalette;
}

/**
 * Default visualization settings
 */
export const DEFAULT_VISUALIZATION_SETTINGS: VisualizationSettings = {
    backgroundColor: '#FFFFFF',
    groundColor: '#000000',
    environmentPreset: 'default',
    chartPalette: 'ubuntu'
};

/**
 * Predefined color options for quick selection
 */
export const PREDEFINED_COLORS = [
    { label: '#FFFFFF (white)', value: '#FFFFFF' },
    { label: '#000000 (black)', value: '#000000' },
    { label: '#B10DC9 (pink)', value: '#B10DC9' }
];

/**
 * Available environment preset options with descriptions
 */
export const ENVIRONMENT_PRESETS: { label: string; value: EnvironmentPreset; description: string }[] = [
    { label: 'none', value: 'none', description: 'No environment, just a sky' },
    { label: 'default', value: 'default', description: 'Default environment with hills and sky' },
    { label: 'forest', value: 'forest', description: 'A forest with trees and directional light' },
    { label: 'egypt', value: 'egypt', description: 'Egyptian landscape with sand and pyramids' },
    { label: 'dream', value: 'dream', description: 'Surreal dreamlike environment' },
    { label: 'volcano', value: 'volcano', description: 'Volcanic terrain with lava and smoke' },
    { label: 'arches', value: 'arches', description: 'Desert with rock arches' },
    { label: 'tron', value: 'tron', description: 'Futuristic Tron-like environment' },
    { label: 'japan', value: 'japan', description: 'Stylized Japanese landscape' },
    { label: 'threetowers', value: 'threetowers', description: 'Fantasy environment with three towers' },
    { label: 'poison', value: 'poison', description: 'Toxic environment with green fog' },
    { label: 'contact', value: 'contact', description: 'Sci-fi environment with landing pad' }
];

/**
 * Available chart palette options with descriptions
 */
export const CHART_PALETTES: { label: string; value: ChartPalette; description: string }[] = [
    { label: 'ubuntu', value: 'ubuntu', description: 'Ubuntu style colors (default)' },
    { label: 'blues', value: 'blues', description: 'Variations of blue colors' },
    { label: 'bussiness', value: 'bussiness', description: 'Professional business colors' },
    { label: 'commerce', value: 'commerce', description: 'E-commerce friendly palette' },
    { label: 'flat', value: 'flat', description: 'Flat design color scheme' },
    { label: 'foxy', value: 'foxy', description: 'FireFox palette with oranges and blues' },
    { label: 'icecream', value: 'icecream', description: 'Sweet pastel colors' },
    { label: 'pearl', value: 'pearl', description: 'Pearlescent subtle colors' },
    { label: 'sunset', value: 'sunset', description: 'Warm sunset color gradients' }
];

/**
 * Validation for hex color format
 */
export const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Validate hex color format
 */
export function isValidHexColor(color: string): boolean {
    return HEX_COLOR_REGEX.test(color);
}

/**
 * Setting field types for interaction handling
 */
export type SettingFieldType = 'backgroundColor' | 'groundColor' | 'environmentPreset' | 'chartPalette';

/**
 * Setting field configuration for UI generation
 */
export interface SettingField {
    key: SettingFieldType;
    label: string;
    type: 'color' | 'preset' | 'palette';
    description: string;
    icon: string;
}

/**
 * Configuration for all setting fields
 */
export const SETTING_FIELDS: SettingField[] = [
    {
        key: 'backgroundColor',
        label: 'Background Color',
        type: 'color',
        description: 'Set the background color for the visualization scene',
        icon: 'color-mode'
    },
    {
        key: 'groundColor',
        label: 'Ground Color',
        type: 'color',
        description: 'Set the ground color for the visualization scene',
        icon: 'symbol-color'
    },
    {
        key: 'environmentPreset',
        label: 'Environment Preset',
        type: 'preset',
        description: 'Choose an environment preset for the scene',
        icon: 'globe'
    },
    {
        key: 'chartPalette',
        label: 'Chart Palette',
        type: 'palette',
        description: 'Select color palette for chart visualization',
        icon: 'symbol-misc'
    }
];
