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
exports.configureServer = configureServer;
exports.startLocalServer = startLocalServer;
exports.getCurrentServerConfig = getCurrentServerConfig;
exports.configureHttpMode = configureHttpMode;
exports.configurePort = configurePort;
exports.toggleAutoOpen = toggleAutoOpen;
exports.configureOpenMode = configureOpenMode;
exports.resetToDefault = resetToDefault;
exports.setExtensionContext = setExtensionContext;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const handleConfigurationClicks_1 = require("../views/interactions/handleConfigurationClicks");
const multiServerLauncher_1 = require("../runtime/multiServerLauncher");
const serverSettingsManager_1 = require("../storage/serverSettingsManager");
const previewRenderer_1 = require("../runtime/previewRenderer");
let currentServerConfig = {
    mode: 'HTTPS (default certificates)',
    description: 'HTTPS with default certificates'
};
// Global multi-server launcher instance
let multiServerLauncher = null;
// Extension context (set during command registration)
let extensionContext = null;
/**
 * Opens server configuration panel
 */
async function configureServer() {
    console.log('SERVER: Server configuration triggered');
    const options = [
        'HTTPS (default certificates)',
        'HTTPS (custom certificates)',
        'HTTP (development only)'
    ];
    const selected = await vscode.window.showQuickPick(options, {
        placeHolder: 'Select server mode',
        canPickMany: false
    });
    if (selected) {
        currentServerConfig.mode = selected;
        switch (selected) {
            case 'HTTPS (default certificates)':
                currentServerConfig.description = 'HTTPS with default certificates';
                break;
            case 'HTTPS (custom certificates)':
                currentServerConfig.description = 'HTTPS with custom certificates';
                break;
            case 'HTTP (development only)':
                currentServerConfig.description = 'HTTP for development only';
                break;
        }
        console.log(`SERVER: Configuration changed to ${currentServerConfig.mode}`);
        vscode.window.showInformationMessage(`SERVER: Configuration updated to ${currentServerConfig.mode}`);
        // Refresh the tree view
        vscode.commands.executeCommand('codexr.servers.refresh');
    }
}
/**
 * Starts the local server with current configuration
 * Main entry point for the "Start Local Server" command
 */
async function startLocalServer() {
    console.log('SERVER: Start Local Server command triggered');
    try {
        // Step 1: Prompt user to select an HTML file
        const selectedFile = await promptForHtmlFile();
        if (!selectedFile) {
            console.log('SERVER: No file selected, operation cancelled');
            return;
        }
        console.log(`SERVER: Selected HTML file: ${selectedFile}`);
        // Step 2: Get extension context and initialize multi-server launcher
        if (!extensionContext) {
            vscode.window.showErrorMessage('SERVER: Extension context not available');
            return;
        }
        if (!multiServerLauncher) {
            multiServerLauncher = new multiServerLauncher_1.MultiServerLauncher(extensionContext);
        }
        // Step 3: Get current server configuration
        const settingsManager = serverSettingsManager_1.ServerSettingsManager.getInstance(extensionContext);
        const settings = settingsManager.getServerSettings();
        console.log('SERVER: Current configuration:', {
            mode: settings.mode,
            defaultPort: settings.defaultPort,
            autoOpen: settings.launch.autoOpen,
            openMode: settings.launch.openMode
        });
        // Step 4: Validate HTTPS custom certificates if needed
        if (settings.mode === 'HTTPS' && settings.https.certSource === 'custom') {
            const isValid = await validateCustomCertificates(settings);
            if (!isValid) {
                return; // Error message already shown in validation function
            }
        }
        // Step 5: Support multiple servers - show current status
        const runningCount = multiServerLauncher.getRunningServerCount();
        if (runningCount > 0) {
            console.log(`SERVER: ${runningCount} server(s) already running, launching additional server with dynamic port allocation`);
            vscode.window.showInformationMessage(`Launching additional server (${runningCount} servers already running)`);
        }
        // Step 6: Launch the server with the selected HTML file using multi-server launcher
        console.log('SERVER: Launching server...');
        const result = await multiServerLauncher.launchServer(selectedFile);
        if (!result.success) {
            console.error('SERVER: Failed to launch server:', result.error);
            vscode.window.showErrorMessage(`Failed to start server: ${result.error}`);
            return;
        }
        console.log(`SERVER: Server launched successfully at ${result.serverUrl} (Server ID: ${result.serverId})`);
        // Provide detailed messages based on port allocation and HTTPS override
        if (result.portChanged && result.httpsOverridden) {
            vscode.window.showInformationMessage(`Server started at ${result.serverUrl} (Port changed from ${result.originalPort} to ${result.port}, HTTP mode - HTTPS overridden for lateral panel compatibility)`);
        }
        else if (result.portChanged) {
            vscode.window.showInformationMessage(`Server started at ${result.serverUrl} (Port changed from ${result.originalPort} to ${result.port})`);
        }
        else if (result.httpsOverridden) {
            vscode.window.showInformationMessage(`Server started at ${result.serverUrl} (HTTP mode - HTTPS overridden for lateral panel compatibility)`);
        }
        else {
            vscode.window.showInformationMessage(`Server started at ${result.serverUrl}`);
        }
        // Step 7: Auto-open if configured
        if (settings.launch.autoOpen && result.serverUrl) {
            await handleAutoOpen(result.serverUrl, selectedFile, settings.launch.openMode);
        }
        // Refresh the tree view to show server status
        vscode.commands.executeCommand('codexr.servers.refresh');
    }
    catch (error) {
        console.error('SERVER: Error in startLocalServer:', error);
        vscode.window.showErrorMessage(`Failed to start server: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Gets the current server configuration
 */
function getCurrentServerConfig() {
    return currentServerConfig;
}
/**
 * Configuration interaction handlers
 */
async function configureHttpMode() {
    await (0, handleConfigurationClicks_1.handleHttpModeClick)();
}
async function configurePort() {
    await (0, handleConfigurationClicks_1.handlePortClick)();
}
async function toggleAutoOpen() {
    await (0, handleConfigurationClicks_1.handleAutoOpenClick)();
}
async function configureOpenMode() {
    await (0, handleConfigurationClicks_1.handleOpenModeClick)();
}
/**
 * Reset server configuration to default values
 */
async function resetToDefault() {
    console.log('SERVER: Resetting server configuration to defaults');
    const confirm = await vscode.window.showWarningMessage('This will reset all server configuration to default values. Are you sure?', { modal: true }, 'Reset to Default', 'Cancel');
    if (confirm !== 'Reset to Default') {
        return;
    }
    try {
        if (!extensionContext) {
            vscode.window.showErrorMessage('SERVER: Extension context not available');
            return;
        }
        const settingsManager = serverSettingsManager_1.ServerSettingsManager.getInstance(extensionContext);
        await settingsManager.resetSettings();
        console.log('SERVER: Configuration reset to defaults successfully');
        vscode.window.showInformationMessage('Server configuration reset to default values');
        // Refresh the tree view to show updated configuration
        vscode.commands.executeCommand('codexr.servers.refresh');
    }
    catch (error) {
        console.error('SERVER: Error resetting configuration to defaults:', error);
        vscode.window.showErrorMessage(`Failed to reset configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Set the extension context (called during command registration)
 */
function setExtensionContext(context) {
    extensionContext = context;
}
/**
 * Helper Functions for Server Launching
 */
/**
 * Prompts user to select an HTML file from the file system
 * @returns Promise<string | undefined> - Path to selected file or undefined if cancelled
 */
async function promptForHtmlFile() {
    console.log('SERVER: Prompting user to select HTML file');
    const options = {
        canSelectMany: false,
        openLabel: 'Select HTML File',
        filters: {
            'HTML Files': ['html', 'htm'],
            'All Files': ['*']
        },
        title: 'Select HTML file to serve'
    };
    const fileUri = await vscode.window.showOpenDialog(options);
    if (fileUri && fileUri[0]) {
        const filePath = fileUri[0].fsPath;
        console.log(`SERVER: User selected file: ${filePath}`);
        // Validate that the file exists and is readable
        try {
            await fs.promises.access(filePath, fs.constants.R_OK);
            return filePath;
        }
        catch (error) {
            console.error(`SERVER: Cannot read selected file: ${error}`);
            vscode.window.showErrorMessage(`Cannot read the selected file: ${path.basename(filePath)}`);
            return undefined;
        }
    }
    return undefined;
}
/**
 * Validates custom HTTPS certificates exist and are readable
 * @param settings - Server settings containing certificate paths
 * @returns Promise<boolean> - True if certificates are valid
 */
async function validateCustomCertificates(settings) {
    console.log('SERVER: Validating custom certificates');
    const certPath = settings.https.certPath;
    const keyPath = settings.https.keyPath;
    if (!certPath || !keyPath) {
        console.log('SERVER: Custom certificate paths not configured');
        vscode.window.showErrorMessage('Custom certificates are not configured. Please configure certificate paths in server settings.', 'Configure').then(action => {
            if (action === 'Configure') {
                vscode.commands.executeCommand('codexr.server.configure');
            }
        });
        return false;
    }
    // Check if certificate file exists
    if (!fs.existsSync(certPath)) {
        console.log(`SERVER: Certificate file not found: ${certPath}`);
        vscode.window.showErrorMessage(`Certificate file not found: ${path.basename(certPath)}`, 'Configure').then(action => {
            if (action === 'Configure') {
                vscode.commands.executeCommand('codexr.server.configure');
            }
        });
        return false;
    }
    // Check if key file exists
    if (!fs.existsSync(keyPath)) {
        console.log(`SERVER: Private key file not found: ${keyPath}`);
        vscode.window.showErrorMessage(`Private key file not found: ${path.basename(keyPath)}`, 'Configure').then(action => {
            if (action === 'Configure') {
                vscode.commands.executeCommand('codexr.server.configure');
            }
        });
        return false;
    }
    // Check if files are readable
    try {
        await fs.promises.access(certPath, fs.constants.R_OK);
        await fs.promises.access(keyPath, fs.constants.R_OK);
        console.log('SERVER: Custom certificates validated successfully');
        return true;
    }
    catch (error) {
        console.error(`SERVER: Cannot read certificate files: ${error}`);
        vscode.window.showErrorMessage('Cannot read certificate files. Check file permissions.');
        return false;
    }
}
/**
 * Handles auto-opening the server URL based on configuration
 * @param serverUrl - The server URL to open
 * @param selectedFile - The HTML file being served
 * @param openMode - How to open ('browser' or 'lateralPanel')
 */
async function handleAutoOpen(serverUrl, selectedFile, openMode, serverId) {
    console.log(`SERVER: Auto-opening ${serverUrl} in ${openMode} mode for file: ${selectedFile}`);
    try {
        if (openMode === 'browser') {
            console.log(`SERVER: Opening ${serverUrl} in external browser`);
            await previewRenderer_1.PreviewRenderer.openPreview(serverUrl, selectedFile, openMode);
            vscode.window.showInformationMessage(`Opened ${path.basename(selectedFile)} in browser`);
        }
        else if (openMode === 'lateralPanel') {
            console.log(`SERVER: Opening ${selectedFile} in VS Code webview panel`);
            if (serverId) {
                await previewRenderer_1.PreviewRenderer.openPreview(serverUrl, selectedFile, openMode, serverId);
            }
            else {
                // For legacy calls without serverId, generate a temporary one
                const tempServerId = `temp-${Date.now()}`;
                console.log(`SERVER: No serverId provided, using temporary ID: ${tempServerId}`);
                await previewRenderer_1.PreviewRenderer.openPreview(serverUrl, selectedFile, openMode, tempServerId);
            }
            vscode.window.showInformationMessage(`Opened ${path.basename(selectedFile)} in VS Code panel`);
        }
    }
    catch (error) {
        console.error(`SERVER: Error opening preview: ${error}`);
        vscode.window.showWarningMessage(`Failed to auto-open: ${error instanceof Error ? error.message : String(error)}`);
    }
}
//# sourceMappingURL=serverCommands.js.map