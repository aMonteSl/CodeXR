"use strict";
/**
 * Visualization Settings Model
 * Defines the structure and interfaces for visualization configuration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SETTING_FIELDS = exports.HEX_COLOR_REGEX = exports.CHART_PALETTES = exports.ENVIRONMENT_PRESETS = exports.PREDEFINED_COLORS = exports.DEFAULT_VISUALIZATION_SETTINGS = void 0;
exports.isValidHexColor = isValidHexColor;
/**
 * Default visualization settings
 */
exports.DEFAULT_VISUALIZATION_SETTINGS = {
    backgroundColor: '#FFFFFF',
    groundColor: '#000000',
    environmentPreset: 'default',
    chartPalette: 'ubuntu'
};
/**
 * Predefined color options for quick selection
 */
exports.PREDEFINED_COLORS = [
    { label: '#FFFFFF (white)', value: '#FFFFFF' },
    { label: '#000000 (black)', value: '#000000' },
    { label: '#B10DC9 (pink)', value: '#B10DC9' }
];
/**
 * Available environment preset options with descriptions
 */
exports.ENVIRONMENT_PRESETS = [
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
exports.CHART_PALETTES = [
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
exports.HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
/**
 * Validate hex color format
 */
function isValidHexColor(color) {
    return exports.HEX_COLOR_REGEX.test(color);
}
/**
 * Configuration for all setting fields
 */
exports.SETTING_FIELDS = [
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
//# sourceMappingURL=settingsModel.js.map