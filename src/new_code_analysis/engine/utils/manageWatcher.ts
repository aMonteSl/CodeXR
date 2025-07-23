/**
 * Smart Directory and File Watcher Utility
 * Manages intelligent file watchers for live analysis updates with SHA256-based change detection
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PythonExecutor, AnalysisType } from './pythonExecutor';
import { sseManager } from '../../../servers/runtime/sse/SSEManager';
import { GetNecessaryFiles } from './getNecessaryFiles';
import { SaveFiles } from './saveFiles';
import { fileToServerMap } from '../../../utils/fileToServerMap';
import { ManageDebounceTime, DebounceManager } from './manageDebounceTime';
import { AnalysisSessionManager } from '../registry/analysisSessionManager';
import { SUPPORTED_LANGUAGES } from '../../../utils/supportedLanguages';
import { AnalysisSessionRegistry } from '../registry/analysisSessionRegistry';
import { DirectoryAnalysisSessionManager } from '../registry/directoryAnalysisSessionManager';
import { DirectoryAnalysisSessionRegistry } from '../registry/directoryAnalysisSessionRegistry';
import { CheckFilesChanged, FileChangeResult } from './checkFilesChanged';
import { ReplaceInJson, ReplaceResult } from './replaceInJson';
import { SaveFile } from './saveFile';
import { SHA256Generator } from '../../../utils/sha256Generator';

interface WatcherInfo {
    watcher: fs.FSWatcher;
    filePath: string;
    analysisDir: string;
    analysisType: string;
    sessionId: string;
    debounceManager?: DebounceManager;
    lastProcessedTime?: number;
    isDirectory?: boolean; // NEW: Flag for directory watching
}

interface DirectoryWatcherInfo {
    watcher: fs.FSWatcher;
    directoryPath: string;
    analysisDir: string;
    sessionId: string;
    debounceManager?: DebounceManager;
    lastProcessedTime?: number;
    watchedFiles: Set<string>; // Track files in directory
}

export class ManageWatcher {
    private static activeWatchers: Map<string, WatcherInfo> = new Map();
    private static directoryWatchers: Map<string, DirectoryWatcherInfo> = new Map();

    /**
     * Get debounce delay from user configuration
     */
    private static async getDebounceDelay(context: vscode.ExtensionContext): Promise<number> {
        return await ManageDebounceTime.getDebounceDelay(context);
    }

    /**
     * Start watching a directory for changes and intelligently re-analyze only changed files
     */
    static async startDirectoryWatching(
        sessionId: string,
        context: vscode.ExtensionContext
    ): Promise<string> {
        try {
            const sessionManager = DirectoryAnalysisSessionManager.getInstance();
            const session = sessionManager.getSession(sessionId);
            
            if (!session) {
                throw new Error(`Directory session ${sessionId} not found`);
            }

            console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Starting to watch directory: ${session.filePath}`);
            console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Analysis directory: ${session.outputPath}`);
            console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Session ID: ${sessionId}`);
            console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Analysis type: ${session.analysisType}`);
            console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Session configuration - isXR: ${session.isXR}, isDeep: ${session.isDeep}`);

            // Use session configuration directly instead of deducing from analysisType
            const shouldWatchRecursively = session.isDeep;
            
            console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Recursive watching: ${shouldWatchRecursively} (Deep analysis: ${session.isDeep})`);

            // Get debounce delay from configuration
            const debounceMs = await ManageWatcher.getDebounceDelay(context);
            console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Using debounce delay: ${debounceMs}ms`);

            // Create unique watcher ID
            const watcherId = `dir_${path.basename(session.filePath)}_${Date.now()}`;

            // Check if directory exists
            if (!fs.existsSync(session.filePath)) {
                console.error(`WATCHER_DIRECTORY_LIVE_PANEL: Directory does not exist: ${session.filePath}`);
                return '';
            }

            // Get initial list of files to watch
            const watchedFiles = new Set<string>();
            ManageWatcher.collectWatchableFiles(session.filePath, watchedFiles);

            console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Found ${watchedFiles.size} files to watch in directory`);

            // Create directory watcher with appropriate recursion setting
            const watcher = fs.watch(session.filePath, { recursive: shouldWatchRecursively, persistent: true }, async (eventType, filename) => {
                if ((eventType === 'change' || eventType === 'rename') && filename) {
                    const fullPath = path.join(session.filePath, filename);
                    
                    console.log(`WATCHER_DIRECTORY_LIVE_PANEL: File system event detected - Type: ${eventType}, File: ${filename}`);
                    
                    // Only process supported file types
                    if (!ManageWatcher.isWatchableFile(fullPath)) {
                        console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Skipping non-supported file type: ${fullPath}`);
                        return;
                    }

                    // Determine the type of file system change
                    let changeDescription = 'modified';
                    if (eventType === 'rename') {
                        if (fs.existsSync(fullPath)) {
                            changeDescription = 'created';
                        } else {
                            changeDescription = 'deleted';
                        }
                    }

                    console.log(`WATCHER_DIRECTORY_LIVE_PANEL: File ${changeDescription}: ${fullPath}`);

                    // For non-deep analysis, only watch first-level files (no subdirectories)
                    if (!session.isDeep) {
                        const relativePath = path.relative(session.filePath, fullPath);
                        const pathParts = relativePath.split(path.sep);
                        
                        // Skip files in subdirectories for non-deep analysis
                        if (pathParts.length > 1) {
                            console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Skipping subdirectory file (non-deep): ${relativePath}`);
                            return;
                        }
                    }

                    console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Directory change detected: ${fullPath}`);

                    // Get current watcher info for debouncing
                    const currentWatcherInfo = ManageWatcher.directoryWatchers.get(watcherId);
                    if (!currentWatcherInfo) {
                        console.error(`WATCHER_DIRECTORY_LIVE_PANEL: Directory watcher info not found for ID: ${watcherId}`);
                        return;
                    }

                    // Clear existing debounce manager if it exists
                    if (currentWatcherInfo.debounceManager) {
                        ManageDebounceTime.dispose(currentWatcherInfo.debounceManager);
                        console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Disposed previous debounce manager for directory: ${session.filePath}`);
                        currentWatcherInfo.debounceManager = undefined;
                    }

                    // Get fresh debounce delay
                    const currentDebounceMs = await ManageWatcher.getDebounceDelay(context);

                    // Check if we processed this change too recently
                    const now = Date.now();
                    if (currentWatcherInfo.lastProcessedTime && 
                        (now - currentWatcherInfo.lastProcessedTime) < currentDebounceMs) {
                        console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Skipping duplicate directory change event (too recent)`);
                        return;
                    }

                    // Create new debounce manager for this change
                    const debounceManager = ManageDebounceTime.createDebounceManager(session.filePath, currentDebounceMs);
                    currentWatcherInfo.debounceManager = debounceManager;

                    // Set up debounced execution
                    ManageDebounceTime.setupDebouncedExecution(
                        debounceManager,
                        context,
                        async () => {
                            try {
                                console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Executing debounced directory analysis for: ${session.filePath}`);
                                currentWatcherInfo.lastProcessedTime = Date.now();
                                
                                // Set session to analyzing state
                                await ManageWatcher.setDirectoryAnalyzing(sessionId);
                                console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Directory session ${sessionId} set to ANALYZING state`);
                                
                                // Execute intelligent re-analysis
                                await ManageWatcher.reExecuteDirectoryAnalysis(sessionId, context);
                                
                            } catch (error) {
                                console.error(`WATCHER_DIRECTORY_LIVE_PANEL: Error re-executing directory analysis:`, error);
                                ManageWatcher.setDirectoryFailed(sessionId, error instanceof Error ? error.message : String(error));
                                vscode.window.showErrorMessage(`Error updating directory analysis: ${error instanceof Error ? error.message : String(error)}`);
                            }
                        }
                    );

                    console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Directory debounce timer set for: ${session.filePath} (${currentDebounceMs}ms)`);
                }
            });

            // Store directory watcher info
            const watcherInfo: DirectoryWatcherInfo = {
                watcher,
                directoryPath: session.filePath,
                analysisDir: session.outputPath,
                sessionId: sessionId,
                debounceManager: undefined,
                lastProcessedTime: undefined,
                watchedFiles
            };

            ManageWatcher.directoryWatchers.set(watcherId, watcherInfo);

            console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Successfully started directory watching with ID: ${watcherId}`);
            console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Total active directory watchers: ${ManageWatcher.directoryWatchers.size}`);

            return watcherId;

        } catch (error) {
            console.error(`WATCHER_DIRECTORY_LIVE_PANEL: Error starting directory watcher:`, error);
            vscode.window.showErrorMessage(`Error starting directory watcher: ${error instanceof Error ? error.message : String(error)}`);
            return '';
        }
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
            const debounceMs = await ManageWatcher.getDebounceDelay(context);
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
                    const currentWatcherInfo = ManageWatcher.activeWatchers.get(watcherId);
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
                    const currentDebounceMs = await ManageWatcher.getDebounceDelay(context);

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
                                await ManageWatcher.reExecuteAnalysis(sessionId, context);
                                
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

            ManageWatcher.activeWatchers.set(watcherId, watcherInfo);

            console.log(`FILE_WATCHER: Successfully started watching with ID: ${watcherId}`);
            console.log(`FILE_WATCHER: Total active watchers: ${ManageWatcher.activeWatchers.size}`);

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
            const watcherInfo = ManageWatcher.activeWatchers.get(watcherId);
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
            ManageWatcher.activeWatchers.delete(watcherId);

            console.log(`FILE_WATCHER: Stopped watching file: ${watcherInfo.filePath}`);
            console.log(`FILE_WATCHER: Remaining active watchers: ${ManageWatcher.activeWatchers.size}`);

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
            console.log(`FILE_WATCHER: Stopping all ${ManageWatcher.activeWatchers.size} active watchers`);

            for (const [watcherId, watcherInfo] of ManageWatcher.activeWatchers) {
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

            ManageWatcher.activeWatchers.clear();
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

        for (const [watcherId, watcherInfo] of ManageWatcher.activeWatchers) {
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
                    await ManageWatcher.updateAnalysisFiles(analysisResult, session.outputPath, session.filePath, session.analysisType);
                    
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
                    await ManageWatcher.updateAnalysisFiles(analysisResult, session.outputPath, session.filePath, session.analysisType);
                    
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
                    await ManageWatcher.updateAnalysisFiles(analysisResult, session.outputPath, session.filePath, session.analysisType);
                    
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

    /**
     * Helper method to collect watchable files in a directory
     */
    private static collectWatchableFiles(directoryPath: string, watchedFiles: Set<string>): void {
        try {
            const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(directoryPath, entry.name);
                
                if (entry.isDirectory()) {
                    // Recursively collect files from subdirectories
                    ManageWatcher.collectWatchableFiles(fullPath, watchedFiles);
                } else if (entry.isFile() && ManageWatcher.isWatchableFile(fullPath)) {
                    watchedFiles.add(fullPath);
                }
            }
        } catch (error) {
            console.warn(`MANAGE_WATCHER: Error collecting files from ${directoryPath}:`, error);
        }
    }

    /**
     * Check if a file is watchable (supported file types)
     * Uses the centralized SUPPORTED_LANGUAGES configuration
     */
    private static isWatchableFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        
        // Check against all supported language extensions
        for (const langConfig of Object.values(SUPPORTED_LANGUAGES)) {
            if (langConfig.extensions.includes(ext)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Set directory session to analyzing state
     */
    private static async setDirectoryAnalyzing(sessionId: string): Promise<void> {
        try {
            const sessionManager = DirectoryAnalysisSessionManager.getInstance();
            const registry = DirectoryAnalysisSessionRegistry.getInstance();
            
            // Update session status
            registry.updateSessionStatus(sessionId, 'analyzing');
            console.log(`MANAGE_WATCHER: Directory session ${sessionId} set to ANALYZING state`);
        } catch (error) {
            console.error(`MANAGE_WATCHER: Error setting directory session to analyzing:`, error);
        }
    }

    /**
     * Set directory session to failed state
     */
    private static setDirectoryFailed(sessionId: string, error: string): void {
        try {
            const registry = DirectoryAnalysisSessionRegistry.getInstance();
            registry.updateSessionStatus(sessionId, 'failed', undefined, error);
            console.log(`MANAGE_WATCHER: Directory session ${sessionId} set to FAILED state: ${error}`);
        } catch (err) {
            console.error(`MANAGE_WATCHER: Error setting directory session to failed:`, err);
        }
    }

    /**
     * Re-execute directory analysis with intelligent file change detection
     */
    private static async reExecuteDirectoryAnalysis(
        sessionId: string,
        context: vscode.ExtensionContext
    ): Promise<void> {
        try {
            const sessionManager = DirectoryAnalysisSessionManager.getInstance();
            const session = sessionManager.getSession(sessionId);
            
            if (!session) {
                throw new Error(`Directory session ${sessionId} not found`);
            }

            console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Re-executing directory analysis for: ${session.filePath}`);

            // Step 1: Check which files have changed using SHA256
            const changeReport = await CheckFilesChanged.checkChangedFiles(session);
            let changeResults = changeReport.changedFiles;
            
            if (changeResults.length === 0) {
                console.log(`FILES_CHANGED: No file changes detected, skipping re-analysis`);
                const registry = DirectoryAnalysisSessionRegistry.getInstance();
                registry.updateSessionStatus(sessionId, 'completed');
                return;
            }

            console.log(`FILES_CHANGED: Found ${changeResults.length} changed files for re-analysis`);

            // Step 1.5: Filter changed files to only include files that are actually in the current analysis
            // For non-deep analysis, this means only first-level files
            console.log(`FILES_CHANGED: Session configuration - isXR: ${session.isXR}, isDeep: ${session.isDeep}`);
            
            if (!session.isDeep) {
                const originalChangeCount = changeResults.length;
                console.log(`FILES_CHANGED: Applying non-deep filter to ${originalChangeCount} files:`);
                
                changeResults.forEach(changedFile => {
                    console.log(`FILES_CHANGED: Checking file: ${changedFile.relativePath}`);
                });
                
                changeResults = changeResults.filter(changedFile => {
                    const pathParts = changedFile.relativePath.split(path.sep);
                    const isFirstLevel = pathParts.length === 1;
                    
                    console.log(`FILES_CHANGED: File: ${changedFile.relativePath}, pathParts: [${pathParts.join(', ')}], isFirstLevel: ${isFirstLevel}`);
                    
                    if (!isFirstLevel) {
                        console.log(`FILES_CHANGED: ❌ Skipping subdirectory file for non-deep analysis: ${changedFile.relativePath}`);
                    } else {
                        console.log(`FILES_CHANGED: ✅ Keeping first-level file: ${changedFile.relativePath}`);
                    }
                    
                    return isFirstLevel;
                });
                
                console.log(`FILES_CHANGED: Filtered changed files from ${originalChangeCount} to ${changeResults.length} (non-deep analysis)`);
                
                if (changeResults.length === 0) {
                    console.log(`FILES_CHANGED: No relevant file changes for non-deep analysis, skipping re-analysis`);
                    const registry = DirectoryAnalysisSessionRegistry.getInstance();
                    registry.updateSessionStatus(sessionId, 'completed');
                    return;
                }
            }

            console.log(`FILES_CHANGED: Final count of files to re-analyze: ${changeResults.length}`);

            // Step 2: Separate deleted files from files that need re-analysis
            const deletedFiles = changeResults.filter(cf => cf.changeType === 'deleted');
            const filesToAnalyze = changeResults.filter(cf => cf.changeType !== 'deleted');
            
            console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Files to analyze: ${filesToAnalyze.length}`);
            console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Files to delete: ${deletedFiles.length}`);

            // Step 3: Re-analyze only files that exist (not deleted)
            const newAnalysisResults = new Map<string, any>();
            const failedAnalyses: string[] = [];

            for (const changedFile of filesToAnalyze) {
                try {
                    console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Re-analyzing ${changedFile.changeType} file: ${changedFile.relativePath}`);
                    const fullFilePath = path.join(session.filePath, changedFile.relativePath);
                    console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Full path: ${fullFilePath}`);
                    
                    // Use resume analysis for LivePanel (just file summary data)
                    // and regular analysis for XR
                    let analysisResult;
                    if (session.isXR) {
                        // XR Analysis - use regular analysis for full data
                        console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Using FileXRAnalysis for XR mode`);
                        analysisResult = await PythonExecutor.executeAnalysis(
                            'FileXRAnalysis' as AnalysisType,
                            fullFilePath,
                            context
                        );
                    } else {
                        // LivePanel Analysis - use resume analysis for file summary only
                        console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Using file resume analysis for LivePanel mode`);
                        analysisResult = await PythonExecutor.executeFileResumeAnalysis(
                            fullFilePath,
                            context
                        );
                        
                        // For resume analysis, we need to add the relativePath
                        if (analysisResult.success && analysisResult.data) {
                            analysisResult.data.relativePath = changedFile.relativePath;
                        }
                    }

                    if (analysisResult.success && analysisResult.data) {
                        newAnalysisResults.set(changedFile.relativePath, analysisResult.data);
                        console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Successfully re-analyzed: ${changedFile.relativePath}`);
                    } else {
                        console.error(`WATCHER_DIRECTORY_LIVE_PANEL: Failed to re-analyze: ${changedFile.relativePath}`, analysisResult.error);
                        failedAnalyses.push(changedFile.relativePath);
                    }
                } catch (error) {
                    console.error(`WATCHER_DIRECTORY_LIVE_PANEL: Error re-analyzing ${changedFile.relativePath}:`, error);
                    failedAnalyses.push(changedFile.relativePath);
                }
            }

            // Check if we have any successful analysis OR deleted files to process
            const hasAnalysisWork = newAnalysisResults.size > 0 || deletedFiles.length > 0;
            
            if (!hasAnalysisWork) {
                const errorMessage = `No files were successfully re-analyzed and no deleted files to process. Failed analyses: ${failedAnalyses.join(', ')}`;
                console.error(`WATCHER_DIRECTORY_LIVE_PANEL: ${errorMessage}`);
                throw new Error(errorMessage);
            }

            console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Analysis summary - Re-analyzed: ${newAnalysisResults.size} files, Deleted: ${deletedFiles.length} files, Failed: ${failedAnalyses.length}`);

            // Step 4: Replace results in existing JSON (includes both analyzed and deleted files)
            const analysisJsonPath = path.join(session.outputPath, 'data.json');
            
            const replaceResult = await ReplaceInJson.replaceFileAnalysisInJson(
                analysisJsonPath,
                changeResults,
                newAnalysisResults
            );

            if (replaceResult.success) {
                console.log(`REPLACE_JSON_D_LIVE_PANEL: Successfully updated analysis for ${replaceResult.updatedFiles.length} files`);
                
                // Step 5: Update session with new hashes and file list
                await ManageWatcher.updateSessionHashes(sessionId, changeResults);
                await ManageWatcher.updateSessionFileList(sessionId, changeResults);
                
                // Mark session as completed
                const registry = DirectoryAnalysisSessionRegistry.getInstance();
                registry.updateSessionStatus(sessionId, 'completed');
                
                // Send SSE notification
                sseManager.sendUpdate(session.filePath);
                
                vscode.window.showInformationMessage(`📊 Directory analysis updated: ${replaceResult.updatedFiles.length} files`);
            } else {
                throw new Error(`Failed to update analysis JSON: ${replaceResult.errors.join(', ')}`);
            }

        } catch (error) {
            console.error(`WATCHER_DIRECTORY_LIVE_PANEL: Error in reExecuteDirectoryAnalysis:`, error);
            ManageWatcher.setDirectoryFailed(sessionId, error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    /**
     * Update session with new file hashes after successful analysis
     */
    private static async updateSessionHashes(sessionId: string, changeResults: FileChangeResult[]): Promise<void> {
        try {
            const sessionManager = DirectoryAnalysisSessionManager.getInstance();
            const session = sessionManager.getSession(sessionId);
            
            if (!session) {
                throw new Error(`Session ${sessionId} not found`);
            }

            // Ensure metadata exists
            if (!session.metadata) {
                session.metadata = {
                    directorySize: 0,
                    lastModified: new Date()
                };
            }

            // Ensure fileHashes map exists
            if (!(session.metadata as any).fileHashes) {
                (session.metadata as any).fileHashes = new Map<string, string>();
            }

            const fileHashes = (session.metadata as any).fileHashes as Map<string, string>;

            // Update hashes for changed files
            for (const changedFile of changeResults) {
                if (changedFile.changeType === 'deleted') {
                    // Remove hash for deleted files
                    if (fileHashes.has(changedFile.relativePath)) {
                        fileHashes.delete(changedFile.relativePath);
                        console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Removed hash for deleted file: ${changedFile.relativePath}`);
                    }
                } else if (changedFile.newHash) {
                    // Update hash for modified/added files
                    fileHashes.set(changedFile.relativePath, changedFile.newHash);
                    console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Updated hash for ${changedFile.changeType} file ${changedFile.relativePath}: ${changedFile.newHash.substring(0, 16)}...`);
                }
            }

            console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Updated ${changeResults.length} file hashes in session ${sessionId}`);
        } catch (error) {
            console.error(`WATCHER_DIRECTORY_LIVE_PANEL: Error updating session hashes:`, error);
        }
    }

    /**
     * Update session file list for new and deleted files
     */
    private static async updateSessionFileList(sessionId: string, changeResults: FileChangeResult[]): Promise<void> {
        try {
            const sessionManager = DirectoryAnalysisSessionManager.getInstance();
            const session = sessionManager.getSession(sessionId);
            
            if (!session) {
                throw new Error(`Session ${sessionId} not found`);
            }

            // Update file list for new and deleted files
            for (const changedFile of changeResults) {
                if (changedFile.changeType === 'added') {
                    // Add new file to session file list
                    session.filesList.set(changedFile.relativePath, changedFile.filePath);
                    console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Added new file to session: ${changedFile.relativePath}`);
                } else if (changedFile.changeType === 'deleted') {
                    // Remove deleted file from session file list
                    if (session.filesList.has(changedFile.relativePath)) {
                        session.filesList.delete(changedFile.relativePath);
                        console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Removed deleted file from session: ${changedFile.relativePath}`);
                    }
                }
            }

            console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Updated session file list. Total files: ${session.filesList.size}`);
        } catch (error) {
            console.error(`WATCHER_DIRECTORY_LIVE_PANEL: Error updating session file list:`, error);
        }
    }
}
