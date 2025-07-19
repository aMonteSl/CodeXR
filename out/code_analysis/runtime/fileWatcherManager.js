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
exports.FileWatcherManager = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const activeAnalysisRegistry_1 = require("../active_analyses/registry/activeAnalysisRegistry");
const statusBarDelayTimer_1 = require("./statusBarDelayTimer");
const analysisSettingsStorage_1 = require("../../utils/analysisSettingsStorage");
const analysisCommands_1 = require("../commands/analysisCommands");
const tempStorageManager_1 = require("../utils/tempStorageManager");
const SSEManager_1 = require("../../servers/runtime/sse/SSEManager");
/**
 * Manages file watchers for files under analysis
 * Detects changes to analyzed files and shows placeholder info messages
 */
class FileWatcherManager {
    context;
    static instance = null;
    watchers = new Map();
    registry;
    delayTimer;
    constructor(context) {
        this.context = context;
        console.log('[FILE_WATCHER_MANAGER] Initializing file watcher manager');
        this.registry = activeAnalysisRegistry_1.ActiveAnalysisRegistry.getInstance();
        this.delayTimer = statusBarDelayTimer_1.StatusBarDelayTimer.getInstance();
        // Listen for changes in active analyses to manage watchers
        this.registry.onDidChangeAnalyses(() => {
            this.updateWatchers();
        });
    }
    /**
     * Get the singleton instance of the file watcher manager
     */
    static getInstance(context) {
        if (!FileWatcherManager.instance && context) {
            FileWatcherManager.instance = new FileWatcherManager(context);
        }
        else if (!FileWatcherManager.instance) {
            throw new Error('FileWatcherManager requires context for initialization');
        }
        return FileWatcherManager.instance;
    }
    /**
     * Update watchers based on current active analyses
     */
    updateWatchers() {
        console.log('[FILE_WATCHER_MANAGER] Updating file watchers');
        const analyses = this.registry.getAllAnalyses();
        const currentFiles = new Set();
        // Collect all files that should be watched
        analyses.forEach(analysis => {
            if (analysis.status === 'running' || analysis.status === 'completed') {
                if (!analysis.id.startsWith('dir-')) {
                    // Only watch individual files, not directories for now
                    currentFiles.add(analysis.path);
                }
            }
        });
        // Remove watchers for files no longer in active analyses
        for (const [filePath, watcher] of this.watchers) {
            if (!currentFiles.has(filePath)) {
                console.log(`[FILE_WATCHER_MANAGER] Removing watcher for ${filePath}`);
                watcher.dispose();
                this.watchers.delete(filePath);
            }
        }
        // Add watchers for new files
        for (const filePath of currentFiles) {
            if (!this.watchers.has(filePath)) {
                this.addWatcher(filePath);
            }
        }
        console.log(`[FILE_WATCHER_MANAGER] Now watching ${this.watchers.size} files`);
    }
    /**
     * Add a file watcher for a specific file
     */
    addWatcher(filePath) {
        console.log(`[FILE_WATCHER_MANAGER] Adding watcher for ${filePath}`);
        try {
            // Create a watcher for the specific file
            const pattern = new vscode.RelativePattern(path.dirname(filePath), path.basename(filePath));
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);
            // Handle file changes
            watcher.onDidChange((uri) => {
                this.onFileChanged(uri.fsPath);
            });
            // Handle file saves (more reliable than onChange for some editors)
            watcher.onDidCreate((uri) => {
                this.onFileChanged(uri.fsPath);
            });
            // Handle file deletion
            watcher.onDidDelete((uri) => {
                this.onFileDeleted(uri.fsPath);
            });
            this.watchers.set(filePath, watcher);
            this.context.subscriptions.push(watcher);
        }
        catch (error) {
            console.error(`[FILE_WATCHER_MANAGER] Error creating watcher for ${filePath}:`, error);
        }
    }
    /**
     * Handle file change events with auto-analysis delay
     */
    async onFileChanged(filePath) {
        console.log(`[FILE_WATCHER_MANAGER] File changed: ${filePath}`);
        // Get analyses for this file
        const analyses = this.registry.getAnalysesForPath(filePath);
        if (analyses.length === 0) {
            return;
        }
        // Get the current auto-analysis delay setting
        const delayMs = await analysisSettingsStorage_1.AnalysisSettingsStorage.getAutoAnalysisDelay(this.context);
        const fileName = path.basename(filePath);
        console.log(`[FILE_WATCHER_MANAGER] Starting auto-analysis delay: ${delayMs}ms for ${fileName}`);
        // Start or restart the delay timer
        const uri = vscode.Uri.file(filePath);
        this.delayTimer.start(uri, delayMs, () => {
            this.executeDelayedAnalysis(filePath, analyses);
        });
    }
    /**
     * Execute the analysis after the delay has completed
     * Supports both Static and XR analysis modes
     */
    async executeDelayedAnalysis(filePath, analyses) {
        const fileName = path.basename(filePath);
        console.log(`[FILE_WATCHER_MANAGER] 🔄 Executing delayed re-analysis for ${fileName}`);
        console.log(`[FILE_WATCHER_MANAGER] Found ${analyses.length} analysis(es) for this file`);
        // Group analyses by mode
        const staticAnalyses = analyses.filter(analysis => analysis.mode === 'Static');
        const xrAnalyses = analyses.filter(analysis => analysis.mode === 'XR');
        console.log(`[FILE_WATCHER_MANAGER] Static analyses: ${staticAnalyses.length}, XR analyses: ${xrAnalyses.length}`);
        try {
            let analysisData;
            // Determine which analysis to run based on the modes present
            if (xrAnalyses.length > 0) {
                // Run XR analysis if there are any XR analyses
                console.log(`[FILE_WATCHER_MANAGER] Running XR analysis for ${fileName}...`);
                analysisData = await (0, analysisCommands_1.runXRFileAnalysisCoordinator)(this.context, filePath);
            }
            else if (staticAnalyses.length > 0) {
                // Run static analysis if there are only static analyses
                console.log(`[FILE_WATCHER_MANAGER] Running static analysis for ${fileName}...`);
                analysisData = await (0, analysisCommands_1.executeFileAnalysis)(this.context, filePath);
            }
            else {
                throw new Error('No valid analysis modes found');
            }
            if (!analysisData) {
                throw new Error('Analysis returned no data');
            }
            console.log(`[FILE_WATCHER_MANAGER] ✅ Analysis completed for ${fileName}`);
            // Step 2: Update existing temp folders with new data.json
            console.log(`[FILE_WATCHER_MANAGER] Updating existing data.json files for ${fileName}...`);
            const updatedFolders = await (0, tempStorageManager_1.updateDataJson)(this.context, filePath, analysisData);
            if (updatedFolders.length > 0) {
                console.log(`[FILE_WATCHER_MANAGER] ✅ Updated ${updatedFolders.length} analysis folder(s) for ${fileName}`);
                // Step 3: Send SSE update notification to clients (for both modes)
                console.log(`[FILE_WATCHER_MANAGER] Sending SSE update notification for ${fileName}...`);
                try {
                    SSEManager_1.sseManager.sendUpdate(filePath);
                    console.log(`[FILE_WATCHER_MANAGER] ✅ SSE update notification sent for ${fileName}`);
                }
                catch (sseError) {
                    console.error(`[FILE_WATCHER_MANAGER] ⚠️ Failed to send SSE update for ${fileName}:`, sseError);
                    // Continue with the rest of the process even if SSE fails
                }
                // Show mode-specific success message to user
                const modeInfo = [];
                if (staticAnalyses.length > 0) {
                    modeInfo.push(`${staticAnalyses.length} Static`);
                }
                if (xrAnalyses.length > 0) {
                    modeInfo.push(`${xrAnalyses.length} XR`);
                }
                vscode.window.showInformationMessage(`Analysis updated: ${fileName} (${modeInfo.join(', ')} viewer${updatedFolders.length > 1 ? 's' : ''} refreshed)`, { modal: false });
                // Update analysis status in registry for all modes
                analyses.forEach(analysis => {
                    console.log(`[FILE_WATCHER_MANAGER] Analysis ${analysis.id} (${analysis.mode}) updated due to file change`);
                    // Update the analysis in registry - mark as completed
                    try {
                        this.registry.updateAnalysis(analysis.id, 'completed', 100);
                    }
                    catch (error) {
                        console.log(`[FILE_WATCHER_MANAGER] Could not update analysis status: ${error}`);
                    }
                });
            }
            else {
                console.log(`[FILE_WATCHER_MANAGER] ⚠️ No existing analysis folders found for ${fileName}`);
                // Inform user that no viewers were found to update
                vscode.window.showWarningMessage(`File ${fileName} changed, but no active analysis viewers found to update.`, { modal: false });
            }
        }
        catch (error) {
            console.error(`[FILE_WATCHER_MANAGER] ❌ Failed to execute delayed re-analysis for ${fileName}:`, error);
            // Show error message to user
            vscode.window.showErrorMessage(`Failed to update analysis for ${fileName}: ${error}`, { modal: false });
            // Mark analyses as failed (both modes)
            analyses.forEach(analysis => {
                this.registry.failAnalysis(analysis.id, `Re-analysis failed: ${error}`);
            });
        }
    }
    /**
     * Handle file deletion events
     */
    onFileDeleted(filePath) {
        console.log(`[FILE_WATCHER_MANAGER] File deleted: ${filePath}`);
        // Cancel any pending delay timer for this file
        const uri = vscode.Uri.file(filePath);
        this.delayTimer.cancel(uri);
        // Get analyses for this file
        const analyses = this.registry.getAnalysesForPath(filePath);
        if (analyses.length > 0) {
            const fileName = path.basename(filePath);
            vscode.window.showWarningMessage(`File ${fileName} was deleted. Active analyses for this file will be marked as failed.`);
            // Mark analyses as failed
            analyses.forEach(analysis => {
                this.registry.failAnalysis(analysis.id, `File was deleted: ${filePath}`);
            });
        }
        // Remove the watcher since the file no longer exists
        const watcher = this.watchers.get(filePath);
        if (watcher) {
            watcher.dispose();
            this.watchers.delete(filePath);
        }
    }
    /**
     * Manually add a file to be watched
     */
    watchFile(filePath) {
        console.log(`[FILE_WATCHER_MANAGER] Manually adding file to watch: ${filePath}`);
        if (!this.watchers.has(filePath)) {
            this.addWatcher(filePath);
        }
    }
    /**
     * Manually remove a file from being watched
     */
    unwatchFile(filePath) {
        console.log(`[FILE_WATCHER_MANAGER] Manually removing file from watch: ${filePath}`);
        // Cancel any pending delay timer for this file
        const uri = vscode.Uri.file(filePath);
        this.delayTimer.cancel(uri);
        const watcher = this.watchers.get(filePath);
        if (watcher) {
            watcher.dispose();
            this.watchers.delete(filePath);
        }
    }
    /**
     * Get list of currently watched files
     */
    getWatchedFiles() {
        return Array.from(this.watchers.keys());
    }
    /**
     * Dispose all watchers
     */
    dispose() {
        console.log('[FILE_WATCHER_MANAGER] Disposing all file watchers');
        // Cancel all delay timers
        this.delayTimer.cancelAll();
        for (const [filePath, watcher] of this.watchers) {
            watcher.dispose();
        }
        this.watchers.clear();
    }
}
exports.FileWatcherManager = FileWatcherManager;
//# sourceMappingURL=fileWatcherManager.js.map