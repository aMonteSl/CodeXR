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
exports.FileWatchManager = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs")); // Regular fs for existsSync and watch
const fsPromises = __importStar(require("fs/promises")); // Use separate import for promises
const analysisManager_1 = require("./analysisManager");
const xrAnalysisManager_1 = require("./xr/xrAnalysisManager");
const model_1 = require("./model");
const analysisDataManager_1 = require("./analysisDataManager");
const liveReloadManager_1 = require("../server/liveReloadManager");
const xrDataTransformer_1 = require("./xr/xrDataTransformer");
const xrDataFormatter_1 = require("./xr/xrDataFormatter");
const serverManager_1 = require("../server/serverManager"); // Import missing function
const analysisManager_2 = require("./analysisManager");
/**
 * Manages file watchers for analyzed files
 */
class FileWatchManager {
    context;
    static instance;
    fileWatcher;
    currentFilePath;
    lastXRHtmlPath; // Store the path to the last XR HTML file
    currentMode = model_1.AnalysisMode.STATIC; // Default mode
    /**
     * Gets the singleton instance of the FileWatchManager
     * @returns The FileWatchManager instance or undefined if not initialized
     */
    static getInstance() {
        return FileWatchManager.instance;
    }
    /**
     * Initialize the FileWatchManager
     * @param context Extension context
     */
    static initialize(context) {
        if (!FileWatchManager.instance) {
            FileWatchManager.instance = new FileWatchManager(context);
        }
        return FileWatchManager.instance;
    }
    constructor(context) {
        this.context = context;
        // Set as the singleton instance
        FileWatchManager.instance = this;
    }
    /**
     * Set the extension context
     * @param context Extension context
     */
    setContext(context) {
        this.context = context;
        console.log('FileWatchManager: Context set');
    }
    /**
     * Set the current analysis mode
     * @param mode Analysis mode
     */
    setAnalysisMode(mode) {
        this.currentMode = mode;
        console.log(`FileWatchManager: Analysis mode set to ${mode}`);
    }
    /**
     * Start watching a file for changes
     * @param filePath Path to the file to watch
     * @param mode Analysis mode to use for re-analysis
     */
    startWatching(filePath, mode) {
        // Stop any existing watcher
        this.stopWatching();
        if (!this.context) {
            console.error('FileWatchManager: Context not set');
            return;
        }
        // Update current mode if provided
        if (mode) {
            this.currentMode = mode;
        }
        console.log(`FileWatchManager: Starting to watch ${filePath} in mode ${this.currentMode}`);
        // Store the current file path
        this.currentFilePath = filePath;
        // Create a new file watcher for the specific file
        const filePattern = new vscode.RelativePattern(path.dirname(filePath), path.basename(filePath));
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(filePattern);
        // Register change event - REEMPLAZA ESTA PARTE SI ES DIFERENTE
        this.fileWatcher.onDidChange(async (uri) => {
            console.log(`FileWatchManager: Detected change in ${uri.fsPath}`);
            // Only trigger re-analysis if the changed file is the one we're watching
            if (uri.fsPath === this.currentFilePath) {
                console.log('FileWatchManager: File matched, re-analyzing...');
                await this.handleFileChange(uri.fsPath);
            }
            else {
                console.log(`FileWatchManager: File doesn't match current (${this.currentFilePath}), ignoring change`);
            }
        });
        // Add the watcher to disposables for proper cleanup
        this.context.subscriptions.push(this.fileWatcher);
    }
    /**
     * Stop watching the current file
     */
    stopWatching() {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = undefined;
            console.log('FileWatchManager: Stopped watching file');
        }
        this.currentFilePath = undefined;
    }
    /**
     * Handle file change by re-analyzing it according to the current mode
     * @param filePath Path to the changed file
     */
    async handleFileChange(filePath) {
        if (!this.context) {
            console.error('FileWatchManager: Context not set');
            return;
        }
        console.log(`FileWatchManager: Re-analyzing file ${filePath} in mode ${this.currentMode}`);
        try {
            switch (this.currentMode) {
                case model_1.AnalysisMode.STATIC:
                    // Re-analyze and display in static mode (webview)
                    await this.handleStaticReanalysis(filePath);
                    break;
                case model_1.AnalysisMode.XR:
                    // Re-analyze and update XR visualization
                    await this.handleXRReanalysis(filePath);
                    break;
                default:
                    console.log(`FileWatchManager: Unknown analysis mode ${this.currentMode}`);
            }
        }
        catch (error) {
            console.error('Error during re-analysis:', error);
            vscode.window.showErrorMessage(`Error during automatic re-analysis: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Handle re-analysis in static mode
     * @param filePath Path to the file to re-analyze
     */
    async handleStaticReanalysis(filePath) {
        if (!this.context) {
            console.error('No context available for static reanalysis');
            return;
        }
        console.log(`Re-analyzing file in static mode: ${filePath}`);
        // Re-analyze the file using the existing analyze function
        const analysisResult = await (0, analysisManager_1.analyzeFile)(filePath, this.context);
        if (!analysisResult) {
            console.error('Failed to re-analyze file for static visualization');
            return;
        }
        // Store the updated result in the analysisDataManager
        analysisDataManager_1.analysisDataManager.setAnalysisResult(analysisResult);
        // Get the active panel reference
        const panel = analysisDataManager_1.analysisDataManager.getActiveFileAnalysisPanel();
        if (panel && !panel.disposed) {
            console.log('Sending update directly to existing analysis panel');
            // Send the new data to the panel directly
            (0, analysisManager_2.sendAnalysisData)(panel, analysisResult);
            // Also log that update was sent for debugging
            console.log('Analysis panel updated with latest data');
        }
        else {
            console.log('No active panel found or panel was disposed');
            // Fallback to command-based update (though it likely won't work if panel is gone)
            vscode.commands.executeCommand('codexr.updateAnalysisPanel', analysisResult);
        }
    }
    /**
     * Handle re-analysis in XR mode
     * @param filePath Path to the file to re-analyze
     */
    async handleXRReanalysis(filePath) {
        if (!this.context) {
            console.error('No context available for XR reanalysis');
            return;
        }
        try {
            console.log(`🔄 Re-analyzing file ${filePath} for XR update...`);
            const analysisResult = await (0, analysisManager_1.analyzeFile)(filePath, this.context);
            if (!analysisResult) {
                console.error('❌ Failed to re-analyze file for XR visualization');
                return;
            }
            // Get the file name without extension for folder lookup
            const fileNameWithoutExt = path.basename(analysisResult.fileName, path.extname(analysisResult.fileName));
            // Look up the existing visualization folder
            const existingFolder = (0, xrAnalysisManager_1.getVisualizationFolder)(fileNameWithoutExt);
            if (existingFolder) {
                console.log(`Found existing visualization folder: ${existingFolder}`);
                // Path to the existing data.json file
                const dataFilePath = path.join(existingFolder, 'data.json');
                console.log(`Updating data.json at: ${dataFilePath}`);
                // Transform the analysis data for XR visualization
                console.log(`Analysis result contains ${analysisResult.functions.length} functions`);
                const transformedData = (0, xrDataTransformer_1.transformAnalysisDataForXR)(analysisResult);
                console.log('Transformed data for XR');
                let babiaCompatibleData = (0, xrDataFormatter_1.formatXRDataForBabia)(transformedData);
                console.log(`Final formatted data has ${babiaCompatibleData.length} functions`);
                // IMPORTANTE: Usa fs.writeFileSync en lugar de la versión async para evitar problemas
                try {
                    const fs = require('fs');
                    fs.writeFileSync(dataFilePath, JSON.stringify(babiaCompatibleData, null, 2));
                    console.log(`✅ Data file updated at: ${dataFilePath} with ${babiaCompatibleData.length} items`);
                    // Notificar a los clientes conectados
                    (0, liveReloadManager_1.notifyClientsAnalysisUpdated)();
                    console.log('✅ Notificación enviada a los clientes para actualizar visualización');
                    vscode.window.showInformationMessage('Visualización XR actualizada sin salir de AR/VR');
                }
                catch (writeError) {
                    console.error(`Error al escribir data.json: ${writeError}`);
                    vscode.window.showErrorMessage(`Error al actualizar data.json: ${writeError}`);
                }
            }
            else {
                console.log('No se encontró una carpeta de visualización existente, creando nueva visualización');
                // Crear nueva visualización
                const htmlFilePath = await (0, xrAnalysisManager_1.createXRVisualization)(this.context, analysisResult);
                if (htmlFilePath) {
                    await (0, xrAnalysisManager_1.openXRVisualization)(htmlFilePath, this.context);
                }
            }
        }
        catch (error) {
            console.error('Error updating XR visualization:', error);
            vscode.window.showErrorMessage(`Error al actualizar visualización XR: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Update the last XR HTML path
     * @param htmlPath Path to the XR HTML file
     */
    setLastXRHtmlPath(htmlPath) {
        this.lastXRHtmlPath = htmlPath;
    }
    /**
     * Get the last XR HTML path
     * @returns Path to the last XR HTML file
     */
    getLastXRHtmlPath() {
        return this.lastXRHtmlPath;
    }
    /**
     * Watch a JSON data file for a manually created visualization
     * @param jsonFilePath Path to the JSON data file
     * @param htmlFilePath Path to the HTML visualization file
     */
    watchVisualizationDataFile(jsonFilePath, htmlFilePath) {
        if (!fs.existsSync(jsonFilePath)) {
            console.error(`Cannot watch non-existent data file: ${jsonFilePath}`);
            return;
        }
        console.log(`🔍 Setting up watcher for visualization data file: ${jsonFilePath}`);
        // Create a file watcher for the JSON data file using Node's fs.watch
        const watcher = fs.watch(jsonFilePath, (eventType, filename) => {
            if (eventType === 'change') {
                console.log(`📊 Visualization data file changed: ${jsonFilePath}`);
                // Use an immediately invoked async function to handle async operations
                (async () => {
                    try {
                        // Read the file to ensure it's a valid JSON
                        const data = await fsPromises.readFile(jsonFilePath, 'utf8');
                        JSON.parse(data); // This will throw if invalid JSON
                        // Find active servers serving this HTML file
                        const activeServers = (0, serverManager_1.getActiveServers)().filter((server) => path.dirname(server.filePath) === path.dirname(htmlFilePath));
                        if (activeServers.length > 0) {
                            console.log(`🔄 Notifying clients to refresh visualization data for ${path.basename(htmlFilePath)}`);
                            (0, liveReloadManager_1.notifyClientsDataRefresh)();
                        }
                        else {
                            console.log(`ℹ️ No active servers found for ${htmlFilePath}, data refresh notification skipped`);
                        }
                    }
                    catch (error) {
                        console.error(`❌ Error processing visualization data update: ${error instanceof Error ? error.message : String(error)}`);
                    }
                })();
            }
        });
        // Store the watcher for cleanup on extension deactivation
        if (this.context) {
            this.context.subscriptions.push({
                dispose: () => {
                    if (watcher) {
                        watcher.close();
                    }
                }
            });
        }
    }
}
exports.FileWatchManager = FileWatchManager;
//# sourceMappingURL=fileWatchManager.js.map