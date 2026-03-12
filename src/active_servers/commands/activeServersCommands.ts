import * as vscode from 'vscode';
import { ServerActionHandlers } from '../views/interactions/handleServerActions';
import { ExtensionCommandRegistration } from '../../commands/shared';

/**
 * Active Servers Commands
 * Command declarations for active servers functionality.
 */
export class ActiveServersCommands {
    private static treeDataProvider: { refresh(): void } | undefined;

    public static getCommandRegistrations(treeDataProvider?: { refresh(): void }): ExtensionCommandRegistration[] {
        this.treeDataProvider = treeDataProvider;

        return [
            {
                id: 'codeXR.activeServers.showActions',
                module: 'ACTIVE_SERVER',
                description: 'Show server actions',
                handler: async (serverId: string) => {
                    await ServerActionHandlers.showServerActions(serverId);
                },
                errorMessage: 'Failed to show server actions'
            },
            {
                id: 'codeXR.activeServers.openInBrowser',
                module: 'ACTIVE_SERVER',
                description: 'Open active server in browser',
                handler: async (treeItem: unknown) => {
                    const serverId = this.extractServerIdFromTreeItem(treeItem);
                    if (serverId) {
                        await ServerActionHandlers.openInBrowser(serverId);
                    }
                },
                errorMessage: 'Failed to open active server in browser'
            },
            {
                id: 'codeXR.activeServers.openInPanel',
                module: 'ACTIVE_SERVER',
                description: 'Open active server in panel',
                handler: async (treeItem: unknown) => {
                    const serverId = this.extractServerIdFromTreeItem(treeItem);
                    if (serverId) {
                        await ServerActionHandlers.openInPanel(serverId);
                    }
                },
                errorMessage: 'Failed to open active server in panel'
            },
            {
                id: 'codeXR.activeServers.copyUrl',
                module: 'ACTIVE_SERVER',
                description: 'Copy active server URL',
                handler: async (treeItem: unknown) => {
                    const serverId = this.extractServerIdFromTreeItem(treeItem);
                    if (serverId) {
                        await ServerActionHandlers.copyUrl(serverId);
                    }
                },
                errorMessage: 'Failed to copy active server URL'
            },
            {
                id: 'codeXR.activeServers.stopServer',
                module: 'ACTIVE_SERVER',
                description: 'Stop active server',
                handler: async (treeItem: unknown) => {
                    const serverId = this.extractServerIdFromTreeItem(treeItem);
                    if (serverId) {
                        await ServerActionHandlers.stopServer(serverId);
                    }
                },
                errorMessage: 'Failed to stop active server'
            },
            {
                id: 'codeXR.activeServers.showDetails',
                module: 'ACTIVE_SERVER',
                description: 'Show active server details',
                handler: async (treeItem: unknown) => {
                    const serverId = this.extractServerIdFromTreeItem(treeItem);
                    if (serverId) {
                        await ServerActionHandlers.showServerDetails(serverId);
                    }
                },
                errorMessage: 'Failed to show active server details'
            },
            {
                id: 'codeXR.activeServers.stopAllServers',
                module: 'ACTIVE_SERVER',
                description: 'Stop all active servers',
                handler: async () => {
                    await ServerActionHandlers.stopAllServers();
                },
                errorMessage: 'Failed to stop all active servers'
            },
            {
                id: 'codeXR.activeServers.refreshServers',
                module: 'ACTIVE_SERVER',
                description: 'Refresh active servers',
                handler: async () => {
                    if (this.treeDataProvider?.refresh) {
                        console.log('ACTIVE_SERVER: Refreshing unified tree view');
                        this.treeDataProvider.refresh();
                        return;
                    }

                    console.log('ACTIVE_SERVER: Using fallback refresh handler');
                    await vscode.commands.executeCommand('codexr.tree.refresh');
                },
                errorMessage: 'Failed to refresh active servers'
            },
            {
                id: 'codeXR.activeServers.openView',
                module: 'ACTIVE_SERVER',
                description: 'Open active servers view',
                handler: async () => {
                    await vscode.commands.executeCommand('codexrTree.focus');
                },
                errorMessage: 'Failed to open active servers view'
            }
        ];
    }

    private static extractServerIdFromTreeItem(treeItem: unknown): string | null {
        if (typeof treeItem === 'object' && treeItem !== null && 'server' in treeItem) {
            const server = (treeItem as { server?: { id?: string } }).server;
            if (server?.id) {
                console.log(`ACTIVE_SERVER: Extracted server ID from tree item: ${server.id}`);
                return server.id;
            }
        }

        if (typeof treeItem === 'string') {
            console.log(`ACTIVE_SERVER: Using direct server ID: ${treeItem}`);
            return treeItem;
        }

        console.error('ACTIVE_SERVER: Could not extract server ID from tree item:', treeItem);
        return null;
    }

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
