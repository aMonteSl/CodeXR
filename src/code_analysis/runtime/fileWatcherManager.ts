import * as vscode from 'vscode';
import * as path from 'path';
import { ActiveAnalysisRegistry } from '../active_analyses/registry/activeAnalysisRegistry';
import { StatusBarDelayTimer } from './statusBarDelayTimer';
import { AnalysisSettingsStorage } from '../../utils/analysisSettingsStorage';
import { executeFileAnalysis, runXRFileAnalysisCoordinator } from '../commands/analysisCommands';
import { updateDataJson } from '../utils/tempStorageManager';
import { sseManager } from '../../servers/runtime/sse/SSEManager';

/**
 * Manages file watchers for files under analysis
 * Detects changes to analyzed files and shows placeholder info messages
 */
export class FileWatcherManager {
    private static instance: FileWatcherManager | null = null;
    private watchers: Map<string, vscode.FileSystemWatcher> = new Map();
    private registry: ActiveAnalysisRegistry;
    private delayTimer: StatusBarDelayTimer;

    private constructor(private context: vscode.ExtensionContext) {
        console.log('[FILE_WATCHER_MANAGER] Initializing file watcher manager');
        this.registry = ActiveAnalysisRegistry.getInstance();
        this.delayTimer = StatusBarDelayTimer.getInstance();
        
        // Listen for changes in active analyses to manage watchers
        this.registry.onDidChangeAnalyses(() => {
            this.updateWatchers();
        });
    }

    /**
     * Get the singleton instance of the file watcher manager
     */
    static getInstance(context?: vscode.ExtensionContext): FileWatcherManager {
        if (!FileWatcherManager.instance && context) {
            FileWatcherManager.instance = new FileWatcherManager(context);
        } else if (!FileWatcherManager.instance) {
            throw new Error('FileWatcherManager requires context for initialization');
        }
        return FileWatcherManager.instance;
    }

    /**
     * Update watchers based on current active analyses
     */
    private updateWatchers(): void {
        console.log('[FILE_WATCHER_MANAGER] Updating file watchers');
        
        const analyses = this.registry.getAllAnalyses();
        const currentFiles = new Set<string>();
        
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
    private addWatcher(filePath: string): void {
        console.log(`[FILE_WATCHER_MANAGER] Adding watcher for ${filePath}`);
        
        try {
            // Create a watcher for the specific file
            const pattern = new vscode.RelativePattern(
                path.dirname(filePath),
                path.basename(filePath)
            );
            
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
            
        } catch (error) {
            console.error(`[FILE_WATCHER_MANAGER] Error creating watcher for ${filePath}:`, error);
        }
    }

    /**
     * Handle file change events with auto-analysis delay
     */
    private async onFileChanged(filePath: string): Promise<void> {
        console.log(`[FILE_WATCHER_MANAGER] File changed: ${filePath}`);
        
        // Get analyses for this file
        const analyses = this.registry.getAnalysesForPath(filePath);
        
        if (analyses.length === 0) {
            return;
        }
        
        // Get the current auto-analysis delay setting
        const delayMs = await AnalysisSettingsStorage.getAutoAnalysisDelay(this.context);
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
     private async executeDelayedAnalysis(filePath: string, analyses: any[]): Promise<void> {
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
                analysisData = await runXRFileAnalysisCoordinator(this.context, filePath);
            } else if (staticAnalyses.length > 0) {
                // Run static analysis if there are only static analyses
                console.log(`[FILE_WATCHER_MANAGER] Running static analysis for ${fileName}...`);
                analysisData = await executeFileAnalysis(this.context, filePath);
            } else {
                throw new Error('No valid analysis modes found');
            }
            
            if (!analysisData) {
                throw new Error('Analysis returned no data');
            }
            
            console.log(`[FILE_WATCHER_MANAGER] ✅ Analysis completed for ${fileName}`);
            
            // Step 2: Update existing temp folders with new data.json
            console.log(`[FILE_WATCHER_MANAGER] Updating existing data.json files for ${fileName}...`);
            const updatedFolders = await updateDataJson(this.context, filePath, analysisData);
            
            if (updatedFolders.length > 0) {
                console.log(`[FILE_WATCHER_MANAGER] ✅ Updated ${updatedFolders.length} analysis folder(s) for ${fileName}`);
                
                // Step 3: Send SSE update notification to clients (for both modes)
                console.log(`[FILE_WATCHER_MANAGER] Sending SSE update notification for ${fileName}...`);
                try {
                    sseManager.sendUpdate(filePath);
                    console.log(`[FILE_WATCHER_MANAGER] ✅ SSE update notification sent for ${fileName}`);
                } catch (sseError) {
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
                
                vscode.window.showInformationMessage(
                    `Analysis updated: ${fileName} (${modeInfo.join(', ')} viewer${updatedFolders.length > 1 ? 's' : ''} refreshed)`,
                    { modal: false }
                );
                
                // Update analysis status in registry for all modes
                analyses.forEach(analysis => {
                    console.log(`[FILE_WATCHER_MANAGER] Analysis ${analysis.id} (${analysis.mode}) updated due to file change`);
                    
                    // Update the analysis in registry - mark as completed
                    try {
                        this.registry.updateAnalysis(analysis.id, 'completed', 100);
                    } catch (error) {
                        console.log(`[FILE_WATCHER_MANAGER] Could not update analysis status: ${error}`);
                    }
                });
                
            } else {
                console.log(`[FILE_WATCHER_MANAGER] ⚠️ No existing analysis folders found for ${fileName}`);
                
                // Inform user that no viewers were found to update
                vscode.window.showWarningMessage(
                    `File ${fileName} changed, but no active analysis viewers found to update.`,
                    { modal: false }
                );
            }
            
        } catch (error) {
            console.error(`[FILE_WATCHER_MANAGER] ❌ Failed to execute delayed re-analysis for ${fileName}:`, error);
            
            // Show error message to user
            vscode.window.showErrorMessage(
                `Failed to update analysis for ${fileName}: ${error}`,
                { modal: false }
            );
            
            // Mark analyses as failed (both modes)
            analyses.forEach(analysis => {
                this.registry.failAnalysis(analysis.id, `Re-analysis failed: ${error}`);
            });
        }
    }

    /**
     * Handle file deletion events
     */
    private onFileDeleted(filePath: string): void {
        console.log(`[FILE_WATCHER_MANAGER] File deleted: ${filePath}`);
        
        // Cancel any pending delay timer for this file
        const uri = vscode.Uri.file(filePath);
        this.delayTimer.cancel(uri);
        
        // Get analyses for this file
        const analyses = this.registry.getAnalysesForPath(filePath);
        
        if (analyses.length > 0) {
            const fileName = path.basename(filePath);
            vscode.window.showWarningMessage(
                `File ${fileName} was deleted. Active analyses for this file will be marked as failed.`
            );
            
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
    public watchFile(filePath: string): void {
        console.log(`[FILE_WATCHER_MANAGER] Manually adding file to watch: ${filePath}`);
        if (!this.watchers.has(filePath)) {
            this.addWatcher(filePath);
        }
    }

    /**
     * Manually remove a file from being watched
     */
    public unwatchFile(filePath: string): void {
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
    public getWatchedFiles(): string[] {
        return Array.from(this.watchers.keys());
    }

    /**
     * Dispose all watchers
     */
    public dispose(): void {
        console.log('[FILE_WATCHER_MANAGER] Disposing all file watchers');
        
        // Cancel all delay timers
        this.delayTimer.cancelAll();
        
        for (const [filePath, watcher] of this.watchers) {
            watcher.dispose();
        }
        this.watchers.clear();
    }
}
