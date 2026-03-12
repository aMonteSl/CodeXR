/**
 * File Watcher Orchestrator
 * Handles file-based re-analysis for XR, LivePanel and VisualizeDOM sessions.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { UnifiedSessionRegistry } from '../core/sessionRegistry';
import { ReAnalysisManager } from './reAnalysisManager';
import { DebounceManager, DebounceStatus } from './debounceManager';
import { AnalysisConfigurationStorage } from '../../configuration/analysisConfigurationStorage';
import { ConfigurationConverter } from './configurationConverter';
import { getFileStatSnapshot } from './directorySnapshot';
import { SHA256Generator } from '../../../utils/sha256Generator';

export class FileWatcherOrchestrator {
    private watcher: fs.FSWatcher | null = null;
    private debounceManager: DebounceManager | null = null;
    private reAnalysisManager: ReAnalysisManager;
    private watcherId: string | null = null;
    private isWatching = false;
    private configurationStorage: AnalysisConfigurationStorage;
    private lastKnownMtimeMs?: number;
    private lastKnownSize?: number;

    constructor(
        private session: UnifiedAnalysisSession,
        private context: vscode.ExtensionContext,
    ) {
        this.reAnalysisManager = new ReAnalysisManager(context);
        this.configurationStorage = AnalysisConfigurationStorage.getInstance(context);
    }

    private async loadDebounceConfiguration(): Promise<number> {
        try {
            const autoAnalysisEnabled = await this.configurationStorage.getAutoAnalysisEnabled();
            if (!autoAnalysisEnabled) {
                return -1;
            }

            const config = await this.configurationStorage.loadConfiguration();
            return ConfigurationConverter.convertToMilliseconds(config.autoAnalysisDelay);
        } catch {
            return 3000;
        }
    }

    async startWatching(): Promise<string | null> {
        if (this.isWatching) {
            return this.watcherId;
        }

        const targetPath = this.session.targetPath;
        if (!fs.existsSync(targetPath)) {
            console.error(`FILE_WATCHER_ORCHESTRATOR: Target file does not exist: ${targetPath}`);
            return null;
        }

        const initialSnapshot = await getFileStatSnapshot(targetPath);
        if (initialSnapshot) {
            this.lastKnownMtimeMs = initialSnapshot.mtimeMs;
            this.lastKnownSize = initialSnapshot.size;
        }

        const parentDirectory = path.dirname(targetPath);
        const targetName = path.basename(targetPath);

        try {
            this.watcher = fs.watch(parentDirectory, (eventType, filename) => {
                if (!filename || filename === targetName) {
                    void this.onFileChanged(eventType);
                }
            });

            this.isWatching = true;
            this.watcherId = `watcher_${this.session.id}_${Date.now()}`;
            return this.watcherId;
        } catch (error) {
            console.error('FILE_WATCHER_ORCHESTRATOR: Error starting file watcher:', error);
            this.isWatching = false;
            return null;
        }
    }

    private async onFileChanged(eventType: string): Promise<void> {
        const sessionRegistry = UnifiedSessionRegistry.getInstance(this.context);
        const currentSession = sessionRegistry.getSession(this.session.id);
        if (!currentSession) {
            this.stopWatching();
            return;
        }

        const delayMs = await this.loadDebounceConfiguration();
        if (delayMs === -1) {
            return;
        }

        if (this.debounceManager) {
            this.debounceManager.dispose();
        }

        this.debounceManager = new DebounceManager(
            delayMs,
            () => this.executeReAnalysisIfNeeded(),
            path.basename(this.session.targetPath),
        );
        this.debounceManager.start();
        console.log(`FILE_WATCHER_ORCHESTRATOR: Debounce restarted after ${eventType} for ${this.session.targetPath}`);
    }

    private async executeReAnalysisIfNeeded(): Promise<void> {
        const sessionRegistry = UnifiedSessionRegistry.getInstance(this.context);
        const currentSession = sessionRegistry.getSession(this.session.id);
        if (!currentSession) {
            this.stopWatching();
            return;
        }

        const statSnapshot = await getFileStatSnapshot(this.session.targetPath);
        if (!statSnapshot) {
            console.warn(`FILE_WATCHER_ORCHESTRATOR: Target file is not accessible yet: ${this.session.targetPath}`);
            return;
        }

        if (this.lastKnownMtimeMs === statSnapshot.mtimeMs && this.lastKnownSize === statSnapshot.size) {
            console.log(`FILE_WATCHER_ORCHESTRATOR: Ignoring duplicate event for ${this.session.targetPath}`);
            return;
        }

        let currentHash: string;
        try {
            currentHash = await SHA256Generator.generateFileHash(this.session.targetPath);
        } catch (error) {
            console.error('FILE_WATCHER_ORCHESTRATOR: Failed to calculate file hash:', error);
            return;
        }

        if (currentHash === this.session.hash256) {
            this.lastKnownMtimeMs = statSnapshot.mtimeMs;
            this.lastKnownSize = statSnapshot.size;
            this.session.metadata.lastModified = new Date(statSnapshot.mtimeMs);
            this.session.metadata.targetSize = statSnapshot.size;
            console.log(`FILE_WATCHER_ORCHESTRATOR: Skipping re-analysis because hash did not change for ${this.session.targetPath}`);
            return;
        }

        sessionRegistry.updateSessionStatus(this.session.id, 'analyzing', 50);

        let success = false;
        if (this.session.analysisMode === 'VisualizeDOM') {
            success = await this.reAnalysisManager.executeVisualizeDOMRegeneration(this.session);
        } else {
            success = await this.reAnalysisManager.executeDataJsonRegeneration(this.session);
        }

        if (!success) {
            vscode.window.showErrorMessage(`Failed to update analysis for ${path.basename(this.session.targetPath)}`);
            sessionRegistry.updateSessionStatus(this.session.id, 'monitoring', 100);
            return;
        }

        this.session.hash256 = currentHash;
        this.lastKnownMtimeMs = statSnapshot.mtimeMs;
        this.lastKnownSize = statSnapshot.size;
        this.session.metadata.lastModified = new Date(statSnapshot.mtimeMs);
        this.session.metadata.targetSize = statSnapshot.size;
        sessionRegistry.updateSessionStatus(this.session.id, 'monitoring', 100);

        const targetName = path.basename(this.session.targetPath);
        const noun = this.session.analysisMode === 'VisualizeDOM' ? 'HTML visualization' : 'analysis';
        vscode.window.setStatusBarMessage(`$(check) Updated ${noun} for ${targetName}`, 2000);
        console.log(`FILE_WATCHER_ORCHESTRATOR: Re-analysis completed for ${targetName}`);
    }

    stopWatching(): void {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }

        if (this.debounceManager) {
            this.debounceManager.dispose();
            this.debounceManager = null;
        }

        this.isWatching = false;
        this.watcherId = null;
    }

    getStatus(): WatcherStatus {
        return {
            isWatching: this.isWatching,
            watcherId: this.watcherId,
            targetPath: this.session.targetPath,
            sessionId: this.session.id,
            debounceStatus: this.debounceManager?.getStatus() || null,
        };
    }

    dispose(): void {
        this.stopWatching();
    }
}

export interface WatcherStatus {
    isWatching: boolean;
    watcherId: string | null;
    targetPath: string;
    sessionId: string;
    debounceStatus: DebounceStatus | null;
}

export default FileWatcherOrchestrator;
