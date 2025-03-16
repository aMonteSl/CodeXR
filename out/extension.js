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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const server_1 = require("./server");
const treeProvider_1 = require("./treeProvider");
const serverModel_1 = require("./models/serverModel");
const babiaxrManager_1 = require("./babiaxrManager");
/**
 * This function is executed when the extension is activated
 */
function activate(context) {
    console.log('Extension "integracionvsaframe" is now active.');
    // Register tree data provider for the unified view
    const treeDataProvider = new treeProvider_1.LocalServerProvider(context);
    // Register tree view
    const treeView = vscode.window.createTreeView('aframeExplorerView', {
        treeDataProvider: treeDataProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);
    // COMMAND REGISTRATION
    // ===================
    // View Management Commands
    // -----------------------
    // Command to refresh the view
    const refreshViewCommand = vscode.commands.registerCommand('integracionvsaframe.refreshView', () => treeDataProvider.refresh());
    // Server Configuration Commands
    // ---------------------------
    // Command to change server mode
    const changeServerModeCommand = vscode.commands.registerCommand('integracionvsaframe.changeServerMode', (mode) => treeDataProvider.changeServerMode(mode));
    // Command to start server with current configuration
    const startServerWithConfigCommand = vscode.commands.registerCommand('integracionvsaframe.startServerWithConfig', async () => {
        const currentMode = context.globalState.get('serverMode') ||
            serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS;
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
            const useHttps = currentMode !== serverModel_1.ServerMode.HTTP;
            const useDefaultCerts = currentMode === serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS;
            // Start server with selected configuration
            await (0, server_1.startServer)(selectedFile, context, useHttps, useDefaultCerts);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error starting server: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Legacy command to start server (maintains compatibility)
    const startServerCommand = vscode.commands.registerCommand('integracionvsaframe.startLocalServer', async () => {
        try {
            // First, ask user if they want to use HTTPS
            const serverType = await vscode.window.showQuickPick(['HTTP', 'HTTPS (requires certificates)'], { placeHolder: 'Select server type' });
            if (!serverType) {
                return; // User cancelled the selection
            }
            const useHttps = serverType === 'HTTPS (requires certificates)';
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
            await (0, server_1.startServer)(selectedFile, context, useHttps, false);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error starting server: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Command to stop server
    const stopServerCommand = vscode.commands.registerCommand('integracionvsaframe.stopLocalServer', (serverId) => {
        (0, server_1.stopServer)(serverId);
        treeDataProvider.refresh();
    });
    // Server Management Commands
    // -------------------------
    // Command to show options for an active server
    const serverOptionsCommand = vscode.commands.registerCommand('integracionvsaframe.serverOptions', async (serverInfo) => {
        try {
            const selection = await vscode.window.showQuickPick([
                { label: '$(globe) Open in Browser', id: 'open' },
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
            else if (selection.id === 'stop') {
                (0, server_1.stopServer)(serverInfo.id);
                treeDataProvider.refresh();
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error executing server action: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Command for status bar actions
    const serverStatusActionsCommand = vscode.commands.registerCommand('integracionvsaframe.serverStatusActions', async () => {
        try {
            const activeServers = (0, server_1.getActiveServers)();
            if (activeServers.length === 0) {
                vscode.window.showInformationMessage('No active servers');
                return;
            }
            // If there's only one server, show options directly
            if (activeServers.length === 1) {
                vscode.commands.executeCommand('integracionvsaframe.serverOptions', activeServers[0]);
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
                vscode.commands.executeCommand('integracionvsaframe.serverOptions', selected.server);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error showing server status: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // BabiaXR Visualization Commands
    // ----------------------------
    // Command to create a BabiaXR visualization
    const createBabiaXRVisualizationCommand = vscode.commands.registerCommand('integracionvsaframe.createBabiaXRVisualization', async (chartType) => {
        try {
            // Collect chart data from user
            const chartData = await (0, babiaxrManager_1.collectChartData)(chartType);
            if (!chartData)
                return;
            // Collect chart-specific options
            const options = await (0, babiaxrManager_1.collectChartOptions)(chartType);
            if (!options)
                return;
            // Generate visualization
            const filePath = await (0, babiaxrManager_1.createBabiaXRVisualization)(chartType, chartData, context);
            if (filePath) {
                // Ask if user wants to launch server
                const launchServer = await vscode.window.showInformationMessage('Visualization created successfully. Do you want to start the server to view it?', 'Yes', 'No');
                if (launchServer === 'Yes') {
                    await (0, babiaxrManager_1.launchBabiaXRVisualization)(filePath, context);
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error creating visualization: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Register all commands
    context.subscriptions.push(
    // View commands
    refreshViewCommand, 
    // Server configuration commands
    changeServerModeCommand, startServerWithConfigCommand, startServerCommand, stopServerCommand, 
    // Server management commands
    serverOptionsCommand, serverStatusActionsCommand, 
    // BabiaXR commands
    createBabiaXRVisualizationCommand);
}
/**
 * This function is executed when the extension is deactivated
 */
function deactivate() {
    (0, server_1.stopServer)(); // Ensure all servers are stopped when extension is deactivated
}
//# sourceMappingURL=extension.js.map