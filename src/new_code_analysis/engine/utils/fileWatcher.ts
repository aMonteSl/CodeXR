/**
 * 
 * 
 * File Watcher Utility
 * Manages file watchers for live analysis updates
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PythonExecutor } from './pythonExecutor';
import { sseManager } from '../../../servers/runtime/sse/SSEManager';
import { GetNecessaryFiles } from './getNecessaryFiles';
import { SaveFiles } from './saveFiles';
import { fileToServerMap } from '../../../utils/fileToServerMap';
import { ManageDebounceTime, DebounceManager } from './manageDebounceTime';
import { AnalysisSessionManager } from '../registry/analysisSessionManager';
import { AnalysisSessionRegistry } from '../registry/analysisSessionRegistry';

interface WatcherInfo {
    watcher: fs.FSWatcher;
    filePath: string;
    analysisDir: string;
    analysisType: string;
    sessionId: string; // Add sessionId to watcher info
    debounceManager?: DebounceManager;
    lastProcessedTime?: number;
}

export class FileWatcher {
    private static activeWatchers: Map<string, WatcherInfo> = new Map();

    /**
     * Get debounce delay from user configuration
     */
    private static async getDebounceDelay(context: vscode.ExtensionContext): Promise<number> {
        return await ManageDebounceTime.getDebounceDelay(context);
    }



    /**
     * Start watching a file for changes and re-execute analysis when detected
     */
    static async startWatching(
        sessionId: string,
        context: vscode.ExtensionContext
    ): Promise<string> {
        try {
            const sessionManager = AnalysisSessionManager.getInstance();
            const session = sessionManager.getSession(sessionId);
            
            if (!session) {
                throw new Error(`Session ${sessionId} not found`);
            }

            console.log(`FILE_WATCHER: Starting to watch file: ${session.filePath}`);
            console.log(`FILE_WATCHER: Analysis directory: ${session.outputPath}`);
            console.log(`FILE_WATCHER: Session ID: ${sessionId}`);
            console.log(`FILE_WATCHER: Analysis type: ${session.analysisType}`);

            // Get debounce delay from configuration
            const debounceMs = await FileWatcher.getDebounceDelay(context);
            console.log(`FILE_WATCHER: Using debounce delay: ${debounceMs}ms`);

            // Create unique watcher ID
            const watcherId = `${path.basename(session.filePath)}_${Date.now()}`;

            // Check if file exists
            if (!fs.existsSync(session.filePath)) {
                console.error(`FILE_WATCHER: File does not exist: ${session.filePath}`);
                return '';
            }

            // Check if analysis directory exists
            if (!fs.existsSync(session.outputPath)) {
                console.error(`FILE_WATCHER: Analysis directory does not exist: ${session.outputPath}`);
                return '';
            }

            // Create file watcher
            const watcher = fs.watch(session.filePath, { persistent: true }, async (eventType, filename) => {
                if (eventType === 'change') {
                    console.log(`FILE_WATCHER: File changed detected: ${session.filePath}`);
                    console.log(`FILE_WATCHER: Event type: ${eventType}, filename: ${filename}`);

                    // Get current watcher info for debouncing
                    const currentWatcherInfo = FileWatcher.activeWatchers.get(watcherId);
                    if (!currentWatcherInfo) {
                        console.error(`FILE_WATCHER: Watcher info not found for ID: ${watcherId}`);
                        return;
                    }

                    // Clear existing debounce manager if it exists (this will dispose status bar)
                    if (currentWatcherInfo.debounceManager) {
                        ManageDebounceTime.dispose(currentWatcherInfo.debounceManager);
                        console.log(`FILE_WATCHER: Disposed previous debounce manager for: ${session.filePath}`);
                        currentWatcherInfo.debounceManager = undefined;
                    }

                    // Get fresh debounce delay in case user changed it
                    const currentDebounceMs = await FileWatcher.getDebounceDelay(context);

                    // Check if we processed this change too recently (additional protection)
                    const now = Date.now();
                    if (currentWatcherInfo.lastProcessedTime && 
                        (now - currentWatcherInfo.lastProcessedTime) < currentDebounceMs) {
                        console.log(`FILE_WATCHER: Skipping duplicate change event (too recent): ${session.filePath}`);
                        return;
                    }

                    // Create new debounce manager for this change
                    const debounceManager = ManageDebounceTime.createDebounceManager(session.filePath, currentDebounceMs);
                    currentWatcherInfo.debounceManager = debounceManager;

                    // Set up debounced execution using ManageDebounceTime
                    ManageDebounceTime.setupDebouncedExecution(
                        debounceManager,
                        context,
                        async () => {
                            try {
                                console.log(`FILE_WATCHER: Executing debounced analysis for: ${session.filePath}`);
                                currentWatcherInfo.lastProcessedTime = Date.now();
                                
                                // **CLAVE: Poner sesión en estado "analyzing" cuando debounce llega a 0**
                                await sessionManager.setAnalyzing(sessionId);
                                console.log(`FILE_WATCHER: Session ${sessionId} set to ANALYZING state`);
                                
                                // Re-execute analysis with session
                                await FileWatcher.reExecuteAnalysis(sessionId, context);
                                
                            } catch (error) {
                                console.error(`FILE_WATCHER: Error re-executing analysis:`, error);
                                const registry = AnalysisSessionRegistry.getInstance();
                                registry.updateSessionStatus(sessionId, 'failed', undefined, error instanceof Error ? error.message : String(error));
                                vscode.window.showErrorMessage(`Error updating analysis: ${error instanceof Error ? error.message : String(error)}`);
                            }
                        }
                    );

                    console.log(`FILE_WATCHER: Debounce timer set for: ${session.filePath} (${currentDebounceMs}ms)`);
                }
            });

            // Store watcher info with sessionId
            const watcherInfo: WatcherInfo = {
                watcher,
                filePath: session.filePath,
                analysisDir: session.outputPath,
                analysisType: session.analysisType,
                sessionId: sessionId,
                debounceManager: undefined,
                lastProcessedTime: undefined
            };

            FileWatcher.activeWatchers.set(watcherId, watcherInfo);

            console.log(`FILE_WATCHER: Successfully started watching with ID: ${watcherId}`);
            console.log(`FILE_WATCHER: Total active watchers: ${FileWatcher.activeWatchers.size}`);

            return watcherId;

        } catch (error) {
            console.error(`FILE_WATCHER: Error starting file watcher:`, error);
            vscode.window.showErrorMessage(`Error starting file watcher: ${error instanceof Error ? error.message : String(error)}`);
            return '';
        }
    }

    /**
     * Stop watching a specific file
     */
    static stopWatching(watcherId: string): boolean {
        try {
            const watcherInfo = FileWatcher.activeWatchers.get(watcherId);
            if (!watcherInfo) {
                console.log(`FILE_WATCHER: Watcher not found with ID: ${watcherId}`);
                return false;
            }

            // Clear and dispose debounce manager if it exists
            if (watcherInfo.debounceManager) {
                ManageDebounceTime.dispose(watcherInfo.debounceManager);
                console.log(`FILE_WATCHER: Disposed debounce manager for: ${watcherInfo.filePath}`);
            }

            // Close the watcher
            watcherInfo.watcher.close();

            // Remove from active watchers
            FileWatcher.activeWatchers.delete(watcherId);

            console.log(`FILE_WATCHER: Stopped watching file: ${watcherInfo.filePath}`);
            console.log(`FILE_WATCHER: Remaining active watchers: ${FileWatcher.activeWatchers.size}`);

            return true;

        } catch (error) {
            console.error(`FILE_WATCHER: Error stopping watcher:`, error);
            return false;
        }
    }    /**
     * Stop all active watchers
     */
    static stopAllWatchers(): void {
        try {
            console.log(`FILE_WATCHER: Stopping all ${FileWatcher.activeWatchers.size} active watchers`);

            for (const [watcherId, watcherInfo] of FileWatcher.activeWatchers) {
                try {
                    // Clear and dispose debounce manager if it exists
                    if (watcherInfo.debounceManager) {
                        ManageDebounceTime.dispose(watcherInfo.debounceManager);
                        console.log(`FILE_WATCHER: Disposed debounce manager for: ${watcherInfo.filePath}`);
                    }

                    watcherInfo.watcher.close();
                    console.log(`FILE_WATCHER: Closed watcher for: ${watcherInfo.filePath}`);
                } catch (error) {
                    console.error(`FILE_WATCHER: Error closing watcher ${watcherId}:`, error);
                }
            }

            FileWatcher.activeWatchers.clear();
            console.log(`FILE_WATCHER: All watchers stopped`);

        } catch (error) {
            console.error(`FILE_WATCHER: Error stopping all watchers:`, error);
        }
    }

    /**
     * Get information about active watchers
     */
    static getActiveWatchersInfo(): { id: string, filePath: string, analysisDir: string, analysisType: string }[] {
        const info: { id: string, filePath: string, analysisDir: string, analysisType: string }[] = [];

        for (const [watcherId, watcherInfo] of FileWatcher.activeWatchers) {
            info.push({
                id: watcherId,
                filePath: watcherInfo.filePath,
                analysisDir: watcherInfo.analysisDir,
                analysisType: watcherInfo.analysisType
            });
        }

        return info;
    }

    /**
     * Re-execute analysis when file changes are detected
     */
    private static async reExecuteAnalysis(
        sessionId: string,
        context: vscode.ExtensionContext
    ): Promise<void> {
        try {
            const sessionManager = AnalysisSessionManager.getInstance();
            const session = sessionManager.getSession(sessionId);
            
            if (!session) {
                throw new Error(`Session ${sessionId} not found`);
            }

            console.log(`FILE_WATCHER: Re-executing analysis for: ${session.filePath}`);
            console.log(`FILE_WATCHER: Analysis type: ${session.analysisType}`);

            if (session.analysisType === 'DOMVisualization') {
                // Re-execute DOM analysis with session
                const analysisResult = await GetNecessaryFiles.getVisualizationDOM(session.filePath, context, sessionId);
                
                if (analysisResult.success && analysisResult.data && analysisResult.indexHtml) {
                    console.log(`FILE_WATCHER: DOM analysis completed successfully`);
                    await FileWatcher.updateAnalysisFiles(analysisResult, session.outputPath, session.filePath, session.analysisType);
                    
                    // **MARK SESSION AS COMPLETED AFTER SUCCESSFUL ANALYSIS**
                    const registry = AnalysisSessionRegistry.getInstance();
                    registry.updateSessionStatus(sessionId, 'completed');
                    console.log(`FILE_WATCHER: Session ${sessionId} marked as COMPLETED after DOM analysis`);
                } else {
                    console.error(`FILE_WATCHER: DOM analysis failed:`, analysisResult.error);
                    const registry = AnalysisSessionRegistry.getInstance();
                    registry.updateSessionStatus(sessionId, 'failed', undefined, analysisResult.error || 'DOM analysis failed');
                    vscode.window.showErrorMessage(`DOM visualization update failed: ${analysisResult.error}`);
                }
                
            } else if (session.analysisType === 'FileXRAnalysis') {
                // Re-execute XR analysis with session
                const analysisResult = await GetNecessaryFiles.getAnalysisFileXR(session.filePath, context, sessionId);
                
                if (analysisResult.success && analysisResult.data) {
                    console.log(`FILE_WATCHER: XR analysis completed successfully`);
                    await FileWatcher.updateAnalysisFiles(analysisResult, session.outputPath, session.filePath, session.analysisType);
                    
                    // **MARK SESSION AS COMPLETED AFTER SUCCESSFUL ANALYSIS**
                    const registry = AnalysisSessionRegistry.getInstance();
                    registry.updateSessionStatus(sessionId, 'completed');
                    console.log(`FILE_WATCHER: Session ${sessionId} marked as COMPLETED after XR analysis`);
                } else {
                    console.error(`FILE_WATCHER: XR analysis failed:`, analysisResult.error);
                    const registry = AnalysisSessionRegistry.getInstance();
                    registry.updateSessionStatus(sessionId, 'failed', undefined, analysisResult.error || 'XR analysis failed');
                    vscode.window.showErrorMessage(`XR visualization update failed: ${analysisResult.error}`);
                }
                
            } else {
                // LivePanel logic with session
                const analysisResult = await GetNecessaryFiles.getAnalysisFileLivePanel(
                    session.filePath, 
                    context, 
                    undefined, // theme
                    sessionId
                );

                if (analysisResult.success && analysisResult.data) {
                    console.log(`FILE_WATCHER: LivePanel analysis completed successfully`);
                    await FileWatcher.updateAnalysisFiles(analysisResult, session.outputPath, session.filePath, session.analysisType);
                    
                    // Send SSE update to all clients listening for this file
                    try {
                        console.log(`FILE_WATCHER: Sending SSE update notification for file: ${session.filePath}`);
                        
                        // Use the original SSEManager that matches the server
                        sseManager.sendUpdate(session.filePath);
                        
                        console.log(`FILE_WATCHER: SSE update notification sent successfully`);
                    } catch (sseError) {
                        console.warn(`FILE_WATCHER: Failed to send SSE update (non-critical):`, sseError);
                    }
                    
                    // **MARK SESSION AS COMPLETED AFTER SUCCESSFUL ANALYSIS AND SSE NOTIFICATION**
                    const registry = AnalysisSessionRegistry.getInstance();
                    registry.updateSessionStatus(sessionId, 'completed');
                    console.log(`FILE_WATCHER: Session ${sessionId} marked as COMPLETED after LivePanel analysis and SSE notification`);
                    
                    // Show success message
                    vscode.window.showInformationMessage(`Analysis updated for: ${path.basename(session.filePath)}`);
                } else {
                    console.error(`FILE_WATCHER: LivePanel analysis failed:`, analysisResult.error);
                    const registry = AnalysisSessionRegistry.getInstance();
                    registry.updateSessionStatus(sessionId, 'failed', undefined, analysisResult.error || 'LivePanel analysis failed');
                    vscode.window.showErrorMessage(`Analysis update failed: ${analysisResult.error}`);
                }
            }

        } catch (error) {
            console.error(`FILE_WATCHER: Error in reExecuteAnalysis:`, error);
            throw error;
        }
    }

    /**
     * Update analysis files and send SSE notification
     */
    private static async updateAnalysisFiles(
        analysisResult: any,
        analysisDir: string,
        filePath: string,
        analysisType: string
    ): Promise<void> {
        const indexHtmlPath = path.join(analysisDir, 'index.html');
        const jsPath = path.join(analysisDir, 'main.js');
        const dataJsonPath = path.join(analysisDir, 'data.json');
        
        try {
            // Update files with new analysis results
            if (analysisResult.indexHtml) {
                await fs.promises.writeFile(indexHtmlPath, analysisResult.indexHtml, 'utf-8');
            }
            if (analysisResult.jsContent) {
                await fs.promises.writeFile(jsPath, analysisResult.jsContent, 'utf-8');
            }
            await fs.promises.writeFile(dataJsonPath, JSON.stringify(analysisResult.data, null, 2), 'utf-8');
            
            console.log(`FILE_WATCHER: Updated ${analysisType} files in: ${analysisDir}`);
            
            // Send SSE update based on analysis type
            try {
                console.log(`FILE_WATCHER: Sending SSE update for ${analysisType}: ${filePath}`);
                
                if (analysisType === 'DOMVisualization') {
                    sseManager.sendCustomMessage(filePath, {
                        type: 'htmlUpdated',
                        htmlContent: analysisResult.data?.htmlContent || '',
                        action: 'reload-html',
                        message: 'HTML DOM content has been updated'
                    });
                } else if (analysisType === 'FileXRAnalysis') {
                    sseManager.sendEventMessage(filePath, 'dataRefresh', 'refreshed');
                }
                
                console.log(`FILE_WATCHER: SSE ${analysisType} update sent successfully`);
            } catch (sseError) {
                console.warn(`FILE_WATCHER: Failed to send SSE ${analysisType} update (non-critical):`, sseError);
            }
            
            // Show success message with appropriate emoji
            const emoji = analysisType === 'DOMVisualization' ? '🌐' : '🥽';
            vscode.window.showInformationMessage(`${emoji} ${analysisType} updated for: ${path.basename(filePath)}`);
            
        } catch (error) {
            console.error(`FILE_WATCHER: Error updating ${analysisType} files:`, error);
            throw error;
        }
    }

    /**
     * Extract JSON data from Python output
     */
    private static extractJsonFromOutput(output: string): any {
        try {
            // Look for JSON data in the output
            // This might need to be adjusted based on how Python outputs the data
            const lines = output.split('\n');
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
                    try {
                        return JSON.parse(trimmedLine);
                    } catch (parseError) {
                        // Continue looking for valid JSON
                        continue;
                    }
                }
            }

            // If no single-line JSON found, try to find multi-line JSON
            const fullOutput = output.trim();
            if (fullOutput.startsWith('{') && fullOutput.endsWith('}')) {
                return JSON.parse(fullOutput);
            }

            return null;

        } catch (error) {
            console.error(`FILE_WATCHER: Error extracting JSON from output:`, error);
            return null;
        }
    }
}
