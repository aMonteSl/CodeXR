"use strict";
/**
 * Configuration file for visualization options
 * Contains environment presets and color palettes for BabiaXR visualizations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLOR_PALETTES = exports.ENVIRONMENT_PRESETS = void 0;
/**
 * Environment presets for A-Frame
 */
exports.ENVIRONMENT_PRESETS = [
    { value: 'none', description: 'No environment, just a sky' },
    { value: 'default', description: 'Default environment with hills and sky' },
    { value: 'forest', description: 'A forest with trees and directional light' },
    { value: 'egypt', description: 'Egyptian landscape with sand and pyramids' },
    { value: 'dream', description: 'Surreal dreamlike environment' },
    { value: 'volcano', description: 'Volcanic terrain with lava and smoke' },
    { value: 'arches', description: 'Desert with rock arches' },
    { value: 'tron', description: 'Futuristic Tron-like environment' },
    { value: 'japan', description: 'Stylized Japanese landscape' },
    { value: 'threetowers', description: 'Fantasy environment with three towers' },
    { value: 'poison', description: 'Toxic environment with green fog' },
    { value: 'contact', description: 'Sci-fi environment with landing pad' },
];
/**
 * Color palettes for BabiaXR visualizations
 */
exports.COLOR_PALETTES = [
    { value: 'ubuntu', description: 'Ubuntu style colors (default)' },
    { value: 'blues', description: 'Variations of blue colors' },
    { value: 'foxy', description: 'Firefox palette with oranges and blues' },
];
//# sourceMappingURL=visualizationConfig.js.map