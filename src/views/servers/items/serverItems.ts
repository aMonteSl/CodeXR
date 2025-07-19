import * as vscode from 'vscode';
import { ServerSettingsManager } from '../../../servers/storage/serverSettingsManager';

/**
 * Get current server configuration for dynamic item creation
 */
function getServerConfig() {
    return ServerSettingsManager.getInstance().getLegacyConfig();
}

/**
 * Server tree items for the Servers section
 */
export class ServerTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly serverItemType: 'config-group' | 'config-option' | 'launch-option',
        command?: vscode.Command,
        iconPath?: vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri },
        tooltip?: string,
        description?: string,
        contextValue?: string
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
 * Factory for creating server-related tree items
 */
export class ServerItemFactory {
    /**
     * Create server configuration group item
     */
    static createConfigurationGroup(): ServerTreeItem {
        console.log('SERVERS: Creating Server Configuration group item');
        
        return new ServerTreeItem(
            'Server Configuration',
            vscode.TreeItemCollapsibleState.Collapsed,
            'config-group',
            undefined,
            new vscode.ThemeIcon('settings-gear'),
            'Configure server settings'
        );
    }
    
    /**
     * Create start server option item
     */
    static createStartServerOption(port: number, httpMode: string): ServerTreeItem {
        console.log(`SERVERS: Creating Start Local Server option for port ${port} (${httpMode})`);
        
        return new ServerTreeItem(
            'Start Local Server',
            vscode.TreeItemCollapsibleState.None,
            'launch-option',
            {
                command: 'codexr.server.launch',
                title: 'Start Local Server'
            },
            new vscode.ThemeIcon('play'),
            `Start server on port ${port} (${httpMode})`
        );
    }
    
    /**
     * Create configuration option items
     */
    static createConfigurationOptions(): ServerTreeItem[] {
        console.log('SERVERS: Creating server configuration option items');
        
        const config = getServerConfig();
        
        return [
            new ServerTreeItem(
                `HTTP Mode: ${config.httpMode}`,
                vscode.TreeItemCollapsibleState.None,
                'config-option',
                {
                    command: 'codexr.server.config.httpMode',
                    title: 'Configure HTTP Mode'
                },
                new vscode.ThemeIcon(config.httpMode === 'HTTP' ? 'unlock' : 'lock'),
                `Click to change server mode (currently: ${config.httpMode})`
            ),
            new ServerTreeItem(
                `Default Port: ${config.port}`,
                vscode.TreeItemCollapsibleState.None,
                'config-option',
                {
                    command: 'codexr.server.config.port',
                    title: 'Configure Port'
                },
                new vscode.ThemeIcon('symbol-numeric'),
                `Click to change default port (currently: ${config.port})`
            ),
            new ServerTreeItem(
                `Auto-Open: ${config.autoOpen ? 'Enabled' : 'Disabled'}`,
                vscode.TreeItemCollapsibleState.None,
                'config-option',
                {
                    command: 'codexr.server.config.autoOpen',
                    title: 'Toggle Auto-Open'
                },
                new vscode.ThemeIcon(config.autoOpen ? 'check' : 'x'),
                `Click to toggle auto-open (currently: ${config.autoOpen ? 'enabled' : 'disabled'})`
            ),
            new ServerTreeItem(
                `Open Mode: ${config.openMode}`,
                vscode.TreeItemCollapsibleState.None,
                'config-option',
                {
                    command: 'codexr.server.config.openMode',
                    title: 'Configure Open Mode'
                },
                new vscode.ThemeIcon('window'),
                `Click to change open mode (currently: ${config.openMode})`
            ),
            new ServerTreeItem(
                'Reset to Default',
                vscode.TreeItemCollapsibleState.None,
                'config-option',
                {
                    command: 'codexr.server.config.resetToDefault',
                    title: 'Reset to Default Settings'
                },
                new vscode.ThemeIcon('refresh'),
                'Reset all server configuration to default values'
            )
        ];
    }
}
