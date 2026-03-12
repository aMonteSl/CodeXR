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

export class ActiveAnalysesCommands {
    private static instance: ActiveAnalysesCommands;
    private commands: CommandRegistration[];

    private constructor(
        private sessionRegistry: UnifiedSessionRegistry,
        private serverWatcher: ServerWatcherIntegration,
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
    ): ActiveAnalysesCommands {
        if (!ActiveAnalysesCommands.instance) {
            if (!sessionRegistry || !serverWatcher) {
                throw new Error('SessionRegistry and ServerWatcher are required for first initialization');
            }
            ActiveAnalysesCommands.instance = new ActiveAnalysesCommands(sessionRegistry, serverWatcher);
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

        try {
            await fs.promises.cp(sourcePath, destinationPath, {
                recursive: true,
                force: false,
                errorOnExist: true,
            });

            vscode.window.showInformationMessage(`Analysis folder exported to ${destinationPath}`);
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to export analysis folder: ${error instanceof Error ? error.message : String(error)}`,
            );
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

