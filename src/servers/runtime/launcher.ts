import * as vscode from 'vscode';
import * as path from 'path';
import { HttpServer } from './httpServer';
import { HttpsDefaultServer } from './httpsDefaultServer';
import { HttpsCustomServer } from './httpsCustomServer';
import { PortManager } from './portManager';
import { ServerSettingsManager, ServerSettings } from '../storage/serverSettingsManager';
import { getActiveServerRegistry } from '../../active_servers/registry/activeServerRegistry';
import { LaunchMode, CertMode } from '../../active_servers/model/activeServerModel';
import { getServerRegistrar } from '../../active_servers/services/serverRegistrar';

/**
 * Server types supported by the launcher
 */
export type ServerType = 'http' | 'https-default' | 'https-custom';

/**
 * Server instance type for the running server
 */
export type ServerInstance = HttpServer | HttpsDefaultServer | HttpsCustomServer;

/**
 * Launch result interface
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
 * Server Launcher
 * Main entry point for launching HTTP/HTTPS servers based on saved settings
 */
export class ServerLauncher {
    private currentServer: ServerInstance | null = null;
    private currentServerType: ServerType | null = null;
    private settingsManager: ServerSettingsManager;
    private currentHtmlFile: string | null = null; // Track the current HTML file being served
    private activeServerId: string | null = null; // Track the active server ID in registry
    private currentCustomName: string | null = null; // Track the custom name for server registration

    constructor(context: vscode.ExtensionContext) {
        this.settingsManager = ServerSettingsManager.getInstance(context);
        
        console.log('SERVER: Server launcher initialized');
    }

    /**
     * Launch server based on current settings
     * @returns Promise<LaunchResult>
     */
    public async launchServer(): Promise<LaunchResult> {
        try {
            // Stop any existing server first
            if (this.currentServer) {
                await this.stopServer();
            }

            console.log('SERVER: Starting server launch process...');

            // Load current settings
            const settings = this.settingsManager.getServerSettings();
            console.log('SERVER: Loaded settings:', {
                ...settings,
                https: settings.https ? {
                    ...settings.https,
                    certPath: settings.https.certPath ? '***REDACTED***' : undefined,
                    keyPath: settings.https.keyPath ? '***REDACTED***' : undefined
                } : undefined
            });

            // Determine server type based on settings
            const serverType = this.determineServerType(settings);
            console.log('SERVER: Determined server type:', serverType);

            // Check port availability and find alternative if needed
            const port = settings.defaultPort;
            const host = 'localhost'; // Default host
            let finalPort = port;
            const isPortAvailable = await PortManager.isPortAvailable(port);
            if (!isPortAvailable) {
                console.log(`SERVER: Port ${port} is already in use, finding alternative...`);
                try {
                    finalPort = await PortManager.findAvailablePort(port);
                    console.log(`SERVER: Found available port: ${finalPort}`);
                    vscode.window.showInformationMessage(
                        `Port ${port} was busy, using port ${finalPort} instead.`
                    );
                } catch (error) {
                    console.error(`SERVER: Could not find available port: ${error}`);
                    return {
                        success: false,
                        error: `Port ${port} is in use and no alternative ports available: ${error instanceof Error ? error.message : String(error)}`
                    };
                }
            }

        // Launch the appropriate server type
        const result = await this.launchServerByType(serverType, settings, finalPort, host);
        
        if (result.success) {
            this.currentServerType = serverType;
            console.log(`SERVER: Successfully launched ${serverType} server`);
            
            // Register server in active servers registry
            try {
                const launchMode: LaunchMode = this.determineLaunchMode(settings);
                const certMode: CertMode = this.determineCertMode(serverType, result.httpsOverridden);
                
                const registrar = getServerRegistrar();
                const activeServer = registrar.registerServer({
                    port: finalPort,
                    url: result.serverUrl!,
                    launchMode: launchMode,
                    certMode: certMode,
                    timestamp: Date.now(),
                    htmlFile: this.currentHtmlFile || undefined,
                    customName: this.currentCustomName || undefined,
                    serverInstance: this.currentServer,
                    metadata: {
                        serverType: serverType,
                        originalPort: port,
                        portChanged: finalPort !== port,
                        httpsOverridden: result.httpsOverridden || false
                    }
                });
                
                this.activeServerId = activeServer.id;
                console.log(`SERVER: Successfully registered server ${activeServer.id} via registrar service`);
            } catch (error) {
                console.error('SERVER: Failed to register server via registrar service:', error);
                // Don't fail the launch if registry registration fails
            }
        }

            return result;

        } catch (error) {
            console.error('SERVER: Error during server launch:', error);
            return {
                success: false,
                error: `Failed to launch server: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Stop the currently running server
     * @returns Promise<boolean> - True if server was stopped or wasn't running
     */
    public async stopServer(): Promise<boolean> {
        if (!this.currentServer) {
            console.log('SERVER: No server is currently running');
            return true;
        }

        try {
            console.log(`SERVER: Stopping ${this.currentServerType} server...`);
            await this.currentServer.stop();
            
            // Unregister from active servers registry
            if (this.activeServerId) {
                try {
                    const registry = getActiveServerRegistry();
                    registry.unregisterServer(this.activeServerId);
                    console.log(`ACTIVE_SERVERS: Unregistered server ${this.activeServerId} from registry`);
                } catch (error) {
                    console.error('ACTIVE_SERVERS: Failed to unregister server from registry:', error);
                }
                this.activeServerId = null;
            }
            
            this.currentServer = null;
            this.currentServerType = null;
            
            console.log('SERVER: Server stopped successfully');
            return true;
        } catch (error) {
            console.error('SERVER: Error stopping server:', error);
            return false;
        }
    }

    /**
     * Check if a server is currently running
     * @returns boolean
     */
    public isServerRunning(): boolean {
        return this.currentServer !== null && this.currentServer.getIsRunning();
    }

    /**
     * Get current server information
     * @returns object with server details or null
     */
    public getCurrentServerInfo(): {
        type: ServerType;
        url: string | null;
        isRunning: boolean;
        config: any;
    } | null {
        if (!this.currentServer || !this.currentServerType) {
            return null;
        }

        return {
            type: this.currentServerType,
            url: this.currentServer.getServerUrl(),
            isRunning: this.currentServer.getIsRunning(),
            config: this.currentServer.getConfig()
        };
    }

    /**
     * Get the currently configured HTML file
     * @returns string | undefined - Path to current HTML file
     */
    public getCurrentHtmlFile(): string | undefined {
        return this.currentHtmlFile || undefined;
    }

    /**
     * Get detailed server status
     * @returns object with comprehensive server information
     */
    public async getDetailedStatus(): Promise<{
        isRunning: boolean;
        server?: {
            type: ServerType;
            url: string | null;
            config: any;
            uptime?: number;
        };
        settings: ServerSettings;
        portInfo?: {
            currentPort: number;
            isAvailable: boolean;
            suggestedPorts?: number[];
        };
    }> {
        const settings = this.settingsManager.getServerSettings();
        const status: any = {
            isRunning: this.isServerRunning(),
            settings
        };

        if (this.currentServer && this.currentServerType) {
            status.server = {
                type: this.currentServerType,
                url: this.currentServer.getServerUrl(),
                config: this.currentServer.getConfig(),
                uptime: this.isServerRunning() ? process.uptime() : undefined
            };
        }

        // Add port information
        const port = settings.defaultPort;
        const isPortAvailable = await PortManager.isPortAvailable(port);
        status.portInfo = {
            currentPort: port,
            isAvailable: isPortAvailable
        };

        if (!isPortAvailable) {
            status.portInfo.suggestedPorts = await PortManager.findMultipleAvailablePorts(3, port);
        }

        return status;
    }

    /**
     * Test certificates without starting server
     * @returns Promise<object> with test results
     */
    public async testCertificates(): Promise<{
        defaultCerts: { isValid: boolean; error?: string };
        customCerts?: { isValid: boolean; error?: string };
    }> {
        const settings = this.settingsManager.getServerSettings();
        const results: any = {};

        // Test default certificates
        try {
            const defaultServer = new HttpsDefaultServer({
                port: 0, // Dummy port for testing
                host: 'localhost'
            });
            results.defaultCerts = {
                isValid: await defaultServer.testCertificates()
            };
        } catch (error) {
            results.defaultCerts = {
                isValid: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }

        // Test custom certificates if configured
        if (settings.https?.certSource === 'custom' && 
            settings.https.certPath && settings.https.keyPath) {
            try {
                const customServer = new HttpsCustomServer({
                    port: 0, // Dummy port for testing
                    host: 'localhost',
                    certPath: settings.https.certPath,
                    keyPath: settings.https.keyPath
                });
                results.customCerts = {
                    isValid: await customServer.testCertificates()
                };
            } catch (error) {
                results.customCerts = {
                    isValid: false,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        }

        return results;
    }

    /**
     * Restart the server with current settings
     * @returns Promise<LaunchResult>
     */
    public async restartServer(): Promise<LaunchResult> {
        console.log('SERVER: Restarting server...');
        
        if (this.isServerRunning()) {
            await this.stopServer();
        }

        return this.launchServer();
    }

    /**
     * Launch server with specific port (temporary override)
     * @param port - Port number to use
     * @returns Promise<LaunchResult>
     */
    public async launchWithPort(port: number): Promise<LaunchResult> {
        try {
            // Validate port
            if (port < 1 || port > 65535) {
                return {
                    success: false,
                    error: `Invalid port number: ${port}. Port must be between 1 and 65535.`
                };
            }

            // Stop any existing server first
            if (this.currentServer) {
                await this.stopServer();
            }

            console.log(`SERVER: Launching server with specific port: ${port}`);

            // Get current settings and temporarily override the port
            const settings = this.settingsManager.getServerSettings();
            
            // Check if port is available
            const isAvailable = await PortManager.isPortAvailable(port);
            if (!isAvailable) {
                return {
                    success: false,
                    error: `Port ${port} is already in use or not available.`
                };
            }

            // Determine server type based on settings
            const serverType = this.determineServerType(settings);
            console.log('SERVER: Determined server type:', serverType);

            const host = 'localhost';
            
            // Launch server using existing method with custom port
            const result = await this.launchServerByType(serverType, settings, port, host);
            
            if (result.success && result.serverUrl) {
                // Update server type tracking
                this.currentServerType = serverType;
                
                // Register active server
                const launchMode = this.determineLaunchMode(settings);
                const certMode = this.determineCertMode(serverType);
                
                console.log(`SERVER: About to register server with customName: ${this.currentCustomName}`);
                
                const registrar = getServerRegistrar();
                const activeServer = registrar.registerServer({
                    port: port,
                    url: result.serverUrl,
                    launchMode: launchMode,
                    certMode: certMode,
                    timestamp: Date.now(),
                    customName: this.currentCustomName || undefined,
                    serverInstance: this.currentServer,
                    metadata: {
                        host: host,
                        description: `Manual launch with port ${port}`
                    }
                });

                this.activeServerId = activeServer.id;
                console.log(`SERVER: Successfully registered server ${activeServer.id} via registrar service`);
            }

            return result;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            console.error('SERVER: Error launching server with port:', errorMessage);
            return {
                success: false,
                error: `Failed to launch server with port ${port}: ${errorMessage}`
            };
        }
    }

    /**
     * Launch server with specific HTML file (temporary override)
     * @param htmlFilePath - Path to HTML file to serve
     * @param customName - Optional custom display name for the server
     * @returns Promise<LaunchResult>
     */
    public async launchWithHtmlFile(htmlFilePath: string, customName?: string): Promise<LaunchResult> {
        let isHttpsOverridden = false; // Track if HTTPS was overridden
        
        try {
            // Store the custom name for registration
            this.currentCustomName = customName || null;
            console.log(`SERVER: launchWithHtmlFile called with customName: ${customName}`);
            
            // Stop any existing server
            if (this.currentServer) {
                await this.stopServer();
            }

            console.log(`SERVER: Launching server with HTML file: ${htmlFilePath}`);

            // Validate file exists
            if (!require('fs').existsSync(htmlFilePath)) {
                throw new Error(`HTML file not found: ${htmlFilePath}`);
            }

            const settings = this.settingsManager.getServerSettings();
            
            // Check for lateral panel + HTTPS conflict and handle appropriately
            const serverTypeResult = this.checkAndHandleLateralPanelHttpsConflict(settings);
            const serverType = serverTypeResult.serverType;
            isHttpsOverridden = serverTypeResult.isOverridden;
            
            if (serverTypeResult.isOverridden) {
                console.log('SERVER: *** IMPORTANT *** Temporarily overriding HTTPS to HTTP for lateral panel compatibility');
                console.log('SERVER: This override does NOT modify your saved configuration');
                console.log('SERVER: Your HTTPS configuration will be preserved for browser mode launches');
            } else {
                console.log(`SERVER: Using configured server type: ${serverType}`);
            }
            
            const port = settings.defaultPort;
            const host = 'localhost';
            
            // Use the directory containing the HTML file as static root
            const fileDirectory = require('path').dirname(htmlFilePath);
            const fileName = require('path').basename(htmlFilePath);

            console.log(`SERVER: Using custom static root: ${fileDirectory}`);
            console.log(`SERVER: Main file: ${fileName}`);

            // Check port availability and find alternative if needed
            let finalPort = port;
            const isPortAvailable = await PortManager.isPortAvailable(port);
            if (!isPortAvailable) {
                console.log(`SERVER: Port ${port} is already in use, finding alternative...`);
                try {
                    finalPort = await PortManager.findAvailablePort(port);
                    console.log(`SERVER: Found available port: ${finalPort}`);
                    vscode.window.showInformationMessage(
                        `Port ${port} was busy, using port ${finalPort} instead.`
                    );
                } catch (error) {
                    console.error(`SERVER: Could not find available port: ${error}`);
                    return {
                        success: false,
                        error: `Port ${port} is in use and no alternative ports available: ${error instanceof Error ? error.message : String(error)}`
                    };
                }
            }

            const result = await this.launchServerByType(serverType, settings, finalPort, host, fileDirectory, fileName);
            
            if (result.success) {
                this.currentServerType = serverType;
                this.currentHtmlFile = htmlFilePath; // Store the HTML file path
                console.log(`SERVER: Successfully launched ${serverType} server with custom file`);
                
                // Register server in active servers registry
                try {
                    const launchMode: LaunchMode = this.determineLaunchMode(settings);
                    const certMode: CertMode = this.determineCertMode(serverType, isHttpsOverridden);
                    
                    console.log(`SERVER: About to register server with customName: ${this.currentCustomName}`);
                    
                    const registrar = getServerRegistrar();
                    const activeServer = registrar.registerServer({
                        port: finalPort,
                        url: result.serverUrl!,
                        launchMode: launchMode,
                        certMode: certMode,
                        timestamp: Date.now(),
                        htmlFile: htmlFilePath,
                        customName: this.currentCustomName || undefined,
                        serverInstance: this.currentServer,
                        metadata: {
                            serverType: serverType,
                            originalPort: port,
                            portChanged: finalPort !== port,
                            httpsOverridden: isHttpsOverridden,
                            htmlFileName: fileName,
                            staticRoot: fileDirectory
                        }
                    });
                    
                    this.activeServerId = activeServer.id;
                    console.log(`SERVER: Successfully registered server ${activeServer.id} via registrar service`);
                } catch (error) {
                    console.error('ACTIVE_SERVERS: Failed to register server in registry:', error);
                    // Don't fail the launch if registry registration fails
                }
                
                // Return the base server URL (the HTML file will be served at root)
                return {
                    ...result,
                    serverUrl: result.serverUrl, // Return base URL, file will be served at root
                    httpsOverridden: isHttpsOverridden // Include override information
                };
            }

            return {
                ...result,
                httpsOverridden: isHttpsOverridden // Include override information even in failure case
            };

        } catch (error) {
            console.error('SERVER: Error launching with HTML file:', error);
            return {
                success: false,
                error: `Failed to launch server: ${error instanceof Error ? error.message : String(error)}`,
                httpsOverridden: isHttpsOverridden // Include override information even in error case
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
     * Determine server type based on settings
     * @private
     */
    private determineServerType(settings: ServerSettings): ServerType {
        if (settings.mode === 'HTTP') {
            return 'http';
        }

        if (settings.https?.certSource === 'custom' && settings.https.certPath && settings.https.keyPath) {
            return 'https-custom';
        }

        return 'https-default';
    }

    /**
     * Launch server by specific type
     * @private
     */
    private async launchServerByType(
        serverType: ServerType, 
        settings: ServerSettings, 
        port: number, 
        host: string,
        customStaticRoot?: string,
        mainFile?: string
    ): Promise<LaunchResult> {
        try {
            let server: ServerInstance;
            let serverUrl: string;

            // Default server configuration
            const staticRoot = customStaticRoot || path.join(__dirname, '../../../templates');
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
                        extensionContext: this.settingsManager.getExtensionContext() // Pass extension context for certificate resolution
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
                        extensionContext: this.settingsManager.getExtensionContext() // Pass extension context for fallback certificates
                    });
                    break;

                default:
                    throw new Error(`Unsupported server type: ${serverType}`);
            }

            // Start the server
            console.log(`SERVER: Starting ${serverType} server...`);
            serverUrl = await server.start();
            
            // Store the running server
            this.currentServer = server;

            return {
                success: true,
                serverUrl,
                serverType,
                port
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
     * Get port suggestions if current port is busy
     * @returns Promise<number[]>
     */
    public async getPortSuggestions(count: number = 3): Promise<number[]> {
        const settings = this.settingsManager.getServerSettings();
        return PortManager.findMultipleAvailablePorts(count, settings.defaultPort);
    }

    /**
     * Check if current settings would trigger HTTPS override for lateral panel
     * @returns boolean - True if override would occur
     */
    public wouldTriggerHttpsOverride(): boolean {
        const settings = this.settingsManager.getServerSettings();
        const isLateralPanel = settings.launch.openMode === 'lateralPanel';
        const originalServerType = this.determineServerType(settings);
        const isHttps = originalServerType === 'https-default' || originalServerType === 'https-custom';
        
        return isLateralPanel && isHttps;
    }

    /**
     * Determine launch mode for active server registry
     * @private
     */
    private determineLaunchMode(settings: ServerSettings): LaunchMode {
        return settings.launch.openMode as LaunchMode;
    }

    /**
     * Determine certificate mode for active server registry
     * @private
     */
    private determineCertMode(serverType: ServerType, httpsOverridden?: boolean): CertMode {
        if (httpsOverridden) {
            return 'http'; // HTTPS was overridden to HTTP
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
     * Cleanup method to be called when extension deactivates
     */
    public async cleanup(): Promise<void> {
        console.log('SERVER: Cleaning up server launcher...');
        
        if (this.currentServer) {
            await this.stopServer();
        }
        
        console.log('SERVER: Server launcher cleanup completed');
    }
}
