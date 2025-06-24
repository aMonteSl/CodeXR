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
const fs = __importStar(require("fs"));
const colorPickerUtils_1 = require("../utils/colorPickerUtils");
const chartModel_1 = require("../babiaxr/models/chartModel");
const chartManager_1 = require("../babiaxr/visualization/chartManager");
const dataCollector_1 = require("../babiaxr/visualization/dataCollector");
const visualizationConfig_1 = require("../babiaxr/config/visualizationConfig");
const serverModel_1 = require("../server/models/serverModel");
const serverManager_1 = require("../server/serverManager");
const fileWatchManager_1 = require("../analysis/fileWatchManager");
const workspaceUtils_1 = require("../utils/workspaceUtils");
/**
 * Registers all BabiaXR-related commands
 * @param context Extension context for storage
 * @param treeDataProvider The main tree data provider
 * @returns Array of disposables for registered commands
 */
function registerBabiaCommands(context, treeDataProvider) {
    const disposables = [];
    // Command to create visualization
    disposables.push(vscode.commands.registerCommand('codexr.createVisualization', async (chartType) => {
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
                // Get the JSON data path from chart data
                const jsonDataPath = chartData.dataSource;
                // Get FileWatchManager instance
                const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
                if (fileWatchManager && jsonDataPath) {
                    // Register the JSON file for watching
                    fileWatchManager.watchVisualizationDataFile(jsonDataPath, filePath);
                }
                // Ask if user wants to start server
                const startServer = await vscode.window.showInformationMessage(`Visualization created at ${path.basename(filePath)}. Do you want to view it in WebXR?`, 'Yes', 'No');
                if (startServer === 'Yes') {
                    await (0, chartManager_1.launchBabiaXRVisualization)(filePath, context);
                }
                // Automatically open the visualization folder as the workspace
                const folderPath = path.dirname(filePath);
                vscode.window.showInformationMessage(`Opening visualization folder in workspace: ${path.basename(folderPath)}`);
                await (0, workspaceUtils_1.openFolderInWorkspace)(folderPath, false);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error creating visualization: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
    // Command to set background color
    disposables.push(vscode.commands.registerCommand('codexr.setBackgroundColor', async () => {
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
    disposables.push(vscode.commands.registerCommand('codexr.setEnvironmentPreset', async () => {
        try {
            const environmentPreset = await vscode.window.showQuickPick(visualizationConfig_1.ENVIRONMENT_PRESETS.map(preset => ({
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
    disposables.push(vscode.commands.registerCommand('codexr.setGroundColor', async () => {
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
    disposables.push(vscode.commands.registerCommand('codexr.setChartPalette', async () => {
        try {
            const chartPalette = await vscode.window.showQuickPick(visualizationConfig_1.COLOR_PALETTES.map(palette => ({
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
    // Command to launch a BabiaXR example
    disposables.push(vscode.commands.registerCommand('codexr.launchBabiaXRExample', async (examplePath) => {
        try {
            // First verify that the example file exists
            if (!examplePath) {
                vscode.window.showErrorMessage('No example path provided');
                return;
            }
            console.log(`🚀 Attempting to launch example at: ${examplePath}`);
            // ✅ VERIFICAR QUE EL ARCHIVO EXISTE
            if (!fs.existsSync(examplePath)) {
                vscode.window.showErrorMessage(`Example file not found: ${examplePath}`);
                console.error(`❌ File not found: ${examplePath}`);
                // ✅ LISTAR ARCHIVOS DISPONIBLES PARA DEBUG
                const exampleDir = path.dirname(examplePath);
                if (fs.existsSync(exampleDir)) {
                    console.log(`📁 Available files in ${exampleDir}:`);
                    try {
                        const files = fs.readdirSync(exampleDir);
                        files.forEach(file => console.log(`  - ${file}`));
                    }
                    catch (error) {
                        console.error(`Error reading directory ${exampleDir}:`, error);
                    }
                }
                else {
                    console.error(`Directory does not exist: ${exampleDir}`);
                }
                return;
            }
            // ✅ USAR LA CARPETA DEL EJEMPLO COMO ROOT DEL SERVIDOR
            const exampleDir = path.dirname(examplePath);
            const fileName = path.basename(examplePath);
            console.log(`📁 Using example directory as server root: ${exampleDir}`);
            console.log(`📄 Example file name: ${fileName}`);
            // ✅ VERIFICAR QUE EL DIRECTORIO EXISTE
            if (!fs.existsSync(exampleDir)) {
                vscode.window.showErrorMessage(`Example directory not found: ${exampleDir}`);
                return;
            }
            // ✅ LISTAR CONTENIDO DEL DIRECTORIO PARA DEBUG
            try {
                const files = fs.readdirSync(exampleDir);
                console.log(`📁 Example directory contains ${files.length} items:`);
                files.forEach(file => console.log(`  - ${file}`));
            }
            catch (err) {
                console.error(`❌ Error reading example directory: ${err}`);
                return;
            }
            // ✅ CREAR SERVIDOR CON EL DIRECTORIO DEL EJEMPLO COMO ROOT
            const serverInfo = await (0, serverManager_1.createServer)(exampleDir, // ✅ USAR EL DIRECTORIO DEL EJEMPLO, NO EL ROOT DE EXAMPLES
            serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS, context);
            if (serverInfo) {
                // ✅ LA URL ES SIMPLEMENTE EL NOMBRE DEL ARCHIVO HTML
                const url = `${serverInfo.url}/${fileName}`;
                console.log(`✅ Example server created successfully`);
                console.log(`🌐 Opening example URL: ${url}`);
                // Open the example in the default browser
                await vscode.env.openExternal(vscode.Uri.parse(url));
                // Show success message
                vscode.window.showInformationMessage(`🚀 BabiaXR example "${path.basename(fileName, '.html')}" launched at ${url}`, 'View in Browser').then(selection => {
                    if (selection === 'View in Browser') {
                        vscode.env.openExternal(vscode.Uri.parse(url));
                    }
                });
            }
            else {
                vscode.window.showErrorMessage('Failed to start server for BabiaXR example');
            }
        }
        catch (error) {
            console.error('❌ Error launching BabiaXR example:', error);
            vscode.window.showErrorMessage(`Error launching example: ${error instanceof Error ? error.message : String(error)}`);
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
            position = "0 2.5 -2";
            rotation = "90 0 0";
            break;
        case chartModel_1.ChartType.BARS_CHART:
            position = "0 1.6 -2";
            break;
        case chartModel_1.ChartType.CYLS_CHART:
            position = "0 1.6 -2";
            break;
        // ✅ ADDED: Bubbles chart configuration
        case chartModel_1.ChartType.BUBBLES_CHART:
            position = "0 1.6 -2";
            scale = "1.2 1.2 1.2"; // Slightly smaller scale for bubbles
            break;
        case chartModel_1.ChartType.BARSMAP_CHART:
            position = "0 1.6 -2";
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