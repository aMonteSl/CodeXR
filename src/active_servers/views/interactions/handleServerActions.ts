import * as vscode from 'vscode';
import { ActiveServer } from '../../model/activeServerModel';
import { getActiveServerRegistry } from '../../registry/activeServerRegistry';
import { ServerControl } from '../../runtime/serverControl';
import { PreviewRenderer } from '../../../servers/runtime/previewRenderer';
import { NetworkUtils } from '../../../servers/utils/networkUtils';
import { RemoteAccessManager } from '../../../remote_access';

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
        vscode.window.showInformationMessage(`Direccion de red copiada: ${lanUrl}`);
    }

    public static async startRemoteAccess(serverId: string): Promise<void> {
        const manager = RemoteAccessManager.getInstance();
        if (!manager) {
            throw new Error('El gestor de acceso remoto no está inicializado.');
        }
        const state = await manager.startSharing(serverId);
        if (state.status === 'shared' && state.invitationUrl) {
            await vscode.env.clipboard.writeText(state.invitationUrl);
            vscode.window.showInformationMessage(
                'Servidor compartido mediante Cloudflare. El enlace de invitación se ha copiado al portapapeles.',
            );
        }
    }

    public static async copyRemoteInvitation(serverId: string): Promise<void> {
        const manager = RemoteAccessManager.getInstance();
        if (!manager) {
            throw new Error('El gestor de acceso remoto no está inicializado.');
        }
        await manager.copyInvitation(serverId);
    }

    public static async stopRemoteAccess(serverId: string): Promise<void> {
        const manager = RemoteAccessManager.getInstance();
        if (!manager) {
            throw new Error('El gestor de acceso remoto no está inicializado.');
        }
        await manager.stopSharing(serverId);
    }

    public static async showRemoteStatus(serverId: string): Promise<void> {
        const state = getActiveServerRegistry().getServer(serverId)?.remoteAccess;
        const detail = state
            ? [
                `Estado: ${state.status}`,
                `Solicitudes pendientes: ${state.pendingRequests}`,
                state.publicUrl ? `URL pública: ${state.publicUrl}` : '',
                state.error ? `Error: ${state.error}` : '',
            ].filter(Boolean).join('\n')
            : 'Estado: detenido';
        await vscode.window.showInformationMessage('Acceso remoto de CodeXR', { modal: true, detail });
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
            `Server Information - ${server.url}`,
            { modal: true, detail: details }
        );
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

        if (server.remoteAccess?.status === 'shared' || server.remoteAccess?.status === 'starting') {
            actions.push(
                {
                    label: 'Copiar invitación remota',
                    description: 'Copiar el enlace temporal protegido',
                    action: 'copyRemoteInvitation',
                },
                {
                    label: 'Estado remoto',
                    description: 'Ver solicitudes pendientes y estado del túnel',
                    action: 'remoteStatus',
                },
                {
                    label: 'Detener conexión remota',
                    description: 'Cerrar el túnel y revocar las sesiones remotas',
                    action: 'stopRemoteAccess',
                },
            );
        } else {
            actions.push({
                label: 'Iniciar conexión remota',
                description: 'Publicar temporalmente mediante Cloudflare Quick Tunnel',
                action: 'startRemoteAccess',
            });
            if (server.remoteAccess?.status === 'error') {
                actions.push({
                    label: 'Ver error remoto',
                    description: server.remoteAccess.error || 'Error de túnel',
                    action: 'remoteStatus',
                });
            }
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
        const uptimeMs = Date.now() - server.timestamp;
        const uptime = this.formatUptime(uptimeMs);
        
        let details = '';
        details += `URL: ${server.url}\\n`;
        details += `Port: ${server.port}\\n`;
        details += `Status: ${server.status}\\n`;
        details += `Security: ${server.certMode.toUpperCase()}\\n`;
        details += `Launch Mode: ${server.launchMode}\\n`;
        details += `Uptime: ${uptime}\\n`;
        
        if (server.htmlFile) {
            const fileName = server.htmlFile.split('/').pop() || server.htmlFile;
            details += `Serving File: ${fileName}\\n`;
        }
        
        if (server.metadata) {
            if (server.metadata.host) {
                details += `Host: ${server.metadata.host}\\n`;
            }
            if (server.metadata.staticRoot) {
                details += `Static Root: ${server.metadata.staticRoot}\\n`;
            }
            if (server.metadata.description) {
                details += `Description: ${server.metadata.description}\\n`;
            }
        }
        
        return details;
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
