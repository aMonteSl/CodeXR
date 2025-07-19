"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerLauncher = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const httpServer_1 = require("./httpServer");
const httpsDefaultServer_1 = require("./httpsDefaultServer");
const httpsCustomServer_1 = require("./httpsCustomServer");
const portManager_1 = require("./portManager");
const serverSettingsManager_1 = require("../storage/serverSettingsManager");
const activeServerRegistry_1 = require("../../active_servers/registry/activeServerRegistry");
const serverRegistrar_1 = require("../../active_servers/services/serverRegistrar");
/**
 * Server Launcher
 * Main entry point for launching HTTP/HTTPS servers based on saved settings
 */
class ServerLauncher {
    currentServer = null;
    currentServerType = null;
    settingsManager;
    currentHtmlFile = null; // Track the current HTML file being served
    activeServerId = null; // Track the active server ID in registry
    currentCustomName = null; // Track the custom name for server registration
    constructor(context) {
        this.settingsManager = serverSettingsManager_1.ServerSettingsManager.getInstance(context);
        console.log('SERVER: Server launcher initialized');
    }
    /**
     * Launch server based on current settings
     * @returns Promise<LaunchResult>
     */
    async launchServer() {
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
            const isPortAvailable = await portManager_1.PortManager.isPortAvailable(port);
            if (!isPortAvailable) {
                console.log(`SERVER: Port ${port} is already in use, finding alternative...`);
                try {
                    finalPort = await portManager_1.PortManager.findAvailablePort(port);
                    console.log(`SERVER: Found available port: ${finalPort}`);
                    vscode.window.showInformationMessage(`Port ${port} was busy, using port ${finalPort} instead.`);
                }
                catch (error) {
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
                    const launchMode = this.determineLaunchMode(settings);
                    const certMode = this.determineCertMode(serverType, result.httpsOverridden);
                    const registrar = (0, serverRegistrar_1.getServerRegistrar)();
                    const activeServer = registrar.registerServer({
                        port: finalPort,
                        url: result.serverUrl,
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
                }
                catch (error) {
                    console.error('SERVER: Failed to register server via registrar service:', error);
                    // Don't fail the launch if registry registration fails
                }
            }
            return result;
        }
        catch (error) {
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
    async stopServer() {
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
                    const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
                    registry.unregisterServer(this.activeServerId);
                    console.log(`ACTIVE_SERVERS: Unregistered server ${this.activeServerId} from registry`);
                }
                catch (error) {
                    console.error('ACTIVE_SERVERS: Failed to unregister server from registry:', error);
                }
                this.activeServerId = null;
            }
            this.currentServer = null;
            this.currentServerType = null;
            console.log('SERVER: Server stopped successfully');
            return true;
        }
        catch (error) {
            console.error('SERVER: Error stopping server:', error);
            return false;
        }
    }
    /**
     * Check if a server is currently running
     * @returns boolean
     */
    isServerRunning() {
        return this.currentServer !== null && this.currentServer.getIsRunning();
    }
    /**
     * Get current server information
     * @returns object with server details or null
     */
    getCurrentServerInfo() {
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
    getCurrentHtmlFile() {
        return this.currentHtmlFile || undefined;
    }
    /**
     * Get detailed server status
     * @returns object with comprehensive server information
     */
    async getDetailedStatus() {
        const settings = this.settingsManager.getServerSettings();
        const status = {
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
        const isPortAvailable = await portManager_1.PortManager.isPortAvailable(port);
        status.portInfo = {
            currentPort: port,
            isAvailable: isPortAvailable
        };
        if (!isPortAvailable) {
            status.portInfo.suggestedPorts = await portManager_1.PortManager.findMultipleAvailablePorts(3, port);
        }
        return status;
    }
    /**
     * Test certificates without starting server
     * @returns Promise<object> with test results
     */
    async testCertificates() {
        const settings = this.settingsManager.getServerSettings();
        const results = {};
        // Test default certificates
        try {
            const defaultServer = new httpsDefaultServer_1.HttpsDefaultServer({
                port: 0, // Dummy port for testing
                host: 'localhost'
            });
            results.defaultCerts = {
                isValid: await defaultServer.testCertificates()
            };
        }
        catch (error) {
            results.defaultCerts = {
                isValid: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
        // Test custom certificates if configured
        if (settings.https?.certSource === 'custom' &&
            settings.https.certPath && settings.https.keyPath) {
            try {
                const customServer = new httpsCustomServer_1.HttpsCustomServer({
                    port: 0, // Dummy port for testing
                    host: 'localhost',
                    certPath: settings.https.certPath,
                    keyPath: settings.https.keyPath
                });
                results.customCerts = {
                    isValid: await customServer.testCertificates()
                };
            }
            catch (error) {
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
    async restartServer() {
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
    async launchWithPort(port) {
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
            const isAvailable = await portManager_1.PortManager.isPortAvailable(port);
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
                const registrar = (0, serverRegistrar_1.getServerRegistrar)();
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
        }
        catch (error) {
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
    async launchWithHtmlFile(htmlFilePath, customName) {
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
            }
            else {
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
            const isPortAvailable = await portManager_1.PortManager.isPortAvailable(port);
            if (!isPortAvailable) {
                console.log(`SERVER: Port ${port} is already in use, finding alternative...`);
                try {
                    finalPort = await portManager_1.PortManager.findAvailablePort(port);
                    console.log(`SERVER: Found available port: ${finalPort}`);
                    vscode.window.showInformationMessage(`Port ${port} was busy, using port ${finalPort} instead.`);
                }
                catch (error) {
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
                    const launchMode = this.determineLaunchMode(settings);
                    const certMode = this.determineCertMode(serverType, isHttpsOverridden);
                    console.log(`SERVER: About to register server with customName: ${this.currentCustomName}`);
                    const registrar = (0, serverRegistrar_1.getServerRegistrar)();
                    const activeServer = registrar.registerServer({
                        port: finalPort,
                        url: result.serverUrl,
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
                }
                catch (error) {
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
        }
        catch (error) {
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
    checkAndHandleLateralPanelHttpsConflict(settings) {
        const originalServerType = this.determineServerType(settings);
        // Check if we have lateral panel + HTTPS combination
        const isLateralPanel = settings.launch.openMode === 'lateralPanel';
        const isHttps = originalServerType === 'https-default' || originalServerType === 'https-custom';
        if (isLateralPanel && isHttps) {
            console.log('SERVER: HTTPS + Lateral Panel conflict detected - overriding to HTTP for compatibility');
            console.log(`SERVER: Original server type would have been: ${originalServerType}`);
            console.log('SERVER: VS Code webview panels do not support HTTPS content, using HTTP fallback');
            // Show non-blocking warning to user with actionable information
            vscode.window.showWarningMessage('Launching in HTTP mode due to VS Code limitations: lateral panel views do not support HTTPS content. Use browser mode to preserve HTTPS.', 'Change to Browser Mode').then(action => {
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
    determineServerType(settings) {
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
    async launchServerByType(serverType, settings, port, host, customStaticRoot, mainFile) {
        try {
            let server;
            let serverUrl;
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
                    server = new httpServer_1.HttpServer({
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
                    server = new httpsDefaultServer_1.HttpsDefaultServer({
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
                    server = new httpsCustomServer_1.HttpsCustomServer({
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
        }
        catch (error) {
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
    async getPortSuggestions(count = 3) {
        const settings = this.settingsManager.getServerSettings();
        return portManager_1.PortManager.findMultipleAvailablePorts(count, settings.defaultPort);
    }
    /**
     * Check if current settings would trigger HTTPS override for lateral panel
     * @returns boolean - True if override would occur
     */
    wouldTriggerHttpsOverride() {
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
    determineLaunchMode(settings) {
        return settings.launch.openMode;
    }
    /**
     * Determine certificate mode for active server registry
     * @private
     */
    determineCertMode(serverType, httpsOverridden) {
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
    async cleanup() {
        console.log('SERVER: Cleaning up server launcher...');
        if (this.currentServer) {
            await this.stopServer();
        }
        console.log('SERVER: Server launcher cleanup completed');
    }
}
exports.ServerLauncher = ServerLauncher;
//# sourceMappingURL=launcher.js.map