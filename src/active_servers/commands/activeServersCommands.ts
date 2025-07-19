import * as vscode from 'vscode';
import { ServerActionHandlers } from '../views/interactions/handleServerActions';

/**
 * Active Servers Commands
 * VS Code command definitions for active servers functionality
 */
export class ActiveServersCommands {
    
    // Store tree data provider reference for refresh operations
    private static treeDataProvider: any;

    /**
     * Register all active servers commands
     */
    public static registerCommands(context: vscode.ExtensionContext, treeDataProvider?: any): void {
        console.log('ACTIVE_SERVER: Registering active servers commands');
        
        // Store the tree data provider reference
        this.treeDataProvider = treeDataProvider;

        // Command: Show server actions (from tree item click)
        const showServerActionsCmd = vscode.commands.registerCommand(
            'codeXR.activeServers.showActions',
            async (serverId: string) => {
                await ServerActionHandlers.showServerActions(serverId);
            }
        );

        // Command: Open server in browser
        const openInBrowserCmd = vscode.commands.registerCommand(
            'codeXR.activeServers.openInBrowser',
            async (treeItem: any) => {
                const serverId = this.extractServerIdFromTreeItem(treeItem);
                if (serverId) {
                    await ServerActionHandlers.openInBrowser(serverId);
                }
            }
        );

        // Command: Open server in lateral panel
        const openInPanelCmd = vscode.commands.registerCommand(
            'codeXR.activeServers.openInPanel',
            async (treeItem: any) => {
                const serverId = this.extractServerIdFromTreeItem(treeItem);
                if (serverId) {
                    await ServerActionHandlers.openInPanel(serverId);
                }
            }
        );

        // Command: Copy server URL to clipboard
        const copyUrlCmd = vscode.commands.registerCommand(
            'codeXR.activeServers.copyUrl',
            async (treeItem: any) => {
                const serverId = this.extractServerIdFromTreeItem(treeItem);
                if (serverId) {
                    await ServerActionHandlers.copyUrl(serverId);
                }
            }
        );

        // Command: Stop specific server
        const stopServerCmd = vscode.commands.registerCommand(
            'codeXR.activeServers.stopServer',
            async (treeItem: any) => {
                const serverId = this.extractServerIdFromTreeItem(treeItem);
                if (serverId) {
                    await ServerActionHandlers.stopServer(serverId);
                }
            }
        );

        // Command: Show server details
        const showDetailsCmd = vscode.commands.registerCommand(
            'codeXR.activeServers.showDetails',
            async (treeItem: any) => {
                const serverId = this.extractServerIdFromTreeItem(treeItem);
                if (serverId) {
                    await ServerActionHandlers.showServerDetails(serverId);
                }
            }
        );

        // Command: Stop all servers
        const stopAllServersCmd = vscode.commands.registerCommand(
            'codeXR.activeServers.stopAllServers',
            async () => {
                await ServerActionHandlers.stopAllServers();
            }
        );

        // Command: Refresh server statuses
        const refreshServersCmd = vscode.commands.registerCommand(
            'codeXR.activeServers.refreshServers',
            async () => {
                // Use the unified tree data provider if available
                if (this.treeDataProvider && this.treeDataProvider.refresh) {
                    console.log('ACTIVE_SERVER: Refreshing unified tree view');
                    this.treeDataProvider.refresh();
                } else {
                    console.log('ACTIVE_SERVER: Using fallback refresh handler');
                    vscode.commands.executeCommand('codexr.tree.refresh');
                }
            }
        );

        // Command: Open active servers view 
        const openViewCmd = vscode.commands.registerCommand(
            'codeXR.activeServers.openView',
            async () => {
                await vscode.commands.executeCommand('codexrTree.focus');
            }
        );

        // Register all commands with the extension context
        context.subscriptions.push(
            showServerActionsCmd,
            openInBrowserCmd,
            openInPanelCmd,
            copyUrlCmd,
            stopServerCmd,
            showDetailsCmd,
            stopAllServersCmd,
            refreshServersCmd,
            openViewCmd
        );

        console.log('ACTIVE_SERVER: Registered 9 active servers commands');
    }

    /**
     * Extract server ID from tree item context
     * @private
     */
    private static extractServerIdFromTreeItem(treeItem: any): string | null {
        // Handle different tree item formats
        if (treeItem && treeItem.server && treeItem.server.id) {
            console.log(`ACTIVE_SERVER: Extracted server ID from tree item: ${treeItem.server.id}`);
            return treeItem.server.id;
        }
        
        // Fallback: if treeItem is a string, use it directly (for backward compatibility)
        if (typeof treeItem === 'string') {
            console.log(`ACTIVE_SERVER: Using direct server ID: ${treeItem}`);
            return treeItem;
        }
        
        console.error('ACTIVE_SERVER: Could not extract server ID from tree item:', treeItem);
        return null;
    }

    /**
     * Get all command IDs for external reference
     */
    public static getCommandIds(): Record<string, string> {
        return {
            showActions: 'codeXR.activeServers.showActions',
            openInBrowser: 'codeXR.activeServers.openInBrowser',
            openInPanel: 'codeXR.activeServers.openInPanel',
            copyUrl: 'codeXR.activeServers.copyUrl',
            stopServer: 'codeXR.activeServers.stopServer',
            showDetails: 'codeXR.activeServers.showDetails',
            stopAllServers: 'codeXR.activeServers.stopAllServers',
            refreshServers: 'codeXR.activeServers.refreshServers',
            openView: 'codeXR.activeServers.openView'
        };
    }
}
