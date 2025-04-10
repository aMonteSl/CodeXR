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
const serverModel_1 = require("../server/models/serverModel");
const serverManager_1 = require("../server/serverManager");
const certificateManager_1 = require("../server/certificateManager");
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
    // Command to launch a BabiaXR example with server
    disposables.push(vscode.commands.registerCommand('codexr.launchBabiaXRExample', async (examplePath) => {
        try {
            if (!examplePath) {
                vscode.window.showErrorMessage('No example path provided');
                return;
            }
            // Check if file exists
            if (!vscode.workspace.fs.stat(vscode.Uri.file(examplePath))) {
                vscode.window.showErrorMessage(`Example file not found: ${examplePath}`);
                return;
            }
            // Open the file in the editor first
            await vscode.window.showTextDocument(vscode.Uri.file(examplePath));
            // Ask if user wants to launch server
            const launchServer = await vscode.window.showInformationMessage('Do you want to start the server to view this example?', 'Yes', 'No');
            if (launchServer === 'Yes') {
                // Create a server for this example
                const serverMode = context.globalState.get('serverMode') ||
                    serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS;
                // Get the directory of the example rather than the file itself
                const exampleDir = path.dirname(examplePath);
                // Use the example directory as the working directory
                const serverInfo = await (0, serverManager_1.createServer)(examplePath, serverMode, context);
                if (serverInfo) {
                    // Open browser
                    vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
                    // Show confirmation
                    vscode.window.showInformationMessage(`Server started at ${serverInfo.url}`);
                    // Refresh the tree to show the new server
                    treeDataProvider.refresh();
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error launching example: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
    return disposables;
}
//# sourceMappingURL=serverCommands.js.map