import * as vscode from 'vscode';
import { ActiveServer } from '../../../active_servers/model/activeServerModel';

/**
 * Active Server tree items for the Active Servers section
 */
export class ActiveServerTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly activeServerItemType: 'server-item' | 'control-option' | 'no-servers',
        command?: vscode.Command,
        iconPath?: vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri },
        tooltip?: string,
        description?: string,
        contextValue?: string,
        public readonly activeServer?: ActiveServer
    ) {
        super(label, collapsibleState);
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip || label;
        this.description = description;
        this.contextValue = contextValue;
    }
}

/**
 * Factory for creating active server-related tree items
 */
export class ActiveServerItemFactory {
    /**
     * Create "No active servers" message item
     */
    static createNoServersItem(): ActiveServerTreeItem {
        console.log('ACTIVE_SERVERS: Creating "No active servers" message item');
        
        return new ActiveServerTreeItem(
            'No active servers',
            vscode.TreeItemCollapsibleState.None,
            'no-servers',
            undefined,
            new vscode.ThemeIcon('info'),
            'No servers are currently running'
        );
    }
    
    /**
     * Create "Stop All Servers" control option
     */
    static createStopAllServersItem(runningCount: number): ActiveServerTreeItem {
        console.log(`ACTIVE_SERVERS: Creating "Stop All Servers" option for ${runningCount} running servers`);
        
        return new ActiveServerTreeItem(
            'Stop All Servers',
            vscode.TreeItemCollapsibleState.None,
            'control-option',
            {
                command: 'codeXR.activeServers.stopAllServers',
                title: 'Stop All Servers'
            },
            new vscode.ThemeIcon('stop-circle'),
            `Stop all ${runningCount} running servers`,
            undefined,
            'stopAllServers'
        );
    }
    
    /**
     * Create individual active server item
     */
    static createServerItem(server: ActiveServer): ActiveServerTreeItem {
        // Use custom name if provided, otherwise fallback to localhost:port
        const label = server.customName?.trim() || `localhost:${server.port}`;
        console.log(`ACTIVE_SERVERS: Creating server item with label: "${label}" (customName: "${server.customName}", port: ${server.port})`);
        
        const description = ActiveServerItemFactory.getServerDescription(server);
        const icon = ActiveServerItemFactory.getServerIcon(server);
        const tooltip = ActiveServerItemFactory.getServerTooltip(server);
        
        console.log(`ACTIVE_SERVERS: Creating server item: ${label} (${description})`);
        
        // Create command to show server actions on left-click
        const command: vscode.Command = {
            command: 'codeXR.activeServers.showActions',
            title: 'Show Server Actions',
            arguments: [server.id]
        };
        
        // Set context value based on certificate mode for conditional menu items
        const contextValue = server.certMode === 'http' ? 'activeServerHttp' : 'activeServerHttps';
        
        return new ActiveServerTreeItem(
            label,
            vscode.TreeItemCollapsibleState.None,
            'server-item',
            command,
            icon,
            tooltip,
            description,
            contextValue,
            server
        );
    }
    
    /**
     * Get server description based on launch mode
     * @private
     */
    private static getServerDescription(server: ActiveServer): string {
        const mode = server.launchMode === 'browser' ? 'Browser' : 'Panel';
        const status = server.status === 'running' ? '' : ` (${server.status})`;
        return `${mode}${status}`;
    }

    /**
     * Get server icon based on certificate mode and status
     * @private
     */
    private static getServerIcon(server: ActiveServer): vscode.ThemeIcon {
        // Base icon selection based on cert mode
        let iconName: string;
        
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
    private static getServerTooltip(server: ActiveServer): string {
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
            const metadata = server.metadata as any; // Type assertion for dynamic metadata
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
