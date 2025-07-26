/**
 * Directory Analysis Progress Service
 * Common progress tracking service for all directory analysis types (LivePanel and XR)
 */

import * as vscode from 'vscode';

export interface AnalysisProgressInfo {
    sessionId: string;
    totalFiles: number;
    processedFiles: number;
    currentFile: string;
    analysisType: string;
    percentage: number;
}

export class DirectoryAnalysisProgressService {
    private static instance: DirectoryAnalysisProgressService;
    private activeProgressBars: Map<string, vscode.Progress<{ message?: string; increment?: number }>> = new Map();
    private progressCallbacks: Map<string, (info: AnalysisProgressInfo) => void> = new Map();

    private constructor() {
        console.log('DIRECTORY_PROGRESS_SERVICE: Initializing Directory Analysis Progress Service');
    }

    static getInstance(): DirectoryAnalysisProgressService {
        if (!DirectoryAnalysisProgressService.instance) {
            DirectoryAnalysisProgressService.instance = new DirectoryAnalysisProgressService();
        }
        return DirectoryAnalysisProgressService.instance;
    }

    /**
     * Start progress tracking for a directory analysis session
     */
    async startProgress(
        sessionId: string,
        analysisType: string,
        totalFiles: number,
        title?: string
    ): Promise<void> {
        const progressTitle = title || `Analyzing ${analysisType} Directory`;
        
        console.log(`DIRECTORY_PROGRESS_SERVICE: Starting progress for session ${sessionId} (${analysisType}) - ${totalFiles} files`);

        return new Promise<void>((resolve) => {
            vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: progressTitle,
                    cancellable: false
                },
                async (progress, token) => {
                    // Store the progress object for this session
                    this.activeProgressBars.set(sessionId, progress);

                    // Set up callback for progress updates
                    const progressCallback = (info: AnalysisProgressInfo) => {
                        const percentage = Math.round((info.processedFiles / info.totalFiles) * 100);
                        const fileName = this.getShortFileName(info.currentFile);
                        
                        progress.report({
                            message: `${percentage}% - Analyzing: ${fileName} (${info.processedFiles}/${info.totalFiles} files)`
                        });
                        
                        console.log(`DIRECTORY_PROGRESS_SERVICE: [${sessionId}] ${percentage}% - ${fileName} (${info.processedFiles}/${info.totalFiles})`);
                    };
                    
                    this.progressCallbacks.set(sessionId, progressCallback);
                    
                    // Wait for completion or cancellation
                    return new Promise<void>((progressResolve) => {
                        // Listen for session completion
                        const disposable = setInterval(() => {
                            if (!this.activeProgressBars.has(sessionId)) {
                                clearInterval(disposable);
                                progressResolve();
                            }
                        }, 500);
                        
                        // Store the resolve function for manual completion
                        (this.progressCallbacks.get(sessionId) as any).resolve = progressResolve;
                    });
                }
            ).then(() => {
                resolve();
            });
        });
    }

    /**
     * Update progress for a session
     */
    updateProgress(progressInfo: AnalysisProgressInfo): void {
        const callback = this.progressCallbacks.get(progressInfo.sessionId);
        if (callback) {
            callback(progressInfo);
        }
    }

    /**
     * Complete progress tracking for a session
     */
    completeProgress(sessionId: string, message?: string): void {
        console.log(`DIRECTORY_PROGRESS_SERVICE: Completing progress for session ${sessionId}`);
        
        const progress = this.activeProgressBars.get(sessionId);
        if (progress) {
            progress.report({
                message: message || "Analysis completed!"
            });
        }
        
        // Clean up
        this.activeProgressBars.delete(sessionId);
        const callback = this.progressCallbacks.get(sessionId);
        if (callback && (callback as any).resolve) {
            (callback as any).resolve();
        }
        this.progressCallbacks.delete(sessionId);
    }

    /**
     * Fail progress tracking for a session
     */
    failProgress(sessionId: string, error: string): void {
        console.log(`DIRECTORY_PROGRESS_SERVICE: Failing progress for session ${sessionId}: ${error}`);
        
        const progress = this.activeProgressBars.get(sessionId);
        if (progress) {
            progress.report({
                message: `Analysis failed: ${error}`
            });
        }
        
        // Clean up
        this.activeProgressBars.delete(sessionId);
        const callback = this.progressCallbacks.get(sessionId);
        if (callback && (callback as any).resolve) {
            (callback as any).resolve();
        }
        this.progressCallbacks.delete(sessionId);
    }

    /**
     * Get a shortened file name for display
     */
    private getShortFileName(filePath: string): string {
        if (!filePath) {
            return 'Unknown file';
        }
        
        const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
        
        // Limit file name length for better display
        if (fileName.length > 30) {
            return fileName.substring(0, 27) + '...';
        }
        
        return fileName;
    }

    /**
     * Check if a session has active progress
     */
    hasActiveProgress(sessionId: string): boolean {
        return this.activeProgressBars.has(sessionId);
    }

    /**
     * Dispose of the service
     */
    dispose(): void {
        // Complete all active progress bars
        for (const sessionId of this.activeProgressBars.keys()) {
            this.completeProgress(sessionId, "Service disposed");
        }
        
        this.activeProgressBars.clear();
        this.progressCallbacks.clear();
        console.log('DIRECTORY_PROGRESS_SERVICE: Service disposed');
    }
}
