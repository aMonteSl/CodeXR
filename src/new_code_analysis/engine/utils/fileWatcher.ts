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

interface WatcherInfo {
    watcher: fs.FSWatcher;
    filePath: string;
    analysisDir: string;
    analysisType: string;
    debounceTimer?: NodeJS.Timeout;
    lastProcessedTime?: number;
}

export class FileWatcher {
    private static activeWatchers: Map<string, WatcherInfo> = new Map();
    private static readonly DEBOUNCE_DELAY = 300; // 300ms debounce to avoid duplicate executions

    /**
     * Start watching a file for changes and re-execute analysis when detected
     */
    static startWatching(
        context: vscode.ExtensionContext,
        filePath: string,
        analysisDir: string,
        analysisType: string = 'LivePanel'
    ): string {
        try {
            console.log(`FILE_WATCHER: Starting to watch file: ${filePath}`);
            console.log(`FILE_WATCHER: Analysis directory: ${analysisDir}`);
            console.log(`FILE_WATCHER: Analysis type: ${analysisType}`);

            // Create unique watcher ID
            const watcherId = `${path.basename(filePath)}_${Date.now()}`;

            // Check if file exists
            if (!fs.existsSync(filePath)) {
                console.error(`FILE_WATCHER: File does not exist: ${filePath}`);
                return '';
            }

            // Check if analysis directory exists
            if (!fs.existsSync(analysisDir)) {
                console.error(`FILE_WATCHER: Analysis directory does not exist: ${analysisDir}`);
                return '';
            }

            // Create file watcher
            const watcher = fs.watch(filePath, { persistent: true }, async (eventType, filename) => {
                if (eventType === 'change') {
                    console.log(`FILE_WATCHER: File changed detected: ${filePath}`);
                    console.log(`FILE_WATCHER: Event type: ${eventType}, filename: ${filename}`);

                    // Get current watcher info for debouncing
                    const currentWatcherInfo = FileWatcher.activeWatchers.get(watcherId);
                    if (!currentWatcherInfo) {
                        console.error(`FILE_WATCHER: Watcher info not found for ID: ${watcherId}`);
                        return;
                    }

                    // Clear existing debounce timer if it exists
                    if (currentWatcherInfo.debounceTimer) {
                        clearTimeout(currentWatcherInfo.debounceTimer);
                        console.log(`FILE_WATCHER: Cleared previous debounce timer for: ${filePath}`);
                    }

                    // Check if we processed this change too recently (additional protection)
                    const now = Date.now();
                    if (currentWatcherInfo.lastProcessedTime && 
                        (now - currentWatcherInfo.lastProcessedTime) < FileWatcher.DEBOUNCE_DELAY) {
                        console.log(`FILE_WATCHER: Skipping duplicate change event (too recent): ${filePath}`);
                        return;
                    }

                    // Set up debounced execution
                    currentWatcherInfo.debounceTimer = setTimeout(async () => {
                        try {
                            console.log(`FILE_WATCHER: Executing debounced analysis for: ${filePath}`);
                            currentWatcherInfo.lastProcessedTime = Date.now();
                            
                            // Re-execute Python analysis
                            await FileWatcher.reExecuteAnalysis(context, filePath, analysisDir, analysisType);
                            
                            // Clear the timer reference
                            currentWatcherInfo.debounceTimer = undefined;
                            
                        } catch (error) {
                            console.error(`FILE_WATCHER: Error re-executing analysis:`, error);
                            vscode.window.showErrorMessage(`Error updating analysis: ${error instanceof Error ? error.message : String(error)}`);
                            currentWatcherInfo.debounceTimer = undefined;
                        }
                    }, FileWatcher.DEBOUNCE_DELAY);

                    console.log(`FILE_WATCHER: Debounce timer set for: ${filePath} (${FileWatcher.DEBOUNCE_DELAY}ms)`);
                }
            });

            // Store watcher info
            const watcherInfo: WatcherInfo = {
                watcher,
                filePath,
                analysisDir,
                analysisType,
                debounceTimer: undefined,
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

            // Clear debounce timer if it exists
            if (watcherInfo.debounceTimer) {
                clearTimeout(watcherInfo.debounceTimer);
                console.log(`FILE_WATCHER: Cleared debounce timer for: ${watcherInfo.filePath}`);
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
    }

    /**
     * Stop all active watchers
     */
    static stopAllWatchers(): void {
        try {
            console.log(`FILE_WATCHER: Stopping all ${FileWatcher.activeWatchers.size} active watchers`);

            for (const [watcherId, watcherInfo] of FileWatcher.activeWatchers) {
                try {
                    // Clear debounce timer if it exists
                    if (watcherInfo.debounceTimer) {
                        clearTimeout(watcherInfo.debounceTimer);
                        console.log(`FILE_WATCHER: Cleared debounce timer for: ${watcherInfo.filePath}`);
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
        context: vscode.ExtensionContext,
        filePath: string,
        analysisDir: string,
        analysisType: string
    ): Promise<void> {
        try {
            console.log(`FILE_WATCHER: Re-executing analysis for: ${filePath}`);
            console.log(`FILE_WATCHER: Analysis type: ${analysisType}`);

            // Execute Python analysis in LivePanel mode
            const result = await PythonExecutor.executeAnalysis(
                'FileLivePanel',
                filePath,
                context
            );

            if (result.success && result.stdout) {
                // Update data.json in analysis directory
                const dataJsonPath = path.join(analysisDir, 'data.json');
                
                try {
                    // Parse the output to extract JSON data
                    const jsonData = FileWatcher.extractJsonFromOutput(result.stdout);
                    if (jsonData) {
                        fs.writeFileSync(dataJsonPath, JSON.stringify(jsonData, null, 2), 'utf-8');
                        console.log(`FILE_WATCHER: Updated data.json at: ${dataJsonPath}`);
                        
                        // Send SSE update to all clients listening for this file
                        try {
                            console.log(`FILE_WATCHER: Sending SSE update notification for file: ${filePath}`);
                            
                            // Use the original SSEManager that matches the server
                            sseManager.sendUpdate(filePath);
                            
                            console.log(`FILE_WATCHER: SSE update notification sent successfully`);
                        } catch (sseError) {
                            console.warn(`FILE_WATCHER: Failed to send SSE update (non-critical):`, sseError);
                        }
                        
                        // Show success message
                        vscode.window.showInformationMessage(`Analysis updated for: ${path.basename(filePath)}`);
                    } else {
                        console.error(`FILE_WATCHER: No valid JSON data found in Python output`);
                    }
                } catch (error) {
                    console.error(`FILE_WATCHER: Error updating data.json:`, error);
                }
            } else {
                console.error(`FILE_WATCHER: Python analysis failed:`, result.error);
                vscode.window.showErrorMessage(`Analysis update failed: ${result.error}`);
            }

        } catch (error) {
            console.error(`FILE_WATCHER: Error in reExecuteAnalysis:`, error);
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
