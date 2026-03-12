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
import {
    createEmptyFileEntry,
    isXRDataFormat,
    recalculateLivePanelSummary,
    removeDeletedFileFromLivePanelFormat,
    removeDeletedFileFromXRFormat,
} from './directoryReanalysisData';

export class DirectoryReAnalyzer {
    private executePython: ExecutePython;
    private sessionServerManager: SessionServerManager;

    constructor(context: vscode.ExtensionContext) {
        this.executePython = new ExecutePython(context);
        this.sessionServerManager = new SessionServerManager(context);
    }

    // -- Re-analysis -------------------------------------------------

    /**
     * Re-analyze an array of changed files using the Python coordinator.
     */
    async reAnalyzeFiles(changedFiles: string[]): Promise<any[] | null> {
        try {
            console.log(`DIRECTORY_REANALYZER: Re-analyzing ${changedFiles.length} changed files`);

            const result = await this.executePython.executeFileReanalysis(changedFiles);

            if (!result || !Array.isArray(result)) {
                console.error('DIRECTORY_REANALYZER: Invalid re-analysis result');
                return null;
            }

            console.log(`DIRECTORY_REANALYZER: Re-analysis completed, received ${result.length} file summaries`);
            return result;
        } catch (error) {
            console.error('DIRECTORY_REANALYZER: Error during re-analysis:', error);
            return null;
        }
    }

    // -- Data.json updates -------------------------------------------

    /**
     * Update the existing data.json with re-analysis results.
     * Automatically detects XR vs LivePanel format from the persisted payload.
     */
    async updateDataJson(session: UnifiedAnalysisSession, reAnalysisResults: any[]): Promise<void> {
        try {
            if (!session.savedFilesPath) {
                console.error('DIRECTORY_REANALYZER: No saved files path in session');
                return;
            }

            const dataJsonPath = path.join(session.savedFilesPath, 'data.json');
            if (!fs.existsSync(dataJsonPath)) {
                console.error(`DIRECTORY_REANALYZER: data.json not found at ${dataJsonPath}`);
                return;
            }

            const currentData = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
            const xrFormat = isXRDataFormat(currentData);

            if (xrFormat) {
                this.updateXRDataJson(currentData, reAnalysisResults, dataJsonPath);
            } else {
                this.updateLivePanelDataJson(currentData, reAnalysisResults, dataJsonPath);
            }

            await this.sendSSENotification(session);
        } catch (error) {
            console.error('DIRECTORY_REANALYZER: Error updating data.json:', error);
        }
    }

    private updateXRDataJson(currentData: any[], results: any[], dataJsonPath: string): void {
        const fileMap = new Map<string, number>();
        currentData.forEach((file: any, index: number) => {
            if (file.filePath) {
                fileMap.set(file.filePath, index);
            }
            if (file.file_path) {
                fileMap.set(file.file_path, index);
            }
        });

        let updated = 0;
        for (const file of results) {
            const filePath = file.filePath ?? file.file_path;
            const index = typeof filePath === 'string' ? fileMap.get(filePath) : undefined;

            if (index !== undefined) {
                currentData[index] = file;
            } else {
                currentData.push(file);
            }
            updated++;
        }

        fs.writeFileSync(dataJsonPath, JSON.stringify(currentData, null, 2), 'utf8');
        console.log(`DIRECTORY_REANALYZER: Updated XR data.json - ${updated} files, total ${currentData.length}`);
    }

    private updateLivePanelDataJson(currentData: any, results: any[], dataJsonPath: string): void {
        if (!currentData.files) {
            currentData.files = [];
        }

        const fileMap = new Map<string, number>();
        currentData.files.forEach((file: any, index: number) => {
            if (file.filePath) {
                fileMap.set(file.filePath, index);
            }
            if (file.file_path) {
                fileMap.set(file.file_path, index);
            }
        });

        let updated = 0;
        for (const file of results) {
            const filePath = file.filePath ?? file.file_path;
            const index = typeof filePath === 'string' ? fileMap.get(filePath) : undefined;

            if (index !== undefined) {
                currentData.files[index] = file;
            } else {
                currentData.files.push(file);
            }
            updated++;
        }

        recalculateLivePanelSummary(currentData);
        if (!currentData.summary) {
            currentData.summary = {};
        }
        currentData.summary.analyzedAt = new Date().toISOString();

        fs.writeFileSync(dataJsonPath, JSON.stringify(currentData, null, 2), 'utf8');
        console.log(`DIRECTORY_REANALYZER: Updated LivePanel data.json - ${updated} files, total ${currentData.files.length}`);
    }

    // -- Added / Deleted file processing -----------------------------

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
            if (!fs.existsSync(dataJsonPath)) {
                return;
            }

            const data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
            const xrFormat = isXRDataFormat(data);
            let hasChanges = false;

            for (const filePath of addedFiles) {
                console.log(`DIRECTORY_REANALYZER: Processing added file: ${filePath}`);

                const existing = xrFormat
                    ? data.find((file: any) => file.file_path === filePath || file.filePath === filePath)
                    : data.files?.find((file: any) => file.file_path === filePath || file.filePath === filePath);

                if (existing) {
                    continue;
                }

                try {
                    const reanalysisResults = await this.executePython.executeFileReanalysis([filePath]);
                    let result = Array.isArray(reanalysisResults) ? reanalysisResults[0] : reanalysisResults;

                    if (!result || result.success === false) {
                        console.log(`DIRECTORY_REANALYZER: File analysis returned no data, creating empty entry: ${filePath}`);
                        result = createEmptyFileEntry(filePath);
                    }

                    if (xrFormat) {
                        data.push(result);
                    } else {
                        if (!data.files) {
                            data.files = [];
                        }
                        data.files.push(result);
                    }

                    hasChanges = true;

                    const hash = await SHA256Generator.generateFileHash(filePath);
                    hashTracker.trackNewFile(filePath, hash);

                    if (session.filesToHash) {
                        session.filesToHash.push({ filePath, hash });
                    }

                    console.log(`DIRECTORY_REANALYZER: Added new file to data.json: ${filePath}`);
                } catch (error) {
                    console.error(`DIRECTORY_REANALYZER: Error analyzing new file ${filePath}:`, error);

                    try {
                        const emptyEntry = createEmptyFileEntry(filePath);
                        if (xrFormat) {
                            data.push(emptyEntry);
                        } else {
                            if (!data.files) {
                                data.files = [];
                            }
                            data.files.push(emptyEntry);
                        }
                        hasChanges = true;
                        console.log(`DIRECTORY_REANALYZER: Created empty entry for failed analysis: ${filePath}`);
                    } catch (createError) {
                        console.error(`DIRECTORY_REANALYZER: Failed to create empty entry for ${filePath}:`, createError);
                    }
                }
            }

            if (!hasChanges) {
                return;
            }

            if (!xrFormat) {
                recalculateLivePanelSummary(data);
                if (!data.summary) {
                    data.summary = {};
                }
                data.summary.analyzedAt = new Date().toISOString();
            }

            fs.writeFileSync(dataJsonPath, JSON.stringify(data, null, 2), 'utf8');
            await this.sendSSENotification(session);
        } catch (error) {
            console.error('DIRECTORY_REANALYZER: Error processing added files:', error);
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
            if (!fs.existsSync(dataJsonPath)) {
                return;
            }

            const data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
            const xrFormat = isXRDataFormat(data);
            let hasChanges = false;

            for (const deletedPath of deletedFiles) {
                console.log(`DIRECTORY_REANALYZER: Processing deleted file: ${deletedPath}`);

                const removed = xrFormat
                    ? removeDeletedFileFromXRFormat(data, deletedPath)
                    : removeDeletedFileFromLivePanelFormat(data, deletedPath);

                if (removed) {
                    console.log(`DIRECTORY_REANALYZER: Removed deleted file from data.json: ${deletedPath}`);
                    hasChanges = true;
                }

                closeFsWatcher(deletedPath);
            }

            if (!hasChanges) {
                return;
            }

            if (!xrFormat) {
                recalculateLivePanelSummary(data);
                if (!data.summary) {
                    data.summary = {};
                }
                data.summary.analyzedAt = new Date().toISOString();
            }

            fs.writeFileSync(dataJsonPath, JSON.stringify(data, null, 2), 'utf8');
            await this.sendSSENotification(session);
        } catch (error) {
            console.error('DIRECTORY_REANALYZER: Error processing deleted files:', error);
        }
    }

    // -- SSE notifications ------------------------------------------

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

            console.log('DIRECTORY_REANALYZER: SSE notification sent');
        } catch (sseError) {
            console.error('DIRECTORY_REANALYZER: SSE direct failed, trying fallback...');
            try {
                await this.sessionServerManager.notifyAnalysisUpdated(session.id);
                console.log('DIRECTORY_REANALYZER: SSE fallback succeeded');
            } catch (fallbackError) {
                console.error('DIRECTORY_REANALYZER: SSE fallback also failed:', fallbackError);
            }
        }
    }
}


