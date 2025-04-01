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
exports.COLOR_PALETTES = exports.ENVIRONMENT_PRESETS = void 0;
exports.collectChartOptions = collectChartOptions;
exports.collectBarsmapChartOptions = collectBarsmapChartOptions;
exports.collectDonutChartOptions = collectDonutChartOptions;
exports.collectPieChartOptions = collectPieChartOptions;
exports.collectEnvironmentOptions = collectEnvironmentOptions;
const vscode = __importStar(require("vscode"));
const chartModel_1 = require("../models/chartModel");
/**
 * Collects chart-specific options based on chart type
 */
async function collectChartOptions(chartType) {
    switch (chartType) {
        case chartModel_1.ChartType.BARSMAP_CHART:
            return collectBarsmapChartOptions();
        case chartModel_1.ChartType.PIE_CHART:
            return collectPieChartOptions();
        case chartModel_1.ChartType.DONUT_CHART:
            return collectDonutChartOptions();
        default:
            return {};
    }
}
/**
 * Collects options specific to barsmap charts
 * @returns BarChartOptions object
 */
async function collectBarsmapChartOptions() {
    return {
        height: 1,
        width: 2
    };
}
/**
 * Collects options specific to donut charts
 */
async function collectDonutChartOptions() {
    // Return default values without asking for unnecessary parameters
    return {
        donutRadius: 0.5 // Use a standard default value
    };
}
/**
 * Collects options specific to pie charts (simplified - no donut option)
 */
async function collectPieChartOptions() {
    // Simplified implementation - no donut option
    return {};
}
/**
 * Available environment presets in A-Frame
 */
exports.ENVIRONMENT_PRESETS = [
    'forest', 'starry', 'dream', 'tron', 'arches', 'egypt', 'contact',
    'threetowers', 'poison', 'default', 'goldmine', 'yavapai', 'osiris', 'moon'
];
/**
 * Available color palettes for BabiaXR
 */
exports.COLOR_PALETTES = [
    'ubuntu', 'blues', 'flat', 'reds', 'greens', 'yellows', 'commerce'
];
/**
 * Collects environment configuration options
 */
async function collectEnvironmentOptions(context) {
    // Get default values from settings
    const defaultBgColor = context.globalState.get('babiaBackgroundColor') || '#112233';
    const defaultEnvPreset = context.globalState.get('babiaEnvironmentPreset') || 'forest';
    const defaultGroundColor = context.globalState.get('babiaGroundColor') || '#445566';
    const defaultPalette = context.globalState.get('babiaChartPalette') || 'ubuntu';
    // Select environment preset
    const environmentPreset = await vscode.window.showQuickPick(exports.ENVIRONMENT_PRESETS.map(preset => ({
        label: preset,
        description: `Environment preset: ${preset}`
    })), {
        placeHolder: 'Select environment preset',
        activeItems: [{ label: defaultEnvPreset }]
    });
    if (!environmentPreset)
        return undefined;
    // Select background color
    const backgroundColor = await vscode.window.showInputBox({
        prompt: 'Background color (hex format)',
        placeHolder: '#112233',
        value: defaultBgColor,
        validateInput: value => {
            return /^#[0-9A-Fa-f]{6}$/.test(value) ? null : 'Please enter a valid hex color (e.g., #112233)';
        }
    });
    if (!backgroundColor)
        return undefined;
    // Select ground color
    const groundColor = await vscode.window.showInputBox({
        prompt: 'Ground color (hex format)',
        placeHolder: '#445566',
        value: defaultGroundColor,
        validateInput: value => {
            return /^#[0-9A-Fa-f]{6}$/.test(value) ? null : 'Please enter a valid hex color (e.g., #445566)';
        }
    });
    if (!groundColor)
        return undefined;
    // Select chart color palette
    const chartPalette = await vscode.window.showQuickPick(exports.COLOR_PALETTES.map(palette => ({
        label: palette,
        description: `Color palette: ${palette}`
    })), {
        placeHolder: 'Select chart color palette',
        activeItems: [{ label: defaultPalette }]
    });
    if (!chartPalette)
        return undefined;
    return {
        backgroundColor,
        environmentPreset: environmentPreset.label,
        groundColor,
        chartPalette: chartPalette.label
    };
}
//# sourceMappingURL=optionsCollector.js.map