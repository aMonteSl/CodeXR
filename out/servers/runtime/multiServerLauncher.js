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
exports.MultiServerLauncher = void 0;
const vscode = __importStar(require("vscode"));
const portManager_1 = require("./portManager");
const serverSettingsManager_1 = require("../storage/serverSettingsManager");
const activeServerRegistry_1 = require("../../active_servers/registry/activeServerRegistry");
const handleServerActions_1 = require("../../active_servers/views/interactions/handleServerActions");
const serverRegistrar_1 = require("../../active_servers/services/serverRegistrar");
/**
 * Multi-Server Launcher
 * Manages multiple HTTP/HTTPS servers running concurrently with dynamic port allocation
 */
class MultiServerLauncher {
    context;
    servers = new Map();
    settingsManager;
    constructor(context) {
        this.context = context;
        this.settingsManager = serverSettingsManager_1.ServerSettingsManager.getInstance(context);
        console.log('SERVER: Multi-server launcher initialized');
    }
    /**
     * Launch a new server instance with dynamic port allocation
     * @param htmlFile Optional HTML file to serve
     * @param customName Optional custom display name for the server
     * @returns Promise<MultiServerLaunchResult>
     */
    async launchServer(htmlFile, customName) {
        try {
            console.log('SERVER: Starting multi-server launch process...');
            console.log('SERVER: launchServer called with parameters:', { htmlFile, customName });
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
                vscode.window.showInformationMessage(`Port ${requestedPort} was busy, launching server on port ${finalPort} instead.`);
            }
            else {
                console.log(`SERVER: Using requested port ${finalPort}`);
            }
            // Launch the server
            const host = 'localhost';
            const result = await this.launchServerByType(serverType, settings, finalPort, host, htmlFile);
            if (result.success && result.serverUrl) {
                console.log(`SERVER: Successfully launched ${serverType} server on port ${finalPort}`);
                // Generate unique server ID
                const serverId = this.generateServerId();
                // Store server info
                const serverInfo = {
                    id: serverId,
                    server: result.serverInstance,
                    serverType: serverType,
                    port: finalPort,
                    htmlFile: htmlFile,
                    activeServerId: ''
                };
                // Register server in active servers registry
                try {
                    const launchMode = this.determineLaunchMode(settings);
                    const certMode = this.determineCertMode(serverType, result.httpsOverridden);
                    console.log('SERVER: About to register server with customName:', customName);
                    const registrar = (0, serverRegistrar_1.getServerRegistrar)();
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
                            serverInstanceId: serverId
                        }
                    });
                    serverInfo.activeServerId = activeServer.id;
                    this.servers.set(serverId, serverInfo);
                    console.log(`SERVER: Successfully registered server ${serverId} (active ID: ${activeServer.id}) via registrar service`);
                    console.log(`SERVER: Currently managing ${this.servers.size} server(s)`);
                    // Handle auto-opening based on configuration
                    await this.handleAutoOpening(settings, result.serverUrl, htmlFile, launchMode, serverInfo.activeServerId);
                }
                catch (error) {
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
            }
            else {
                return {
                    success: false,
                    error: result.error || 'Unknown server launch error',
                    httpsOverridden: isHttpsOverridden
                };
            }
        }
        catch (error) {
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
    async stopServer(serverId) {
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
                    const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
                    registry.unregisterServer(serverInfo.activeServerId);
                    console.log(`SERVER: Unregistered server ${serverInfo.activeServerId} from registry`);
                }
                catch (error) {
                    console.error('SERVER: Failed to unregister server from registry:', error);
                }
            }
            this.servers.delete(serverId);
            console.log(`SERVER: Server ${serverId} stopped successfully. ${this.servers.size} server(s) remaining`);
            return true;
        }
        catch (error) {
            console.error(`SERVER: Error stopping server ${serverId}:`, error);
            return false;
        }
    }
    /**
     * Stop all running servers
     * @returns Promise<boolean>
     */
    async stopAllServers() {
        console.log(`SERVER: Stopping all ${this.servers.size} servers...`);
        const stopPromises = Array.from(this.servers.keys()).map(serverId => this.stopServer(serverId));
        const results = await Promise.all(stopPromises);
        const allStopped = results.every(result => result === true);
        if (allStopped) {
            console.log('SERVER: All servers stopped successfully');
        }
        else {
            console.error('SERVER: Some servers failed to stop properly');
        }
        return allStopped;
    }
    /**
     * Get information about all running servers
     * @returns Array of server info
     */
    getRunningServers() {
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
    hasRunningServers() {
        return this.servers.size > 0;
    }
    /**
     * Get count of running servers
     * @returns number
     */
    getRunningServerCount() {
        return this.servers.size;
    }
    /**
     * Find available port with enhanced logging
     * @private
     */
    async findAvailablePortWithLogging(requestedPort) {
        console.log(`SERVER: Checking availability of port ${requestedPort}...`);
        const isAvailable = await portManager_1.PortManager.isPortAvailable(requestedPort);
        if (isAvailable) {
            console.log(`SERVER: Port ${requestedPort} is available`);
            return requestedPort;
        }
        console.log(`SERVER: Port ${requestedPort} already in use. Searching for next available port (${requestedPort + 1})...`);
        try {
            const availablePort = await portManager_1.PortManager.findAvailablePort(requestedPort + 1);
            console.log(`SERVER: Free port found at ${availablePort}. Launching server...`);
            return availablePort;
        }
        catch (error) {
            console.error(`SERVER: Failed to find available port starting from ${requestedPort + 1}:`, error);
            throw new Error(`No available ports found starting from ${requestedPort}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Generate unique server ID
     * @private
     */
    generateServerId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 5);
        return `server_${timestamp}_${random}`;
    }
    /**
     * Determine server type based on settings
     * @private
     */
    determineServerType(settings) {
        if (settings.mode === 'HTTP') {
            return 'http';
        }
        else if (settings.mode === 'HTTPS') {
            return settings.https.certSource === 'default' ? 'https-default' : 'https-custom';
        }
        throw new Error(`Invalid server mode: ${settings.mode}`);
    }
    /**
     * Determine launch mode based on settings
     * @private
     */
    determineLaunchMode(settings) {
        return settings.launch.openMode === 'lateralPanel' ? 'lateralPanel' : 'browser';
    }
    /**
     * Determine certificate mode based on server type and overrides
     * @private
     */
    determineCertMode(serverType, httpsOverridden) {
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
    async launchServerByType(serverType, settings, port, host, htmlFile) {
        // Import the original server launcher logic
        const { ServerLauncher } = require('./launcher');
        // Create a temporary launcher instance to use the existing server creation logic
        const tempLauncher = new ServerLauncher(this.context);
        // Use reflection to access private methods - this is a bridge solution
        // until we can refactor the server creation logic into shared utilities
        const launchMethod = tempLauncher.launchServerByType.bind(tempLauncher);
        try {
            let result;
            if (htmlFile) {
                // Extract directory and filename from the HTML file path
                const path = require('path');
                const fileDirectory = path.dirname(htmlFile);
                const fileName = path.basename(htmlFile);
                console.log(`SERVER: Using custom static root: ${fileDirectory}`);
                console.log(`SERVER: Main file: ${fileName}`);
                // Call with custom static root and main file
                result = await launchMethod(serverType, settings, port, host, fileDirectory, fileName);
            }
            else {
                // Call without custom file (uses default templates)
                result = await launchMethod(serverType, settings, port, host);
            }
            // Extract the server instance from the temporary launcher
            const serverInstance = tempLauncher.currentServer;
            if (result.success && serverInstance) {
                // Clear the temporary launcher's reference to prevent it from managing this server
                tempLauncher.currentServer = null;
                tempLauncher.currentServerType = null;
                return {
                    ...result,
                    serverInstance: serverInstance
                };
            }
            return result;
        }
        catch (error) {
            console.error(`SERVER: Error launching ${serverType} server:`, error);
            return {
                success: false,
                error: `Failed to launch ${serverType} server: ${error instanceof Error ? error.message : String(error)}`
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
     * Handle auto-opening based on configuration
     * @private
     */
    async handleAutoOpening(settings, serverUrl, htmlFile, launchMode, activeServerId) {
        const isAutoOpenEnabled = settings.launch.autoOpen;
        console.log(`SERVER: Auto-open configuration: enabled=${isAutoOpenEnabled}, mode=${launchMode}`);
        if (!isAutoOpenEnabled) {
            console.log('SERVER: Auto-open is disabled, showing success notification only');
            vscode.window.showInformationMessage(`Server launched successfully on ${serverUrl}`, 'Open Now').then(action => {
                if (action === 'Open Now') {
                    // Use the active server action handler to respect the configured mode
                    if (launchMode === 'browser') {
                        this.openServerInBrowser(activeServerId);
                    }
                    else {
                        this.openServerInPanel(activeServerId);
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
            }
            else {
                await this.openServerInPanel(activeServerId);
            }
        }
        catch (error) {
            console.error('SERVER: Error during auto-opening:', error);
            vscode.window.showWarningMessage(`Server launched but failed to auto-open: ${error instanceof Error ? error.message : String(error)}`, 'Open Manually').then(action => {
                if (action === 'Open Manually') {
                    if (launchMode === 'browser') {
                        this.openServerInBrowser(activeServerId);
                    }
                    else {
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
    async openServerInBrowser(activeServerId) {
        console.log(`SERVER: Opening server ${activeServerId} in browser via shared handler`);
        try {
            await handleServerActions_1.ServerActionHandlers.openInBrowser(activeServerId);
        }
        catch (error) {
            console.error(`SERVER: Failed to open server in browser: ${error}`);
            throw error;
        }
    }
    /**
     * Open server in lateral panel using shared handler
     * @private
     */
    async openServerInPanel(activeServerId) {
        console.log(`SERVER: Opening server ${activeServerId} in lateral panel via shared handler`);
        try {
            await handleServerActions_1.ServerActionHandlers.openInPanel(activeServerId);
        }
        catch (error) {
            console.error(`SERVER: Failed to open server in lateral panel: ${error}`);
            throw error;
        }
    }
}
exports.MultiServerLauncher = MultiServerLauncher;
//# sourceMappingURL=multiServerLauncher.js.map