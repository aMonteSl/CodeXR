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
import { handleError, ErrorDomain, ErrorSeverity } from '../../../utils/errorHandler';
import { isRelevantDirectoryEvent, shouldIgnoreDirectoryName } from './analysisFilePolicy';
import { scanDirectoryScope } from './directorySnapshot';

export class DirectoryWatcherOrchestrator {
    private watchers: Map<string, fs.FSWatcher> = new Map();
    private debounceManager: DebounceManager | null = null;
    private watcherId: string | null = null;
    private isWatching = false;

    private configurationStorage: AnalysisConfigurationStorage;
    private hashTracker: FileHashTracker;
    private reAnalyzer: DirectoryReAnalyzer;

    constructor(
        private session: UnifiedAnalysisSession,
        private context: vscode.ExtensionContext,
    ) {
        this.configurationStorage = AnalysisConfigurationStorage.getInstance(context);
        this.hashTracker = new FileHashTracker(session.filesToHash);
        this.reAnalyzer = new DirectoryReAnalyzer(context);
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
    public getWatchedFilesCount(): number { return this.hashTracker.getTrackedFiles().length; }

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
        if (this.hashTracker.shouldSkipEvent(entryName) || shouldIgnoreDirectoryName(entryName)) {
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

        if (!isRelevantDirectoryEvent(fullPath, this.hashTracker.getTrackedPaths())) {
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

    private async handleDebounceCallback(): Promise<void> {
        try {
            const autoEnabled = await this.configurationStorage.getAutoAnalysisEnabled();
            if (!autoEnabled) {
                return;
            }

            const registry = UnifiedSessionRegistry.getInstance(this.context);
            if (!registry.getSession(this.session.id)) {
                await this.stopWatching();
                return;
            }

            const snapshot = await scanDirectoryScope(this.session.targetPath, this.session.isDeep);
            await this.syncDirectoryWatchers(snapshot.watchedDirectories);

            const currentByPath = new Map(snapshot.files.map((entry) => [entry.filePath, entry]));
            const diff = this.hashTracker.diffAgainst(snapshot.files);
            const actuallyChanged = await this.hashTracker.resolveActuallyChanged(diff.suspectedChanged, currentByPath);
            const updatedResults = actuallyChanged.length > 0
                ? await this.reAnalyzer.reAnalyzeFiles(actuallyChanged) ?? []
                : [];

            const hasChanges = await this.reAnalyzer.applyIncrementalChanges(
                this.session,
                {
                    removedFiles: diff.removed,
                    updatedResults,
                    addedFiles: diff.added,
                },
                this.hashTracker,
            );

            this.session.filesToHash = this.hashTracker.getTrackedFiles();

            if (!hasChanges) {
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: No actual changes detected for ${this.session.targetPath}`);
                return;
            }

            console.log(
                `DIRECTORY_WATCHER_ORCHESTRATOR: Re-analysis applied (${actuallyChanged.length} changed, ${diff.added.length} added, ${diff.removed.length} removed)`,
            );
        } catch (error) {
            handleError(ErrorDomain.Watcher, 'Error in debounce callback', error, ErrorSeverity.Log);
        }
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
        this.isWatching = false;
        this.watcherId = null;
    }
}
