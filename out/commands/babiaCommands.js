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
exports.registerBabiaCommands = registerBabiaCommands;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const colorPickerUtils_1 = require("../utils/colorPickerUtils");
const chartModel_1 = require("../babiaxr/models/chartModel");
const chartManager_1 = require("../babiaxr/visualization/chartManager");
const dataCollector_1 = require("../babiaxr/visualization/dataCollector");
// Environment presets for A-Frame
const ENVIRONMENT_PRESETS = [
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
    { value: 'alien', description: 'Alien world with strange plants' },
    { value: 'osiris', description: 'Egyptian themed environment with pyramids' },
    { value: 'moon', description: 'Lunar landscape with low gravity' },
    { value: 'contact', description: 'Sci-fi environment with landing pad' },
    { value: 'canyon', description: 'Desert canyon with rock formations' }
];
// Color palettes for BabiaXR
const COLOR_PALETTES = [
    { value: 'ubuntu', description: 'Ubuntu style colors (default)' },
    { value: 'blues', description: 'Variations of blue colors' },
    { value: 'foxy', description: 'Firefox palette with oranges and blues' },
    { value: 'sunny', description: 'Bright, sunny colors' },
    { value: 'reds', description: 'Variations of red colors' },
    { value: 'yellow', description: 'Yellow to orange gradient' },
    { value: 'teals', description: 'Teal and blue colors' },
    { value: 'pink', description: 'Pink and purple colors' },
    { value: 'greens', description: 'Variations of green colors' },
    { value: 'gray', description: 'Grayscale palette' },
    { value: 'colorful', description: 'Diverse vibrant colors' },
    { value: 'category10', description: 'D3 category10 palette' },
    { value: 'category20', description: 'Extended to 20 colors with more variety' },
    { value: 'pastel1', description: 'Soft colors, ideal for non-aggressive visualizations' },
    { value: 'pastel2', description: 'Another soft variant' },
    { value: 'dark2', description: 'Intense colors, but less saturated' },
    { value: 'set1', description: 'Bright and vibrant colors' },
    { value: 'set2', description: 'Medium tone colors' },
    { value: 'set3', description: 'More colors, somewhat softer' },
    { value: 'tableau10', description: 'Modern palette, accessible and high contrast' }
];
/**
 * Registers all BabiaXR-related commands
 * @param context Extension context for storage
 * @param treeDataProvider The main tree data provider
 * @returns Array of disposables for registered commands
 */
function registerBabiaCommands(context, treeDataProvider) {
    const disposables = [];
    // Command to create BabiaXR visualization
    disposables.push(vscode.commands.registerCommand('integracionvsaframe.createBabiaXRVisualization', async (chartType) => {
        try {
            // Collect chart data from user - pass context
            const chartData = await (0, dataCollector_1.collectChartData)(chartType, context);
            if (!chartData) {
                return; // User canceled
            }
            // Use default values for options instead of asking
            const defaultOptions = getDefaultOptionsForChartType(chartType);
            // Combine data and options
            const combinedData = {
                ...chartData,
                position: defaultOptions.position,
                scale: defaultOptions.scale,
                rotation: defaultOptions.rotation,
                height: defaultOptions.height
            };
            // Generate visualization
            const filePath = await (0, chartManager_1.createBabiaXRVisualization)(chartType, combinedData, context);
            if (filePath) {
                // Ask if user wants to start server
                const startServer = await vscode.window.showInformationMessage(`Visualization created at ${path.basename(filePath)}. Do you want to view it in WebXR?`, 'Yes', 'No');
                if (startServer === 'Yes') {
                    await (0, chartManager_1.launchBabiaXRVisualization)(filePath, context);
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error creating visualization: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
    // Command to set background color
    disposables.push(vscode.commands.registerCommand('integracionvsaframe.setBabiaBackgroundColor', async () => {
        try {
            const backgroundColor = await (0, colorPickerUtils_1.showColorPicker)('Select Background Color', context.globalState.get('babiaBackgroundColor') || '#112233');
            if (backgroundColor) {
                await context.globalState.update('babiaBackgroundColor', backgroundColor);
                treeDataProvider.refresh();
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error updating background color: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
    // Command to set environment preset
    disposables.push(vscode.commands.registerCommand('integracionvsaframe.setBabiaEnvironmentPreset', async () => {
        try {
            const environmentPreset = await vscode.window.showQuickPick(ENVIRONMENT_PRESETS.map(preset => ({
                label: preset.value,
                description: preset.description
            })), {
                placeHolder: 'Select environment preset',
                matchOnDescription: true // Allow searching in the descriptions
            });
            if (environmentPreset) {
                await context.globalState.update('babiaEnvironmentPreset', environmentPreset.label);
                treeDataProvider.refresh();
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error updating environment preset: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
    // Command to set ground color
    disposables.push(vscode.commands.registerCommand('integracionvsaframe.setBabiaGroundColor', async () => {
        try {
            const groundColor = await (0, colorPickerUtils_1.showColorPicker)('Select Ground Color', context.globalState.get('babiaGroundColor') || '#445566');
            if (groundColor) {
                await context.globalState.update('babiaGroundColor', groundColor);
                treeDataProvider.refresh();
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error updating ground color: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
    // Command to set chart palette
    disposables.push(vscode.commands.registerCommand('integracionvsaframe.setBabiaChartPalette', async () => {
        try {
            const chartPalette = await vscode.window.showQuickPick(COLOR_PALETTES.map(palette => ({
                label: palette.value,
                description: palette.description
            })), {
                placeHolder: 'Select chart color palette',
                matchOnDescription: true
            });
            if (chartPalette) {
                await context.globalState.update('babiaChartPalette', chartPalette.label);
                treeDataProvider.refresh();
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error updating chart palette: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
    return disposables;
}
/**
 * Returns default options for a chart type without asking the user
 */
function getDefaultOptionsForChartType(chartType) {
    // Default position based on chart type
    let position = "0 1.6 -2";
    let scale = "1 1 1";
    let rotation = undefined;
    let height = undefined;
    switch (chartType) {
        case chartModel_1.ChartType.PIE_CHART:
        case chartModel_1.ChartType.DONUT_CHART:
            position = "0 1.6 -2";
            scale = "2 2 2";
            rotation = "-90 0 0";
            break;
        case chartModel_1.ChartType.BARS_CHART:
            position = "0 0 -2";
            scale = "1 1 1";
            height = "5";
            break;
        case chartModel_1.ChartType.CYLS_CHART:
            position = "0 0 -2";
            scale = "1 1 1";
            height = "5";
            break;
        case chartModel_1.ChartType.BARSMAP_CHART:
            position = "0 0 -3";
            scale = "1 1 1";
            height = "5";
            break;
    }
    return {
        position,
        scale,
        rotation,
        height
    };
}
//# sourceMappingURL=babiaCommands.js.map