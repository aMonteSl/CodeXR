"use strict";
exports.id = 2;
exports.ids = [2];
exports.modules = {

/***/ 241:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


/**
 * VisualizeDOM Watcher
 * Monitors HTML files for changes and triggers real-time re-analysis using the new engine
 */
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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VisualizeDOMWatcher = void 0;
const vscode = __importStar(__webpack_require__(1));
const fs = __importStar(__webpack_require__(6));
const path = __importStar(__webpack_require__(5));
const sessionRegistry_1 = __webpack_require__(119);
const VisualizeDOMRequirements_1 = __webpack_require__(130);
const saveFiles_1 = __webpack_require__(132);
const SSEManager_1 = __webpack_require__(18);
class VisualizeDOMWatcher {
    static activeWatchers = new Map();
    static DEBOUNCE_MS = 1000; // 1 second debounce
    /**
     * Start watching HTML file for changes
     */
    static async startWatching(sessionId, htmlFilePath, outputDirectory, context) {
        try {
            console.log(`🔍 VISUALIZE_DOM_WATCHER: Starting to watch HTML file: ${htmlFilePath}`);
            console.log(`🔍 VISUALIZE_DOM_WATCHER: Session ID: ${sessionId}`);
            console.log(`🔍 VISUALIZE_DOM_WATCHER: Output directory: ${outputDirectory}`);
            // Check if file exists
            if (!fs.existsSync(htmlFilePath)) {
                console.error(`🔍 VISUALIZE_DOM_WATCHER: HTML file does not exist: ${htmlFilePath}`);
                return '';
            }
            // Check if output directory exists
            if (!fs.existsSync(outputDirectory)) {
                console.error(`🔍 VISUALIZE_DOM_WATCHER: Output directory does not exist: ${outputDirectory}`);
                return '';
            }
            // Create unique watcher ID
            const watcherId = `visualizedom_${path.basename(htmlFilePath)}_${Date.now()}`;
            // Create file watcher
            const watcher = fs.watch(htmlFilePath, { persistent: true }, async (eventType, filename) => {
                if (eventType === 'change') {
                    console.log(`🔍 VISUALIZE_DOM_WATCHER: HTML file change detected: ${htmlFilePath}`);
                    console.log(`🔍 VISUALIZE_DOM_WATCHER: Event type: ${eventType}, filename: ${filename}`);
                    // Get current watcher info for debouncing
                    const currentWatcherInfo = VisualizeDOMWatcher.activeWatchers.get(watcherId);
                    if (!currentWatcherInfo) {
                        console.error(`🔍 VISUALIZE_DOM_WATCHER: Watcher info not found for ID: ${watcherId}`);
                        return;
                    }
                    // Clear existing debounce timeout
                    if (currentWatcherInfo.debounceTimeout) {
                        clearTimeout(currentWatcherInfo.debounceTimeout);
                    }
                    // Check if we processed this change too recently
                    const now = Date.now();
                    if (currentWatcherInfo.lastProcessedTime &&
                        (now - currentWatcherInfo.lastProcessedTime) < VisualizeDOMWatcher.DEBOUNCE_MS) {
                        console.log(`🔍 VISUALIZE_DOM_WATCHER: Skipping duplicate change event (too recent): ${htmlFilePath}`);
                        return;
                    }
                    // Set up debounced execution
                    currentWatcherInfo.debounceTimeout = setTimeout(async () => {
                        try {
                            console.log(`🔍 VISUALIZE_DOM_WATCHER: Executing debounced re-analysis for: ${htmlFilePath}`);
                            currentWatcherInfo.lastProcessedTime = Date.now();
                            // Update session status to analyzing
                            const registry = sessionRegistry_1.UnifiedSessionRegistry.getInstance(context);
                            registry.updateSessionStatus(sessionId, 'analyzing', 50);
                            // Re-execute VisualizeDOM analysis
                            await VisualizeDOMWatcher.reExecuteVisualizeDOMAnalysis(sessionId, htmlFilePath, outputDirectory, context);
                        }
                        catch (error) {
                            console.error(`🔍 VISUALIZE_DOM_WATCHER: Error re-executing VisualizeDOM analysis:`, error);
                            // Update session status to error
                            const registry = sessionRegistry_1.UnifiedSessionRegistry.getInstance(context);
                            registry.updateSessionStatus(sessionId, 'error', 0, `VisualizeDOM re-analysis failed: ${error instanceof Error ? error.message : String(error)}`);
                            vscode.window.showErrorMessage(`HTML visualization update failed: ${error instanceof Error ? error.message : String(error)}`);
                        }
                    }, VisualizeDOMWatcher.DEBOUNCE_MS);
                    console.log(`🔍 VISUALIZE_DOM_WATCHER: Debounce timer set for: ${htmlFilePath} (${VisualizeDOMWatcher.DEBOUNCE_MS}ms)`);
                }
            });
            // Store watcher info
            const watcherInfo = {
                watcher,
                sessionId,
                htmlFilePath,
                outputDirectory,
                context,
                lastProcessedTime: undefined,
                debounceTimeout: undefined
            };
            VisualizeDOMWatcher.activeWatchers.set(watcherId, watcherInfo);
            console.log(`🔍 VISUALIZE_DOM_WATCHER: Successfully started watching with ID: ${watcherId}`);
            console.log(`🔍 VISUALIZE_DOM_WATCHER: Total active VisualizeDOM watchers: ${VisualizeDOMWatcher.activeWatchers.size}`);
            return watcherId;
        }
        catch (error) {
            console.error(`🔍 VISUALIZE_DOM_WATCHER: Error starting HTML file watcher:`, error);
            vscode.window.showErrorMessage(`Error starting HTML file watcher: ${error instanceof Error ? error.message : String(error)}`);
            return '';
        }
    }
    /**
     * Re-execute VisualizeDOM analysis when HTML file changes
     */
    static async reExecuteVisualizeDOMAnalysis(sessionId, htmlFilePath, outputDirectory, context) {
        try {
            console.log(`🔄 VISUALIZE_DOM_WATCHER: Re-executing VisualizeDOM analysis for: ${htmlFilePath}`);
            const registry = sessionRegistry_1.UnifiedSessionRegistry.getInstance(context);
            const session = registry.getSession(sessionId);
            if (!session) {
                throw new Error(`Session ${sessionId} not found`);
            }
            // ========================================
            // STEP 1: GET PROCESSED FILES FROM PROCESSOR
            // ========================================
            console.log(`🔧 VISUALIZE_DOM_WATCHER: STEP 1 - Getting fresh processed files from VisualizeDOMRequirements...`);
            const visualizeDOMRequirements = new VisualizeDOMRequirements_1.VisualizeDOMRequirements(context);
            const processedFiles = await visualizeDOMRequirements.getRequiredFiles(session);
            console.log(`✅ VISUALIZE_DOM_WATCHER: Received ${processedFiles.loadedFiles.size} processed template files`);
            // Verify we have files
            if (processedFiles.loadedFiles.size === 0) {
                throw new Error('No processed files received from VisualizeDOMRequirements');
            }
            // Log received files
            console.log(`📋 VISUALIZE_DOM_WATCHER: Files received from processor:`);
            for (const [fileName, content] of processedFiles.loadedFiles) {
                console.log(`📄 VISUALIZE_DOM_WATCHER: ${fileName} (${content.length} chars)`);
            }
            // ===================================
            // STEP 2: SAVE FILES WITH SAVEFILES
            // ===================================
            console.log(`💾 VISUALIZE_DOM_WATCHER: STEP 2 - Saving updated files to storage...`);
            const saveFiles = new saveFiles_1.SaveFiles();
            const folderName = 'visualizeDOMAnalysis';
            const savedPath = await saveFiles.saveFilesToStorage(processedFiles.loadedFiles, folderName, session.outputDirectory, context);
            console.log(`✅ VISUALIZE_DOM_WATCHER: Files successfully saved to: ${savedPath}`);
            // Update session with new save information
            session.savedFilesPath = savedPath;
            // Update stored files in session for compatibility
            session.requiredFiles.clear();
            for (const [fileName, content] of processedFiles.loadedFiles) {
                session.requiredFiles.set(fileName, content);
            }
            // ===============================================
            // STEP 3: SEND SSE UPDATE TO CLIENTS
            // ===============================================
            console.log(`📡 VISUALIZE_DOM_WATCHER: STEP 3 - Sending SSE update to clients...`);
            try {
                // Extract HTML content for SSE message
                let htmlContent = '';
                const indexHtml = processedFiles.loadedFiles.get('index.html');
                if (indexHtml) {
                    // Try to extract the htmlContent from the index.html or use the original HTML file
                    htmlContent = await fs.promises.readFile(htmlFilePath, 'utf-8');
                }
                console.log(`📡 VISUALIZE_DOM_WATCHER: Sending SSE htmlUpdated message...`);
                console.log(`📡 VISUALIZE_DOM_WATCHER: HTML content length: ${htmlContent.length}`);
                // Send SSE update using the SSEManager
                SSEManager_1.sseManager.sendCustomMessage(htmlFilePath, {
                    type: 'htmlUpdated',
                    htmlContent: htmlContent,
                    action: 'reload-html',
                    message: 'HTML DOM content has been updated'
                });
                console.log(`✅ VISUALIZE_DOM_WATCHER: SSE update sent successfully`);
            }
            catch (sseError) {
                console.warn(`⚠️ VISUALIZE_DOM_WATCHER: Failed to send SSE update (non-critical):`, sseError);
            }
            // =======================================================
            // STEP 4: UPDATE SESSION STATUS TO MONITORING - SUCCESS
            // =======================================================
            console.log(`🎯 VISUALIZE_DOM_WATCHER: STEP 4 - Finalizing session update...`);
            registry.updateSessionStatus(sessionId, 'monitoring', 100);
            session.status = 'monitoring';
            console.log(`🎉 VISUALIZE_DOM_WATCHER: VisualizeDOM re-analysis completed successfully!`);
            console.log(`🎉 VISUALIZE_DOM_WATCHER: Session ${sessionId} updated with ${processedFiles.loadedFiles.size} files`);
            console.log(`🎉 VISUALIZE_DOM_WATCHER: Files saved to: ${savedPath}`);
            // Show success message
            vscode.window.showInformationMessage(`🌐 HTML DOM visualization updated for: ${path.basename(htmlFilePath)}`);
        }
        catch (error) {
            console.error(`❌ VISUALIZE_DOM_WATCHER: Error in reExecuteVisualizeDOMAnalysis:`, error);
            throw error;
        }
    }
    /**
     * Stop watching a specific HTML file
     */
    static stopWatching(watcherId) {
        try {
            const watcherInfo = VisualizeDOMWatcher.activeWatchers.get(watcherId);
            if (!watcherInfo) {
                console.log(`🔍 VISUALIZE_DOM_WATCHER: Watcher not found with ID: ${watcherId}`);
                return false;
            }
            // Clear debounce timeout if it exists
            if (watcherInfo.debounceTimeout) {
                clearTimeout(watcherInfo.debounceTimeout);
            }
            // Close the watcher
            watcherInfo.watcher.close();
            // Remove from active watchers
            VisualizeDOMWatcher.activeWatchers.delete(watcherId);
            console.log(`🔍 VISUALIZE_DOM_WATCHER: Stopped watching HTML file: ${watcherInfo.htmlFilePath}`);
            console.log(`🔍 VISUALIZE_DOM_WATCHER: Remaining active VisualizeDOM watchers: ${VisualizeDOMWatcher.activeWatchers.size}`);
            return true;
        }
        catch (error) {
            console.error(`🔍 VISUALIZE_DOM_WATCHER: Error stopping watcher:`, error);
            return false;
        }
    }
    /**
     * Stop all active VisualizeDOM watchers
     */
    static stopAllWatchers() {
        try {
            console.log(`🔍 VISUALIZE_DOM_WATCHER: Stopping all ${VisualizeDOMWatcher.activeWatchers.size} active VisualizeDOM watchers`);
            for (const [watcherId, watcherInfo] of VisualizeDOMWatcher.activeWatchers) {
                // Clear debounce timeout
                if (watcherInfo.debounceTimeout) {
                    clearTimeout(watcherInfo.debounceTimeout);
                }
                // Close watcher
                watcherInfo.watcher.close();
                console.log(`🔍 VISUALIZE_DOM_WATCHER: Stopped watcher: ${watcherId} (${watcherInfo.htmlFilePath})`);
            }
            // Clear all watchers
            VisualizeDOMWatcher.activeWatchers.clear();
            console.log(`🔍 VISUALIZE_DOM_WATCHER: All VisualizeDOM watchers stopped successfully`);
        }
        catch (error) {
            console.error(`🔍 VISUALIZE_DOM_WATCHER: Error stopping all watchers:`, error);
        }
    }
    /**
     * Get active watcher count
     */
    static getActiveWatcherCount() {
        return VisualizeDOMWatcher.activeWatchers.size;
    }
    /**
     * Get active watcher info
     */
    static getActiveWatchers() {
        return new Map(VisualizeDOMWatcher.activeWatchers);
    }
}
exports.VisualizeDOMWatcher = VisualizeDOMWatcher;


/***/ })

};
;
//# sourceMappingURL=2.extension.js.map