/**
 * Active Analyses Commands
 * Handles command registration and execution for active analysis operations
 * SIMPLIFIED: Direct session access without complex model interfaces
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { UnifiedSessionRegistry } from '../../../../../new_code_analysis/new_engine/core/sessionRegistry';
import { ServerWatcherIntegration } from '../../../../../new_code_analysis/services/serverWatcherIntegration';
import { ActiveAnalysisItem } from '../services/activeAnalysesDataService';

/**
 * Command registration configuration for active analyses
 */
export interface ActiveAnalysisCommandRegistration {
    commandId: string;
    title: string;
    handler: (arg?: ActiveAnalysisItem | string | any) => void | Promise<void>;
}

/**
 * Active Analyses Commands implementation
 */
export class ActiveAnalysesCommands {
    private static instance: ActiveAnalysesCommands;
    private commands: ActiveAnalysisCommandRegistration[];
    private registeredCommands: Set<string> = new Set();

    private constructor(
        private sessionRegistry: UnifiedSessionRegistry,
        private serverWatcher: ServerWatcherIntegration
    ) {
        this.commands = [
            {
                commandId: 'codeXR.new_code_analysis.activeAnalyses.showDetails',
                title: 'Show Analysis Details',
                handler: this.showDetails.bind(this)
            },
            {
                commandId: 'codeXR.new_code_analysis.activeAnalyses.close',
                title: 'Close Analysis',
                handler: this.closeAnalysis.bind(this)
            },
            {
                commandId: 'codeXR.new_code_analysis.activeAnalyses.viewInBrowser',
                title: 'View in Browser',
                handler: this.viewInBrowser.bind(this)
            },
            {
                commandId: 'codeXR.new_code_analysis.activeAnalyses.refresh',
                title: 'Refresh Active Analyses',
                handler: this.refreshAnalyses.bind(this)
            }
        ];
    }

    /**
     * Get or create singleton instance
     */
    public static getInstance(
        sessionRegistry?: UnifiedSessionRegistry,
        serverWatcher?: ServerWatcherIntegration
    ): ActiveAnalysesCommands {
        if (!ActiveAnalysesCommands.instance) {
            if (!sessionRegistry || !serverWatcher) {
                throw new Error('SessionRegistry and ServerWatcher are required for first initialization');
            }
            ActiveAnalysesCommands.instance = new ActiveAnalysesCommands(sessionRegistry, serverWatcher);
        }
        return ActiveAnalysesCommands.instance;
    }

    /**
     * Register all active analysis commands
     */
    public registerCommands(): vscode.Disposable[] {
        const disposables: vscode.Disposable[] = [];

        for (const command of this.commands) {
            if (!this.registeredCommands.has(command.commandId)) {
                const disposable = vscode.commands.registerCommand(command.commandId, command.handler);
                disposables.push(disposable);
                this.registeredCommands.add(command.commandId);
            }
        }

        return disposables;
    }

    /**
     * Show analysis details command handler
     * SIMPLIFIED: Direct session access
     * FIXED: Handle TreeItem objects passed by VS Code context menus
     */
    private async showDetails(arg?: ActiveAnalysisItem | string | any): Promise<void> {
        console.log('ACTIVE_ANALYSES_COMMANDS: showDetails called with arg:', typeof arg, arg);
        try {
            let sessionId: string;
            
            if (typeof arg === 'string') {
                sessionId = arg;
                console.log('ACTIVE_ANALYSES_COMMANDS: Using string arg as sessionId:', sessionId);
            } else if (arg && arg.session && arg.session.id) {
                sessionId = arg.session.id;
                console.log('ACTIVE_ANALYSES_COMMANDS: Using arg.session.id as sessionId:', sessionId);
            } else if (arg && arg.sessionId) {
                // Handle sessionId property (added in getTreeItem)
                sessionId = arg.sessionId;
                console.log('ACTIVE_ANALYSES_COMMANDS: Using arg.sessionId as sessionId:', sessionId);
            } else if (arg && arg.id) {
                // Handle id property (added in getTreeItem)
                sessionId = arg.id;
                console.log('ACTIVE_ANALYSES_COMMANDS: Using arg.id as sessionId:', sessionId);
            } else if (arg && arg.originalNewCodeAnalysisItem) {
                // Handle wrapped objects from modular tree
                const originalItem = arg.originalNewCodeAnalysisItem;
                if (originalItem.sessionId) {
                    sessionId = originalItem.sessionId;
                    console.log('ACTIVE_ANALYSES_COMMANDS: Using originalNewCodeAnalysisItem.sessionId:', sessionId);
                } else if (originalItem.id) {
                    sessionId = originalItem.id;
                    console.log('ACTIVE_ANALYSES_COMMANDS: Using originalNewCodeAnalysisItem.id:', sessionId);
                } else if (originalItem.session && originalItem.session.id) {
                    sessionId = originalItem.session.id;
                    console.log('ACTIVE_ANALYSES_COMMANDS: Using originalNewCodeAnalysisItem.session.id:', sessionId);
                } else {
                    console.log('ACTIVE_ANALYSES_COMMANDS: No valid session ID in originalNewCodeAnalysisItem:', originalItem);
                    vscode.window.showErrorMessage('No analysis selected');
                    return;
                }
            } else {
                console.log('ACTIVE_ANALYSES_COMMANDS: No valid session ID found in arg');
                console.log('ACTIVE_ANALYSES_COMMANDS: Arg keys:', arg ? Object.keys(arg) : 'arg is null/undefined');
                vscode.window.showErrorMessage('No analysis selected');
                return;
            }

            console.log('ACTIVE_ANALYSES_COMMANDS: Looking for session with ID:', sessionId);
            const session = this.sessionRegistry.getSession(sessionId);
            if (!session) {
                console.log('ACTIVE_ANALYSES_COMMANDS: Session not found for ID:', sessionId);
                vscode.window.showErrorMessage('Analysis session not found');
                return;
            }

            console.log('ACTIVE_ANALYSES_COMMANDS: Session found, generating details content');
            // Show details in a new document
            const detailsContent = this.generateDetailsContent(session);
            const doc = await vscode.workspace.openTextDocument({
                content: detailsContent,
                language: 'markdown'
            });
            await vscode.window.showTextDocument(doc);

        } catch (error) {
            console.error('ACTIVE_ANALYSES_COMMANDS: Error showing analysis details:', error);
            vscode.window.showErrorMessage('Failed to show analysis details');
        }
    }

    /**
     * Close analysis command handler
     * FIXED: Now properly stops servers using ServerWatcherIntegration
     * FIXED: Handle TreeItem objects passed by VS Code context menus
     */
    private async closeAnalysis(arg?: ActiveAnalysisItem | string | any): Promise<void> {
        console.log('ACTIVE_ANALYSES_COMMANDS: closeAnalysis called with arg:', typeof arg, arg);
        try {
            let sessionId: string;
            
            if (typeof arg === 'string') {
                sessionId = arg;
                console.log('ACTIVE_ANALYSES_COMMANDS: Using string arg as sessionId:', sessionId);
            } else if (arg && arg.session && arg.session.id) {
                sessionId = arg.session.id;
                console.log('ACTIVE_ANALYSES_COMMANDS: Using arg.session.id as sessionId:', sessionId);
            } else if (arg && arg.sessionId) {
                // Handle sessionId property (added in getTreeItem)
                sessionId = arg.sessionId;
                console.log('ACTIVE_ANALYSES_COMMANDS: Using arg.sessionId as sessionId:', sessionId);
            } else if (arg && arg.id) {
                // Handle id property (added in getTreeItem)
                sessionId = arg.id;
                console.log('ACTIVE_ANALYSES_COMMANDS: Using arg.id as sessionId:', sessionId);
            } else if (arg && arg.originalNewCodeAnalysisItem) {
                // Handle wrapped objects from modular tree
                const originalItem = arg.originalNewCodeAnalysisItem;
                if (originalItem.sessionId) {
                    sessionId = originalItem.sessionId;
                    console.log('ACTIVE_ANALYSES_COMMANDS: Using originalNewCodeAnalysisItem.sessionId:', sessionId);
                } else if (originalItem.id) {
                    sessionId = originalItem.id;
                    console.log('ACTIVE_ANALYSES_COMMANDS: Using originalNewCodeAnalysisItem.id:', sessionId);
                } else if (originalItem.session && originalItem.session.id) {
                    sessionId = originalItem.session.id;
                    console.log('ACTIVE_ANALYSES_COMMANDS: Using originalNewCodeAnalysisItem.session.id:', sessionId);
                } else {
                    console.log('ACTIVE_ANALYSES_COMMANDS: No valid session ID in originalNewCodeAnalysisItem:', originalItem);
                    vscode.window.showErrorMessage('No analysis selected');
                    return;
                }
            } else {
                console.log('ACTIVE_ANALYSES_COMMANDS: No valid session ID found in arg');
                console.log('ACTIVE_ANALYSES_COMMANDS: Arg keys:', arg ? Object.keys(arg) : 'arg is null/undefined');
                vscode.window.showErrorMessage('No analysis selected');
                return;
            }

            console.log('ACTIVE_ANALYSES_COMMANDS: Looking for session with ID:', sessionId);
            const session = this.sessionRegistry.getSession(sessionId);
            if (!session) {
                console.log('ACTIVE_ANALYSES_COMMANDS: Session not found for ID:', sessionId);
                vscode.window.showErrorMessage('Analysis session not found');
                return;
            }

            // Show warning dialog for confirmation
            const choice = await vscode.window.showWarningMessage(
                `Are you sure you want to close the analysis for "${path.basename(session.targetPath || session.targetName || 'Unknown')}"?`,
                {
                    modal: true,
                    detail: `This will stop the analysis server and remove all associated watchers. The analysis results will be lost.\n\nTarget: ${session.targetPath || session.targetName || 'Unknown'}\nType: ${session.targetType || 'Unknown'}\nMode: ${session.analysisMode || 'Unknown'}`
                },
                'Yes, Close Analysis',
                'Cancel'
            );

            if (choice === 'Yes, Close Analysis') {
                console.log('ACTIVE_ANALYSES_COMMANDS: User confirmed closure, triggering cleanup');
                
                // STEP 1: First, trigger cleanup of servers and watchers WHILE session is still in registry
                // This is critical: triggerManualCleanup() needs to look up the session by ID
                // to find the port, target path and other info needed to stop the server.
                // If we remove the session first, triggerManualCleanup() returns false immediately.
                console.log('ACTIVE_ANALYSES_COMMANDS: Triggering server and watcher cleanup first (session still in registry)');
                const cleanupSuccess = await this.serverWatcher.triggerManualCleanup(sessionId);
                
                if (!cleanupSuccess) {
                    console.warn('ACTIVE_ANALYSES_COMMANDS: Server cleanup did not complete successfully, but analysis will still be removed');
                }
                
                // STEP 2: Remove the session from registry after server cleanup
                console.log('ACTIVE_ANALYSES_COMMANDS: Removing session from registry after server cleanup');
                this.sessionRegistry.removeSession(sessionId);
                
                // STEP 3: Refresh the tree view
                vscode.commands.executeCommand('codeXR.new_code_analysis.activeAnalyses.refresh');
                
                vscode.window.showInformationMessage('Analysis closed successfully');
            }

        } catch (error) {
            console.error('ACTIVE_ANALYSES_COMMANDS: Error closing analysis:', error);
            vscode.window.showErrorMessage('Failed to close analysis');
        }
    }

    /**
     * View in browser command handler
     * Opens the analysis result in browser if server URL is available
     * FIXED: Handle TreeItem objects passed by VS Code context menus
     */
    private async viewInBrowser(arg?: ActiveAnalysisItem | string | any): Promise<void> {
        console.log('ACTIVE_ANALYSES_COMMANDS: viewInBrowser called with arg:', typeof arg, arg);
        try {
            let sessionId: string;
            
            if (typeof arg === 'string') {
                sessionId = arg;
                console.log('ACTIVE_ANALYSES_COMMANDS: Using string arg as sessionId:', sessionId);
            } else if (arg && arg.session && arg.session.id) {
                sessionId = arg.session.id;
                console.log('ACTIVE_ANALYSES_COMMANDS: Using arg.session.id as sessionId:', sessionId);
            } else if (arg && arg.sessionId) {
                // Handle sessionId property (added in getTreeItem)
                sessionId = arg.sessionId;
                console.log('ACTIVE_ANALYSES_COMMANDS: Using arg.sessionId as sessionId:', sessionId);
            } else if (arg && arg.id) {
                // Handle id property (added in getTreeItem)
                sessionId = arg.id;
                console.log('ACTIVE_ANALYSES_COMMANDS: Using arg.id as sessionId:', sessionId);
            } else if (arg && arg.originalNewCodeAnalysisItem) {
                // Handle wrapped objects from modular tree
                const originalItem = arg.originalNewCodeAnalysisItem;
                if (originalItem.sessionId) {
                    sessionId = originalItem.sessionId;
                    console.log('ACTIVE_ANALYSES_COMMANDS: Using originalNewCodeAnalysisItem.sessionId:', sessionId);
                } else if (originalItem.id) {
                    sessionId = originalItem.id;
                    console.log('ACTIVE_ANALYSES_COMMANDS: Using originalNewCodeAnalysisItem.id:', sessionId);
                } else if (originalItem.session && originalItem.session.id) {
                    sessionId = originalItem.session.id;
                    console.log('ACTIVE_ANALYSES_COMMANDS: Using originalNewCodeAnalysisItem.session.id:', sessionId);
                } else {
                    console.log('ACTIVE_ANALYSES_COMMANDS: No valid session ID in originalNewCodeAnalysisItem:', originalItem);
                    vscode.window.showErrorMessage('No analysis selected');
                    return;
                }
            } else {
                console.log('ACTIVE_ANALYSES_COMMANDS: No valid session ID found in arg');
                console.log('ACTIVE_ANALYSES_COMMANDS: Arg keys:', arg ? Object.keys(arg) : 'arg is null/undefined');
                vscode.window.showErrorMessage('No analysis selected');
                return;
            }

            console.log('ACTIVE_ANALYSES_COMMANDS: Looking for session with ID:', sessionId);
            const session = this.sessionRegistry.getSession(sessionId);
            if (!session) {
                console.log('ACTIVE_ANALYSES_COMMANDS: Session not found for ID:', sessionId);
                vscode.window.showErrorMessage('Analysis session not found');
                return;
            }

            // Check if session has a server URL
            if (!session.serverUrl && !session.assignedPort) {
                vscode.window.showErrorMessage('No server URL available for this analysis');
                return;
            }

            // Construct URL
            let url = session.serverUrl;
            if (!url && session.assignedPort) {
                url = `http://localhost:${session.assignedPort}`;
            }

            if (url) {
                try {
                    console.log('ACTIVE_ANALYSES_COMMANDS: Opening URL in browser:', url);
                    // Validate URL before parsing
                    const parsedUri = vscode.Uri.parse(url);
                    vscode.env.openExternal(parsedUri);
                } catch (uriError) {
                    console.error('ACTIVE_ANALYSES_COMMANDS: Invalid URL format:', url, uriError);
                    vscode.window.showErrorMessage(`Invalid URL format: ${url}`);
                }
            } else {
                vscode.window.showErrorMessage('Could not determine server URL for this analysis');
            }

        } catch (error) {
            console.error('ACTIVE_ANALYSES_COMMANDS: Error opening in browser:', error);
            vscode.window.showErrorMessage('Failed to open analysis in browser');
        }
    }

    /**
     * Refresh analyses command handler
     */
    private async refreshAnalyses(): Promise<void> {
        try {
            // Trigger tree view refresh via the data service directly
            // NOTE: 'codeXR.new_code_analysis.refreshTreeView' does not exist;
            // use the ActiveAnalysesDataService singleton to fire the tree data change event.
            const { ActiveAnalysesDataService } = await import('../services/activeAnalysesDataService');
            ActiveAnalysesDataService.getInstance().refresh();
            console.log('ACTIVE_ANALYSES_COMMANDS: Refresh triggered via data service');
        } catch (error) {
            console.error('Error refreshing analyses:', error);
            vscode.window.showErrorMessage('Failed to refresh analyses');
        }
    }

    /**
     * Generate details content for an analysis session
     */
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

    /**
     * Dispose of all registered commands
     */
    public dispose(): void {
        this.registeredCommands.clear();
    }
}