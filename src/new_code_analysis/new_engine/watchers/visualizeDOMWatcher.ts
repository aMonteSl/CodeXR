/**
 * VisualizeDOM Watcher
 * Monitors HTML files for changes and triggers real-time re-analysis using the new engine
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { UnifiedSessionRegistry } from '../core/sessionRegistry';
import { VisualizeDOMRequirements } from '../processors/requirementRules/VisualizeDOMRequirements';
import { SaveFiles } from '../utils/saveFiles';
import { sseManager } from '../../../servers/runtime/sse/SSEManager';
import { ManageDebounceTime, DebounceManager } from '../../../new_code_analysis/legacy_engine/utils/manageDebounceTime';

interface VisualizeDOMWatcherInfo {
    watcher: fs.FSWatcher;
    sessionId: string;
    htmlFilePath: string;
    outputDirectory: string;
    context: vscode.ExtensionContext;
    lastProcessedTime?: number;
    debounceManager?: DebounceManager;
}

export class VisualizeDOMWatcher {
    private static activeWatchers: Map<string, VisualizeDOMWatcherInfo> = new Map();

    /**
     * Get debounce delay from user configuration
     */
    private static async getDebounceDelay(context: vscode.ExtensionContext): Promise<number> {
        return await ManageDebounceTime.getDebounceDelay(context);
    }

    /**
     * Start watching HTML file for changes
     */
    static async startWatching(
        sessionId: string,
        htmlFilePath: string,
        outputDirectory: string,
        context: vscode.ExtensionContext
    ): Promise<string> {
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

                    // Clear existing debounce manager if it exists (this will dispose status bar)
                    if (currentWatcherInfo.debounceManager) {
                        ManageDebounceTime.dispose(currentWatcherInfo.debounceManager);
                        console.log(`🔍 VISUALIZE_DOM_WATCHER: Disposed previous debounce manager for: ${htmlFilePath}`);
                        currentWatcherInfo.debounceManager = undefined;
                    }

                    // Get fresh debounce delay in case user changed it
                    const currentDebounceMs = await VisualizeDOMWatcher.getDebounceDelay(context);

                    // Check if we processed this change too recently (additional protection)
                    const now = Date.now();
                    if (currentWatcherInfo.lastProcessedTime && 
                        (now - currentWatcherInfo.lastProcessedTime) < currentDebounceMs) {
                        console.log(`🔍 VISUALIZE_DOM_WATCHER: Skipping duplicate change event (too recent): ${htmlFilePath}`);
                        return;
                    }

                    // Create new debounce manager for this change
                    const debounceManager = ManageDebounceTime.createDebounceManager(htmlFilePath, currentDebounceMs);
                    currentWatcherInfo.debounceManager = debounceManager;

                    // Set up debounced execution using ManageDebounceTime
                    ManageDebounceTime.setupDebouncedExecution(
                        debounceManager,
                        context,
                        async () => {
                            try {
                                console.log(`🔍 VISUALIZE_DOM_WATCHER: Executing debounced re-analysis for: ${htmlFilePath}`);
                                currentWatcherInfo.lastProcessedTime = Date.now();
                                
                                // Update session status to analyzing
                                const registry = UnifiedSessionRegistry.getInstance(context);
                                registry.updateSessionStatus(sessionId, 'analyzing', 50);
                                
                                // Re-execute VisualizeDOM analysis
                                await VisualizeDOMWatcher.reExecuteVisualizeDOMAnalysis(
                                    sessionId,
                                    htmlFilePath,
                                    outputDirectory,
                                    context
                                );
                                
                            } catch (error) {
                                console.error(`🔍 VISUALIZE_DOM_WATCHER: Error re-executing VisualizeDOM analysis:`, error);
                                
                                // Update session status to error
                                const registry = UnifiedSessionRegistry.getInstance(context);
                                registry.updateSessionStatus(
                                    sessionId, 
                                    'error', 
                                    0, 
                                    `VisualizeDOM re-analysis failed: ${error instanceof Error ? error.message : String(error)}`
                                );
                                
                                vscode.window.showErrorMessage(`HTML visualization update failed: ${error instanceof Error ? error.message : String(error)}`);
                            }
                        }
                    );

                    console.log(`🔍 VISUALIZE_DOM_WATCHER: Debounce timer set for: ${htmlFilePath} (${currentDebounceMs}ms)`);
                }
            });

            // Store watcher info
            const watcherInfo: VisualizeDOMWatcherInfo = {
                watcher,
                sessionId,
                htmlFilePath,
                outputDirectory,
                context,
                lastProcessedTime: undefined,
                debounceManager: undefined
            };

            VisualizeDOMWatcher.activeWatchers.set(watcherId, watcherInfo);

            console.log(`🔍 VISUALIZE_DOM_WATCHER: Successfully started watching with ID: ${watcherId}`);
            console.log(`🔍 VISUALIZE_DOM_WATCHER: Total active VisualizeDOM watchers: ${VisualizeDOMWatcher.activeWatchers.size}`);

            return watcherId;

        } catch (error) {
            console.error(`🔍 VISUALIZE_DOM_WATCHER: Error starting HTML file watcher:`, error);
            vscode.window.showErrorMessage(`Error starting HTML file watcher: ${error instanceof Error ? error.message : String(error)}`);
            return '';
        }
    }

    /**
     * Re-execute VisualizeDOM analysis when HTML file changes
     */
    private static async reExecuteVisualizeDOMAnalysis(
        sessionId: string,
        htmlFilePath: string,
        outputDirectory: string,
        context: vscode.ExtensionContext
    ): Promise<void> {
        try {
            console.log(`🔄 VISUALIZE_DOM_WATCHER: Re-executing VisualizeDOM analysis for: ${htmlFilePath}`);

            const registry = UnifiedSessionRegistry.getInstance(context);
            const session = registry.getSession(sessionId);
            
            if (!session) {
                throw new Error(`Session ${sessionId} not found`);
            }

            // ========================================
            // STEP 1: GET PROCESSED FILES FROM PROCESSOR
            // ========================================
            console.log(`🔧 VISUALIZE_DOM_WATCHER: STEP 1 - Getting fresh processed files from VisualizeDOMRequirements...`);
            
            const visualizeDOMRequirements = new VisualizeDOMRequirements(context);
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
            
            const saveFiles = new SaveFiles();
            const folderName = 'visualizeDOMAnalysis';
            
            const savedPath = await saveFiles.saveFilesToStorage(
                processedFiles.loadedFiles,
                folderName,
                session.outputDirectory,
                context
            );
            
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
                sseManager.sendCustomMessage(htmlFilePath, {
                    type: 'htmlUpdated',
                    htmlContent: htmlContent,
                    action: 'reload-html',
                    message: 'HTML DOM content has been updated'
                });
                
                console.log(`✅ VISUALIZE_DOM_WATCHER: SSE update sent successfully`);
            } catch (sseError) {
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

        } catch (error) {
            console.error(`❌ VISUALIZE_DOM_WATCHER: Error in reExecuteVisualizeDOMAnalysis:`, error);
            throw error;
        }
    }

    /**
     * Stop watching a specific HTML file
     */
    static stopWatching(watcherId: string): boolean {
        try {
            const watcherInfo = VisualizeDOMWatcher.activeWatchers.get(watcherId);
            if (!watcherInfo) {
                console.log(`🔍 VISUALIZE_DOM_WATCHER: Watcher not found with ID: ${watcherId}`);
                return false;
            }

            // Clear and dispose debounce manager if it exists
            if (watcherInfo.debounceManager) {
                ManageDebounceTime.dispose(watcherInfo.debounceManager);
                console.log(`🔍 VISUALIZE_DOM_WATCHER: Disposed debounce manager for: ${watcherInfo.htmlFilePath}`);
            }

            // Close the watcher
            watcherInfo.watcher.close();

            // Remove from active watchers
            VisualizeDOMWatcher.activeWatchers.delete(watcherId);

            console.log(`🔍 VISUALIZE_DOM_WATCHER: Stopped watching HTML file: ${watcherInfo.htmlFilePath}`);
            console.log(`🔍 VISUALIZE_DOM_WATCHER: Remaining active VisualizeDOM watchers: ${VisualizeDOMWatcher.activeWatchers.size}`);

            return true;

        } catch (error) {
            console.error(`🔍 VISUALIZE_DOM_WATCHER: Error stopping watcher:`, error);
            return false;
        }
    }

    /**
     * Stop all active VisualizeDOM watchers
     */
    static stopAllWatchers(): void {
        try {
            console.log(`🔍 VISUALIZE_DOM_WATCHER: Stopping all ${VisualizeDOMWatcher.activeWatchers.size} active VisualizeDOM watchers`);

            for (const [watcherId, watcherInfo] of VisualizeDOMWatcher.activeWatchers) {
                // Clear and dispose debounce manager
                if (watcherInfo.debounceManager) {
                    ManageDebounceTime.dispose(watcherInfo.debounceManager);
                    console.log(`🔍 VISUALIZE_DOM_WATCHER: Disposed debounce manager for: ${watcherInfo.htmlFilePath}`);
                }

                // Close watcher
                watcherInfo.watcher.close();
                
                console.log(`🔍 VISUALIZE_DOM_WATCHER: Stopped watcher: ${watcherId} (${watcherInfo.htmlFilePath})`);
            }

            // Clear all watchers
            VisualizeDOMWatcher.activeWatchers.clear();

            console.log(`🔍 VISUALIZE_DOM_WATCHER: All VisualizeDOM watchers stopped successfully`);

        } catch (error) {
            console.error(`🔍 VISUALIZE_DOM_WATCHER: Error stopping all watchers:`, error);
        }
    }

    /**
     * Get active watcher count
     */
    static getActiveWatcherCount(): number {
        return VisualizeDOMWatcher.activeWatchers.size;
    }

    /**
     * Get active watcher info
     */
    static getActiveWatchers(): Map<string, VisualizeDOMWatcherInfo> {
        return new Map(VisualizeDOMWatcher.activeWatchers);
    }
}
