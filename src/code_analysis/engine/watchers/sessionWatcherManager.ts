/**
 * Session Watcher Manager
 * Central entry point for all file and directory session watchers.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { FileWatcherOrchestrator } from './fileWatcherOrchestrator';
import { DirectoryWatcherOrchestrator } from './directoryWatcherOrchestrator';

interface ManagedWatcher {
    startWatching(): Promise<string | null>;
    stopWatching(): void | Promise<void>;
    getWatchedFilesCount?(): number;
    updateDebounceConfiguration?(): Promise<void>;
    reconcileNow?(): Promise<boolean>;
}

export class SessionWatcherManager {
    private static activeWatchers: Map<string, ManagedWatcher> = new Map();

    constructor(private context: vscode.ExtensionContext) {}

    async startWatchingSession(session: UnifiedAnalysisSession): Promise<string | null> {
        try {
            if (SessionWatcherManager.activeWatchers.has(session.id)) {
                await this.stopWatchingSession(session.id);
            }

            if (!fs.existsSync(session.targetPath)) {
                console.error(`SESSION_WATCHER_MANAGER: Target does not exist: ${session.targetPath}`);
                return null;
            }

            if (!session.savedFilesPath) {
                console.error(`SESSION_WATCHER_MANAGER: Session ${session.id} does not have saved files path`);
                return null;
            }

            let orchestrator: ManagedWatcher;
            if (session.targetType === 'file') {
                orchestrator = new FileWatcherOrchestrator(session, this.context);
            } else {
                orchestrator = new DirectoryWatcherOrchestrator(session, this.context);
            }

            const watcherId = await orchestrator.startWatching();
            if (!watcherId) {
                return null;
            }

            SessionWatcherManager.activeWatchers.set(session.id, orchestrator);
            return watcherId;
        } catch (error) {
            console.error(`SESSION_WATCHER_MANAGER: Error starting watcher for session ${session.id}:`, error);
            return null;
        }
    }

    async stopWatchingSession(sessionId: string): Promise<boolean> {
        try {
            const orchestrator = SessionWatcherManager.activeWatchers.get(sessionId);
            if (!orchestrator) {
                return false;
            }

            await orchestrator.stopWatching();
            SessionWatcherManager.activeWatchers.delete(sessionId);
            return true;
        } catch (error) {
            console.error(`SESSION_WATCHER_MANAGER: Error stopping watcher for session ${sessionId}:`, error);
            return false;
        }
    }

    async stopAllWatchers(): Promise<number> {
        let stoppedCount = 0;
        for (const sessionId of Array.from(SessionWatcherManager.activeWatchers.keys())) {
            if (await this.stopWatchingSession(sessionId)) {
                stoppedCount++;
            }
        }

        return stoppedCount;
    }

    async updateAllWatcherConfigurations(): Promise<number> {
        let updatedCount = 0;

        for (const [sessionId, orchestrator] of SessionWatcherManager.activeWatchers) {
            if (!orchestrator.updateDebounceConfiguration) {
                continue;
            }

            try {
                await orchestrator.updateDebounceConfiguration();
                updatedCount++;
            } catch (error) {
                console.error(`SESSION_WATCHER_MANAGER: Error updating watcher configuration for session ${sessionId}:`, error);
            }
        }

        return updatedCount;
    }

    static async refreshActiveWatcherConfigurations(context: vscode.ExtensionContext): Promise<number> {
        const manager = new SessionWatcherManager(context);
        return manager.updateAllWatcherConfigurations();
    }

    static async reconcileSession(sessionId: string): Promise<boolean> {
        const watcher = SessionWatcherManager.activeWatchers.get(sessionId);
        if (!watcher?.reconcileNow) {
            return false;
        }
        return watcher.reconcileNow();
    }

    getActiveWatchersInfo(): { sessionId: string; count: number }[] {
        const info: { sessionId: string; count: number }[] = [];

        for (const [sessionId, orchestrator] of SessionWatcherManager.activeWatchers) {
            const count = orchestrator.getWatchedFilesCount ? orchestrator.getWatchedFilesCount() : 1;
            info.push({ sessionId, count });
        }

        return info;
    }

    dispose(): void {
        void this.stopAllWatchers();
    }
}
