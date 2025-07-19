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
exports.ServerActionHandlers = void 0;
const vscode = __importStar(require("vscode"));
const activeServerRegistry_1 = require("../../registry/activeServerRegistry");
const serverControl_1 = require("../../runtime/serverControl");
const previewRenderer_1 = require("../../../servers/runtime/previewRenderer");
/**
 * Server Action Handlers
 * Handle user interactions with active servers
 */
class ServerActionHandlers {
    /**
     * Show server actions quick pick
     */
    static async showServerActions(serverId) {
        console.log(`ACTIVE_SERVER: Showing actions for server ${serverId}`);
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const server = registry.getServer(serverId);
        if (!server) {
            console.error(`ACTIVE_SERVER: Server ${serverId} not found`);
            vscode.window.showErrorMessage(`Server not found: ${serverId}`);
            return;
        }
        const actions = this.getAvailableActions(server);
        const selectedAction = await vscode.window.showQuickPick(actions, {
            placeHolder: `Actions for ${server.url}`,
            title: `Server Actions - localhost:${server.port}`
        });
        if (selectedAction) {
            await this.executeAction(selectedAction.action, server);
        }
    }
    /**
     * Open server in browser
     */
    static async openInBrowser(serverId) {
        console.log(`ACTIVE_SERVER: Opening server ${serverId} in browser`);
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const server = registry.getServer(serverId);
        if (!server) {
            console.error(`ACTIVE_SERVER: Server ${serverId} not found`);
            vscode.window.showErrorMessage(`Server not found: ${serverId}`);
            return;
        }
        try {
            await previewRenderer_1.PreviewRenderer.openPreview(server.url, server.htmlFile || '', 'browser');
            console.log(`ACTIVE_SERVER: Opened ${server.url} in browser`);
            vscode.window.showInformationMessage(`Opened ${server.url} in browser`);
        }
        catch (error) {
            console.error(`ACTIVE_SERVER: Error opening ${server.url} in browser:`, error);
            vscode.window.showErrorMessage(`Failed to open in browser: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Open server in lateral panel
     */
    static async openInPanel(serverId) {
        console.log(`ACTIVE_SERVER: Opening server ${serverId} in lateral panel`);
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const server = registry.getServer(serverId);
        if (!server) {
            console.error(`ACTIVE_SERVER: Server ${serverId} not found`);
            vscode.window.showErrorMessage(`Server not found: ${serverId}`);
            return;
        }
        // Check for HTTPS + lateral panel conflict
        if (server.certMode !== 'http') {
            console.log(`ACTIVE_SERVER: HTTPS server ${serverId} cannot be opened in lateral panel - cert mode: ${server.certMode}`);
            const response = await vscode.window.showWarningMessage('HTTPS content cannot be displayed in VS Code panels due to security restrictions. The content will not load properly.', 'Open in Browser Instead', 'Cancel');
            if (response === 'Open in Browser Instead') {
                console.log(`ACTIVE_SERVER: Redirecting server ${serverId} to browser due to HTTPS incompatibility`);
                return this.openInBrowser(serverId);
            }
            else {
                console.log(`ACTIVE_SERVER: User cancelled opening HTTPS server ${serverId} in panel`);
                return; // User cancelled
            }
        }
        try {
            console.log(`ACTIVE_SERVER: Opening HTTP server ${serverId} (${server.url}) in lateral panel`);
            await previewRenderer_1.PreviewRenderer.openPreview(server.url, server.htmlFile || '', 'lateralPanel', serverId);
            console.log(`ACTIVE_SERVER: Successfully opened ${server.url} in lateral panel`);
            vscode.window.showInformationMessage(`Opened ${server.url} in VS Code panel`);
        }
        catch (error) {
            console.error(`ACTIVE_SERVER: Error opening ${server.url} in panel:`, error);
            vscode.window.showErrorMessage(`Failed to open in panel: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Copy server URL to clipboard
     */
    static async copyUrl(serverId) {
        console.log(`ACTIVE_SERVER: Copying URL for server ${serverId}`);
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const server = registry.getServer(serverId);
        if (!server) {
            console.error(`ACTIVE_SERVER: Server ${serverId} not found`);
            vscode.window.showErrorMessage(`Server not found: ${serverId}`);
            return;
        }
        try {
            await vscode.env.clipboard.writeText(server.url);
            console.log(`ACTIVE_SERVER: Copied ${server.url} to clipboard`);
            vscode.window.showInformationMessage(`Copied ${server.url} to clipboard`);
        }
        catch (error) {
            console.error(`ACTIVE_SERVER: Error copying URL to clipboard:`, error);
            vscode.window.showErrorMessage('Failed to copy URL to clipboard');
        }
    }
    /**
     * Stop server
     */
    static async stopServer(serverId) {
        console.log(`ACTIVE_SERVER: Stopping server ${serverId}`);
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const server = registry.getServer(serverId);
        if (!server) {
            console.error(`ACTIVE_SERVER: Server ${serverId} not found`);
            vscode.window.showErrorMessage(`Server not found: ${serverId}`);
            return;
        }
        const response = await vscode.window.showWarningMessage(`Stop server ${server.url}?`, 'Stop', 'Cancel');
        if (response === 'Stop') {
            try {
                console.log(`ACTIVE_SERVER: Stopping server ${serverId} (${server.url})`);
                const success = await serverControl_1.ServerControl.stopServer(serverId);
                if (success) {
                    console.log(`ACTIVE_SERVER: Successfully stopped server ${serverId}`);
                    vscode.window.showInformationMessage(`Stopped server ${server.url}`);
                    // Refresh the tree view
                    vscode.commands.executeCommand('codeXR.activeServers.refreshServers');
                }
                else {
                    console.error(`ACTIVE_SERVER: Failed to stop server ${serverId}`);
                    vscode.window.showErrorMessage(`Failed to stop server ${server.url}`);
                }
            }
            catch (error) {
                console.error(`ACTIVE_SERVER: Error stopping server ${serverId}:`, error);
                vscode.window.showErrorMessage(`Error stopping server: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        else {
            console.log(`ACTIVE_SERVER: User cancelled stopping server ${serverId}`);
        }
    }
    /**
     * Show detailed server information
     */
    static async showServerDetails(serverId) {
        console.log(`ACTIVE_SERVER: Showing details for server ${serverId}`);
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const server = registry.getServer(serverId);
        if (!server) {
            console.error(`ACTIVE_SERVER: Server ${serverId} not found`);
            vscode.window.showErrorMessage(`Server not found: ${serverId}`);
            return;
        }
        const details = this.formatServerDetails(server);
        console.log(`ACTIVE_SERVER: Displaying detailed information for server ${serverId}`);
        await vscode.window.showInformationMessage(`Server Information - ${server.url}`, { modal: true, detail: details });
    }
    /**
     * Stop all servers
     */
    static async stopAllServers() {
        console.log('ACTIVE_SERVER: Stopping all servers');
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const allServers = registry.getAllServers();
        if (allServers.length === 0) {
            vscode.window.showInformationMessage('No servers are currently running');
            return;
        }
        const response = await vscode.window.showWarningMessage(`Stop all ${allServers.length} server(s)?`, 'Stop All', 'Cancel');
        if (response === 'Stop All') {
            try {
                console.log(`ACTIVE_SERVER: Stopping ${allServers.length} servers`);
                const success = await serverControl_1.ServerControl.stopAllServers();
                if (success) {
                    console.log('ACTIVE_SERVER: Successfully stopped all servers');
                    vscode.window.showInformationMessage(`Stopped all ${allServers.length} servers`);
                }
                else {
                    console.error('ACTIVE_SERVER: Failed to stop some servers');
                    vscode.window.showWarningMessage('Some servers may not have stopped properly');
                }
                // Refresh the tree view
                vscode.commands.executeCommand('codeXR.activeServers.refreshServers');
            }
            catch (error) {
                console.error('ACTIVE_SERVER: Error stopping all servers:', error);
                vscode.window.showErrorMessage(`Error stopping servers: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        else {
            console.log('ACTIVE_SERVER: User cancelled stopping all servers');
        }
    }
    /**
     * Refresh servers display
     */
    static async refreshServers() {
        console.log('ACTIVE_SERVER: Refreshing servers display');
        vscode.commands.executeCommand('codeXR.activeServers.refreshServers');
    }
    /**
     * Get available actions for a server based on its type
     * @private
     */
    static getAvailableActions(server) {
        const isHttp = server.certMode === 'http';
        const actions = [
            {
                label: '🌐 Open in Browser',
                description: 'Open server in external browser',
                action: 'openInBrowser'
            }
        ];
        // Add lateral panel option only for HTTP servers
        if (isHttp) {
            actions.push({
                label: '📱 Open in Panel',
                description: 'Open server in VS Code lateral panel',
                action: 'openInPanel'
            });
        }
        actions.push({
            label: '📋 Copy URL',
            description: 'Copy server URL to clipboard',
            action: 'copyUrl'
        }, {
            label: 'ℹ️ Server Info',
            description: 'Show detailed server information',
            action: 'showDetails'
        }, {
            label: '⏹️ Stop Server',
            description: 'Stop this server',
            action: 'stopServer'
        });
        return actions;
    }
    /**
     * Execute an action on a server
     * @private
     */
    static async executeAction(action, server) {
        console.log(`ACTIVE_SERVER: Executing action '${action}' on server ${server.id}`);
        switch (action) {
            case 'openInBrowser':
                await this.openInBrowser(server.id);
                break;
            case 'openInPanel':
                await this.openInPanel(server.id);
                break;
            case 'copyUrl':
                await this.copyUrl(server.id);
                break;
            case 'showDetails':
                await this.showServerDetails(server.id);
                break;
            case 'stopServer':
                await this.stopServer(server.id);
                break;
            default:
                console.error(`ACTIVE_SERVER: Unknown action: ${action}`);
                vscode.window.showErrorMessage(`Unknown action: ${action}`);
        }
    }
    /**
     * Format server details for display
     * @private
     */
    static formatServerDetails(server) {
        const uptimeMs = Date.now() - server.timestamp;
        const uptime = this.formatUptime(uptimeMs);
        let details = '';
        details += `URL: ${server.url}\\n`;
        details += `Port: ${server.port}\\n`;
        details += `Status: ${server.status}\\n`;
        details += `Security: ${server.certMode.toUpperCase()}\\n`;
        details += `Launch Mode: ${server.launchMode}\\n`;
        details += `Uptime: ${uptime}\\n`;
        if (server.htmlFile) {
            const fileName = server.htmlFile.split('/').pop() || server.htmlFile;
            details += `Serving File: ${fileName}\\n`;
        }
        if (server.metadata) {
            if (server.metadata.host) {
                details += `Host: ${server.metadata.host}\\n`;
            }
            if (server.metadata.staticRoot) {
                details += `Static Root: ${server.metadata.staticRoot}\\n`;
            }
            if (server.metadata.description) {
                details += `Description: ${server.metadata.description}\\n`;
            }
        }
        return details;
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
            return `${hours}h ${minutes % 60}m`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        else {
            return `${seconds}s`;
        }
    }
}
exports.ServerActionHandlers = ServerActionHandlers;
//# sourceMappingURL=handleServerActions.js.map