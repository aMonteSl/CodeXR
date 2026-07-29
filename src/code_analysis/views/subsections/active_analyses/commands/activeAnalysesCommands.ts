/**
 * Active Analyses Commands
 * Handles command registration metadata and execution for active analysis operations.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { UnifiedSessionRegistry } from '../../../../engine/core/sessionRegistry';
import { ServerWatcherIntegration } from '../../../../services/serverWatcherIntegration';
import { ActiveAnalysisItem, ActiveAnalysesDataService } from '../services/activeAnalysesDataService';
import { CommandRegistration } from '../../../../commands/subsections/analysis_settings/analysis_file_mode';
import { analysisRefreshCoordinator } from '../../../../refresh/analysisRefreshCoordinator';
import { resolveAnalysisServerCapabilities } from '../../../../../servers/runtime/analysisServerCapabilities';
import {
    buildExportManifest,
    configureOfflineExportHtml,
    isXrSceneFolder,
    refreshRuntimeCopies,
    relativizeExportArtifacts,
    writeExportReadme,
} from '../../../../export/exportManifest';
import { buildExportModeItems, interpretExportSelection } from '../../../../export/exportModeSelection';
import {
    exportGitRevisionData,
    inspectGitRevisionExport,
} from '../../../../export/gitRevisionExporter';
import { GitExportOutcome } from '../../../../export/gitRevisionExportCore';
import {
    calculateGitExportWorkerPlan,
    GitExportPerformanceProfile,
    GitRevisionExportRequest,
    GitRevisionScope,
    validateGitRevisionScope,
} from '../../../../export/gitExportOptions';
import {
    abortExportPackage,
    beginExportPackageTransaction,
    ExportPackageTransaction,
    pruneExportPackage,
    publishExportPackage,
    validateExportPackage,
} from '../../../../export/exportPackageTransaction';

class ExportCancelledError extends Error {
    public constructor() {
        super('export-cancelled');
    }
}

export class ActiveAnalysesCommands {
    private static instance: ActiveAnalysesCommands;
    private commands: CommandRegistration[];

    private constructor(
        private sessionRegistry: UnifiedSessionRegistry,
        private serverWatcher: ServerWatcherIntegration,
        private readonly extensionContext: vscode.ExtensionContext,
    ) {
        this.commands = [
            {
                commandId: 'codeXR.analysis.activeAnalyses.showActions',
                description: 'Show active analysis actions',
                module: 'ANALYSIS',
                errorMessage: 'Failed to show active analysis actions',
                callback: this.showActions.bind(this),
            },
            {
                commandId: 'codeXR.analysis.activeAnalyses.showDetails',
                description: 'Show analysis details',
                module: 'ANALYSIS',
                errorMessage: 'Failed to show analysis details',
                callback: this.showDetails.bind(this),
            },
            {
                commandId: 'codeXR.analysis.activeAnalyses.close',
                description: 'Close analysis',
                module: 'ANALYSIS',
                errorMessage: 'Failed to close analysis',
                callback: this.closeAnalysis.bind(this),
            },
            {
                commandId: 'codeXR.analysis.activeAnalyses.viewInBrowser',
                description: 'Open analysis in browser',
                module: 'ANALYSIS',
                errorMessage: 'Failed to open analysis in browser',
                callback: this.viewInBrowser.bind(this),
            },
            {
                commandId: 'codeXR.analysis.activeAnalyses.exportFolder',
                description: 'Export analysis folder',
                module: 'ANALYSIS',
                errorMessage: 'Failed to export analysis folder',
                callback: this.exportFolder.bind(this),
            },
            {
                commandId: 'codeXR.analysis.activeAnalyses.refresh',
                description: 'Refresh active analyses',
                module: 'ANALYSIS',
                errorMessage: 'Failed to refresh active analyses',
                callback: this.refreshAnalyses.bind(this),
            },
        ];
    }

    public static getInstance(
        sessionRegistry?: UnifiedSessionRegistry,
        serverWatcher?: ServerWatcherIntegration,
        extensionContext?: vscode.ExtensionContext,
    ): ActiveAnalysesCommands {
        if (!ActiveAnalysesCommands.instance) {
            if (!sessionRegistry || !serverWatcher || !extensionContext) {
                throw new Error(
                    'SessionRegistry, ServerWatcher, and ExtensionContext are required for first initialization',
                );
            }
            ActiveAnalysesCommands.instance = new ActiveAnalysesCommands(
                sessionRegistry, serverWatcher, extensionContext,
            );
        }
        return ActiveAnalysesCommands.instance;
    }

    public getCommandRegistrations(): CommandRegistration[] {
        return [...this.commands];
    }

    private async showActions(arg?: ActiveAnalysisItem | string | any): Promise<void> {
        const sessionId = this.extractSessionId(arg);
        if (!sessionId) {
            vscode.window.showErrorMessage('No analysis selected');
            return;
        }

        const session = this.sessionRegistry.getSession(sessionId);
        if (!session) {
            vscode.window.showErrorMessage('Analysis session not found');
            return;
        }

        const exportSourcePath = this.resolveExportSourcePath(session);
        const quickPickItems: Array<vscode.QuickPickItem & {
            action: 'details' | 'browser' | 'export' | 'close';
        }> = [
            {
                label: 'View Details',
                description: 'Open the analysis session details in a markdown document',
                action: 'details',
            },
        ];

        if (session.serverUrl || session.assignedPort) {
            quickPickItems.push({
                label: 'Open in Browser',
                description: 'Open the active analysis in your default browser',
                action: 'browser',
            });
        }

        if (exportSourcePath) {
            quickPickItems.push({
                label: 'Export Analysis Folder',
                description: 'Copy the generated analysis files to a folder you choose',
                action: 'export',
            });
        }

        if (session.status !== 'closed') {
            quickPickItems.push({
                label: 'Close Analysis',
                description: 'Stop the analysis server and remove the session',
                action: 'close',
            });
        }

        const targetLabel = path.basename(session.targetPath || session.targetName || 'Unknown');
        const selectedAction = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: `Choose an action for ${targetLabel}`,
            title: `Active Analysis Actions - ${targetLabel}`,
        });

        if (!selectedAction) {
            return;
        }

        switch (selectedAction.action) {
            case 'details':
                await this.showDetails(sessionId);
                return;
            case 'browser':
                await this.viewInBrowser(sessionId);
                return;
            case 'export':
                await this.exportFolder(sessionId);
                return;
            case 'close':
                await this.closeAnalysis(sessionId);
                return;
        }
    }

    private async showDetails(arg?: ActiveAnalysisItem | string | any): Promise<void> {
        const sessionId = this.extractSessionId(arg);
        if (!sessionId) {
            vscode.window.showErrorMessage('No analysis selected');
            return;
        }

        const session = this.sessionRegistry.getSession(sessionId);
        if (!session) {
            vscode.window.showErrorMessage('Analysis session not found');
            return;
        }

        const detailsContent = this.generateDetailsContent(session);
        const doc = await vscode.workspace.openTextDocument({
            content: detailsContent,
            language: 'markdown',
        });
        await vscode.window.showTextDocument(doc);
    }

    private async closeAnalysis(arg?: ActiveAnalysisItem | string | any): Promise<void> {
        const sessionId = this.extractSessionId(arg);
        if (!sessionId) {
            vscode.window.showErrorMessage('No analysis selected');
            return;
        }

        const session = this.sessionRegistry.getSession(sessionId);
        if (!session) {
            vscode.window.showErrorMessage('Analysis session not found');
            return;
        }

        const targetLabel = path.basename(session.targetPath || session.targetName || 'Unknown');
        const choice = await vscode.window.showWarningMessage(
            `Close analysis for "${targetLabel}"?`,
            {
                modal: true,
                detail: `This will stop the analysis server, stop any active watchers, and remove the session from Active Analyses.\n\nTarget: ${session.targetPath || session.targetName || 'Unknown'}\nType: ${session.targetType || 'Unknown'}\nMode: ${session.analysisMode || 'Unknown'}\nStatus: ${session.status || 'Unknown'}\nOutput: ${session.savedFilesPath || session.outputPath || 'Not available'}\n\nExport the analysis folder first if you want to keep the generated artifacts for debugging.`,
            },
            'Close Analysis',
            'Cancel',
        );

        if (choice !== 'Close Analysis') {
            return;
        }

        const cleanupSuccess = await this.serverWatcher.triggerManualCleanup(sessionId);
        const removed = this.sessionRegistry.removeSession(sessionId);
        await vscode.commands.executeCommand('codeXR.analysis.activeAnalyses.refresh');

        if (cleanupSuccess && removed) {
            vscode.window.showInformationMessage('Analysis closed successfully');
            return;
        }

        if (!cleanupSuccess && removed) {
            vscode.window.showWarningMessage(
                'Analysis was removed from Active Analyses, but server or watcher cleanup may not have completed fully.',
            );
            return;
        }

        if (cleanupSuccess && !removed) {
            vscode.window.showWarningMessage(
                'Analysis resources were cleaned up, but the session entry could not be removed from Active Analyses.',
            );
            return;
        }

        vscode.window.showErrorMessage('Failed to close the analysis session cleanly');
    }

    private async viewInBrowser(arg?: ActiveAnalysisItem | string | any): Promise<void> {
        const sessionId = this.extractSessionId(arg);
        if (!sessionId) {
            vscode.window.showErrorMessage('No analysis selected');
            return;
        }

        const session = this.sessionRegistry.getSession(sessionId);
        if (!session) {
            vscode.window.showErrorMessage('Analysis session not found');
            return;
        }

        if (!session.serverUrl && !session.assignedPort) {
            vscode.window.showErrorMessage('No server URL available for this analysis');
            return;
        }

        const url = session.serverUrl || `http://localhost:${session.assignedPort}`;
        if (!url) {
            vscode.window.showErrorMessage('Could not determine server URL for this analysis');
            return;
        }

        await vscode.env.openExternal(vscode.Uri.parse(url));
    }

    private async exportFolder(arg?: ActiveAnalysisItem | string | any): Promise<void> {
        const sessionId = this.extractSessionId(arg);
        if (!sessionId) {
            vscode.window.showErrorMessage('No analysis selected');
            return;
        }

        const session = this.sessionRegistry.getSession(sessionId);
        if (!session) {
            vscode.window.showErrorMessage('Analysis session not found');
            return;
        }

        const sourcePath = this.resolveExportSourcePath(session);
        if (!sourcePath) {
            vscode.window.showErrorMessage('No analysis output folder is available to export');
            return;
        }

        // The modal comes first: what goes into the copy decides how long the
        // export takes, so the user chooses before picking a destination.
        const capabilities = resolveAnalysisServerCapabilities(session.analysisMode);
        const selection = interpretExportSelection(await vscode.window.showQuickPick(
            buildExportModeItems(capabilities),
            {
                canPickMany: true,
                title: 'Export Analysis Folder: choose the analyses to include',
                placeHolder: 'Normal is always included; the git analyses pre-compute the whole timeline',
            },
        ));
        if (selection.cancelled) {
            return;
        }

        let gitExportRequest: GitRevisionExportRequest | undefined;
        if (selection.gitTimeline) {
            try {
                const preflight = await inspectGitRevisionExport(this.extensionContext, session);
                if (preflight.commitCount < 1) {
                    vscode.window.showErrorMessage(
                        'Historical comparison and Project evolution need at least one Git commit to export.',
                    );
                    return;
                }
                const scopeItem = await vscode.window.showQuickPick([
                    {
                        label: `Entire Git history — ${preflight.commitCount.toLocaleString()} commits`,
                        description: 'Every commit reachable from all branches and tags',
                        scope: { kind: 'all' } as GitRevisionScope,
                    },
                    {
                        label: 'Only the latest N commits…',
                        description: 'Newest commits across all branches and tags; working copy is added separately',
                        scope: { kind: 'latest', count: 1 } as GitRevisionScope,
                    },
                ], {
                    title: 'Export Git timeline: choose history range',
                    placeHolder: `${preflight.commitCount.toLocaleString()} commits are available`,
                });
                if (!scopeItem) {
                    return;
                }
                let scope = scopeItem.scope;
                if (scope.kind === 'latest') {
                    const rawCount = await vscode.window.showInputBox({
                        title: 'Export Git timeline: number of latest commits',
                        prompt: `Enter a value from 1 to ${preflight.commitCount.toLocaleString()}.`
                            + ' The working copy is included in addition to this number.',
                        value: String(Math.min(100, preflight.commitCount)),
                        validateInput: (value) => {
                            const count = Number(value);
                            return Number.isInteger(count)
                                && count >= 1
                                && count <= preflight.commitCount
                                ? undefined
                                : `Enter a whole number between 1 and ${preflight.commitCount}.`;
                        },
                    });
                    if (rawCount === undefined) {
                        return;
                    }
                    scope = validateGitRevisionScope(
                        { kind: 'latest', count: Number(rawCount) },
                        preflight.commitCount,
                    );
                }

                const balancedPlan = calculateGitExportWorkerPlan('balanced');
                const maximumPlan = calculateGitExportWorkerPlan('maximum');
                const performanceItem = await vscode.window.showQuickPick([
                    {
                        label: `Balanced — ${balancedPlan.workerCount} workers`,
                        description: 'Keeps CPU and memory available for VS Code',
                        profile: 'balanced' as GitExportPerformanceProfile,
                    },
                    {
                        label: `Maximum speed — ${maximumPlan.workerCount} workers`,
                        description: 'Uses the highest safe local concurrency',
                        profile: 'maximum' as GitExportPerformanceProfile,
                    },
                ], {
                    title: 'Export Git timeline: choose performance',
                    placeHolder: 'Workers are persistent and analyze distinct Git files in parallel',
                });
                if (!performanceItem) {
                    return;
                }
                gitExportRequest = {
                    scope,
                    performanceProfile: performanceItem.profile,
                };

                const gitModeNames = [
                    selection.historicalComparison ? 'Historical comparison' : '',
                    selection.projectEvolution ? 'Project evolution' : '',
                ].filter(Boolean).join(' and ');
                const selectedCount = scope.kind === 'all'
                    ? preflight.commitCount
                    : scope.count;
                const selectedPlan = performanceItem.profile === 'maximum'
                    ? maximumPlan
                    : balancedPlan;
                const confirmation = await vscode.window.showWarningMessage(
                    `${gitModeNames} will export ${selectedCount.toLocaleString()} Git commits`
                    + ` plus the working copy using ${selectedPlan.workerCount} persistent workers. `
                    + 'Unchanged Git files are analyzed once and shared across revisions.',
                    { modal: true },
                    'Continue Export',
                );
                if (confirmation !== 'Continue Export') {
                    return;
                }
            } catch (error) {
                vscode.window.showErrorMessage(
                    `The Git timeline cannot be exported: ${error instanceof Error ? error.message : String(error)}`,
                );
                return;
            }
        }

        const selectedFolder = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Export Destination',
            title: 'Choose where to copy the analysis folder',
        });

        if (!selectedFolder || selectedFolder.length === 0) {
            return;
        }

        const exportFolderName = session.outputDirectory || path.basename(sourcePath);
        const destinationPath = path.join(selectedFolder[0].fsPath, exportFolderName);

        if (fs.existsSync(destinationPath)) {
            vscode.window.showWarningMessage(
                `The destination folder already exists: ${destinationPath}. Choose a different location or remove the existing folder first.`,
            );
            return;
        }

        const capturedViewState = analysisRefreshCoordinator.getViewState(session.id);
        let transaction: ExportPackageTransaction | undefined;
        try {
            if (
                selection.dependencyGraph
                && capabilities.dependencyGraph
                && !this.hasDependencyDataset(sourcePath)
            ) {
                const dependencyFailure = await this.pregenerateDependencyDataset(
                    session.id,
                    sourcePath,
                );
                if (dependencyFailure) {
                    throw new Error(dependencyFailure);
                }
            }

            transaction = await beginExportPackageTransaction(sourcePath, destinationPath);
            const stagingPath = transaction.stagingPath;
            await pruneExportPackage(stagingPath, selection);
            await configureOfflineExportHtml(stagingPath);

            // Everything below touches the DESTINATION copy only.
            await relativizeExportArtifacts(stagingPath);
            let analyzedRevisions = 0;
            let partialGitSources = 0;
            if (isXrSceneFolder(stagingPath)) {
                await refreshRuntimeCopies(stagingPath, this.extensionContext.extensionPath);

                // Git timeline pre-analysis: one shared pass serves both
                // historical comparison and project evolution offline.
                let gitOutcome: GitExportOutcome | undefined;
                if (selection.gitTimeline) {
                    gitOutcome = await vscode.window.withProgress(
                        {
                            location: vscode.ProgressLocation.Notification,
                            title: 'CodeXR: analyzing the complete Git timeline for the export…',
                            cancellable: true,
                        },
                        (progress, token) => exportGitRevisionData(
                            this.extensionContext,
                            session,
                            stagingPath,
                            gitExportRequest as GitRevisionExportRequest,
                            { progress, token },
                        ),
                    );
                    if (gitOutcome.cancelled) {
                        throw new ExportCancelledError();
                    }
                    if (!gitOutcome.gitData) {
                        throw new Error(
                            gitOutcome.failureReason
                            || 'The Git timeline did not produce enough usable revisions.',
                        );
                    }
                    analyzedRevisions = gitOutcome.gitData.analyzedRevisionCount || 0;
                    partialGitSources = gitOutcome.gitData.skippedRevisions?.length || 0;
                }

                const manifest = await buildExportManifest(stagingPath, {
                    target: {
                        name: session.targetName || path.basename(session.targetPath || '') || 'analysis',
                        type: session.targetType || 'directory',
                        analysisMode: session.analysisMode || 'XR',
                    },
                    serverCapabilities: capabilities,
                    viewState: {
                        mode: String(capturedViewState.mode || 'single'),
                        controllerView: capturedViewState.controllerView,
                    },
                    gitData: gitOutcome?.gitData,
                    gitDataFailureReason: gitOutcome?.failureReason,
                    gitDataSelected: selection.gitTimeline,
                    selectedModes: selection,
                });
                await writeExportReadme(stagingPath, manifest);
                await validateExportPackage(stagingPath, manifest);
            }

            await publishExportPackage(transaction);
            const revisionsNote = analyzedRevisions
                ? ` ${analyzedRevisions} git revisions travel with it.`
                : '';
            const partialNote = partialGitSources
                ? ` ${partialGitSources} revision source(s) were discarded because they had no usable data; details are listed in the manifest.`
                : '';
            const completionMessage = `Analysis folder exported to ${destinationPath}.${revisionsNote}${partialNote} `
                + 'Serve it with any static HTTP server (e.g. "npx serve") to open it outside VS Code.';
            if (partialGitSources) {
                vscode.window.showWarningMessage(completionMessage);
            } else {
                vscode.window.showInformationMessage(completionMessage);
            }
        } catch (error) {
            await abortExportPackage(transaction);
            if (error instanceof ExportCancelledError) {
                vscode.window.showInformationMessage(
                    'Analysis export cancelled. No partial folder was published.',
                );
            } else {
                vscode.window.showErrorMessage(
                    `Failed to export analysis folder: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }
    }

    private hasDependencyDataset(sourcePath: string): boolean {
        const dependenciesDir = path.join(sourcePath, 'dependencies');
        if (!fs.existsSync(dependenciesDir)) {
            return false;
        }
        return fs.readdirSync(dependenciesDir)
            .some((name) => /^dependency-graph-\d+\.json$/.test(name));
    }

    /**
     * Run the same dependency analysis the in-scene "dependency graph" mode
     * would trigger, and wait for it, so the export ships a usable dataset.
     * Returns a reason string when the dataset could not be produced. A
     * selected mode is a package invariant, so the transaction then aborts.
     */
    private async pregenerateDependencyDataset(
        sessionId: string,
        sourcePath: string,
    ): Promise<string | undefined> {
        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'CodeXR: preparing export (analyzing dependencies)…',
                },
                () => analysisRefreshCoordinator.forceRefreshModeAndWait(
                    sessionId,
                    'dependency-graph',
                    600_000,
                ),
            );
            if (!this.hasDependencyDataset(sourcePath)) {
                return 'The dependency analysis completed without producing an exportable dataset.';
            }
            return undefined;
        } catch (error) {
            return `The dependency analysis failed during export: ${error instanceof Error ? error.message : String(error)}`;
        }
    }

    private async refreshAnalyses(): Promise<void> {
        ActiveAnalysesDataService.getInstance().refresh();
        console.log('ACTIVE_ANALYSES_COMMANDS: Refresh triggered via data service');
    }

    private extractSessionId(arg?: ActiveAnalysisItem | string | any): string | undefined {
        if (typeof arg === 'string') {
            return arg;
        }
        if (arg?.session?.id) {
            return arg.session.id;
        }
        if (arg?.sessionId) {
            return arg.sessionId;
        }
        if (arg?.id) {
            return arg.id;
        }
        if (arg?.originalAnalysisItem?.sessionId) {
            return arg.originalAnalysisItem.sessionId;
        }
        if (arg?.originalAnalysisItem?.id) {
            return arg.originalAnalysisItem.id;
        }
        if (arg?.originalAnalysisItem?.session?.id) {
            return arg.originalAnalysisItem.session.id;
        }
        return undefined;
    }

    private resolveExportSourcePath(session: {
        savedFilesPath?: string;
        outputPath?: string;
    }): string | undefined {
        if (session.savedFilesPath && fs.existsSync(session.savedFilesPath)) {
            return session.savedFilesPath;
        }

        if (session.outputPath && fs.existsSync(session.outputPath)) {
            return session.outputPath;
        }

        return undefined;
    }

    private generateDetailsContent(session: any): string {
        return `# Analysis Details

## Session Information
- **Session ID**: ${session.id}
- **Target Path**: ${session.targetPath}
- **Target Type**: ${session.targetType}
- **Analysis Mode**: ${session.analysisMode}
- **Start Time**: ${session.startTime || 'Unknown'}
- **Status**: ${session.status || 'Active'}

## Server Information
${session.assignedPort ? `- **Port**: ${session.assignedPort}` : ''}
${session.serverUrl ? `- **Server URL**: ${session.serverUrl}` : ''}
${session.serverId ? `- **Server ID**: ${session.serverId}` : ''}

## Configuration
- **Is Deep Analysis**: ${session.isDeep || false}
- **Output Directory**: ${session.outputDirectory || 'Not set'}

## Progress
${session.progress ? `- **Progress**: ${session.progress}%` : '- **Progress**: Not available'}
${session.error ? `- **Error**: ${session.error}` : ''}
`;
    }
}

