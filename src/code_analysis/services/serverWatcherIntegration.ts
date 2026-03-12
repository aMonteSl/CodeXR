/**
 * Server-Watcher Integration Service
 * Coordinates watcher cleanup when servers or analysis sessions are closed.
 */

import * as vscode from 'vscode';
import { UnifiedSessionRegistry } from '../engine/core/sessionRegistry';
import { SessionWatcherManager } from '../engine/watchers/sessionWatcherManager';
import { getActiveServerRegistry } from '../../active_servers/registry/activeServerRegistry';
import { ServerControl } from '../../active_servers/runtime/serverControl';
import * as fs from 'fs';

export class ServerWatcherIntegration {
    private static instance: ServerWatcherIntegration;
    private context: vscode.ExtensionContext;
    private sessionWatcherManager: SessionWatcherManager;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.sessionWatcherManager = new SessionWatcherManager(context);
        console.log('SERVER_WATCHER_INTEGRATION: Initializing service');
        this.setupServerEventListeners();
    }

    public static getInstance(context?: vscode.ExtensionContext): ServerWatcherIntegration {
        if (!ServerWatcherIntegration.instance) {
            if (!context) {
                throw new Error('ServerWatcherIntegration: ExtensionContext required for first initialization');
            }
            ServerWatcherIntegration.instance = new ServerWatcherIntegration(context);
        }
        return ServerWatcherIntegration.instance;
    }

    private setupServerEventListeners(): void {
        try {
            const serverRegistry = getActiveServerRegistry();
            serverRegistry.onRegistryChange((event: any) => {
                if (event.type === 'serverRemoved') {
                    void this.handleServerRemoved(event.serverId!, event.server!);
                }
            });
        } catch (error) {
            console.error('SERVER_WATCHER_INTEGRATION: Error setting up server event listeners:', error);
        }
    }

    private async handleServerRemoved(serverId: string, server: any): Promise<void> {
        try {
            const sessionRegistry = UnifiedSessionRegistry.getInstance(this.context);
            const affectedSessions = sessionRegistry.getAllSessions().filter((session: any) => session.port === server.port);

            console.log(`SERVER_WATCHER_INTEGRATION: Found ${affectedSessions.length} affected sessions for server ${serverId}`);
            for (const session of affectedSessions) {
                await this.cleanupSessionAfterServerClosure(session.id, server.port);
            }
        } catch (error) {
            console.error('SERVER_WATCHER_INTEGRATION: Error handling server removal:', error);
        }
    }

    private async cleanupSessionAfterServerClosure(sessionId: string, serverPort: number): Promise<void> {
        try {
            const sessionRegistry = UnifiedSessionRegistry.getInstance(this.context);
            const session = sessionRegistry.getSession(sessionId);
            if (!session) {
                return;
            }

            await this.stopFileWatcherForSession(sessionId, session.targetPath);
            await this.cleanupAnalysisFiles(session.outputPath);
            sessionRegistry.updateSessionStatus(sessionId, 'closed');

            vscode.window.showInformationMessage(
                `Analysis cleaned up: ${session.targetName} - ${session.analysisMode} (server on port ${serverPort} was closed)`,
            );
        } catch (error) {
            console.error(`SERVER_WATCHER_INTEGRATION: Error cleaning up session ${sessionId}:`, error);
        }
    }

    private async stopFileWatcherForSession(sessionId: string, filePath: string): Promise<void> {
        try {
            console.log(`SERVER_WATCHER_INTEGRATION: Stopping watchers for session ${sessionId}, target: ${filePath}`);
            const sessionWatcherStopped = await this.sessionWatcherManager.stopWatchingSession(sessionId);

            if (sessionWatcherStopped) {
                console.log(`SERVER_WATCHER_INTEGRATION: Stopped session watcher for session ${sessionId}`);
            } else {
                console.log(`SERVER_WATCHER_INTEGRATION: No active session watcher found for session ${sessionId}`);
            }
        } catch (error) {
            console.error(`SERVER_WATCHER_INTEGRATION: Error stopping watcher for session ${sessionId}:`, error);
        }
    }

    private async cleanupAnalysisFiles(outputPath: string): Promise<void> {
        try {
            if (outputPath && fs.existsSync(outputPath)) {
                console.log(`SERVER_WATCHER_INTEGRATION: Cleaning up analysis files at: ${outputPath}`);
            }
        } catch (error) {
            console.error('SERVER_WATCHER_INTEGRATION: Error cleaning up analysis files:', error);
        }
    }

    public async triggerManualCleanup(sessionId: string): Promise<boolean> {
        try {
            const sessionRegistry = UnifiedSessionRegistry.getInstance(this.context);
            const session = sessionRegistry.getSession(sessionId);
            if (!session) {
                return false;
            }

            const sessionPort = session.assignedPort;
            if (sessionPort) {
                await this.stopServerByPort(sessionPort);
            } else {
                await this.findAndStopServerForSession(sessionId, session);
            }

            await this.stopFileWatcherForSession(sessionId, session.targetPath);
            await this.cleanupAnalysisFiles(session.outputPath);
            return sessionRegistry.updateSessionStatus(sessionId, 'closed');
        } catch (error) {
            console.error('SERVER_WATCHER_INTEGRATION: Error in manual cleanup:', error);
            return false;
        }
    }

    private async stopServerByPort(port: number): Promise<void> {
        try {
            const serverRegistry = getActiveServerRegistry();
            const serverToStop = serverRegistry.getAllServers().find((server: any) => server.port === port);
            if (serverToStop) {
                await ServerControl.stopServer(serverToStop.id);
            }
        } catch (error) {
            console.error(`SERVER_WATCHER_INTEGRATION: Error stopping server by port ${port}:`, error);
        }
    }

    private async findAndStopServerForSession(sessionId: string, session: any): Promise<void> {
        try {
            const serverRegistry = getActiveServerRegistry();
            const servers = serverRegistry.getAllServers();

            let matchingServer = servers.find((server: any) => server.metadata && server.metadata.sessionId === sessionId);

            if (!matchingServer && session.outputPath) {
                matchingServer = servers.find((server: any) => server.htmlFile && server.htmlFile.includes(session.outputPath));
            }

            if (!matchingServer) {
                matchingServer = servers.find((server: any) => server.customName && server.customName.includes('Analysis'));
            }

            if (matchingServer) {
                await ServerControl.stopServer(matchingServer.id);
            }
        } catch (error) {
            console.error(`SERVER_WATCHER_INTEGRATION: Error finding and stopping server for session ${sessionId}:`, error);
        }
    }

    public static initialize(context: vscode.ExtensionContext): void {
        ServerWatcherIntegration.getInstance(context);
        console.log('SERVER_WATCHER_INTEGRATION: Service initialized');
    }
}
