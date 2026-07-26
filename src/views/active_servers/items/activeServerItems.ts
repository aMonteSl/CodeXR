import * as vscode from 'vscode';
import { ActiveServer } from '../../../active_servers/model/activeServerModel';
import { COLLABORATION_AVATARS, ConnectedParticipantSummary } from '../../../collaboration';
import { NetworkUtils } from '../../../servers/utils/networkUtils';
import { CollaborationTreeItem } from '../../collaboration/items/collaborationItems';
import { ServerSettingsManager } from '../../../servers/storage/serverSettingsManager';

export type ActiveServerItemType =
    | 'server-item'
    | 'control-option'
    | 'no-servers'
    | 'info-item'
    | 'participants-group'
    | 'participant-item'
    | 'actions-group'
    | 'action-item'
    | 'remote-group'
    | 'collaboration-group'
    | 'collaboration-item';

/**
 * Active Server tree items for the Active Servers section
 */
export class ActiveServerTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly activeServerItemType: ActiveServerItemType,
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
     * Create the "COLLABORATION" group that hosts the shared identity options
     * and the remote session entry point inside the Active Servers section.
     */
    static createCollaborationGroupItem(): ActiveServerTreeItem {
        return new ActiveServerTreeItem(
            'COLLABORATION',
            vscode.TreeItemCollapsibleState.Expanded,
            'collaboration-group',
            undefined,
            new vscode.ThemeIcon('organization'),
            'Configure your shared identity and avatar',
            undefined,
            'collaborationGroup',
        );
    }

    /**
     * Adapt a collaboration item so it can live inside the Active Servers tree.
     * The collaboration factory stays the single source of truth for labels,
     * icons and commands.
     */
    static fromCollaborationItem(item: CollaborationTreeItem): ActiveServerTreeItem {
        return new ActiveServerTreeItem(
            typeof item.label === 'string' ? item.label : item.label?.label || 'Unknown',
            vscode.TreeItemCollapsibleState.None,
            'collaboration-item',
            item.command,
            item.iconPath as vscode.ThemeIcon | undefined,
            typeof item.tooltip === 'string' ? item.tooltip : undefined,
            typeof item.description === 'string' ? item.description : undefined,
            item.contextValue,
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
    static createServerItem(server: ActiveServer, expanded = false): ActiveServerTreeItem {
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
            expanded
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.Collapsed,
            'server-item',
            command,
            icon,
            tooltip,
            description,
            contextValue,
            server
        );
    }

    static createServerChildren(
        server: ActiveServer,
        participants: ConnectedParticipantSummary[],
    ): ActiveServerTreeItem[] {
        const protocol = server.certMode === 'http' ? 'http' : 'https';
        const lanUrl = `${protocol}://${NetworkUtils.getLocalIPAddress()}:${server.port}`;
        const children = [
            this.createCommandItem(
                'Local network address',
                lanUrl,
                'globe',
                'codeXR.activeServers.copyLanUrl',
                server,
                'info-item',
            ),
        ];

        // While shared, the invitation URL sits right below the local address:
        // one click copies the link to hand out.
        if (server.remoteAccess?.status === 'shared' && server.remoteAccess.invitationUrl) {
            children.push(this.createCommandItem(
                'Cross-network address',
                server.remoteAccess.invitationUrl,
                'radio-tower',
                'codeXR.activeServers.copyRemoteInvitation',
                server,
                'info-item',
                'Share this link with the people you want to invite. Click to copy.',
            ));
        }

        // The cross-network group exists only when the global setting allows it.
        // Defensive: a live tunnel is never hidden, even if the setting was
        // disabled underneath it.
        if (this.isRemoteAccessRelevant(server)) {
            children.push(this.createRemoteGroupItem(server));
        }

        children.push(new ActiveServerTreeItem(
            `Connected users (${participants.length})`,
            vscode.TreeItemCollapsibleState.Expanded,
            'participants-group',
            undefined,
            new vscode.ThemeIcon('organization'),
            `${participants.length} connected user(s)`,
            undefined,
            'activeServerParticipants',
            server,
        ));
        children.push(new ActiveServerTreeItem(
            'Actions',
            vscode.TreeItemCollapsibleState.Collapsed,
            'actions-group',
            undefined,
            new vscode.ThemeIcon('tools'),
            'Available actions for this server',
            undefined,
            'activeServerActions',
            server,
        ));
        return children;
    }

    static createParticipantItems(
        server: ActiveServer,
        participants: ConnectedParticipantSummary[],
    ): ActiveServerTreeItem[] {
        if (participants.length === 0) {
            return [new ActiveServerTreeItem(
                'No users connected',
                vscode.TreeItemCollapsibleState.None,
                'info-item',
                undefined,
                new vscode.ThemeIcon('info'),
                'The list updates as soon as somebody enters the scene.',
                undefined,
                'activeServerInfo',
                server,
            )];
        }

        return participants.map((participant) => {
            const avatar = COLLABORATION_AVATARS.find((candidate) => candidate.id === participant.avatarId);
            const client = participant.clientKind === 'codexr' ? 'CodeXR' : 'Browser';
            const scope = participant.connectionScope === 'remote' ? 'Remote' : 'Local';
            const avatarLabel = avatar?.label || participant.avatarId;
            return new ActiveServerTreeItem(
                participant.displayName,
                vscode.TreeItemCollapsibleState.None,
                'participant-item',
                {
                    command: 'codeXR.activeServers.showParticipantDetails',
                    title: 'Show participant details',
                    arguments: [server.id, participant.peerId],
                },
                new vscode.ThemeIcon('account'),
                [
                    `Name: ${participant.displayName}`,
                    `Role: ${participant.role === 'host' ? 'Host' : 'Guest'}`,
                    `Avatar: ${avatarLabel}`,
                    `Source: ${client}`,
                    `Connection: ${scope}`,
                    `IP address: ${participant.remoteAddress}`,
                    '',
                    'Click to view details',
                ].join('\n'),
                `${avatarLabel} | ${client} | ${scope}`,
                'activeServerParticipant',
                server,
            );
        });
    }

    /**
     * Whether the cross-network group should render for this server: the
     * global setting enables it, or a tunnel is already live/starting/failed.
     */
    static isRemoteAccessRelevant(server: ActiveServer): boolean {
        const status = server.remoteAccess?.status || 'stopped';
        if (status !== 'stopped') {
            return true;
        }
        try {
            return ServerSettingsManager.getInstance().getServerSettings().remoteAccess.enabled;
        } catch {
            // Settings manager not initialized yet (cannot happen while a
            // server is running, but never break the tree over it).
            return false;
        }
    }

    /**
     * Create the "Cross-network connection" group that hosts every remote
     * access item for a server.
     */
    static createRemoteGroupItem(server: ActiveServer): ActiveServerTreeItem {
        const remoteState = server.remoteAccess?.status || 'stopped';
        return new ActiveServerTreeItem(
            'Cross-network connection',
            remoteState === 'stopped'
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.Expanded,
            'remote-group',
            undefined,
            new vscode.ThemeIcon(
                remoteState === 'shared' ? 'radio-tower' : remoteState === 'error' ? 'error' : 'circle-outline',
            ),
            'Share this server across networks through a Cloudflare Quick Tunnel',
            this.getRemoteStatusDescription(server),
            'activeServerRemote',
            server,
        );
    }

    /**
     * Children of the cross-network group, driven by the tunnel status.
     */
    static createRemoteConnectionItems(server: ActiveServer): ActiveServerTreeItem[] {
        const status = server.remoteAccess?.status || 'stopped';

        if (status === 'shared' || status === 'starting') {
            const pending = server.remoteAccess?.pendingRequests || 0;
            const items: ActiveServerTreeItem[] = [];
            if (status === 'shared' && pending > 0) {
                items.push(this.createCommandItem(
                    'Generate new pairing code',
                    `${pending} waiting`,
                    'key',
                    'codeXR.activeServers.regeneratePairingCode',
                    server,
                    'action-item',
                    'Issue a new six-digit code and invalidate the previous one.',
                ));
            }
            items.push(
                this.createCommandItem(
                    'View remote status',
                    undefined,
                    'info',
                    'codeXR.activeServers.showRemoteStatus',
                    server,
                    'action-item',
                ),
                this.createCommandItem(
                    'Stop remote connection',
                    undefined,
                    'debug-stop',
                    'codeXR.activeServers.stopRemoteAccess',
                    server,
                    'action-item',
                ),
            );
            return items;
        }

        if (status === 'error') {
            return [
                this.createCommandItem(
                    'View remote error',
                    server.remoteAccess?.error || 'Tunnel error',
                    'error',
                    'codeXR.activeServers.showRemoteStatus',
                    server,
                    'action-item',
                ),
                this.createCommandItem(
                    'Start remote connection',
                    undefined,
                    'radio-tower',
                    'codeXR.activeServers.startRemoteAccess',
                    server,
                    'action-item',
                ),
            ];
        }

        return [
            this.createCommandItem(
                'Start remote connection',
                undefined,
                'radio-tower',
                'codeXR.activeServers.startRemoteAccess',
                server,
                'action-item',
            ),
        ];
    }

    static createActionItems(server: ActiveServer): ActiveServerTreeItem[] {
        const actions: Array<[string, string, string]> = [
            ['Open in browser', 'codeXR.activeServers.openInBrowser', 'link-external'],
        ];
        if (server.certMode === 'http') {
            actions.push(['Open in panel', 'codeXR.activeServers.openInPanel', 'open-preview']);
        }
        actions.push(
            ['Copy address', 'codeXR.activeServers.copyUrl', 'copy'],
            ['Server information', 'codeXR.activeServers.showDetails', 'info'],
            ['Stop server', 'codeXR.activeServers.stopServer', 'stop-circle'],
        );

        return actions.map(([label, command, icon]) => this.createCommandItem(
            label,
            undefined,
            icon,
            command,
            server,
            'action-item',
        ));
    }

    private static createCommandItem(
        label: string,
        description: string | undefined,
        icon: string,
        command: string,
        server: ActiveServer,
        type: ActiveServerItemType,
        tooltip?: string,
    ): ActiveServerTreeItem {
        return new ActiveServerTreeItem(
            label,
            vscode.TreeItemCollapsibleState.None,
            type,
            {
                command,
                title: label,
                arguments: [server.id],
            },
            new vscode.ThemeIcon(icon),
            tooltip || (description ? `${label}\n${description}` : label),
            description,
            'activeServerChild',
            server,
        );
    }

    private static getRemoteStatusDescription(server: ActiveServer): string {
        const state = server.remoteAccess;
        if (!state || state.status === 'stopped') {
            return 'Not shared';
        }
        if (state.status === 'starting') {
            return 'Starting...';
        }
        if (state.status === 'error') {
            return state.error || 'Error';
        }
        if (state.pendingRequests === 0) {
            return 'Shared';
        }
        return state.pendingRequests === 1
            ? 'Shared | 1 request waiting'
            : `Shared | ${state.pendingRequests} requests waiting`;
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
