/**
 * VisualizeDOM Launcher
 * Launches DOM visualization analysis for HTML files using the new engine.
 *
 * Delegates the common pipeline to {@link executeLaunchPipeline},
 * providing VisualizeDOM-specific configuration (server-before-watcher order,
 * VisualizeDOMRequirements processor, VisualizeDOMWatcher).
 */

import * as vscode from 'vscode';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { VisualizeDOMRequirements } from '../processors/requirementRules/VisualizeDOMRequirements';
import { VisualizeDOMWatcher } from '../watchers/visualizeDOMWatcher';
import { executeLaunchPipeline } from './launchPipeline';

const LOG_PREFIX = 'NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS';

export class LauncherVisualizeDOM {

    /**
     * Launch VisualizeDOM analysis for HTML files
     */
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

            // VisualizeDOM starts server before watcher
            startServerBeforeWatcher: true,
            setEndTime: true,
            rethrowErrors: true,

            processRequirements: async () => {
                const requirements = new VisualizeDOMRequirements(context);
                return requirements.getRequiredFiles(session);
            },

            startWatcher: async (savedPath: string) => {
                try {
                    const watcherId = await VisualizeDOMWatcher.startWatching(
                        session.id,
                        session.targetPath,
                        savedPath,
                        context,
                    );
                    return watcherId;
                } catch (watcherError) {
                    console.error(`${LOG_PREFIX}: Error starting HTML file watcher:`, watcherError);
                    // Continue without watcher — analysis is still valid
                    return undefined;
                }
            },
        });
    }

    /**
     * Validate if file can be visualized with DOM analysis
     */
    static canVisualizeFile(filePath: string): boolean {
        const htmlExtensions = ['.html', '.htm', '.xhtml'];
        return htmlExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
    }
}
