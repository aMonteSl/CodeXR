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
exports.collectChartOptions = collectChartOptions;
exports.collectEnvironmentOptions = collectEnvironmentOptions;
const vscode = __importStar(require("vscode"));
const chartModel_1 = require("../models/chartModel");
const colorPickerUtils_1 = require("../../utils/colorPickerUtils");
const visualizationConfig_1 = require("../config/visualizationConfig");
/**
 * Collects chart-specific options from user
 * @param chartType Type of chart to collect options for
 * @returns Chart options or undefined if canceled
 */
async function collectChartOptions(chartType) {
    try {
        // Default position
        let defaultPosition = "0 0 0";
        if (chartType === chartModel_1.ChartType.BARSMAP_CHART) {
            defaultPosition = "0 0.5 0";
        }
        // Get position
        const position = await vscode.window.showInputBox({
            prompt: 'Enter chart position (x y z)',
            placeHolder: 'e.g. 0 0 0',
            value: defaultPosition
        });
        if (!position)
            return undefined; // User canceled
        // Get scale
        const scale = await vscode.window.showInputBox({
            prompt: 'Enter chart scale (x y z) - optional',
            placeHolder: 'e.g. 1 1 1',
            value: getDefaultScaleForChart(chartType)
        });
        // Get rotation for some charts
        let rotation;
        if (chartType === chartModel_1.ChartType.PIE_CHART || chartType === chartModel_1.ChartType.DONUT_CHART) {
            rotation = await vscode.window.showInputBox({
                prompt: 'Enter chart rotation (x y z) - optional',
                placeHolder: 'e.g. -90 0 0',
                value: '-90 0 0'
            });
        }
        // Get height for bar charts
        let height;
        if (chartType === chartModel_1.ChartType.BARS_CHART || chartType === chartModel_1.ChartType.BARSMAP_CHART || chartType === chartModel_1.ChartType.CYLS_CHART) {
            height = await vscode.window.showInputBox({
                prompt: 'Enter maximum height for bars/cylinders',
                placeHolder: 'e.g. 5',
                value: '5'
            });
        }
        return {
            position,
            scale,
            rotation,
            height
        };
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error collecting chart options: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}
/**
 * Get default scale based on chart type
 */
function getDefaultScaleForChart(chartType) {
    switch (chartType) {
        case chartModel_1.ChartType.PIE_CHART:
        case chartModel_1.ChartType.DONUT_CHART:
            return '3 3 3';
        case chartModel_1.ChartType.BARS_CHART:
        case chartModel_1.ChartType.BARSMAP_CHART:
        case chartModel_1.ChartType.CYLS_CHART:
            return '1 1 1';
        default:
            return '1 1 1';
    }
}
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
    const environmentPreset = await vscode.window.showQuickPick(visualizationConfig_1.ENVIRONMENT_PRESETS.map(preset => ({
        label: preset.value,
        description: preset.description,
        picked: preset.value === defaultEnvPreset
    })), {
        placeHolder: 'Select environment preset',
        matchOnDescription: true
    });
    if (!environmentPreset)
        return undefined;
    // Select background color using visual picker
    const backgroundColor = await (0, colorPickerUtils_1.showColorPicker)('Select Background Color', defaultBgColor);
    if (!backgroundColor)
        return undefined;
    // Select ground color using visual picker
    const groundColor = await (0, colorPickerUtils_1.showColorPicker)('Select Ground Color', defaultGroundColor);
    if (!groundColor)
        return undefined;
    // Select chart color palette
    const chartPalette = await vscode.window.showQuickPick(visualizationConfig_1.COLOR_PALETTES.map(palette => ({
        label: palette.value,
        description: palette.description,
        picked: palette.value === defaultPalette
    })), {
        placeHolder: 'Select chart color palette',
        matchOnDescription: true
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