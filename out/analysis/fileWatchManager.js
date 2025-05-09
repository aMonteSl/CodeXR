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
const fs = __importStar(require("fs"));
const analysisManager_1 = require("./analysisManager");
const xrAnalysisManager_1 = require("./xr/xrAnalysisManager");
const model_1 = require("./model");
const analysisDataManager_1 = require("./analysisDataManager");
const liveReloadManager_1 = require("../server/liveReloadManager");
const xrDataTransformer_1 = require("./xr/xrDataTransformer");
const xrDataFormatter_1 = require("./xr/xrDataFormatter");
const analysisManager_2 = require("./analysisManager");
const liveReloadManager_2 = require("../server/liveReloadManager");
/**
 * Manages file watchers for analyzed files
 */
class FileWatchManager {
    static instance;
    context;
    // Store multiple file watchers by file path
    fileWatchers = new Map();
    // Track analysis mode for each file
    fileAnalysisModes = new Map();
    // Track XR HTML paths for each analyzed file
    xrHtmlPaths = new Map();
    debounceTimers = new Map();
    debounceDelay = 2000; // Default to 2 seconds
    autoAnalysisEnabled = true; // Default to enabled
    // Store status messages for each file
    statusMessages = new Map();
    // Allow adjusting the debounce delay
    /**
     * Sets the debounce delay for file watching
     * @param delay Delay in milliseconds before triggering analysis
     */
    setDebounceDelay(delay) {
        console.log(`⏱️ Changing debounce time from ${this.debounceDelay}ms to ${delay}ms`);
        this.debounceDelay = delay;
        // Apply the new delay to all active timers
        for (const [filePath, timer] of this.debounceTimers.entries()) {
            console.log(`⏱️ Reconfiguring timer for ${path.basename(filePath)} with new delay: ${delay}ms`);
            clearTimeout(timer);
            // Reconfigure with new delay if file is still being watched
            if (this.fileAnalysisModes.has(filePath)) {
                const mode = this.fileAnalysisModes.get(filePath);
                // Start new timer with updated delay
                this.debounceTimers.set(filePath, setTimeout(async () => {
                    console.log(`⏱️ Running analysis for ${path.basename(filePath)} after reconfiguring to ${delay}ms`);
                    await this.performFileAnalysis(filePath);
                }, delay));
            }
        }
    }
    // Allow toggling auto-analysis
    setAutoAnalysis(enabled) {
        console.log(`Setting auto-analysis to ${enabled}`);
        this.autoAnalysisEnabled = enabled;
    }
    /**
     * Gets the singleton instance of the FileWatchManager
     * @returns The FileWatchManager instance or undefined if not initialized
     */
    static getInstance() {
        if (!this.instance) {
            this.instance = new FileWatchManager();
        }
        return this.instance;
    }
    /**
     * Initialize the FileWatchManager
     * @param context Extension context
     */
    static initialize(context) {
        if (!this.instance) {
            this.instance = new FileWatchManager();
            this.instance.setContext(context);
        }
        else {
            this.instance.setContext(context);
        }
        // Initialize settings from configuration
        const config = vscode.workspace.getConfiguration();
        const debounceDelay = config.get('codexr.analysis.debounceDelay', 2000);
        const autoAnalysis = config.get('codexr.analysis.autoAnalysis', true);
        // Apply settings
        const instance = this.instance;
        console.log(`⏱️ Initializing FileWatchManager with delay=${debounceDelay}ms from configuration`);
        instance.setDebounceDelay(debounceDelay);
        instance.setAutoAnalysis(autoAnalysis);
        return this.instance;
    }
    constructor() {
        // Load current value from configuration
        const config = vscode.workspace.getConfiguration();
        this.debounceDelay = config.get('codexr.analysis.debounceDelay', 2000);
        console.log(`FileWatchManager initialized with debounce delay: ${this.debounceDelay}ms`);
    }
    /**
     * Set the extension context
     * @param context Extension context
     */
    setContext(context) {
        this.context = context;
    }
    /**
     * Set the analysis mode for a specific file
     * @param filePath Path to the file
     * @param mode Analysis mode
     */
    setAnalysisMode(filePath, mode) {
        this.fileAnalysisModes.set(filePath, mode);
    }
    /**
     * Start watching a file for changes
     * @param filePath Path to the file to watch
     * @param mode Analysis mode
     */
    startWatching(filePath, mode) {
        // Stop watching this file if already being watched
        this.stopWatching(filePath);
        console.log(`Starting to watch ${filePath} in ${mode} mode`);
        // Store the analysis mode for this file
        this.fileAnalysisModes.set(filePath, mode);
        // Setup file watcher for changes
        const watcher = fs.watch(filePath, (eventType) => {
            if (eventType === 'change') {
                console.log(`Detected change in ${filePath}`);
                this.handleFileChange(filePath);
            }
        });
        // Store watcher for disposal later
        this.fileWatchers.set(filePath, { dispose: () => watcher.close() });
    }
    /**
     * Stop watching a file
     * @param filePath Path to the file to stop watching
     */
    stopWatching(filePath) {
        const watcher = this.fileWatchers.get(filePath);
        if (watcher) {
            watcher.dispose();
            this.fileWatchers.delete(filePath);
            console.log(`Stopped watching ${filePath}`);
        }
    }
    /**
     * Stop watching all files
     */
    stopWatchingAll() {
        for (const [filePath, watcher] of this.fileWatchers.entries()) {
            watcher.dispose();
            console.log(`Stopped watching ${filePath}`);
        }
        this.fileWatchers.clear();
    }
    /**
     * Handle file change by re-analyzing it according to the current mode
     * @param filePath Path to the changed file
     */
    async handleFileChange(filePath) {
        // Skip if auto-analysis is disabled
        if (!this.autoAnalysisEnabled) {
            console.log(`Auto-analysis is disabled, ignoring changes to ${filePath}`);
            return;
        }
        // Show the current debounce delay value
        console.log(`⏱️ Debounce delay configured: ${this.debounceDelay}ms for file ${path.basename(filePath)}`);
        // Cancel any pending analysis for this file
        if (this.debounceTimers.has(filePath)) {
            console.log(`⏱️ Cancelling previous timer for ${path.basename(filePath)}`);
            clearTimeout(this.debounceTimers.get(filePath));
            // Clear any previous status message
            if (this.statusMessages.has(filePath)) {
                this.statusMessages.get(filePath)?.dispose();
                this.statusMessages.delete(filePath);
            }
        }
        // Record start time
        const startTime = Date.now();
        const fileName = path.basename(filePath);
        console.log(`⏱️ ${new Date().toLocaleTimeString()} - Starting timer of ${this.debounceDelay}ms for ${fileName}`);
        // Create an interval timer to update the progress bar
        const totalSeconds = Math.round(this.debounceDelay / 1000);
        let secondsRemaining = totalSeconds;
        // Create an initial status bar message
        const initialMessage = vscode.window.setStatusBarMessage(`$(sync~spin) CodeXR: Analysis in ${secondsRemaining}s [${'⬛'.repeat(0)}${'⬜'.repeat(10)}]`);
        // Save the message for later cleanup
        this.statusMessages.set(filePath, initialMessage);
        // Calculate the interval for updating the progress bar (every 10% of total time)
        const updateInterval = Math.max(Math.floor(this.debounceDelay / 10), 100); // minimum 100ms
        // Create an interval to update the progress bar
        const progressInterval = setInterval(() => {
            // Calculate elapsed and remaining time
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, this.debounceDelay - elapsed);
            secondsRemaining = Math.ceil(remaining / 1000);
            // Calculate percentage complete (0-10 for our 10-block bar)
            const percentComplete = Math.min(10, Math.floor((elapsed / this.debounceDelay) * 10));
            // Update progress bar
            if (this.statusMessages.has(filePath)) {
                this.statusMessages.get(filePath)?.dispose();
                const progressBar = '⬛'.repeat(percentComplete) + '⬜'.repeat(10 - percentComplete);
                const newMessage = vscode.window.setStatusBarMessage(`$(sync~spin) CodeXR: Analysis in ${secondsRemaining}s [${progressBar}]`);
                this.statusMessages.set(filePath, newMessage);
            }
            // Stop the interval if time is complete
            if (elapsed >= this.debounceDelay) {
                clearInterval(progressInterval);
            }
        }, updateInterval);
        // Schedule a new analysis after the debounce delay
        this.debounceTimers.set(filePath, setTimeout(async () => {
            // Clear the progress interval just in case
            clearInterval(progressInterval);
            // Clear countdown message
            if (this.statusMessages.has(filePath)) {
                this.statusMessages.get(filePath)?.dispose();
                this.statusMessages.delete(filePath);
            }
            // Calculate elapsed time and show analysis message
            const elapsedTime = Date.now() - startTime;
            vscode.window.setStatusBarMessage(`$(microscope) CodeXR: Analyzing ${fileName}...`, 3000);
            console.log(`⏱️ ${new Date().toLocaleTimeString()} - Timer triggered after ${elapsedTime}ms`);
            // Time verification and analysis (existing code)...
            if (Math.abs(elapsedTime - this.debounceDelay) > 100) {
                console.warn(`⚠️ Actual wait time (${elapsedTime}ms) differs from configured time (${this.debounceDelay}ms)`);
            }
            else {
                console.log(`✅ Wait time matches configured time (${this.debounceDelay}ms)`);
            }
            await this.performFileAnalysis(filePath);
        }, this.debounceDelay));
    }
    // Extrae el código de análisis actual a este método
    async performFileAnalysis(filePath) {
        if (!this.context) {
            console.error('FileWatchManager: Context not set');
            return;
        }
        const mode = this.fileAnalysisModes.get(filePath) || model_1.AnalysisMode.STATIC;
        console.log(`FileWatchManager: Re-analyzing file ${filePath} in mode ${mode}`);
        try {
            switch (mode) {
                case model_1.AnalysisMode.STATIC:
                    // Re-analyze and display in static mode (webview)
                    await this.handleStaticReanalysis(filePath);
                    break;
                case model_1.AnalysisMode.XR:
                    // Re-analyze and update XR visualization
                    await this.handleXRReanalysis(filePath);
                    break;
                default:
                    console.log(`FileWatchManager: Unknown analysis mode ${mode}`);
            }
        }
        catch (error) {
            console.error('Error handling file change:', error);
            vscode.window.showErrorMessage(`Error updating analysis: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Handle re-analysis in static mode
     * @param filePath Path to the file to re-analyze
     */
    async handleStaticReanalysis(filePath) {
        if (!this.context) {
            return;
        }
        console.log(`Re-analyzing ${filePath} for static visualization update`);
        const analysisResult = await (0, analysisManager_1.analyzeFile)(filePath, this.context);
        if (!analysisResult) {
            console.error('Failed to re-analyze file');
            return;
        }
        // Update the stored analysis result
        analysisDataManager_1.analysisDataManager.setAnalysisResult(filePath, analysisResult);
        // Get the active webview panel
        const panel = analysisDataManager_1.analysisDataManager.getActiveFileAnalysisPanel(filePath);
        if (panel) {
            // Send the new data to the panel directly
            (0, analysisManager_2.sendAnalysisData)(panel, analysisResult);
            console.log('Analysis panel updated with latest data');
        }
        else {
            console.log('No active panel found or panel was disposed');
            // Fallback to command-based update
            vscode.commands.executeCommand('codexr.updateAnalysisPanel', analysisResult, filePath);
        }
    }
    /**
     * Handle re-analysis in XR mode
     * @param filePath Path to the file to re-analyze
     */
    async handleXRReanalysis(filePath) {
        if (!this.context) {
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
                // Use fs.writeFileSync to avoid potential issues
                try {
                    fs.writeFileSync(dataFilePath, JSON.stringify(babiaCompatibleData, null, 2));
                    console.log(`✅ Data file updated at: ${dataFilePath} with ${babiaCompatibleData.length} items`);
                    // Notify connected clients
                    (0, liveReloadManager_1.notifyClientsAnalysisUpdated)();
                    console.log('✅ Notification sent to clients to update visualization');
                    vscode.window.showInformationMessage('XR visualization updated without exiting AR/VR');
                }
                catch (writeError) {
                    console.error(`Error writing data.json: ${writeError}`);
                    vscode.window.showErrorMessage(`Error updating data.json: ${writeError}`);
                }
            }
            else {
                console.log('No existing visualization folder found, creating new visualization');
                // Create new visualization
                const htmlFilePath = await (0, xrAnalysisManager_1.createXRVisualization)(this.context, analysisResult);
                if (htmlFilePath) {
                    await (0, xrAnalysisManager_1.openXRVisualization)(htmlFilePath, this.context);
                }
            }
        }
        catch (error) {
            console.error('Error updating XR visualization:', error);
            vscode.window.showErrorMessage(`Error updating XR visualization: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Update the XR HTML path for a specific file
     * @param filePath Path to the analyzed file
     * @param htmlPath Path to the XR HTML file
     */
    setXRHtmlPath(filePath, htmlPath) {
        this.xrHtmlPaths.set(filePath, htmlPath);
    }
    /**
     * Get the XR HTML path for a specific file
     * @param filePath Path to the analyzed file
     * @returns Path to the XR HTML file
     */
    getXRHtmlPath(filePath) {
        return this.xrHtmlPaths.get(filePath);
    }
    /**
     * Watch a visualization data file for changes
     * @param jsonFilePath Path to the JSON data file to watch
     * @param htmlFilePath Path to the HTML file that uses the data
     */
    watchVisualizationDataFile(jsonFilePath, htmlFilePath) {
        if (!jsonFilePath || !fs.existsSync(jsonFilePath)) {
            console.error(`Cannot watch non-existent JSON file: ${jsonFilePath}`);
            return;
        }
        console.log(`Setting up file watcher for visualization data: ${jsonFilePath}`);
        // Watch for changes to the JSON file
        const jsonWatcher = fs.watch(jsonFilePath, (eventType) => {
            if (eventType === 'change') {
                console.log(`JSON file changed: ${jsonFilePath}`);
                // Notify clients to refresh their data
                (0, liveReloadManager_1.notifyClientsDataRefresh)();
            }
        });
        // Watch for changes to the HTML file
        if (htmlFilePath && fs.existsSync(htmlFilePath)) {
            const htmlWatcher = fs.watch(htmlFilePath, (eventType) => {
                if (eventType === 'change') {
                    console.log(`HTML file changed: ${htmlFilePath}`);
                    // Notify clients to reload the page
                    (0, liveReloadManager_2.notifyClients)();
                }
            });
            // Store the watcher
            this.fileWatchers.set(htmlFilePath, { dispose: () => htmlWatcher.close() });
        }
        // Store the JSON watcher
        this.fileWatchers.set(jsonFilePath, { dispose: () => jsonWatcher.close() });
    }
}
exports.FileWatchManager = FileWatchManager;
//# sourceMappingURL=fileWatchManager.js.map