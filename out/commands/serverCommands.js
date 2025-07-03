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
exports.registerServerCommands = registerServerCommands;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
// Fix the incorrect import path:
const serverModel_1 = require("../server/models/serverModel");
const serverManager_1 = require("../server/serverManager");
const certificateManager_1 = require("../server/certificateManager");
const portManager_1 = require("../server/portManager");
/**
 * Registers all server-related commands
 * @param context Extension context for storage
 * @param treeDataProvider The main tree data provider
 * @returns Array of disposables for registered commands
 */
function registerServerCommands(context, treeDataProvider) {
    const disposables = [];
    // Command to change server mode
    disposables.push(vscode.commands.registerCommand('codexr.changeServerMode', (mode) => treeDataProvider.changeServerMode(mode)));
    // Command to start server with current configuration
    disposables.push(vscode.commands.registerCommand('codexr.startServerWithConfig', async () => {
        const currentMode = context.globalState.get('serverMode') ||
            serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS;
        // Add this diagnostic logging
        console.log('Current server mode:', currentMode);
        try {
            // Configure file picker for HTML files
            const options = {
                canSelectMany: false,
                openLabel: 'Select HTML File',
                filters: { 'HTML': ['html', 'htm'] }
            };
            // Show file picker dialog
            const fileUri = await vscode.window.showOpenDialog(options);
            if (!fileUri || fileUri.length === 0) {
                return;
            }
            // Get full path of selected file
            const selectedFile = fileUri[0].fsPath;
            // Define server mode based on configuration
            let useHttps = false;
            let useDefaultCerts = false;
            // Determine server modes correctly
            if (currentMode === serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS) {
                useHttps = true;
                useDefaultCerts = true;
            }
            else if (currentMode === serverModel_1.ServerMode.HTTPS_CUSTOM_CERTS) {
                useHttps = true;
                useDefaultCerts = false;
            }
            // Add more diagnostic logging
            console.log('useHttps:', useHttps, 'useDefaultCerts:', useDefaultCerts);
            // Check for certificate existence if using default certs
            if (useHttps && useDefaultCerts && !(0, certificateManager_1.defaultCertificatesExist)(context)) {
                const warningResult = await vscode.window.showWarningMessage('Default SSL certificates not found. Server will not work with VR headsets. ' +
                    'Do you want to continue with HTTP instead?', 'Use HTTP', 'Cancel');
                if (warningResult === 'Use HTTP') {
                    // Fall back to HTTP
                    await (0, serverManager_1.startServer)(selectedFile, context, false, false);
                    treeDataProvider.refresh();
                    return;
                }
                return;
            }
            // Start server with selected configuration
            await (0, serverManager_1.startServer)(selectedFile, context, useHttps, useDefaultCerts);
            treeDataProvider.refresh();
        }
        catch (error) {
            console.error('Error in startServerWithConfig:', error);
            vscode.window.showErrorMessage(`Error starting server: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
    // Legacy command to start server (maintains compatibility)
    disposables.push(vscode.commands.registerCommand('codexr.startLocalServer', async () => {
        try {
            // First, ask user if they want to use HTTPS
            const serverType = await vscode.window.showQuickPick(['HTTP', 'HTTPS (requires certificates)'], { placeHolder: 'Select server type' });
            if (!serverType) {
                return; // User cancelled the selection
            }
            const useHttps = serverType === 'HTTPS (requires certificates)';
            // If the user selected HTTPS, prompt for custom certificates
            if (useHttps) {
                // Dialog to select private key file
                const keyOptions = {
                    canSelectMany: false,
                    openLabel: 'Select private key file (.key or .pem)',
                    filters: { 'Certificates': ['key', 'pem'] }
                };
                const keyUri = await vscode.window.showOpenDialog(keyOptions);
                if (!keyUri || keyUri.length === 0) {
                    vscode.window.showWarningMessage('No private key file was selected. Server startup cancelled.');
                    return;
                }
                // Dialog to select certificate file
                const certOptions = {
                    canSelectMany: false,
                    openLabel: 'Select certificate file (.cert or .pem)',
                    filters: { 'Certificates': ['cert', 'pem', 'crt'] }
                };
                const certUri = await vscode.window.showOpenDialog(certOptions);
                if (!certUri || certUri.length === 0) {
                    vscode.window.showWarningMessage('No certificate file was selected. Server startup cancelled.');
                    return;
                }
                // Store selected certificate paths in context
                await context.globalState.update('customKeyPath', keyUri[0].fsPath);
                await context.globalState.update('customCertPath', certUri[0].fsPath);
            }
            // Configure file picker for HTML files
            const options = {
                canSelectMany: false,
                openLabel: 'Select HTML File',
                filters: { 'HTML': ['html', 'htm'] }
            };
            // Show file picker dialog
            const fileUri = await vscode.window.showOpenDialog(options);
            if (!fileUri || fileUri.length === 0) {
                return;
            }
            const selectedFile = fileUri[0].fsPath;
            await (0, serverManager_1.startServer)(selectedFile, context, useHttps, false);
            treeDataProvider.refresh();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error starting server: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
    // Command to stop server
    disposables.push(vscode.commands.registerCommand('codexr.stopLocalServer', (serverId) => {
        (0, serverManager_1.stopServer)(serverId);
        treeDataProvider.refresh();
    }));
    // Command to show options for an active server
    disposables.push(vscode.commands.registerCommand('codexr.serverOptions', async (serverInfo) => {
        try {
            const selection = await vscode.window.showQuickPick([
                { label: '$(globe) Open in Browser', id: 'open' },
                { label: '$(file-binary) View Server Info', id: 'info' },
                { label: '$(stop) Stop Server', id: 'stop' }
            ], {
                placeHolder: `Server ${serverInfo.url}`,
                title: `Options for ${path.basename(serverInfo.filePath)}`
            });
            if (!selection) {
                return;
            }
            if (selection.id === 'open') {
                vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
            }
            else if (selection.id === 'info') {
                // New functionality: Display detailed server info
                // Add null check for startTime
                const timeRunning = serverInfo.startTime
                    ? Math.floor((Date.now() - serverInfo.startTime) / 1000)
                    : 0;
                const minutes = Math.floor(timeRunning / 60);
                const seconds = timeRunning % 60;
                const infoMessage = `Server: ${serverInfo.url}\n` +
                    `Protocol: ${serverInfo.protocol.toUpperCase()}\n` +
                    `Port: ${serverInfo.port}\n` +
                    `File: ${serverInfo.filePath}\n` +
                    `Running time: ${minutes}m ${seconds}s`;
                vscode.window.showInformationMessage(infoMessage);
            }
            else if (selection.id === 'stop') {
                (0, serverManager_1.stopServer)(serverInfo.id);
                treeDataProvider.refresh();
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error executing server action: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
    // Command for server status actions
    disposables.push(vscode.commands.registerCommand('codexr.serverStatusActions', async () => {
        try {
            const activeServers = (0, serverManager_1.getActiveServers)();
            if (activeServers.length === 0) {
                vscode.window.showInformationMessage('No active servers');
                return;
            }
            // If there's only one server, show options directly
            if (activeServers.length === 1) {
                vscode.commands.executeCommand('codexr.serverOptions', activeServers[0]);
                return;
            }
            // If there are multiple servers, show list to select
            const items = activeServers.map(server => ({
                label: path.basename(server.filePath),
                description: server.url,
                server: server
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a server',
            });
            if (selected) {
                vscode.commands.executeCommand('codexr.serverOptions', selected.server);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error showing server status: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
    // Command to check certificate status
    disposables.push(vscode.commands.registerCommand('codexr.checkCertificates', async () => {
        const certStatus = (0, certificateManager_1.defaultCertificatesExist)(context);
        if (certStatus) {
            vscode.window.showInformationMessage('Default SSL certificates are present and ready to use for HTTPS servers.');
        }
        else {
            const result = await vscode.window.showWarningMessage('Default SSL certificates not found. HTTPS servers will not work properly without them.', 'Generate Certificates', 'Learn More');
            if (result === 'Learn More') {
                vscode.env.openExternal(vscode.Uri.parse('https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Fundamentals#https'));
            }
            else if (result === 'Generate Certificates') {
                // Certificate generation placeholder
                vscode.window.showInformationMessage('Certificate generation will be implemented in a future update.');
            }
        }
    }));
    // Command to stop all active servers
    disposables.push(vscode.commands.registerCommand('codexr.stopAllServers', async () => {
        try {
            const activeServers = (0, serverManager_1.getActiveServers)();
            if (activeServers.length === 0) {
                vscode.window.showInformationMessage('No active servers to stop');
                return;
            }
            // Ask for confirmation if multiple servers are running
            if (activeServers.length > 1) {
                const confirm = await vscode.window.showWarningMessage(`Are you sure you want to stop all ${activeServers.length} running servers?`, 'Yes', 'No');
                if (confirm !== 'Yes') {
                    return;
                }
            }
            // Stop each server one by one
            for (const server of activeServers) {
                (0, serverManager_1.stopServer)(server.id);
            }
            vscode.window.showInformationMessage(`Stopped ${activeServers.length} servers successfully`);
            // Refresh the view
            treeDataProvider.refresh();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error stopping servers: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
    /**
     * Command to show port status
     */
    disposables.push(vscode.commands.registerCommand('codexr.showPortStatus', async () => {
        try {
            const status = await portManager_1.portManager.getPortStatus();
            const statusMessage = `Port Status (${status.range.start}-${status.range.end}):\n\n` +
                `🔒 Active Services (${status.managed.length}):\n` +
                status.managed.map(port => `  • Port ${port.port}: ${port.service} - ${port.description}`).join('\n') +
                `\n\n✅ Available Ports: ${status.available.length}/${status.total}\n` +
                `📋 Some available: ${status.available.slice(0, 10).join(', ')}${status.available.length > 10 ? '...' : ''}`;
            vscode.window.showInformationMessage(statusMessage, { modal: true });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error getting port status: ${error}`);
        }
    }));
    /**
     * Helper function to stop all servers
     */
    function stopAllServers() {
        const activeServers = (0, serverManager_1.getActiveServers)();
        for (const server of activeServers) {
            (0, serverManager_1.stopServer)(server.id);
        }
    }
    /**
     * Command to release all managed ports
     */
    disposables.push(vscode.commands.registerCommand('codexr.releaseAllPorts', async () => {
        const confirm = await vscode.window.showWarningMessage('This will stop all CodeXR servers and release all managed ports. Continue?', 'Release All Ports', 'Cancel');
        if (confirm === 'Release All Ports') {
            // Stop all servers first
            stopAllServers();
            // Release all managed ports
            portManager_1.portManager.releaseAllPorts();
            vscode.window.showInformationMessage('All ports released successfully');
        }
    }));
    /**
     * Command to check specific port
     */
    disposables.push(vscode.commands.registerCommand('codexr.checkPort', async () => {
        const input = await vscode.window.showInputBox({
            prompt: 'Enter port number to check (3000-3100)',
            placeHolder: '3000',
            validateInput: (value) => {
                const port = parseInt(value);
                if (isNaN(port) || port < 3000 || port > 3100) {
                    return 'Please enter a valid port number (3000-3100)';
                }
                return null;
            }
        });
        if (input) {
            const port = parseInt(input);
            if (portManager_1.portManager.isPortManaged(port)) {
                const activePorts = portManager_1.portManager.getActivePorts();
                const activePort = activePorts.find(p => p.port === port);
                vscode.window.showInformationMessage(`Port ${port} is managed by CodeXR:\n${activePort?.service} - ${activePort?.description}`);
            }
            else {
                try {
                    const nextFree = await portManager_1.portManager.findFreePort(port);
                    if (nextFree === port) {
                        vscode.window.showInformationMessage(`✅ Port ${port} is available`);
                    }
                    else {
                        vscode.window.showWarningMessage(`❌ Port ${port} is in use by another application.\nNext available port: ${nextFree}`);
                    }
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Error checking port: ${error}`);
                }
            }
        }
    }));
    /**
     * Command to stop all servers from tree (with confirmation)
     */
    disposables.push(vscode.commands.registerCommand('codexr.stopAllServersFromTree', async (serverCount) => {
        try {
            const confirm = await vscode.window.showWarningMessage(`Are you sure you want to stop all ${serverCount} running servers?`, { modal: true }, 'Stop All Servers', 'Cancel');
            if (confirm === 'Stop All Servers') {
                const activeServers = (0, serverManager_1.getActiveServers)();
                // Mostrar progreso mientras se detienen los servidores
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Stopping servers...",
                    cancellable: false
                }, async (progress) => {
                    const increment = 100 / activeServers.length;
                    for (let i = 0; i < activeServers.length; i++) {
                        const server = activeServers[i];
                        progress.report({
                            increment: increment,
                            message: `Stopping ${path.basename(server.filePath)} (${i + 1}/${activeServers.length})`
                        });
                        (0, serverManager_1.stopServer)(server.id);
                        // Pequeña pausa para dar tiempo al cierre
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                });
                vscode.window.showInformationMessage(`✅ Successfully stopped ${serverCount} servers`, { modal: false });
                // Refresh the view
                treeDataProvider.refresh();
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error stopping servers: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
    /**
     * Command to debug server status
     */
    disposables.push(vscode.commands.registerCommand('codexr.debugServerStatus', async () => {
        const activeServers = (0, serverManager_1.getActiveServers)();
        const portStatus = await portManager_1.portManager.getPortStatus();
        const debugInfo = `🔍 Server Debug Info:\n\n` +
            `Active Servers (${activeServers.length}):\n` +
            activeServers.map(server => `  • ${server.id}: ${server.url} (port ${server.port})`).join('\n') +
            `\n\nManaged Ports (${portStatus.managed.length}):\n` +
            portStatus.managed.map(port => `  • Port ${port.port}: ${port.service} - ${port.description}`).join('\n') +
            `\n\nAvailable Ports: ${portStatus.available.length}/${portStatus.total}`;
        console.log(debugInfo);
        vscode.window.showInformationMessage(debugInfo, { modal: true });
    }));
    return disposables;
}
//# sourceMappingURL=serverCommands.js.map