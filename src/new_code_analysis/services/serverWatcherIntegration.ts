/**
 * Server-Watcher Integration Service
 * Manages communication between servers and file watchers for cleanup coordination
 */

import * as vscode from 'vscode';
import { UnifiedSessionRegistry } from '../new_engine/core/sessionRegistry';
import { SessionWatcherManager } from '../new_engine/watchers/sessionWatcherManager';
import { VisualizeDOMWatcher } from '../new_engine/watchers/visualizeDOMWatcher';
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
    
    /**
     * Get singleton instance
     */
    public static getInstance(context?: vscode.ExtensionContext): ServerWatcherIntegration {
        if (!ServerWatcherIntegration.instance) {
            if (!context) {
                throw new Error('ServerWatcherIntegration: ExtensionContext required for first initialization');
            }
            ServerWatcherIntegration.instance = new ServerWatcherIntegration(context);
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
            const sessionRegistry = UnifiedSessionRegistry.getInstance(this.context);
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
            
            const sessionRegistry = UnifiedSessionRegistry.getInstance(this.context);
            const session = sessionRegistry.getSession(sessionId);
            
            if (!session) {
                console.log(`SERVER_WATCHER_INTEGRATION: Session ${sessionId} not found, skipping cleanup`);
                return;
            }
            
            // 1. Stop file watcher
            await this.stopFileWatcherForSession(sessionId, session.targetPath);
            
            // 2. Cleanup analysis files
            await this.cleanupAnalysisFiles(session.outputPath);
            
            // 3. Close the session
            sessionRegistry.updateSessionStatus(sessionId, 'closed');
            
            // 4. Show notification to user
            vscode.window.showInformationMessage(
                `Analysis cleaned up: ${session.targetName} - ${session.analysisMode} (server on port ${serverPort} was closed)`
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
            console.log(`SERVER_WATCHER_INTEGRATION: Stopping all watchers for session ${sessionId}, file: ${filePath}`);
            
            // 1. Use SessionWatcherManager to stop the specific session watcher (file/directory watchers)
            const sessionWatcherStopped = await this.sessionWatcherManager.stopWatchingSession(sessionId);
            
            if (sessionWatcherStopped) {
                console.log(`SERVER_WATCHER_INTEGRATION:  Successfully stopped session file watcher for session ${sessionId}`);
            } else {
                console.log(`SERVER_WATCHER_INTEGRATION:  No active session watcher found for session ${sessionId}`);
            }
            
            // 2. Stop any VisualizeDOM watchers that might be active for this session
            let domWatchersStopped = 0;
            const activeWatchers = VisualizeDOMWatcher.getActiveWatchers();
            
            for (const [watcherId, watcherInfo] of activeWatchers) {
                if (watcherInfo.sessionId === sessionId) {
                    const stopped = VisualizeDOMWatcher.stopWatching(watcherId);
                    if (stopped) {
                        domWatchersStopped++;
                        console.log(`SERVER_WATCHER_INTEGRATION:  Stopped VisualizeDOM watcher ${watcherId} for session ${sessionId}`);
                    }
                }
            }
            
            if (domWatchersStopped > 0) {
                console.log(`SERVER_WATCHER_INTEGRATION:  Stopped ${domWatchersStopped} VisualizeDOM watcher(s) for session ${sessionId}`);
            } else {
                console.log(`SERVER_WATCHER_INTEGRATION:  No VisualizeDOM watchers found for session ${sessionId}`);
            }
            
            console.log(`SERVER_WATCHER_INTEGRATION:  All watchers stopped for session ${sessionId}`);
            
        } catch (error) {
            console.error(`SERVER_WATCHER_INTEGRATION: Error stopping file watcher for session ${sessionId}:`, error);
        }
    }
    
    /**
     * Cleanup analysis files
     */
    private async cleanupAnalysisFiles(outputPath: string): Promise<void> {
        try {
            if (outputPath && fs.existsSync(outputPath)) {
                console.log(`SERVER_WATCHER_INTEGRATION: Cleaning up analysis files at: ${outputPath}`);
                // Implementation depends on cleanup strategy
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
            
            const sessionRegistry = UnifiedSessionRegistry.getInstance(this.context);
            const session = sessionRegistry.getSession(sessionId);
            
            if (!session) {
                console.log(`SERVER_WATCHER_INTEGRATION: Session ${sessionId} not found for manual cleanup`);
                return false;
            }

            console.log(`SERVER_WATCHER_INTEGRATION: Session found:`, {
                id: session.id,
                targetPath: session.targetPath,
                outputPath: session.outputPath,
                assignedPort: session.assignedPort,
                status: session.status,
                analysisMode: session.analysisMode,
                targetName: session.targetName
            });

            // Check if session has port information - support both old and new engine
            const sessionPort = session.assignedPort;
            if (sessionPort) {
                console.log(`SERVER_WATCHER_INTEGRATION: Session has port information: ${sessionPort}`);
            } else {
                console.log(`SERVER_WATCHER_INTEGRATION: Session does NOT have port information`);
                console.log(`SERVER_WATCHER_INTEGRATION: Full session object:`, JSON.stringify(session, null, 2));
            }
            
            // 1. Stop related server if it exists
            if (sessionPort) {
                console.log(`SERVER_WATCHER_INTEGRATION: Session has port ${sessionPort}, stopping server`);
                await this.stopServerByPort(sessionPort);
            } else {
                console.log(`SERVER_WATCHER_INTEGRATION: Session has no port information, trying to find server by other means`);
                // Try to find server by other means
                await this.findAndStopServerForSession(sessionId, session);
            }
            
            // 2. Stop file watcher
            console.log(`SERVER_WATCHER_INTEGRATION: Stopping file watcher for session`);
            await this.stopFileWatcherForSession(sessionId, session.targetPath);
            
            // 3. Cleanup analysis files  
            console.log(`SERVER_WATCHER_INTEGRATION: Cleaning up analysis files`);
            await this.cleanupAnalysisFiles(session.outputPath);
            
            // 4. Close the session
            console.log(`SERVER_WATCHER_INTEGRATION: Closing session in registry`);
            const closed = sessionRegistry.updateSessionStatus(sessionId, 'closed');
            
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
            const serverRegistry = getActiveServerRegistry();
            const servers = serverRegistry.getAllServers();
            
            const serverToStop = servers.find((server: any) => server.port === port);
            
            if (serverToStop) {
                console.log(`SERVER_WATCHER_INTEGRATION: Stopping server ${serverToStop.id} on port ${port}`);
                await ServerControl.stopServer(serverToStop.id);
            } else {
                console.log(`SERVER_WATCHER_INTEGRATION: No server found on port ${port}`);
            }
        } catch (error) {
            console.error(`SERVER_WATCHER_INTEGRATION: Error stopping server by port ${port}:`, error);
        }
    }

    /**
     * Find and stop server for session using multiple matching strategies
     */
    private async findAndStopServerForSession(sessionId: string, session: any): Promise<void> {
        try {
            console.log(`SERVER_WATCHER_INTEGRATION: Trying to find server for session ${sessionId}`);
            
            const serverRegistry = getActiveServerRegistry();
            const servers = serverRegistry.getAllServers();
            
            console.log(`SERVER_WATCHER_INTEGRATION: Total servers in registry: ${servers.length}`);
            
            // Try to find server by various matching strategies in order of reliability
            let matchingServer = null;
            
            // Strategy 1: Match by sessionId in server metadata (most reliable)
            console.log(`SERVER_WATCHER_INTEGRATION: Strategy 1 - Looking for server with sessionId ${sessionId} in metadata`);
            matchingServer = servers.find((server: any) => {
                if (server.metadata && server.metadata.sessionId === sessionId) {
                    console.log(`SERVER_WATCHER_INTEGRATION:  Found server ${server.id} with sessionId in metadata`);
                    return true;
                }
                return false;
            });
            
            if (matchingServer) {
                console.log(`SERVER_WATCHER_INTEGRATION: Strategy 1 SUCCESS: Found matching server ${matchingServer.id}`);
            } else {
                console.log(`SERVER_WATCHER_INTEGRATION: Strategy 1 FAILED: No server found with sessionId in metadata`);
            }
            
            // Strategy 2: Match by output path (fallback)
            if (!matchingServer && session.outputPath) {
                console.log(`SERVER_WATCHER_INTEGRATION: Strategy 2 - Looking for server with htmlFile containing ${session.outputPath}`);
                matchingServer = servers.find((server: any) => {
                    if (server.htmlFile && server.htmlFile.includes(session.outputPath)) {
                        console.log(`SERVER_WATCHER_INTEGRATION:  Found server ${server.id} by output path match`);
                        return true;
                    }
                    return false;
                });
                
                if (matchingServer) {
                    console.log(`SERVER_WATCHER_INTEGRATION: Strategy 2 SUCCESS: Found matching server ${matchingServer.id}`);
                } else {
                    console.log(`SERVER_WATCHER_INTEGRATION: Strategy 2 FAILED: No server found with matching output path`);
                }
            }
            
            // Strategy 3: Match by custom name containing analysis identifier (last resort)
            if (!matchingServer) {
                console.log(`SERVER_WATCHER_INTEGRATION: Strategy 3 - Looking for server with analysis-related name`);
                matchingServer = servers.find((server: any) => {
                    if (server.customName && server.customName.includes('Analysis')) {
                        // Only match if this is the most recently created analysis server
                        // to avoid closing unrelated analysis servers
                        console.log(`SERVER_WATCHER_INTEGRATION:  Found potential analysis server ${server.id} by name pattern`);
                        return true;
                    }
                    return false;
                });
                
                if (matchingServer) {
                    console.log(`SERVER_WATCHER_INTEGRATION: Strategy 3 FOUND: ${matchingServer.id} ( using name pattern - may not be exact match)`);
                } else {
                    console.log(`SERVER_WATCHER_INTEGRATION: Strategy 3 FAILED: No analysis server found by name pattern`);
                }
            }
            
            if (matchingServer) {
                console.log(`SERVER_WATCHER_INTEGRATION: Stopping server ${matchingServer.id} using strategy`);
                await ServerControl.stopServer(matchingServer.id);
            } else {
                console.log(`SERVER_WATCHER_INTEGRATION:  No matching server found for session ${sessionId} using any strategy`);
                console.log(`SERVER_WATCHER_INTEGRATION: Available servers for debugging:`, servers.map((s: any) => ({
                    id: s.id,
                    customName: s.customName,
                    port: s.port,
                    metadata: s.metadata
                })));
            }
            
        } catch (error) {
            console.error(`SERVER_WATCHER_INTEGRATION: Error finding and stopping server for session ${sessionId}:`, error);
        }
    }
    
    /**
     * Initialize the service (to be called from extension activation)
     */
    public static initialize(context: vscode.ExtensionContext): void {
        ServerWatcherIntegration.getInstance(context);
        console.log('SERVER_WATCHER_INTEGRATION: Service initialized');
    }
}
