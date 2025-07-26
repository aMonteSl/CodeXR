import * as vscode from 'vscode';
import * as path from 'path';
import { ActiveServer, CertMode, LaunchMode } from '../../model/activeServerModel';

/**
 * Tree item types for active servers
 */
type ActiveServerTreeItemType = 'activeServersGroup' | 'activeServer' | 'noServers';

/**
 * Tree item for active servers display
 */
export class ActiveServerTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: ActiveServerTreeItemType,
        public readonly server?: ActiveServer,
        public readonly command?: vscode.Command,
        public readonly iconPath?: vscode.ThemeIcon,
        public readonly tooltip?: string,
        public readonly description?: string,
        public readonly contextValue?: string
    ) {
        super(label, collapsibleState);
        this.tooltip = tooltip || this.label;
        this.iconPath = iconPath;
        this.description = description;
        this.contextValue = contextValue;
    }
}

/**
 * Server item factory for creating tree items
 */
export class ServerItemFactory {
    
    /**
     * Create active servers group item
     */
    public static createActiveServersGroup(serverCount: number): ActiveServerTreeItem {
        const label = serverCount > 0 ? `Active Servers (${serverCount})` : 'Active Servers';
        const collapsibleState = serverCount > 0 
            ? vscode.TreeItemCollapsibleState.Expanded 
            : vscode.TreeItemCollapsibleState.Collapsed;
            
        return new ActiveServerTreeItem(
            label,
            collapsibleState,
            'activeServersGroup',
            undefined,
            undefined,
            new vscode.ThemeIcon('server-environment'),
            `${serverCount} active servers`,
            undefined,
            'activeServersGroup'
        );
    }

    /**
     * Create no servers item
     */
    public static createNoServersItem(): ActiveServerTreeItem {
        return new ActiveServerTreeItem(
            'No active servers',
            vscode.TreeItemCollapsibleState.None,
            'noServers',
            undefined,
            undefined,
            new vscode.ThemeIcon('info'),
            'No servers are currently running',
            'Start a server to see it listed here',
            'noServers'
        );
    }

        /**
     * Create server item
     */
    public static createServerItem(server: ActiveServer): ActiveServerTreeItem {
        const label = ServerItemFactory.getServerLabel(server);
        const description = this.getServerDescription(server);
        const icon = this.getServerIcon(server);
        const tooltip = this.getServerTooltip(server);
        const contextValue = this.getServerContextValue(server);
        
        return new ActiveServerTreeItem(
            label,
            vscode.TreeItemCollapsibleState.None,
            'activeServer',
            server,
            {
                command: 'codeXR.activeServers.showActions',
                title: 'Show Server Actions',
                arguments: [server.id]
            },
            icon,
            description,
            tooltip,
            contextValue
        );
    }

    /**
     * Get server label based on custom name or default format
     * @private
     */
    private static getServerLabel(server: ActiveServer): string {
        console.log(`SERVER_ITEMS: 🔍 DEBUG - Getting label for server ${server.id}`);
        console.log(`SERVER_ITEMS: 🔍 DEBUG - Server customName: "${server.customName}"`);
        console.log(`SERVER_ITEMS: 🔍 DEBUG - Server port: ${server.port}`);
        
        // Check if customName is defined and not empty
        if (server.customName && server.customName.trim().length > 0) {
            const trimmedName = server.customName.trim();
            console.log(`SERVER_ITEMS: ✅ Using custom name: "${trimmedName}"`);
            return trimmedName;
        }
        
        // Fallback to localhost:<PORT> format when no custom name is provided
        const fallbackName = `localhost:${server.port}`;
        console.log(`SERVER_ITEMS: ⚠️ No custom name, using fallback: "${fallbackName}"`);
        return fallbackName;
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
        let color: string | undefined;
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
    private static getServerTooltip(server: ActiveServer): string {
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
    private static getServerContextValue(server: ActiveServer): string {
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
    private static formatUptime(milliseconds: number): string {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
}

/**
 * Server icons utility
 */
export class ServerIcons {
    public static readonly HTTP = new vscode.ThemeIcon('globe');
    public static readonly HTTPS_DEFAULT = new vscode.ThemeIcon('shield');
    public static readonly HTTPS_CUSTOM = new vscode.ThemeIcon('shield-check');
    public static readonly SERVER_RUNNING = new vscode.ThemeIcon('server', new vscode.ThemeColor('charts.green'));
    public static readonly SERVER_STOPPED = new vscode.ThemeIcon('server', new vscode.ThemeColor('charts.gray'));
    public static readonly SERVER_ERROR = new vscode.ThemeIcon('server', new vscode.ThemeColor('charts.red'));
    public static readonly ACTIVE_SERVERS_GROUP = new vscode.ThemeIcon('server-environment');
    public static readonly NO_SERVERS = new vscode.ThemeIcon('info');
    public static readonly BROWSER = new vscode.ThemeIcon('browser');
    public static readonly PANEL = new vscode.ThemeIcon('layout-panel');
}
