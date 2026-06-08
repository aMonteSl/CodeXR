import * as vscode from 'vscode';
import { ActiveServer } from '../../../active_servers/model/activeServerModel';
import { COLLABORATION_AVATARS, ConnectedParticipantSummary } from '../../../collaboration';
import { NetworkUtils } from '../../../servers/utils/networkUtils';

export type ActiveServerItemType =
    | 'server-item'
    | 'control-option'
    | 'no-servers'
    | 'info-item'
    | 'participants-group'
    | 'participant-item'
    | 'actions-group'
    | 'action-item';

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
            vscode.TreeItemCollapsibleState.Collapsed,
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
        const remoteState = server.remoteAccess?.status || 'stopped';
        const children = [
            this.createCommandItem(
                'Direccion de red local',
                lanUrl,
                'globe',
                'codeXR.activeServers.copyLanUrl',
                server,
                'info-item',
            ),
            this.createCommandItem(
                'Conexion remota',
                this.getRemoteStatusDescription(server),
                remoteState === 'shared' ? 'radio-tower' : remoteState === 'error' ? 'error' : 'circle-outline',
                'codeXR.activeServers.showRemoteStatus',
                server,
                'info-item',
            ),
        ];

        if (server.remoteAccess?.status === 'shared' && server.remoteAccess.invitationUrl) {
            children.push(this.createCommandItem(
                'Copiar invitacion remota',
                server.remoteAccess.invitationUrl,
                'copy',
                'codeXR.activeServers.copyRemoteInvitation',
                server,
                'info-item',
            ));
        }

        children.push(new ActiveServerTreeItem(
            `Usuarios conectados (${participants.length})`,
            vscode.TreeItemCollapsibleState.Expanded,
            'participants-group',
            undefined,
            new vscode.ThemeIcon('accounts'),
            `${participants.length} usuario(s) conectado(s)`,
            undefined,
            'activeServerParticipants',
            server,
        ));
        children.push(new ActiveServerTreeItem(
            'Acciones',
            vscode.TreeItemCollapsibleState.Collapsed,
            'actions-group',
            undefined,
            new vscode.ThemeIcon('tools'),
            'Acciones disponibles para este servidor',
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
                'Ningun usuario conectado',
                vscode.TreeItemCollapsibleState.None,
                'info-item',
                undefined,
                new vscode.ThemeIcon('info'),
                'La lista se actualizara cuando alguien entre en la escena.',
                undefined,
                'activeServerInfo',
                server,
            )];
        }

        return participants.map((participant) => {
            const avatar = COLLABORATION_AVATARS.find((candidate) => candidate.id === participant.avatarId);
            const client = participant.clientKind === 'codexr' ? 'CodeXR' : 'Navegador';
            const scope = participant.connectionScope === 'remote' ? 'Remoto' : 'Local';
            const avatarLabel = avatar?.label || participant.avatarId;
            return new ActiveServerTreeItem(
                participant.displayName,
                vscode.TreeItemCollapsibleState.None,
                'participant-item',
                undefined,
                new vscode.ThemeIcon('account'),
                [
                    `Nombre: ${participant.displayName}`,
                    `Avatar: ${avatarLabel}`,
                    `Origen: ${client}`,
                    `Conexion: ${scope}`,
                ].join('\n'),
                `${avatarLabel} | ${client} | ${scope}`,
                'activeServerParticipant',
                server,
            );
        });
    }

    static createActionItems(server: ActiveServer): ActiveServerTreeItem[] {
        const actions: Array<[string, string, string]> = [
            ['Abrir en navegador', 'codeXR.activeServers.openInBrowser', 'link-external'],
        ];
        if (server.certMode === 'http') {
            actions.push(['Abrir en panel', 'codeXR.activeServers.openInPanel', 'open-preview']);
        }
        actions.push(['Copiar direccion', 'codeXR.activeServers.copyUrl', 'copy']);

        if (server.remoteAccess?.status === 'shared' || server.remoteAccess?.status === 'starting') {
            if (server.remoteAccess.invitationUrl) {
                actions.push(['Copiar invitacion remota', 'codeXR.activeServers.copyRemoteInvitation', 'copy']);
            }
            actions.push(['Ver estado remoto', 'codeXR.activeServers.showRemoteStatus', 'info']);
            actions.push(['Detener conexion remota', 'codeXR.activeServers.stopRemoteAccess', 'debug-stop']);
        } else {
            actions.push(['Iniciar conexion remota', 'codeXR.activeServers.startRemoteAccess', 'radio-tower']);
            if (server.remoteAccess?.status === 'error') {
                actions.push(['Ver error remoto', 'codeXR.activeServers.showRemoteStatus', 'error']);
            }
        }

        actions.push(
            ['Informacion del servidor', 'codeXR.activeServers.showDetails', 'info'],
            ['Detener servidor', 'codeXR.activeServers.stopServer', 'stop-circle'],
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
            description ? `${label}\n${description}` : label,
            description,
            'activeServerChild',
            server,
        );
    }

    private static getRemoteStatusDescription(server: ActiveServer): string {
        const state = server.remoteAccess;
        if (!state || state.status === 'stopped') {
            return 'No compartido';
        }
        if (state.status === 'starting') {
            return 'Iniciando...';
        }
        if (state.status === 'error') {
            return state.error || 'Error';
        }
        return state.pendingRequests > 0
            ? `Compartido | ${state.pendingRequests} solicitud(es) pendiente(s)`
            : 'Compartido';
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
