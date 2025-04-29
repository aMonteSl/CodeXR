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
exports.createXRVisualization = createXRVisualization;
exports.openXRVisualization = openXRVisualization;
exports.cleanupXRVisualizations = cleanupXRVisualizations;
exports.getVisualizationFolder = getVisualizationFolder;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const xrDataTransformer_1 = require("./xrDataTransformer");
const xrTemplateUtils_1 = require("./xrTemplateUtils");
const serverManager_1 = require("../../server/serverManager");
const serverModel_1 = require("../../server/models/serverModel");
const xrDataFormatter_1 = require("./xrDataFormatter");
const fileWatchManager_1 = require("../fileWatchManager");
// Track visualization paths by file
const visualizationFolders = new Map();
// Track active servers by visualization directory
const activeServers = new Map();
// Track port assignments for each analyzed file
const filePorts = new Map();
let nextAvailablePort = 8080;
/**
 * Creates an XR visualization for a file analysis result
 * @param context Extension context for storage
 * @param analysisResult Result of file analysis
 * @returns Path to the created HTML visualization
 */
async function createXRVisualization(context, analysisResult) {
    try {
        console.log('Creating XR visualization for:', analysisResult.fileName);
        // Get the base name without extension for folder naming
        const fileNameWithoutExt = path.basename(analysisResult.fileName, path.extname(analysisResult.fileName));
        // Check if we already have a visualization folder for this file
        const existingFolder = visualizationFolders.get(fileNameWithoutExt);
        let visualizationDir;
        let isNewFolder = false;
        // Get the visualizations directory
        const visualizationsDir = path.join(context.extensionPath, 'visualizations');
        // Create the visualizations directory if it doesn't exist
        try {
            await fs.mkdir(visualizationsDir, { recursive: true });
        }
        catch (e) {
            console.log('Visualizations directory already exists');
        }
        if (existingFolder) {
            console.log(`Reusing existing visualization folder: ${existingFolder}`);
            visualizationDir = existingFolder;
        }
        else {
            // Create a new folder with simplified naming
            const folderName = `analysis_${fileNameWithoutExt}_${Date.now()}`;
            visualizationDir = path.join(visualizationsDir, folderName);
            // Create directory if it doesn't exist
            try {
                await fs.mkdir(visualizationDir, { recursive: true });
                isNewFolder = true;
            }
            catch (e) {
                // Folder might already exist from a previous session
                console.log(`Folder ${visualizationDir} already exists, reusing it`);
            }
            // Save for future reuse
            visualizationFolders.set(fileNameWithoutExt, visualizationDir);
        }
        console.log(`Visualization directory: ${visualizationDir}`);
        // Transform the analysis data for internal use
        const transformedData = (0, xrDataTransformer_1.transformAnalysisDataForXR)(analysisResult);
        // Apply the formatter to simplify the data structure for BabiaXR
        const babiaCompatibleData = (0, xrDataFormatter_1.formatXRDataForBabia)(transformedData);
        // Save the simplified data as JSON
        const dataFilePath = path.join(visualizationDir, 'data.json');
        await fs.writeFile(dataFilePath, JSON.stringify(babiaCompatibleData, null, 2));
        console.log('Data file saved at:', dataFilePath);
        // Only generate the HTML if this is a new folder or the HTML doesn't exist
        const htmlFilePath = path.join(visualizationDir, 'index.html');
        let htmlExists = false;
        try {
            await fs.access(htmlFilePath);
            htmlExists = true;
        }
        catch (e) {
            // HTML doesn't exist, need to create it
        }
        if (!htmlExists || isNewFolder) {
            // Generate the HTML content with all placeholders replaced
            const htmlContent = await (0, xrTemplateUtils_1.generateXRAnalysisHTML)(analysisResult, './data.json', context);
            // Save the HTML file
            await fs.writeFile(htmlFilePath, htmlContent);
            console.log('HTML file created at:', htmlFilePath);
        }
        else {
            console.log('HTML file already exists, skipping generation');
        }
        // Update the FileWatchManager with the path to this HTML file
        const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
        if (fileWatchManager) {
            fileWatchManager.setXRHtmlPath(analysisResult.filePath, htmlFilePath);
        }
        return htmlFilePath;
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error creating XR visualization: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}
/**
 * Opens an XR visualization in the browser
 * @param htmlFilePath Path to the HTML file
 * @param context Extension context
 * @param filePath Optional path to the analyzed file
 */
async function openXRVisualization(htmlFilePath, context, filePath) {
    try {
        // Debug print for input file path
        console.log('DEBUG - HTML file path:', htmlFilePath);
        // Ensure the htmlFilePath ends with index.html
        let fullHtmlPath = htmlFilePath;
        if (!htmlFilePath.endsWith('.html')) {
            fullHtmlPath = path.join(htmlFilePath, 'index.html');
            console.log('DEBUG - Fixed HTML path:', fullHtmlPath);
        }
        // Get the visualization directory (parent of the HTML file)
        const visualizationDir = path.dirname(fullHtmlPath);
        console.log('DEBUG - Visualization directory:', visualizationDir);
        // Get file name without extension for tracking
        const dirName = path.basename(visualizationDir);
        // Check if we already have an active server for this visualization
        const existingServer = activeServers.get(dirName);
        if (existingServer) {
            console.log(`Using existing server for ${dirName}`);
            // Just open the URL without creating a new server
            const url = `${existingServer.url}/index.html`;
            console.log('DEBUG - Opening URL:', url);
            await vscode.env.openExternal(vscode.Uri.parse(url));
            vscode.window.showInformationMessage(`XR Visualization opened in browser. The server will update automatically when data changes.`);
            return;
        }
        // Get server mode configuration
        const serverMode = context.globalState.get('serverMode') || serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS;
        // Assign a unique port for this file
        let port;
        if (filePath && filePorts.has(filePath)) {
            port = filePorts.get(filePath);
        }
        else {
            port = nextAvailablePort++;
            if (filePath) {
                filePorts.set(filePath, port);
            }
        }
        // Create server with specific port
        const serverInfo = await (0, serverManager_1.createServer)(fullHtmlPath, serverMode, context, port);
        console.log('DEBUG - Server info:', JSON.stringify(serverInfo, null, 2));
        if (!serverInfo) {
            throw new Error('Failed to start server for visualization');
        }
        // Store the server info for future reuse
        activeServers.set(dirName, serverInfo);
        // Build a URL pointing to the index.html file
        const url = `${serverInfo.url}/index.html`;
        console.log('DEBUG - Final URL:', url);
        // Add a notification with the URL for easy debugging
        vscode.window.showInformationMessage(`Opening URL: ${url}`);
        await vscode.env.openExternal(vscode.Uri.parse(url));
        vscode.window.showInformationMessage(`XR Visualization opened in browser. The server will update automatically when data changes.`);
    }
    catch (error) {
        console.error('ERROR in openXRVisualization:', error);
        vscode.window.showErrorMessage(`Error opening XR visualization: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Cleanup visualization servers and tracked folders
 */
function cleanupXRVisualizations() {
    visualizationFolders.clear();
    activeServers.clear();
    filePorts.clear();
    nextAvailablePort = 8080;
}
/**
 * Get visualization folder for a specific file name
 * @param fileName File name without extension
 * @returns Visualization directory path or undefined if not found
 */
function getVisualizationFolder(fileName) {
    return visualizationFolders.get(fileName);
}
//# sourceMappingURL=xrAnalysisManager.js.map