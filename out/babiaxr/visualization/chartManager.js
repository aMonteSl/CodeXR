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
exports.createBabiaXRVisualization = createBabiaXRVisualization;
exports.launchBabiaXRVisualization = launchBabiaXRVisualization;
const vscode = __importStar(require("vscode"));
const serverManager_1 = require("../../server/serverManager");
const templateManager_1 = require("../templates/templateManager");
const fileManager_1 = require("../templates/fileManager");
const serverModel_1 = require("../../server/models/serverModel");
/**
 * Creates an HTML file with a BabiaXR visualization based on the selected template
 * @param chartType The type of chart to create
 * @param chartData Data for the chart
 * @param context Extension context
 * @returns Path to the created file or undefined if operation was cancelled
 */
async function createBabiaXRVisualization(chartType, chartData, context) {
    try {
        // Get saved environment configurations
        const environmentConfig = {
            backgroundColor: context.globalState.get('babiaBackgroundColor') || '#112233',
            environmentPreset: context.globalState.get('babiaEnvironmentPreset') || 'forest',
            groundColor: context.globalState.get('babiaGroundColor') || '#445566',
            chartPalette: context.globalState.get('babiaChartPalette') || 'ubuntu'
        };
        // Add environment configuration to chart data
        chartData.environment = environmentConfig;
        // Extraer opciones de posición, escala, rotación y altura si existen
        const chartOptions = {
            position: chartData.position || "0 1.6 -2",
            scale: chartData.scale || "1 1 1",
            rotation: chartData.rotation,
            // Gestión de conversión segura de height a número
            height: typeof chartData.height === 'string'
                ? (isNaN(parseFloat(chartData.height)) ? undefined : parseFloat(chartData.height))
                : chartData.height
        };
        // Create a chart specification object
        const chartSpec = {
            type: chartType,
            data: chartData,
            options: chartOptions // Añadir las opciones requeridas
        };
        // Process template with the chart specification
        const { html, originalDataPath, isRemoteData } = await (0, templateManager_1.processTemplate)(context, chartSpec);
        // Get sanitized filename from chart title
        const fileName = `${chartData.title.replace(/\s+/g, '-')}.html`;
        // Save the HTML content to a file, passing the original data path if available
        const filePath = await (0, fileManager_1.saveHtmlToFile)(html, fileName, originalDataPath, isRemoteData);
        if (!filePath) {
            return undefined; // User cancelled the operation
        }
        // Open the file in the editor
        await vscode.window.showTextDocument(vscode.Uri.file(filePath));
        return filePath;
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error creating visualization: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}
/**
 * Launches a server with the created BabiaXR visualization
 * @param filePath Path to the HTML file
 * @param context Extension context
 */
async function launchBabiaXRVisualization(filePath, context) {
    try {
        console.log(`🚀 Launching BabiaXR visualization: ${filePath}`);
        // Get the currently configured server mode
        const serverMode = context.globalState.get('serverMode') || serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS;
        console.log(`🔧 Using server mode: ${serverMode}`);
        // Use the new createServer function from serverManager
        const serverInfo = await (0, serverManager_1.createServer)(filePath, serverMode, context);
        if (serverInfo) {
            console.log(`✅ BabiaXR visualization server started successfully: ${serverInfo.url}`);
            // Open the visualization in the default browser
            await vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
            // Show success message
            vscode.window.showInformationMessage(`🚀 BabiaXR visualization launched at ${serverInfo.displayUrl}`, 'View in Browser').then(selection => {
                if (selection === 'View in Browser') {
                    vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
                }
            });
        }
        else {
            throw new Error('Failed to create server for BabiaXR visualization');
        }
    }
    catch (error) {
        console.error('❌ Error launching BabiaXR visualization:', error);
        vscode.window.showErrorMessage(`Error launching visualization: ${error instanceof Error ? error.message : String(error)}`);
    }
}
//# sourceMappingURL=chartManager.js.map