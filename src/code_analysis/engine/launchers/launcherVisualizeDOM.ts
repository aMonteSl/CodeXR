/**
 * VisualizeDOM Launcher
 * Launches DOM visualization analysis for HTML files using the shared launch pipeline.
 */

import * as vscode from 'vscode';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { FileRequirementProcessor } from '../processors/FileRequirementProcessor';
import { SessionWatcherManager } from '../watchers/sessionWatcherManager';
import { executeLaunchPipeline } from './launchPipeline';

const LOG_PREFIX = 'NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS';

export class LauncherVisualizeDOM {
    static async launchVisualizeDOMAnalysis(
        session: UnifiedAnalysisSession,
        context: vscode.ExtensionContext,
    ): Promise<void> {
        console.log(`${LOG_PREFIX}: Target: ${session.targetName} (${session.targetType})`);
        console.log(`${LOG_PREFIX}: Analysis mode: ${session.analysisMode}`);

        await executeLaunchPipeline(session, context, {
            logPrefix: LOG_PREFIX,
            folderName: 'visualizeDOMAnalysis',
            progress: { process: 20, save: 40, watcherOrServer: 60, serverOrWatcher: 80, done: 100 },
            startServerBeforeWatcher: true,
            setEndTime: true,
            rethrowErrors: true,

            processRequirements: async () => {
                const processor = new FileRequirementProcessor(context);
                return processor.processRequirements(session);
            },

            startWatcher: async () => {
                try {
                    const watcher = new SessionWatcherManager(context);
                    return watcher.startWatchingSession(session);
                } catch (watcherError) {
                    console.error(`${LOG_PREFIX}: Error starting HTML file watcher:`, watcherError);
                    return undefined;
                }
            },
        });
    }

    static canVisualizeFile(filePath: string): boolean {
        const htmlExtensions = ['.html', '.htm', '.xhtml'];
        return htmlExtensions.some((ext) => filePath.toLowerCase().endsWith(ext));
    }
}
