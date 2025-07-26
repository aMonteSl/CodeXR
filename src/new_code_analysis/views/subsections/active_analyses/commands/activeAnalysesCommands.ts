/**
 * Active Analyses Commands
 * Handles command registration and execution for active analysis operations
 */

import * as vscode from 'vscode';
import { UnifiedSessionRegistry } from '../../../../../new_code_analysis/new_engine/core/sessionRegistry';
import { ServerWatcherIntegration } from '../../../../../new_code_analysis/services/serverWatcherIntegration';
import { ActiveAnalysisTreeItem } from '../items/activeAnalysisItems';
import { ActiveAnalysisData } from '../model/activeAnalysisModel';
import { ActiveAnalysisItem } from '../services/activeAnalysesDataService';

/**
 * Command registration configuration for active analyses
 */
export interface ActiveAnalysisCommandRegistration {
    commandId: string;
    title: string;
    handler: (arg?: ActiveAnalysisTreeItem | ActiveAnalysisItem | string) => void | Promise<void>;
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
                commandId: 'codeXR.new_code_analysis.activeAnalyses.refresh',
                title: 'Refresh Active Analyses',
                handler: this.refreshActiveAnalyses.bind(this)
            },
            {
                commandId: 'codeXR.new_code_analysis.activeAnalyses.closeAll',
                title: 'Close All Analyses',
                handler: this.closeAllAnalyses.bind(this)
            }
        ];
    }

    /**
     * Get or create the singleton instance
     */
    static getInstance(
        sessionRegistry: UnifiedSessionRegistry,
        serverWatcher: ServerWatcherIntegration
    ): ActiveAnalysesCommands {
        if (!ActiveAnalysesCommands.instance) {
            ActiveAnalysesCommands.instance = new ActiveAnalysesCommands(sessionRegistry, serverWatcher);
        }
        return ActiveAnalysesCommands.instance;
    }

    /**
     * Register all active analyses commands
     */
    registerCommands(context: vscode.ExtensionContext): void {
        this.commands.forEach(command => {
            if (!this.registeredCommands.has(command.commandId)) {
                // Double check that VS Code doesn't already have this command registered
                try {
                    const disposable = vscode.commands.registerCommand(command.commandId, command.handler);
                    context.subscriptions.push(disposable);
                    this.registeredCommands.add(command.commandId);
                    console.log(`[ACTIVE_ANALYSES_COMMANDS] Registered command: ${command.commandId}`);
                } catch (error) {
                    if (error instanceof Error && error.message.includes('already exists')) {
                        console.warn(`[ACTIVE_ANALYSES_COMMANDS] Command ${command.commandId} already exists, skipping registration`);
                        this.registeredCommands.add(command.commandId); // Mark as registered to avoid retries
                    } else {
                        console.error(`[ACTIVE_ANALYSES_COMMANDS] Error registering command ${command.commandId}:`, error);
                    }
                }
            } else {
                console.log(`[ACTIVE_ANALYSES_COMMANDS] Command ${command.commandId} already registered, skipping`);
            }
        });
    }

    /**
     * Show details for a specific analysis
     */
    private async showDetails(item?: ActiveAnalysisTreeItem | ActiveAnalysisItem | string): Promise<void> {
        console.log(`[ACTIVE_ANALYSES_COMMANDS] showDetails called with:`, typeof item, item);
        
        try {
            let sessionId: string;
            let sessionData: ActiveAnalysisData | undefined;
            
            // Handle different types of items
            if (typeof item === 'string') {
                sessionId = item;
                // Find the session by ID
                const session = this.sessionRegistry.getSession(sessionId);
                if (session) {
                    sessionData = {
                        sessionId: session.id,
                        fileName: session.targetName || 'Unknown',
                        filePath: session.targetPath || '',
                        analysisType: session.analysisMode || 'Unknown',
                        status: session.status as any || 'creating',
                        lastAnalysisTime: session.startTime,
                        startTime: session.startTime,
                        serverPort: session.assignedPort,
                        serverUrl: session.serverUrl
                    };
                }
            } else if (item && typeof item === 'object') {
                // Check for ActiveAnalysisItem (from data service)
                if ('sessionId' in item && item.sessionId) {
                    sessionId = item.sessionId;
                    const session = this.sessionRegistry.getSession(sessionId);
                    if (session) {
                        sessionData = {
                            sessionId: session.id,
                            fileName: session.targetName || 'Unknown',
                            filePath: session.targetPath || '',
                            analysisType: session.analysisMode || 'Unknown',
                            status: session.status as any || 'creating',
                            lastAnalysisTime: session.startTime,
                            startTime: session.startTime,
                            serverPort: session.assignedPort,
                            serverUrl: session.serverUrl
                        };
                    }
                } else if ('id' in item && item.id) {
                    // Fallback to id property
                    sessionId = item.id;
                    const session = this.sessionRegistry.getSession(sessionId);
                    if (session) {
                        sessionData = {
                            sessionId: session.id,
                            fileName: session.targetName || 'Unknown',
                            filePath: session.targetPath || '',
                            analysisType: session.analysisMode || 'Unknown',
                            status: session.status as any || 'creating',
                            lastAnalysisTime: session.startTime,
                            startTime: session.startTime,
                            serverPort: session.assignedPort,
                            serverUrl: session.serverUrl
                        };
                    }
                } else if (item instanceof ActiveAnalysisTreeItem) {
                    // ActiveAnalysisTreeItem
                    sessionId = item.sessionData.sessionId;
                    sessionData = item.sessionData;
                } else {
                    console.log(`[ACTIVE_ANALYSES_COMMANDS] Unexpected item structure for showDetails:`, item);
                    vscode.window.showWarningMessage('Could not identify analysis from selection');
                    return;
                }
            } else {
                console.log(`[ACTIVE_ANALYSES_COMMANDS] No valid item provided:`, item);
                vscode.window.showWarningMessage('No analysis selected');
                return;
            }
            
            if (!sessionData) {
                console.log(`[ACTIVE_ANALYSES_COMMANDS] No session data found for:`, sessionId);
                vscode.window.showWarningMessage('Analysis not found or no longer active');
                return;
            }
            
            // Create details message
            const details = [
                `**Analysis Details**`,
                ``,
                `**ID:** ${sessionData.sessionId}`,
                `**Type:** ${sessionData.analysisType}`,
                `**File:** ${sessionData.fileName}`,
                `**Path:** ${sessionData.filePath}`,
                `**Started:** ${sessionData.startTime.toLocaleString()}`,
                `**Status:** ${sessionData.status}`,
                ``
            ];

            if (sessionData.serverPort) {
                details.push(`**Port:** ${sessionData.serverPort}`);
            }

            if (sessionData.serverUrl) {
                details.push(`**URL:** ${sessionData.serverUrl}`);
            }

            if (sessionData.progress !== undefined) {
                details.push(`**Progress:** ${sessionData.progress}%`);
            }

            const detailsText = details.join('\n');
            
            // Show details in a new document
            const doc = await vscode.workspace.openTextDocument({
                content: detailsText,
                language: 'markdown'
            });
            
            await vscode.window.showTextDocument(doc, { preview: true });
            
        } catch (error) {
            console.error('[ACTIVE_ANALYSES_COMMANDS] Error showing details:', error);
            vscode.window.showErrorMessage(`Error showing analysis details: ${error}`);
        }
    }

    /**
     * Close a specific analysis
     */
    private async closeAnalysis(item?: ActiveAnalysisTreeItem | ActiveAnalysisItem | string): Promise<void> {
        console.log(`[ACTIVE_ANALYSES_COMMANDS] closeAnalysis called with:`, typeof item, item);
        
        try {
            let sessionId: string;
            let sessionName: string;
            
            // Handle different types of items
            if (typeof item === 'string') {
                sessionId = item;
                const session = this.sessionRegistry.getSession(sessionId);
                sessionName = session?.targetName || sessionId;
            } else if (item && typeof item === 'object') {
                // Check for ActiveAnalysisItem (from data service)
                if ('sessionId' in item && item.sessionId) {
                    sessionId = item.sessionId;
                    sessionName = item.label || sessionId;
                } else if ('id' in item && item.id) {
                    // Fallback to id property
                    sessionId = item.id;
                    sessionName = item.label || sessionId;
                } else if (item instanceof ActiveAnalysisTreeItem) {
                    // ActiveAnalysisTreeItem
                    sessionId = item.sessionData.sessionId;
                    sessionName = item.sessionData.fileName;
                } else {
                    // Try to extract sessionId from command arguments if it's a TreeItem
                    console.log(`[ACTIVE_ANALYSES_COMMANDS] Unexpected item structure:`, item);
                    vscode.window.showWarningMessage('Could not identify analysis from selection');
                    return;
                }
            } else {
                console.log(`[ACTIVE_ANALYSES_COMMANDS] Invalid item for closeAnalysis:`, item);
                vscode.window.showWarningMessage('Invalid analysis selection');
                return;
            }

            const session = this.sessionRegistry.getSession(sessionId);
            if (!session) {
                vscode.window.showWarningMessage('Analysis not found or already closed');
                return;
            }

            // Confirm closure
            const choice = await vscode.window.showWarningMessage(
                `Close analysis "${sessionName}"?`,
                { modal: true },
                'Close'
            );

            if (choice === 'Close') {
                // Close the session
                await this.sessionRegistry.closeSession(sessionId);
                
                // Stop associated server if exists (remove server integration for now)
                // if (session.serverId) {
                //     await this.serverWatcher.stopServer(session.serverId);
                // }

                vscode.window.showInformationMessage(`Analysis "${sessionName}" closed successfully`);
                
                // Refresh the tree view
                vscode.commands.executeCommand('codeXR.new_code_analysis.activeAnalyses.refresh');
            }
            
        } catch (error) {
            console.error('[ACTIVE_ANALYSES_COMMANDS] Error closing analysis:', error);
            vscode.window.showErrorMessage(`Error closing analysis: ${error}`);
        }
    }

    /**
     * Refresh the active analyses tree view
     */
    private refreshActiveAnalyses(): void {
        console.log('[ACTIVE_ANALYSES_COMMANDS] Refreshing active analyses');
        // This will be handled by the tree data provider's refresh mechanism
        vscode.commands.executeCommand('codeXR.views.refresh');
    }

    /**
     * Close all active analyses
     */
    private async closeAllAnalyses(): Promise<void> {
        console.log('[ACTIVE_ANALYSES_COMMANDS] closeAllAnalyses called');
        
        try {
            const sessions = this.sessionRegistry.getActiveSessions();
            
            if (sessions.length === 0) {
                vscode.window.showInformationMessage('No active analyses to close');
                return;
            }

            // Confirm closure
            const choice = await vscode.window.showWarningMessage(
                `Close all ${sessions.length} active analyses?`,
                { modal: true },
                'Close All'
            );

            if (choice === 'Close All') {
                let closedCount = 0;
                let errorCount = 0;

                for (const session of sessions) {
                    try {
                        await this.sessionRegistry.closeSession(session.id);
                        
                        // Stop associated server if exists (remove server integration for now)
                        // if (session.serverId) {
                        //     await this.serverWatcher.stopServer(session.serverId);
                        // }
                        
                        closedCount++;
                    } catch (error) {
                        console.error('[ACTIVE_ANALYSES_COMMANDS] Error closing session:', session.id, error);
                        errorCount++;
                    }
                }

                if (errorCount === 0) {
                    vscode.window.showInformationMessage(`Successfully closed all ${closedCount} analyses`);
                } else {
                    vscode.window.showWarningMessage(`Closed ${closedCount} analyses, ${errorCount} failed`);
                }
                
                // Refresh the tree view
                vscode.commands.executeCommand('codeXR.new_code_analysis.activeAnalyses.refresh');
            }
            
        } catch (error) {
            console.error('[ACTIVE_ANALYSES_COMMANDS] Error closing all analyses:', error);
            vscode.window.showErrorMessage(`Error closing analyses: ${error}`);
        }
    }

    /**
     * Get all registered command configurations
     */
    getCommands(): ActiveAnalysisCommandRegistration[] {
        return [...this.commands];
    }

    /**
     * Check if a command is registered
     */
    isCommandRegistered(commandId: string): boolean {
        return this.registeredCommands.has(commandId);
    }

    /**
     * Dispose of all registered commands
     */
    dispose(): void {
        this.registeredCommands.clear();
        console.log('[ACTIVE_ANALYSES_COMMANDS] Disposed all commands');
    }
}