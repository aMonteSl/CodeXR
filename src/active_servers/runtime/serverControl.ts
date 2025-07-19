import * as vscode from 'vscode';
import { ActiveServer } from '../model/activeServerModel';
import { getActiveServerRegistry } from '../registry/activeServerRegistry';
import { getPanelManager } from '../services/panelManager';
import { fileToServerMap } from '../../utils/fileToServerMap';
import { sseManager } from '../../servers/runtime/sse/SSEManager';

/**
 * Server Control
 * Runtime operations for managing active servers
 */
export class ServerControl {
    
    /**
     * Stop an active server
     */
    public static async stopServer(serverId: string): Promise<boolean> {
        console.log(`ACTIVE_SERVERS: Attempting to stop server ${serverId}`);
        
        const registry = getActiveServerRegistry();
        const server = registry.getServer(serverId);
        
        if (!server) {
            console.error(`ACTIVE_SERVERS: Server ${serverId} not found in registry`);
            vscode.window.showErrorMessage(`Server not found: ${serverId}`);
            return false;
        }

        try {
            // Close associated lateral panel if it exists
            const panelManager = getPanelManager();
            if (server.launchMode === 'lateralPanel' && panelManager.hasPanel(serverId)) {
                console.log(`ACTIVE_SERVER_PANEL: Closing lateral panel for server ${serverId}`);
                panelManager.removePanel(serverId);
            }

            // Check if this server is associated with an analysis file and clean up
            console.log(`ACTIVE_SERVERS: Checking for file-to-server mapping for server on port ${server.port}`);
            const fileUri = fileToServerMap.findFileByPort(server.port);
            if (fileUri) {
                console.log(`ACTIVE_SERVERS: Found associated analysis file: ${fileUri}`);
                
                // Clean up SSE clients for this file
                console.log(`ACTIVE_SERVERS: Cleaning up SSE clients for ${fileUri}`);
                sseManager.removeAllClients(fileUri);
                
                // Remove the file-to-server mapping
                console.log(`ACTIVE_SERVERS: Removing file-to-server mapping for ${fileUri}`);
                fileToServerMap.unregisterMapping(fileUri);
            }

            // Update status to indicate stopping
            registry.updateServerStatus(serverId, 'stopped');

            // Stop the actual server instance if available
            if (server.serverInstance && typeof server.serverInstance.stop === 'function') {
                console.log(`ACTIVE_SERVERS: Stopping server instance for ${serverId}`);
                await server.serverInstance.stop();
            }

            // Remove from registry
            registry.unregisterServer(serverId);

            console.log(`ACTIVE_SERVERS: Successfully stopped server ${serverId} (${server.url})`);
            vscode.window.showInformationMessage(`Server stopped: ${server.url}`);
            
            return true;

        } catch (error) {
            console.error(`ACTIVE_SERVERS: Error stopping server ${serverId}:`, error);
            
            // Update status to error
            registry.updateServerStatus(serverId, 'error');
            
            vscode.window.showErrorMessage(
                `Failed to stop server ${server.url}: ${error instanceof Error ? error.message : String(error)}`
            );
            
            return false;
        }
    }

    /**
     * Stop all active servers
     */
    public static async stopAllServers(): Promise<number> {
        console.log('ACTIVE_SERVERS: Stopping all active servers');
        
        const registry = getActiveServerRegistry();
        const runningServers = registry.getServersByStatus('running');
        
        if (runningServers.length === 0) {
            console.log('ACTIVE_SERVERS: No running servers to stop');
            vscode.window.showInformationMessage('No active servers to stop');
            return 0;
        }

        // First, close all lateral panels for servers that have them
        const panelManager = getPanelManager();
        const lateralPanelServers = runningServers.filter(server => server.launchMode === 'lateralPanel');
        
        if (lateralPanelServers.length > 0) {
            console.log(`ACTIVE_SERVER_PANEL: Closing ${lateralPanelServers.length} lateral panels before stopping servers`);
            const serverIdsWithPanels = lateralPanelServers.map(server => server.id);
            const closedPanelCount = panelManager.removePanelsForServers(serverIdsWithPanels);
            console.log(`ACTIVE_SERVER_PANEL: Closed ${closedPanelCount}/${lateralPanelServers.length} lateral panels`);
        }

        let stoppedCount = 0;
        const stopPromises = runningServers.map(async (server) => {
            const success = await this.stopServer(server.id);
            if (success) {
                stoppedCount++;
            }
            return success;
        });

        await Promise.all(stopPromises);

        console.log(`ACTIVE_SERVERS: Stopped ${stoppedCount}/${runningServers.length} servers`);
        
        if (stoppedCount === runningServers.length) {
            vscode.window.showInformationMessage(`All ${stoppedCount} servers stopped successfully`);
        } else {
            vscode.window.showWarningMessage(
                `Stopped ${stoppedCount}/${runningServers.length} servers. Some servers may require manual intervention.`
            );
        }

        return stoppedCount;
    }

    /**
     * Get server status information
     */
    public static getServerStatus(serverId: string): {
        server: ActiveServer;
        isRunning: boolean;
        uptime: number;
        details: string;
    } | null {
        const registry = getActiveServerRegistry();
        const server = registry.getServer(serverId);
        
        if (!server) {
            return null;
        }

        const uptime = Date.now() - server.timestamp;
        const isRunning = server.status === 'running';
        
        let details = `Status: ${server.status}\\n`;
        details += `URL: ${server.url}\\n`;
        details += `Mode: ${server.certMode}/${server.launchMode}\\n`;
        details += `Uptime: ${this.formatUptime(uptime)}\\n`;
        
        if (server.htmlFile) {
            details += `File: ${server.htmlFile}\\n`;
        }

        return {
            server,
            isRunning,
            uptime,
            details
        };
    }

    /**
     * Refresh server status by checking actual server instance
     */
    public static async refreshServerStatus(serverId: string): Promise<boolean> {
        console.log(`ACTIVE_SERVERS: Refreshing status for server ${serverId}`);
        
        const registry = getActiveServerRegistry();
        const server = registry.getServer(serverId);
        
        if (!server) {
            console.warn(`ACTIVE_SERVERS: Cannot refresh non-existent server ${serverId}`);
            return false;
        }

        try {
            let actualStatus: 'running' | 'stopped' | 'error' = 'running';

            // Check if server instance has a status check method
            if (server.serverInstance) {
                if (typeof server.serverInstance.getIsRunning === 'function') {
                    const isRunning = server.serverInstance.getIsRunning();
                    actualStatus = isRunning ? 'running' : 'stopped';
                } else if (typeof server.serverInstance.status !== 'undefined') {
                    actualStatus = server.serverInstance.status;
                }
            }

            // Update status if it has changed
            if (server.status !== actualStatus) {
                console.log(`ACTIVE_SERVERS: Status changed for ${serverId}: ${server.status} -> ${actualStatus}`);
                registry.updateServerStatus(serverId, actualStatus);
                
                // If server is stopped/error, consider removing from registry
                if (actualStatus !== 'running') {
                    console.log(`ACTIVE_SERVERS: Server ${serverId} is no longer running, removing from registry`);
                    registry.unregisterServer(serverId);
                }
            }

            return true;

        } catch (error) {
            console.error(`ACTIVE_SERVERS: Error refreshing server ${serverId} status:`, error);
            registry.updateServerStatus(serverId, 'error');
            return false;
        }
    }

    /**
     * Refresh all server statuses
     */
    public static async refreshAllServerStatuses(): Promise<void> {
        console.log('ACTIVE_SERVERS: Refreshing all server statuses');
        
        const registry = getActiveServerRegistry();
        const servers = registry.getAllServers();
        
        const refreshPromises = servers.map(server => this.refreshServerStatus(server.id));
        await Promise.all(refreshPromises);
        
        console.log('ACTIVE_SERVERS: Completed status refresh for all servers');
    }

    /**
     * Get comprehensive registry information
     */
    public static getRegistryInfo(): {
        servers: ActiveServer[];
        stats: any;
        summary: string;
    } {
        const registry = getActiveServerRegistry();
        const servers = registry.getAllServers();
        const stats = registry.getStats();
        
        let summary = `Total: ${stats.total} servers\\n`;
        summary += `Running: ${stats.running}\\n`;
        summary += `Stopped: ${stats.stopped}\\n`;
        summary += `Errors: ${stats.error}\\n`;
        
        if (stats.total > 0) {
            summary += `\\nLaunch modes:\\n`;
            Object.entries(stats.byMode).forEach(([mode, count]) => {
                summary += `  ${mode}: ${count}\\n`;
            });
            
            summary += `\\nCertificate modes:\\n`;
            Object.entries(stats.byCertMode).forEach(([mode, count]) => {
                summary += `  ${mode}: ${count}\\n`;
            });
        }

        return {
            servers,
            stats,
            summary
        };
    }

    /**
     * Cleanup inactive servers from registry
     */
    public static cleanupInactiveServers(): number {
        console.log('ACTIVE_SERVERS: Cleaning up inactive servers');
        
        const registry = getActiveServerRegistry();
        const removedCount = registry.cleanupInactiveServers();
        
        if (removedCount > 0) {
            vscode.window.showInformationMessage(`Cleaned up ${removedCount} inactive servers`);
        }
        
        return removedCount;
    }

    /**
     * Format uptime duration
     * @private
     */
    private static formatUptime(milliseconds: number): string {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
}
