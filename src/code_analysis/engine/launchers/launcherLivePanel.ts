/**
 * Live Panel Analysis Launcher
 * Handles the launch and orchestration of Live Panel analysis for both files and directories.
 *
 * Delegates the common 4-step pipeline to {@link executeLaunchPipeline},
 * providing only LivePanel-specific configuration (theme, folder name, watcher type).
 */

import * as vscode from 'vscode';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { UnifiedSessionRegistry } from '../core/sessionRegistry';
import { FileRequirementProcessor } from '../processors/FileRequirementProcessor';
import { SessionWatcherManager } from '../watchers/sessionWatcherManager';
import { AnalysisConfigurationStorage } from '../../configuration/analysisConfigurationStorage';
import { executeLaunchPipeline } from './launchPipeline';

const LOG_PREFIX = 'NEW_LAUNCHER_LIVEPANEL_ANALYSIS';

export class LauncherLivePanel {

    /**
     * Launch Live Panel analysis for a file using session
     */
    static async launchFileLivePanelAnalysis(
        session: UnifiedAnalysisSession,
        context: vscode.ExtensionContext,
    ): Promise<void> {
        const registry = UnifiedSessionRegistry.getInstance(context);
        const configStorage = AnalysisConfigurationStorage.getInstance(context);

        await executeLaunchPipeline(session, context, {
            logPrefix: LOG_PREFIX,
            folderName: 'fileAnalysis',
            progress: { process: 20, save: 40, watcherOrServer: 60, serverOrWatcher: 80, done: 100 },

            preValidation: async () => {
                if (!session.hash256) {
                    console.error(`${LOG_PREFIX}: File hash not found in session ${session.id}`);
                    registry.updateSessionStatus(session.id, 'error', 100);
                    throw new Error('File hash not found');
                }
                console.log(`${LOG_PREFIX}: File hash from session: ${session.hash256.substring(0, 12)}...`);
            },

            processRequirements: async () => {
                const currentTheme = await configStorage.getViewTheme();
                console.log(`${LOG_PREFIX}: Using theme: ${currentTheme}`);
                const processor = new FileRequirementProcessor(context);
                return processor.processRequirements(session, currentTheme);
            },

            startWatcher: async () => {
                const watcher = new SessionWatcherManager(context);
                return watcher.startWatchingSession(session);
            },
        });
    }

    /**
     * Launch Live Panel analysis for a directory using session
     */
    static async launchDirectoryLivePanelAnalysis(
        session: UnifiedAnalysisSession,
        context: vscode.ExtensionContext,
    ): Promise<void> {
        const configStorage = AnalysisConfigurationStorage.getInstance(context);

        await executeLaunchPipeline(session, context, {
            logPrefix: LOG_PREFIX,
            folderName: 'directoryAnalysis',
            progress: { process: 20, save: 40, watcherOrServer: 60, serverOrWatcher: 80, done: 100 },

            preValidation: async () => {
                const files = session.filesToHash || [];
                console.log(`${LOG_PREFIX}: Directory session target path: ${session.targetPath}`);
                console.log(`${LOG_PREFIX}: Directory session deep mode: ${session.isDeep ? 'enabled' : 'disabled'}`);
                console.log(`${LOG_PREFIX}: Session currently tracks ${files.length} hashed files`);
                console.log(`${LOG_PREFIX}: Directory targets will be resolved by the Python coordinator during the initial analysis`);

                if (files.length === 0) {
                    console.log(`${LOG_PREFIX}: filesToHash will be populated after the initial directory analysis completes`);
                }
            },

            processRequirements: async () => {
                const currentTheme = await configStorage.getViewTheme();
                console.log(`${LOG_PREFIX}: Using theme: ${currentTheme}`);
                const processor = new FileRequirementProcessor(context);
                return processor.processRequirements(session, currentTheme);
            },

            startWatcher: async () => {
                const watcher = new SessionWatcherManager(context);
                return watcher.startWatchingSession(session);
            },
        });
    }
}
