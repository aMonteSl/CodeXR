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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const model_1 = require("./model");
const analysisManager_1 = require("./analysisManager");
const analysisDataManager_1 = require("./analysisDataManager");
const xrAnalysisManager_1 = require("./xr/xrAnalysisManager");
const xrDataTransformer_1 = require("./xr/xrDataTransformer");
const xrDataFormatter_1 = require("./xr/xrDataFormatter");
const liveReloadManager_1 = require("../server/liveReloadManager");
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
            console.log(`🛑 Stopped watching ${path.basename(filePath)}`);
        }
        const timer = this.debounceTimers.get(filePath);
        if (timer) {
            clearTimeout(timer);
            this.debounceTimers.delete(filePath);
        }
        // Clean up XR HTML path
        this.removeXRHtmlPath(filePath);
        // Remove analysis mode
        this.fileAnalysisModes.delete(filePath);
    }
    /**
     * Stop watching all files
     */
    stopWatchingAll() {
        console.log(`🛑 Stopping all file watchers (${this.fileWatchers.size} active)`);
        for (const [filePath, watcher] of this.fileWatchers.entries()) {
            watcher.dispose();
            // Clean up status messages
            const statusMessage = this.statusMessages.get(filePath);
            if (statusMessage) {
                statusMessage.dispose();
            }
        }
        this.fileWatchers.clear();
        // Clear all timers
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        // Clear status messages
        this.statusMessages.clear();
        // Clear analysis modes
        this.fileAnalysisModes.clear();
        // Clean up XR HTML paths
        this.xrHtmlPaths.clear();
        console.log('✅ All file watchers stopped and cleaned up');
    }
    /**
     * Sets the XR HTML path for a file
     * @param filePath Path to the source file
     * @param htmlPath Path to the XR HTML visualization
     */
    setXRHtmlPath(filePath, htmlPath) {
        this.xrHtmlPaths.set(filePath, htmlPath);
        console.log(`📄 Set XR HTML path for ${path.basename(filePath)}: ${htmlPath}`);
    }
    /**
     * Gets the XR HTML path for a file
     * @param filePath Path to the source file
     * @returns HTML path or undefined if not found
     */
    getXRHtmlPath(filePath) {
        return this.xrHtmlPaths.get(filePath);
    }
    /**
     * Removes the XR HTML path for a file
     * @param filePath Path to the source file
     */
    removeXRHtmlPath(filePath) {
        this.xrHtmlPaths.delete(filePath);
        console.log(`🗑️ Removed XR HTML path for ${path.basename(filePath)}`);
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
            // Time verification and analysis
            if (Math.abs(elapsedTime - this.debounceDelay) > 100) {
                console.warn(`⚠️ Actual wait time (${elapsedTime}ms) differs from configured time (${this.debounceDelay}ms)`);
            }
            else {
                console.log(`✅ Wait time matches configured time (${this.debounceDelay}ms)`);
            }
            await this.performFileAnalysis(filePath);
        }, this.debounceDelay));
    }
    /**
     * Performs the actual file analysis
     */
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
                case model_1.AnalysisMode.WEB_VIEW:
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
        if (panel && !panel.disposed) {
            // Send the new data to the panel directly
            console.log('Updating webview panel with new analysis data');
            (0, analysisManager_1.sendAnalysisData)(panel, analysisResult);
            // Update the panel title to show it's updated
            panel.title = `Analysis: ${analysisResult.fileName} (Updated)`;
            console.log('Analysis panel updated with latest data');
            // Show notification to user
            vscode.window.showInformationMessage(`Analysis updated for ${analysisResult.fileName}`, { modal: false });
        }
        else {
            console.log('No active panel found or panel was disposed');
            // Create a new panel if none exists
            if (!panel) {
                console.log('Creating new analysis panel for updated results');
                (0, analysisManager_1.showAnalysisWebView)(this.context, analysisResult);
            }
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
            console.log(`🔮 Re-analyzing ${path.basename(filePath)} for XR update`);
            const analysisResult = await (0, analysisManager_1.analyzeFile)(filePath, this.context);
            if (!analysisResult) {
                console.error('❌ Failed to re-analyze file for XR');
                return;
            }
            // Use the filename from analysis result
            const fileNameWithoutExt = path.basename(analysisResult.fileName, path.extname(analysisResult.fileName));
            // Find existing visualization folder
            const existingFolder = (0, xrAnalysisManager_1.getVisualizationFolder)(fileNameWithoutExt);
            if (existingFolder && fs.existsSync(existingFolder)) {
                console.log(`📁 Updating existing XR visualization in: ${existingFolder}`);
                // Verify data.json file exists
                const dataFilePath = path.join(existingFolder, 'data.json');
                try {
                    // Transform data correctly
                    const transformedData = (0, xrDataTransformer_1.transformAnalysisDataForXR)(analysisResult);
                    const babiaCompatibleData = (0, xrDataFormatter_1.formatXRDataForBabia)(transformedData);
                    console.log(`📊 Transformed data for ${analysisResult.functions.length} functions`);
                    console.log(`📊 Sample function data:`, babiaCompatibleData[0]);
                    console.log(`📊 Full data array length:`, babiaCompatibleData.length);
                    // Write updated data.json file
                    await fs.promises.writeFile(dataFilePath, JSON.stringify(babiaCompatibleData, null, 2));
                    console.log(`✅ Updated XR data file: ${dataFilePath}`);
                    console.log(`📊 File size: ${(await fs.promises.stat(dataFilePath)).size} bytes`);
                    // Verify file was written correctly
                    const writtenContent = await fs.promises.readFile(dataFilePath, 'utf8');
                    const parsedContent = JSON.parse(writtenContent);
                    console.log(`📊 Verified: ${parsedContent.length} functions written to data.json`);
                    console.log(`📊 First function in written file:`, parsedContent[0]);
                    // Single notification - immediate, no delays
                    console.log(`📡 Sending dataRefresh event to clients...`);
                    (0, liveReloadManager_1.notifyClientsDataRefresh)();
                    // Update HTML path in file watch manager
                    const htmlFilePath = path.join(existingFolder, 'index.html');
                    this.setXRHtmlPath(filePath, htmlFilePath);
                    // Simple notification
                    this.notifyXRDataUpdated(filePath);
                    vscode.window.showInformationMessage(`🔮 XR visualization updated for ${analysisResult.fileName}`, { modal: false });
                }
                catch (error) {
                    console.error('❌ Error updating XR data file:', error);
                    vscode.window.showErrorMessage(`Error updating XR data: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            else {
                console.log('❌ No existing XR visualization found, creating new one');
                // If no existing visualization, create a new one
                await (0, xrAnalysisManager_1.createXRVisualization)(this.context, analysisResult);
            }
        }
        catch (error) {
            console.error('❌ Error handling XR re-analysis:', error);
            vscode.window.showErrorMessage(`Error updating XR visualization: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Simple notification for XR data updates
     */
    notifyXRDataUpdated(filePath) {
        const fileName = path.basename(filePath);
        console.log(`📊 XR data updated for: ${fileName}`);
        console.log(`📊 Current time: ${new Date().toISOString()}`);
        console.log(`📊 File path: ${filePath}`);
        // Add more logs for debugging
        const fileNameWithoutExt = path.basename(fileName, path.extname(fileName));
        const existingFolder = (0, xrAnalysisManager_1.getVisualizationFolder)(fileNameWithoutExt);
        if (existingFolder) {
            const dataFilePath = path.join(existingFolder, 'data.json');
            console.log(`📊 Expected data.json path: ${dataFilePath}`);
            try {
                const stats = fs.statSync(dataFilePath);
                console.log(`📊 data.json last modified: ${stats.mtime.toISOString()}`);
                console.log(`📊 data.json size: ${stats.size} bytes`);
            }
            catch (error) {
                console.error(`❌ Error checking data.json stats:`, error);
            }
        }
    }
    /**
     * Watch a visualization data file for changes
     * @param jsonFilePath Path to the JSON data file to watch
     * @param htmlFilePath Path to the HTML file that uses the data
     */
    watchVisualizationDataFile(jsonFilePath, htmlFilePath) {
        if (!jsonFilePath || !fs.existsSync(jsonFilePath)) {
            console.warn(`JSON file not found: ${jsonFilePath}`);
            return;
        }
        console.log(`Setting up file watcher for visualization data: ${jsonFilePath}`);
        // Watch for changes to the JSON file
        const jsonWatcher = fs.watch(jsonFilePath, (eventType) => {
            if (eventType === 'change') {
                console.log(`📊 Data file changed: ${path.basename(jsonFilePath)}`);
                // Replace with simple notification
                this.notifyVisualizationDataChanged(jsonFilePath);
            }
        });
        // Watch for changes to the HTML file
        if (htmlFilePath && fs.existsSync(htmlFilePath)) {
            const htmlWatcher = fs.watch(htmlFilePath, (eventType) => {
                if (eventType === 'change') {
                    console.log(`📄 HTML file changed: ${path.basename(htmlFilePath)}`);
                    // Replace with simple notification
                    this.notifyVisualizationChanged(htmlFilePath);
                }
            });
            // Store both watchers
            this.fileWatchers.set(htmlFilePath, { dispose: () => htmlWatcher.close() });
        }
        // Store the JSON watcher
        this.fileWatchers.set(jsonFilePath, { dispose: () => jsonWatcher.close() });
    }
    /**
     * Simple notification for data changes
     */
    notifyVisualizationDataChanged(filePath) {
        console.log(`📊 Visualization data changed: ${path.basename(filePath)}`);
        // File change detected - browsers with live reload will automatically refresh
    }
    /**
     * Simple notification for HTML changes
     */
    notifyVisualizationChanged(filePath) {
        console.log(`📄 Visualization HTML changed: ${path.basename(filePath)}`);
        // File change detected - browsers with live reload will automatically refresh
    }
}
exports.FileWatchManager = FileWatchManager;
//# sourceMappingURL=fileWatchManager.js.map