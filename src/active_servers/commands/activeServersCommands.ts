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
                id: 'codeXR.activeServers.copyLanUrl',
                module: 'ACTIVE_SERVER',
                description: 'Copy active server LAN URL',
                handler: async (treeItem: unknown) => {
                    const serverId = this.extractServerIdFromTreeItem(treeItem);
                    if (serverId) {
                        await ServerActionHandlers.copyLanUrl(serverId);
                    }
                },
                errorMessage: 'Failed to copy active server LAN URL'
            },
            {
                id: 'codeXR.activeServers.startRemoteAccess',
                module: 'ACTIVE_SERVER',
                description: 'Start remote access',
                handler: async (treeItem: unknown) => {
                    const serverId = this.extractServerIdFromTreeItem(treeItem);
                    if (serverId) {
                        await ServerActionHandlers.startRemoteAccess(serverId);
                    }
                },
                errorMessage: 'Failed to start remote access',
            },
            {
                id: 'codeXR.activeServers.copyRemoteInvitation',
                module: 'ACTIVE_SERVER',
                description: 'Copy remote invitation',
                handler: async (treeItem: unknown) => {
                    const serverId = this.extractServerIdFromTreeItem(treeItem);
                    if (serverId) {
                        await ServerActionHandlers.copyRemoteInvitation(serverId);
                    }
                },
                errorMessage: 'Failed to copy remote invitation',
            },
            {
                id: 'codeXR.activeServers.stopRemoteAccess',
                module: 'ACTIVE_SERVER',
                description: 'Stop remote access',
                handler: async (treeItem: unknown) => {
                    const serverId = this.extractServerIdFromTreeItem(treeItem);
                    if (serverId) {
                        await ServerActionHandlers.stopRemoteAccess(serverId);
                    }
                },
                errorMessage: 'Failed to stop remote access',
            },
            {
                id: 'codeXR.activeServers.showRemoteStatus',
                module: 'ACTIVE_SERVER',
                description: 'Show remote access status',
                handler: async (treeItem: unknown) => {
                    const serverId = this.extractServerIdFromTreeItem(treeItem);
                    if (serverId) {
                        await ServerActionHandlers.showRemoteStatus(serverId);
                    }
                },
                errorMessage: 'Failed to show remote access status',
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
                id: 'codeXR.activeServers.regeneratePairingCode',
                module: 'ACTIVE_SERVER',
                description: 'Generate a new pairing code',
                handler: async (treeItem: unknown) => {
                    const serverId = this.extractServerIdFromTreeItem(treeItem);
                    if (serverId) {
                        await ServerActionHandlers.regeneratePairingCode(serverId);
                    }
                },
                errorMessage: 'Failed to generate a new pairing code',
            },
            {
                id: 'codeXR.activeServers.showParticipantDetails',
                module: 'ACTIVE_SERVER',
                description: 'Show connected participant details',
                handler: async (serverId: string, peerId: string) => {
                    await ServerActionHandlers.showParticipantDetails(serverId, peerId);
                },
                errorMessage: 'Failed to show participant details'
            },
            {
                id: 'codeXR.activeServers.removeParticipant',
                module: 'ACTIVE_SERVER',
                description: 'Remove a participant from the session',
                handler: async (target: unknown, peerIdArgument?: string) => {
                    // Invoked either from the details modal (serverId, peerId)
                    // or from the tree context menu (the participant row).
                    const participantTarget = typeof target === 'string' && peerIdArgument
                        ? { serverId: target, peerId: peerIdArgument }
                        : this.extractParticipantFromTreeItem(target);
                    if (participantTarget) {
                        await ServerActionHandlers.removeParticipant(
                            participantTarget.serverId,
                            participantTarget.peerId,
                        );
                    }
                },
                errorMessage: 'Failed to remove the participant',
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

    private static extractParticipantFromTreeItem(
        treeItem: unknown,
    ): { serverId: string; peerId: string } | null {
        if (typeof treeItem !== 'object' || treeItem === null) {
            return null;
        }
        const item = treeItem as {
            activeServer?: { id?: string };
            server?: { id?: string };
            participant?: { peerId?: string };
        };
        const serverId = item.activeServer?.id || item.server?.id;
        const peerId = item.participant?.peerId;
        if (!serverId || !peerId) {
            console.error('ACTIVE_SERVER: Could not extract participant from tree item:', treeItem);
            return null;
        }
        return { serverId, peerId };
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
            copyLanUrl: 'codeXR.activeServers.copyLanUrl',
            startRemoteAccess: 'codeXR.activeServers.startRemoteAccess',
            copyRemoteInvitation: 'codeXR.activeServers.copyRemoteInvitation',
            stopRemoteAccess: 'codeXR.activeServers.stopRemoteAccess',
            showRemoteStatus: 'codeXR.activeServers.showRemoteStatus',
            regeneratePairingCode: 'codeXR.activeServers.regeneratePairingCode',
            stopServer: 'codeXR.activeServers.stopServer',
            showDetails: 'codeXR.activeServers.showDetails',
            showParticipantDetails: 'codeXR.activeServers.showParticipantDetails',
            removeParticipant: 'codeXR.activeServers.removeParticipant',
            stopAllServers: 'codeXR.activeServers.stopAllServers',
            refreshServers: 'codeXR.activeServers.refreshServers',
            openView: 'codeXR.activeServers.openView'
        };
    }
}
