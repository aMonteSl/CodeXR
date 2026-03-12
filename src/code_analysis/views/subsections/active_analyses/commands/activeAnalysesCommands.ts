/**
 * Active Analyses Commands
 * Handles command registration metadata and execution for active analysis operations.
 */

import * as vscode from 'vscode';
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

        const choice = await vscode.window.showWarningMessage(
            `Are you sure you want to close the analysis for "${path.basename(session.targetPath || session.targetName || 'Unknown')}"?`,
            {
                modal: true,
                detail: `This will stop the analysis server and remove all associated watchers. The analysis results will be lost.\n\nTarget: ${session.targetPath || session.targetName || 'Unknown'}\nType: ${session.targetType || 'Unknown'}\nMode: ${session.analysisMode || 'Unknown'}`,
            },
            'Yes, Close Analysis',
            'Cancel',
        );

        if (choice !== 'Yes, Close Analysis') {
            return;
        }

        const cleanupSuccess = await this.serverWatcher.triggerManualCleanup(sessionId);
        if (!cleanupSuccess) {
            console.warn('ACTIVE_ANALYSES_COMMANDS: Server cleanup did not complete successfully, but analysis will still be removed');
        }

        this.sessionRegistry.removeSession(sessionId);
        await vscode.commands.executeCommand('codeXR.analysis.activeAnalyses.refresh');
        vscode.window.showInformationMessage('Analysis closed successfully');
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

