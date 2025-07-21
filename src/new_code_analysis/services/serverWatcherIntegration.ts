/**
 * Server-Watcher Integration Service
 * Manages communication between servers and file watchers for cleanup coordination
 */

import * as vscode from 'vscode';
import { AnalysisSessionRegistry } from '../engine/registry/analysisSessionRegistry';
import { FileWatcher } from '../engine/utils/fileWatcher';
import { getActiveServerRegistry } from '../../active_servers/registry/activeServerRegistry';
import { ServerControl } from '../../active_servers/runtime/serverControl';
import * as fs from 'fs';

export class ServerWatcherIntegration {
    private static instance: ServerWatcherIntegration;
    
    private constructor() {
        console.log('SERVER_WATCHER_INTEGRATION: Initializing service');
        this.setupServerEventListeners();
    }
    
    /**
     * Get singleton instance
     */
    public static getInstance(): ServerWatcherIntegration {
        if (!ServerWatcherIntegration.instance) {
            ServerWatcherIntegration.instance = new ServerWatcherIntegration();
        }
        return ServerWatcherIntegration.instance;
    }
    
    /**
     * Setup listeners for server events
     */
    private setupServerEventListeners(): void {
        try {
            console.log('SERVER_WATCHER_INTEGRATION: Setting up server event listeners');
            
            const serverRegistry = getActiveServerRegistry();
            
            // Listen for server registry changes
            serverRegistry.onRegistryChange((event: any) => {
                if (event.type === 'serverRemoved') {
                    console.log(`SERVER_WATCHER_INTEGRATION: Server removed event detected: ${event.serverId}`);
                    this.handleServerRemoved(event.serverId!, event.server!);
                }
            });
            
            console.log('SERVER_WATCHER_INTEGRATION: Server event listeners setup complete');
            
        } catch (error) {
            console.error('SERVER_WATCHER_INTEGRATION: Error setting up server event listeners:', error);
        }
    }
    
    /**
     * Handle server removal - cleanup associated analysis sessions
     */
    private async handleServerRemoved(serverId: string, server: any): Promise<void> {
        try {
            console.log(`SERVER_WATCHER_INTEGRATION: Handling server removal: ${serverId} on port ${server.port}`);
            
            // Find analysis sessions that were using this server
            const sessionRegistry = AnalysisSessionRegistry.getInstance();
            const allSessions = sessionRegistry.getAllSessions();
            
            const affectedSessions = allSessions.filter((session: any) => {
                // Check if session has the same port (indicating it was using this server)
                return session.port === server.port;
            });
            
            console.log(`SERVER_WATCHER_INTEGRATION: Found ${affectedSessions.length} affected sessions for server ${serverId}`);
            
            // Cleanup each affected session
            for (const session of affectedSessions) {
                await this.cleanupSessionAfterServerClosure(session.id, server.port);
            }
            
        } catch (error) {
            console.error(`SERVER_WATCHER_INTEGRATION: Error handling server removal:`, error);
        }
    }
    
    /**
     * Cleanup session after server closure
     */
    private async cleanupSessionAfterServerClosure(sessionId: string, serverPort: number): Promise<void> {
        try {
            console.log(`SERVER_WATCHER_INTEGRATION: Cleaning up session ${sessionId} after server closure (port ${serverPort})`);
            
            const sessionRegistry = AnalysisSessionRegistry.getInstance();
            const session = sessionRegistry.getSession(sessionId);
            
            if (!session) {
                console.log(`SERVER_WATCHER_INTEGRATION: Session ${sessionId} not found`);
                return;
            }
            
            // 1. Stop file watcher
            await this.stopFileWatcherForSession(sessionId, session.filePath);
            
            // 2. Cleanup analysis files
            await this.cleanupAnalysisFiles(session.outputPath);
            
            // 3. Close the session
            sessionRegistry.closeSession(sessionId);
            
            // 4. Show notification to user
            vscode.window.showInformationMessage(
                `🗑️ Analysis cleaned up: ${session.fileName} - ${session.analysisType} (server on port ${serverPort} was closed)`
            );
            
            console.log(`SERVER_WATCHER_INTEGRATION: Successfully cleaned up session ${sessionId}`);
            
        } catch (error) {
            console.error(`SERVER_WATCHER_INTEGRATION: Error cleaning up session ${sessionId}:`, error);
        }
    }
    
    /**
     * Stop file watcher for a session
     */
    private async stopFileWatcherForSession(sessionId: string, filePath: string): Promise<void> {
        try {
            console.log(`SERVER_WATCHER_INTEGRATION: Stopping file watcher for session ${sessionId}, file: ${filePath}`);
            
            // Get all active watchers and find the one for this session
            const watchersInfo = FileWatcher.getActiveWatchersInfo();
            
            // Find watcher by file path
            const watcherInfo = watchersInfo.find((w: any) => w.filePath === filePath);
            
            if (watcherInfo) {
                const stopped = FileWatcher.stopWatching(watcherInfo.id);
                
                if (stopped) {
                    console.log(`SERVER_WATCHER_INTEGRATION: Successfully stopped file watcher ${watcherInfo.id}`);
                } else {
                    console.warn(`SERVER_WATCHER_INTEGRATION: Failed to stop file watcher ${watcherInfo.id}`);
                }
            } else {
                console.log(`SERVER_WATCHER_INTEGRATION: No file watcher found for file: ${filePath}`);
            }
            
        } catch (error) {
            console.error(`SERVER_WATCHER_INTEGRATION: Error stopping file watcher:`, error);
        }
    }
    
    /**
     * Cleanup analysis files
     */
    private async cleanupAnalysisFiles(outputPath: string): Promise<void> {
        try {
            console.log(`SERVER_WATCHER_INTEGRATION: Cleaning up analysis files at: ${outputPath}`);
            
            if (fs.existsSync(outputPath)) {
                // Remove the directory and all its contents
                await fs.promises.rm(outputPath, { recursive: true, force: true });
                console.log(`SERVER_WATCHER_INTEGRATION: Successfully removed analysis directory: ${outputPath}`);
            } else {
                console.log(`SERVER_WATCHER_INTEGRATION: Analysis directory does not exist: ${outputPath}`);
            }
            
        } catch (error) {
            console.error(`SERVER_WATCHER_INTEGRATION: Error cleaning up analysis files:`, error);
        }
    }
    
    /**
     * Manual cleanup trigger (for when user closes analysis from UI)
     */
    public async triggerManualCleanup(sessionId: string): Promise<boolean> {
        try {
            console.log(`SERVER_WATCHER_INTEGRATION: Manual cleanup triggered for session ${sessionId}`);
            
            const sessionRegistry = AnalysisSessionRegistry.getInstance();
            const session = sessionRegistry.getSession(sessionId);
            
            if (!session) {
                console.log(`SERVER_WATCHER_INTEGRATION: Session ${sessionId} not found for manual cleanup`);
                return false;
            }
            
            // 1. Stop related server if it exists
            if (session.port) {
                await this.stopServerByPort(session.port);
            }
            
            // 2. Stop file watcher
            await this.stopFileWatcherForSession(sessionId, session.filePath);
            
            // 3. Cleanup analysis files  
            await this.cleanupAnalysisFiles(session.outputPath);
            
            // 4. Close the session
            const closed = sessionRegistry.closeSession(sessionId);
            
            console.log(`SERVER_WATCHER_INTEGRATION: Manual cleanup completed for session ${sessionId}: ${closed}`);
            return closed;
            
        } catch (error) {
            console.error(`SERVER_WATCHER_INTEGRATION: Error in manual cleanup:`, error);
            return false;
        }
    }
    
    /**
     * Stop server by port
     */
    private async stopServerByPort(port: number): Promise<void> {
        try {
            console.log(`SERVER_WATCHER_INTEGRATION: Stopping server on port ${port}`);
            
            const serverRegistry = getActiveServerRegistry();
            
            // Find server by port
            const servers = serverRegistry.getAllServers();
            const targetServer = servers.find(server => server.port === port);
            
            if (targetServer) {
                console.log(`SERVER_WATCHER_INTEGRATION: Found server ${targetServer.id} on port ${port}`);
                
                // Stop the server using ServerControl
                const stopped = await ServerControl.stopServer(targetServer.id);
                
                if (stopped) {
                    console.log(`SERVER_WATCHER_INTEGRATION: Successfully stopped server ${targetServer.id}`);
                } else {
                    console.warn(`SERVER_WATCHER_INTEGRATION: Failed to stop server ${targetServer.id}`);
                }
            } else {
                console.log(`SERVER_WATCHER_INTEGRATION: No server found on port ${port}`);
            }
            
        } catch (error) {
            console.error(`SERVER_WATCHER_INTEGRATION: Error stopping server by port:`, error);
        }
    }
    
    /**
     * Initialize the service (to be called from extension activation)
     */
    public static initialize(): void {
        ServerWatcherIntegration.getInstance();
        console.log('SERVER_WATCHER_INTEGRATION: Service initialized');
    }
}
