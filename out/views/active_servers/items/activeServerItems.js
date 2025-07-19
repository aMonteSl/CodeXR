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
exports.ActiveServerItemFactory = exports.ActiveServerTreeItem = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Active Server tree items for the Active Servers section
 */
class ActiveServerTreeItem extends vscode.TreeItem {
    activeServerItemType;
    activeServer;
    constructor(label, collapsibleState, activeServerItemType, command, iconPath, tooltip, description, contextValue, activeServer) {
        super(label, collapsibleState);
        this.activeServerItemType = activeServerItemType;
        this.activeServer = activeServer;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip || label;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.ActiveServerTreeItem = ActiveServerTreeItem;
/**
 * Factory for creating active server-related tree items
 */
class ActiveServerItemFactory {
    /**
     * Create "No active servers" message item
     */
    static createNoServersItem() {
        console.log('ACTIVE_SERVERS: Creating "No active servers" message item');
        return new ActiveServerTreeItem('No active servers', vscode.TreeItemCollapsibleState.None, 'no-servers', undefined, new vscode.ThemeIcon('info'), 'No servers are currently running');
    }
    /**
     * Create "Stop All Servers" control option
     */
    static createStopAllServersItem(runningCount) {
        console.log(`ACTIVE_SERVERS: Creating "Stop All Servers" option for ${runningCount} running servers`);
        return new ActiveServerTreeItem('Stop All Servers', vscode.TreeItemCollapsibleState.None, 'control-option', {
            command: 'codeXR.activeServers.stopAllServers',
            title: 'Stop All Servers'
        }, new vscode.ThemeIcon('stop-circle'), `Stop all ${runningCount} running servers`, undefined, 'stopAllServers');
    }
    /**
     * Create individual active server item
     */
    static createServerItem(server) {
        // Use custom name if provided, otherwise fallback to localhost:port
        const label = server.customName?.trim() || `localhost:${server.port}`;
        console.log(`ACTIVE_SERVERS: Creating server item with label: "${label}" (customName: "${server.customName}", port: ${server.port})`);
        const description = ActiveServerItemFactory.getServerDescription(server);
        const icon = ActiveServerItemFactory.getServerIcon(server);
        const tooltip = ActiveServerItemFactory.getServerTooltip(server);
        console.log(`ACTIVE_SERVERS: Creating server item: ${label} (${description})`);
        // Create command to show server actions on left-click
        const command = {
            command: 'codeXR.activeServers.showActions',
            title: 'Show Server Actions',
            arguments: [server.id]
        };
        // Set context value based on certificate mode for conditional menu items
        const contextValue = server.certMode === 'http' ? 'activeServerHttp' : 'activeServerHttps';
        return new ActiveServerTreeItem(label, vscode.TreeItemCollapsibleState.None, 'server-item', command, icon, tooltip, description, contextValue, server);
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
            case 'https-default':
            case 'https-custom':
                iconName = 'shield';
                break;
            case 'http':
            default:
                iconName = 'globe';
                break;
        }
        // Add status indicator if not running
        if (server.status !== 'running') {
            iconName = 'error';
        }
        return new vscode.ThemeIcon(iconName);
    }
    /**
     * Get server tooltip with detailed information
     * @private
     */
    static getServerTooltip(server) {
        const protocol = server.certMode === 'http' ? 'HTTP' : 'HTTPS';
        const mode = server.launchMode === 'browser' ? 'Browser' : 'Panel';
        const status = server.status.charAt(0).toUpperCase() + server.status.slice(1);
        let tooltip = `${protocol} Server (${status})
URL: ${server.url}
Mode: ${mode}
Port: ${server.port}`;
        if (server.htmlFile) {
            const fileName = require('path').basename(server.htmlFile);
            tooltip += `\nFile: ${fileName}`;
        }
        if (server.metadata) {
            const metadata = server.metadata; // Type assertion for dynamic metadata
            if (metadata.serverType) {
                tooltip += `\nType: ${metadata.serverType}`;
            }
            if (metadata.portChanged) {
                tooltip += `\nOriginal port was in use`;
            }
            if (metadata.httpsOverridden) {
                tooltip += `\nHTTPS overridden for panel mode`;
            }
        }
        tooltip += `\n\nClick to show details`;
        return tooltip;
    }
}
exports.ActiveServerItemFactory = ActiveServerItemFactory;
//# sourceMappingURL=activeServerItems.js.map