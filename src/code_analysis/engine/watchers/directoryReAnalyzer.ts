import * as vscode from 'vscode';
/**
 * Directory Re-Analyzer
 * Re-analyzes only the directory entries that actually changed and updates data.json in place.
 */

import * as fs from 'fs';
import * as path from 'path';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { ExecutePython } from '../utils/executePython';
import { SessionServerManager } from '../servers/sessionServerManager';
import { SHA256Generator } from '../../../utils/sha256Generator';
import { FileHashTracker } from './fileHashTracker';
import {
    createEmptyFileEntry,
    hasMatchingLivePanelFile,
    hasMatchingXRFile,
    isXRDataFormat,
    recalculateLivePanelSummary,
    removeDeletedFileFromLivePanelFormat,
    removeDeletedFileFromXRFormat,
    upsertLivePanelFiles,
    upsertXRFiles,
} from './directoryReanalysisData';

interface IncrementalChangeSet {
    removedFiles?: string[];
    updatedResults?: any[];
    addedFiles?: string[];
}

export class DirectoryReAnalyzer {
    private executePython: ExecutePython;
    private sessionServerManager: SessionServerManager;

    constructor(context: vscode.ExtensionContext) {
        this.executePython = new ExecutePython(context);
        this.sessionServerManager = new SessionServerManager(context);
    }

    async reAnalyzeFiles(changedFiles: string[]): Promise<any[] | null> {
        try {
            console.log(`DIRECTORY_REANALYZER: Re-analyzing ${changedFiles.length} changed files`);
            const result = await this.executePython.executeFileReanalysis(changedFiles);

            if (!result || !Array.isArray(result)) {
                console.error('DIRECTORY_REANALYZER: Invalid re-analysis result');
                return null;
            }

            return result;
        } catch (error) {
            console.error('DIRECTORY_REANALYZER: Error during re-analysis:', error);
            return null;
        }
    }

    async applyIncrementalChanges(
        session: UnifiedAnalysisSession,
        changeSet: IncrementalChangeSet,
        hashTracker: FileHashTracker,
    ): Promise<boolean> {
        try {
            if (!session.savedFilesPath) {
                console.error('DIRECTORY_REANALYZER: No saved files path in session');
                return false;
            }

            const dataJsonPath = path.join(session.savedFilesPath, 'data.json');
            if (!fs.existsSync(dataJsonPath)) {
                console.error(`DIRECTORY_REANALYZER: data.json not found at ${dataJsonPath}`);
                return false;
            }

            const currentData = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
            const xrFormat = isXRDataFormat(currentData);
            let hasChanges = false;

            if ((changeSet.removedFiles?.length || 0) > 0) {
                hasChanges = this.applyRemovedFiles(currentData, xrFormat, changeSet.removedFiles!, hashTracker) || hasChanges;
            }

            if ((changeSet.updatedResults?.length || 0) > 0) {
                hasChanges = this.applyUpdatedResults(currentData, xrFormat, changeSet.updatedResults!) || hasChanges;
            }

            if ((changeSet.addedFiles?.length || 0) > 0) {
                hasChanges = await this.applyAddedFiles(currentData, xrFormat, session, changeSet.addedFiles!, hashTracker) || hasChanges;
            }

            if (!hasChanges) {
                return false;
            }

            if (!xrFormat) {
                recalculateLivePanelSummary(currentData);
                if (!currentData.summary) {
                    currentData.summary = {};
                }
                currentData.summary.analyzedAt = new Date().toISOString();
            }

            fs.writeFileSync(dataJsonPath, JSON.stringify(currentData, null, 2), 'utf8');
            await this.sendSSENotification(session);
            return true;
        } catch (error) {
            console.error('DIRECTORY_REANALYZER: Error applying incremental changes:', error);
            return false;
        }
    }

    private applyRemovedFiles(
        currentData: any,
        xrFormat: boolean,
        removedFiles: string[],
        hashTracker: FileHashTracker,
    ): boolean {
        let hasChanges = false;

        for (const removedPath of removedFiles) {
            const removed = xrFormat
                ? removeDeletedFileFromXRFormat(currentData, removedPath)
                : removeDeletedFileFromLivePanelFormat(currentData, removedPath);

            if (removed) {
                hasChanges = true;
            }

            hashTracker.untrackFile(removedPath);
        }

        return hasChanges;
    }

    private applyUpdatedResults(currentData: any, xrFormat: boolean, updatedResults: any[]): boolean {
        if (updatedResults.length === 0) {
            return false;
        }

        return xrFormat
            ? upsertXRFiles(currentData, updatedResults)
            : upsertLivePanelFiles(currentData, updatedResults);
    }

    private async applyAddedFiles(
        currentData: any,
        xrFormat: boolean,
        session: UnifiedAnalysisSession,
        addedFiles: string[],
        hashTracker: FileHashTracker,
    ): Promise<boolean> {
        let hasChanges = false;

        for (const filePath of addedFiles) {
            const alreadyExists = xrFormat
                ? hasMatchingXRFile(currentData, filePath)
                : hasMatchingLivePanelFile(currentData, filePath);

            if (alreadyExists) {
                continue;
            }

            let result: any;
            try {
                const reanalysisResults = await this.executePython.executeFileReanalysis([filePath]);
                result = Array.isArray(reanalysisResults) ? reanalysisResults[0] : reanalysisResults;

                if (!result || result.success === false) {
                    result = createEmptyFileEntry(filePath, session.targetPath);
                }
            } catch (error) {
                console.error(`DIRECTORY_REANALYZER: Error analyzing new file ${filePath}:`, error);
                result = createEmptyFileEntry(filePath, session.targetPath);
            }

            if (xrFormat) {
                upsertXRFiles(currentData, [result]);
            } else {
                upsertLivePanelFiles(currentData, [result]);
            }
            hasChanges = true;

            try {
                const hash = await SHA256Generator.generateFileHash(filePath);
                await hashTracker.trackNewFile(filePath, hash);
            } catch (hashError) {
                console.error(`DIRECTORY_REANALYZER: Error hashing added file ${filePath}:`, hashError);
                await hashTracker.trackNewFile(filePath, '');
            }
        }

        return hasChanges;
    }

    async sendSSENotification(session: UnifiedAnalysisSession): Promise<void> {
        try {
            const { SSEManager } = require('../../../servers/runtime/sse/SSEManager');
            const sseManager = SSEManager.getInstance();

            if (session.analysisMode === 'XR') {
                sseManager.sendDataRefresh(session.targetPath);
            } else {
                sseManager.sendUpdate(session.targetPath);
            }
        } catch (sseError) {
            console.error('DIRECTORY_REANALYZER: SSE direct failed, trying fallback...');
            try {
                await this.sessionServerManager.notifyAnalysisUpdated(session.id);
            } catch (fallbackError) {
                console.error('DIRECTORY_REANALYZER: SSE fallback also failed:', fallbackError);
            }
        }
    }
}


