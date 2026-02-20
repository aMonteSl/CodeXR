/**
 * Directory Re-Analyzer
 * Handles re-analysis of changed files, updating data.json (XR and LivePanel formats),
 * processing added/deleted files, recalculating summaries, and sending SSE notifications.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { ExecutePython } from '../utils/executePython';
import { SessionServerManager } from '../servers/sessionServerManager';
import { SHA256Generator } from '../../../utils/sha256Generator';
import { FileHashTracker } from './fileHashTracker';

export class DirectoryReAnalyzer {
    private executePython: ExecutePython;
    private sessionServerManager: SessionServerManager;

    constructor(context: vscode.ExtensionContext) {
        this.executePython = new ExecutePython(context);
        this.sessionServerManager = new SessionServerManager(context);
    }

    // ── Re-analysis ──────────────────────────────────────────────

    /**
     * Re-analyze an array of changed files using the Python coordinator.
     */
    async reAnalyzeFiles(changedFiles: string[]): Promise<any[] | null> {
        try {
            console.log(`DIRECTORY_REANALYZER: Re-analyzing ${changedFiles.length} changed files`);

            const result = await this.executePython.executeFileReanalysis(changedFiles);

            if (!result || !Array.isArray(result)) {
                console.error(`DIRECTORY_REANALYZER: Invalid re-analysis result`);
                return null;
            }

            console.log(`DIRECTORY_REANALYZER: Re-analysis completed, received ${result.length} file summaries`);
            return result;
        } catch (error) {
            console.error(`DIRECTORY_REANALYZER: Error during re-analysis:`, error);
            return null;
        }
    }

    // ── Data.json updates ────────────────────────────────────────

    /**
     * Update the existing data.json with re-analysis results.
     * Automatically detects XR vs LivePanel format.
     */
    async updateDataJson(session: UnifiedAnalysisSession, reAnalysisResults: any[]): Promise<void> {
        try {
            if (!session.savedFilesPath) {
                console.error(`DIRECTORY_REANALYZER: No saved files path in session`);
                return;
            }

            const dataJsonPath = path.join(session.savedFilesPath, 'data.json');
            if (!fs.existsSync(dataJsonPath)) {
                console.error(`DIRECTORY_REANALYZER: data.json not found at ${dataJsonPath}`);
                return;
            }

            const currentData = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));

            if (session.analysisMode === 'XR') {
                this.updateXRDataJson(currentData, reAnalysisResults, dataJsonPath);
            } else {
                this.updateLivePanelDataJson(currentData, reAnalysisResults, dataJsonPath);
            }

            // Send SSE notification after update
            await this.sendSSENotification(session);
        } catch (error) {
            console.error(`DIRECTORY_REANALYZER: Error updating data.json:`, error);
        }
    }

    private updateXRDataJson(currentData: any[], results: any[], dataJsonPath: string): void {
        const fileMap = new Map<string, number>();
        currentData.forEach((file: any, index: number) => {
            fileMap.set(file.filePath, index);
        });

        let updated = 0;
        for (const file of results) {
            const idx = fileMap.get(file.filePath);
            if (idx !== undefined) {
                currentData[idx] = file;
            } else {
                currentData.push(file);
            }
            updated++;
        }

        fs.writeFileSync(dataJsonPath, JSON.stringify(currentData, null, 2), 'utf8');
        console.log(`DIRECTORY_REANALYZER: Updated XR data.json — ${updated} files, total ${currentData.length}`);
    }

    private updateLivePanelDataJson(currentData: any, results: any[], dataJsonPath: string): void {
        if (!currentData.files) { currentData.files = []; }

        const fileMap = new Map<string, number>();
        currentData.files.forEach((file: any, index: number) => {
            fileMap.set(file.filePath, index);
        });

        let updated = 0;
        for (const file of results) {
            const idx = fileMap.get(file.filePath);
            if (idx !== undefined) {
                currentData.files[idx] = file;
            } else {
                currentData.files.push(file);
            }
            updated++;
        }

        this.recalculateSummary(currentData);
        if (!currentData.summary) { currentData.summary = {}; }
        currentData.summary.analyzedAt = new Date().toISOString();

        fs.writeFileSync(dataJsonPath, JSON.stringify(currentData, null, 2), 'utf8');
        console.log(`DIRECTORY_REANALYZER: Updated LivePanel data.json — ${updated} files, total ${currentData.files.length}`);
    }

    // ── Added / Deleted file processing ──────────────────────────

    /**
     * Analyze newly added files and append them to data.json.
     */
    async handleAddedFiles(
        session: UnifiedAnalysisSession,
        addedFiles: string[],
        hashTracker: FileHashTracker,
    ): Promise<void> {
        try {
            const dataJsonPath = path.join(session.savedFilesPath!, 'data.json');
            if (!fs.existsSync(dataJsonPath)) { return; }

            const data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
            let hasChanges = false;

            // Detect format for handling both XR (array) and LivePanel (object with .files)
            const isXRFormat = Array.isArray(data);

            for (const filePath of addedFiles) {
                console.log(`DIRECTORY_REANALYZER: Processing added file: ${filePath}`);

                // Check if already present (handle both formats)
                let existing: any;
                if (isXRFormat) {
                    existing = data.find((f: any) =>
                        f.file_path === filePath || f.filePath === filePath,
                    );
                } else {
                    existing = data.files?.find((f: any) =>
                        f.file_path === filePath || f.filePath === filePath,
                    );
                }
                if (existing) { continue; }

                try {
                    const tempSession = {
                        ...session,
                        analysisMode: 'LivePanel' as const,
                        targetType: 'file' as const,
                        targetPath: filePath,
                    };

                    let result = await this.executePython.executeAnalysis(tempSession);

                    // If result is null/undefined or analysis failed, create empty entry
                    // This ensures new files appear in visualizations even if they're empty
                    if (!result || result.success === false) {
                        console.log(`DIRECTORY_REANALYZER: File analysis returned no data, creating empty entry: ${filePath}`);
                        result = this.createEmptyFileEntry(filePath);
                    }

                    // Add to appropriate format
                    if (isXRFormat) {
                        data.push(result);
                    } else {
                        if (!data.files) { data.files = []; }
                        data.files.push(result);
                    }
                    
                    hasChanges = true;

                    // Track the new file's hash
                    const hash = await SHA256Generator.generateFileHash(filePath);
                    hashTracker.trackNewFile(filePath, hash);

                    // Update session's filesToHash
                    if (session.filesToHash) {
                        session.filesToHash.push({ filePath, hash });
                    }

                    console.log(`DIRECTORY_REANALYZER: Added new file to data.json: ${filePath}`);
                } catch (err) {
                    console.error(`DIRECTORY_REANALYZER: Error analyzing new file ${filePath}:`, err);
                    // Even if analysis fails, create empty entry so file appears in visualization
                    try {
                        const emptyEntry = this.createEmptyFileEntry(filePath);
                        if (isXRFormat) {
                            data.push(emptyEntry);
                        } else {
                            if (!data.files) { data.files = []; }
                            data.files.push(emptyEntry);
                        }
                        hasChanges = true;
                        console.log(`DIRECTORY_REANALYZER: Created empty entry for failed analysis: ${filePath}`);
                    } catch (createErr) {
                        console.error(`DIRECTORY_REANALYZER: Failed to create empty entry for ${filePath}:`, createErr);
                    }
                }
            }

            if (hasChanges) {
                fs.writeFileSync(dataJsonPath, JSON.stringify(data, null, 2), 'utf8');
                await this.refreshSummaryAndNotify(session);
            }
        } catch (error) {
            console.error(`DIRECTORY_REANALYZER: Error processing added files:`, error);
        }
    }

    /**
     * Remove deleted files from data.json.
     * Handles both XR format (plain array) and LivePanel format (object with .files property).
     */
    async handleDeletedFiles(
        session: UnifiedAnalysisSession,
        deletedFiles: string[],
        closeFsWatcher: (filePath: string) => void,
    ): Promise<void> {
        try {
            const dataJsonPath = path.join(session.savedFilesPath!, 'data.json');
            if (!fs.existsSync(dataJsonPath)) { return; }

            const data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
            let hasChanges = false;

            // Detect format: XR format is a plain array, LivePanel is an object with .files
            const isXRFormat = Array.isArray(data);

            for (const deletedPath of deletedFiles) {
                console.log(`DIRECTORY_REANALYZER: Processing deleted file: ${deletedPath}`);

                if (isXRFormat) {
                    // XR format: data is the array directly
                    hasChanges = this.removeDeletedFileFromXRFormat(data, deletedPath) || hasChanges;
                } else {
                    // LivePanel format: data.files is the array
                    hasChanges = this.removeDeletedFileFromLivePanelFormat(data, deletedPath) || hasChanges;
                }

                // Close any individual file watcher
                closeFsWatcher(deletedPath);
            }

            if (hasChanges) {
                fs.writeFileSync(dataJsonPath, JSON.stringify(data, null, 2), 'utf8');
                
                // For LivePanel, recalculate summary after deletion
                if (!isXRFormat) {
                    this.recalculateSummary(data);
                    fs.writeFileSync(dataJsonPath, JSON.stringify(data, null, 2), 'utf8');
                }
                
                await this.sendSSENotification(session);
            }
        } catch (error) {
            console.error(`DIRECTORY_REANALYZER: Error processing deleted files:`, error);
        }
    }

    /**
     * Remove a deleted file from XR format (plain array).
     * Returns true if an entry was removed, false otherwise.
     */
    private removeDeletedFileFromXRFormat(data: any[], deletedPath: string): boolean {
        const idx = data.findIndex((f: any) =>
            f.file_path === deletedPath || f.filePath === deletedPath,
        );

        if (idx !== -1) {
            data.splice(idx, 1);
            console.log(`DIRECTORY_REANALYZER: [XR Format] Removed from data.json: ${deletedPath}`);
            return true;
        }
        return false;
    }

    /**
     * Remove a deleted file from LivePanel format (object with .files array).
     * Returns true if an entry was removed, false otherwise.
     */
    private removeDeletedFileFromLivePanelFormat(data: any, deletedPath: string): boolean {
        if (!data.files || !Array.isArray(data.files)) {
            return false;
        }

        const idx = data.files.findIndex((f: any) =>
            f.file_path === deletedPath || f.filePath === deletedPath,
        );

        if (idx !== -1) {
            data.files.splice(idx, 1);
            console.log(`DIRECTORY_REANALYZER: [LivePanel Format] Removed from data.json: ${deletedPath}`);
            return true;
        }
        return false;
    }

    // ── Summary recalculation ────────────────────────────────────

    /**
     * Recalculate the summary object in-place for LivePanel data format.
     */
    recalculateSummary(data: any): void {
        if (!data.files || !Array.isArray(data.files)) { return; }

        const summary: Record<string, any> = {
            totalFiles: data.files.length,
            totalFilesAnalyzed: 0,
            totalFilesNotAnalyzed: 0,
            totalLines: 0,
            totalLinesOfCode: 0,
            totalComments: 0,
            totalBlankLines: 0,
            totalFunctions: 0,
            totalClasses: 0,
            averageComplexity: 0,
            languages: {} as Record<string, number>,
        };

        let totalComplexity = 0;
        let filesWithComplexity = 0;

        for (const file of data.files) {
            if (file.status === 'success') {
                summary.totalFilesAnalyzed++;
                summary.totalLines += file.totalLines || 0;
                summary.totalLinesOfCode += file.codeLines || 0;
                summary.totalComments += file.commentLines || 0;
                summary.totalBlankLines += file.blankLines || 0;
                summary.totalFunctions += file.functionCount || 0;
                summary.totalClasses += file.classCount || 0;

                const complexity = file.cyclomaticComplexityNumber || file.maxComplexity || 0;
                if (complexity > 0) {
                    totalComplexity += complexity;
                    filesWithComplexity++;
                }

                const language = file.language || 'Unknown';
                summary.languages[language] = (summary.languages[language] || 0) + 1;
            } else {
                summary.totalFilesNotAnalyzed++;
            }
        }

        summary.averageComplexity = filesWithComplexity > 0
            ? Math.round((totalComplexity / filesWithComplexity) * 100) / 100
            : 0;

        data.summary = { ...data.summary, ...summary };

        console.log(`DIRECTORY_REANALYZER: Summary recalculated — ${summary.totalFilesAnalyzed}/${summary.totalFiles} files analyzed`);
    }

    // ── SSE notifications ────────────────────────────────────────

    /**
     * Send SSE notification to update connected clients.
     */
    async sendSSENotification(session: UnifiedAnalysisSession): Promise<void> {
        try {
            const { SSEManager } = require('../../../servers/runtime/sse/SSEManager');
            const sseManager = SSEManager.getInstance();

            if (session.analysisMode === 'XR') {
                sseManager.sendDataRefresh(session.targetPath);
            } else {
                sseManager.sendUpdate(session.targetPath);
            }

            console.log(`DIRECTORY_REANALYZER: SSE notification sent`);
        } catch (sseError) {
            console.error(`DIRECTORY_REANALYZER: SSE direct failed, trying fallback...`);
            try {
                await this.sessionServerManager.notifyAnalysisUpdated(session.id);
                console.log(`DIRECTORY_REANALYZER: SSE fallback succeeded`);
            } catch (fallbackError) {
                console.error(`DIRECTORY_REANALYZER: SSE fallback also failed:`, fallbackError);
            }
        }
    }

    // ── Internal helpers ─────────────────────────────────────────

    private async refreshSummaryAndNotify(session: UnifiedAnalysisSession): Promise<void> {
        try {
            const dataJsonPath = path.join(session.savedFilesPath!, 'data.json');
            if (!fs.existsSync(dataJsonPath)) { return; }

            const data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
            this.recalculateSummary(data);
            fs.writeFileSync(dataJsonPath, JSON.stringify(data, null, 2), 'utf8');

            await this.sendSSENotification(session);
        } catch (error) {
            console.error(`DIRECTORY_REANALYZER: Error refreshing summary:`, error);
        }
    }

    /**
     * Create an empty file entry with all metrics set to 0.
     * Used when a file is created but empty, or when analysis fails.
     * This ensures files appear in visualizations even without analysis data.
     */
    private createEmptyFileEntry(filePath: string): any {
        const fileName = path.basename(filePath);
        const ext = path.extname(filePath).toLowerCase();
        
        return {
            fileName,
            filePath,
            language: this.getLanguageFromExtension(ext),
            timestamp: new Date().toISOString(),
            status: 'empty',
            
            // Basic metrics - all zeros
            totalLines: 0,
            codeLines: 0,
            commentLines: 0,
            blankLines: 0,
            classCount: 0,
            functionCount: 0,
            
            // Complexity metrics - all zeros
            complexity: {
                averageComplexity: 0,
                maxComplexity: 0,
                functionCount: 0,
                highComplexityFunctions: 0,
                criticalComplexityFunctions: 0
            },
            
            // Functions and Classes - empty arrays
            functions: [],
            classes: [],
            
            // Additional metrics
            commentRatio: 0.0,
            
            // For LivePanel format compatibility
            file_path: filePath,  // Alternative key for format compatibility
        };
    }

    /**
     * Detect language from file extension.
     */
    private getLanguageFromExtension(ext: string): string {
        const languageMap: { [key: string]: string } = {
            '.js': 'JavaScript',
            '.ts': 'TypeScript',
            '.tsx': 'TypeScript',
            '.jsx': 'JavaScript',
            '.py': 'Python',
            '.java': 'Java',
            '.cpp': 'C++',
            '.c': 'C',
            '.cs': 'C#',
            '.go': 'Go',
            '.rs': 'Rust',
            '.rb': 'Ruby',
            '.php': 'PHP',
            '.swift': 'Swift',
            '.kt': 'Kotlin',
            '.scala': 'Scala',
            '.vue': 'Vue',
            '.html': 'HTML',
            '.css': 'CSS',
            '.scss': 'SCSS',
            '.less': 'LESS',
        };
        return languageMap[ext] || 'Unknown';
    }
}
