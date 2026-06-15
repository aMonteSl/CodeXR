/**
 * Directory Watcher Orchestrator
 * Monitors directory sessions and performs incremental re-analysis after debounce.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { UnifiedSessionRegistry } from '../core/sessionRegistry';
import { DebounceManager } from './debounceManager';
import { AnalysisConfigurationStorage } from '../../configuration/analysisConfigurationStorage';
import { ConfigurationConverter } from './configurationConverter';
import { FileHashTracker } from './fileHashTracker';
import { DirectoryReAnalyzer } from './directoryReAnalyzer';
import { ReAnalysisManager } from './reAnalysisManager';
import { handleError, ErrorDomain, ErrorSeverity } from '../../../utils/errorHandler';
import { SHA256Generator } from '../../../utils/sha256Generator';
import { isRelevantDirectoryEvent, shouldIgnoreDirectoryName } from './analysisFilePolicy';
import { scanDirectoryScope } from './directorySnapshot';
import {
    AnalysisSourceChangeBatch,
    analysisRefreshCoordinator,
} from '../../refresh';

export class DirectoryWatcherOrchestrator {
    private watchers: Map<string, fs.FSWatcher> = new Map();
    private debounceManager: DebounceManager | null = null;
    private watcherId: string | null = null;
    private isWatching = false;

    private configurationStorage: AnalysisConfigurationStorage;
    private sourceHashTracker: FileHashTracker;
    private normalHashTracker: FileHashTracker;
    private reAnalyzer: DirectoryReAnalyzer;
    private fullReAnalysisManager: ReAnalysisManager;
    private refreshDisposables: Array<() => void> = [];

    constructor(
        private session: UnifiedAnalysisSession,
        private context: vscode.ExtensionContext,
    ) {
        this.configurationStorage = AnalysisConfigurationStorage.getInstance(context);
        this.sourceHashTracker = new FileHashTracker(session.filesToHash);
        this.normalHashTracker = new FileHashTracker(session.filesToHash);
        this.reAnalyzer = new DirectoryReAnalyzer(context);
        this.fullReAnalysisManager = new ReAnalysisManager(context);
        const runNormalRefresh = this.applyNormalRefresh.bind(this);
        this.refreshDisposables.push(
            analysisRefreshCoordinator.registerHandler(session.id, 'single', runNormalRefresh),
            analysisRefreshCoordinator.registerHandler(session.id, 'historical-compare', runNormalRefresh),
        );
    }

    public async startWatching(): Promise<string | null> {
        try {
            const debounceDelayMs = await this.loadDebounceConfiguration();
            if (debounceDelayMs === -1) {
                return null;
            }

            this.debounceManager = new DebounceManager(
                debounceDelayMs,
                this.handleDebounceCallback.bind(this),
                `Project (${path.basename(this.session.targetPath)})`,
            );
            this.watcherId = `directory_watcher_${this.session.id}_${Date.now()}`;

            const snapshot = await scanDirectoryScope(this.session.targetPath, this.session.isDeep);
            await this.syncDirectoryWatchers(snapshot.watchedDirectories);

            this.isWatching = this.watchers.size > 0;
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: Started with ${this.watchers.size} watched directories`);
            return this.isWatching ? this.watcherId : null;
        } catch (error) {
            handleError(ErrorDomain.Watcher, 'Error starting watcher', error, ErrorSeverity.Log);
            this.cleanup();
            return null;
        }
    }

    public async stopWatching(): Promise<void> {
        this.cleanup();
    }

    public async updateDebounceConfiguration(): Promise<void> {
        try {
            const newDelayMs = await this.loadDebounceConfiguration();
            if (newDelayMs === -1) {
                this.debounceManager?.cancel();
                return;
            }

            this.debounceManager?.updateDelay(newDelayMs);
        } catch (error) {
            handleError(ErrorDomain.Watcher, 'Error updating debounce', error, ErrorSeverity.Log);
        }
    }

    public getWatcherId(): string | null { return this.watcherId; }
    public isActive(): boolean { return this.isWatching; }
    public getWatchedFilesCount(): number { return this.sourceHashTracker.getTrackedFiles().length; }

    private async handleDirectoryChange(dirPath: string, eventType: string, filename?: string): Promise<void> {
        const registry = UnifiedSessionRegistry.getInstance(this.context);
        if (!registry.getSession(this.session.id)) {
            await this.stopWatching();
            return;
        }

        try {
            const autoEnabled = await this.configurationStorage.getAutoAnalysisEnabled();
            if (!autoEnabled) {
                this.debounceManager?.cancel();
                return;
            }
        } catch {
            return;
        }

        if (!filename) {
            this.scheduleDebouncedReanalysis('generic-change');
            return;
        }

        const entryName = filename.toString();
        const fullPath = path.join(dirPath, entryName);
        if (this.sourceHashTracker.shouldSkipEvent(entryName) || shouldIgnoreDirectoryName(entryName)) {
            return;
        }

        if (eventType === 'rename') {
            this.scheduleDebouncedReanalysis(`rename-${entryName}`);
            return;
        }

        if (fs.existsSync(fullPath)) {
            try {
                const stats = fs.statSync(fullPath);
                if (stats.isDirectory()) {
                    if (this.session.isDeep) {
                        this.scheduleDebouncedReanalysis(`directory-${eventType}`);
                    }
                    return;
                }
            } catch {
                // Ignore and let the generic path below decide.
            }
        }

        if (!isRelevantDirectoryEvent(fullPath, this.sourceHashTracker.getTrackedPaths())) {
            return;
        }

        this.scheduleDebouncedReanalysis(`file-${eventType}`);
    }

    private scheduleDebouncedReanalysis(reason: string): void {
        if (!this.debounceManager) {
            return;
        }

        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: Debounce restarted (${reason}) for ${this.session.targetPath}`);
        this.debounceManager.start();
    }

    public async reconcileNow(): Promise<boolean> {
        return this.reconcileSource(false);
    }

    private async handleDebounceCallback(): Promise<void> {
        try {
            const autoEnabled = await this.configurationStorage.getAutoAnalysisEnabled();
            if (!autoEnabled) {
                return;
            }
            await this.reconcileSource(true);
        } catch (error) {
            handleError(ErrorDomain.Watcher, 'Error in debounce callback', error, ErrorSeverity.Log);
        }
    }

    private async reconcileSource(stopWhenSessionMissing: boolean): Promise<boolean> {
        try {
            const registry = UnifiedSessionRegistry.getInstance(this.context);
            if (!registry.getSession(this.session.id)) {
                if (stopWhenSessionMissing) {
                    await this.stopWatching();
                }
                return false;
            }

            const snapshot = await scanDirectoryScope(this.session.targetPath, this.session.isDeep);
            await this.syncDirectoryWatchers(snapshot.watchedDirectories);

            const currentByPath = new Map(snapshot.files.map((entry) => [entry.filePath, entry]));
            const diff = this.sourceHashTracker.diffAgainst(snapshot.files);
            const actuallyChanged = await this.sourceHashTracker.resolveActuallyChanged(diff.suspectedChanged, currentByPath);
            for (const filePath of diff.added) {
                try {
                    const hash = await SHA256Generator.generateFileHash(filePath);
                    await this.sourceHashTracker.trackNewFile(filePath, hash);
                } catch {
                    await this.sourceHashTracker.trackNewFile(filePath, '');
                }
            }
            for (const filePath of diff.removed) {
                this.sourceHashTracker.untrackFile(filePath);
            }
            for (const [filePath, entry] of currentByPath) {
                if (!actuallyChanged.includes(filePath) && !diff.added.includes(filePath)) {
                    this.sourceHashTracker.syncUnchangedFile(filePath, entry);
                }
            }
            this.session.filesToHash = this.sourceHashTracker.getTrackedFiles();

            if (actuallyChanged.length === 0 && diff.added.length === 0 && diff.removed.length === 0) {
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: No actual changes detected for ${this.session.targetPath}`);
                return false;
            }

            const sourceRevision = analysisRefreshCoordinator.publishChanges(this.session.id, {
                changedFiles: actuallyChanged,
                addedFiles: diff.added,
                removedFiles: diff.removed,
            });
            console.log(
                `DIRECTORY_WATCHER_ORCHESTRATOR: Source revision ${sourceRevision} queued `
                + `(${actuallyChanged.length} changed, ${diff.added.length} added, ${diff.removed.length} removed)`,
            );
            return true;
        } catch (error) {
            handleError(ErrorDomain.Watcher, 'Error reconciling directory source', error, ErrorSeverity.Log);
            return false;
        }
    }

    private async applyNormalRefresh(batch: AnalysisSourceChangeBatch): Promise<void> {
        if (
            batch.forceRefresh
            && batch.changedFiles.length === 0
            && batch.addedFiles.length === 0
            && batch.removedFiles.length === 0
        ) {
            const success = await this.fullReAnalysisManager.executeDataJsonRegeneration(
                this.session,
                { notifyClients: this.session.analysisMode !== 'XR' },
            );
            if (!success) {
                throw new Error('Normal full analysis refresh failed.');
            }
            this.normalHashTracker.replaceAll(this.sourceHashTracker.getTrackedFiles());
            return;
        }
        const filesToAnalyze = batch.changedFiles.filter((filePath) => fs.existsSync(filePath));
        const reanalysisResult = filesToAnalyze.length > 0
            ? await this.reAnalyzer.reAnalyzeFiles(filesToAnalyze)
            : [];
        if (reanalysisResult === null) {
            throw new Error('Normal incremental analysis failed.');
        }
        const updatedResults = reanalysisResult;
        await this.reAnalyzer.applyIncrementalChanges(
            this.session,
            {
                removedFiles: batch.removedFiles,
                updatedResults,
                addedFiles: batch.addedFiles.filter((filePath) => fs.existsSync(filePath)),
            },
            this.normalHashTracker,
            { notifyClients: this.session.analysisMode !== 'XR' },
        );
        this.normalHashTracker.replaceAll(this.sourceHashTracker.getTrackedFiles());
    }

    private async loadDebounceConfiguration(): Promise<number> {
        try {
            const autoEnabled = await this.configurationStorage.getAutoAnalysisEnabled();
            if (!autoEnabled) {
                return -1;
            }

            const config = await this.configurationStorage.loadConfiguration();
            return ConfigurationConverter.convertToMilliseconds(config.autoAnalysisDelay);
        } catch {
            return 3000;
        }
    }

    private async syncDirectoryWatchers(nextDirectories: Iterable<string>): Promise<void> {
        const targetDirectories = new Set(nextDirectories);

        for (const currentDir of Array.from(this.watchers.keys())) {
            if (targetDirectories.has(currentDir)) {
                continue;
            }

            try {
                this.watchers.get(currentDir)?.close();
            } catch {
                // Ignore watcher close errors during resync.
            }
            this.watchers.delete(currentDir);
        }

        for (const dirPath of targetDirectories) {
            if (this.watchers.has(dirPath)) {
                continue;
            }

            try {
                const watcher = fs.watch(dirPath, (eventType, filename) => {
                    void this.handleDirectoryChange(dirPath, eventType, filename?.toString());
                });
                this.watchers.set(dirPath, watcher);
            } catch (watchError) {
                handleError(ErrorDomain.Watcher, `Failed to watch ${dirPath}`, watchError, ErrorSeverity.Log);
            }
        }

        this.isWatching = this.watchers.size > 0;
    }

    private cleanup(): void {
        for (const watcher of this.watchers.values()) {
            try {
                watcher.close();
            } catch {
                // Ignore cleanup errors.
            }
        }
        this.watchers.clear();

        this.debounceManager?.dispose();
        this.debounceManager = null;
        for (const dispose of this.refreshDisposables.splice(0)) {
            dispose();
        }
        this.isWatching = false;
        this.watcherId = null;
    }
}
