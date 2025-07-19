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
exports.ServerIcons = exports.ServerItemFactory = exports.ActiveServerTreeItem = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Tree item for active servers display
 */
class ActiveServerTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    itemType;
    server;
    command;
    iconPath;
    tooltip;
    description;
    contextValue;
    constructor(label, collapsibleState, itemType, server, command, iconPath, tooltip, description, contextValue) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.itemType = itemType;
        this.server = server;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip;
        this.description = description;
        this.contextValue = contextValue;
        this.tooltip = tooltip || this.label;
        this.iconPath = iconPath;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.ActiveServerTreeItem = ActiveServerTreeItem;
/**
 * Server item factory for creating tree items
 */
class ServerItemFactory {
    /**
     * Create active servers group item
     */
    static createActiveServersGroup(serverCount) {
        const label = serverCount > 0 ? `Active Servers (${serverCount})` : 'Active Servers';
        const collapsibleState = serverCount > 0
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.Collapsed;
        return new ActiveServerTreeItem(label, collapsibleState, 'activeServersGroup', undefined, undefined, new vscode.ThemeIcon('server-environment'), `${serverCount} active servers`, undefined, 'activeServersGroup');
    }
    /**
     * Create no servers item
     */
    static createNoServersItem() {
        return new ActiveServerTreeItem('No active servers', vscode.TreeItemCollapsibleState.None, 'noServers', undefined, undefined, new vscode.ThemeIcon('info'), 'No servers are currently running', 'Start a server to see it listed here', 'noServers');
    }
    /**
 * Create server item
 */
    static createServerItem(server) {
        const label = ServerItemFactory.getServerLabel(server);
        const description = this.getServerDescription(server);
        const icon = this.getServerIcon(server);
        const tooltip = this.getServerTooltip(server);
        const contextValue = this.getServerContextValue(server);
        return new ActiveServerTreeItem(label, vscode.TreeItemCollapsibleState.None, 'activeServer', server, {
            command: 'codeXR.activeServers.showActions',
            title: 'Show Server Actions',
            arguments: [server.id]
        }, icon, description, tooltip, contextValue);
    }
    /**
     * Get server label based on custom name or default format
     * @private
     */
    static getServerLabel(server) {
        // Check if customName is defined and not empty
        if (server.customName && server.customName.trim().length > 0) {
            return server.customName.trim();
        }
        // Fallback to localhost:<PORT> format when no custom name is provided
        return `localhost:${server.port}`;
    }
    /**
     * Get server description based on launch mode
     * @private
     */
    static getServerDescription(server) {
        const mode = server.launchMode === 'browser' ? 'Browser' : 'Panel';
        const status = server.status === 'running' ? '' : ` (${server.status})`;
        return `${mode}${status}`;
    }
    /**
     * Get server icon based on certificate mode and status
     * @private
     */
    static getServerIcon(server) {
        // Base icon selection based on cert mode
        let iconName;
        switch (server.certMode) {
            case 'http':
                iconName = 'globe'; // HTTP - less secure
                break;
            case 'https-default':
                iconName = 'shield'; // HTTPS with default certs - secure
                break;
            case 'https-custom':
                iconName = 'shield-check'; // HTTPS with custom certs - most secure
                break;
            default:
                iconName = 'server';
        }
        // Color based on status
        let color;
        switch (server.status) {
            case 'running':
                color = 'charts.green'; // Green for running
                break;
            case 'stopped':
                color = 'charts.gray'; // Gray for stopped
                break;
            case 'error':
                color = 'charts.red'; // Red for error
                break;
        }
        return new vscode.ThemeIcon(iconName, color ? new vscode.ThemeColor(color) : undefined);
    }
    /**
     * Get detailed server tooltip
     * @private
     */
    static getServerTooltip(server) {
        const uptime = this.formatUptime(Date.now() - server.timestamp);
        let tooltip = `${server.url}\\n`;
        tooltip += `Status: ${server.status}\\n`;
        tooltip += `Mode: ${server.certMode}/${server.launchMode}\\n`;
        tooltip += `Uptime: ${uptime}\\n`;
        if (server.htmlFile) {
            const fileName = server.htmlFile.split('/').pop() || server.htmlFile;
            tooltip += `File: ${fileName}\\n`;
        }
        tooltip += `\\nClick to show actions`;
        return tooltip;
    }
    /**
     * Get server context value for context menu differentiation
     * @private
     */
    static getServerContextValue(server) {
        console.log(`ACTIVE_SERVER: Determining context value for server ${server.id} with cert mode: ${server.certMode}`);
        // Differentiate between HTTP and HTTPS servers for context menu
        const isHttp = server.certMode === 'http';
        const contextValue = isHttp ? 'activeServerHttp' : 'activeServerHttps';
        console.log(`ACTIVE_SERVER: Server ${server.id} assigned context value: ${contextValue}`);
        return contextValue;
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
exports.ServerItemFactory = ServerItemFactory;
/**
 * Server icons utility
 */
class ServerIcons {
    static HTTP = new vscode.ThemeIcon('globe');
    static HTTPS_DEFAULT = new vscode.ThemeIcon('shield');
    static HTTPS_CUSTOM = new vscode.ThemeIcon('shield-check');
    static SERVER_RUNNING = new vscode.ThemeIcon('server', new vscode.ThemeColor('charts.green'));
    static SERVER_STOPPED = new vscode.ThemeIcon('server', new vscode.ThemeColor('charts.gray'));
    static SERVER_ERROR = new vscode.ThemeIcon('server', new vscode.ThemeColor('charts.red'));
    static ACTIVE_SERVERS_GROUP = new vscode.ThemeIcon('server-environment');
    static NO_SERVERS = new vscode.ThemeIcon('info');
    static BROWSER = new vscode.ThemeIcon('browser');
    static PANEL = new vscode.ThemeIcon('layout-panel');
}
exports.ServerIcons = ServerIcons;
//# sourceMappingURL=serverItems.js.map