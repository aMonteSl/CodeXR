import * as vscode from 'vscode';
import * as path from 'path';
import { HttpServer } from './httpServer';
import { HttpsDefaultServer } from './httpsDefaultServer';
import { HttpsCustomServer } from './httpsCustomServer';
import { PortManager } from './portManager';
import { ServerSettingsManager, ServerSettings } from '../storage/serverSettingsManager';
import { getActiveServerRegistry } from '../../active_servers/registry/activeServerRegistry';
import { LaunchMode, CertMode } from '../../active_servers/model/activeServerModel';
import { ServerActionHandlers } from '../../active_servers/views/interactions/handleServerActions';
import { getServerRegistrar } from '../../active_servers/services/serverRegistrar';
import { NetworkUtils } from '../utils/networkUtils';

/**
 * Server types supported by the launcher
 */
export type ServerType = 'http' | 'https-default' | 'https-custom';

/**
 * Server instance type for the running server
 */
export type ServerInstance = HttpServer | HttpsDefaultServer | HttpsCustomServer;

/**
 * Launch result interface (consolidated from launcher.ts)
 */
export interface LaunchResult {
    success: boolean;
    serverUrl?: string;
    serverType?: ServerType;
    error?: string;
    port?: number;
    httpsOverridden?: boolean; // Indicates if HTTPS was overridden to HTTP for lateral panel compatibility
}

/**
 * Multi-server launch result interface
 */
export interface MultiServerLaunchResult {
    success: boolean;
    serverUrl?: string;
    serverType?: ServerType;
    serverId?: string;
    error?: string;
    port?: number;
    httpsOverridden?: boolean;
    portChanged?: boolean;
    originalPort?: number;
}

/**
 * Running server info
 */
interface RunningServerInfo {
    id: string;
    server: ServerInstance;
    serverType: ServerType;
    port: number;
    htmlFile?: string;
    activeServerId: string;
}

/**
 * Multi-Server Launcher
 * Manages multiple HTTP/HTTPS servers running concurrently with dynamic port allocation
 */
export class MultiServerLauncher {
    private servers: Map<string, RunningServerInfo> = new Map();
    private settingsManager: ServerSettingsManager;

    constructor(private context: vscode.ExtensionContext) {
        this.settingsManager = ServerSettingsManager.getInstance(context);
        console.log('SERVER: Multi-server launcher initialized');
    }

    /**
     * Launch a new server instance with dynamic port allocation
     * @param htmlFile Optional HTML file to serve
     * @param customName Optional custom display name for the server
     * @returns Promise<MultiServerLaunchResult>
     */
    public async launchServer(htmlFile?: string, customName?: string, additionalMetadata?: Record<string, any>): Promise<MultiServerLaunchResult> {
        try {
            console.log('SERVER: Starting multi-server launch process...');
            console.log('SERVER: launchServer called with parameters:', { htmlFile, customName });

            // Load current settings
            await this.settingsManager.ensureInitialized();
            const settings = this.settingsManager.getServerSettings();
            console.log('SERVER: Loaded settings:', {
                ...settings,
                https: settings.https ? {
                    ...settings.https,
                    certPath: settings.https.certPath ? '***REDACTED***' : undefined,
                    keyPath: settings.https.keyPath ? '***REDACTED***' : undefined
                } : undefined
            });

            // Check for HTTPS + lateral panel conflict and handle appropriately
            const serverTypeResult = this.checkAndHandleLateralPanelHttpsConflict(settings);
            const serverType = serverTypeResult.serverType;
            const isHttpsOverridden = serverTypeResult.isOverridden;

            console.log('SERVER: Determined server type:', serverType);
            if (isHttpsOverridden) {
                console.log('SERVER: *** IMPORTANT *** Temporarily overriding HTTPS to HTTP for lateral panel compatibility');
            }

            // Find available port using dynamic allocation
            const requestedPort = settings.defaultPort;
            const finalPort = await this.findAvailablePortWithLogging(requestedPort);
            const portChanged = finalPort !== requestedPort;

            if (portChanged) {
                console.log(`SERVER: Port ${requestedPort} already in use. Using port ${finalPort} instead.`);
                vscode.window.showInformationMessage(
                    `Port ${requestedPort} was busy, launching server on port ${finalPort} instead.`
                );
            } else {
                console.log(`SERVER: Using requested port ${finalPort}`);
            }

            // Launch the server - Use 0.0.0.0 to listen on all network interfaces for external access
            const host = '0.0.0.0';
            console.log(`SERVER: DEBUG - Configuring server to listen on ${host}:${finalPort} for network access`);
            const result = await this.launchServerByType(serverType, settings, finalPort, host, htmlFile);
            
            if (result.success && result.serverUrl) {
                console.log(`SERVER: Successfully launched ${serverType} server on port ${finalPort}`);
                
                // Generate unique server ID
                const serverId = this.generateServerId();
                
                // Store server info
                const serverInfo: RunningServerInfo = {
                    id: serverId,
                    server: result.serverInstance!,
                    serverType: serverType,
                    port: finalPort,
                    htmlFile: htmlFile,
                    activeServerId: ''
                };

                // Register server in active servers registry
                try {
                    const launchMode: LaunchMode = this.determineLaunchMode(settings);
                    const certMode: CertMode = this.determineCertMode(serverType, result.httpsOverridden);
                    
                    console.log('SERVER:  DEBUG - About to register server with the following details:');
                    console.log('SERVER:  DEBUG - customName:', customName);
                    console.log('SERVER:  DEBUG - port:', finalPort);
                    console.log('SERVER:  DEBUG - url:', result.serverUrl);
                    
                    const registrar = getServerRegistrar();
                    const activeServer = registrar.registerServer({
                        port: finalPort,
                        url: result.serverUrl,
                        launchMode: launchMode,
                        certMode: certMode,
                        timestamp: Date.now(),
                        htmlFile: htmlFile,
                        customName: customName,
                        serverInstance: result.serverInstance,
                        metadata: {
                            serverType: serverType,
                            originalPort: requestedPort,
                            portChanged: portChanged,
                            httpsOverridden: isHttpsOverridden,
                            launcherId: 'multi-server',
                            serverInstanceId: serverId,
                            ...additionalMetadata // Add any additional metadata passed in
                        }
                    });
                    
                    console.log('SERVER:  Successfully registered server with registry:');
                    console.log('SERVER:  Registered server ID:', activeServer.id);
                    console.log('SERVER:  Registered server customName:', activeServer.customName);
                    
                    serverInfo.activeServerId = activeServer.id;
                    this.servers.set(serverId, serverInfo);
                    
                    console.log(`SERVER: Successfully registered server ${serverId} (active ID: ${activeServer.id}) via registrar service`);
                    console.log(`SERVER: Currently managing ${this.servers.size} server(s)`);
                    
                    // Handle auto-opening based on configuration
                    await this.handleAutoOpening(settings, result.serverUrl, htmlFile, launchMode, serverInfo.activeServerId);
                    
                } catch (error) {
                    console.error('SERVER: Failed to register server in registry:', error);
                    // Don't fail the launch if registry registration fails
                }

                return {
                    success: true,
                    serverUrl: result.serverUrl,
                    serverType: serverType,
                    serverId: serverId,
                    port: finalPort,
                    httpsOverridden: isHttpsOverridden,
                    portChanged: portChanged,
                    originalPort: requestedPort
                };
            } else {
                return {
                    success: false,
                    error: result.error || 'Unknown server launch error',
                    httpsOverridden: isHttpsOverridden
                };
            }

        } catch (error) {
            console.error('SERVER: Error during multi-server launch:', error);
            return {
                success: false,
                error: `Failed to launch server: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Stop a specific server by ID
     * @param serverId Server ID to stop
     * @returns Promise<boolean>
     */
    public async stopServer(serverId: string): Promise<boolean> {
        const serverInfo = this.servers.get(serverId);
        if (!serverInfo) {
            console.log(`SERVER: Server ${serverId} not found or already stopped`);
            return true;
        }

        try {
            console.log(`SERVER: Stopping server ${serverId} (${serverInfo.serverType}) on port ${serverInfo.port}...`);
            await serverInfo.server.stop();
            
            // Unregister from active servers registry
            if (serverInfo.activeServerId) {
                try {
                    const registry = getActiveServerRegistry();
                    registry.unregisterServer(serverInfo.activeServerId);
                    console.log(`SERVER: Unregistered server ${serverInfo.activeServerId} from registry`);
                } catch (error) {
                    console.error('SERVER: Failed to unregister server from registry:', error);
                }
            }
            
            this.servers.delete(serverId);
            console.log(`SERVER: Server ${serverId} stopped successfully. ${this.servers.size} server(s) remaining`);
            return true;
        } catch (error) {
            console.error(`SERVER: Error stopping server ${serverId}:`, error);
            return false;
        }
    }

    /**
     * Stop all running servers
     * @returns Promise<boolean>
     */
    public async stopAllServers(): Promise<boolean> {
        console.log(`SERVER: Stopping all ${this.servers.size} servers...`);
        
        const stopPromises = Array.from(this.servers.keys()).map(serverId => 
            this.stopServer(serverId)
        );
        
        const results = await Promise.all(stopPromises);
        const allStopped = results.every(result => result === true);
        
        if (allStopped) {
            console.log('SERVER: All servers stopped successfully');
        } else {
            console.error('SERVER: Some servers failed to stop properly');
        }
        
        return allStopped;
    }

    /**
     * Get information about all running servers
     * @returns Array of server info
     */
    public getRunningServers(): Array<{
        id: string;
        serverType: ServerType;
        port: number;
        htmlFile?: string;
        isRunning: boolean;
    }> {
        return Array.from(this.servers.values()).map(serverInfo => ({
            id: serverInfo.id,
            serverType: serverInfo.serverType,
            port: serverInfo.port,
            htmlFile: serverInfo.htmlFile,
            isRunning: serverInfo.server.getIsRunning()
        }));
    }

    /**
     * Check if any servers are running
     * @returns boolean
     */
    public hasRunningServers(): boolean {
        return this.servers.size > 0;
    }

    /**
     * Get count of running servers
     * @returns number
     */
    public getRunningServerCount(): number {
        return this.servers.size;
    }

    /**
     * Find available port with enhanced logging
     * @private
     */
    private async findAvailablePortWithLogging(requestedPort: number): Promise<number> {
        console.log(`SERVER: Checking availability of port ${requestedPort}...`);
        
        const isAvailable = await PortManager.isPortAvailable(requestedPort);
        if (isAvailable) {
            console.log(`SERVER: Port ${requestedPort} is available`);
            return requestedPort;
        }

        console.log(`SERVER: Port ${requestedPort} already in use. Searching for next available port (${requestedPort + 1})...`);
        
        try {
            const availablePort = await PortManager.findAvailablePort(requestedPort + 1);
            console.log(`SERVER: Free port found at ${availablePort}. Launching server...`);
            return availablePort;
        } catch (error) {
            console.error(`SERVER: Failed to find available port starting from ${requestedPort + 1}:`, error);
            throw new Error(`No available ports found starting from ${requestedPort}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Generate unique server ID
     * @private
     */
    private generateServerId(): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 5);
        return `server_${timestamp}_${random}`;
    }

    /**
     * Determine server type based on settings
     * @private
     */
    private determineServerType(settings: ServerSettings): ServerType {
        if (settings.mode === 'HTTP') {
            return 'http';
        } else if (settings.mode === 'HTTPS') {
            return settings.https.certSource === 'default' ? 'https-default' : 'https-custom';
        }
        
        throw new Error(`Invalid server mode: ${settings.mode}`);
    }

    /**
     * Determine launch mode based on settings
     * @private
     */
    private determineLaunchMode(settings: ServerSettings): LaunchMode {
        return settings.launch.openMode === 'lateralPanel' ? 'lateralPanel' as LaunchMode : 'browser' as LaunchMode;
    }

    /**
     * Determine certificate mode based on server type and overrides
     * @private
     */
    private determineCertMode(serverType: ServerType, httpsOverridden?: boolean): CertMode {
        if (httpsOverridden) {
            return 'http';
        }
        
        switch (serverType) {
            case 'http':
                return 'http';
            case 'https-default':
                return 'https-default';
            case 'https-custom':
                return 'https-custom';
            default:
                return 'http';
        }
    }

    /**
     * Launch server by type - delegates to existing server implementations
     * @private
     */
    private async launchServerByType(
        serverType: ServerType,
        settings: ServerSettings,
        port: number,
        host: string,
        htmlFile?: string
    ): Promise<{
        success: boolean;
        serverUrl?: string;
        serverType?: ServerType;
        port?: number;
        error?: string;
        httpsOverridden?: boolean;
        serverInstance?: ServerInstance;
    }> {
        try {
            let server: ServerInstance;
            let serverUrl: string;

            // Default server configuration
            const staticRoot = htmlFile ? path.dirname(htmlFile) : path.join(__dirname, '../../../templates');
            const mainFile = htmlFile ? path.basename(htmlFile) : undefined;
            const enableCors = true;
            const allowedOrigins = ['*'];

            console.log(`SERVER: Using static root: ${staticRoot}`);
            if (mainFile) {
                console.log(`SERVER: Main file configured: ${mainFile}`);
            }

            switch (serverType) {
                case 'http':
                    console.log('SERVER: Creating HTTP server...');
                    server = new HttpServer({
                        port,
                        host,
                        staticRoot,
                        enableCors,
                        allowedOrigins,
                        mainFile
                    });
                    break;

                case 'https-default':
                    console.log('SERVER: Creating HTTPS server with default certificates...');
                    server = new HttpsDefaultServer({
                        port,
                        host,
                        staticRoot,
                        enableCors,
                        allowedOrigins,
                        mainFile,
                        extensionContext: this.context
                    });
                    break;

                case 'https-custom':
                    console.log('SERVER: Creating HTTPS server with custom certificates...');
                    if (!settings.https?.certPath || !settings.https.keyPath) {
                        throw new Error('Custom certificate paths are required for custom HTTPS server');
                    }
                    server = new HttpsCustomServer({
                        port,
                        host,
                        staticRoot,
                        enableCors,
                        allowedOrigins,
                        mainFile,
                        certPath: settings.https.certPath,
                        keyPath: settings.https.keyPath,
                        extensionContext: this.context
                    });
                    break;

                default:
                    throw new Error(`Unsupported server type: ${serverType}`);
            }

            // Start the server
            console.log(`SERVER: Starting ${serverType} server...`);
            serverUrl = await server.start();

            return {
                success: true,
                serverUrl,
                serverType,
                port,
                serverInstance: server
            };

        } catch (error) {
            console.error(`SERVER: Error launching ${serverType} server:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                serverType
            };
        }
    }

    /**
     * Check for lateral panel + HTTPS conflict and provide fallback
     * @private
     * @param settings - Server settings
     * @returns Modified server type if fallback needed, original type otherwise
     */
    private checkAndHandleLateralPanelHttpsConflict(settings: ServerSettings): {
        serverType: ServerType;
        isOverridden: boolean;
    } {
        const originalServerType = this.determineServerType(settings);
        
        // Check if we have lateral panel + HTTPS combination
        const isLateralPanel = settings.launch.openMode === 'lateralPanel';
        const isHttps = originalServerType === 'https-default' || originalServerType === 'https-custom';
        
        if (isLateralPanel && isHttps) {
            console.log('SERVER: HTTPS + Lateral Panel conflict detected - overriding to HTTP for compatibility');
            console.log(`SERVER: Original server type would have been: ${originalServerType}`);
            console.log('SERVER: VS Code webview panels do not support HTTPS content, using HTTP fallback');
            
            // Show non-blocking warning to user with actionable information
            vscode.window.showWarningMessage(
                'Launching in HTTP mode due to VS Code limitations: lateral panel views do not support HTTPS content. Use browser mode to preserve HTTPS.',
                'Change to Browser Mode'
            ).then(action => {
                if (action === 'Change to Browser Mode') {
                    // Open the configuration to change open mode
                    vscode.commands.executeCommand('codexr.server.config.openMode');
                }
            });
            
            return {
                serverType: 'http',
                isOverridden: true
            };
        }
        
        return {
            serverType: originalServerType,
            isOverridden: false
        };
    }

    /**
     * Handle auto-opening based on configuration
     * @private
     */
    private async handleAutoOpening(
        settings: ServerSettings, 
        serverUrl: string, 
        htmlFile: string | undefined, 
        launchMode: LaunchMode, 
        activeServerId: string
    ): Promise<void> {
        const isAutoOpenEnabled = settings.launch.autoOpen;
        
        console.log(`SERVER: Auto-open configuration: enabled=${isAutoOpenEnabled}, mode=${launchMode}`);
        
        if (!isAutoOpenEnabled) {
            console.log('SERVER: Auto-open is disabled, showing success notification only');
            
            // Extract port from serverUrl to generate network URLs
            const portMatch = serverUrl.match(/:(\d+)/);
            const port = portMatch ? parseInt(portMatch[1]) : null;
            const protocol = serverUrl.startsWith('https') ? 'https' : 'http';
            
            let notificationMessage = `Server launched successfully on ${serverUrl}`;
            
            // Add network access information if port is available
            if (port) {
                const localIP = NetworkUtils.getLocalIPAddress();
                if (localIP !== 'localhost') {
                    const networkUrl = `${protocol}://${localIP}:${port}`;
                    notificationMessage = `Server launched successfully! Network: ${networkUrl} Local: ${serverUrl}`;
                    console.log(`SERVER: Network access URL: ${networkUrl}`);
                }
            }
            
            vscode.window.showInformationMessage(
                notificationMessage,
                'Open Now', 'Copy Network URL'
            ).then(action => {
                if (action === 'Open Now') {
                    // Use the active server action handler to respect the configured mode
                    if (launchMode === 'browser') {
                        this.openServerInBrowser(activeServerId);
                    } else {
                        this.openServerInPanel(activeServerId);
                    }
                } else if (action === 'Copy Network URL' && port) {
                    const localIP = NetworkUtils.getLocalIPAddress();
                    if (localIP !== 'localhost') {
                        const networkUrl = `${protocol}://${localIP}:${port}`;
                        vscode.env.clipboard.writeText(networkUrl);
                        vscode.window.showInformationMessage('Network URL copied to clipboard');
                    }
                }
            });
            return;
        }
        
        console.log(`SERVER: Auto-opening server in ${launchMode} mode`);
        
        try {
            // Auto-open using the configured launch mode
            if (launchMode === 'browser') {
                await this.openServerInBrowser(activeServerId);
            } else {
                await this.openServerInPanel(activeServerId);
            }
        } catch (error) {
            console.error('SERVER: Error during auto-opening:', error);
            vscode.window.showWarningMessage(
                `Server launched but failed to auto-open: ${error instanceof Error ? error.message : String(error)}`,
                'Open Manually'
            ).then(action => {
                if (action === 'Open Manually') {
                    if (launchMode === 'browser') {
                        this.openServerInBrowser(activeServerId);
                    } else {
                        this.openServerInPanel(activeServerId);
                    }
                }
            });
        }
    }

    /**
     * Open server in browser using shared handler
     * @private
     */
    private async openServerInBrowser(activeServerId: string): Promise<void> {
        console.log(`SERVER: Opening server ${activeServerId} in browser via shared handler`);
        try {
            await ServerActionHandlers.openInBrowser(activeServerId);
        } catch (error) {
            console.error(`SERVER: Failed to open server in browser: ${error}`);
            throw error;
        }
    }

    /**
     * Open server in lateral panel using shared handler
     * @private
     */
    private async openServerInPanel(activeServerId: string): Promise<void> {
        console.log(`SERVER: Opening server ${activeServerId} in lateral panel via shared handler`);
        try {
            await ServerActionHandlers.openInPanel(activeServerId);
        } catch (error) {
            console.error(`SERVER: Failed to open server in lateral panel: ${error}`);
            throw error;
        }
    }
}
