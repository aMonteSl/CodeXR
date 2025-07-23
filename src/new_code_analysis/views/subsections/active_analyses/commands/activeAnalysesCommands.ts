/**
 * Active Analyses Commands
 * Commands for managing active analysis sessions from the UI
 */

import * as vscode from 'vscode';
import { ActiveAnalysesDataService } from '../services/activeAnalysesDataService';
import { ActiveAnalysisData } from '../model/activeAnalysisModel';
import { getActiveServerRegistry } from '../../../../../active_servers/registry/activeServerRegistry';
import { ServerControl } from '../../../../../active_servers/runtime/serverControl';
import { ServerWatcherIntegration } from '../../../../services/serverWatcherIntegration';
import { ManageWatcher } from '../../../../engine/utils/manageWatcher';
import { AnalysisSessionRegistry } from '../../../../engine/registry/analysisSessionRegistry';
import * as fs from 'fs';
import * as path from 'path';

export interface ActiveAnalysisCommandRegistration {
    commandId: string;
    callback: (...args: any[]) => any;
    description: string;
}

export class ActiveAnalysesCommands {
    private dataService: ActiveAnalysesDataService;
    
    constructor() {
        this.dataService = ActiveAnalysesDataService.getInstance();
        console.log('ACTIVE_ANALYSES_COMMANDS: Initialized Active Analyses Commands');
    }
    
    /**
     * Get all command registrations for active analyses
     */
    getCommandRegistrations(refreshCallback: () => void): ActiveAnalysisCommandRegistration[] {
        return [
            {
                commandId: 'newCodeAnalysis.activeAnalyses.closeAnalysis',
                callback: (arg: any) => this.closeAnalysis(arg, refreshCallback),
                description: 'Close analysis session and cleanup all resources'
            },
            {
                commandId: 'newCodeAnalysis.activeAnalyses.openInBrowser',
                callback: (arg: any) => this.openAnalysisInBrowser(arg),
                description: 'Open analysis in browser'
            },
            {
                commandId: 'newCodeAnalysis.activeAnalyses.stopAnalysis',
                callback: (arg: any) => this.stopAnalysis(arg, refreshCallback),
                description: 'Stop analysis session'
            },
            {
                commandId: 'newCodeAnalysis.activeAnalyses.viewDetails',
                callback: (arg: any) => this.viewAnalysisDetails(arg),
                description: 'View analysis details'
            },
            {
                commandId: 'newCodeAnalysis.activeAnalyses.openOutputFolder',
                callback: (arg: any) => this.openOutputFolder(arg),
                description: 'Open analysis output folder'
            },
            {
                commandId: 'newCodeAnalysis.activeAnalyses.refreshAll',
                callback: () => this.refreshAllAnalyses(refreshCallback),
                description: 'Refresh all active analyses'
            },
            {
                commandId: 'newCodeAnalysis.activeAnalyses.stopAll',
                callback: () => this.stopAllAnalyses(refreshCallback),
                description: 'Stop all active analyses'
            }
        ];
    }
    
    /**
     * Extract sessionId from command argument (handles both string and TreeItem)
     */
    private extractSessionId(arg: any): string | null {
        // If it's already a string, return it
        if (typeof arg === 'string') {
            return arg;
        }
        
        // If it's a TreeItem with sessionData, extract sessionId
        if (arg && arg.sessionData && arg.sessionData.sessionId) {
            return arg.sessionData.sessionId;
        }
        
        // Log the received argument for debugging
        console.log('ACTIVE_ANALYSES_COMMANDS: Received argument:', arg);
        
        // Try to extract from different possible structures
        if (arg && arg.sessionId) {
            return arg.sessionId;
        }
        
        // If it has a command with arguments, try to get sessionId from there
        if (arg && arg.command && arg.command.arguments && arg.command.arguments.length > 0) {
            return arg.command.arguments[0];
        }
        
        return null;
    }

    /**
     * Close analysis session and cleanup all resources
     */
    private async closeAnalysis(arg: any, refreshCallback: () => void): Promise<void> {
        try {
            const sessionId = this.extractSessionId(arg);
            if (!sessionId) {
                vscode.window.showErrorMessage('Invalid session ID for close analysis operation');
                return;
            }
            
            console.log(`ACTIVE_ANALYSES_COMMANDS: Closing analysis session ${sessionId}`);
            
            const analysisData = this.dataService.getAnalysisData(sessionId);
            if (!analysisData) {
                vscode.window.showErrorMessage(`Analysis session ${sessionId} not found`);
                return;
            }
            
            // Confirm with user
            const action = await vscode.window.showWarningMessage(
                `Close analysis for "${analysisData.fileName} - ${analysisData.analysisType}"?\n\nThis will:\n• Stop the analysis server\n• Remove file watcher\n• Delete analysis files`,
                { modal: true },
                'Close Analysis',
                'Cancel'
            );
            
            if (action !== 'Close Analysis') {
                return;
            }
            
            // Use the integration service for comprehensive cleanup
            const integrationService = ServerWatcherIntegration.getInstance();
            const success = await integrationService.triggerManualCleanup(sessionId);
            
            if (success) {
                vscode.window.showInformationMessage(
                    `✅ Closed analysis: ${analysisData.fileName} - ${analysisData.analysisType}`
                );
                refreshCallback();
            } else {
                vscode.window.showErrorMessage(
                    `Failed to close session: ${analysisData.fileName} - ${analysisData.analysisType}`
                );
            }
            
        } catch (error) {
            console.error(`ACTIVE_ANALYSES_COMMANDS: Error closing analysis:`, error);
            vscode.window.showErrorMessage(`Failed to close analysis: ${error}`);
        }
    }
    
    /**
     * Close analysis server by port
     */
    private async closeAnalysisServer(port: number, filePath: string): Promise<void> {
        try {
            console.log(`ACTIVE_ANALYSES_COMMANDS: Closing server on port ${port} for file: ${filePath}`);
            
            const serverRegistry = getActiveServerRegistry();
            const servers = serverRegistry.getAllServers();
            
            // Find server by port
            const targetServer = servers.find(server => server.port === port);
            
            if (targetServer) {
                console.log(`ACTIVE_ANALYSES_COMMANDS: Found server ${targetServer.id} on port ${port}`);
                
                // Stop the server using ServerControl
                const stopped = await ServerControl.stopServer(targetServer.id);
                
                if (stopped) {
                    console.log(`ACTIVE_ANALYSES_COMMANDS: Successfully stopped server ${targetServer.id}`);
                } else {
                    console.warn(`ACTIVE_ANALYSES_COMMANDS: Failed to stop server ${targetServer.id}`);
                }
            } else {
                console.log(`ACTIVE_ANALYSES_COMMANDS: No server found on port ${port}`);
            }
            
        } catch (error) {
            console.error(`ACTIVE_ANALYSES_COMMANDS: Error closing server:`, error);
        }
    }
    
    /**
     * Stop file watcher for the session
     */
    private async stopFileWatcher(sessionId: string): Promise<void> {
        try {
            console.log(`ACTIVE_ANALYSES_COMMANDS: Stopping file watcher for session ${sessionId}`);
            
            // Get all active watchers and find the one for this session
            const watchersInfo = ManageWatcher.getActiveWatchersInfo();
            
            // Find watcher by checking if the sessionId is in the watcher ID or by matching file path
            const registry = AnalysisSessionRegistry.getInstance();
            const session = registry.getSession(sessionId);
            
            if (session) {
                // Try to find watcher by file path
                const watcherInfo = watchersInfo.find((w: any) => w.filePath === session.filePath);
                
                if (watcherInfo) {
                    const stopped = ManageWatcher.stopWatching(watcherInfo.id);
                    
                    if (stopped) {
                        console.log(`ACTIVE_ANALYSES_COMMANDS: Successfully stopped file watcher ${watcherInfo.id}`);
                    } else {
                        console.warn(`ACTIVE_ANALYSES_COMMANDS: Failed to stop file watcher ${watcherInfo.id}`);
                    }
                } else {
                    console.log(`ACTIVE_ANALYSES_COMMANDS: No file watcher found for session ${sessionId}`);
                }
            }
            
        } catch (error) {
            console.error(`ACTIVE_ANALYSES_COMMANDS: Error stopping file watcher:`, error);
        }
    }
    
    /**
     * Cleanup analysis files and directory
     */
    private async cleanupAnalysisFiles(sessionId: string): Promise<void> {
        try {
            console.log(`ACTIVE_ANALYSES_COMMANDS: Cleaning up analysis files for session ${sessionId}`);
            
            const registry = AnalysisSessionRegistry.getInstance();
            const session = registry.getSession(sessionId);
            
            if (session && session.outputPath) {
                // Check if directory exists
                if (fs.existsSync(session.outputPath)) {
                    console.log(`ACTIVE_ANALYSES_COMMANDS: Removing analysis directory: ${session.outputPath}`);
                    
                    // Remove the directory and all its contents
                    await fs.promises.rm(session.outputPath, { recursive: true, force: true });
                    
                    console.log(`ACTIVE_ANALYSES_COMMANDS: Successfully removed analysis directory`);
                } else {
                    console.log(`ACTIVE_ANALYSES_COMMANDS: Analysis directory does not exist: ${session.outputPath}`);
                }
            } else {
                console.log(`ACTIVE_ANALYSES_COMMANDS: No output path found for session ${sessionId}`);
            }
            
        } catch (error) {
            console.error(`ACTIVE_ANALYSES_COMMANDS: Error cleaning up analysis files:`, error);
        }
    }

    /**
     * Open analysis in browser
     */
    private async openAnalysisInBrowser(arg: any): Promise<void> {
        try {
            const sessionId = this.extractSessionId(arg);
            if (!sessionId) {
                vscode.window.showErrorMessage('Invalid session ID for open in browser operation');
                return;
            }
            
            console.log(`ACTIVE_ANALYSES_COMMANDS: Opening analysis ${sessionId} in browser`);
            
            const analysisData = this.dataService.getAnalysisData(sessionId);
            if (!analysisData) {
                vscode.window.showErrorMessage(`Analysis session ${sessionId} not found`);
                return;
            }
            
            if (!analysisData.serverUrl) {
                vscode.window.showWarningMessage(
                    `No server URL available for analysis: ${analysisData.fileName} - ${analysisData.analysisType}`
                );
                return;
            }
            
            // Open in external browser
            await vscode.env.openExternal(vscode.Uri.parse(analysisData.serverUrl));
            
            vscode.window.showInformationMessage(
                `Opened ${analysisData.fileName} analysis in browser`
            );
            
        } catch (error) {
            console.error(`ACTIVE_ANALYSES_COMMANDS: Error opening analysis in browser:`, error);
            vscode.window.showErrorMessage(`Failed to open analysis in browser: ${error}`);
        }
    }
    
    /**
     * Stop analysis session
     */
    private async stopAnalysis(arg: any, refreshCallback: () => void): Promise<void> {
        try {
            const sessionId = this.extractSessionId(arg);
            if (!sessionId) {
                vscode.window.showErrorMessage('Invalid session ID for stop analysis operation');
                return;
            }
            
            console.log(`ACTIVE_ANALYSES_COMMANDS: Stopping analysis ${sessionId}`);
            
            const analysisData = this.dataService.getAnalysisData(sessionId);
            if (!analysisData) {
                vscode.window.showErrorMessage(`Analysis session ${sessionId} not found`);
                return;
            }
            
            // Confirm with user
            const action = await vscode.window.showWarningMessage(
                `Stop analysis for "${analysisData.fileName} - ${analysisData.analysisType}"?`,
                { modal: true },
                'Stop Analysis',
                'Cancel'
            );
            
            if (action !== 'Stop Analysis') {
                return;
            }
            
            // Stop the analysis
            const success = this.dataService.stopAnalysis(sessionId);
            
            if (success) {
                vscode.window.showInformationMessage(
                    `Stopped analysis: ${analysisData.fileName} - ${analysisData.analysisType}`
                );
                refreshCallback();
            } else {
                vscode.window.showErrorMessage(
                    `Failed to stop analysis: ${analysisData.fileName} - ${analysisData.analysisType}`
                );
            }
            
        } catch (error) {
            console.error(`ACTIVE_ANALYSES_COMMANDS: Error stopping analysis:`, error);
            vscode.window.showErrorMessage(`Failed to stop analysis: ${error}`);
        }
    }
    
    /**
     * View detailed information about analysis
     */
    private async viewAnalysisDetails(arg: any): Promise<void> {
        try {
            const sessionId = this.extractSessionId(arg);
            if (!sessionId) {
                vscode.window.showErrorMessage('Invalid session ID for view details operation');
                return;
            }
            
            console.log(`ACTIVE_ANALYSES_COMMANDS: Viewing details for analysis ${sessionId}`);
            
            const analysisData = this.dataService.getAnalysisData(sessionId);
            if (!analysisData) {
                vscode.window.showErrorMessage(`Analysis session ${sessionId} not found`);
                return;
            }
            
            // Create detailed information message
            let details = `Analysis Details\n\n`;
            details += `File: ${analysisData.fileName}\n`;
            details += `Type: ${analysisData.analysisType}\n`;
            details += `Status: ${analysisData.status}\n`;
            details += `Session ID: ${analysisData.sessionId}\n\n`;
            
            details += `Started: ${analysisData.startTime.toLocaleString()}\n`;
            details += `Last Analysis: ${analysisData.lastAnalysisTime.toLocaleString()}\n`;
            
            if (analysisData.durationSeconds !== undefined) {
                details += `Duration: ${analysisData.durationSeconds} seconds\n`;
            }
            
            if (analysisData.progress !== undefined) {
                details += `Progress: ${analysisData.progress}%\n`;
            }
            
            if (analysisData.serverUrl) {
                details += `\nServer: ${analysisData.serverUrl}\n`;
                details += `Port: ${analysisData.serverPort}\n`;
            }
            
            details += `\nFile Path: ${analysisData.filePath}`;
            
            // Show details in information dialog
            await vscode.window.showInformationMessage(details, { modal: true });
            
        } catch (error) {
            console.error(`ACTIVE_ANALYSES_COMMANDS: Error viewing analysis details:`, error);
            vscode.window.showErrorMessage(`Failed to view analysis details: ${error}`);
        }
    }
    
    /**
     * Open analysis output folder
     */
    private async openOutputFolder(arg: any): Promise<void> {
        try {
            const sessionId = this.extractSessionId(arg);
            if (!sessionId) {
                vscode.window.showErrorMessage('Invalid session ID for open output folder operation');
                return;
            }
            
            console.log(`ACTIVE_ANALYSES_COMMANDS: Opening output folder for analysis ${sessionId}`);
            
            const analysisData = this.dataService.getAnalysisData(sessionId);
            if (!analysisData) {
                vscode.window.showErrorMessage(`Analysis session ${sessionId} not found`);
                return;
            }
            
            // TODO: Get the actual output folder path from the session
            // For now, show a message that this feature is coming
            vscode.window.showInformationMessage(
                `Opening output folder for: ${analysisData.fileName} - ${analysisData.analysisType}\n` +
                `Session: ${sessionId}\n\n` +
                `Note: This feature will open the analysis results directory in the file explorer.`,
                'OK'
            );
            
        } catch (error) {
            console.error(`ACTIVE_ANALYSES_COMMANDS: Error opening output folder:`, error);
            vscode.window.showErrorMessage(`Failed to open output folder: ${error}`);
        }
    }
    
    /**
     * Refresh all analyses
     */
    private refreshAllAnalyses(refreshCallback: () => void): void {
        try {
            console.log('ACTIVE_ANALYSES_COMMANDS: Refreshing all analyses');
            
            this.dataService.refresh();
            refreshCallback();
            
            vscode.window.showInformationMessage('Active analyses refreshed');
            
        } catch (error) {
            console.error('ACTIVE_ANALYSES_COMMANDS: Error refreshing all analyses:', error);
            vscode.window.showErrorMessage(`Failed to refresh analyses: ${error}`);
        }
    }
    
    /**
     * Stop all active analyses
     */
    private async stopAllAnalyses(refreshCallback: () => void): Promise<void> {
        try {
            console.log('ACTIVE_ANALYSES_COMMANDS: Stopping all analyses');
            
            const activeAnalyses = this.dataService.getActiveAnalyses();
            const runningAnalyses = activeAnalyses.filter(a => 
                a.status === 'creating' || a.status === 'analyzing'
            );
            
            if (runningAnalyses.length === 0) {
                vscode.window.showInformationMessage('No active analyses to stop');
                return;
            }
            
            // Confirm with user
            const action = await vscode.window.showWarningMessage(
                `Stop all ${runningAnalyses.length} active analysis${runningAnalyses.length === 1 ? '' : 'es'}?`,
                { modal: true },
                'Stop All',
                'Cancel'
            );
            
            if (action !== 'Stop All') {
                return;
            }
            
            // Stop all running analyses
            let stoppedCount = 0;
            for (const analysis of runningAnalyses) {
                const success = this.dataService.stopAnalysis(analysis.sessionId);
                if (success) {
                    stoppedCount++;
                }
            }
            
            if (stoppedCount > 0) {
                vscode.window.showInformationMessage(
                    `Stopped ${stoppedCount} of ${runningAnalyses.length} active analyses`
                );
                refreshCallback();
            } else {
                vscode.window.showErrorMessage('Failed to stop any analyses');
            }
            
        } catch (error) {
            console.error('ACTIVE_ANALYSES_COMMANDS: Error stopping all analyses:', error);
            vscode.window.showErrorMessage(`Failed to stop all analyses: ${error}`);
        }
    }
}
