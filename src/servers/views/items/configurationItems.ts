import * as vscode from 'vscode';
import { UnifiedServerTreeItem } from '../unifiedServersTreeView';
import { ServerNodeIcons } from './serverNodeIcons';
import { ServerSettingsManager } from '../../storage/serverSettingsManager';

/**
 * Get current server configuration
 */
export function getServerConfig() {
    return ServerSettingsManager.getInstance().getLegacyConfig();
}

/**
 * Update server configuration
 */
export async function updateServerConfig(updates: any): Promise<void> {
    const manager = ServerSettingsManager.getInstance();
    await manager.updateFromLegacyConfig(updates);
}

/**
 * Create configuration items for the server tree view
 */
export function createConfigurationItems(): UnifiedServerTreeItem[] {
    const config = getServerConfig();
    
    // Determine icon based on HTTP mode security
    const httpModeIcon = config.httpMode === 'HTTP' 
        ? ServerNodeIcons.httpModeUnsecure 
        : ServerNodeIcons.httpModeSecure;
    
    return [
        new UnifiedServerTreeItem(
            `HTTP Mode: ${config.httpMode}`,
            vscode.TreeItemCollapsibleState.None,
            'config-option',
            {
                command: 'codexr.server.config.httpMode',
                title: 'Configure HTTP Mode'
            },
            ServerNodeIcons.httpMode,
            `Click to change server mode (currently: ${config.httpMode})`
        ),
        new UnifiedServerTreeItem(
            `Default Port: ${config.port}`,
            vscode.TreeItemCollapsibleState.None,
            'config-option',
            {
                command: 'codexr.server.config.port',
                title: 'Configure Port'
            },
            ServerNodeIcons.defaultPort,
            `Click to change default port (currently: ${config.port})`
        ),
        new UnifiedServerTreeItem(
            `Auto-Open: ${config.autoOpen ? 'Enabled' : 'Disabled'}`,
            vscode.TreeItemCollapsibleState.None,
            'config-option',
            {
                command: 'codexr.server.config.autoOpen',
                title: 'Toggle Auto-Open'
            },
            ServerNodeIcons.autoOpen,
            `Click to toggle auto-open (currently: ${config.autoOpen ? 'enabled' : 'disabled'})`
        ),
        new UnifiedServerTreeItem(
            `Open Mode: ${config.openMode}`,
            vscode.TreeItemCollapsibleState.None,
            'config-option',
            {
                command: 'codexr.server.config.openMode',
                title: 'Configure Open Mode'
            },
            ServerNodeIcons.openMode,
            `Click to change open mode (currently: ${config.openMode})`
        ),
        new UnifiedServerTreeItem(
            'Reset to Default',
            vscode.TreeItemCollapsibleState.None,
            'config-option',
            {
                command: 'codexr.server.config.resetToDefault',
                title: 'Reset to Default Settings'
            },
            ServerNodeIcons.reset,
            'Reset all server configuration to default values'
        )
    ];
}
