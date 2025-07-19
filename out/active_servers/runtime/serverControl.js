"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerControl = void 0;
const vscode = __importStar(require("vscode"));
const activeServerRegistry_1 = require("../registry/activeServerRegistry");
const panelManager_1 = require("../services/panelManager");
const fileToServerMap_1 = require("../../utils/fileToServerMap");
const SSEManager_1 = require("../../servers/runtime/sse/SSEManager");
/**
 * Server Control
 * Runtime operations for managing active servers
 */
class ServerControl {
    /**
     * Stop an active server
     */
    static async stopServer(serverId) {
        console.log(`ACTIVE_SERVERS: Attempting to stop server ${serverId}`);
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const server = registry.getServer(serverId);
        if (!server) {
            console.error(`ACTIVE_SERVERS: Server ${serverId} not found in registry`);
            vscode.window.showErrorMessage(`Server not found: ${serverId}`);
            return false;
        }
        try {
            // Close associated lateral panel if it exists
            const panelManager = (0, panelManager_1.getPanelManager)();
            if (server.launchMode === 'lateralPanel' && panelManager.hasPanel(serverId)) {
                console.log(`ACTIVE_SERVER_PANEL: Closing lateral panel for server ${serverId}`);
                panelManager.removePanel(serverId);
            }
            // Check if this server is associated with an analysis file and clean up
            console.log(`ACTIVE_SERVERS: Checking for file-to-server mapping for server on port ${server.port}`);
            const fileUri = fileToServerMap_1.fileToServerMap.findFileByPort(server.port);
            if (fileUri) {
                console.log(`ACTIVE_SERVERS: Found associated analysis file: ${fileUri}`);
                // Clean up SSE clients for this file
                console.log(`ACTIVE_SERVERS: Cleaning up SSE clients for ${fileUri}`);
                SSEManager_1.sseManager.removeAllClients(fileUri);
                // Remove the file-to-server mapping
                console.log(`ACTIVE_SERVERS: Removing file-to-server mapping for ${fileUri}`);
                fileToServerMap_1.fileToServerMap.unregisterMapping(fileUri);
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
        }
        catch (error) {
            console.error(`ACTIVE_SERVERS: Error stopping server ${serverId}:`, error);
            // Update status to error
            registry.updateServerStatus(serverId, 'error');
            vscode.window.showErrorMessage(`Failed to stop server ${server.url}: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }
    /**
     * Stop all active servers
     */
    static async stopAllServers() {
        console.log('ACTIVE_SERVERS: Stopping all active servers');
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const runningServers = registry.getServersByStatus('running');
        if (runningServers.length === 0) {
            console.log('ACTIVE_SERVERS: No running servers to stop');
            vscode.window.showInformationMessage('No active servers to stop');
            return 0;
        }
        // First, close all lateral panels for servers that have them
        const panelManager = (0, panelManager_1.getPanelManager)();
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
        }
        else {
            vscode.window.showWarningMessage(`Stopped ${stoppedCount}/${runningServers.length} servers. Some servers may require manual intervention.`);
        }
        return stoppedCount;
    }
    /**
     * Get server status information
     */
    static getServerStatus(serverId) {
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
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
    static async refreshServerStatus(serverId) {
        console.log(`ACTIVE_SERVERS: Refreshing status for server ${serverId}`);
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const server = registry.getServer(serverId);
        if (!server) {
            console.warn(`ACTIVE_SERVERS: Cannot refresh non-existent server ${serverId}`);
            return false;
        }
        try {
            let actualStatus = 'running';
            // Check if server instance has a status check method
            if (server.serverInstance) {
                if (typeof server.serverInstance.getIsRunning === 'function') {
                    const isRunning = server.serverInstance.getIsRunning();
                    actualStatus = isRunning ? 'running' : 'stopped';
                }
                else if (typeof server.serverInstance.status !== 'undefined') {
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
        }
        catch (error) {
            console.error(`ACTIVE_SERVERS: Error refreshing server ${serverId} status:`, error);
            registry.updateServerStatus(serverId, 'error');
            return false;
        }
    }
    /**
     * Refresh all server statuses
     */
    static async refreshAllServerStatuses() {
        console.log('ACTIVE_SERVERS: Refreshing all server statuses');
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const servers = registry.getAllServers();
        const refreshPromises = servers.map(server => this.refreshServerStatus(server.id));
        await Promise.all(refreshPromises);
        console.log('ACTIVE_SERVERS: Completed status refresh for all servers');
    }
    /**
     * Get comprehensive registry information
     */
    static getRegistryInfo() {
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
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
    static cleanupInactiveServers() {
        console.log('ACTIVE_SERVERS: Cleaning up inactive servers');
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
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
    static formatUptime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        else {
            return `${seconds}s`;
        }
    }
}
exports.ServerControl = ServerControl;
//# sourceMappingURL=serverControl.js.map