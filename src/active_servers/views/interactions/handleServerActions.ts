import * as path from 'path';
import * as vscode from 'vscode';
import { ActiveServer } from '../../model/activeServerModel';
import { getActiveServerRegistry } from '../../registry/activeServerRegistry';
import { ServerControl } from '../../runtime/serverControl';
import { PreviewRenderer } from '../../../servers/runtime/previewRenderer';
import { NetworkUtils } from '../../../servers/utils/networkUtils';
import { RemoteAccessManager } from '../../../remote_access';
import { ServerSettingsManager } from '../../../servers/storage/serverSettingsManager';
import { COLLABORATION_AVATARS, ConnectedParticipantSummary } from '../../../collaboration';
import type { PairingRequestSummary } from '../../../remote_access/security/remoteSessionAuthority';
import { DetailRow, formatDetailSections, formatDuration } from '../../../utils/detailDialog';

/** Minimal shape needed to hand out pairing codes; kept structural so the
 *  handler does not depend on the concrete server runtime class. */
interface PairingAuthority {
    listPendingPairingRequests(): PairingRequestSummary[];
    regeneratePairingCode(requestId: string): { code: string; expiresAt: number };
}

/**
 * Server Action Handlers
 * Handle user interactions with active servers
 */
export class ServerActionHandlers {

    /**
     * Show server actions quick pick
     */
    public static async showServerActions(serverId: string): Promise<void> {
        console.log(`ACTIVE_SERVER: Showing actions for server ${serverId}`);
        
        const registry = getActiveServerRegistry();
        const server = registry.getServer(serverId);
        
        if (!server) {
            console.error(`ACTIVE_SERVER: Server ${serverId} not found`);
            vscode.window.showErrorMessage(`Server not found: ${serverId}`);
            return;
        }

        const actions = this.getAvailableActions(server);
        
        const selectedAction = await vscode.window.showQuickPick(actions, {
            placeHolder: `Actions for ${server.url}`,
            title: `Server Actions - localhost:${server.port}`
        });

        if (selectedAction) {
            await this.executeAction(selectedAction.action, server);
        }
    }

    /**
     * Open server in browser
     */
    public static async openInBrowser(serverId: string): Promise<void> {
        console.log(`ACTIVE_SERVER: Opening server ${serverId} in browser`);
        
        const registry = getActiveServerRegistry();
        const server = registry.getServer(serverId);
        
        if (!server) {
            console.error(`ACTIVE_SERVER: Server ${serverId} not found`);
            vscode.window.showErrorMessage(`Server not found: ${serverId}`);
            return;
        }

        try {
            const browserUrl = typeof server.serverInstance?.createAuthenticatedBrowserUrl === 'function'
                ? server.serverInstance.createAuthenticatedBrowserUrl(server.url)
                : server.url;
            await PreviewRenderer.openPreview(browserUrl, server.htmlFile || '', 'browser');
            console.log(`ACTIVE_SERVER: Opened ${server.url} in browser`);
            vscode.window.showInformationMessage(`Opened ${server.url} in browser`);
        } catch (error) {
            console.error(`ACTIVE_SERVER: Error opening ${server.url} in browser:`, error);
            vscode.window.showErrorMessage(
                `Failed to open in browser: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Open server in lateral panel
     */
    public static async openInPanel(serverId: string): Promise<void> {
        console.log(`ACTIVE_SERVER: Opening server ${serverId} in lateral panel`);
        
        const registry = getActiveServerRegistry();
        const server = registry.getServer(serverId);
        
        if (!server) {
            console.error(`ACTIVE_SERVER: Server ${serverId} not found`);
            vscode.window.showErrorMessage(`Server not found: ${serverId}`);
            return;
        }

        // Check for HTTPS + lateral panel conflict
        if (server.certMode !== 'http') {
            console.log(`ACTIVE_SERVER: HTTPS server ${serverId} cannot be opened in lateral panel - cert mode: ${server.certMode}`);
            
            const response = await vscode.window.showWarningMessage(
                'HTTPS content cannot be displayed in VS Code panels due to security restrictions. The content will not load properly.',
                'Open in Browser Instead',
                'Cancel'
            );
            
            if (response === 'Open in Browser Instead') {
                console.log(`ACTIVE_SERVER: Redirecting server ${serverId} to browser due to HTTPS incompatibility`);
                return this.openInBrowser(serverId);
            } else {
                console.log(`ACTIVE_SERVER: User cancelled opening HTTPS server ${serverId} in panel`);
                return; // User cancelled
            }
        }

        try {
            console.log(`ACTIVE_SERVER: Opening HTTP server ${serverId} (${server.url}) in lateral panel`);
            const panelUrl = typeof server.serverInstance?.createAuthenticatedBrowserUrl === 'function'
                ? server.serverInstance.createAuthenticatedBrowserUrl(server.url)
                : server.url;
            await PreviewRenderer.openPreview(panelUrl, server.htmlFile || '', 'lateralPanel', serverId);
            console.log(`ACTIVE_SERVER: Successfully opened ${server.url} in lateral panel`);
            vscode.window.showInformationMessage(`Opened ${server.url} in VS Code panel`);
        } catch (error) {
            console.error(`ACTIVE_SERVER: Error opening ${server.url} in panel:`, error);
            vscode.window.showErrorMessage(
                `Failed to open in panel: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Copy server URL to clipboard
     */
    public static async copyUrl(serverId: string): Promise<void> {
        console.log(`ACTIVE_SERVER: Copying URL for server ${serverId}`);
        
        const registry = getActiveServerRegistry();
        const server = registry.getServer(serverId);
        
        if (!server) {
            console.error(`ACTIVE_SERVER: Server ${serverId} not found`);
            vscode.window.showErrorMessage(`Server not found: ${serverId}`);
            return;
        }

        try {
            // Extract port and protocol from server URL
            const portMatch = server.url.match(/:(\d+)/);
            const port = portMatch ? parseInt(portMatch[1]) : null;
            const protocol = server.url.startsWith('https') ? 'https' : 'http';
            
            const localIP = NetworkUtils.getLocalIPAddress();
            const hasNetworkAccess = localIP !== 'localhost' && port;
            
            if (hasNetworkAccess) {
                // Show options for localhost vs network URL
                const networkUrl = `${protocol}://${localIP}:${port}`;
                const choice = await vscode.window.showQuickPick([
                    {
                        label: 'Local URL',
                        description: server.url,
                        detail: 'For use on this computer only'
                    },
                    {
                        label: 'Network URL', 
                        description: networkUrl,
                        detail: 'For access from other devices on the network'
                    }
                ], {
                    placeHolder: 'Choose URL type to copy'
                });
                
                if (!choice) {
                    return; // User cancelled
                }
                
                const urlToCopy = choice.label.includes('Network') ? networkUrl : server.url;
                await vscode.env.clipboard.writeText(urlToCopy);
                console.log(`ACTIVE_SERVER: Copied ${urlToCopy} to clipboard`);
                vscode.window.showInformationMessage(`Copied ${choice.label.includes('Network') ? 'Network' : 'Local'} URL to clipboard`);
            } else {
                // Fallback to original behavior if no network access available
                await vscode.env.clipboard.writeText(server.url);
                console.log(`ACTIVE_SERVER: Copied ${server.url} to clipboard`);
                vscode.window.showInformationMessage(`Copied ${server.url} to clipboard`);
            }
        } catch (error) {
            console.error(`ACTIVE_SERVER: Error copying URL to clipboard:`, error);
            vscode.window.showErrorMessage('Failed to copy URL to clipboard');
        }
    }

    public static async copyLanUrl(serverId: string): Promise<void> {
        const server = getActiveServerRegistry().getServer(serverId);
        if (!server) {
            vscode.window.showErrorMessage(`Server not found: ${serverId}`);
            return;
        }
        const protocol = server.url.startsWith('https') ? 'https' : 'http';
        const lanUrl = `${protocol}://${NetworkUtils.getLocalIPAddress()}:${server.port}`;
        await vscode.env.clipboard.writeText(lanUrl);
        vscode.window.showInformationMessage(`Network address copied: ${lanUrl}`);
    }

    public static async startRemoteAccess(serverId: string): Promise<void> {
        const manager = RemoteAccessManager.getInstance();
        if (!manager) {
            throw new Error('The remote access manager is not initialized.');
        }
        const state = await manager.startSharing(serverId);
        if (state.status === 'shared' && state.invitationUrl) {
            await vscode.env.clipboard.writeText(state.invitationUrl);
            vscode.window.showInformationMessage(
                'Server shared through Cloudflare. The invitation link has been copied to the clipboard.',
            );
        }
    }

    public static async copyRemoteInvitation(serverId: string): Promise<void> {
        const manager = RemoteAccessManager.getInstance();
        if (!manager) {
            throw new Error('The remote access manager is not initialized.');
        }
        await manager.copyInvitation(serverId);
    }

    public static async stopRemoteAccess(serverId: string): Promise<void> {
        const manager = RemoteAccessManager.getInstance();
        if (!manager) {
            throw new Error('The remote access manager is not initialized.');
        }
        await manager.stopSharing(serverId);
    }

    /**
     * Show a modal with the details of one connected participant
     */
    public static async showParticipantDetails(serverId: string, peerId: string): Promise<void> {
        const server = getActiveServerRegistry().getServer(serverId);
        const runtime = server?.serverInstance as
            | { getConnectedParticipants?: () => ConnectedParticipantSummary[] }
            | undefined;
        const participants = typeof runtime?.getConnectedParticipants === 'function'
            ? runtime.getConnectedParticipants()
            : [];
        const participant = participants.find((candidate) => candidate.peerId === peerId);

        if (!participant) {
            vscode.window.showInformationMessage('This participant is no longer connected.');
            return;
        }

        const avatar = COLLABORATION_AVATARS.find((candidate) => candidate.id === participant.avatarId);
        const connectedAt = new Date(participant.connectedAt);
        const connectedFor = Number.isNaN(connectedAt.getTime())
            ? participant.connectedAt
            : `${connectedAt.toLocaleTimeString()} · ${this.formatDuration(Date.now() - connectedAt.getTime())} ago`;

        const detail = this.formatDetailSections([
            [
                ['Name', participant.displayName],
                ['Role', participant.role === 'host' ? 'Host' : 'Guest'],
                ['Avatar', avatar?.label || participant.avatarId],
            ],
            [
                ['Client', participant.clientKind === 'codexr' ? 'CodeXR' : 'Browser'],
                ['Connection', participant.connectionScope === 'remote' ? 'Remote (cross-network)' : 'Local network'],
                ['IP address', participant.remoteAddress],
                ['Connected', connectedFor],
            ],
        ]);

        await vscode.window.showInformationMessage(
            `Participant — ${participant.displayName}`,
            { modal: true, detail },
        );
    }

    /**
     * Issue a new pairing code for a waiting guest, invalidating the old one
     */
    public static async regeneratePairingCode(serverId: string): Promise<void> {
        const server = getActiveServerRegistry().getServer(serverId);
        const runtime = server?.serverInstance as
            | { getRemoteSessionAuthority?: () => PairingAuthority }
            | undefined;
        const authority = typeof runtime?.getRemoteSessionAuthority === 'function'
            ? runtime.getRemoteSessionAuthority()
            : undefined;

        if (!authority) {
            vscode.window.showWarningMessage('This server does not support remote access.');
            return;
        }

        const pending = authority.listPendingPairingRequests();
        if (pending.length === 0) {
            vscode.window.showInformationMessage('Nobody is waiting to connect right now.');
            return;
        }

        let requestId = pending[0].requestId;
        if (pending.length > 1) {
            const selection = await vscode.window.showQuickPick(
                pending.map((request) => ({
                    label: request.displayName,
                    description: request.remoteAddress,
                    detail: request.codeValid
                        ? 'Waiting for the code'
                        : 'Their code was invalidated by a failed attempt',
                    requestId: request.requestId,
                })),
                { title: 'Generate new pairing code', placeHolder: 'Who is trying to connect?' },
            );
            if (!selection) {
                return;
            }
            requestId = selection.requestId;
        }

        // The authority emits a pairing-request event, which drives the toast
        // that shows the new code to the host.
        authority.regeneratePairingCode(requestId);
    }

    public static async showRemoteStatus(serverId: string): Promise<void> {
        const server = getActiveServerRegistry().getServer(serverId);
        const state = server?.remoteAccess;
        const title = server
            ? `Cross-network connection — ${this.getServerLabel(server)}`
            : 'Cross-network connection';

        const detail = state
            ? this.formatDetailSections([
                [
                    ['Status', this.formatRemoteStatus(state, false)],
                    ['Pending', state.status === 'shared'
                        ? this.formatPendingRequests(state.pendingRequests)
                        : undefined],
                ],
                [
                    ['Invitation', state.invitationUrl],
                    ['Public URL', state.publicUrl],
                ],
                [
                    ['Error', state.error],
                ],
            ])
            : this.formatDetailSections([[['Status', 'Not shared']]]);

        await vscode.window.showInformationMessage(title, { modal: true, detail });
    }

    /**
     * Stop server
     */
    public static async stopServer(serverId: string): Promise<void> {
        console.log(`ACTIVE_SERVER: Stopping server ${serverId}`);
        
        const registry = getActiveServerRegistry();
        const server = registry.getServer(serverId);
        
        if (!server) {
            console.error(`ACTIVE_SERVER: Server ${serverId} not found`);
            vscode.window.showErrorMessage(`Server not found: ${serverId}`);
            return;
        }

        const response = await vscode.window.showWarningMessage(
            `Stop server ${server.url}?`,
            'Stop',
            'Cancel'
        );

        if (response === 'Stop') {
            try {
                await RemoteAccessManager.getInstance()?.stopSharing(serverId, false);
                console.log(`ACTIVE_SERVER: Stopping server ${serverId} (${server.url})`);
                const success = await ServerControl.stopServer(serverId);
                
                if (success) {
                    console.log(`ACTIVE_SERVER: Successfully stopped server ${serverId}`);
                    vscode.window.showInformationMessage(`Stopped server ${server.url}`);
                    
                    // Refresh the tree view
                    vscode.commands.executeCommand('codeXR.activeServers.refreshServers');
                } else {
                    console.error(`ACTIVE_SERVER: Failed to stop server ${serverId}`);
                    vscode.window.showErrorMessage(`Failed to stop server ${server.url}`);
                }
            } catch (error) {
                console.error(`ACTIVE_SERVER: Error stopping server ${serverId}:`, error);
                vscode.window.showErrorMessage(
                    `Error stopping server: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        } else {
            console.log(`ACTIVE_SERVER: User cancelled stopping server ${serverId}`);
        }
    }

    /**
     * Show detailed server information
     */
    public static async showServerDetails(serverId: string): Promise<void> {
        console.log(`ACTIVE_SERVER: Showing details for server ${serverId}`);
        
        const registry = getActiveServerRegistry();
        const server = registry.getServer(serverId);
        
        if (!server) {
            console.error(`ACTIVE_SERVER: Server ${serverId} not found`);
            vscode.window.showErrorMessage(`Server not found: ${serverId}`);
            return;
        }

        const details = this.formatServerDetails(server);

        console.log(`ACTIVE_SERVER: Displaying detailed information for server ${serverId}`);
        await vscode.window.showInformationMessage(
            `Server Information — ${this.getServerLabel(server)}`,
            { modal: true, detail: details }
        );
    }

    /** Friendly server name used as dialog titles. @private */
    private static getServerLabel(server: ActiveServer): string {
        return server.customName?.trim() || `localhost:${server.port}`;
    }

    /**
     * Stop all servers
     */
    public static async stopAllServers(): Promise<void> {
        console.log('ACTIVE_SERVER: Stopping all servers');
        
        const registry = getActiveServerRegistry();
        const allServers = registry.getAllServers();
        
        if (allServers.length === 0) {
            vscode.window.showInformationMessage('No servers are currently running');
            return;
        }

        const response = await vscode.window.showWarningMessage(
            `Stop all ${allServers.length} server(s)?`,
            'Stop All',
            'Cancel'
        );

        if (response === 'Stop All') {
            try {
                await RemoteAccessManager.getInstance()?.stopAll();
                console.log(`ACTIVE_SERVER: Stopping ${allServers.length} servers`);
                const success = await ServerControl.stopAllServers();
                
                if (success) {
                    console.log('ACTIVE_SERVER: Successfully stopped all servers');
                    vscode.window.showInformationMessage(`Stopped all ${allServers.length} servers`);
                } else {
                    console.error('ACTIVE_SERVER: Failed to stop some servers');
                    vscode.window.showWarningMessage('Some servers may not have stopped properly');
                }
                
                // Refresh the tree view
                vscode.commands.executeCommand('codeXR.activeServers.refreshServers');
            } catch (error) {
                console.error('ACTIVE_SERVER: Error stopping all servers:', error);
                vscode.window.showErrorMessage(
                    `Error stopping servers: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        } else {
            console.log('ACTIVE_SERVER: User cancelled stopping all servers');
        }
    }

    /**
     * Refresh servers display
     */
    public static async refreshServers(): Promise<void> {
        console.log('ACTIVE_SERVER: Refreshing servers display');
        vscode.commands.executeCommand('codeXR.activeServers.refreshServers');
    }

    /**
     * Get available actions for a server based on its type
     * @private
     */
    private static getAvailableActions(server: ActiveServer): Array<{
        label: string;
        description: string;
        action: string;
    }> {
        const isHttp = server.certMode === 'http';

        const actions = [
            {
                label: 'Open in Browser',
                description: 'Open server in external browser',
                action: 'openInBrowser'
            }
        ];

        if (this.isRemoteAccessRelevant(server)) {
            this.appendRemoteActions(actions, server);
        }

        // Add lateral panel option only for HTTP servers
        if (isHttp) {
            actions.push({
                label: 'Open in Panel',
                description: 'Open server in VS Code lateral panel',
                action: 'openInPanel'
            });
        }

        actions.push(
            {
                label: 'Copy URL',
                description: 'Copy server URL to clipboard',
                action: 'copyUrl'
            },
            {
                label: 'Server Info',
                description: 'Show detailed server information',
                action: 'showDetails'
            },
            {
                label: 'Stop Server',
                description: 'Stop this server',
                action: 'stopServer'
            }
        );

        return actions;
    }

    /**
     * Mirror of the tree rule: remote entries appear only when the global
     * cross-network setting is enabled, or a tunnel is already active.
     */
    private static isRemoteAccessRelevant(server: ActiveServer): boolean {
        const status = server.remoteAccess?.status || 'stopped';
        if (status !== 'stopped') {
            return true;
        }
        try {
            return ServerSettingsManager.getInstance().getServerSettings().remoteAccess.enabled;
        } catch {
            return false;
        }
    }

    /**
     * Append the remote-access QuickPick entries for the server's tunnel state
     */
    private static appendRemoteActions(
        actions: Array<{ label: string; description: string; action: string }>,
        server: ActiveServer,
    ): void {
        if (server.remoteAccess?.status === 'shared' || server.remoteAccess?.status === 'starting') {
            actions.push(
                {
                    label: 'Copy remote invitation',
                    description: 'Copy the protected temporary link',
                    action: 'copyRemoteInvitation',
                },
                {
                    label: 'Remote status',
                    description: 'View pending requests and tunnel status',
                    action: 'remoteStatus',
                },
                {
                    label: 'Stop remote connection',
                    description: 'Close the tunnel and revoke the remote sessions',
                    action: 'stopRemoteAccess',
                },
            );
        } else {
            actions.push({
                label: 'Start remote connection',
                description: 'Publish temporarily through a Cloudflare Quick Tunnel',
                action: 'startRemoteAccess',
            });
            if (server.remoteAccess?.status === 'error') {
                actions.push({
                    label: 'View remote error',
                    description: server.remoteAccess.error || 'Tunnel error',
                    action: 'remoteStatus',
                });
            }
        }
    }

    /**
     * Execute an action on a server
     * @private
     */
    private static async executeAction(action: string, server: ActiveServer): Promise<void> {
        console.log(`ACTIVE_SERVER: Executing action '${action}' on server ${server.id}`);
        
        switch (action) {
            case 'openInBrowser':
                await this.openInBrowser(server.id);
                break;
            case 'openInPanel':
                await this.openInPanel(server.id);
                break;
            case 'copyUrl':
                await this.copyUrl(server.id);
                break;
            case 'showDetails':
                await this.showServerDetails(server.id);
                break;
            case 'startRemoteAccess':
                await this.startRemoteAccess(server.id);
                break;
            case 'copyRemoteInvitation':
                await this.copyRemoteInvitation(server.id);
                break;
            case 'remoteStatus':
                await this.showRemoteStatus(server.id);
                break;
            case 'stopRemoteAccess':
                await this.stopRemoteAccess(server.id);
                break;
            case 'stopServer':
                await this.stopServer(server.id);
                break;
            default:
                console.error(`ACTIVE_SERVER: Unknown action: ${action}`);
                vscode.window.showErrorMessage(`Unknown action: ${action}`);
        }
    }

    /**
     * Format server details for display
     * @private
     */
    private static formatServerDetails(server: ActiveServer): string {
        const metadata = (server.metadata || {}) as Record<string, unknown>;
        const remote = server.remoteAccess;
        const protocol = server.certMode === 'http' ? 'http' : 'https';
        const lanUrl = `${protocol}://${NetworkUtils.getLocalIPAddress()}:${server.port}`;

        return this.formatDetailSections([
            [
                ['Status', `${this.formatServerStatus(server)} · up ${this.formatDuration(Date.now() - server.timestamp)}`],
                ['Address', server.url],
                ['Network', lanUrl],
                ['Port', String(server.port)],
                ['Security', this.formatCertMode(server.certMode)],
                ['Mode', server.launchMode === 'browser' ? 'Browser' : 'Panel'],
            ],
            [
                ['Serving', server.htmlFile ? path.basename(server.htmlFile) : undefined],
                ['Folder', this.shortenPath(String(metadata.staticRoot || ''))],
                ['Type', metadata.serverType ? String(metadata.serverType) : undefined],
                ['Details', metadata.description ? String(metadata.description) : undefined],
            ],
            [
                ['Cross-network', remote && remote.status !== 'stopped'
                    ? this.formatRemoteStatus(remote)
                    : undefined],
                ['Invitation', remote?.invitationUrl],
            ],
        ]);
    }

    /** @private */
    private static formatDetailSections(sections: DetailRow[][]): string {
        return formatDetailSections(sections);
    }

    /** @private */
    private static formatServerStatus(server: ActiveServer): string {
        return server.status.charAt(0).toUpperCase() + server.status.slice(1);
    }

    /** @private */
    private static formatCertMode(certMode: ActiveServer['certMode']): string {
        switch (certMode) {
            case 'https-default':
                return 'HTTPS (self-signed)';
            case 'https-custom':
                return 'HTTPS (custom certificate)';
            default:
                return 'HTTP';
        }
    }

    /** @private */
    private static formatRemoteStatus(
        state: NonNullable<ActiveServer['remoteAccess']>,
        withPending = true,
    ): string {
        if (state.status === 'error') {
            return `Error · ${state.error || 'tunnel failed'}`;
        }
        if (state.status === 'starting') {
            return 'Starting...';
        }
        if (state.status === 'shared') {
            return withPending && state.pendingRequests > 0
                ? `Shared · ${this.formatPendingRequests(state.pendingRequests)}`
                : 'Shared';
        }
        return 'Not shared';
    }

    /** @private */
    private static formatPendingRequests(count: number): string {
        if (count === 0) {
            return 'None';
        }
        return count === 1 ? '1 request waiting' : `${count} requests waiting`;
    }

    /**
     * Keep long paths readable: leading segments collapse into an ellipsis.
     * @private
     */
    private static shortenPath(value: string, keepSegments = 2): string | undefined {
        if (!value) {
            return undefined;
        }
        const segments = value.split(/[\\/]/).filter(Boolean);
        if (segments.length <= keepSegments) {
            return value;
        }
        return `…${path.sep}${segments.slice(-keepSegments).join(path.sep)}`;
    }

    /** @private */
    private static formatDuration(milliseconds: number): string {
        return formatDuration(milliseconds);
    }
}
