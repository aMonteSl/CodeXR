/**
 * Directory Watcher Orchestrator
 * Thin coordinator that ties together FileHashTracker, ChangeAccumulator,
 * DirectoryReAnalyzer and DebounceManager to monitor directory-based sessions.
 *
 * Decomposed from the original 1102-line god-object into 4 single-responsibility classes
 * (Phase 4 refactoring).
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
import { ChangeAccumulator } from './changeAccumulator';
import { DirectoryReAnalyzer } from './directoryReAnalyzer';
import { handleError, ErrorDomain, ErrorSeverity } from '../../../utils/errorHandler';

export class DirectoryWatcherOrchestrator {
    private watchers: Map<string, fs.FSWatcher> = new Map();
    private debounceManager: DebounceManager | null = null;
    private watcherId: string | null = null;
    private isWatching: boolean = false;

    private configurationStorage: AnalysisConfigurationStorage;
    private hashTracker: FileHashTracker;
    private accumulator: ChangeAccumulator;
    private reAnalyzer: DirectoryReAnalyzer;

    constructor(
        private session: UnifiedAnalysisSession,
        private context: vscode.ExtensionContext,
    ) {
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: Initializing for session ${session.id}`);
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: Target: ${session.targetPath} (${session.targetType}/${session.analysisMode})`);
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: Files to watch: ${session.filesToHash?.length || 0}`);

        this.configurationStorage = AnalysisConfigurationStorage.getInstance(context);
        this.hashTracker = new FileHashTracker(session.filesToHash);
        this.accumulator = new ChangeAccumulator();
        this.reAnalyzer = new DirectoryReAnalyzer(context);
    }

    // ── Public API ───────────────────────────────────────────────

    /**
     * Start directory-based watching (creates one fs.watch per tracked directory).
     */
    public async startWatching(): Promise<string | null> {
        try {
            const dirs = this.hashTracker.getWatchedDirectories();
            if (dirs.size === 0) {
                console.warn(`DIRECTORY_WATCHER_ORCHESTRATOR: No directories to watch`);
                return null;
            }

            const debounceDelayMs = await this.loadDebounceConfiguration();
            if (debounceDelayMs === -1) {
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: Auto-Analysis DISABLED  skipping watcher setup`);
                return null;
            }

            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: Watching ${dirs.size} directories with ${debounceDelayMs}ms debounce`);

            // Warn on large projects
            if (dirs.size > 100) {
                console.warn(`DIRECTORY_WATCHER_ORCHESTRATOR: Large project (${dirs.size} dirs)`);
                vscode.window.showWarningMessage(
                    `CodeXR: Large project detected (${dirs.size} directories). Consider disabling auto-analysis in settings.`,
                    'Open Settings',
                ).then(selection => {
                    if (selection === 'Open Settings') {
                        vscode.commands.executeCommand('newCodeAnalysis.showAnalysisSettings');
                    }
                });
            }

            this.debounceManager = new DebounceManager(
                debounceDelayMs,
                this.handleDebounceCallback.bind(this),
                `Project (${dirs.size} dirs)`,
            );

            this.watcherId = `directory_watcher_${this.session.id}_${Date.now()}`;

            for (const dirPath of dirs) {
                try {
                    const watcher = fs.watch(dirPath, (eventType, filename) => {
                        if (filename) {
                            this.handleDirectoryChange(dirPath, eventType, filename).catch(err =>
                                handleError(ErrorDomain.Watcher, 'handleDirectoryChange', err, ErrorSeverity.Log),
                            );
                        }
                    });
                    this.watchers.set(dirPath, watcher);
                } catch (watchError) {
                    handleError(ErrorDomain.Watcher, `Failed to watch ${dirPath}`, watchError, ErrorSeverity.Log);
                }
            }

            this.isWatching = true;
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: Started with ID ${this.watcherId}, watching ${this.watchers.size} dirs`);
            return this.watcherId;
        } catch (error) {
            handleError(ErrorDomain.Watcher, 'Error starting watcher', error, ErrorSeverity.Log);
            this.cleanup();
            return null;
        }
    }

    public async stopWatching(): Promise<void> {
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: Stopping for session ${this.session.id}`);
        this.cleanup();
    }

    public async updateDebounceConfiguration(): Promise<void> {
        try {
            const newDelayMs = await this.loadDebounceConfiguration();

            if (newDelayMs === -1) {
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: Auto-Analysis now DISABLED  stopping`);
                await this.stopWatching();
                return;
            }

            if (this.debounceManager) {
                const oldDelay = this.debounceManager.getDelay();
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: Updating debounce ${oldDelay}ms  ${newDelayMs}ms`);
                this.debounceManager.updateDelay(newDelayMs);
            }
        } catch (error) {
            handleError(ErrorDomain.Watcher, 'Error updating debounce', error, ErrorSeverity.Log);
        }
    }

    public getWatcherId(): string | null { return this.watcherId; }
    public isActive(): boolean { return this.isWatching; }
    public getWatchedFilesCount(): number { return this.watchers.size; }
    public getChangedFilesCount(): number { return this.accumulator.totalCount(); }

    // ── FS event handling ────────────────────────────────────────

    private async handleDirectoryChange(dirPath: string, eventType: string, filename: string): Promise<void> {
        const fullPath = path.join(dirPath, filename);

        // Fast-path filters
        if (this.hashTracker.shouldSkipEvent(filename)) { return; }

        try {
            const autoEnabled = await this.configurationStorage.getAutoAnalysisEnabled();
            if (!autoEnabled) { return; }
        } catch { return; }

        if (!this.hashTracker.isAnalyzableExtension(fullPath)) { return; }

        const dirFiles = this.hashTracker.getDirectoryFiles(dirPath);
        if (!dirFiles) { return; }

        const wasTracked = dirFiles.has(filename);
        const fileExists = fs.existsSync(fullPath);

        if (eventType === 'rename') {
            if (fileExists && !wasTracked) {
                this.accumulator.addAdded(fullPath);
            } else if (!fileExists && wasTracked) {
                this.accumulator.addDeleted(fullPath);
                this.hashTracker.untrackFile(dirPath, filename);
            }
        } else if (eventType === 'change' && wasTracked && fileExists) {
            const changed = await this.hashTracker.hasFileChanged(dirPath, filename, fullPath);
            if (changed) {
                this.accumulator.addChanged(fullPath);
            }
        }

        // Start/restart debounce if pending changes exist
        if (this.accumulator.hasChanges()) {
            const delayMs = await this.loadDebounceConfiguration();
            if (delayMs === -1) { return; }

            // Recreate debounce manager with fresh config
            if (this.debounceManager) { this.debounceManager.dispose(); }
            this.debounceManager = new DebounceManager(
                delayMs,
                this.handleDebounceCallback.bind(this),
                `Project (${this.hashTracker.getWatchedDirectories().size} dirs)`,
            );
            this.debounceManager.start();
        }
    }

    // ── Debounce callback ────────────────────────────────────────

    private async handleDebounceCallback(): Promise<void> {
        try {
            // Check auto-analysis is still enabled
            const autoEnabled = await this.configurationStorage.getAutoAnalysisEnabled();
            if (!autoEnabled) {
                this.accumulator.clear();
                return;
            }

            // Session still alive?
            const registry = UnifiedSessionRegistry.getInstance(this.context);
            if (!registry.getSession(this.session.id)) {
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: Session ${this.session.id} gone  stopping`);
                this.stopWatching();
                return;
            }

            const changes = this.accumulator.consumeAll();
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: Debounce fired  ${changes.changed.length} modified, ${changes.added.length} added, ${changes.deleted.length} deleted`);

            let hasChanges = false;

            // 1. Modified files
            if (changes.changed.length > 0) {
                const actuallyChanged = await this.hashTracker.filterActuallyChanged(changes.changed);
                if (actuallyChanged.length > 0) {
                    const results = await this.reAnalyzer.reAnalyzeFiles(actuallyChanged);
                    if (results) {
                        await this.reAnalyzer.updateDataJson(this.session, results);
                    }
                    hasChanges = true;
                }
            }

            // 2. Added files
            if (changes.added.length > 0) {
                await this.reAnalyzer.handleAddedFiles(this.session, changes.added, this.hashTracker);
                hasChanges = true;
            }

            // 3. Deleted files
            if (changes.deleted.length > 0) {
                await this.reAnalyzer.handleDeletedFiles(
                    this.session,
                    changes.deleted,
                    (filePath) => this.closeSingleWatcher(filePath),
                );
                hasChanges = true;
            }

            if (!hasChanges) {
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: No actual changes detected`);
            }
        } catch (error) {
            handleError(ErrorDomain.Watcher, 'Error in debounce callback', error, ErrorSeverity.Log);
            this.accumulator.clear();
        }
    }

    // ── Internal helpers ─────────────────────────────────────────

    private async loadDebounceConfiguration(): Promise<number> {
        try {
            const autoEnabled = await this.configurationStorage.getAutoAnalysisEnabled();
            if (!autoEnabled) { return -1; }

            const config = await this.configurationStorage.loadConfiguration();
            return ConfigurationConverter.convertToMilliseconds(config.autoAnalysisDelay);
        } catch {
            return 3000; // Default fallback
        }
    }

    private closeSingleWatcher(filePath: string): void {
        if (this.watchers.has(filePath)) {
            try {
                this.watchers.get(filePath)?.close();
                this.watchers.delete(filePath);
            } catch (error) {
                handleError(ErrorDomain.Watcher, `Error closing watcher for ${filePath}`, error, ErrorSeverity.Warn);
            }
        }
    }

    private cleanup(): void {
        for (const [, watcher] of this.watchers) {
            try { watcher.close(); } catch { /* ignore */ }
        }
        this.watchers.clear();

        if (this.debounceManager) {
            this.debounceManager.dispose();
            this.debounceManager = null;
        }

        this.accumulator.clear();
        this.isWatching = false;
        this.watcherId = null;

        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: Cleanup completed`);
    }
}
