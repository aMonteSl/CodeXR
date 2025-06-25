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
// ✅ NEW: Import DOM visualization manager
const htmlDomParser_1 = require("./html/htmlDomParser");
const domVisualizationManager_1 = require("./html/domVisualizationManager");
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
    // ✅ NEW: Track DOM HTML paths for each analyzed HTML file
    domHtmlPaths = new Map();
    debounceTimers = new Map();
    debounceDelay = 2000; // Default to 2 seconds
    autoAnalysisEnabled = true; // Default to enabled
    // Store status messages for each file
    statusMessages = new Map();
    // ✅ NEW: Track countdown intervals for visual feedback
    countdownIntervals = new Map();
    /**
     * ✅ NEW: Updates status message for a specific file with countdown
     * @param filePath Path to the file
     * @param message New status message
     * @param showCountdown Whether to show countdown timer
     */
    updateStatusMessage(filePath, message, showCountdown = false) {
        // Clear existing message and countdown
        this.clearStatusMessage(filePath);
        if (showCountdown) {
            // Start countdown display
            this.startCountdownDisplay(filePath, this.debounceDelay);
        }
        else {
            // Set simple message
            const statusMessage = vscode.window.setStatusBarMessage(message);
            this.statusMessages.set(filePath, statusMessage);
            // Clear the message after 3 seconds
            setTimeout(() => {
                this.clearStatusMessage(filePath);
            }, 3000);
        }
    }
    /**
     * ✅ NEW: Starts countdown display for a file
     * @param filePath Path to the file
     * @param totalTime Total countdown time in milliseconds
     */
    startCountdownDisplay(filePath, totalTime) {
        const fileName = path.basename(filePath);
        const startTime = Date.now();
        let lastDisplayedSeconds = Math.ceil(totalTime / 1000);
        // Initial status message
        const initialMessage = vscode.window.setStatusBarMessage(`$(clock) CodeXR: Analyzing ${fileName} in ${lastDisplayedSeconds}s...`);
        this.statusMessages.set(filePath, initialMessage);
        // Start countdown interval (update every 100ms for smooth countdown)
        const countdownInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, totalTime - elapsed);
            const remainingSeconds = Math.ceil(remaining / 1000);
            // Update display only when seconds change
            if (remainingSeconds !== lastDisplayedSeconds && remaining > 0) {
                lastDisplayedSeconds = remainingSeconds;
                // Clear previous message
                if (this.statusMessages.has(filePath)) {
                    this.statusMessages.get(filePath)?.dispose();
                }
                // Create progress bar effect
                const progress = Math.round(((totalTime - remaining) / totalTime) * 10);
                const progressBar = '█'.repeat(progress) + '░'.repeat(10 - progress);
                // Show updated countdown with progress bar
                const countdownMessage = vscode.window.setStatusBarMessage(`$(sync~spin) CodeXR: ${fileName} analysis in ${remainingSeconds}s ${progressBar}`);
                this.statusMessages.set(filePath, countdownMessage);
            }
            // Clear countdown when time is up
            if (remaining <= 0) {
                clearInterval(countdownInterval);
                this.countdownIntervals.delete(filePath);
                // Show "analyzing now" message
                if (this.statusMessages.has(filePath)) {
                    this.statusMessages.get(filePath)?.dispose();
                }
                const analyzingMessage = vscode.window.setStatusBarMessage(`$(microscope) CodeXR: Analyzing ${fileName} now...`);
                this.statusMessages.set(filePath, analyzingMessage);
            }
        }, 100); // Update every 100ms for smooth countdown
        this.countdownIntervals.set(filePath, countdownInterval);
    }
    /**
     * ✅ ENHANCED: Clears status message and countdown for a specific file
     * @param filePath Path to the file
     */
    clearStatusMessage(filePath) {
        // Clear countdown interval
        if (this.countdownIntervals.has(filePath)) {
            clearInterval(this.countdownIntervals.get(filePath));
            this.countdownIntervals.delete(filePath);
        }
        // Clear status message
        if (this.statusMessages.has(filePath)) {
            this.statusMessages.get(filePath)?.dispose();
            this.statusMessages.delete(filePath);
        }
    }
    // Allow adjusting the debounce delay
    /**
     * Sets the debounce delay for file watching
     * @param delay Delay in milliseconds before triggering analysis
     */
    setDebounceDelay(delay) {
        console.log(`⏱️ Changing debounce delay from ${this.debounceDelay}ms to ${delay}ms`);
        // ✅ VALIDATE INPUT
        if (delay < 100 || delay > 10000) {
            console.warn(`⚠️ Invalid delay value: ${delay}ms. Must be between 100-10000ms`);
            return;
        }
        const oldDelay = this.debounceDelay;
        this.debounceDelay = delay;
        // ✅ UPDATE ALL ACTIVE TIMERS WITH NEW DELAY
        const activeTimerCount = this.debounceTimers.size;
        if (activeTimerCount > 0) {
            console.log(`🔄 Updating ${activeTimerCount} active timers with new delay`);
            // ✅ STORE FILES THAT NEED TIMER UPDATES
            const filesToRestart = [];
            // Cancel all existing timers and collect file paths
            for (const [filePath, timer] of this.debounceTimers.entries()) {
                const fileName = path.basename(filePath);
                console.log(`⏹️ Cancelling existing timer for ${fileName}`);
                clearTimeout(timer);
                filesToRestart.push(filePath);
            }
            // Clear the timer map
            this.debounceTimers.clear();
            // ✅ RESTART TIMERS WITH NEW DELAY FOR ALL ACTIVE FILES
            for (const filePath of filesToRestart) {
                if (this.fileAnalysisModes.has(filePath)) {
                    const fileName = path.basename(filePath);
                    console.log(`🆕 Starting new timer for ${fileName} with ${delay}ms delay`);
                    // ✅ RESTART COUNTDOWN: Show updated countdown with new delay
                    this.updateStatusMessage(filePath, '', true);
                    // ✅ CREATE NEW TIMER WITH UPDATED DELAY
                    this.debounceTimers.set(filePath, setTimeout(async () => {
                        console.log(`⏰ Timer completed for ${fileName} after ${delay}ms (updated delay)`);
                        this.debounceTimers.delete(filePath);
                        // Clear countdown
                        this.clearStatusMessage(filePath);
                        // Show analysis starting message
                        vscode.window.setStatusBarMessage(`$(microscope) CodeXR: Analyzing ${fileName}...`, 3000);
                        await this.performFileAnalysis(filePath);
                    }, delay));
                }
            }
            console.log(`✅ Updated ${filesToRestart.length} timers from ${oldDelay}ms to ${delay}ms`);
        }
        else {
            console.log(`📝 No active timers to update. New delay ${delay}ms will apply to future file changes.`);
        }
        // ✅ SHOW USER FEEDBACK
        vscode.window.setStatusBarMessage(`$(clock) CodeXR: Auto-analysis delay updated to ${delay}ms`, 3000);
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
        console.log(`🛑 Stopping file watcher for: ${path.basename(filePath)}`);
        const watcher = this.fileWatchers.get(filePath);
        if (watcher) {
            console.log(`🔌 Disposing file watcher for ${filePath}`);
            watcher.dispose();
            this.fileWatchers.delete(filePath);
        }
        else {
            console.log(`⚠️ No active watcher found for ${filePath}`);
        }
        const timer = this.debounceTimers.get(filePath);
        if (timer) {
            console.log(`⏰ Clearing debounce timer for ${filePath}`);
            clearTimeout(timer);
            this.debounceTimers.delete(filePath);
        }
        // Clean up status message if exists
        const statusMessage = this.statusMessages.get(filePath);
        if (statusMessage) {
            console.log(`📢 Disposing status message for ${filePath}`);
            statusMessage.dispose();
            this.statusMessages.delete(filePath);
        }
        // Clean up XR HTML path
        this.removeXRHtmlPath(filePath);
        // ✅ NEW: Clean up DOM HTML path
        this.removeDOMHtmlPath(filePath);
        // Clean up DOM HTML path
        this.removeDOMHtmlPath(filePath);
        // Remove analysis mode
        this.fileAnalysisModes.delete(filePath);
        console.log(`✅ File watcher cleanup completed for ${path.basename(filePath)}`);
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
        // Clean up DOM HTML paths
        this.domHtmlPaths.clear();
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
     * ✅ NEW: Sets the DOM HTML path for a file
     * @param filePath Path to the source HTML file
     * @param htmlPath Path to the DOM visualization HTML
     */
    setDOMHtmlPath(filePath, htmlPath) {
        this.domHtmlPaths.set(filePath, htmlPath);
        console.log(`📄 Set DOM HTML path for ${path.basename(filePath)}: ${htmlPath}`);
    }
    /**
     * ✅ NEW: Gets the DOM HTML path for a file
     * @param filePath Path to the source HTML file
     * @returns HTML path or undefined if not found
     */
    getDOMHtmlPath(filePath) {
        return this.domHtmlPaths.get(filePath);
    }
    /**
     * ✅ NEW: Removes the DOM HTML path for a file
     * @param filePath Path to the source HTML file
     */
    removeDOMHtmlPath(filePath) {
        this.domHtmlPaths.delete(filePath);
        console.log(`🗑️ Removed DOM HTML path for ${path.basename(filePath)}`);
    }
    /**
     * Handle file change by re-analyzing it according to the current mode
     * @param filePath Path to the changed file
     */
    async handleFileChange(filePath) {
        if (!this.autoAnalysisEnabled) {
            console.log(`⚠️ Auto-analysis disabled for ${path.basename(filePath)}`);
            return;
        }
        const fileName = path.basename(filePath);
        console.log(`📁 File changed: ${fileName}`);
        // Check if file is currently being analyzed
        if (analysisDataManager_1.analysisDataManager.isFileBeingAnalyzed(filePath)) {
            console.log(`⏸️ File ${fileName} is already being analyzed, skipping`);
            return;
        }
        // ✅ CLEAR ANY EXISTING TIMER FOR THIS FILE
        if (this.debounceTimers.has(filePath)) {
            console.log(`🔄 Clearing existing timer for ${fileName}`);
            clearTimeout(this.debounceTimers.get(filePath));
            this.debounceTimers.delete(filePath);
            this.clearStatusMessage(filePath);
        }
        // ✅ USE CURRENT DEBOUNCE DELAY (not a cached value)
        const currentDelay = this.debounceDelay;
        console.log(`⏱️ Setting new timer for ${fileName} with current delay: ${currentDelay}ms`);
        // ✅ SHOW COUNTDOWN: Start visual countdown display
        this.updateStatusMessage(filePath, '', true); // Empty message, countdown will be shown
        // ✅ CREATE NEW TIMER WITH CURRENT DELAY
        this.debounceTimers.set(filePath, setTimeout(async () => {
            console.log(`⏰ Timer completed for ${fileName} after ${currentDelay}ms`);
            this.debounceTimers.delete(filePath);
            // Clear countdown and show analysis starting message
            this.clearStatusMessage(filePath);
            // Show analysis starting message
            vscode.window.setStatusBarMessage(`$(microscope) CodeXR: Analyzing ${fileName}...`, 3000);
            await this.performFileAnalysis(filePath);
        }, currentDelay));
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
                // ✅ NEW: Add DOM analysis mode support
                case model_1.AnalysisMode.DOM:
                    // Re-analyze and update DOM visualization
                    await this.handleDOMReanalysis(filePath);
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
     * ✅ NEW: Handle re-analysis in DOM mode
     * Handle re-analysis in DOM mode for HTML files
     * @param filePath Path to the HTML file to re-analyze
     */
    async handleDOMReanalysis(filePath) {
        if (!this.context) {
            return;
        }
        try {
            console.log(`📄 Re-analyzing ${path.basename(filePath)} for DOM update`);
            // ✅ STEP 1: Parse the HTML file (not code analysis)
            const domAnalysis = await (0, htmlDomParser_1.parseHTMLFile)(filePath);
            if (!domAnalysis) {
                console.error('❌ Failed to parse HTML file for DOM visualization');
                return;
            }
            const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
            // ✅ STEP 2: Find existing DOM visualization folder
            const existingFolder = (0, domVisualizationManager_1.getDOMVisualizationFolder)(fileNameWithoutExt);
            if (existingFolder && fs.existsSync(existingFolder)) {
                console.log(`📁 Updating existing DOM visualization in: ${existingFolder}`);
                // ✅ STEP 3: Check if debounce delay is 0 (special case for testing)
                if (this.debounceDelay === 0) {
                    // For debounce delay 0, we just log a message to browser console
                    const htmlFilePath = path.join(existingFolder, 'index.html');
                    if (fs.existsSync(htmlFilePath)) {
                        try {
                            // Read the existing HTML file
                            let htmlContent = await fs.promises.readFile(htmlFilePath, 'utf-8');
                            // Remove any existing console log scripts to avoid accumulation
                            htmlContent = htmlContent.replace(/<script>\s*console\.log\("First step of the new DOM live-reload characteristic.*?\);\s*<\/script>/gs, '');
                            // Inject a console log message
                            const consoleLogScript = `
                <script>
                  console.log("First step of the new DOM live-reload characteristic working - File: ${domAnalysis.fileName}, Time: ${new Date().toISOString()}");
                </script>
              `;
                            // Insert the script before the closing body tag
                            htmlContent = htmlContent.replace('</body>', `${consoleLogScript}</body>`);
                            // Write the updated HTML file
                            await fs.promises.writeFile(htmlFilePath, htmlContent);
                            console.log(`✅ Updated DOM HTML file with console log: ${htmlFilePath}`);
                            // Notify clients to refresh
                            console.log(`📡 Sending dataRefresh event to clients...`);
                            (0, liveReloadManager_1.notifyClientsDataRefresh)();
                            vscode.window.showInformationMessage(`📄 DOM live-reload test: Check browser console for confirmation message`, { modal: false });
                        }
                        catch (error) {
                            console.error('❌ Error updating DOM HTML file:', error);
                        }
                    }
                }
                else {
                    // ✅ STEP 2: Normal live-reload behavior - Update the babia-html attribute
                    console.log(`📊 DOM live-reload for ${domAnalysis.fileName} - debounce delay: ${this.debounceDelay}ms`);
                    const htmlFilePath = path.join(existingFolder, 'index.html');
                    if (fs.existsSync(htmlFilePath)) {
                        await this.updateDOMVisualizationHTML(htmlFilePath, domAnalysis);
                    }
                }
            }
            else {
                console.log('⚠️ No existing DOM visualization found for live-reload');
                vscode.window.showWarningMessage(`No active DOM visualization found for ${domAnalysis.fileName}. Please create a DOM visualization first.`);
            }
        }
        catch (error) {
            console.error('❌ Error handling DOM re-analysis:', error);
            vscode.window.showErrorMessage(`Error updating DOM visualization: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Updates the DOM visualization HTML file with new HTML content
     * @param htmlFilePath Path to the index.html file in the visualization folder
     * @param domAnalysis The parsed DOM analysis result containing new HTML content
     */
    async updateDOMVisualizationHTML(htmlFilePath, domAnalysis) {
        try {
            // Read the current HTML file
            let htmlContent = await fs.promises.readFile(htmlFilePath, 'utf-8');
            // Prepare the new HTML content for the babia-html attribute
            const newTemplateHTML = (0, htmlDomParser_1.prepareHTMLForTemplate)(domAnalysis);
            // Update the babia-html attribute with the new HTML content
            // Look for the babia-html attribute and replace the html: parameter
            const babiaHtmlRegex = /babia-html='([^']*?)'/;
            const match = htmlContent.match(babiaHtmlRegex);
            if (match) {
                const currentAttribute = match[1];
                // Parse the current attribute to extract and replace the html: parameter
                // Format: 'renderHTML: true; renderHTMLOnlyLeafs: true; distanceLevels: 0.7; html: CONTENT'
                const htmlParamRegex = /html:\s*([^;]*?)(?=;|$)/;
                let newAttribute;
                if (currentAttribute.match(htmlParamRegex)) {
                    // Replace existing html: parameter
                    newAttribute = currentAttribute.replace(htmlParamRegex, `html: ${newTemplateHTML}`);
                }
                else {
                    // Add html: parameter if it doesn't exist
                    newAttribute = `${currentAttribute}; html: ${newTemplateHTML}`;
                }
                // Replace the entire babia-html attribute in the HTML content
                const newBabiaHtml = `babia-html='${newAttribute}'`;
                htmlContent = htmlContent.replace(babiaHtmlRegex, newBabiaHtml);
                // Write the updated HTML file
                await fs.promises.writeFile(htmlFilePath, htmlContent);
                console.log(`✅ Updated DOM visualization HTML content: ${htmlFilePath}`);
                // Notify clients to refresh with the new HTML content
                console.log(`📡 Sending htmlUpdated event to clients...`);
                (0, liveReloadManager_1.notifyClientsHTMLUpdated)(newTemplateHTML);
                vscode.window.showInformationMessage(`📄 DOM visualization updated with latest HTML content from ${domAnalysis.fileName}`, { modal: false });
            }
            else {
                console.error('❌ Could not find babia-html attribute in visualization file');
                vscode.window.showErrorMessage('Could not update DOM visualization: babia-html attribute not found');
            }
        }
        catch (error) {
            console.error('❌ Error updating DOM visualization HTML:', error);
            vscode.window.showErrorMessage(`Error updating DOM visualization: ${error instanceof Error ? error.message : String(error)}`);
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
    /**
     * ✅ NUEVA FUNCIÓN: Verificar si un archivo está siendo observado
     * Check if a file is currently being watched
     * @param filePath Path to the file to check
     * @returns True if the file is being watched, false otherwise
     */
    isWatching(filePath) {
        return this.fileWatchers.has(filePath);
    }
    /**
     * ✅ NUEVA FUNCIÓN: Obtener lista de archivos siendo observados
     * Get list of files currently being watched
     * @returns Array of file paths being watched
     */
    getWatchedFiles() {
        return Array.from(this.fileWatchers.keys());
    }
    /**
     * ✅ NUEVA FUNCIÓN: Obtener estado del watcher para UI
     * Get watcher status for UI display
     * @returns Object with watcher statistics
     */
    getWatcherStatus() {
        // Categorize delay for user-friendly display
        let delayCategory;
        if (this.debounceDelay <= 500) {
            delayCategory = 'Very Fast';
        }
        else if (this.debounceDelay <= 1000) {
            delayCategory = 'Fast';
        }
        else if (this.debounceDelay <= 2000) {
            delayCategory = 'Normal';
        }
        else if (this.debounceDelay <= 3000) {
            delayCategory = 'Slow';
        }
        else {
            delayCategory = 'Very Slow';
        }
        // Get details about active timers with countdown info
        const activeTimerDetails = [];
        for (const [filePath] of this.debounceTimers) {
            const fileName = path.basename(filePath);
            const hasCountdown = this.countdownIntervals.has(filePath);
            activeTimerDetails.push({
                file: fileName,
                remainingTime: `${this.debounceDelay}ms`,
                hasCountdown
            });
        }
        return {
            totalWatchers: this.fileWatchers.size,
            activeTimers: this.debounceTimers.size,
            watchedFiles: Array.from(this.fileWatchers.keys()),
            autoAnalysisEnabled: this.autoAnalysisEnabled,
            debounceDelay: this.debounceDelay,
            delayCategory,
            activeTimerDetails
        };
    }
    /**
     * ✅ ENHANCED: Stop all watchers and clear countdowns
     */
    stopAllWatchers() {
        console.log('🛑 Stopping all file watchers...');
        // Clear all countdown intervals
        for (const [filePath, interval] of this.countdownIntervals) {
            clearInterval(interval);
            console.log(`⏹️ Cleared countdown for ${path.basename(filePath)}`);
        }
        this.countdownIntervals.clear();
        // Clear all timers
        for (const [filePath, timer] of this.debounceTimers) {
            clearTimeout(timer);
            console.log(`⏹️ Cleared timer for ${path.basename(filePath)}`);
        }
        this.debounceTimers.clear();
        // Dispose all watchers
        for (const [filePath, watcher] of this.fileWatchers) {
            watcher.dispose();
            console.log(`🗑️ Disposed watcher for ${path.basename(filePath)}`);
        }
        this.fileWatchers.clear();
        // Clear all status messages
        for (const [filePath, message] of this.statusMessages) {
            message.dispose();
        }
        this.statusMessages.clear();
        // Clear analysis modes
        this.fileAnalysisModes.clear();
        // Clear XR HTML paths
        this.xrHtmlPaths.clear();
        // ✅ NEW: Clear DOM HTML paths
        this.domHtmlPaths.clear();
        // ✅ NEW: Clear DOM HTML paths
        this.domHtmlPaths.clear();
        // Clear DOM HTML paths
        this.domHtmlPaths.clear();
        console.log('✅ All file watchers stopped and cleaned up');
    }
}
exports.FileWatchManager = FileWatchManager;
//# sourceMappingURL=fileWatchManager.js.map