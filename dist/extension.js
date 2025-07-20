/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(__webpack_require__(1));
const index_1 = __webpack_require__(2);
const views_1 = __webpack_require__(76);
const commonCommands_1 = __webpack_require__(72);
const serverSettingsManager_1 = __webpack_require__(11);
const activeServerRegistry_1 = __webpack_require__(17);
const visualizeDataModel_1 = __webpack_require__(120);
const tempStorageManager_1 = __webpack_require__(66);
const fileWatcherManager_1 = __webpack_require__(110);
const statusBarDelayTimer_1 = __webpack_require__(111);
const SSEManager_1 = __webpack_require__(22);
const fileToServerMap_1 = __webpack_require__(21);
// Global context reference for cleanup
let extensionContext;
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
async function activate(context) {
    // Store context globally for cleanup
    extensionContext = context;
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "CodeXR" is now active!');
    try {
        // Step 1: Initialize server settings manager and restore settings FIRST
        console.log('SERVER: Initializing server settings manager');
        const settingsManager = serverSettingsManager_1.ServerSettingsManager.getInstance(context);
        await settingsManager.restoreServerSettings();
        console.log('SERVER: Settings restoration completed');
        // Step 2: Initialize active servers registry
        console.log('ACTIVE_SERVERS: Initializing active servers registry');
        const activeServerRegistry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        console.log('ACTIVE_SERVERS: Registry initialized');
        // Step 3: Register the modular tree view AFTER settings are restored
        console.log('MODULAR_TREE: Registering modular tree view with all sections');
        const modularTreeDataProvider = new views_1.ModularTreeDataProvider(context);
        const modularTreeView = vscode.window.createTreeView('codexrTree', {
            treeDataProvider: modularTreeDataProvider,
            showCollapseAll: true,
            canSelectMany: false
        });
        context.subscriptions.push(modularTreeView);
        console.log('MODULAR_TREE: Tree view registered successfully with all sections');
        // Step 3.5: Set up common commands with the modular tree provider
        console.log('COMMON_COMMANDS: Setting up common commands with modular tree provider');
        commonCommands_1.CommonCommands.setModularTreeProvider(modularTreeDataProvider);
        console.log('COMMON_COMMANDS: Common commands configured');
        // Step 3.6: Code Analysis will start background scanning automatically when provider is created
        console.log('CODE_ANALYSIS: Background file scanning will start automatically');
        // Step 4: Register all commands after tree views are created
        (0, index_1.registerAllCommands)(context, modularTreeDataProvider, undefined);
        // Step 5: Reset Visualize Data state to ensure clean UI/model synchronization
        console.log('VISUALIZE-DATA: Resetting state to ensure clean UI/model synchronization');
        visualizeDataModel_1.VisualizeDataModel.resetVisualizeDataState(context);
        console.log('VISUALIZE-DATA: State reset completed');
        // Step 7: Trigger initial refresh to ensure UI reflects loaded settings
        console.log('MODULAR_TREE: Triggering initial tree view refresh with loaded settings');
        vscode.commands.executeCommand('codexr.tree.refresh');
        console.log('MODULAR_TREE: Extension activation completed successfully');
    }
    catch (error) {
        console.error('MODULAR_TREE: Error during extension activation:', error);
        vscode.window.showErrorMessage(`CodeXR activation failed: ${error}`);
    }
}
// This method is called when your extension is deactivated
async function deactivate() {
    console.log('MODULAR_TREE: CodeXR extension deactivated');
    // Cleanup active servers registry
    try {
        console.log('ACTIVE_SERVERS: Cleaning up active servers registry');
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const cleanedCount = registry.cleanupInactiveServers();
        console.log(`ACTIVE_SERVERS: Registry cleanup completed - removed ${cleanedCount} inactive servers`);
    }
    catch (error) {
        console.error('ACTIVE_SERVERS: Error during registry cleanup:', error);
    }
    // Cleanup file watcher manager and status bar timers
    try {
        console.log('CODE_ANALYSIS: Cleaning up file watchers and status bar timers');
        const fileWatcherManager = fileWatcherManager_1.FileWatcherManager.getInstance();
        fileWatcherManager.dispose();
        const statusBarTimer = statusBarDelayTimer_1.StatusBarDelayTimer.getInstance();
        statusBarTimer.dispose();
        console.log('CODE_ANALYSIS: File watcher and timer cleanup completed');
    }
    catch (error) {
        console.error('CODE_ANALYSIS: Error during cleanup:', error);
    }
    // Cleanup analysis temporary storage
    try {
        console.log('ANALYSIS_STORAGE: Cleaning up temporary analysis files');
        await (0, tempStorageManager_1.cleanupAnalysisTemp)(extensionContext);
        console.log('ANALYSIS_STORAGE: Temporary analysis cleanup completed');
    }
    catch (error) {
        console.error('ANALYSIS_STORAGE: Error during analysis temp cleanup:', error);
    }
    // Cleanup SSE manager and file-to-server mapping
    try {
        console.log('SSE: Cleaning up SSE manager and file mappings');
        SSEManager_1.sseManager.dispose();
        fileToServerMap_1.fileToServerMap.clearAll();
        console.log('SSE: SSE and file mapping cleanup completed');
    }
    catch (error) {
        console.error('SSE: Error during SSE cleanup:', error);
    }
}


/***/ }),
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.registerAllCommands = registerAllCommands;
const vscode = __importStar(__webpack_require__(1));
const serverCommands_1 = __webpack_require__(3);
const activeServersCommands_1 = __webpack_require__(33);
const babiaExamplesCommands_1 = __webpack_require__(35);
const visualizeDataCommands_1 = __webpack_require__(39);
const analysisCommands_1 = __webpack_require__(58);
const pythonEnvCommands_1 = __webpack_require__(73);
const visualizationSettingsCommands_1 = __webpack_require__(124);
const generalCommands_1 = __webpack_require__(71);
/**
 * Entry point that registers all extension commands
 */
function registerAllCommands(context, treeDataProvider, babiaExamplesTreeDataProvider) {
    // Register general/common commands first
    (0, generalCommands_1.registerGeneralCommands)(context);
    // Register server commands
    (0, serverCommands_1.registerServerCommands)(context);
    // Register active servers commands with any refreshable tree data provider
    (0, activeServersCommands_1.registerActiveServersCommands)(context, treeDataProvider);
    // Always register Babia examples commands (they work independently now)
    (0, babiaExamplesCommands_1.registerBabiaExamplesCommands)(context, babiaExamplesTreeDataProvider);
    // Register visualize data commands
    (0, visualizeDataCommands_1.registerVisualizeDataCommands)(context);
    // Register code analysis commands
    (0, analysisCommands_1.registerCodeAnalysisCommands)(context);
    // Register Python environment commands
    (0, pythonEnvCommands_1.registerPythonEnvCommands)(context);
    // Register visualization settings commands
    (0, visualizationSettingsCommands_1.registerVisualizationSettingsCommands)(context);
    // Register the existing hello world command
    const helloWorldCommand = vscode.commands.registerCommand('CodeXR.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from Code-XR!');
    });
    context.subscriptions.push(helloWorldCommand);
}


/***/ }),
/* 3 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.registerServerCommands = registerServerCommands;
const vscode = __importStar(__webpack_require__(1));
const serverCommands_1 = __webpack_require__(4);
/**
 * Registers all server-related commands
 */
function registerServerCommands(context) {
    console.log('SERVER: Registering server commands');
    // Set the extension context for server commands
    (0, serverCommands_1.setExtensionContext)(context);
    // Main server commands
    const configureServerCommand = vscode.commands.registerCommand('codexr.server.configure', serverCommands_1.configureServer);
    const startLocalServerCommand = vscode.commands.registerCommand('codexr.server.launch', serverCommands_1.startLocalServer);
    // Configuration option commands (UI stubs)
    const configureHttpModeCommand = vscode.commands.registerCommand('codexr.server.config.httpMode', serverCommands_1.configureHttpMode);
    const configurePortCommand = vscode.commands.registerCommand('codexr.server.config.port', serverCommands_1.configurePort);
    const toggleAutoOpenCommand = vscode.commands.registerCommand('codexr.server.config.autoOpen', serverCommands_1.toggleAutoOpen);
    const configureOpenModeCommand = vscode.commands.registerCommand('codexr.server.config.openMode', serverCommands_1.configureOpenMode);
    const resetToDefaultCommand = vscode.commands.registerCommand('codexr.server.config.resetToDefault', serverCommands_1.resetToDefault);
    context.subscriptions.push(configureServerCommand, startLocalServerCommand, configureHttpModeCommand, configurePortCommand, toggleAutoOpenCommand, configureOpenModeCommand, resetToDefaultCommand);
    console.log('SERVER: Server commands registered successfully');
}


/***/ }),
/* 4 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.configureServer = configureServer;
exports.startLocalServer = startLocalServer;
exports.getCurrentServerConfig = getCurrentServerConfig;
exports.configureHttpMode = configureHttpMode;
exports.configurePort = configurePort;
exports.toggleAutoOpen = toggleAutoOpen;
exports.configureOpenMode = configureOpenMode;
exports.resetToDefault = resetToDefault;
exports.setExtensionContext = setExtensionContext;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(5));
const fs = __importStar(__webpack_require__(6));
const handleConfigurationClicks_1 = __webpack_require__(7);
const multiServerLauncher_1 = __webpack_require__(14);
const serverSettingsManager_1 = __webpack_require__(11);
const previewRenderer_1 = __webpack_require__(24);
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


/***/ }),
/* 5 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 6 */
/***/ ((module) => {

module.exports = require("fs");

/***/ }),
/* 7 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.handleHttpModeClick = handleHttpModeClick;
exports.handlePortClick = handlePortClick;
exports.handleAutoOpenClick = handleAutoOpenClick;
exports.handleOpenModeClick = handleOpenModeClick;
const vscode = __importStar(__webpack_require__(1));
const configurationItems_1 = __webpack_require__(8);
/**
 * Handle HTTP Mode configuration click
 */
async function handleHttpModeClick() {
    console.log('SERVER: HTTP Mode configuration clicked');
    const options = [
        'HTTP',
        'HTTPS (default certificates)',
        'HTTPS (custom certificates)'
    ];
    const selected = await vscode.window.showQuickPick(options, {
        placeHolder: 'Select HTTP mode',
        canPickMany: false
    });
    if (selected) {
        // Handle HTTP mode selection with confirmation dialog
        if (selected === 'HTTP') {
            const confirmed = await vscode.window.showWarningMessage('HTTP is not secure and XR features like VR will not work. Are you sure you want to proceed?', { modal: true }, 'Yes', 'No');
            if (confirmed !== 'Yes') {
                console.log('SERVER: HTTP mode selection cancelled by user');
                return;
            }
            console.log('SERVER: HTTP mode confirmed by user');
        }
        // Handle HTTPS with custom certificates
        if (selected === 'HTTPS (custom certificates)') {
            console.log('SERVER: HTTPS custom certificates selected, opening file pickers');
            // First: Select certificate file (cert.pem)
            const certFileUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'Certificate files': ['pem', 'crt', 'cert']
                },
                openLabel: 'Select Certificate File (cert.pem)'
            });
            if (!certFileUri || certFileUri.length === 0) {
                console.log('SERVER: Certificate file selection cancelled');
                return;
            }
            const certPath = certFileUri[0].fsPath;
            console.log(`SERVER: Certificate file selected: ${certPath}`);
            // Second: Select private key file (key.pem)
            const keyFileUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'Key files': ['pem', 'key']
                },
                openLabel: 'Select Private Key File (key.pem)'
            });
            if (!keyFileUri || keyFileUri.length === 0) {
                console.log('SERVER: Private key file selection cancelled');
                return;
            }
            const keyPath = keyFileUri[0].fsPath;
            console.log(`SERVER: Private key file selected: ${keyPath}`);
            console.log(`SERVER: Custom certificate configuration - Cert: ${certPath}, Key: ${keyPath}`);
            // Store the custom certificate configuration in a single update
            await (0, configurationItems_1.updateServerConfig)({
                httpMode: selected,
                customCertPath: certPath,
                customKeyPath: keyPath
            });
            console.log(`SERVER: HTTP mode changed to ${selected} with custom certificates`);
            vscode.window.showInformationMessage(`SERVER: HTTPS mode updated with custom certificates`);
        }
        else {
            // Handle HTTP and HTTPS with default certificates
            await (0, configurationItems_1.updateServerConfig)({ httpMode: selected });
            console.log(`SERVER: HTTP mode changed to ${selected}`);
            vscode.window.showInformationMessage(`SERVER: HTTP mode updated to ${selected}`);
        }
    }
}
/**
 * Handle Default Port configuration click
 */
async function handlePortClick() {
    console.log('SERVER: Port configuration clicked');
    const input = await vscode.window.showInputBox({
        prompt: 'Enter port number (3000-8080)',
        placeHolder: '3000',
        validateInput: (value) => {
            const num = parseInt(value);
            if (isNaN(num)) {
                return 'Please enter a valid number';
            }
            if (num < 3000 || num > 8080) {
                return 'Port must be between 3000 and 8080';
            }
            return null;
        }
    });
    if (input) {
        const port = parseInt(input);
        await (0, configurationItems_1.updateServerConfig)({ port });
        console.log(`SERVER: Port changed to ${port}`);
        vscode.window.showInformationMessage(`SERVER: Port updated to ${port}`);
    }
}
/**
 * Handle Auto-Open toggle click
 */
async function handleAutoOpenClick() {
    console.log('SERVER: Auto-Open toggle clicked');
    const currentConfig = (0, configurationItems_1.getServerConfig)();
    const newValue = !currentConfig.autoOpen;
    await (0, configurationItems_1.updateServerConfig)({ autoOpen: newValue });
    console.log(`SERVER: Auto-Open toggled to ${newValue ? 'Yes' : 'No'}`);
    const message = newValue ? 'Auto-Open enabled' : 'Auto-Open disabled';
    vscode.window.showInformationMessage(`SERVER: ${message}`);
}
/**
 * Handle Open Mode configuration click
 */
async function handleOpenModeClick() {
    console.log('SERVER: Open Mode configuration clicked');
    const currentConfig = (0, configurationItems_1.getServerConfig)();
    const newMode = currentConfig.openMode === 'Browser' ? 'Lateral Panel' : 'Browser';
    await (0, configurationItems_1.updateServerConfig)({ openMode: newMode });
    console.log(`SERVER: Open Mode changed to ${newMode}`);
    vscode.window.showInformationMessage(`SERVER: Open Mode set to ${newMode}`);
}


/***/ }),
/* 8 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getServerConfig = getServerConfig;
exports.updateServerConfig = updateServerConfig;
exports.createConfigurationItems = createConfigurationItems;
const vscode = __importStar(__webpack_require__(1));
const unifiedServersTreeView_1 = __webpack_require__(9);
const serverNodeIcons_1 = __webpack_require__(10);
const serverSettingsManager_1 = __webpack_require__(11);
/**
 * Get current server configuration
 */
function getServerConfig() {
    return serverSettingsManager_1.ServerSettingsManager.getInstance().getLegacyConfig();
}
/**
 * Update server configuration
 */
async function updateServerConfig(updates) {
    const manager = serverSettingsManager_1.ServerSettingsManager.getInstance();
    await manager.updateFromLegacyConfig(updates);
}
/**
 * Create configuration items for the server tree view
 */
function createConfigurationItems() {
    const config = getServerConfig();
    // Determine icon based on HTTP mode security
    const httpModeIcon = config.httpMode === 'HTTP'
        ? serverNodeIcons_1.ServerNodeIcons.httpModeUnsecure
        : serverNodeIcons_1.ServerNodeIcons.httpModeSecure;
    return [
        new unifiedServersTreeView_1.ServerTreeItem(`HTTP Mode: ${config.httpMode}`, vscode.TreeItemCollapsibleState.None, 'config-option', {
            command: 'codexr.server.config.httpMode',
            title: 'Configure HTTP Mode'
        }, serverNodeIcons_1.ServerNodeIcons.httpMode, `Click to change server mode (currently: ${config.httpMode})`),
        new unifiedServersTreeView_1.ServerTreeItem(`Default Port: ${config.port}`, vscode.TreeItemCollapsibleState.None, 'config-option', {
            command: 'codexr.server.config.port',
            title: 'Configure Port'
        }, serverNodeIcons_1.ServerNodeIcons.defaultPort, `Click to change default port (currently: ${config.port})`),
        new unifiedServersTreeView_1.ServerTreeItem(`Auto-Open: ${config.autoOpen ? 'Enabled' : 'Disabled'}`, vscode.TreeItemCollapsibleState.None, 'config-option', {
            command: 'codexr.server.config.autoOpen',
            title: 'Toggle Auto-Open'
        }, serverNodeIcons_1.ServerNodeIcons.autoOpen, `Click to toggle auto-open (currently: ${config.autoOpen ? 'enabled' : 'disabled'})`),
        new unifiedServersTreeView_1.ServerTreeItem(`Open Mode: ${config.openMode}`, vscode.TreeItemCollapsibleState.None, 'config-option', {
            command: 'codexr.server.config.openMode',
            title: 'Configure Open Mode'
        }, serverNodeIcons_1.ServerNodeIcons.openMode, `Click to change open mode (currently: ${config.openMode})`),
        new unifiedServersTreeView_1.ServerTreeItem('Reset to Default', vscode.TreeItemCollapsibleState.None, 'config-option', {
            command: 'codexr.server.config.resetToDefault',
            title: 'Reset to Default Settings'
        }, serverNodeIcons_1.ServerNodeIcons.reset, 'Reset all server configuration to default values')
    ];
}


/***/ }),
/* 9 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ServersTreeDataProvider = exports.ServerTreeItem = void 0;
const vscode = __importStar(__webpack_require__(1));
const configurationItems_1 = __webpack_require__(8);
const configurationItems_2 = __webpack_require__(8);
const serverNodeIcons_1 = __webpack_require__(10);
/**
 * Server tree item that represents server configuration and launch options
 * This class is specific to the servers section only
 */
class ServerTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    type;
    command;
    iconPath;
    tooltip;
    description;
    contextValue;
    constructor(label, collapsibleState, type, command, iconPath, tooltip, description, contextValue) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.type = type;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip;
        this.description = description;
        this.contextValue = contextValue;
        this.tooltip = tooltip || this.label;
        this.iconPath = iconPath;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.ServerTreeItem = ServerTreeItem;
/**
 * Servers tree data provider that handles only the SERVERS section
 *
 * Architecture Notes:
 * - This view is specific to server configuration and launch
 * - Follows the modular architecture pattern with items/ and interactions/ directories
 * - Delegates to appropriate handlers for user interactions
 */
class ServersTreeDataProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    constructor(context) {
        this.context = context;
        console.log('SERVERS_TREE: Servers tree data provider initialized');
        // Register refresh command (only if not already registered)
        try {
            vscode.commands.registerCommand('codexr.servers.refreshServers', () => {
                this.refresh();
            });
        }
        catch (error) {
            // Command might already be registered, ignore this error
            console.log('SERVERS_TREE: Refresh servers command already registered');
        }
    }
    /**
     * Refresh the tree view
     */
    refresh() {
        console.log('SERVERS_TREE: Refreshing servers tree view');
        this._onDidChangeTreeData.fire();
    }
    /**
     * Get tree item representation
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Get children for the tree view
     */
    getChildren(element) {
        if (!element) {
            // Root level - return the SERVERS section
            console.log('SERVERS_TREE: Loading root SERVERS section');
            return Promise.resolve([
                new ServerTreeItem('SERVERS', vscode.TreeItemCollapsibleState.Expanded, 'section', undefined, new vscode.ThemeIcon('server-environment'), 'Server configuration and launch options')
            ]);
        }
        switch (element.type) {
            case 'section':
                if (element.label === 'SERVERS') {
                    return this.getServersChildren();
                }
                break;
            case 'config-group':
                if (element.label === 'Server Configuration') {
                    return this.getServerConfigChildren();
                }
                break;
            default:
                return Promise.resolve([]);
        }
        return Promise.resolve([]);
    }
    /**
     * Get children for the SERVERS section
     */
    getServersChildren() {
        console.log('SERVERS_TREE: Loading servers section children');
        const config = (0, configurationItems_1.getServerConfig)();
        return Promise.resolve([
            new ServerTreeItem('Server Configuration', vscode.TreeItemCollapsibleState.Collapsed, 'config-group', undefined, serverNodeIcons_1.ServerNodeIcons.configuration, 'Configure server settings'),
            new ServerTreeItem('Start Local Server', vscode.TreeItemCollapsibleState.None, 'launch-option', {
                command: 'codexr.server.launch',
                title: 'Start Local Server'
            }, serverNodeIcons_1.ServerNodeIcons.startServer, `Start server on port ${config.port} (${config.httpMode})`)
        ]);
    }
    /**
     * Get children for the server configuration group
     */
    getServerConfigChildren() {
        console.log('SERVERS_TREE: Loading server configuration children');
        const configItems = (0, configurationItems_2.createConfigurationItems)();
        const children = configItems.map(item => new ServerTreeItem(item.label, vscode.TreeItemCollapsibleState.None, 'config-option', item.command, item.iconPath, item.tooltip, item.description));
        return Promise.resolve(children);
    }
}
exports.ServersTreeDataProvider = ServersTreeDataProvider;


/***/ }),
/* 10 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ServerNodeIcons = void 0;
const vscode = __importStar(__webpack_require__(1));
/**
 * VS Code icon references for server tree items
 */
exports.ServerNodeIcons = {
    // Main groups
    servers: new vscode.ThemeIcon('server-environment'),
    configuration: new vscode.ThemeIcon('gear'),
    startServer: new vscode.ThemeIcon('play'),
    // Configuration options
    httpMode: new vscode.ThemeIcon('globe'),
    httpModeSecure: new vscode.ThemeIcon('lock'),
    httpModeUnsecure: new vscode.ThemeIcon('unlock'),
    defaultPort: new vscode.ThemeIcon('plug'),
    autoOpen: new vscode.ThemeIcon('eye'),
    openMode: new vscode.ThemeIcon('layout'),
    reset: new vscode.ThemeIcon('discard'),
    // Active servers actions
    stopAll: new vscode.ThemeIcon('stop-circle')
};


/***/ }),
/* 11 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ServerSettingsManager = exports.DEFAULT_SERVER_SETTINGS = void 0;
const vscode = __importStar(__webpack_require__(1));
const fs = __importStar(__webpack_require__(6));
const path = __importStar(__webpack_require__(5));
const nonceGenerator_1 = __webpack_require__(12);
/**
 * Default server settings
 */
exports.DEFAULT_SERVER_SETTINGS = {
    mode: 'HTTPS',
    https: {
        certSource: 'default',
        certPath: '',
        keyPath: ''
    },
    defaultPort: 3000,
    launch: {
        autoOpen: true,
        openMode: 'browser'
    },
    configNonce: (0, nonceGenerator_1.generateNonce)(),
    version: '1.0.0'
};
/**
 * Server Settings Manager
 * Handles structured storage and retrieval of server configuration using file system
 */
class ServerSettingsManager {
    static instance;
    settings;
    context;
    SETTINGS_FILENAME = 'server-settings.json';
    settingsFilePath;
    constructor(context) {
        this.context = context;
        this.settings = { ...exports.DEFAULT_SERVER_SETTINGS };
        this.settingsFilePath = path.join(context.globalStorageUri.fsPath, this.SETTINGS_FILENAME);
        this.ensureStorageDirectory();
    }
    /**
     * Ensure the global storage directory exists
     */
    ensureStorageDirectory() {
        const storageDir = path.dirname(this.settingsFilePath);
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
            console.log(`SERVER: Created storage directory: ${storageDir}`);
        }
    }
    /**
     * Get singleton instance
     */
    static getInstance(context) {
        if (!ServerSettingsManager.instance) {
            if (!context) {
                throw new Error('SERVER: Context required for first initialization');
            }
            ServerSettingsManager.instance = new ServerSettingsManager(context);
        }
        return ServerSettingsManager.instance;
    }
    /**
     * Get current server settings
     */
    getServerSettings() {
        return { ...this.settings };
    }
    /**
     * Get extension context
     */
    getExtensionContext() {
        return this.context;
    }
    /**
     * Update server settings
     */
    async updateServerSettings(updates) {
        console.log('SERVER: Updating server settings', updates);
        // Deep merge the updates
        this.settings = this.deepMerge(this.settings, updates);
        this.settings.configNonce = (0, nonceGenerator_1.generateNonce)();
        // Persist to file system asynchronously
        await this.persistSettings();
        // Refresh the tree view
        vscode.commands.executeCommand('codexr.servers.refresh');
    }
    /**
     * Restore server settings from file system
     */
    async restoreServerSettings() {
        console.log('SERVER: Restoring server settings from file system');
        console.log('SERVER: Settings file path:', this.settingsFilePath);
        try {
            if (fs.existsSync(this.settingsFilePath)) {
                console.log('SERVER: Settings file exists, reading content...');
                const fileContent = await fs.promises.readFile(this.settingsFilePath, 'utf8');
                const savedSettings = JSON.parse(fileContent);
                console.log('SERVER: Loaded settings from file:', savedSettings);
                // Validate and merge with defaults to ensure all required fields exist
                this.settings = this.deepMerge(exports.DEFAULT_SERVER_SETTINGS, savedSettings);
                // Regenerate nonce on restore for security
                this.settings.configNonce = (0, nonceGenerator_1.generateNonce)();
                console.log('SERVER: Settings merged with defaults and nonce regenerated');
                console.log('SERVER: Final restored settings:', this.settings);
                // Persist the updated settings with new nonce
                await this.persistSettings();
                console.log('SERVER: Settings successfully restored from file system');
            }
            else {
                console.log('SERVER: No saved settings file found at:', this.settingsFilePath);
                console.log('SERVER: Using default settings and creating initial file');
                this.settings = { ...exports.DEFAULT_SERVER_SETTINGS };
                await this.persistSettings();
                console.log('SERVER: Default settings applied and file created');
            }
        }
        catch (error) {
            console.error('SERVER: Error restoring settings from file system:', error);
            console.log('SERVER: Falling back to default settings');
            this.settings = { ...exports.DEFAULT_SERVER_SETTINGS };
            await this.persistSettings();
        }
    }
    /**
     * Persist settings to file system
     */
    async persistSettings() {
        try {
            this.ensureStorageDirectory();
            const settingsJson = JSON.stringify(this.settings, null, 2);
            await fs.promises.writeFile(this.settingsFilePath, settingsJson, 'utf8');
            console.log(`SERVER: Settings persisted to file system: ${this.settingsFilePath}`);
        }
        catch (error) {
            console.error('SERVER: Error persisting settings to file system', error);
            throw error;
        }
    }
    /**
     * Reset settings to defaults
     */
    async resetSettings() {
        console.log('SERVER: Resetting settings to defaults');
        this.settings = { ...exports.DEFAULT_SERVER_SETTINGS };
        this.settings.configNonce = (0, nonceGenerator_1.generateNonce)();
        await this.persistSettings();
        vscode.commands.executeCommand('codexr.servers.refresh');
    }
    /**
     * Get the path to the settings file
     */
    getSettingsFilePath() {
        return this.settingsFilePath;
    }
    /**
     * Deep merge utility for partial updates
     */
    deepMerge(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            }
            else {
                result[key] = source[key];
            }
        }
        return result;
    }
    /**
     * Get settings in legacy format for UI compatibility
     */
    getLegacyConfig() {
        let httpModeDisplay;
        if (this.settings.mode === 'HTTP') {
            httpModeDisplay = 'HTTP';
        }
        else {
            // HTTPS mode
            if (this.settings.https.certSource === 'default') {
                httpModeDisplay = 'HTTPS (default certificates)';
            }
            else {
                // Custom certificates - show paths if available for debugging
                const certInfo = this.settings.https.certPath && this.settings.https.keyPath
                    ? ` [Cert: ${this.settings.https.certPath}, Key: ${this.settings.https.keyPath}]`
                    : ' [Paths not configured]';
                httpModeDisplay = `HTTPS (custom certificates)${certInfo}`;
                console.log('SERVER: Custom HTTPS certificate status:', {
                    certPath: this.settings.https.certPath,
                    keyPath: this.settings.https.keyPath,
                    certSource: this.settings.https.certSource
                });
            }
        }
        const openModeDisplay = this.settings.launch.openMode === 'browser' ? 'Browser' : 'Lateral Panel';
        const config = {
            httpMode: httpModeDisplay,
            port: this.settings.defaultPort,
            autoOpen: this.settings.launch.autoOpen,
            openMode: openModeDisplay
        };
        console.log('SERVER: Legacy config generated:', config);
        return config;
    }
    /**
     * Update settings from legacy format
     */
    async updateFromLegacyConfig(updates) {
        const newUpdates = {};
        // Handle HTTP mode changes
        if (updates.httpMode) {
            if (updates.httpMode === 'HTTP') {
                newUpdates.mode = 'HTTP';
            }
            else if (updates.httpMode === 'HTTPS (default certificates)') {
                newUpdates.mode = 'HTTPS';
                newUpdates.https = {
                    ...this.settings.https,
                    certSource: 'default'
                };
            }
            else if (updates.httpMode === 'HTTPS (custom certificates)') {
                newUpdates.mode = 'HTTPS';
                newUpdates.https = {
                    ...this.settings.https,
                    certSource: 'custom'
                };
            }
        }
        // Handle certificate and key path updates
        // Merge these into the existing https object to avoid overwriting
        if (updates.customCertPath !== undefined || updates.customKeyPath !== undefined) {
            const currentHttps = newUpdates.https || this.settings.https;
            newUpdates.https = {
                ...currentHttps,
                ...(updates.customCertPath !== undefined && { certPath: updates.customCertPath }),
                ...(updates.customKeyPath !== undefined && { keyPath: updates.customKeyPath })
            };
            console.log('SERVER: Updating HTTPS certificate paths', {
                certPath: newUpdates.https.certPath,
                keyPath: newUpdates.https.keyPath,
                certSource: newUpdates.https.certSource
            });
        }
        // Handle port updates
        if (updates.port !== undefined) {
            newUpdates.defaultPort = updates.port;
        }
        // Handle launch configuration updates
        if (updates.autoOpen !== undefined || updates.openMode !== undefined) {
            newUpdates.launch = {
                ...this.settings.launch,
                ...(updates.autoOpen !== undefined && { autoOpen: updates.autoOpen }),
                ...(updates.openMode !== undefined && {
                    openMode: updates.openMode === 'Browser' ? 'browser' : 'lateralPanel'
                })
            };
        }
        console.log('SERVER: Legacy config update merged:', newUpdates);
        await this.updateServerSettings(newUpdates);
    }
}
exports.ServerSettingsManager = ServerSettingsManager;


/***/ }),
/* 12 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.generateNonce = generateNonce;
exports.generateTimestampedNonce = generateTimestampedNonce;
exports.validateNonce = validateNonce;
exports.validateTimestampedNonce = validateTimestampedNonce;
const crypto_1 = __webpack_require__(13);
/**
 * Generates a cryptographically secure nonce (number used once) for configuration tracking.
 * Uses Node.js crypto module to create unpredictable random values.
 *
 * @param length - The length of the nonce in bytes (default: 16 bytes = 128 bits)
 * @returns A hex-encoded string representing the nonce
 */
function generateNonce(length = 16) {
    return (0, crypto_1.randomBytes)(length).toString('hex');
}
/**
 * Generates a timestamped nonce that includes both time and random components.
 * Useful for scenarios where temporal ordering is important alongside uniqueness.
 *
 * @param length - The length of the random component in bytes (default: 8 bytes)
 * @returns A hex-encoded string with timestamp prefix and random suffix
 */
function generateTimestampedNonce(length = 8) {
    const timestamp = Date.now().toString(16);
    const random = (0, crypto_1.randomBytes)(length).toString('hex');
    return `${timestamp}-${random}`;
}
/**
 * Validates that a nonce has the expected format and length.
 *
 * @param nonce - The nonce to validate
 * @param expectedLength - Expected length in bytes (default: 16)
 * @returns True if the nonce is valid, false otherwise
 */
function validateNonce(nonce, expectedLength = 16) {
    if (typeof nonce !== 'string') {
        return false;
    }
    // Check if it's a hex string of expected length
    const expectedHexLength = expectedLength * 2;
    // Special case: zero length is valid if we expect zero length
    if (expectedHexLength === 0) {
        return nonce.length === 0;
    }
    // Check non-empty nonce
    if (!nonce) {
        return false;
    }
    const hexPattern = /^[0-9a-f]+$/i;
    return nonce.length === expectedHexLength && hexPattern.test(nonce);
}
/**
 * Validates timestamped nonce format.
 *
 * @param nonce - The timestamped nonce to validate
 * @returns True if the nonce has valid timestamped format, false otherwise
 */
function validateTimestampedNonce(nonce) {
    if (!nonce || typeof nonce !== 'string') {
        return false;
    }
    // Check format: timestamp-random
    const parts = nonce.split('-');
    if (parts.length !== 2) {
        return false;
    }
    const [timestampHex, randomHex] = parts;
    const hexPattern = /^[0-9a-f]+$/i;
    return hexPattern.test(timestampHex) && hexPattern.test(randomHex);
}


/***/ }),
/* 13 */
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),
/* 14 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MultiServerLauncher = void 0;
const vscode = __importStar(__webpack_require__(1));
const portManager_1 = __webpack_require__(15);
const serverSettingsManager_1 = __webpack_require__(11);
const activeServerRegistry_1 = __webpack_require__(17);
const handleServerActions_1 = __webpack_require__(18);
const serverRegistrar_1 = __webpack_require__(25);
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
        const { ServerLauncher } = __webpack_require__(26);
        // Create a temporary launcher instance to use the existing server creation logic
        const tempLauncher = new ServerLauncher(this.context);
        // Use reflection to access private methods - this is a bridge solution
        // until we can refactor the server creation logic into shared utilities
        const launchMethod = tempLauncher.launchServerByType.bind(tempLauncher);
        try {
            let result;
            if (htmlFile) {
                // Extract directory and filename from the HTML file path
                const path = __webpack_require__(5);
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


/***/ }),
/* 15 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PortManager = void 0;
const net = __importStar(__webpack_require__(16));
/**
 * Port availability checker and manager
 * Provides utilities to find available ports starting from a given port number
 */
class PortManager {
    static DEFAULT_START_PORT = 3000;
    static DEFAULT_END_PORT = 8080;
    static MAX_RETRIES = 50;
    /**
     * Check if a specific port is available
     * @param port - The port number to check
     * @returns Promise<boolean> - True if port is available, false otherwise
     */
    static async isPortAvailable(port) {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.listen(port, () => {
                server.close(() => {
                    console.log(`SERVER: Port ${port} is available`);
                    resolve(true);
                });
            });
            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    console.log(`SERVER: Port ${port} is already in use`);
                    resolve(false);
                }
                else {
                    console.error(`SERVER: Error checking port ${port}:`, err);
                    resolve(false);
                }
            });
        });
    }
    /**
     * Find the next available port starting from the specified port using get-port library
     * @param startPort - The port to start searching from
     * @param endPort - The maximum port to check (optional, defaults to 8080)
     * @returns Promise<number> - The first available port found
     * @throws Error if no available port is found within the range
     */
    static async findAvailablePort(startPort = PortManager.DEFAULT_START_PORT, endPort = PortManager.DEFAULT_END_PORT) {
        console.log(`SERVER: Searching for available port starting from ${startPort}`);
        // Validate inputs
        if (startPort < 1 || startPort > 65535) {
            throw new Error(`SERVER: Invalid start port ${startPort}. Must be between 1 and 65535`);
        }
        if (endPort < startPort || endPort > 65535) {
            throw new Error(`SERVER: Invalid end port ${endPort}. Must be between ${startPort} and 65535`);
        }
        try {
            // Use get-port for more reliable port detection
            const getPort = (await __webpack_require__.e(/* import() */ 1).then(__webpack_require__.bind(__webpack_require__, 121))).default;
            // Create a range array for get-port - limit to reasonable range for performance
            const maxRange = Math.min(endPort - startPort + 1, 50); // Limit to 50 ports max
            const ports = [];
            for (let i = 0; i < maxRange; i++) {
                const port = startPort + i;
                if (port <= endPort) {
                    ports.push(port);
                }
            }
            console.log(`SERVER: Searching through ${ports.length} ports starting from ${startPort}`);
            const availablePort = await getPort({
                port: ports,
                host: 'localhost'
            });
            console.log(`SERVER: get-port found available port: ${availablePort}`);
            return availablePort;
        }
        catch (error) {
            console.error(`SERVER: get-port failed, falling back to manual detection:`, error);
            // Fallback to the original manual implementation
            console.log(`SERVER: Using fallback manual port detection from ${startPort} to ${endPort}`);
            let currentPort = startPort;
            let attempts = 0;
            const maxAttempts = Math.min(endPort - startPort + 1, PortManager.MAX_RETRIES);
            while (attempts < maxAttempts) {
                if (currentPort > endPort) {
                    break;
                }
                console.log(`SERVER: Checking port ${currentPort}...`);
                if (await PortManager.isPortAvailable(currentPort)) {
                    console.log(`SERVER: Found available port (fallback): ${currentPort}`);
                    return currentPort;
                }
                currentPort++;
                attempts++;
            }
            throw new Error(`SERVER: No available port found in range ${startPort}-${endPort} after ${attempts} attempts`);
        }
    }
    /**
     * Find multiple available ports
     * @param count - Number of ports needed
     * @param startPort - The port to start searching from
     * @param endPort - The maximum port to check
     * @returns Promise<number[]> - Array of available ports
     */
    static async findMultipleAvailablePorts(count, startPort = PortManager.DEFAULT_START_PORT, endPort = PortManager.DEFAULT_END_PORT) {
        if (count <= 0) {
            throw new Error('SERVER: Port count must be greater than 0');
        }
        console.log(`SERVER: Searching for ${count} available ports starting from ${startPort}`);
        const availablePorts = [];
        let currentPort = startPort;
        while (availablePorts.length < count && currentPort <= endPort) {
            if (await PortManager.isPortAvailable(currentPort)) {
                availablePorts.push(currentPort);
                console.log(`SERVER: Found port ${currentPort} (${availablePorts.length}/${count})`);
            }
            currentPort++;
        }
        if (availablePorts.length < count) {
            throw new Error(`SERVER: Only found ${availablePorts.length} available ports, needed ${count}`);
        }
        return availablePorts;
    }
    /**
     * Validate port number
     * @param port - Port number to validate
     * @returns boolean - True if port is valid
     */
    static isValidPort(port) {
        return Number.isInteger(port) && port >= 1 && port <= 65535;
    }
    /**
     * Get a random port within a range
     * @param min - Minimum port number
     * @param max - Maximum port number
     * @returns number - Random port number
     */
    static getRandomPort(min = 3000, max = 8080) {
        if (!PortManager.isValidPort(min) || !PortManager.isValidPort(max) || min > max) {
            throw new Error(`SERVER: Invalid port range ${min}-${max}`);
        }
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    /**
     * Check if port is in privileged range (1-1023)
     * @param port - Port number to check
     * @returns boolean - True if port is privileged
     */
    static isPrivilegedPort(port) {
        return port >= 1 && port <= 1023;
    }
    /**
     * Get suggested ports based on service type
     * @param serviceType - Type of service ('http', 'https', 'dev')
     * @returns number[] - Array of suggested ports
     */
    static getSuggestedPorts(serviceType) {
        switch (serviceType) {
            case 'http':
                return [3000, 8000, 8080, 8008, 3001];
            case 'https':
                return [3443, 8443, 3001, 4443, 5443];
            case 'dev':
                return [3000, 3001, 3002, 8000, 8080, 8888];
            default:
                return [3000, 3001, 8000, 8080];
        }
    }
}
exports.PortManager = PortManager;


/***/ }),
/* 16 */
/***/ ((module) => {

module.exports = require("net");

/***/ }),
/* 17 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ActiveServerRegistry = void 0;
exports.getActiveServerRegistry = getActiveServerRegistry;
exports.registerActiveServer = registerActiveServer;
const vscode = __importStar(__webpack_require__(1));
/**
 * Active Server Registry
 * Centralized tracking and management of all active servers
 */
class ActiveServerRegistry {
    static instance = null;
    servers = new Map();
    eventEmitter = new vscode.EventEmitter();
    /** Event fired when registry changes */
    onRegistryChange = this.eventEmitter.event;
    constructor() {
        console.log('ACTIVE_SERVERS: Registry initialized');
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!ActiveServerRegistry.instance) {
            ActiveServerRegistry.instance = new ActiveServerRegistry();
        }
        return ActiveServerRegistry.instance;
    }
    /**
     * Register a new active server
     */
    registerServer(config) {
        console.log('SERVER: registerServer called with config:', {
            port: config.port,
            htmlFile: config.htmlFile,
            customName: config.customName,
            url: config.url
        });
        const serverId = this.generateServerId(config.port, config.timestamp);
        const server = {
            id: serverId,
            port: config.port,
            url: config.url,
            launchMode: config.launchMode,
            certMode: config.certMode,
            timestamp: config.timestamp,
            status: 'running',
            htmlFile: config.htmlFile,
            customName: config.customName,
            serverInstance: config.serverInstance,
            metadata: config.metadata
        };
        this.servers.set(serverId, server);
        // Enhanced logging for custom names
        console.log(`ACTIVE_SERVERS: Registered server ${serverId} at ${config.url} (${config.certMode}/${config.launchMode})`);
        if (config.customName && config.customName.trim().length > 0) {
            console.log(`ACTIVE_SERVERS: Received custom name from launcher: ${config.customName}`);
            console.log(`ACTIVE_SERVERS: Registering server with name: ${config.customName}`);
        }
        else {
            const fallbackName = `localhost:${config.port}`;
            console.log(`ACTIVE_SERVERS: No custom name provided. Using default name: ${fallbackName}`);
        }
        this.emitEvent('serverAdded', serverId, server);
        return server;
    }
    /**
     * Remove a server from the registry
     */
    unregisterServer(serverId) {
        const server = this.servers.get(serverId);
        if (!server) {
            console.warn(`ACTIVE_SERVERS: Attempted to unregister non-existent server: ${serverId}`);
            return false;
        }
        this.servers.delete(serverId);
        console.log(`ACTIVE_SERVERS: Unregistered server ${serverId} (${server.url})`);
        this.emitEvent('serverRemoved', serverId, server);
        return true;
    }
    /**
     * Update server status
     */
    updateServerStatus(serverId, status) {
        const server = this.servers.get(serverId);
        if (!server) {
            console.warn(`ACTIVE_SERVERS: Attempted to update status of non-existent server: ${serverId}`);
            return false;
        }
        server.status = status;
        console.log(`ACTIVE_SERVERS: Updated server ${serverId} status to ${status}`);
        this.emitEvent('serverUpdated', serverId, server);
        return true;
    }
    /**
     * Get server by ID
     */
    getServer(serverId) {
        return this.servers.get(serverId);
    }
    /**
     * Get all active servers
     */
    getAllServers() {
        return Array.from(this.servers.values());
    }
    /**
     * Get servers by status
     */
    getServersByStatus(status) {
        return this.getAllServers().filter(server => server.status === status);
    }
    /**
     * Get servers by port
     */
    getServerByPort(port) {
        return this.getAllServers().find(server => server.port === port);
    }
    /**
     * Check if a server is registered
     */
    hasServer(serverId) {
        return this.servers.has(serverId);
    }
    /**
     * Get count of active servers
     */
    getServerCount() {
        return this.servers.size;
    }
    /**
     * Get count of running servers
     */
    getRunningServerCount() {
        return this.getServersByStatus('running').length;
    }
    /**
     * Clear all servers from registry
     */
    clearAll() {
        const count = this.servers.size;
        this.servers.clear();
        console.log(`ACTIVE_SERVERS: Cleared all servers (${count} removed)`);
        this.emitEvent('registryCleared');
    }
    /**
     * Cleanup stopped/error servers
     */
    cleanupInactiveServers() {
        const inactiveServers = this.getAllServers().filter(server => server.status === 'stopped' || server.status === 'error');
        let removedCount = 0;
        for (const server of inactiveServers) {
            if (this.unregisterServer(server.id)) {
                removedCount++;
            }
        }
        if (removedCount > 0) {
            console.log(`ACTIVE_SERVERS: Cleaned up ${removedCount} inactive servers`);
        }
        return removedCount;
    }
    /**
     * Get registry statistics
     */
    getStats() {
        const servers = this.getAllServers();
        const stats = {
            total: servers.length,
            running: 0,
            stopped: 0,
            error: 0,
            byMode: {},
            byCertMode: {}
        };
        for (const server of servers) {
            // Count by status
            stats[server.status]++;
            // Count by launch mode
            stats.byMode[server.launchMode] = (stats.byMode[server.launchMode] || 0) + 1;
            // Count by cert mode
            stats.byCertMode[server.certMode] = (stats.byCertMode[server.certMode] || 0) + 1;
        }
        return stats;
    }
    /**
     * Dispose of the registry
     */
    dispose() {
        this.eventEmitter.dispose();
        this.clearAll();
        console.log('ACTIVE_SERVERS: Registry disposed');
    }
    /**
     * Generate unique server ID
     * @private
     */
    generateServerId(port, timestamp) {
        return `server-${port}-${timestamp}`;
    }
    /**
     * Emit registry event
     * @private
     */
    emitEvent(type, serverId, server) {
        const event = {
            type,
            serverId,
            server,
            timestamp: Date.now()
        };
        this.eventEmitter.fire(event);
    }
}
exports.ActiveServerRegistry = ActiveServerRegistry;
/**
 * Convenience function to get the registry instance
 */
function getActiveServerRegistry() {
    return ActiveServerRegistry.getInstance();
}
/**
 * Convenience function to register a server
 */
function registerActiveServer(config) {
    return getActiveServerRegistry().registerServer(config);
}


/***/ }),
/* 18 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ServerActionHandlers = void 0;
const vscode = __importStar(__webpack_require__(1));
const activeServerRegistry_1 = __webpack_require__(17);
const serverControl_1 = __webpack_require__(19);
const previewRenderer_1 = __webpack_require__(24);
/**
 * Server Action Handlers
 * Handle user interactions with active servers
 */
class ServerActionHandlers {
    /**
     * Show server actions quick pick
     */
    static async showServerActions(serverId) {
        console.log(`ACTIVE_SERVER: Showing actions for server ${serverId}`);
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
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
    static async openInBrowser(serverId) {
        console.log(`ACTIVE_SERVER: Opening server ${serverId} in browser`);
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const server = registry.getServer(serverId);
        if (!server) {
            console.error(`ACTIVE_SERVER: Server ${serverId} not found`);
            vscode.window.showErrorMessage(`Server not found: ${serverId}`);
            return;
        }
        try {
            await previewRenderer_1.PreviewRenderer.openPreview(server.url, server.htmlFile || '', 'browser');
            console.log(`ACTIVE_SERVER: Opened ${server.url} in browser`);
            vscode.window.showInformationMessage(`Opened ${server.url} in browser`);
        }
        catch (error) {
            console.error(`ACTIVE_SERVER: Error opening ${server.url} in browser:`, error);
            vscode.window.showErrorMessage(`Failed to open in browser: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Open server in lateral panel
     */
    static async openInPanel(serverId) {
        console.log(`ACTIVE_SERVER: Opening server ${serverId} in lateral panel`);
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const server = registry.getServer(serverId);
        if (!server) {
            console.error(`ACTIVE_SERVER: Server ${serverId} not found`);
            vscode.window.showErrorMessage(`Server not found: ${serverId}`);
            return;
        }
        // Check for HTTPS + lateral panel conflict
        if (server.certMode !== 'http') {
            console.log(`ACTIVE_SERVER: HTTPS server ${serverId} cannot be opened in lateral panel - cert mode: ${server.certMode}`);
            const response = await vscode.window.showWarningMessage('HTTPS content cannot be displayed in VS Code panels due to security restrictions. The content will not load properly.', 'Open in Browser Instead', 'Cancel');
            if (response === 'Open in Browser Instead') {
                console.log(`ACTIVE_SERVER: Redirecting server ${serverId} to browser due to HTTPS incompatibility`);
                return this.openInBrowser(serverId);
            }
            else {
                console.log(`ACTIVE_SERVER: User cancelled opening HTTPS server ${serverId} in panel`);
                return; // User cancelled
            }
        }
        try {
            console.log(`ACTIVE_SERVER: Opening HTTP server ${serverId} (${server.url}) in lateral panel`);
            await previewRenderer_1.PreviewRenderer.openPreview(server.url, server.htmlFile || '', 'lateralPanel', serverId);
            console.log(`ACTIVE_SERVER: Successfully opened ${server.url} in lateral panel`);
            vscode.window.showInformationMessage(`Opened ${server.url} in VS Code panel`);
        }
        catch (error) {
            console.error(`ACTIVE_SERVER: Error opening ${server.url} in panel:`, error);
            vscode.window.showErrorMessage(`Failed to open in panel: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Copy server URL to clipboard
     */
    static async copyUrl(serverId) {
        console.log(`ACTIVE_SERVER: Copying URL for server ${serverId}`);
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const server = registry.getServer(serverId);
        if (!server) {
            console.error(`ACTIVE_SERVER: Server ${serverId} not found`);
            vscode.window.showErrorMessage(`Server not found: ${serverId}`);
            return;
        }
        try {
            await vscode.env.clipboard.writeText(server.url);
            console.log(`ACTIVE_SERVER: Copied ${server.url} to clipboard`);
            vscode.window.showInformationMessage(`Copied ${server.url} to clipboard`);
        }
        catch (error) {
            console.error(`ACTIVE_SERVER: Error copying URL to clipboard:`, error);
            vscode.window.showErrorMessage('Failed to copy URL to clipboard');
        }
    }
    /**
     * Stop server
     */
    static async stopServer(serverId) {
        console.log(`ACTIVE_SERVER: Stopping server ${serverId}`);
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const server = registry.getServer(serverId);
        if (!server) {
            console.error(`ACTIVE_SERVER: Server ${serverId} not found`);
            vscode.window.showErrorMessage(`Server not found: ${serverId}`);
            return;
        }
        const response = await vscode.window.showWarningMessage(`Stop server ${server.url}?`, 'Stop', 'Cancel');
        if (response === 'Stop') {
            try {
                console.log(`ACTIVE_SERVER: Stopping server ${serverId} (${server.url})`);
                const success = await serverControl_1.ServerControl.stopServer(serverId);
                if (success) {
                    console.log(`ACTIVE_SERVER: Successfully stopped server ${serverId}`);
                    vscode.window.showInformationMessage(`Stopped server ${server.url}`);
                    // Refresh the tree view
                    vscode.commands.executeCommand('codeXR.activeServers.refreshServers');
                }
                else {
                    console.error(`ACTIVE_SERVER: Failed to stop server ${serverId}`);
                    vscode.window.showErrorMessage(`Failed to stop server ${server.url}`);
                }
            }
            catch (error) {
                console.error(`ACTIVE_SERVER: Error stopping server ${serverId}:`, error);
                vscode.window.showErrorMessage(`Error stopping server: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        else {
            console.log(`ACTIVE_SERVER: User cancelled stopping server ${serverId}`);
        }
    }
    /**
     * Show detailed server information
     */
    static async showServerDetails(serverId) {
        console.log(`ACTIVE_SERVER: Showing details for server ${serverId}`);
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const server = registry.getServer(serverId);
        if (!server) {
            console.error(`ACTIVE_SERVER: Server ${serverId} not found`);
            vscode.window.showErrorMessage(`Server not found: ${serverId}`);
            return;
        }
        const details = this.formatServerDetails(server);
        console.log(`ACTIVE_SERVER: Displaying detailed information for server ${serverId}`);
        await vscode.window.showInformationMessage(`Server Information - ${server.url}`, { modal: true, detail: details });
    }
    /**
     * Stop all servers
     */
    static async stopAllServers() {
        console.log('ACTIVE_SERVER: Stopping all servers');
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const allServers = registry.getAllServers();
        if (allServers.length === 0) {
            vscode.window.showInformationMessage('No servers are currently running');
            return;
        }
        const response = await vscode.window.showWarningMessage(`Stop all ${allServers.length} server(s)?`, 'Stop All', 'Cancel');
        if (response === 'Stop All') {
            try {
                console.log(`ACTIVE_SERVER: Stopping ${allServers.length} servers`);
                const success = await serverControl_1.ServerControl.stopAllServers();
                if (success) {
                    console.log('ACTIVE_SERVER: Successfully stopped all servers');
                    vscode.window.showInformationMessage(`Stopped all ${allServers.length} servers`);
                }
                else {
                    console.error('ACTIVE_SERVER: Failed to stop some servers');
                    vscode.window.showWarningMessage('Some servers may not have stopped properly');
                }
                // Refresh the tree view
                vscode.commands.executeCommand('codeXR.activeServers.refreshServers');
            }
            catch (error) {
                console.error('ACTIVE_SERVER: Error stopping all servers:', error);
                vscode.window.showErrorMessage(`Error stopping servers: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        else {
            console.log('ACTIVE_SERVER: User cancelled stopping all servers');
        }
    }
    /**
     * Refresh servers display
     */
    static async refreshServers() {
        console.log('ACTIVE_SERVER: Refreshing servers display');
        vscode.commands.executeCommand('codeXR.activeServers.refreshServers');
    }
    /**
     * Get available actions for a server based on its type
     * @private
     */
    static getAvailableActions(server) {
        const isHttp = server.certMode === 'http';
        const actions = [
            {
                label: '🌐 Open in Browser',
                description: 'Open server in external browser',
                action: 'openInBrowser'
            }
        ];
        // Add lateral panel option only for HTTP servers
        if (isHttp) {
            actions.push({
                label: '📱 Open in Panel',
                description: 'Open server in VS Code lateral panel',
                action: 'openInPanel'
            });
        }
        actions.push({
            label: '📋 Copy URL',
            description: 'Copy server URL to clipboard',
            action: 'copyUrl'
        }, {
            label: 'ℹ️ Server Info',
            description: 'Show detailed server information',
            action: 'showDetails'
        }, {
            label: '⏹️ Stop Server',
            description: 'Stop this server',
            action: 'stopServer'
        });
        return actions;
    }
    /**
     * Execute an action on a server
     * @private
     */
    static async executeAction(action, server) {
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
    static formatServerDetails(server) {
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
    static formatUptime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        else {
            return `${seconds}s`;
        }
    }
}
exports.ServerActionHandlers = ServerActionHandlers;


/***/ }),
/* 19 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ServerControl = void 0;
const vscode = __importStar(__webpack_require__(1));
const activeServerRegistry_1 = __webpack_require__(17);
const panelManager_1 = __webpack_require__(20);
const fileToServerMap_1 = __webpack_require__(21);
const SSEManager_1 = __webpack_require__(22);
/**
 * Server Control
 * Runtime operations for managing active servers
 */
class ServerControl {
    /**
     * Stop an active server
     */
    static async stopServer(serverId) {
        console.log(`ACTIVE_SERVERS: Attempting to stop server ${serverId}`);
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const server = registry.getServer(serverId);
        if (!server) {
            console.error(`ACTIVE_SERVERS: Server ${serverId} not found in registry`);
            vscode.window.showErrorMessage(`Server not found: ${serverId}`);
            return false;
        }
        try {
            // Close associated lateral panel if it exists
            const panelManager = (0, panelManager_1.getPanelManager)();
            if (server.launchMode === 'lateralPanel' && panelManager.hasPanel(serverId)) {
                console.log(`ACTIVE_SERVER_PANEL: Closing lateral panel for server ${serverId}`);
                panelManager.removePanel(serverId);
            }
            // Check if this server is associated with an analysis file and clean up
            console.log(`ACTIVE_SERVERS: Checking for file-to-server mapping for server on port ${server.port}`);
            const fileUri = fileToServerMap_1.fileToServerMap.findFileByPort(server.port);
            if (fileUri) {
                console.log(`ACTIVE_SERVERS: Found associated analysis file: ${fileUri}`);
                // Clean up SSE clients for this file
                console.log(`ACTIVE_SERVERS: Cleaning up SSE clients for ${fileUri}`);
                SSEManager_1.sseManager.removeAllClients(fileUri);
                // Remove the file-to-server mapping
                console.log(`ACTIVE_SERVERS: Removing file-to-server mapping for ${fileUri}`);
                fileToServerMap_1.fileToServerMap.unregisterMapping(fileUri);
            }
            // Update status to indicate stopping
            registry.updateServerStatus(serverId, 'stopped');
            // Stop the actual server instance if available
            if (server.serverInstance && typeof server.serverInstance.stop === 'function') {
                console.log(`ACTIVE_SERVERS: Stopping server instance for ${serverId}`);
                await server.serverInstance.stop();
            }
            // Remove from registry
            registry.unregisterServer(serverId);
            console.log(`ACTIVE_SERVERS: Successfully stopped server ${serverId} (${server.url})`);
            vscode.window.showInformationMessage(`Server stopped: ${server.url}`);
            return true;
        }
        catch (error) {
            console.error(`ACTIVE_SERVERS: Error stopping server ${serverId}:`, error);
            // Update status to error
            registry.updateServerStatus(serverId, 'error');
            vscode.window.showErrorMessage(`Failed to stop server ${server.url}: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }
    /**
     * Stop all active servers
     */
    static async stopAllServers() {
        console.log('ACTIVE_SERVERS: Stopping all active servers');
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const runningServers = registry.getServersByStatus('running');
        if (runningServers.length === 0) {
            console.log('ACTIVE_SERVERS: No running servers to stop');
            vscode.window.showInformationMessage('No active servers to stop');
            return 0;
        }
        // First, close all lateral panels for servers that have them
        const panelManager = (0, panelManager_1.getPanelManager)();
        const lateralPanelServers = runningServers.filter(server => server.launchMode === 'lateralPanel');
        if (lateralPanelServers.length > 0) {
            console.log(`ACTIVE_SERVER_PANEL: Closing ${lateralPanelServers.length} lateral panels before stopping servers`);
            const serverIdsWithPanels = lateralPanelServers.map(server => server.id);
            const closedPanelCount = panelManager.removePanelsForServers(serverIdsWithPanels);
            console.log(`ACTIVE_SERVER_PANEL: Closed ${closedPanelCount}/${lateralPanelServers.length} lateral panels`);
        }
        let stoppedCount = 0;
        const stopPromises = runningServers.map(async (server) => {
            const success = await this.stopServer(server.id);
            if (success) {
                stoppedCount++;
            }
            return success;
        });
        await Promise.all(stopPromises);
        console.log(`ACTIVE_SERVERS: Stopped ${stoppedCount}/${runningServers.length} servers`);
        if (stoppedCount === runningServers.length) {
            vscode.window.showInformationMessage(`All ${stoppedCount} servers stopped successfully`);
        }
        else {
            vscode.window.showWarningMessage(`Stopped ${stoppedCount}/${runningServers.length} servers. Some servers may require manual intervention.`);
        }
        return stoppedCount;
    }
    /**
     * Get server status information
     */
    static getServerStatus(serverId) {
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const server = registry.getServer(serverId);
        if (!server) {
            return null;
        }
        const uptime = Date.now() - server.timestamp;
        const isRunning = server.status === 'running';
        let details = `Status: ${server.status}\\n`;
        details += `URL: ${server.url}\\n`;
        details += `Mode: ${server.certMode}/${server.launchMode}\\n`;
        details += `Uptime: ${this.formatUptime(uptime)}\\n`;
        if (server.htmlFile) {
            details += `File: ${server.htmlFile}\\n`;
        }
        return {
            server,
            isRunning,
            uptime,
            details
        };
    }
    /**
     * Refresh server status by checking actual server instance
     */
    static async refreshServerStatus(serverId) {
        console.log(`ACTIVE_SERVERS: Refreshing status for server ${serverId}`);
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const server = registry.getServer(serverId);
        if (!server) {
            console.warn(`ACTIVE_SERVERS: Cannot refresh non-existent server ${serverId}`);
            return false;
        }
        try {
            let actualStatus = 'running';
            // Check if server instance has a status check method
            if (server.serverInstance) {
                if (typeof server.serverInstance.getIsRunning === 'function') {
                    const isRunning = server.serverInstance.getIsRunning();
                    actualStatus = isRunning ? 'running' : 'stopped';
                }
                else if (typeof server.serverInstance.status !== 'undefined') {
                    actualStatus = server.serverInstance.status;
                }
            }
            // Update status if it has changed
            if (server.status !== actualStatus) {
                console.log(`ACTIVE_SERVERS: Status changed for ${serverId}: ${server.status} -> ${actualStatus}`);
                registry.updateServerStatus(serverId, actualStatus);
                // If server is stopped/error, consider removing from registry
                if (actualStatus !== 'running') {
                    console.log(`ACTIVE_SERVERS: Server ${serverId} is no longer running, removing from registry`);
                    registry.unregisterServer(serverId);
                }
            }
            return true;
        }
        catch (error) {
            console.error(`ACTIVE_SERVERS: Error refreshing server ${serverId} status:`, error);
            registry.updateServerStatus(serverId, 'error');
            return false;
        }
    }
    /**
     * Refresh all server statuses
     */
    static async refreshAllServerStatuses() {
        console.log('ACTIVE_SERVERS: Refreshing all server statuses');
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const servers = registry.getAllServers();
        const refreshPromises = servers.map(server => this.refreshServerStatus(server.id));
        await Promise.all(refreshPromises);
        console.log('ACTIVE_SERVERS: Completed status refresh for all servers');
    }
    /**
     * Get comprehensive registry information
     */
    static getRegistryInfo() {
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const servers = registry.getAllServers();
        const stats = registry.getStats();
        let summary = `Total: ${stats.total} servers\\n`;
        summary += `Running: ${stats.running}\\n`;
        summary += `Stopped: ${stats.stopped}\\n`;
        summary += `Errors: ${stats.error}\\n`;
        if (stats.total > 0) {
            summary += `\\nLaunch modes:\\n`;
            Object.entries(stats.byMode).forEach(([mode, count]) => {
                summary += `  ${mode}: ${count}\\n`;
            });
            summary += `\\nCertificate modes:\\n`;
            Object.entries(stats.byCertMode).forEach(([mode, count]) => {
                summary += `  ${mode}: ${count}\\n`;
            });
        }
        return {
            servers,
            stats,
            summary
        };
    }
    /**
     * Cleanup inactive servers from registry
     */
    static cleanupInactiveServers() {
        console.log('ACTIVE_SERVERS: Cleaning up inactive servers');
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const removedCount = registry.cleanupInactiveServers();
        if (removedCount > 0) {
            vscode.window.showInformationMessage(`Cleaned up ${removedCount} inactive servers`);
        }
        return removedCount;
    }
    /**
     * Format uptime duration
     * @private
     */
    static formatUptime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        else {
            return `${seconds}s`;
        }
    }
}
exports.ServerControl = ServerControl;


/***/ }),
/* 20 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PanelManager = void 0;
exports.getPanelManager = getPanelManager;
/**
 * Panel Manager Service
 * Manages WebviewPanel instances for servers launched in lateral panel mode
 */
class PanelManager {
    static instance;
    panels = new Map();
    constructor() {
        console.log('ACTIVE_SERVER_PANEL: Panel manager initialized');
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!PanelManager.instance) {
            PanelManager.instance = new PanelManager();
        }
        return PanelManager.instance;
    }
    /**
     * Register a panel for a server
     * @param serverId - Server ID
     * @param panel - WebviewPanel instance
     */
    registerPanel(serverId, panel) {
        console.log(`ACTIVE_SERVER_PANEL: Registering panel for server ${serverId}`);
        // Remove any existing panel for this server first
        this.removePanel(serverId);
        // Register the new panel
        this.panels.set(serverId, panel);
        // Set up disposal listener to auto-cleanup
        panel.onDidDispose(() => {
            console.log(`ACTIVE_SERVER_PANEL: Panel for server ${serverId} was disposed by user`);
            this.panels.delete(serverId);
        });
        console.log(`ACTIVE_SERVER_PANEL: Panel registered for server ${serverId}, total panels: ${this.panels.size}`);
    }
    /**
     * Remove and dispose a panel for a server
     * @param serverId - Server ID
     * @returns true if panel was found and disposed, false otherwise
     */
    removePanel(serverId) {
        const panel = this.panels.get(serverId);
        if (panel) {
            console.log(`ACTIVE_SERVER_PANEL: Disposing panel for server ${serverId}`);
            try {
                panel.dispose();
                this.panels.delete(serverId);
                console.log(`ACTIVE_SERVER_PANEL: Panel for server ${serverId} disposed successfully`);
                return true;
            }
            catch (error) {
                console.warn(`ACTIVE_SERVER_PANEL: Error disposing panel for server ${serverId}:`, error);
                // Still remove from map even if disposal failed
                this.panels.delete(serverId);
                return false;
            }
        }
        return false;
    }
    /**
     * Remove and dispose all panels
     * @returns number of panels that were disposed
     */
    removeAllPanels() {
        console.log(`ACTIVE_SERVER_PANEL: Disposing all ${this.panels.size} panels`);
        let disposedCount = 0;
        const panelEntries = Array.from(this.panels.entries());
        for (const [serverId, panel] of panelEntries) {
            try {
                console.log(`ACTIVE_SERVER_PANEL: Disposing panel for server ${serverId}`);
                panel.dispose();
                this.panels.delete(serverId);
                disposedCount++;
            }
            catch (error) {
                console.warn(`ACTIVE_SERVER_PANEL: Error disposing panel for server ${serverId}:`, error);
                // Still remove from map even if disposal failed
                this.panels.delete(serverId);
            }
        }
        console.log(`ACTIVE_SERVER_PANEL: Disposed ${disposedCount}/${panelEntries.length} panels`);
        return disposedCount;
    }
    /**
     * Get panel for a server (if exists)
     * @param serverId - Server ID
     * @returns WebviewPanel or undefined
     */
    getPanel(serverId) {
        return this.panels.get(serverId);
    }
    /**
     * Check if a server has an associated panel
     * @param serverId - Server ID
     * @returns true if panel exists
     */
    hasPanel(serverId) {
        return this.panels.has(serverId);
    }
    /**
     * Get number of currently managed panels
     * @returns number of active panels
     */
    getPanelCount() {
        return this.panels.size;
    }
    /**
     * Get all server IDs that have panels
     * @returns array of server IDs
     */
    getServerIdsWithPanels() {
        return Array.from(this.panels.keys());
    }
    /**
     * Remove panels for multiple servers
     * @param serverIds - Array of server IDs
     * @returns number of panels that were disposed
     */
    removePanelsForServers(serverIds) {
        console.log(`ACTIVE_SERVER_PANEL: Disposing panels for ${serverIds.length} servers`);
        let disposedCount = 0;
        for (const serverId of serverIds) {
            if (this.removePanel(serverId)) {
                disposedCount++;
            }
        }
        console.log(`ACTIVE_SERVER_PANEL: Disposed ${disposedCount}/${serverIds.length} requested panels`);
        return disposedCount;
    }
    /**
     * Get debug information about current panels
     * @returns debug information
     */
    getDebugInfo() {
        return {
            serverCount: this.panels.size,
            serverIds: Array.from(this.panels.keys())
        };
    }
}
exports.PanelManager = PanelManager;
/**
 * Get global panel manager instance
 */
function getPanelManager() {
    return PanelManager.getInstance();
}


/***/ }),
/* 21 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.fileToServerMap = void 0;
/**
 * Central mapping between analysis files and their corresponding servers
 * This enables efficient lookup for SSE notifications and cleanup operations
 */
class FileToServerMapping {
    static instance = null;
    fileToServer = new Map();
    constructor() {
        console.log('[FILE_TO_SERVER_MAP] Initializing file-to-server mapping registry');
    }
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!FileToServerMapping.instance) {
            FileToServerMapping.instance = new FileToServerMapping();
        }
        return FileToServerMapping.instance;
    }
    /**
     * Register a mapping between a file and its analysis server
     * @param fileUri - URI of the analyzed file
     * @param serverInfo - Information about the server serving this analysis
     */
    registerMapping(fileUri, serverInfo) {
        console.log(`REQUEST_UPDATE: Registering file-to-server mapping`);
        console.log(`REQUEST_UPDATE: File URI: ${fileUri}`);
        console.log(`REQUEST_UPDATE: Server port: ${serverInfo.port}`);
        console.log(`REQUEST_UPDATE: Temp dir: ${serverInfo.tempDir}`);
        console.log(`[FILE_TO_SERVER_MAP] Registering mapping: ${fileUri} -> port ${serverInfo.port}`);
        this.fileToServer.set(fileUri, serverInfo);
        console.log(`REQUEST_UPDATE: Total mappings after registration: ${this.fileToServer.size}`);
    }
    /**
     * Unregister a mapping for a file
     * @param fileUri - URI of the analyzed file
     */
    unregisterMapping(fileUri) {
        console.log(`[FILE_TO_SERVER_MAP] Unregistering mapping for: ${fileUri}`);
        this.fileToServer.delete(fileUri);
    }
    /**
     * Get server information for a file
     * @param fileUri - URI of the analyzed file
     * @returns ServerInfo or null if not found
     */
    getServerInfo(fileUri) {
        return this.fileToServer.get(fileUri) || null;
    }
    /**
     * Find file URI by server port
     * @param port - Server port number
     * @returns File URI or null if not found
     */
    findFileByPort(port) {
        console.log(`REQUEST_UPDATE: Looking up file for port ${port}`);
        console.log(`REQUEST_UPDATE: Available ports: ${Array.from(this.fileToServer.values()).map(info => info.port).join(', ')}`);
        for (const [fileUri, serverInfo] of this.fileToServer.entries()) {
            if (serverInfo.port === port) {
                console.log(`REQUEST_UPDATE: Found file ${fileUri} for port ${port}`);
                return fileUri;
            }
        }
        console.log(`REQUEST_UPDATE: No file found for port ${port}`);
        return null;
    }
    /**
     * Find file URI by server reference
     * @param serverRef - HTTP server reference
     * @returns File URI or null if not found
     */
    findFileByServerRef(serverRef) {
        for (const [fileUri, serverInfo] of this.fileToServer.entries()) {
            if (serverInfo.serverRef === serverRef) {
                return fileUri;
            }
        }
        return null;
    }
    /**
     * Find file URI by temp directory path
     * @param tempDir - Temporary directory path
     * @returns File URI or null if not found
     */
    findFileByTempDir(tempDir) {
        for (const [fileUri, serverInfo] of this.fileToServer.entries()) {
            if (serverInfo.tempDir === tempDir) {
                return fileUri;
            }
        }
        return null;
    }
    /**
     * Get all registered mappings
     * @returns Array of [fileUri, ServerInfo] entries
     */
    getAllMappings() {
        return Array.from(this.fileToServer.entries());
    }
    /**
     * Get all file URIs that have servers
     * @returns Array of file URIs
     */
    getAllFileUris() {
        return Array.from(this.fileToServer.keys());
    }
    /**
     * Check if a file has a registered server
     * @param fileUri - URI of the analyzed file
     * @returns True if mapping exists
     */
    hasMapping(fileUri) {
        return this.fileToServer.has(fileUri);
    }
    /**
     * Clear all mappings (useful for cleanup)
     */
    clearAll() {
        console.log(`[FILE_TO_SERVER_MAP] Clearing all ${this.fileToServer.size} mappings`);
        this.fileToServer.clear();
    }
    /**
     * Get the number of registered mappings
     */
    size() {
        return this.fileToServer.size;
    }
}
// Export singleton instance
exports.fileToServerMap = FileToServerMapping.getInstance();


/***/ }),
/* 22 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.sseManager = exports.SSEManager = void 0;
const sseClientRegistry_1 = __webpack_require__(23);
const fileToServerMap_1 = __webpack_require__(21);
/**
 * SSE Manager
 * Central module for managing Server-Sent Events for analysis updates
 */
class SSEManager {
    static instance = null;
    clientRegistry;
    constructor() {
        console.log('[SSE_MANAGER] Initializing SSE manager');
        this.clientRegistry = sseClientRegistry_1.SSEClientRegistry.getInstance();
    }
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!SSEManager.instance) {
            SSEManager.instance = new SSEManager();
        }
        return SSEManager.instance;
    }
    /**
     * Register a new SSE client for a specific analysis file
     * Sets up the SSE connection with proper headers and keep-alive
     *
     * @param fileUri - URI of the analyzed file
     * @param res - HTTP response object
     */
    registerClient(fileUri, res) {
        console.log(`[SSE_MANAGER] Setting up SSE connection for: ${fileUri}`);
        // Set SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        });
        // Send initial connection message
        res.write(`data: ${JSON.stringify({
            type: 'connected',
            fileUri: fileUri,
            timestamp: new Date().toISOString(),
            message: 'SSE connection established for analysis updates'
        })}\n\n`);
        // Register the client
        this.clientRegistry.registerClient(fileUri, res);
        console.log(`[SSE_MANAGER] SSE client registered for: ${fileUri}`);
    }
    /**
     * Unregister an SSE client
     *
     * @param fileUri - URI of the analyzed file
     * @param res - HTTP response object
     */
    unregisterClient(fileUri, res) {
        console.log(`[SSE_MANAGER] Unregistering SSE client for: ${fileUri}`);
        this.clientRegistry.unregisterClient(fileUri, res);
    }
    /**
     * Send an update notification to all clients of a specific analysis file
     * This is called when the data.json file is regenerated
     *
     * @param fileUri - URI of the analyzed file that was updated
     */
    sendUpdate(fileUri) {
        console.log(`REQUEST_UPDATE: Server received update request for file: ${fileUri}`);
        console.log(`[SSE_MANAGER] Sending analysis update for: ${fileUri}`);
        // Debug: Check file-to-server mapping
        const mapping = fileToServerMap_1.fileToServerMap.getServerInfo(fileUri);
        if (mapping) {
            console.log(`REQUEST_UPDATE: Found mapping - Port: ${mapping.port}, TempDir: ${mapping.tempDir}`);
            // Verify data.json exists in the temp directory
            const dataJsonPath = (__webpack_require__(5).join)(mapping.tempDir, 'data.json');
            const fs = __webpack_require__(6);
            try {
                const exists = fs.existsSync(dataJsonPath);
                console.log(`REQUEST_UPDATE: data.json exists at ${dataJsonPath}: ${exists}`);
                if (exists) {
                    const stats = fs.statSync(dataJsonPath);
                    console.log(`REQUEST_UPDATE: data.json size: ${stats.size} bytes, modified: ${stats.mtime}`);
                }
            }
            catch (fileError) {
                console.error(`REQUEST_UPDATE: Error checking data.json:`, fileError);
            }
        }
        else {
            console.log(`REQUEST_UPDATE: No mapping found for file: ${fileUri}`);
        }
        const updateMessage = JSON.stringify({
            type: 'analysis-updated',
            fileUri: fileUri,
            timestamp: new Date().toISOString(),
            message: 'Analysis data has been updated, please refresh',
            action: 'reload-data'
        });
        this.clientRegistry.sendToClients(fileUri, updateMessage);
        console.log(`[SSE_MANAGER] Update notification sent for: ${fileUri}`);
        console.log(`REQUEST_UPDATE: Update message dispatched to clients for: ${fileUri}`);
    }
    /**
     * Send a custom message to all clients of a specific analysis file
     *
     * @param fileUri - URI of the analyzed file
     * @param message - Custom message object
     */
    sendCustomMessage(fileUri, message) {
        console.log(`[SSE_MANAGER] Sending custom message for: ${fileUri}`);
        const customMessage = JSON.stringify({
            ...message,
            timestamp: new Date().toISOString()
        });
        this.clientRegistry.sendToClients(fileUri, customMessage);
    }
    /**
     * Send a heartbeat/keep-alive message to all clients of a specific file
     *
     * @param fileUri - URI of the analyzed file
     */
    sendHeartbeat(fileUri) {
        const heartbeatMessage = JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
        });
        this.clientRegistry.sendToClients(fileUri, heartbeatMessage);
    }
    /**
     * Send heartbeat to all active files
     * Useful for maintaining connections
     */
    sendHeartbeatToAll() {
        const activeFiles = this.clientRegistry.getActiveFiles();
        if (activeFiles.length > 0) {
            console.log(`[SSE_MANAGER] Sending heartbeat to ${activeFiles.length} active file(s)`);
            for (const fileUri of activeFiles) {
                this.sendHeartbeat(fileUri);
            }
        }
    }
    /**
     * Get the number of active clients for a specific file
     *
     * @param fileUri - URI of the analyzed file
     * @returns Number of active clients
     */
    getClientCount(fileUri) {
        return this.clientRegistry.getClients(fileUri).length;
    }
    /**
     * Get all file URIs that have active SSE clients
     *
     * @returns Array of file URIs with active clients
     */
    getActiveFiles() {
        return this.clientRegistry.getActiveFiles();
    }
    /**
     * Remove all clients for a specific file
     * Useful when an analysis is stopped or file is deleted
     *
     * @param fileUri - URI of the analyzed file
     */
    removeAllClients(fileUri) {
        console.log(`[SSE_MANAGER] Removing all SSE clients for: ${fileUri}`);
        this.clientRegistry.removeAllClients(fileUri);
    }
    /**
     * Get statistics about active SSE connections
     *
     * @returns Statistics object
     */
    getStats() {
        return this.clientRegistry.getStats();
    }
    /**
     * Clean up all SSE connections
     * Should be called during extension deactivation
     */
    dispose() {
        console.log('[SSE_MANAGER] Disposing SSE manager');
        this.clientRegistry.clearAll();
    }
}
exports.SSEManager = SSEManager;
// Export singleton instance for easy access
exports.sseManager = SSEManager.getInstance();


/***/ }),
/* 23 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SSEClientRegistry = void 0;
/**
 * SSE Client Registry
 * Maintains active Server-Sent Events connections for analysis updates
 */
class SSEClientRegistry {
    static instance = null;
    clients = new Map();
    constructor() {
        console.log('[SSE_CLIENT_REGISTRY] Initializing SSE client registry');
    }
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!SSEClientRegistry.instance) {
            SSEClientRegistry.instance = new SSEClientRegistry();
        }
        return SSEClientRegistry.instance;
    }
    /**
     * Register a new SSE client for a specific file
     * @param fileUri - URI of the analyzed file
     * @param res - HTTP response object for SSE
     */
    registerClient(fileUri, res) {
        console.log(`[SSE_CLIENT_REGISTRY] Registering SSE client for: ${fileUri}`);
        if (!this.clients.has(fileUri)) {
            this.clients.set(fileUri, []);
        }
        const clientList = this.clients.get(fileUri);
        clientList.push(res);
        console.log(`[SSE_CLIENT_REGISTRY] Client registered. Total clients for ${fileUri}: ${clientList.length}`);
        // Set up cleanup when client disconnects
        res.on('close', () => {
            this.unregisterClient(fileUri, res);
        });
        res.on('error', (error) => {
            console.error(`[SSE_CLIENT_REGISTRY] Client error for ${fileUri}:`, error);
            this.unregisterClient(fileUri, res);
        });
    }
    /**
     * Unregister an SSE client
     * @param fileUri - URI of the analyzed file
     * @param res - HTTP response object for SSE
     */
    unregisterClient(fileUri, res) {
        console.log(`[SSE_CLIENT_REGISTRY] Unregistering SSE client for: ${fileUri}`);
        const clientList = this.clients.get(fileUri);
        if (!clientList) {
            return;
        }
        const index = clientList.indexOf(res);
        if (index > -1) {
            clientList.splice(index, 1);
            console.log(`[SSE_CLIENT_REGISTRY] Client unregistered. Remaining clients for ${fileUri}: ${clientList.length}`);
            // Clean up empty arrays
            if (clientList.length === 0) {
                this.clients.delete(fileUri);
                console.log(`[SSE_CLIENT_REGISTRY] Removed empty client list for: ${fileUri}`);
            }
        }
    }
    /**
     * Get all active clients for a file
     * @param fileUri - URI of the analyzed file
     * @returns Array of response objects
     */
    getClients(fileUri) {
        return this.clients.get(fileUri) || [];
    }
    /**
     * Send a message to all clients for a specific file
     * @param fileUri - URI of the analyzed file
     * @param message - Message to send
     */
    sendToClients(fileUri, message) {
        const clientList = this.clients.get(fileUri);
        console.log(`REQUEST_UPDATE: SSE Registry lookup for file: ${fileUri}`);
        console.log(`REQUEST_UPDATE: Found ${clientList ? clientList.length : 0} client(s) for file: ${fileUri}`);
        if (!clientList || clientList.length === 0) {
            console.log(`REQUEST_UPDATE: No SSE clients registered for: ${fileUri}`);
            console.log(`REQUEST_UPDATE: Available files in registry: ${Array.from(this.clients.keys()).join(', ')}`);
            return;
        }
        console.log(`[SSE_CLIENT_REGISTRY] Sending message to ${clientList.length} client(s) for: ${fileUri}`);
        console.log(`REQUEST_UPDATE: About to send message to ${clientList.length} client(s)`);
        // Send to all active clients, removing any that error out
        const activeClients = [];
        for (const client of clientList) {
            try {
                if (!client.headersSent) {
                    // Headers not sent yet, this shouldn't happen in SSE
                    console.warn(`[SSE_CLIENT_REGISTRY] Skipping client with unsent headers for: ${fileUri}`);
                    continue;
                }
                client.write(`data: ${message}\n\n`);
                activeClients.push(client);
                console.log(`REQUEST_UPDATE: Message sent to client successfully`);
            }
            catch (error) {
                console.error(`[SSE_CLIENT_REGISTRY] Error sending to client for ${fileUri}:`, error);
                console.error(`REQUEST_UPDATE: Failed to send to client: ${error}`);
                // Client will be removed via error event handler
            }
        }
        // Update the client list to only include active clients
        if (activeClients.length !== clientList.length) {
            if (activeClients.length === 0) {
                this.clients.delete(fileUri);
                console.log(`[SSE_CLIENT_REGISTRY] All clients disconnected for: ${fileUri}`);
            }
            else {
                this.clients.set(fileUri, activeClients);
                console.log(`[SSE_CLIENT_REGISTRY] Updated active clients for ${fileUri}: ${activeClients.length}`);
            }
        }
    }
    /**
     * Get all file URIs with active clients
     * @returns Array of file URIs
     */
    getActiveFiles() {
        return Array.from(this.clients.keys());
    }
    /**
     * Get total number of active clients across all files
     * @returns Total client count
     */
    getTotalClientCount() {
        let total = 0;
        for (const clientList of this.clients.values()) {
            total += clientList.length;
        }
        return total;
    }
    /**
     * Remove all clients for a specific file
     * @param fileUri - URI of the analyzed file
     */
    removeAllClients(fileUri) {
        const clientList = this.clients.get(fileUri);
        if (!clientList) {
            return;
        }
        console.log(`[SSE_CLIENT_REGISTRY] Removing all ${clientList.length} client(s) for: ${fileUri}`);
        // Close all connections
        for (const client of clientList) {
            try {
                client.end();
            }
            catch (error) {
                console.error(`[SSE_CLIENT_REGISTRY] Error closing client for ${fileUri}:`, error);
            }
        }
        this.clients.delete(fileUri);
    }
    /**
     * Clear all clients (useful for cleanup)
     */
    clearAll() {
        console.log(`[SSE_CLIENT_REGISTRY] Clearing all clients for ${this.clients.size} file(s)`);
        for (const [fileUri, clientList] of this.clients.entries()) {
            console.log(`[SSE_CLIENT_REGISTRY] Closing ${clientList.length} client(s) for: ${fileUri}`);
            for (const client of clientList) {
                try {
                    client.end();
                }
                catch (error) {
                    console.error(`[SSE_CLIENT_REGISTRY] Error closing client:`, error);
                }
            }
        }
        this.clients.clear();
    }
    /**
     * Get statistics about the registry
     * @returns Registry statistics
     */
    getStats() {
        const clientsPerFile = {};
        for (const [fileUri, clientList] of this.clients.entries()) {
            clientsPerFile[fileUri] = clientList.length;
        }
        return {
            fileCount: this.clients.size,
            totalClients: this.getTotalClientCount(),
            clientsPerFile
        };
    }
}
exports.SSEClientRegistry = SSEClientRegistry;


/***/ }),
/* 24 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PreviewRenderer = void 0;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(5));
const panelManager_1 = __webpack_require__(20);
/**
 * Preview Renderer
 * Handles opening HTML content in browser or VS Code webview panel
 */
class PreviewRenderer {
    /**
     * Open HTML content based on the specified mode
     * @param serverUrl - Server URL where the file is served
     * @param htmlFilePath - Path to the HTML file (for reference/logging)
     * @param openMode - How to open ('browser' or 'lateralPanel')
     * @param serverId - Optional server ID for panel tracking (required for lateralPanel mode)
     */
    static async openPreview(serverUrl, htmlFilePath, openMode, serverId) {
        console.log(`SERVER: Opening preview for ${htmlFilePath} at ${serverUrl} in ${openMode} mode`);
        try {
            if (openMode === 'browser') {
                await this.openInBrowser(serverUrl);
            }
            else if (openMode === 'lateralPanel') {
                if (!serverId) {
                    throw new Error('Server ID is required for lateral panel mode');
                }
                await this.openInWebviewPanel(serverUrl, htmlFilePath, serverId);
            }
            else {
                throw new Error(`Unsupported open mode: ${openMode}`);
            }
        }
        catch (error) {
            console.error(`SERVER: Error opening preview: ${error}`);
            vscode.window.showWarningMessage(`Failed to open preview: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Open URL in external browser
     * @private
     */
    static async openInBrowser(serverUrl) {
        console.log(`SERVER: Opening ${serverUrl} in external browser`);
        await vscode.env.openExternal(vscode.Uri.parse(serverUrl));
        vscode.window.showInformationMessage(`Opened ${serverUrl} in browser`);
    }
    /**
     * Open server URL in VS Code webview panel using iframe
     * @private
     */
    static async openInWebviewPanel(serverUrl, htmlFilePath, serverId) {
        console.log(`ACTIVE_SERVER_PANEL: Opening ${serverUrl} in VS Code webview panel for server ${serverId}`);
        try {
            const fileName = path.basename(htmlFilePath);
            // Create webview panel
            const panel = vscode.window.createWebviewPanel('serverPreview', `Local Server Preview - ${fileName}`, vscode.ViewColumn.Two, {
                enableScripts: true,
                enableForms: true,
                retainContextWhenHidden: true
            });
            // Register panel with panel manager
            const panelManager = (0, panelManager_1.getPanelManager)();
            panelManager.registerPanel(serverId, panel);
            console.log(`ACTIVE_SERVER_PANEL: Panel registered for server ${serverId}`);
            // Create iframe HTML pointing to the server URL
            const iframeHtml = this.createIframeHtml(serverUrl, fileName);
            // Set the HTML content
            panel.webview.html = iframeHtml;
            // Handle messages from webview
            panel.webview.onDidReceiveMessage(message => {
                console.log(`ACTIVE_SERVER_PANEL: Webview message for server ${serverId}:`, message);
                switch (message.command) {
                    case 'openExternal':
                        vscode.env.openExternal(vscode.Uri.parse(message.url));
                        break;
                    case 'showError':
                        vscode.window.showErrorMessage(message.text);
                        break;
                    case 'serverError':
                        vscode.window.showWarningMessage(`Server Error: ${message.text}`);
                        break;
                }
            }, undefined);
            // Handle panel disposal
            panel.onDidDispose(() => {
                console.log(`ACTIVE_SERVER_PANEL: Webview panel disposed for server ${serverId}`);
                // Panel manager will automatically clean up via its disposal listener
            });
            console.log(`SERVER: Created webview panel for ${serverUrl}`);
            vscode.window.showInformationMessage(`Opened ${fileName} in VS Code panel`);
        }
        catch (error) {
            console.error(`SERVER: Error creating webview panel: ${error}`);
            throw new Error(`Failed to create webview panel: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Create iframe HTML for embedding the server URL
     * @private
     */
    static createIframeHtml(serverUrl, fileName) {
        // Escape template literals in serverUrl for safe injection
        const escapedServerUrl = serverUrl.replace(/'/g, "\\'").replace(/"/g, '\\"');
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Local Server Preview - ${fileName}</title>
    <style>
        body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #1e1e1e;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .loading-container {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #cccccc;
            z-index: 1000;
        }
        
        .loading-spinner {
            border: 3px solid #333;
            border-top: 3px solid #007acc;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .error-container {
            display: none;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #f48771;
            background: #2d2d30;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #f48771;
            max-width: 80%;
        }
        
        .retry-button {
            background: #007acc;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 10px;
        }
        
        .retry-button:hover {
            background: #005a9e;
        }
        
        iframe {
            width: 100%;
            height: 100vh;
            border: none;
            display: none;
        }
        
        iframe.loaded {
            display: block;
        }
    </style>
</head>
<body>
    <div class="loading-container" id="loadingContainer">
        <div class="loading-spinner"></div>
        <div>Loading server content...</div>
        <div style="font-size: 12px; margin-top: 8px; opacity: 0.7;">${escapedServerUrl}</div>
    </div>
    
    <div class="error-container" id="errorContainer">
        <h3>⚠️ Connection Error</h3>
        <p>Could not load content from the local server.</p>
        <p style="font-size: 12px; opacity: 0.8;">URL: ${escapedServerUrl}</p>
        <button class="retry-button" onclick="reloadFrame()">Retry</button>
        <button class="retry-button" onclick="openInBrowser()" style="margin-left: 8px;">Open in Browser</button>
    </div>
    
    <iframe id="contentFrame" src="${escapedServerUrl}" title="Server Content"></iframe>
    
    <script>
        const iframe = document.getElementById('contentFrame');
        const loadingContainer = document.getElementById('loadingContainer');
        const errorContainer = document.getElementById('errorContainer');
        
        let loadTimeout;
        
        function showLoading() {
            loadingContainer.style.display = 'block';
            errorContainer.style.display = 'none';
            iframe.classList.remove('loaded');
        }
        
        function showContent() {
            loadingContainer.style.display = 'none';
            errorContainer.style.display = 'none';
            iframe.classList.add('loaded');
        }
        
        function showError() {
            loadingContainer.style.display = 'none';
            errorContainer.style.display = 'block';
            iframe.classList.remove('loaded');
        }
        
        function reloadFrame() {
            showLoading();
            iframe.src = iframe.src; // Reload
            setupLoadTimeout();
        }
        
        function openInBrowser() {
            if (typeof acquireVsCodeApi !== 'undefined') {
                const vscode = acquireVsCodeApi();
                vscode.postMessage({
                    command: 'openExternal',
                    url: '${escapedServerUrl}'
                });
            }
        }
        
        function setupLoadTimeout() {
            clearTimeout(loadTimeout);
            loadTimeout = setTimeout(() => {
                console.log('SERVER: Load timeout, showing error');
                showError();
            }, 10000); // 10 second timeout
        }
        
        iframe.addEventListener('load', () => {
            console.log('SERVER: Iframe loaded successfully');
            clearTimeout(loadTimeout);
            showContent();
        });
        
        iframe.addEventListener('error', () => {
            console.log('SERVER: Iframe load error');
            clearTimeout(loadTimeout);
            showError();
        });
        
        // Initial setup
        showLoading();
        setupLoadTimeout();
        
        // Send ready message to extension
        if (typeof acquireVsCodeApi !== 'undefined') {
            const vscode = acquireVsCodeApi();
            vscode.postMessage({
                command: 'webviewReady',
                url: '${escapedServerUrl}'
            });
        }
    </script>
</body>
</html>`;
    }
}
exports.PreviewRenderer = PreviewRenderer;


/***/ }),
/* 25 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ServerRegistrar = void 0;
exports.getServerRegistrar = getServerRegistrar;
const activeServerRegistry_1 = __webpack_require__(17);
/**
 * Server Registrar Service
 * Centralized service for registering servers with the active servers registry
 * This layer provides validation, logging, and abstraction between server launchers and the registry
 */
class ServerRegistrar {
    static instance = null;
    constructor() {
        console.log('SERVER_REGISTRAR: Service initialized');
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!ServerRegistrar.instance) {
            ServerRegistrar.instance = new ServerRegistrar();
        }
        return ServerRegistrar.instance;
    }
    /**
     * Register a server with the active servers registry
     * @param config - Server registration configuration
     * @returns Registered ActiveServer
     */
    registerServer(config) {
        console.log('SERVER_REGISTRAR: Registering server with config:', {
            port: config.port,
            customName: config.customName,
            url: config.url,
            launchMode: config.launchMode,
            certMode: config.certMode
        });
        // Input validation
        this.validateConfig(config);
        try {
            // Register with the registry
            const activeServer = (0, activeServerRegistry_1.registerActiveServer)(config);
            console.log(`SERVER_REGISTRAR: Successfully registered server ${activeServer.id}`);
            return activeServer;
        }
        catch (error) {
            console.error('SERVER_REGISTRAR: Failed to register server:', error);
            throw new Error(`Server registration failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Validate server registration configuration
     * @private
     */
    validateConfig(config) {
        // Validate required fields
        if (!config.port || config.port <= 0 || config.port > 65535) {
            throw new Error(`Invalid port number: ${config.port}`);
        }
        if (!config.url || typeof config.url !== 'string') {
            throw new Error(`Invalid URL: ${config.url}`);
        }
        if (!config.launchMode || !['browser', 'lateralPanel'].includes(config.launchMode)) {
            throw new Error(`Invalid launch mode: ${config.launchMode}`);
        }
        if (!config.certMode || !['http', 'https-default', 'https-custom'].includes(config.certMode)) {
            throw new Error(`Invalid cert mode: ${config.certMode}`);
        }
        if (!config.timestamp || config.timestamp <= 0) {
            throw new Error(`Invalid timestamp: ${config.timestamp}`);
        }
        // Validate optional fields
        if (config.customName !== undefined && typeof config.customName !== 'string') {
            throw new Error(`Custom name must be a string: ${typeof config.customName}`);
        }
        if (config.htmlFile !== undefined && typeof config.htmlFile !== 'string') {
            throw new Error(`HTML file path must be a string: ${typeof config.htmlFile}`);
        }
    }
}
exports.ServerRegistrar = ServerRegistrar;
/**
 * Convenience function to get the registrar instance
 */
function getServerRegistrar() {
    return ServerRegistrar.getInstance();
}


/***/ }),
/* 26 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ServerLauncher = void 0;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(5));
const httpServer_1 = __webpack_require__(27);
const httpsDefaultServer_1 = __webpack_require__(30);
const httpsCustomServer_1 = __webpack_require__(32);
const portManager_1 = __webpack_require__(15);
const serverSettingsManager_1 = __webpack_require__(11);
const activeServerRegistry_1 = __webpack_require__(17);
const serverRegistrar_1 = __webpack_require__(25);
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
            if (!(__webpack_require__(6).existsSync)(htmlFilePath)) {
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
            const fileDirectory = (__webpack_require__(5).dirname)(htmlFilePath);
            const fileName = (__webpack_require__(5).basename)(htmlFilePath);
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


/***/ }),
/* 27 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.HttpServer = void 0;
const http = __importStar(__webpack_require__(28));
const path = __importStar(__webpack_require__(5));
const fs = __importStar(__webpack_require__(6));
const url_1 = __webpack_require__(29);
const SSEManager_1 = __webpack_require__(22);
const fileToServerMap_1 = __webpack_require__(21);
/**
 * HTTP Server instance
 * Provides basic HTTP server functionality for CodeXR
 */
class HttpServer {
    server = null;
    config;
    isRunning = false;
    constructor(config) {
        this.config = {
            host: 'localhost',
            staticRoot: path.join(__dirname, '../../../templates'),
            enableCors: true,
            allowedOrigins: ['*'],
            ...config
        };
        console.log('SERVER: HTTP server initialized with config:', this.config);
    }
    /**
     * Start the HTTP server
     * @returns Promise<string> - Server URL
     */
    async start() {
        if (this.isRunning) {
            throw new Error('SERVER: HTTP server is already running');
        }
        return new Promise((resolve, reject) => {
            try {
                this.server = http.createServer(this.handleRequest.bind(this));
                this.server.on('error', (error) => {
                    console.error('SERVER: HTTP server error:', error);
                    this.isRunning = false;
                    if (error.code === 'EADDRINUSE') {
                        reject(new Error(`SERVER: Port ${this.config.port} is already in use`));
                    }
                    else {
                        reject(new Error(`SERVER: Failed to start HTTP server: ${error.message}`));
                    }
                });
                this.server.on('listening', () => {
                    const address = this.server?.address();
                    const serverUrl = `http://${this.config.host}:${this.config.port}`;
                    console.log(`SERVER: HTTP server listening on ${serverUrl}`);
                    console.log('SERVER: Server address info:', address);
                    this.isRunning = true;
                    resolve(serverUrl);
                });
                // Add graceful shutdown handling
                this.server.on('close', () => {
                    console.log('SERVER: HTTP server closed');
                    this.isRunning = false;
                });
                this.server.listen(this.config.port, this.config.host);
            }
            catch (error) {
                console.error('SERVER: Error starting HTTP server:', error);
                reject(error);
            }
        });
    }
    /**
     * Stop the HTTP server
     * @returns Promise<void>
     */
    async stop() {
        if (!this.server || !this.isRunning) {
            console.log('SERVER: HTTP server is not running');
            return;
        }
        return new Promise((resolve, reject) => {
            this.server.close((error) => {
                if (error) {
                    console.error('SERVER: Error stopping HTTP server:', error);
                    reject(error);
                }
                else {
                    console.log('SERVER: HTTP server stopped successfully');
                    this.isRunning = false;
                    this.server = null;
                    resolve();
                }
            });
        });
    }
    /**
     * Check if server is running
     * @returns boolean
     */
    getIsRunning() {
        return this.isRunning;
    }
    /**
     * Get server configuration
     * @returns HttpServerConfig
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Get server URL
     * @returns string | null
     */
    getServerUrl() {
        if (!this.isRunning) {
            return null;
        }
        return `http://${this.config.host}:${this.config.port}`;
    }
    /**
     * Handle incoming HTTP requests
     * @param req - HTTP request
     * @param res - HTTP response
     */
    handleRequest(req, res) {
        const startTime = Date.now();
        const requestUrl = req.url || '/';
        const method = req.method || 'GET';
        console.log(`SERVER: ${method} ${requestUrl} - Processing request`);
        // Add CORS headers if enabled
        if (this.config.enableCors) {
            this.addCorsHeaders(res);
        }
        // Handle preflight requests
        if (method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        // Route the request
        this.routeRequest(req, res, requestUrl)
            .then(() => {
            const duration = Date.now() - startTime;
            console.log(`SERVER: ${method} ${requestUrl} - Completed in ${duration}ms`);
        })
            .catch((error) => {
            console.error(`SERVER: ${method} ${requestUrl} - Error:`, error);
            this.sendErrorResponse(res, 500, 'Internal Server Error');
        });
    }
    /**
     * Route incoming requests
     * @param req - HTTP request
     * @param res - HTTP response
     * @param url - Request URL
     */
    async routeRequest(req, res, url) {
        // Root path - serve main page
        if (url === '/' || url === '/index.html') {
            await this.serveMainPage(res);
            return;
        }
        // Health check endpoint
        if (url === '/health') {
            this.sendJsonResponse(res, 200, {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                server: 'CodeXR HTTP Server'
            });
            return;
        }
        // Server-Sent Events endpoint for analysis updates
        if (url === '/events') {
            await this.handleSSERequest(req, res);
            return;
        }
        // API endpoints
        if (url.startsWith('/api/')) {
            await this.handleApiRequest(req, res, url);
            return;
        }
        // Static files
        await this.serveStaticFile(req, res, url);
    }
    /**
     * Serve the main CodeXR page
     * @param res - HTTP response
     */
    async serveMainPage(res) {
        let mainPagePath;
        if (this.config.mainFile) {
            // If a specific main file is configured, use it
            if (path.isAbsolute(this.config.mainFile)) {
                mainPagePath = this.config.mainFile;
            }
            else {
                mainPagePath = path.join(this.config.staticRoot, this.config.mainFile);
            }
            console.log(`SERVER: Attempting to serve configured main file: ${mainPagePath}`);
            console.log(`SERVER: Static root: ${this.config.staticRoot}`);
            console.log(`SERVER: Main file: ${this.config.mainFile}`);
        }
        else {
            // Default to xr-visualization.html
            mainPagePath = path.join(this.config.staticRoot, 'xr', 'xr-visualization.html');
            console.log(`SERVER: Serving default main file: ${mainPagePath}`);
        }
        // Check if file exists and serve it
        if (fs.existsSync(mainPagePath)) {
            console.log(`SERVER: Successfully found main file, serving: ${mainPagePath}`);
            await this.serveFile(res, mainPagePath, 'text/html');
        }
        else {
            console.error(`SERVER: Main file not found: ${mainPagePath}`);
            console.error(`SERVER: Current working directory: ${process.cwd()}`);
            console.error(`SERVER: Static root exists: ${fs.existsSync(this.config.staticRoot)}`);
            if (this.config.staticRoot) {
                try {
                    const files = fs.readdirSync(this.config.staticRoot);
                    console.error(`SERVER: Files in static root: ${files.join(', ')}`);
                }
                catch (e) {
                    console.error(`SERVER: Cannot read static root directory: ${e}`);
                }
            }
            // Fallback to a basic HTML page
            console.warn(`SERVER: Serving fallback HTML instead of selected file`);
            const fallbackHtml = this.generateFallbackHtml();
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(fallbackHtml);
        }
    }
    /**
     * Handle API requests
     * @param req - HTTP request
     * @param res - HTTP response
     * @param url - Request URL
     */
    async handleApiRequest(req, res, url) {
        const apiPath = url.replace('/api', '');
        switch (apiPath) {
            case '/status':
                this.sendJsonResponse(res, 200, {
                    server: 'CodeXR HTTP Server',
                    mode: 'HTTP',
                    port: this.config.port,
                    uptime: process.uptime(),
                    timestamp: new Date().toISOString()
                });
                break;
            case '/config':
                this.sendJsonResponse(res, 200, {
                    mode: 'HTTP',
                    host: this.config.host,
                    port: this.config.port,
                    cors: this.config.enableCors
                });
                break;
            default:
                this.sendErrorResponse(res, 404, 'API endpoint not found');
        }
    }
    /**
     * Serve static files
     * @param req - HTTP request
     * @param res - HTTP response
     * @param url - Request URL
     */
    async serveStaticFile(req, res, url) {
        // Parse URL to extract pathname without query string
        const parsedUrl = (0, url_1.parse)(url, true);
        const pathname = parsedUrl.pathname || '/';
        const filePath = path.join(this.config.staticRoot, pathname);
        const normalizedPath = path.normalize(filePath);
        console.log(`SERVER_DEBUG: Request for static file: ${url}`);
        console.log(`SERVER_DEBUG: Parsed pathname: ${pathname}`);
        console.log(`SERVER_DEBUG: Query string removed: ${url} -> ${pathname}`);
        console.log(`SERVER_DEBUG: Static root: ${this.config.staticRoot}`);
        console.log(`SERVER_DEBUG: Full file path: ${normalizedPath}`);
        console.log(`SERVER_DEBUG: File exists: ${fs.existsSync(normalizedPath)}`);
        // Security check: ensure the file is within the static root
        if (!normalizedPath.startsWith(path.normalize(this.config.staticRoot))) {
            console.log(`SERVER_DEBUG: Access denied - path outside static root`);
            this.sendErrorResponse(res, 403, 'Access denied');
            return;
        }
        if (fs.existsSync(normalizedPath) && fs.statSync(normalizedPath).isFile()) {
            console.log(`SERVER_DEBUG: Serving file: ${normalizedPath}`);
            await this.serveFile(res, normalizedPath);
        }
        else {
            console.log(`SERVER_DEBUG: File not found: ${normalizedPath}`);
            // List directory contents for debugging
            try {
                const dirPath = path.dirname(normalizedPath);
                const dirContents = fs.readdirSync(dirPath);
                console.log(`SERVER_DEBUG: Directory contents of ${dirPath}:`, dirContents);
            }
            catch (dirError) {
                console.log(`SERVER_DEBUG: Could not read directory: ${dirError}`);
            }
            this.sendErrorResponse(res, 404, 'File not found');
        }
    }
    /**
     * Serve a file
     * @param res - HTTP response
     * @param filePath - Path to the file
     * @param contentType - Content type (optional, will be detected)
     */
    async serveFile(res, filePath, contentType) {
        try {
            const content = await fs.promises.readFile(filePath);
            const detectedContentType = contentType || this.getContentType(filePath);
            res.writeHead(200, { 'Content-Type': detectedContentType });
            res.end(content);
        }
        catch (error) {
            console.error('SERVER: Error serving file:', error);
            this.sendErrorResponse(res, 500, 'Error reading file');
        }
    }
    /**
     * Add CORS headers to response
     * @param res - HTTP response
     */
    addCorsHeaders(res) {
        const allowedOrigins = this.config.allowedOrigins?.join(', ') || '*';
        res.setHeader('Access-Control-Allow-Origin', allowedOrigins);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    }
    /**
     * Send JSON response
     * @param res - HTTP response
     * @param statusCode - HTTP status code
     * @param data - Data to send
     */
    sendJsonResponse(res, statusCode, data) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data, null, 2));
    }
    /**
     * Send error response
     * @param res - HTTP response
     * @param statusCode - HTTP status code
     * @param message - Error message
     */
    sendErrorResponse(res, statusCode, message) {
        const errorData = {
            error: true,
            status: statusCode,
            message: message,
            timestamp: new Date().toISOString()
        };
        this.sendJsonResponse(res, statusCode, errorData);
    }
    /**
     * Handle Server-Sent Events request for analysis updates
     * @param req - HTTP request
     * @param res - HTTP response
     */
    async handleSSERequest(req, res) {
        console.log('REQUEST_UPDATE: SSE connection request received on server');
        console.log(`REQUEST_UPDATE: Server port: ${this.config.port}`);
        // Find which analysis file this server is serving
        const serverPort = this.config.port;
        const fileUri = fileToServerMap_1.fileToServerMap.findFileByPort(serverPort);
        console.log(`REQUEST_UPDATE: Looking up file for port ${serverPort}`);
        console.log(`REQUEST_UPDATE: Found file mapping: ${fileUri || 'NOT FOUND'}`);
        if (!fileUri) {
            console.warn(`REQUEST_UPDATE: No file mapping found for server on port ${serverPort}`);
            console.warn(`REQUEST_UPDATE: Available mappings: ${fileToServerMap_1.fileToServerMap.getAllFileUris().join(', ')}`);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('No analysis file associated with this server');
            return;
        }
        console.log(`REQUEST_UPDATE: Setting up SSE for analysis file: ${fileUri}`);
        // Register the SSE client with the manager
        SSEManager_1.sseManager.registerClient(fileUri, res);
        console.log(`REQUEST_UPDATE: SSE client registration completed for ${fileUri}`);
    }
    /**
     * Get content type based on file extension
     * @param filePath - Path to the file
     * @returns string - Content type
     */
    getContentType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.txt': 'text/plain'
        };
        return contentTypes[ext] || 'application/octet-stream';
    }
    /**
     * Generate fallback HTML page
     * @returns string - HTML content
     */
    /**
     * Generate fallback HTML when main file is not found
     * @returns string - HTML content
     */
    generateFallbackHtml() {
        return `<!DOCTYPE html>
<html>
<head>
    <title>CodeXR Server - File Not Found</title>
    <style>
        body { font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
        .error { background: #dc2626; color: white; padding: 15px; margin: 20px 0; }
        .info { background: #374151; padding: 15px; margin: 10px 0; }
    </style>
</head>
<body>
    <h1>CodeXR Server - File Not Found</h1>
    <div class="error">
        <h3>Selected HTML File Not Found</h3>
        <p>The HTML file you selected could not be located.</p>
        <p><strong>Attempted File:</strong> ${this.config.mainFile || 'Not specified'}</p>
        <p><strong>Static Root:</strong> ${this.config.staticRoot}</p>
    </div>
    <div class="info">
        <h3>Server Information</h3>
        <p><strong>Port:</strong> ${this.config.port}</p>
        <p><strong>Host:</strong> ${this.config.host}</p>
    </div>
    <div class="info">
        <h3>Troubleshooting</h3>
        <p>1. Check that the file still exists</p>
        <p>2. Verify file permissions</p>
        <p>3. Try restarting the server</p>
    </div>
</body>
</html>`;
    }
}
exports.HttpServer = HttpServer;


/***/ }),
/* 28 */
/***/ ((module) => {

module.exports = require("http");

/***/ }),
/* 29 */
/***/ ((module) => {

module.exports = require("url");

/***/ }),
/* 30 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.HttpsDefaultServer = void 0;
const https = __importStar(__webpack_require__(31));
const fs = __importStar(__webpack_require__(6));
const path = __importStar(__webpack_require__(5));
const httpServer_1 = __webpack_require__(27);
/**
 * HTTPS Server with default certificates
 * Extends HTTP server functionality with SSL/TLS support using default certificates
 */
class HttpsDefaultServer {
    server = null;
    config;
    isRunning = false;
    httpHandler;
    /**
     * Get default certificate paths based on extension context
     * @private
     */
    getDefaultCertificatePaths(extensionContext) {
        if (extensionContext) {
            // Use extension context to resolve absolute paths
            const certPath = path.join(extensionContext.extensionPath, 'certs', 'babia_cert.pem');
            const keyPath = path.join(extensionContext.extensionPath, 'certs', 'babia_key.pem');
            console.log('SERVER: Using extension context for default certificates');
            console.log('SERVER: Extension path:', extensionContext.extensionPath);
            return { certPath, keyPath };
        }
        else {
            // Fallback to relative paths
            console.log('SERVER: Using fallback relative paths for default certificates');
            return {
                certPath: path.join(__dirname, '../../../certs/babia_cert.pem'),
                keyPath: path.join(__dirname, '../../../certs/babia_key.pem')
            };
        }
    }
    constructor(config) {
        // Get default certificate paths based on extension context
        const defaultCertPaths = this.getDefaultCertificatePaths(config.extensionContext);
        this.config = {
            host: 'localhost',
            staticRoot: path.join(__dirname, '../../../templates'),
            enableCors: true,
            allowedOrigins: ['*'],
            certPath: defaultCertPaths.certPath,
            keyPath: defaultCertPaths.keyPath,
            ...config
        };
        // Create HTTP handler instance for request processing with ALL configuration
        this.httpHandler = new httpServer_1.HttpServer({
            port: this.config.port,
            host: this.config.host,
            staticRoot: this.config.staticRoot,
            enableCors: this.config.enableCors,
            allowedOrigins: this.config.allowedOrigins,
            mainFile: this.config.mainFile // ← FIX: Pass mainFile to HTTP handler
        });
        console.log('SERVER: HTTPS server (default certs) initialized with config:', {
            ...this.config,
            certPath: '***REDACTED***',
            keyPath: '***REDACTED***'
        });
        console.log('SERVER: Using default certificates from:', this.config.certPath);
    }
    /**
     * Start the HTTPS server with default certificates
     * @returns Promise<string> - Server URL
     */
    async start() {
        if (this.isRunning) {
            throw new Error('SERVER: HTTPS server is already running');
        }
        // Validate certificate files
        await this.validateCertificates();
        return new Promise((resolve, reject) => {
            try {
                // Load SSL certificates
                const sslOptions = this.loadSslOptions();
                // Create HTTPS server using the HTTP handler's request processing
                this.server = https.createServer(sslOptions, (req, res) => {
                    // Use the HTTP handler's request processing logic
                    this.httpHandler.handleRequest(req, res);
                });
                this.server.on('error', (error) => {
                    console.error('SERVER: HTTPS server error:', error);
                    this.isRunning = false;
                    if (error.code === 'EADDRINUSE') {
                        reject(new Error(`SERVER: Port ${this.config.port} is already in use`));
                    }
                    else if (error.code === 'EACCES') {
                        reject(new Error(`SERVER: Permission denied. May need to run as administrator for port ${this.config.port}`));
                    }
                    else {
                        reject(new Error(`SERVER: Failed to start HTTPS server: ${error.message}`));
                    }
                });
                this.server.on('listening', () => {
                    const address = this.server?.address();
                    const serverUrl = `https://${this.config.host}:${this.config.port}`;
                    console.log(`SERVER: HTTPS server listening on ${serverUrl}`);
                    console.log('SERVER: Using default certificates from:', this.config.certPath);
                    console.log('SERVER: Server address info:', address);
                    this.isRunning = true;
                    resolve(serverUrl);
                });
                this.server.on('close', () => {
                    console.log('SERVER: HTTPS server closed');
                    this.isRunning = false;
                });
                // Handle TLS errors
                this.server.on('tlsClientError', (err, tlsSocket) => {
                    console.error('SERVER: TLS client error:', err.message);
                });
                this.server.listen(this.config.port, this.config.host);
            }
            catch (error) {
                console.error('SERVER: Error starting HTTPS server:', error);
                reject(error);
            }
        });
    }
    /**
     * Stop the HTTPS server
     * @returns Promise<void>
     */
    async stop() {
        if (!this.server || !this.isRunning) {
            console.log('SERVER: HTTPS server is not running');
            return;
        }
        return new Promise((resolve, reject) => {
            this.server.close((error) => {
                if (error) {
                    console.error('SERVER: Error stopping HTTPS server:', error);
                    reject(error);
                }
                else {
                    console.log('SERVER: HTTPS server stopped successfully');
                    this.isRunning = false;
                    this.server = null;
                    resolve();
                }
            });
        });
    }
    /**
     * Check if server is running
     * @returns boolean
     */
    getIsRunning() {
        return this.isRunning;
    }
    /**
     * Get server configuration
     * @returns HttpsDefaultServerConfig
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Get server URL
     * @returns string | null
     */
    getServerUrl() {
        if (!this.isRunning) {
            return null;
        }
        return `https://${this.config.host}:${this.config.port}`;
    }
    /**
     * Get certificate information
     * @returns object with certificate details
     */
    getCertificateInfo() {
        const certExists = fs.existsSync(this.config.certPath);
        const keyExists = fs.existsSync(this.config.keyPath);
        return {
            certPath: this.config.certPath,
            keyPath: this.config.keyPath,
            certExists,
            keyExists,
            isValid: certExists && keyExists
        };
    }
    /**
     * Validate that certificate files exist and are readable
     * @private
     */
    async validateCertificates() {
        const certPath = this.config.certPath;
        const keyPath = this.config.keyPath;
        console.log('SERVER: Validating default certificates...');
        console.log('SERVER: Certificate path:', certPath);
        console.log('SERVER: Key path:', keyPath);
        // Check if certificate file exists
        if (!fs.existsSync(certPath)) {
            throw new Error(`SERVER: Certificate file not found: ${certPath}`);
        }
        // Check if key file exists
        if (!fs.existsSync(keyPath)) {
            throw new Error(`SERVER: Private key file not found: ${keyPath}`);
        }
        try {
            // Test reading the files
            await fs.promises.access(certPath, fs.constants.R_OK);
            await fs.promises.access(keyPath, fs.constants.R_OK);
            console.log('SERVER: Default certificates validated successfully');
        }
        catch (error) {
            throw new Error(`SERVER: Cannot read certificate files: ${error}`);
        }
    }
    /**
     * Load SSL options for HTTPS server
     * @private
     * @returns https.ServerOptions
     */
    loadSslOptions() {
        try {
            const cert = fs.readFileSync(this.config.certPath, 'utf8');
            const key = fs.readFileSync(this.config.keyPath, 'utf8');
            console.log('SERVER: SSL certificates loaded successfully');
            return {
                cert: cert,
                key: key,
                // Additional security options
                secureProtocol: 'TLSv1_2_method',
                honorCipherOrder: true,
                ciphers: [
                    'ECDHE-RSA-AES128-GCM-SHA256',
                    'ECDHE-RSA-AES256-GCM-SHA384',
                    'ECDHE-RSA-AES128-SHA256',
                    'ECDHE-RSA-AES256-SHA384'
                ].join(':'),
            };
        }
        catch (error) {
            throw new Error(`SERVER: Failed to load SSL certificates: ${error}`);
        }
    }
    /**
     * Get server status including certificate information
     * @returns object with detailed server status
     */
    getDetailedStatus() {
        return {
            isRunning: this.isRunning,
            url: this.getServerUrl(),
            config: this.getConfig(),
            certificates: this.getCertificateInfo(),
            uptime: this.isRunning ? process.uptime() : undefined
        };
    }
    /**
     * Test certificate validity without starting the server
     * @returns Promise<boolean>
     */
    async testCertificates() {
        try {
            await this.validateCertificates();
            // Try to create SSL options to validate certificate format
            this.loadSslOptions();
            console.log('SERVER: Certificate test passed');
            return true;
        }
        catch (error) {
            console.error('SERVER: Certificate test failed:', error);
            return false;
        }
    }
    /**
     * Get certificate expiration information (if available)
     * @returns Promise<object | null>
     */
    async getCertificateExpiration() {
        try {
            // This is a basic implementation
            // For more detailed certificate parsing, we could use a library like 'node-forge'
            const cert = fs.readFileSync(this.config.certPath, 'utf8');
            // Extract dates from certificate (basic regex parsing)
            const notBeforeMatch = cert.match(/Not Before: (.+)/);
            const notAfterMatch = cert.match(/Not After : (.+)/);
            if (notBeforeMatch && notAfterMatch) {
                const notBefore = new Date(notBeforeMatch[1]);
                const notAfter = new Date(notAfterMatch[1]);
                const now = new Date();
                const isExpired = now > notAfter;
                const daysUntilExpiry = Math.ceil((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return {
                    notBefore,
                    notAfter,
                    isExpired,
                    daysUntilExpiry
                };
            }
            return null;
        }
        catch (error) {
            console.error('SERVER: Error parsing certificate expiration:', error);
            return null;
        }
    }
}
exports.HttpsDefaultServer = HttpsDefaultServer;


/***/ }),
/* 31 */
/***/ ((module) => {

module.exports = require("https");

/***/ }),
/* 32 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.HttpsCustomServer = void 0;
const https = __importStar(__webpack_require__(31));
const fs = __importStar(__webpack_require__(6));
const path = __importStar(__webpack_require__(5));
const vscode = __importStar(__webpack_require__(1));
const httpServer_1 = __webpack_require__(27);
/**
 * HTTPS Server with custom user-selected certificates
 * Extends HTTP server functionality with SSL/TLS support using user-provided certificates
 */
class HttpsCustomServer {
    server = null;
    config;
    isRunning = false;
    httpHandler;
    usingFallbackCerts = false;
    /**
     * Validate custom certificates and provide fallback to default certificates
     * @private
     */
    validateAndFallbackCertificates(config) {
        // Check if custom certificates exist
        const customCertExists = fs.existsSync(config.certPath);
        const customKeyExists = fs.existsSync(config.keyPath);
        if (customCertExists && customKeyExists) {
            console.log('SERVER: Custom certificates found and will be used');
            return {
                certPath: config.certPath,
                keyPath: config.keyPath,
                usingFallback: false
            };
        }
        // Log the issues with custom certificates
        if (!customCertExists) {
            console.warn(`SERVER: Custom certificate file not found: ${config.certPath}`);
        }
        if (!customKeyExists) {
            console.warn(`SERVER: Custom key file not found: ${config.keyPath}`);
        }
        // Fallback to default certificates
        console.warn('SERVER: Falling back to default certificates due to missing custom certificates');
        if (config.extensionContext) {
            const certPath = path.join(config.extensionContext.extensionPath, 'certs', 'babia_cert.pem');
            const keyPath = path.join(config.extensionContext.extensionPath, 'certs', 'babia_key.pem');
            // Verify default certificates exist
            if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
                console.log('SERVER: Using default certificates as fallback');
                return { certPath, keyPath, usingFallback: true };
            }
        }
        // Last resort: try relative path to default certificates
        const fallbackCertPath = path.join(__dirname, '../../../certs/babia_cert.pem');
        const fallbackKeyPath = path.join(__dirname, '../../../certs/babia_key.pem');
        if (fs.existsSync(fallbackCertPath) && fs.existsSync(fallbackKeyPath)) {
            console.log('SERVER: Using relative path default certificates as last resort');
            return {
                certPath: fallbackCertPath,
                keyPath: fallbackKeyPath,
                usingFallback: true
            };
        }
        // If we get here, no certificates are available
        throw new Error('SERVER: No valid certificates found - neither custom nor default certificates are available');
    }
    constructor(config) {
        // Validate required certificate paths
        if (!config.certPath || !config.keyPath) {
            throw new Error('SERVER: Certificate path and key path are required for custom HTTPS server');
        }
        // Validate certificates and setup fallback if needed
        const certInfo = this.validateAndFallbackCertificates(config);
        this.usingFallbackCerts = certInfo.usingFallback;
        this.config = {
            host: 'localhost',
            staticRoot: path.join(__dirname, '../../../templates'),
            enableCors: true,
            allowedOrigins: ['*'],
            ...config,
            certPath: certInfo.certPath, // Use validated/fallback certificate path
            keyPath: certInfo.keyPath // Use validated/fallback key path
        };
        // Create HTTP handler instance for request processing with ALL configuration
        this.httpHandler = new httpServer_1.HttpServer({
            port: this.config.port,
            host: this.config.host,
            staticRoot: this.config.staticRoot,
            enableCors: this.config.enableCors,
            allowedOrigins: this.config.allowedOrigins,
            mainFile: this.config.mainFile // ← FIX: Pass mainFile to HTTP handler
        });
        console.log('SERVER: HTTPS server (custom certs) initialized with config:', {
            ...this.config,
            // Don't log actual certificate paths for security
            certPath: '***REDACTED***',
            keyPath: '***REDACTED***'
        });
    }
    /**
     * Start the HTTPS server with custom certificates
     * @returns Promise<string> - Server URL
     */
    async start() {
        if (this.isRunning) {
            throw new Error('SERVER: HTTPS server is already running');
        }
        // Validate certificate files
        await this.validateCertificates();
        return new Promise((resolve, reject) => {
            try {
                // Load SSL certificates
                const sslOptions = this.loadSslOptions();
                // Create HTTPS server using the HTTP handler's request processing
                this.server = https.createServer(sslOptions, (req, res) => {
                    // Use the HTTP handler's request processing logic
                    this.httpHandler.handleRequest(req, res);
                });
                this.server.on('error', (error) => {
                    console.error('SERVER: HTTPS server error:', error);
                    this.isRunning = false;
                    if (error.code === 'EADDRINUSE') {
                        reject(new Error(`SERVER: Port ${this.config.port} is already in use`));
                    }
                    else if (error.code === 'EACCES') {
                        reject(new Error(`SERVER: Permission denied. May need to run as administrator for port ${this.config.port}`));
                    }
                    else if (error.code === 'ENOENT') {
                        reject(new Error(`SERVER: Certificate file not found. Please check your certificate paths.`));
                    }
                    else {
                        reject(new Error(`SERVER: Failed to start HTTPS server: ${error.message}`));
                    }
                });
                this.server.on('listening', () => {
                    const address = this.server?.address();
                    const serverUrl = `https://${this.config.host}:${this.config.port}`;
                    console.log(`SERVER: HTTPS server listening on ${serverUrl}`);
                    if (this.usingFallbackCerts) {
                        console.warn('SERVER: WARNING - Using default certificates instead of custom certificates');
                        // Show user warning
                        vscode.window.showWarningMessage('HTTPS server started with default certificates. Custom certificates were not found or invalid.', 'Configure Certificates').then(action => {
                            if (action === 'Configure Certificates') {
                                vscode.commands.executeCommand('codexr.server.configure');
                            }
                        });
                    }
                    else {
                        console.log('SERVER: Using custom certificates');
                    }
                    console.log('SERVER: Server address info:', address);
                    this.isRunning = true;
                    resolve(serverUrl);
                });
                this.server.on('close', () => {
                    console.log('SERVER: HTTPS server closed');
                    this.isRunning = false;
                });
                // Handle TLS errors with more specific error messages
                this.server.on('tlsClientError', (err, tlsSocket) => {
                    console.error('SERVER: TLS client error:', err.message);
                    if (err.message.includes('certificate')) {
                        console.error('SERVER: This may indicate an issue with the custom certificates');
                    }
                });
                this.server.listen(this.config.port, this.config.host);
            }
            catch (error) {
                console.error('SERVER: Error starting HTTPS server:', error);
                reject(error);
            }
        });
    }
    /**
     * Stop the HTTPS server
     * @returns Promise<void>
     */
    async stop() {
        if (!this.server || !this.isRunning) {
            console.log('SERVER: HTTPS server is not running');
            return;
        }
        return new Promise((resolve, reject) => {
            this.server.close((error) => {
                if (error) {
                    console.error('SERVER: Error stopping HTTPS server:', error);
                    reject(error);
                }
                else {
                    console.log('SERVER: HTTPS server stopped successfully');
                    this.isRunning = false;
                    this.server = null;
                    resolve();
                }
            });
        });
    }
    /**
     * Check if server is running
     * @returns boolean
     */
    getIsRunning() {
        return this.isRunning;
    }
    /**
     * Get server configuration (with redacted certificate paths)
     * @returns HttpsCustomServerConfig
     */
    getConfig() {
        return {
            ...this.config,
            certPath: '***REDACTED***',
            keyPath: '***REDACTED***'
        };
    }
    /**
     * Get server configuration with actual paths (for internal use)
     * @returns HttpsCustomServerConfig
     */
    getFullConfig() {
        return { ...this.config };
    }
    /**
     * Get server URL
     * @returns string | null
     */
    getServerUrl() {
        if (!this.isRunning) {
            return null;
        }
        return `https://${this.config.host}:${this.config.port}`;
    }
    /**
     * Get certificate information
     * @returns object with certificate details
     */
    getCertificateInfo() {
        const certExists = fs.existsSync(this.config.certPath);
        const keyExists = fs.existsSync(this.config.keyPath);
        let certSize;
        let keySize;
        try {
            if (certExists) {
                certSize = fs.statSync(this.config.certPath).size;
            }
            if (keyExists) {
                keySize = fs.statSync(this.config.keyPath).size;
            }
        }
        catch (error) {
            console.warn('SERVER: Could not get certificate file sizes:', error);
        }
        return {
            certPath: this.config.certPath,
            keyPath: this.config.keyPath,
            certExists,
            keyExists,
            isValid: certExists && keyExists,
            certSize,
            keySize
        };
    }
    /**
     * Validate that certificate files exist and are readable
     * @private
     */
    async validateCertificates() {
        const certPath = this.config.certPath;
        const keyPath = this.config.keyPath;
        console.log('SERVER: Validating custom certificates...');
        console.log('SERVER: Certificate path provided:', !!certPath);
        console.log('SERVER: Key path provided:', !!keyPath);
        // Check if certificate file exists
        if (!fs.existsSync(certPath)) {
            throw new Error(`SERVER: Certificate file not found: ${certPath}`);
        }
        // Check if key file exists
        if (!fs.existsSync(keyPath)) {
            throw new Error(`SERVER: Private key file not found: ${keyPath}`);
        }
        try {
            // Test reading the files
            await fs.promises.access(certPath, fs.constants.R_OK);
            await fs.promises.access(keyPath, fs.constants.R_OK);
            // Basic validation of file content
            const certContent = await fs.promises.readFile(certPath, 'utf8');
            const keyContent = await fs.promises.readFile(keyPath, 'utf8');
            if (!certContent.includes('BEGIN CERTIFICATE')) {
                throw new Error('SERVER: Certificate file does not appear to be a valid certificate');
            }
            if (!keyContent.includes('BEGIN PRIVATE KEY') && !keyContent.includes('BEGIN RSA PRIVATE KEY')) {
                throw new Error('SERVER: Key file does not appear to be a valid private key');
            }
            console.log('SERVER: Custom certificates validated successfully');
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('SERVER:')) {
                throw error;
            }
            throw new Error(`SERVER: Cannot read certificate files: ${error}`);
        }
    }
    /**
     * Load SSL options for HTTPS server
     * @private
     * @returns https.ServerOptions
     */
    loadSslOptions() {
        try {
            const cert = fs.readFileSync(this.config.certPath, 'utf8');
            const key = fs.readFileSync(this.config.keyPath, 'utf8');
            console.log('SERVER: Custom SSL certificates loaded successfully');
            return {
                cert: cert,
                key: key,
                // Additional security options
                secureProtocol: 'TLSv1_2_method',
                honorCipherOrder: true,
                ciphers: [
                    'ECDHE-RSA-AES128-GCM-SHA256',
                    'ECDHE-RSA-AES256-GCM-SHA384',
                    'ECDHE-RSA-AES128-SHA256',
                    'ECDHE-RSA-AES256-SHA384'
                ].join(':'),
                // Reject unauthorized connections for custom certificates
                requestCert: false,
                rejectUnauthorized: false
            };
        }
        catch (error) {
            throw new Error(`SERVER: Failed to load custom SSL certificates: ${error}`);
        }
    }
    /**
     * Get server status including certificate information
     * @returns object with detailed server status
     */
    getDetailedStatus() {
        return {
            isRunning: this.isRunning,
            url: this.getServerUrl(),
            config: this.getConfig(),
            certificates: this.getCertificateInfo(),
            uptime: this.isRunning ? process.uptime() : undefined
        };
    }
    /**
     * Test certificate validity without starting the server
     * @returns Promise<boolean>
     */
    async testCertificates() {
        try {
            await this.validateCertificates();
            // Try to create SSL options to validate certificate format
            this.loadSslOptions();
            console.log('SERVER: Custom certificate test passed');
            return true;
        }
        catch (error) {
            console.error('SERVER: Custom certificate test failed:', error);
            return false;
        }
    }
    /**
     * Update certificate paths
     * @param certPath - Path to certificate file
     * @param keyPath - Path to private key file
     * @returns Promise<boolean> - True if certificates are valid
     */
    async updateCertificates(certPath, keyPath) {
        if (this.isRunning) {
            throw new Error('SERVER: Cannot update certificates while server is running. Stop the server first.');
        }
        const oldCertPath = this.config.certPath;
        const oldKeyPath = this.config.keyPath;
        try {
            // Temporarily update paths for validation
            this.config.certPath = certPath;
            this.config.keyPath = keyPath;
            // Test the new certificates
            const isValid = await this.testCertificates();
            if (!isValid) {
                // Restore old paths if validation failed
                this.config.certPath = oldCertPath;
                this.config.keyPath = oldKeyPath;
                return false;
            }
            console.log('SERVER: Certificate paths updated successfully');
            return true;
        }
        catch (error) {
            // Restore old paths if error occurred
            this.config.certPath = oldCertPath;
            this.config.keyPath = oldKeyPath;
            console.error('SERVER: Failed to update certificates:', error);
            return false;
        }
    }
    /**
     * Get certificate expiration information (if available)
     * @returns Promise<object | null>
     */
    async getCertificateExpiration() {
        try {
            // This is a basic implementation
            // For more detailed certificate parsing, we could use a library like 'node-forge'
            const cert = fs.readFileSync(this.config.certPath, 'utf8');
            // Extract dates from certificate (basic regex parsing)
            const notBeforeMatch = cert.match(/Not Before: (.+)/);
            const notAfterMatch = cert.match(/Not After : (.+)/);
            if (notBeforeMatch && notAfterMatch) {
                const notBefore = new Date(notBeforeMatch[1]);
                const notAfter = new Date(notAfterMatch[1]);
                const now = new Date();
                const isExpired = now > notAfter;
                const daysUntilExpiry = Math.ceil((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return {
                    notBefore,
                    notAfter,
                    isExpired,
                    daysUntilExpiry
                };
            }
            return null;
        }
        catch (error) {
            console.error('SERVER: Error parsing certificate expiration:', error);
            return null;
        }
    }
    /**
     * Validate certificate file format and content
     * @param certPath - Path to certificate file
     * @param keyPath - Path to private key file
     * @returns Promise<{isValid: boolean, errors: string[]}>
     */
    static async validateCertificateFiles(certPath, keyPath) {
        const errors = [];
        try {
            // Check if files exist
            if (!fs.existsSync(certPath)) {
                errors.push(`Certificate file not found: ${certPath}`);
            }
            if (!fs.existsSync(keyPath)) {
                errors.push(`Private key file not found: ${keyPath}`);
            }
            if (errors.length > 0) {
                return { isValid: false, errors };
            }
            // Check file permissions
            try {
                await fs.promises.access(certPath, fs.constants.R_OK);
            }
            catch {
                errors.push(`Cannot read certificate file: ${certPath}`);
            }
            try {
                await fs.promises.access(keyPath, fs.constants.R_OK);
            }
            catch {
                errors.push(`Cannot read private key file: ${keyPath}`);
            }
            if (errors.length > 0) {
                return { isValid: false, errors };
            }
            // Validate file content
            const certContent = await fs.promises.readFile(certPath, 'utf8');
            const keyContent = await fs.promises.readFile(keyPath, 'utf8');
            if (!certContent.includes('BEGIN CERTIFICATE')) {
                errors.push('Certificate file does not appear to be a valid certificate');
            }
            if (!keyContent.includes('BEGIN PRIVATE KEY') && !keyContent.includes('BEGIN RSA PRIVATE KEY')) {
                errors.push('Key file does not appear to be a valid private key');
            }
            return { isValid: errors.length === 0, errors };
        }
        catch (error) {
            errors.push(`Error validating certificates: ${error}`);
            return { isValid: false, errors };
        }
    }
}
exports.HttpsCustomServer = HttpsCustomServer;


/***/ }),
/* 33 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.registerActiveServersCommands = registerActiveServersCommands;
exports.getActiveServersCommandIds = getActiveServersCommandIds;
const activeServersCommands_1 = __webpack_require__(34);
/**
 * Active Servers Commands Wrapper
 * Re-exports active servers commands for centralized command registration
 */
/**
 * Register all active servers commands
 * @param context VS Code extension context
 * @param treeDataProvider Any tree data provider that supports refresh operations
 */
function registerActiveServersCommands(context, treeDataProvider) {
    console.log('COMMANDS: Registering active servers commands');
    activeServersCommands_1.ActiveServersCommands.registerCommands(context, treeDataProvider);
}
/**
 * Get active servers command IDs for external reference
 */
function getActiveServersCommandIds() {
    return activeServersCommands_1.ActiveServersCommands.getCommandIds();
}


/***/ }),
/* 34 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ActiveServersCommands = void 0;
const vscode = __importStar(__webpack_require__(1));
const handleServerActions_1 = __webpack_require__(18);
/**
 * Active Servers Commands
 * VS Code command definitions for active servers functionality
 */
class ActiveServersCommands {
    // Store tree data provider reference for refresh operations
    static treeDataProvider;
    /**
     * Register all active servers commands
     */
    static registerCommands(context, treeDataProvider) {
        console.log('ACTIVE_SERVER: Registering active servers commands');
        // Store the tree data provider reference
        this.treeDataProvider = treeDataProvider;
        // Command: Show server actions (from tree item click)
        const showServerActionsCmd = vscode.commands.registerCommand('codeXR.activeServers.showActions', async (serverId) => {
            await handleServerActions_1.ServerActionHandlers.showServerActions(serverId);
        });
        // Command: Open server in browser
        const openInBrowserCmd = vscode.commands.registerCommand('codeXR.activeServers.openInBrowser', async (treeItem) => {
            const serverId = this.extractServerIdFromTreeItem(treeItem);
            if (serverId) {
                await handleServerActions_1.ServerActionHandlers.openInBrowser(serverId);
            }
        });
        // Command: Open server in lateral panel
        const openInPanelCmd = vscode.commands.registerCommand('codeXR.activeServers.openInPanel', async (treeItem) => {
            const serverId = this.extractServerIdFromTreeItem(treeItem);
            if (serverId) {
                await handleServerActions_1.ServerActionHandlers.openInPanel(serverId);
            }
        });
        // Command: Copy server URL to clipboard
        const copyUrlCmd = vscode.commands.registerCommand('codeXR.activeServers.copyUrl', async (treeItem) => {
            const serverId = this.extractServerIdFromTreeItem(treeItem);
            if (serverId) {
                await handleServerActions_1.ServerActionHandlers.copyUrl(serverId);
            }
        });
        // Command: Stop specific server
        const stopServerCmd = vscode.commands.registerCommand('codeXR.activeServers.stopServer', async (treeItem) => {
            const serverId = this.extractServerIdFromTreeItem(treeItem);
            if (serverId) {
                await handleServerActions_1.ServerActionHandlers.stopServer(serverId);
            }
        });
        // Command: Show server details
        const showDetailsCmd = vscode.commands.registerCommand('codeXR.activeServers.showDetails', async (treeItem) => {
            const serverId = this.extractServerIdFromTreeItem(treeItem);
            if (serverId) {
                await handleServerActions_1.ServerActionHandlers.showServerDetails(serverId);
            }
        });
        // Command: Stop all servers
        const stopAllServersCmd = vscode.commands.registerCommand('codeXR.activeServers.stopAllServers', async () => {
            await handleServerActions_1.ServerActionHandlers.stopAllServers();
        });
        // Command: Refresh server statuses
        const refreshServersCmd = vscode.commands.registerCommand('codeXR.activeServers.refreshServers', async () => {
            // Use the unified tree data provider if available
            if (this.treeDataProvider && this.treeDataProvider.refresh) {
                console.log('ACTIVE_SERVER: Refreshing unified tree view');
                this.treeDataProvider.refresh();
            }
            else {
                console.log('ACTIVE_SERVER: Using fallback refresh handler');
                vscode.commands.executeCommand('codexr.tree.refresh');
            }
        });
        // Command: Open active servers view 
        const openViewCmd = vscode.commands.registerCommand('codeXR.activeServers.openView', async () => {
            await vscode.commands.executeCommand('codexrTree.focus');
        });
        // Register all commands with the extension context
        context.subscriptions.push(showServerActionsCmd, openInBrowserCmd, openInPanelCmd, copyUrlCmd, stopServerCmd, showDetailsCmd, stopAllServersCmd, refreshServersCmd, openViewCmd);
        console.log('ACTIVE_SERVER: Registered 9 active servers commands');
    }
    /**
     * Extract server ID from tree item context
     * @private
     */
    static extractServerIdFromTreeItem(treeItem) {
        // Handle different tree item formats
        if (treeItem && treeItem.server && treeItem.server.id) {
            console.log(`ACTIVE_SERVER: Extracted server ID from tree item: ${treeItem.server.id}`);
            return treeItem.server.id;
        }
        // Fallback: if treeItem is a string, use it directly (for backward compatibility)
        if (typeof treeItem === 'string') {
            console.log(`ACTIVE_SERVER: Using direct server ID: ${treeItem}`);
            return treeItem;
        }
        console.error('ACTIVE_SERVER: Could not extract server ID from tree item:', treeItem);
        return null;
    }
    /**
     * Get all command IDs for external reference
     */
    static getCommandIds() {
        return {
            showActions: 'codeXR.activeServers.showActions',
            openInBrowser: 'codeXR.activeServers.openInBrowser',
            openInPanel: 'codeXR.activeServers.openInPanel',
            copyUrl: 'codeXR.activeServers.copyUrl',
            stopServer: 'codeXR.activeServers.stopServer',
            showDetails: 'codeXR.activeServers.showDetails',
            stopAllServers: 'codeXR.activeServers.stopAllServers',
            refreshServers: 'codeXR.activeServers.refreshServers',
            openView: 'codeXR.activeServers.openView'
        };
    }
}
exports.ActiveServersCommands = ActiveServersCommands;


/***/ }),
/* 35 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.registerBabiaExamplesCommands = registerBabiaExamplesCommands;
const babiaExamplesCommands_1 = __webpack_require__(36);
/**
 * Register Babia Examples Commands
 * Entry point for registering all Babia examples related commands
 */
function registerBabiaExamplesCommands(context, treeDataProvider) {
    console.log('EXAMPLES: Registering Babia examples commands...');
    babiaExamplesCommands_1.BabiaExamplesCommands.registerCommands(context, treeDataProvider);
    console.log('EXAMPLES: Babia examples commands registration complete');
}


/***/ }),
/* 36 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BabiaExamplesCommands = void 0;
const vscode = __importStar(__webpack_require__(1));
const handleExampleClicks_1 = __webpack_require__(37);
/**
 * Babia Examples Commands
 * VS Code command definitions for Babia examples functionality
 */
class BabiaExamplesCommands {
    /**
     * Register all Babia examples commands
     */
    static registerCommands(context, treeDataProvider) {
        console.log('EXAMPLES: Registering Babia examples commands...');
        // Initialize the click handler
        const clickHandler = new handleExampleClicks_1.ExampleClickHandler(context);
        // Command: Launch example
        const launchExampleCmd = vscode.commands.registerCommand('codeXR.babiaExamples.launchExample', async (example) => {
            try {
                console.log(`EXAMPLES: Launch command triggered for "${example.name}"`);
                await clickHandler.handleExampleClick(example);
            }
            catch (error) {
                console.error('EXAMPLES: Error in launch command:', error);
                vscode.window.showErrorMessage(`Failed to launch example: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Command: Refresh examples (only register if tree data provider is available)
        if (treeDataProvider) {
            const refreshExamplesCmd = vscode.commands.registerCommand('codeXR.babiaExamples.refresh', async () => {
                try {
                    console.log('EXAMPLES: Refresh command triggered');
                    await treeDataProvider.rescan();
                    vscode.window.showInformationMessage('Babia examples refreshed');
                }
                catch (error) {
                    console.error('EXAMPLES: Error in refresh command:', error);
                    vscode.window.showErrorMessage(`Failed to refresh examples: ${error instanceof Error ? error.message : String(error)}`);
                }
            });
            context.subscriptions.push(refreshExamplesCmd);
        }
        // Command: Open examples folder
        const openExamplesFolderCmd = vscode.commands.registerCommand('codeXR.babiaExamples.openFolder', async () => {
            try {
                console.log('EXAMPLES: Open folder command triggered');
                const workspaceRoots = vscode.workspace.workspaceFolders;
                if (!workspaceRoots || workspaceRoots.length === 0) {
                    vscode.window.showWarningMessage('No workspace folder is open');
                    return;
                }
                const examplesPath = vscode.Uri.joinPath(workspaceRoots[0].uri, 'examples', 'charts');
                await vscode.commands.executeCommand('vscode.openFolder', examplesPath, { forceNewWindow: false });
            }
            catch (error) {
                console.error('EXAMPLES: Error in open folder command:', error);
                vscode.window.showErrorMessage(`Failed to open examples folder: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Command: Show example details
        const showExampleDetailsCmd = vscode.commands.registerCommand('codeXR.babiaExamples.showDetails', async (example) => {
            try {
                console.log(`EXAMPLES: Show details command triggered for "${example.name}"`);
                const details = [
                    `# Babia Example: ${example.name}`,
                    '',
                    `**Category:** ${example.category}`,
                    `**Valid:** ${example.isValid ? 'Yes' : 'No'}`,
                    `**Directory:** ${example.directory}`,
                    `**HTML File:** ${example.htmlFilePath || 'Not found'}`,
                    ''
                ];
                if (example.description) {
                    details.push(`**Description:** ${example.description}`);
                    details.push('');
                }
                if (example.lastModified) {
                    const lastModified = new Date(example.lastModified).toLocaleString();
                    details.push(`**Last Modified:** ${lastModified}`);
                    details.push('');
                }
                if (!example.isValid) {
                    details.push('## Issues');
                    details.push('- No valid HTML file found in the example directory');
                    details.push('');
                }
                details.push('## Actions');
                if (example.isValid) {
                    details.push('- Click the example in the tree to launch it');
                }
                else {
                    details.push('- Fix the HTML file issue to make this example launchable');
                }
                const content = details.join('\\n');
                // Create and show a new untitled document with the details
                const doc = await vscode.workspace.openTextDocument({
                    content: content,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc);
            }
            catch (error) {
                console.error('EXAMPLES: Error in show details command:', error);
                vscode.window.showErrorMessage(`Failed to show example details: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Command: Open examples view
        const openExamplesViewCmd = vscode.commands.registerCommand('codeXR.babiaExamples.openView', async () => {
            try {
                console.log('EXAMPLES: Open view command triggered');
                await vscode.commands.executeCommand('codeXR.babiaExamplesView.focus');
            }
            catch (error) {
                console.error('EXAMPLES: Error in open view command:', error);
                // Don't show error message for this, it's likely the view isn't registered yet
            }
        });
        // Register commands that don't require tree data provider
        const commandsToRegister = [
            launchExampleCmd,
            openExamplesFolderCmd,
            showExampleDetailsCmd,
            openExamplesViewCmd
        ];
        // Register all commands with the extension context
        context.subscriptions.push(...commandsToRegister);
        // Store click handler for cleanup
        context.subscriptions.push({
            dispose: () => clickHandler.cleanup()
        });
        console.log(`EXAMPLES: Registered ${commandsToRegister.length} Babia examples commands`);
    }
}
exports.BabiaExamplesCommands = BabiaExamplesCommands;


/***/ }),
/* 37 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ExampleClickHandler = void 0;
const vscode = __importStar(__webpack_require__(1));
const exampleLauncher_1 = __webpack_require__(38);
/**
 * Handle Example Clicks
 * Manages user interactions with Babia examples in the tree view
 */
class ExampleClickHandler {
    exampleLauncher;
    constructor(context) {
        this.exampleLauncher = new exampleLauncher_1.ExampleLauncher(context);
        console.log('EXAMPLES: Example click handler initialized');
    }
    /**
     * Handle click on an example to launch it
     * @param example The example to launch
     */
    async handleExampleClick(example) {
        console.log(`EXAMPLES: User clicked on example "${example.name}"`);
        try {
            if (!example.isValid) {
                await this.handleInvalidExample(example);
                return;
            }
            // Show launching message
            const launchingMessage = vscode.window.setStatusBarMessage(`$(loading~spin) Launching Babia example "${example.name}"...`);
            try {
                const result = await this.exampleLauncher.launchExample(example);
                if (result.success) {
                    console.log(`EXAMPLES: Successfully launched "${example.name}" on port ${result.port}`);
                }
                else {
                    console.error(`EXAMPLES: Failed to launch "${example.name}":`, result.error);
                }
            }
            finally {
                launchingMessage.dispose();
            }
        }
        catch (error) {
            const errorMsg = `Failed to handle example click: ${error instanceof Error ? error.message : String(error)}`;
            console.error('EXAMPLES:', errorMsg);
            vscode.window.showErrorMessage(errorMsg);
        }
    }
    /**
     * Handle click on invalid example
     * @private
     */
    async handleInvalidExample(example) {
        console.log(`EXAMPLES: User clicked on invalid example "${example.name}"`);
        const action = await vscode.window.showWarningMessage(`Example "${example.name}" is not valid and cannot be launched.`, 'Show Details', 'Rescan Examples');
        switch (action) {
            case 'Show Details':
                await this.showExampleDetails(example);
                break;
            case 'Rescan Examples':
                await this.rescanExamples();
                break;
        }
    }
    /**
     * Show example details
     * @private
     */
    async showExampleDetails(example) {
        const details = [
            `Example: ${example.name}`,
            `Category: ${example.category}`,
            `Directory: ${example.directory}`,
            `HTML File: ${example.htmlFilePath || 'Not found'}`,
            `Valid: ${example.isValid ? 'Yes' : 'No'}`,
            ''
        ];
        if (example.description) {
            details.push(`Description: ${example.description}`);
        }
        if (!example.isValid) {
            details.push('Issues:');
            details.push('- No valid HTML file found in the example directory');
        }
        const content = details.join('\\n');
        // Create and show a new untitled document with the details
        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'plaintext'
        });
        await vscode.window.showTextDocument(doc);
    }
    /**
     * Rescan examples
     * @private
     */
    async rescanExamples() {
        console.log('EXAMPLES: User requested example rescan');
        const scanning = vscode.window.setStatusBarMessage('$(loading~spin) Scanning Babia examples...');
        try {
            const result = await this.exampleLauncher.scanExamples();
            console.log(`EXAMPLES: Rescan complete. Found ${result.validCount} valid, ${result.invalidCount} invalid examples`);
            // Refresh the tree view
            vscode.commands.executeCommand('codeXR.babiaExamples.refresh');
            // Show result message
            if (result.errors.length > 0) {
                vscode.window.showWarningMessage(`Rescan complete: ${result.validCount} valid, ${result.invalidCount} invalid examples. ${result.errors.length} errors occurred.`);
            }
            else {
                vscode.window.showInformationMessage(`Rescan complete: Found ${result.validCount} valid and ${result.invalidCount} invalid examples.`);
            }
        }
        catch (error) {
            console.error('EXAMPLES: Error during rescan:', error);
            vscode.window.showErrorMessage(`Failed to rescan examples: ${error instanceof Error ? error.message : String(error)}`);
        }
        finally {
            scanning.dispose();
        }
    }
    /**
     * Get the example launcher instance
     */
    getExampleLauncher() {
        return this.exampleLauncher;
    }
    /**
     * Cleanup method
     */
    async cleanup() {
        console.log('EXAMPLES: Cleaning up example click handler...');
        await this.exampleLauncher.cleanup();
    }
}
exports.ExampleClickHandler = ExampleClickHandler;


/***/ }),
/* 38 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ExampleLauncher = void 0;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(5));
const fs = __importStar(__webpack_require__(6));
const multiServerLauncher_1 = __webpack_require__(14);
/**
 * Example Launcher
 * Responsible for launching Babia examples using the existing server infrastructure
 */
class ExampleLauncher {
    context;
    multiServerLauncher;
    examplesCache = [];
    lastScanTime = 0;
    CACHE_DURATION = 30000; // 30 seconds
    constructor(context) {
        this.context = context;
        this.multiServerLauncher = new multiServerLauncher_1.MultiServerLauncher(context);
        console.log('EXAMPLES: Example launcher initialized');
    }
    /**
     * Scan for Babia examples in the charts directory
     * @returns Promise<ExampleScanResult>
     */
    async scanExamples() {
        console.log('EXAMPLES: Scanning for Babia examples...');
        const result = {
            examples: [],
            validCount: 0,
            invalidCount: 0,
            errors: []
        };
        try {
            // First, try to use the extension's own path to find CodeXR directory
            let workspaceRoot;
            // Method 1: Use extension context to find CodeXR directory
            const extensionPath = this.context.extensionPath;
            console.log(`EXAMPLES: Extension path: ${extensionPath}`);
            if (extensionPath.includes('CodeXR')) {
                // Extract CodeXR root from extension path
                const codeXRPath = extensionPath.substring(0, extensionPath.lastIndexOf('CodeXR') + 6);
                workspaceRoot = codeXRPath;
                console.log(`EXAMPLES: Found CodeXR from extension path: ${workspaceRoot}`);
            }
            else {
                // Method 2: Force use the known CodeXR path
                workspaceRoot = '/home/adrian/CodeXR';
                console.log(`EXAMPLES: Using hardcoded CodeXR path: ${workspaceRoot}`);
            }
            // Verify the path exists and has examples/charts
            let chartsPath = path.join(workspaceRoot, 'examples', 'charts');
            if (!fs.existsSync(chartsPath)) {
                // Method 3: Try to find from VS Code workspace folders as fallback
                const workspaceRoots = vscode.workspace.workspaceFolders;
                if (workspaceRoots && workspaceRoots.length > 0) {
                    const potentialCodeXRRoot = workspaceRoots.find(folder => folder.name === 'CodeXR' ||
                        folder.uri.fsPath.includes('CodeXR') ||
                        fs.existsSync(path.join(folder.uri.fsPath, 'examples', 'charts')));
                    if (potentialCodeXRRoot) {
                        workspaceRoot = potentialCodeXRRoot.uri.fsPath;
                        chartsPath = path.join(workspaceRoot, 'examples', 'charts');
                        console.log(`EXAMPLES: Found CodeXR from workspace folders: ${workspaceRoot}`);
                    }
                    else {
                        result.errors.push('Could not find CodeXR directory with examples/charts');
                        return result;
                    }
                }
                else {
                    result.errors.push('No workspace folder open and CodeXR path not found');
                    return result;
                }
            }
            console.log(`EXAMPLES: Using workspace root: ${workspaceRoot}`);
            console.log(`EXAMPLES: Scanning charts directory: ${chartsPath}`);
            if (!fs.existsSync(chartsPath)) {
                result.errors.push(`Charts directory not found: ${chartsPath}`);
                return result;
            }
            const chartDirectories = fs.readdirSync(chartsPath)
                .filter(item => {
                const itemPath = path.join(chartsPath, item);
                return fs.statSync(itemPath).isDirectory();
            });
            console.log(`EXAMPLES: Found ${chartDirectories.length} chart directories`);
            for (const chartDir of chartDirectories) {
                const chartPath = path.join(chartsPath, chartDir);
                const example = await this.processExampleDirectory(chartPath, chartDir);
                if (example) {
                    console.log(`EXAMPLES: FOUND chart ${chartDir} example`);
                    result.examples.push(example);
                    if (example.isValid) {
                        result.validCount++;
                    }
                    else {
                        result.invalidCount++;
                    }
                }
            }
            // Update cache
            this.examplesCache = result.examples;
            this.lastScanTime = Date.now();
            console.log(`EXAMPLES: total found ${result.examples.length}`);
            console.log(`EXAMPLES: Scan complete. Found ${result.validCount} valid and ${result.invalidCount} invalid examples`);
        }
        catch (error) {
            const errorMsg = `Failed to scan examples: ${error instanceof Error ? error.message : String(error)}`;
            console.error('EXAMPLES:', errorMsg);
            result.errors.push(errorMsg);
        }
        return result;
    }
    /**
     * Get cached examples or scan if cache is stale
     * @returns Promise<BabiaExample[]>
     */
    async getExamples() {
        const now = Date.now();
        if (this.examplesCache.length === 0 || (now - this.lastScanTime) > this.CACHE_DURATION) {
            console.log('EXAMPLES: Cache is stale, rescanning...');
            const result = await this.scanExamples();
            return result.examples;
        }
        console.log(`EXAMPLES: Using cached examples (${this.examplesCache.length} items)`);
        return this.examplesCache;
    }
    /**
     * Launch a specific Babia example
     * @param example The example to launch
     * @returns Promise<MultiServerLaunchResult>
     */
    async launchExample(example) {
        console.log(`EXAMPLES: Launching example "${example.name}" from ${example.htmlFilePath}`);
        try {
            if (!example.isValid) {
                throw new Error(`Example "${example.name}" is not valid - missing HTML file`);
            }
            if (!fs.existsSync(example.htmlFilePath)) {
                throw new Error(`HTML file not found: ${example.htmlFilePath}`);
            }
            console.log(`EXAMPLES: Delegating launch to multi-server launcher with user configuration`);
            // Create custom name in format "ExampleName" (already ends with proper format from scanning)
            const customName = example.name; // e.g., "DonutExample", "BarsExample"
            console.log(`SERVER: Using custom name '${customName}' for example server`);
            // Delegate everything to the multi-server launcher
            // This will handle:
            // - Reading current user configuration (HTTP mode, port, auto-open, lateral panel vs browser)
            // - Launching server with correct settings
            // - Auto-opening in the configured mode (if enabled)
            // - Registering in Active Servers
            const result = await this.multiServerLauncher.launchServer(example.htmlFilePath, customName);
            if (result.success) {
                console.log(`EXAMPLES: Successfully launched example "${example.name}" on port ${result.port}`);
                console.log(`EXAMPLES: Server configuration and auto-opening handled by shared infrastructure`);
            }
            else {
                console.error(`EXAMPLES: Failed to launch example "${example.name}":`, result.error);
                vscode.window.showErrorMessage(`Failed to launch example "${example.name}": ${result.error}`);
            }
            return result;
        }
        catch (error) {
            const errorMsg = `Failed to launch example "${example.name}": ${error instanceof Error ? error.message : String(error)}`;
            console.error('EXAMPLES:', errorMsg);
            vscode.window.showErrorMessage(errorMsg);
            return {
                success: false,
                error: errorMsg
            };
        }
    }
    /**
     * Process a single example directory
     * @private
     */
    async processExampleDirectory(directoryPath, categoryName) {
        try {
            console.log(`EXAMPLES: Processing directory: ${directoryPath}`);
            // Look for HTML files in the directory
            const files = fs.readdirSync(directoryPath);
            const htmlFiles = files.filter(file => file.toLowerCase().endsWith('.html'));
            console.log(`EXAMPLES: Found ${htmlFiles.length} HTML files in ${categoryName}: ${htmlFiles.join(', ')}`);
            if (htmlFiles.length === 0) {
                console.log(`EXAMPLES: No HTML files found in ${categoryName}`);
                return {
                    id: this.generateExampleId(categoryName, 'no-html'),
                    name: categoryName,
                    htmlFilePath: '',
                    directory: directoryPath,
                    category: categoryName,
                    description: 'No HTML files found',
                    isValid: false
                };
            }
            // Prefer index.html, then first HTML file
            let selectedFile = htmlFiles.find(file => file.toLowerCase() === 'index.html') || htmlFiles[0];
            const htmlFilePath = path.join(directoryPath, selectedFile);
            const stats = fs.statSync(htmlFilePath);
            const example = {
                id: this.generateExampleId(categoryName, selectedFile),
                name: this.formatExampleName(categoryName),
                htmlFilePath: htmlFilePath,
                directory: directoryPath,
                category: categoryName,
                description: this.generateDescription(categoryName, selectedFile),
                isValid: true,
                lastModified: stats.mtime.getTime()
            };
            console.log(`EXAMPLES: Created example: ${example.name} (${example.id})`);
            return example;
        }
        catch (error) {
            console.error(`EXAMPLES: Error processing directory ${directoryPath}:`, error);
            return null;
        }
    }
    /**
     * Generate a unique ID for an example
     * @private
     */
    generateExampleId(category, filename) {
        return `example_${category}_${filename}`.replace(/[^a-zA-Z0-9_]/g, '_');
    }
    /**
     * Format example name for display
     * @private
     */
    formatExampleName(category) {
        // Convert kebab-case or snake_case to Title Case
        return category
            .split(/[-_]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
    /**
     * Generate description for example
     * @private
     */
    generateDescription(category, filename) {
        const formattedCategory = this.formatExampleName(category);
        if (filename.toLowerCase() === 'index.html') {
            return `${formattedCategory} visualization example`;
        }
        else {
            const formattedFilename = filename.replace('.html', '').replace(/[-_]/g, ' ');
            return `${formattedCategory} - ${formattedFilename}`;
        }
    }
    /**
     * Cleanup method
     */
    async cleanup() {
        console.log('EXAMPLES: Cleaning up example launcher...');
        // The MultiServerLauncher will handle its own cleanup
        this.examplesCache = [];
        this.lastScanTime = 0;
    }
}
exports.ExampleLauncher = ExampleLauncher;


/***/ }),
/* 39 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.registerVisualizeDataCommands = registerVisualizeDataCommands;
const visualizeDataCommands_1 = __webpack_require__(40);
/**
 * Register Visualize Data Commands
 * Entry point for registering all visualize data related commands
 */
function registerVisualizeDataCommands(context) {
    console.log('VISUALIZE_DATA: Registering visualize data commands...');
    visualizeDataCommands_1.VisualizeDataCommands.registerCommands(context);
    console.log('VISUALIZE_DATA: Visualize data commands registration complete');
}


/***/ }),
/* 40 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VisualizeDataCommands = void 0;
const vscode = __importStar(__webpack_require__(1));
const visualizationLauncher_1 = __webpack_require__(41);
const visualizationRestorer_1 = __webpack_require__(57);
/**
 * Visualize Data Commands
 * VS Code command definitions for visualize data functionality
 */
class VisualizeDataCommands {
    /**
     * Register all visualize data commands
     */
    static registerCommands(context) {
        console.log('VISUALIZE_DATA: Registering visualize data commands...');
        // Command: Chart Type selection
        const chartTypeCmd = vscode.commands.registerCommand('codeXR.visualizeData.chartType', async () => {
            try {
                console.log('VISUALIZE_DATA: Chart Type command triggered');
                const launcher = new visualizationLauncher_1.VisualizationLauncher(context);
                await launcher.handleChartType();
                launcher.cleanup();
            }
            catch (error) {
                console.error('VISUALIZE_DATA: Error in chart type command:', error);
                vscode.window.showErrorMessage(`Failed to handle chart type: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Command: Select JSON File
        const selectJsonCmd = vscode.commands.registerCommand('codeXR.visualizeData.selectJson', async () => {
            try {
                console.log('VISUALIZE_DATA: Select JSON command triggered');
                const launcher = new visualizationLauncher_1.VisualizationLauncher(context);
                await launcher.handleSelectJson();
                launcher.cleanup();
            }
            catch (error) {
                console.error('VISUALIZE_DATA: Error in select JSON command:', error);
                vscode.window.showErrorMessage(`Failed to select JSON: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Command: Dimension Mapping
        const dimensionMappingCmd = vscode.commands.registerCommand('codeXR.visualizeData.dimensionMapping', async () => {
            try {
                console.log('VISUALIZE_DATA: Dimension Mapping command triggered');
                const launcher = new visualizationLauncher_1.VisualizationLauncher(context);
                await launcher.handleDimensionMapping();
                launcher.cleanup();
            }
            catch (error) {
                console.error('VISUALIZE_DATA: Error in dimension mapping command:', error);
                vscode.window.showErrorMessage(`Failed to handle dimension mapping: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Command: Map Dimension Field
        const mapDimensionFieldCmd = vscode.commands.registerCommand('codeXR.visualizeData.mapDimensionField', async (dimensionName) => {
            try {
                console.log(`VISUALIZE_DATA: Map Dimension Field command triggered for: ${dimensionName}`);
                const launcher = new visualizationLauncher_1.VisualizationLauncher(context);
                await launcher.handleDimensionFieldMapping(dimensionName);
                launcher.cleanup();
            }
            catch (error) {
                console.error('VISUALIZE_DATA: Error in map dimension field command:', error);
                vscode.window.showErrorMessage(`Failed to map dimension field: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Command: Launch Visualization
        const launchVisualizationCmd = vscode.commands.registerCommand('codeXR.visualizeData.launchVisualization', async () => {
            try {
                console.log('VISUALIZE_DATA: Launch Visualization command triggered');
                const launcher = new visualizationLauncher_1.VisualizationLauncher(context);
                await launcher.handleLaunchVisualization();
                launcher.cleanup();
            }
            catch (error) {
                console.error('VISUALIZE_DATA: Error in launch visualization command:', error);
                vscode.window.showErrorMessage(`Failed to launch visualization: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Command: Diagnostic - Show current state (for debugging)
        const debugStateCmd = vscode.commands.registerCommand('codeXR.visualizeData.debugState', async () => {
            try {
                console.log('VISUALIZE_DATA: Debug State command triggered');
                const launcher = new visualizationLauncher_1.VisualizationLauncher(context);
                await launcher.handleDebugState();
                launcher.cleanup();
            }
            catch (error) {
                console.error('VISUALIZE_DATA: Error in debug state command:', error);
                vscode.window.showErrorMessage(`Failed to show debug state: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Command: Launch stored visualization
        const launchStoredVisualizationCmd = vscode.commands.registerCommand('codeXR.browseVisualizations.launch', async (visualization) => {
            try {
                console.log('BROWSE-VISUALIZATIONS: Launch command triggered for:', visualization.name);
                const restorer = new visualizationRestorer_1.VisualizationRestorer(context);
                await restorer.launchVisualization(visualization);
            }
            catch (error) {
                console.error('BROWSE-VISUALIZATIONS: Error launching visualization:', error);
                vscode.window.showErrorMessage(`Failed to launch visualization: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Command: Reset all visualizations
        const resetAllVisualizationsCmd = vscode.commands.registerCommand('codeXR.browseVisualizations.resetAll', async () => {
            try {
                console.log('BROWSE-VISUALIZATIONS: Reset all command triggered');
                const restorer = new visualizationRestorer_1.VisualizationRestorer(context);
                await restorer.resetAllVisualizations();
            }
            catch (error) {
                console.error('BROWSE-VISUALIZATIONS: Error resetting visualizations:', error);
                vscode.window.showErrorMessage(`Failed to reset visualizations: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Register commands with the extension context
        const commandsToRegister = [
            chartTypeCmd,
            selectJsonCmd,
            dimensionMappingCmd,
            mapDimensionFieldCmd,
            launchVisualizationCmd,
            debugStateCmd,
            launchStoredVisualizationCmd,
            resetAllVisualizationsCmd
        ];
        context.subscriptions.push(...commandsToRegister);
        // Store action handler for cleanup
        context.subscriptions.push({
            dispose: () => {
                // No longer needed since we create instances on demand
                console.log('VISUALIZE_DATA: Commands cleanup complete');
            }
        });
        console.log(`VISUALIZE_DATA: Registered ${commandsToRegister.length} visualize data commands`);
    }
}
exports.VisualizeDataCommands = VisualizeDataCommands;


/***/ }),
/* 41 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VisualizationLauncher = void 0;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(5));
const fs = __importStar(__webpack_require__(6));
const chartRegistry_1 = __webpack_require__(42);
const visualizeDataState_1 = __webpack_require__(44);
const jsonFieldAnalyzer_1 = __webpack_require__(45);
const nonceGenerator_1 = __webpack_require__(12);
const templateProcessor_1 = __webpack_require__(46);
const index_1 = __webpack_require__(56);
/**
 * Visualization Launcher
 * Manages visualization creation and launching using centralized template processing
 */
class VisualizationLauncher {
    context;
    stateManager;
    constructor(context) {
        this.context = context;
        console.log('VISUALIZE_DATA: Action handler initialized');
        this.stateManager = visualizeDataState_1.VisualizeDataStateManager.getInstance(context);
    }
    /**
     * Handle chart type selection
     */
    async handleChartType() {
        console.log('VISUALIZE_DATA: Chart type action triggered');
        try {
            // Get available charts from BabiaXR registry
            const chartRegistry = chartRegistry_1.BabiaChartRegistry.getInstance();
            const availableCharts = chartRegistry.getAllCharts();
            if (availableCharts.length === 0) {
                console.error('BABIA-TEMPLATES: No chart types found in registry');
                vscode.window.showErrorMessage('No chart templates available');
                return;
            }
            // Create quick pick items for available charts
            const quickPickItems = availableCharts.map(chart => ({
                label: chart.name,
                description: chart.description,
                detail: `Category: ${chart.category} | Dimensions: ${chart.dimensions.map(d => d.name).join(', ')}`,
                chart: chart
            }));
            // Show quick pick
            const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: 'Select a chart type for visualization',
                title: 'BabiaXR Chart Type Selection'
            });
            if (selectedItem && selectedItem.chart) {
                const selectedChart = selectedItem.chart;
                // Update state with selected chart
                this.stateManager.updateSelectedChart(selectedChart);
                // Trigger tree refresh to update display
                vscode.commands.executeCommand('codexr.servers.refresh');
                console.log(`BABIA-TEMPLATES: Chart type selected: ${selectedChart.name}`);
                vscode.window.showInformationMessage(`Chart type selected: ${selectedChart.name}`);
            }
            else {
                console.log('BABIA-TEMPLATES: Chart type selection cancelled');
            }
        }
        catch (error) {
            console.error('VISUALIZE_DATA: Error in chart type action:', error);
            vscode.window.showErrorMessage(`Failed to handle chart type: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Handle JSON file selection
     */
    async handleSelectJson() {
        console.log('VISUALIZE_DATA: Select JSON action triggered');
        try {
            const options = {
                canSelectMany: false,
                openLabel: 'Select JSON File',
                filters: {
                    'JSON files': ['json']
                },
                title: 'Select JSON Data File for Visualization'
            };
            const fileUri = await vscode.window.showOpenDialog(options);
            if (fileUri && fileUri[0]) {
                const filePath = fileUri[0].fsPath;
                const fileName = path.basename(filePath);
                // Analyze JSON file to extract field information
                console.log(`BABIA-TEMPLATES: Starting JSON analysis for ${fileName}`);
                const jsonAnalysis = await jsonFieldAnalyzer_1.JsonFieldAnalyzer.analyzeJsonFile(filePath);
                if (jsonAnalysis.success) {
                    console.log(`BABIA-TEMPLATES: JSON analysis successful - found ${jsonAnalysis.fields.length} fields`);
                    // Update state with selected JSON and analysis
                    this.stateManager.updateSelectedJson(filePath, fileName);
                    this.stateManager.updateJsonAnalysis(jsonAnalysis);
                    // Trigger tree refresh to update display
                    vscode.commands.executeCommand('codexr.servers.refresh');
                    console.log(`BABIA-TEMPLATES: JSON file selected: ${fileName} (${filePath})`);
                    vscode.window.showInformationMessage(`JSON file selected: ${fileName} (${jsonAnalysis.fields.length} fields found)`);
                }
                else {
                    console.error(`BABIA-TEMPLATES: JSON analysis failed: ${jsonAnalysis.error}`);
                    vscode.window.showErrorMessage(`Failed to analyze JSON file: ${jsonAnalysis.error}`);
                }
            }
            else {
                console.log('BABIA-TEMPLATES: No JSON file selected');
            }
        }
        catch (error) {
            console.error('VISUALIZE_DATA: Error in select JSON action:', error);
            vscode.window.showErrorMessage(`Failed to select JSON file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Handle dimension mapping configuration (informational only)
     */
    async handleDimensionMapping() {
        console.log('DIMENSION-MAPPING: Dimension mapping overview requested');
        try {
            const state = this.stateManager.getState();
            if (!state.selectedChart) {
                vscode.window.showWarningMessage('Please select a chart type first');
                return;
            }
            if (!state.jsonAnalysis) {
                vscode.window.showWarningMessage('Please select a JSON file first');
                return;
            }
            // Show dimension mapping status overview
            const requiredDimensions = state.selectedChart.dimensions.filter(d => d.required);
            const mappedDimensions = state.dimensionMappings.length;
            const totalDimensions = state.selectedChart.dimensions.length;
            let message = `Chart: ${state.selectedChart.name}\n`;
            message += `Dimensions: ${mappedDimensions}/${totalDimensions} configured\n`;
            message += `Required: ${requiredDimensions.map(d => d.name).join(', ')}\n`;
            message += `Available fields: ${state.jsonAnalysis.fields.length}`;
            // Check for duplicate fields
            const duplicateFields = this.findDuplicateFields(state);
            if (duplicateFields.length > 0) {
                message += `\n⚠️ Duplicate field usage: ${duplicateFields.join(', ')}`;
            }
            vscode.window.showInformationMessage(`Dimension Mapping Status:\n${message}`);
        }
        catch (error) {
            console.error('DIMENSION-MAPPING: Error in dimension mapping overview:', error);
            vscode.window.showErrorMessage(`Failed to show dimension mapping overview: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Find fields that are used in multiple dimension mappings
     */
    findDuplicateFields(state) {
        const fieldCounts = new Map();
        state.dimensionMappings.forEach((mapping) => {
            const count = fieldCounts.get(mapping.dataField) || 0;
            fieldCounts.set(mapping.dataField, count + 1);
        });
        return Array.from(fieldCounts.entries())
            .filter(([_, count]) => count > 1)
            .map(([field, _]) => field);
    }
    /**
     * Handle dimension field mapping for a specific dimension
     */
    async handleDimensionFieldMapping(dimensionName) {
        console.log(`DIMENSION-MAPPING: Field mapping for dimension '${dimensionName}' triggered`);
        try {
            const state = this.stateManager.getState();
            if (!state.selectedChart || !state.jsonAnalysis) {
                vscode.window.showWarningMessage('Please select a chart type and JSON file first');
                return;
            }
            // Find the dimension definition
            const dimension = state.selectedChart.dimensions.find(d => d.name === dimensionName);
            if (!dimension) {
                vscode.window.showErrorMessage(`Dimension '${dimensionName}' not found in chart`);
                return;
            }
            // Get available fields for this dimension type
            const availableFields = jsonFieldAnalyzer_1.JsonFieldAnalyzer.getFieldsForDimensionType(state.jsonAnalysis, dimension.dataType);
            if (availableFields.length === 0) {
                const typeInfo = dimension.dataType === 'numeric' ? 'numeric fields' : 'fields';
                vscode.window.showWarningMessage(`No ${typeInfo} available for dimension '${dimension.name}'`);
                return;
            }
            // Create QuickPick items with duplicate field indicators
            const quickPickItems = availableFields.map(field => {
                const displayInfo = jsonFieldAnalyzer_1.JsonFieldAnalyzer.formatFieldForDisplay(field);
                const isAlreadyUsed = state.dimensionMappings.some(mapping => mapping.dataField === field.name && mapping.dimension !== dimensionName);
                let label = displayInfo.label;
                let description = displayInfo.description;
                if (isAlreadyUsed) {
                    label += ' ⚠️';
                    description += ' (already used in another dimension)';
                }
                return {
                    label: label,
                    description: description,
                    detail: displayInfo.detail,
                    field: field
                };
            });
            // Show QuickPick
            const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: `Select field for ${dimension.name} (${dimension.dataType === 'numeric' ? 'numeric only' : 'any value'})`,
                title: `Map Dimension: ${dimension.name}`,
                matchOnDescription: true,
                matchOnDetail: true
            });
            if (selectedItem) {
                // Check if field is already used and warn user
                const isAlreadyUsed = state.dimensionMappings.some(mapping => mapping.dataField === selectedItem.field.name && mapping.dimension !== dimensionName);
                if (isAlreadyUsed) {
                    const existingMapping = state.dimensionMappings.find(mapping => mapping.dataField === selectedItem.field.name && mapping.dimension !== dimensionName);
                    console.log(`DIMENSION-MAPPING: Warning - Field '${selectedItem.field.name}' is already mapped to dimension '${existingMapping?.dimension}'`);
                    const proceed = await vscode.window.showWarningMessage(`Field '${selectedItem.field.name}' is already used for dimension '${existingMapping?.dimension}'. Continue?`, 'Yes, Continue', 'Cancel');
                    if (proceed !== 'Yes, Continue') {
                        console.log(`DIMENSION-MAPPING: Duplicate field mapping cancelled by user`);
                        return;
                    }
                }
                // Update dimension mapping
                this.stateManager.updateSingleDimensionMapping(dimensionName, selectedItem.field.name);
                // Trigger tree refresh
                vscode.commands.executeCommand('codexr.servers.refresh');
                console.log(`DIMENSION-MAPPING: Mapped dimension '${dimensionName}' to field '${selectedItem.field.name}'`);
                vscode.window.showInformationMessage(`Mapped ${dimension.name} to field: ${selectedItem.field.name}`);
            }
            else {
                console.log(`DIMENSION-MAPPING: Field mapping for dimension '${dimensionName}' cancelled`);
            }
        }
        catch (error) {
            console.error(`DIMENSION-MAPPING: Error in field mapping for dimension '${dimensionName}':`, error);
            vscode.window.showErrorMessage(`Failed to map dimension field: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Handle visualization launch
     */
    async handleLaunchVisualization() {
        console.log('VISUALIZE_DATA: Launch visualization action triggered');
        try {
            const state = this.stateManager.getState();
            // Check if ready to launch (icon should already be showing correct state)
            if (!state.isReadyToLaunch) {
                const missingItems = [];
                if (!state.selectedChart) {
                    missingItems.push('Chart Type');
                }
                if (!state.selectedJsonPath) {
                    missingItems.push('JSON File');
                }
                if (!state.isDimensionMappingConfigured) {
                    missingItems.push('Dimension Mapping');
                }
                vscode.window.showWarningMessage(`Cannot launch visualization. Please configure: ${missingItems.join(', ')}`);
                return;
            }
            // Get visualization name from user
            const visualizationName = await vscode.window.showInputBox({
                prompt: 'Enter a name for your visualization',
                placeHolder: 'e.g., ventas, sales_analysis',
                value: 'my_visualization',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Visualization name cannot be empty';
                    }
                    if (!/^[a-zA-Z0-9_-]+$/.test(value.trim())) {
                        return 'Name can only contain letters, numbers, underscores, and dashes';
                    }
                    return null;
                }
            });
            if (!visualizationName) {
                console.log('VISUALIZE_DATA: User cancelled visualization name input');
                return;
            }
            // Generate secure unique name
            const nonce = (0, nonceGenerator_1.generateNonce)(8); // 8 bytes = 16 hex characters
            const uniqueName = `${visualizationName.trim()}_${nonce}`;
            console.log('VISUALIZE_DATA: Creating visualization:', uniqueName);
            // Prepare visualization directory
            const visualizationDir = await this.prepareVisualizationDirectory(uniqueName);
            // Generate visualization files
            const result = await this.generateVisualizationFiles(state, visualizationDir, visualizationName.trim());
            if (!result.success) {
                vscode.window.showErrorMessage(`Failed to generate visualization: ${result.error}`);
                return;
            }
            // Launch the server with custom name
            const indexHtmlPath = path.join(visualizationDir, 'index.html');
            console.log('VISUALIZE_DATA: Launching server with file:', indexHtmlPath);
            console.log(`SERVER: Using custom name '${visualizationName.trim()}' for visualization server`);
            const launchResult = await (0, index_1.launchServerWithFile)(this.context, indexHtmlPath, visualizationName.trim());
            if (launchResult.success && launchResult.serverUrl) {
                vscode.window.showInformationMessage(`🚀 Visualization '${visualizationName}' launched successfully!`, 'View in Browser').then(selection => {
                    if (selection === 'View in Browser' && launchResult.serverUrl) {
                        vscode.env.openExternal(vscode.Uri.parse(launchResult.serverUrl));
                    }
                });
            }
            else {
                vscode.window.showErrorMessage(`Failed to launch visualization server: ${launchResult.error || 'Unknown error'}`);
            }
        }
        catch (error) {
            console.error('VISUALIZE_DATA: Error in launch visualization action:', error);
            vscode.window.showErrorMessage(`Failed to launch visualization: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Prepare the visualization directory structure
     */
    async prepareVisualizationDirectory(uniqueName) {
        const globalStorageUri = this.context.globalStorageUri;
        const visualizeDataDir = path.join(globalStorageUri.fsPath, 'visualize-data');
        const visualizationDir = path.join(visualizeDataDir, uniqueName);
        // Ensure directories exist
        if (!fs.existsSync(visualizeDataDir)) {
            fs.mkdirSync(visualizeDataDir, { recursive: true });
            console.log('VISUALIZE_DATA: Created visualize-data directory:', visualizeDataDir);
        }
        if (!fs.existsSync(visualizationDir)) {
            fs.mkdirSync(visualizationDir, { recursive: true });
            console.log('VISUALIZE_DATA: Created visualization directory:', visualizationDir);
        }
        return visualizationDir;
    }
    /**
     * Generate visualization files using centralized TemplateProcessor
     */
    async generateVisualizationFiles(state, visualizationDir, userVisualizationName) {
        try {
            if (!state.selectedChart || !state.selectedJsonPath) {
                return { success: false, error: 'Missing chart or JSON file configuration' };
            }
            console.log('VISUALIZATION_LAUNCHER: Using centralized TemplateProcessor for HTML generation');
            // Copy JSON file as data.json
            const dataJsonPath = path.join(visualizationDir, 'data.json');
            fs.copyFileSync(state.selectedJsonPath, dataJsonPath);
            console.log('VISUALIZATION_LAUNCHER: Copied data file to:', dataJsonPath);
            // Prepare output path for index.html
            const indexHtmlPath = path.join(visualizationDir, 'index.html');
            // Use centralized TemplateProcessor to generate the complete XR visualization
            const result = await templateProcessor_1.TemplateProcessor.generateXRVisualization(state.selectedChart.id, state.dimensionMappings, userVisualizationName, './data.json', this.context, indexHtmlPath);
            if (!result.success) {
                console.error('VISUALIZATION_LAUNCHER: TemplateProcessor failed:', result.error);
                return {
                    success: false,
                    error: `Template processing failed: ${result.error}`
                };
            }
            console.log('VISUALIZATION_LAUNCHER: Successfully generated index.html using TemplateProcessor');
            return { success: true };
        }
        catch (error) {
            console.error('VISUALIZATION_LAUNCHER: Error generating visualization files:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Handle debug state command (for troubleshooting)
     */
    async handleDebugState() {
        console.log('VISUALIZE_DATA: Debug state action triggered');
        try {
            const state = this.stateManager.getState();
            // Validate file path existence
            const fileExists = state.selectedJsonPath ? fs.existsSync(state.selectedJsonPath) : false;
            // Prepare state information
            const stateInfo = {
                selectedChart: state.selectedChart?.name || 'None',
                selectedJsonPath: state.selectedJsonPath || 'None',
                selectedJsonName: state.selectedJsonName || 'None',
                fileExists: fileExists,
                jsonAnalysisPresent: !!state.jsonAnalysis,
                jsonAnalysisFields: state.jsonAnalysis ? state.jsonAnalysis.fields.map(f => f.name) : [],
                dimensionMappingsCount: state.dimensionMappings.length,
                isDimensionMappingConfigured: state.isDimensionMappingConfigured,
                isReadyToLaunch: state.isReadyToLaunch,
                requiredDimensions: state.selectedChart?.dimensions.map(d => d.name) || [],
                mappedDimensions: state.dimensionMappings.map(m => `${m.dimension}: ${m.dataField}`)
            };
            // Create diagnostic message
            const message = [
                'Visualize Data State Diagnostic:',
                '',
                `Chart: ${stateInfo.selectedChart}`,
                `Required Dimensions: [${stateInfo.requiredDimensions.join(', ')}]`,
                '',
                `JSON File: ${stateInfo.selectedJsonName}`,
                `Path: ${stateInfo.selectedJsonPath}`,
                `File Exists: ${stateInfo.fileExists}`,
                `Analysis Present: ${stateInfo.jsonAnalysisPresent}`,
                `Available Fields: [${stateInfo.jsonAnalysisFields.join(', ')}]`,
                '',
                `Mapped Dimensions: ${stateInfo.mappedDimensions.length}`,
                ...stateInfo.mappedDimensions.map(mapping => `  - ${mapping}`),
                '',
                `Configuration Complete: ${stateInfo.isDimensionMappingConfigured}`,
                `Ready to Launch: ${stateInfo.isReadyToLaunch}`
            ].join('\n');
            console.log('VISUALIZE_DATA: State diagnostic:', stateInfo);
            // Show diagnostic information
            await vscode.window.showInformationMessage('Visualize Data state diagnostic sent to console. Check Output > Log (Extension Host) for details.', { modal: false });
            console.log('VISUALIZE_DATA: Full state diagnostic:\n' + message);
        }
        catch (error) {
            console.error('VISUALIZE_DATA: Error generating debug state:', error);
            vscode.window.showErrorMessage(`Debug state failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Cleanup resources
     */
    cleanup() {
        console.log('VISUALIZE_DATA: Action handler cleanup');
        // Note: We don't dispose the state manager here as it may be used by other components
    }
    /**
     * Get state manager instance
     */
    getStateManager() {
        return this.stateManager;
    }
}
exports.VisualizationLauncher = VisualizationLauncher;


/***/ }),
/* 42 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BabiaChartRegistry = void 0;
const templateCharts_1 = __webpack_require__(43);
/**
 * BabiaXR Chart Registry
 * Central registry for available chart types and their metadata
 */
class BabiaChartRegistry {
    static instance;
    charts = new Map();
    constructor() {
        this.initializeCharts();
    }
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!BabiaChartRegistry.instance) {
            BabiaChartRegistry.instance = new BabiaChartRegistry();
        }
        return BabiaChartRegistry.instance;
    }
    /**
     * Initialize all chart definitions from templates
     */
    initializeCharts() {
        // Register all chart templates
        for (const chartTemplate of templateCharts_1.chartTemplates) {
            this.charts.set(chartTemplate.id, chartTemplate);
        }
        console.log('BABIA_TEMPLATES: Initialized chart registry with chart templates');
    }
    /**
     * Register a new chart type
     */
    registerChart(chart) {
        this.charts.set(chart.id, chart);
        console.log(`BABIA_TEMPLATES: Registered chart type '${chart.id}'`);
    }
    /**
     * Get a chart by ID
     */
    getChart(chartId) {
        return this.charts.get(chartId);
    }
    /**
     * Get all available charts
     */
    getAllCharts() {
        return Array.from(this.charts.values());
    }
    /**
     * Get charts by category
     */
    getChartsByCategory(category) {
        return Array.from(this.charts.values()).filter(chart => chart.category === category);
    }
    /**
     * Check if a chart type exists
     */
    hasChart(chartId) {
        return this.charts.has(chartId);
    }
    /**
     * Get all available chart IDs
     */
    getChartIds() {
        return Array.from(this.charts.keys());
    }
    /**
     * Get chart names for display
     */
    getChartNames() {
        return Array.from(this.charts.values()).map(chart => ({
            id: chart.id,
            name: chart.name,
            description: chart.description
        }));
    }
}
exports.BabiaChartRegistry = BabiaChartRegistry;


/***/ }),
/* 43 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.chartTemplates = void 0;
/**
 * BabiaXR Chart Templates
 * Defines all available chart types with their metadata and simplified HTML templates
 */
exports.chartTemplates = [
    // Bar Chart Template
    {
        id: 'bars',
        name: 'Bar Chart',
        description: '3D vertical bars representing data values',
        category: 'linear',
        dimensions: [
            {
                name: 'x_axis',
                label: 'Categories (X-Axis)',
                dataType: 'any',
                required: true,
                description: 'Field containing category names for x-axis'
            },
            {
                name: 'height',
                label: 'Height Values',
                dataType: 'numeric',
                required: true,
                description: 'Field containing numeric values for bar heights'
            }
        ],
        htmlTemplate: `<!-- Bar Chart -->
                <a-entity id="chart"
                    babia-bars="from: data;
                                title: {{TITLE}};
                                legend: true;
                                palette: {{PALETTE}};
                                x_axis: {{X_AXIS_FIELD}};
                                height: {{HEIGHT_FIELD}};
                                axis_name: true"
                    position="0 2 -10"
                    rotation="0 0 0"
                    scale="1.5 1.5 1.5">
                </a-entity>`
    },
    // Barsmap Chart Template
    {
        id: 'barsmap',
        name: 'Barsmap Chart',
        description: '3D bar map with multiple axes representing data relationships',
        category: 'linear',
        dimensions: [
            {
                name: 'x_axis',
                label: 'X-Axis Categories',
                dataType: 'any',
                required: true,
                description: 'Field containing category names for x-axis'
            },
            {
                name: 'z_axis',
                label: 'Z-Axis Categories',
                dataType: 'any',
                required: true,
                description: 'Field containing category names for z-axis'
            },
            {
                name: 'height',
                label: 'Height Values',
                dataType: 'numeric',
                required: true,
                description: 'Field containing numeric values for bar heights'
            }
        ],
        htmlTemplate: `<!-- Barsmap Chart -->
                <a-entity id="chart"
                    babia-barsmap="from: data;
                                   title: {{TITLE}};
                                   legend: true;
                                   palette: {{PALETTE}};
                                   x_axis: {{X_AXIS_FIELD}};
                                   z_axis: {{Z_AXIS_FIELD}};
                                   height: {{HEIGHT_FIELD}};
                                   axis_name: true"
                    position="0 2 -10"
                    rotation="0 0 0"
                    scale="1.5 1.5 1.5">
                </a-entity>`
    },
    // Cyls Chart Template
    {
        id: 'cyls',
        name: 'Cyls Chart',
        description: '3D cylinders representing data values with configurable radius',
        category: 'cylindrical',
        dimensions: [
            {
                name: 'x_axis',
                label: 'Categories',
                dataType: 'any',
                required: true,
                description: 'Field containing category names for x-axis'
            },
            {
                name: 'height',
                label: 'Height Values',
                dataType: 'numeric',
                required: true,
                description: 'Field containing numeric values for cylinder heights'
            },
            {
                name: 'radius',
                label: 'Radius Values',
                dataType: 'numeric',
                required: true,
                description: 'Field containing numeric values for cylinder radius'
            }
        ],
        htmlTemplate: `<!-- Cyls Chart -->
                <a-entity id="chart"
                    babia-cyls="from: data;
                                title: {{TITLE}};
                                legend: true;
                                palette: {{PALETTE}};
                                x_axis: {{X_AXIS_FIELD}};
                                height: {{HEIGHT_FIELD}};
                                radius: {{RADIUS_FIELD}};
                                axis_name: true"
                    position="0 2 -10"
                    rotation="0 0 0"
                    scale="1.5 1.5 1.5">
                </a-entity>`
    },
    // Cylsmap Chart Template
    {
        id: 'cylsmap',
        name: 'Cylsmap Chart',
        description: '3D cylinder map with multiple axes representing data relationships',
        category: 'cylindrical',
        dimensions: [
            {
                name: 'x_axis',
                label: 'X-Axis Categories',
                dataType: 'any',
                required: true,
                description: 'Field containing category names for x-axis'
            },
            {
                name: 'z_axis',
                label: 'Z-Axis Categories',
                dataType: 'any',
                required: true,
                description: 'Field containing category names for z-axis'
            },
            {
                name: 'height',
                label: 'Height Values',
                dataType: 'numeric',
                required: true,
                description: 'Field containing numeric values for cylinder heights'
            },
            {
                name: 'radius',
                label: 'Radius Values',
                dataType: 'numeric',
                required: true,
                description: 'Field containing numeric values for cylinder radius'
            }
        ],
        htmlTemplate: `<!-- Cylsmap Chart -->
                <a-entity id="chart"
                    babia-cylsmap="from: data;
                                   title: {{TITLE}};
                                   legend: true;
                                   palette: {{PALETTE}};
                                   x_axis: {{X_AXIS_FIELD}};
                                   z_axis: {{Z_AXIS_FIELD}};
                                   height: {{HEIGHT_FIELD}};
                                   radius: {{RADIUS_FIELD}};
                                   axis_name: true"
                    position="0 2 -10"
                    rotation="0 0 0"
                    scale="1.5 1.5 1.5">
                </a-entity>`
    },
    // Donut Chart Template
    {
        id: 'donut',
        name: 'Donut Chart',
        description: 'A circular chart with a hole in the center, ideal for showing proportional data',
        category: 'circular',
        dimensions: [
            {
                name: 'key',
                label: 'Categories',
                dataType: 'any',
                required: true,
                description: 'Field containing category names'
            },
            {
                name: 'size',
                label: 'Values',
                dataType: 'numeric',
                required: true,
                description: 'Field containing numeric values for each category'
            }
        ],
        htmlTemplate: `<!-- Donut Chart -->
                <a-entity id="chart"
                    babia-donut="from: data;
                                 title: {{TITLE}};
                                 legend: true;
                                 palette: {{PALETTE}};
                                 key: {{KEY_FIELD}};
                                 size: {{SIZE_FIELD}};
                                 axis_name: true"
                    position="0 2 -10"
                    rotation="0 0 0"
                    scale="1.5 1.5 1.5">
                </a-entity>`
    },
    // Pie Chart Template
    {
        id: 'pie',
        name: 'Pie Chart',
        description: 'Circular chart divided into sectors representing proportional data',
        category: 'circular',
        dimensions: [
            {
                name: 'key',
                label: 'Categories',
                dataType: 'any',
                required: true,
                description: 'Field containing category names'
            },
            {
                name: 'size',
                label: 'Values',
                dataType: 'numeric',
                required: true,
                description: 'Field containing numeric values for each sector'
            }
        ],
        htmlTemplate: `<!-- Pie Chart -->
                <a-entity id="chart"
                    babia-pie="from: data;
                               title: {{TITLE}};
                               legend: true;
                               palette: {{PALETTE}};
                               key: {{KEY_FIELD}};
                               size: {{SIZE_FIELD}};
                               axis_name: true"
                    position="0 2 -10"
                    rotation="0 0 0"
                    scale="1.5 1.5 1.5">
                </a-entity>`
    },
    // Bubbles Chart Template
    {
        id: 'bubbles',
        name: 'Bubbles Chart',
        description: '3D bubbles representing data values with variable size and position',
        category: 'scatter',
        dimensions: [
            {
                name: 'x_axis',
                label: 'X-Axis Values',
                dataType: 'any',
                required: true,
                description: 'Field containing values for x-axis positioning'
            },
            {
                name: 'z_axis',
                label: 'Z-Axis Values',
                dataType: 'any',
                required: true,
                description: 'Field containing values for z-axis positioning'
            },
            {
                name: 'height',
                label: 'Height Values',
                dataType: 'numeric',
                required: true,
                description: 'Field containing numeric values for bubble height positioning'
            },
            {
                name: 'radius',
                label: 'Radius Values',
                dataType: 'numeric',
                required: true,
                description: 'Field containing numeric values for bubble radius/size'
            }
        ],
        htmlTemplate: `<!-- Bubbles Chart -->
                <a-entity id="chart"
                    babia-bubbles="from: data;
                                   title: {{TITLE}};
                                   legend: true;
                                   palette: {{PALETTE}};
                                   x_axis: {{X_AXIS_FIELD}};
                                   z_axis: {{Z_AXIS_FIELD}};
                                   height: {{HEIGHT_FIELD}};
                                   radius: {{RADIUS_FIELD}};
                                   axis_name: true"
                    position="0 2 -10"
                    rotation="0 0 0"
                    scale="1.5 1.5 1.5">
                </a-entity>`
    },
    // Boats Chart Template
    {
        id: 'boats',
        name: 'Boats Chart',
        description: '3D boat-shaped visualizations representing data with area, height, and color mapping',
        category: 'geometric',
        dimensions: [
            {
                name: 'area',
                label: 'Area Values',
                dataType: 'numeric',
                required: true,
                description: 'Field containing numeric values for boat area size (e.g., parameters, function count)'
            },
            {
                name: 'height',
                label: 'Height Values',
                dataType: 'numeric',
                required: true,
                description: 'Field containing numeric values for boat height (e.g., lines count, complexity)'
            },
            {
                name: 'color',
                label: 'Color Values',
                dataType: 'numeric',
                required: true,
                description: 'Field containing numeric values for color mapping (e.g., complexity, density)'
            }
        ],
        htmlTemplate: `<!-- Boats Chart -->
                <a-entity id="chart"
                    babia-boats="from: data;
                                 title: {{TITLE}};
                                 legend: true;
                                 palette: {{PALETTE}};
                                 area: {{AREA_FIELD}};
                                 height: {{HEIGHT_FIELD}};
                                 color: {{COLOR_FIELD}};
                                 axis_name: true"
                    position="0 2 -10"
                    rotation="0 0 0"
                    scale="1.5 1.5 1.5">
                </a-entity>`
    }
];


/***/ }),
/* 44 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VisualizeDataStateManager = void 0;
const vscode = __importStar(__webpack_require__(1));
const fs = __importStar(__webpack_require__(6));
/**
 * Visualize Data State Manager
 * Manages state persistence and updates for visualization configuration
 */
class VisualizeDataStateManager {
    static instance;
    state;
    context;
    // Event emitter for state changes
    _onStateChanged = new vscode.EventEmitter();
    onStateChanged = this._onStateChanged.event;
    constructor(context) {
        this.context = context;
        this.state = this.loadState();
        console.log('VISUALIZE-STATE: State manager initialized with state:', {
            hasChart: !!this.state.selectedChart,
            hasJsonPath: !!this.state.selectedJsonPath,
            mappingsCount: this.state.dimensionMappings.length,
            isReadyToLaunch: this.state.isReadyToLaunch
        });
    }
    /**
     * Get singleton instance
     */
    static getInstance(context) {
        if (!VisualizeDataStateManager.instance) {
            if (!context) {
                throw new Error('Context required for first initialization');
            }
            VisualizeDataStateManager.instance = new VisualizeDataStateManager(context);
        }
        return VisualizeDataStateManager.instance;
    }
    /**
     * Check if instance exists (for safe access)
     */
    static hasInstance() {
        return !!VisualizeDataStateManager.instance;
    }
    /**
     * Get initial state
     */
    getInitialState() {
        return {
            selectedChart: undefined,
            selectedJsonPath: undefined,
            selectedJsonName: undefined,
            jsonAnalysis: undefined,
            dimensionMappings: [],
            isDimensionMappingConfigured: false,
            isReadyToLaunch: false
        };
    }
    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }
    /**
     * Update selected chart
     */
    updateSelectedChart(chart) {
        console.log('VISUALIZE-STATE: Chart selected:', {
            chartId: chart.id,
            chartName: chart.name,
            requiredDimensions: chart.dimensions.filter(d => d.required).map(d => d.name),
            previousMappings: this.state.dimensionMappings.length
        });
        this.state = {
            ...this.state,
            selectedChart: chart,
            dimensionMappings: [], // Clear dimension mappings when chart changes
            isDimensionMappingConfigured: false, // Reset dimension mapping when chart changes
            isReadyToLaunch: this.calculateReadyToLaunch(chart, this.state.selectedJsonPath, false)
        };
        this.saveState();
        this.notifyStateChange();
        console.log('VISUALIZE-STATE: Chart selection updated, cleared previous mappings');
    }
    /**
     * Update selected JSON file
     */
    updateSelectedJson(filePath, fileName) {
        const isValidPath = filePath && fs.existsSync(filePath);
        console.log('VISUALIZE-STATE: JSON file selection:', {
            fileName: fileName || 'none',
            filePath: filePath || 'none',
            fileExists: isValidPath,
            previousFile: this.state.selectedJsonName || 'none'
        });
        this.state = {
            ...this.state,
            selectedJsonPath: isValidPath ? filePath : undefined,
            selectedJsonName: isValidPath ? fileName : undefined,
            jsonAnalysis: isValidPath ? this.state.jsonAnalysis : undefined,
            dimensionMappings: isValidPath ? this.state.dimensionMappings : [], // Clear mappings if invalid file
            isDimensionMappingConfigured: isValidPath ? this.state.isDimensionMappingConfigured : false,
            isReadyToLaunch: this.calculateReadyToLaunch(this.state.selectedChart, isValidPath ? filePath : undefined, isValidPath ? this.state.isDimensionMappingConfigured : false)
        };
        this.saveState();
        this.notifyStateChange();
        if (!isValidPath && filePath) {
            console.warn('VISUALIZE-STATE: Invalid or non-existent file path provided:', filePath);
        }
    }
    /**
     * Update dimension mapping configuration
     */
    updateDimensionMapping(isConfigured) {
        console.log(`BABIA-TEMPLATES: Dimension mapping configured: ${isConfigured}`);
        this.state = {
            ...this.state,
            isDimensionMappingConfigured: isConfigured,
            isReadyToLaunch: this.calculateReadyToLaunch(this.state.selectedChart, this.state.selectedJsonPath, isConfigured)
        };
        this.notifyStateChange();
    }
    /**
     * Calculate if ready to launch visualization
     */
    calculateReadyToLaunch(chart, jsonPath, dimensionMappingConfigured) {
        const hasChart = !!chart;
        const hasJson = !!jsonPath;
        const hasDimensionMapping = dimensionMappingConfigured ?? this.state.isDimensionMappingConfigured;
        return hasChart && hasJson && hasDimensionMapping;
    }
    /**
     * Reset state
     */
    reset() {
        console.log('BABIA-TEMPLATES: State reset');
        this.state = this.getInitialState();
        this.notifyStateChange();
    }
    /**
     * Notify state change
     */
    notifyStateChange() {
        this._onStateChanged.fire(this.getState());
    }
    /**
     * Check if chart is selected
     */
    hasSelectedChart() {
        return !!this.state.selectedChart;
    }
    /**
     * Check if JSON is selected
     */
    hasSelectedJson() {
        return !!this.state.selectedJsonPath;
    }
    /**
     * Get selected chart name for display
     */
    getSelectedChartName() {
        return this.state.selectedChart?.name;
    }
    /**
     * Get selected JSON name for display
     */
    getSelectedJsonName() {
        return this.state.selectedJsonName;
    }
    /**
     * Update JSON analysis result
     */
    updateJsonAnalysis(jsonAnalysis) {
        console.log('DIMENSION-MAPPING: Updating JSON analysis result');
        this.state.jsonAnalysis = jsonAnalysis;
        // Clear existing dimension mappings when JSON changes
        this.state.dimensionMappings = [];
        this.updateComputedProperties();
        this.saveState();
        this._onStateChanged.fire(this.state);
        console.log('DIMENSION-MAPPING: JSON analysis updated', {
            fieldsCount: jsonAnalysis.fields.length,
            numericFieldsCount: jsonAnalysis.fields.filter(f => f.isNumeric).length
        });
    }
    /**
     * Update dimension mappings
     */
    updateDimensionMappings(mappings) {
        console.log('DIMENSION-MAPPING: Updating dimension mappings');
        this.state.dimensionMappings = mappings;
        this.updateComputedProperties();
        this.saveState();
        this._onStateChanged.fire(this.state);
        console.log('DIMENSION-MAPPING: Dimension mappings updated', {
            count: mappings.length,
            mappings: mappings.map(m => `${m.dimension} -> ${m.dataField}`)
        });
    }
    /**
     * Update single dimension mapping
     */
    updateSingleDimensionMapping(dimensionName, fieldName) {
        console.log(`DIMENSION-MAPPING: Updating mapping for dimension '${dimensionName}' to field '${fieldName}'`);
        // Remove existing mapping for this dimension
        this.state.dimensionMappings = this.state.dimensionMappings.filter(mapping => mapping.dimension !== dimensionName);
        // Add new mapping
        const newMapping = {
            dimension: dimensionName,
            dataField: fieldName
        };
        this.state.dimensionMappings.push(newMapping);
        // Check for duplicate field usage and provide detailed warning
        const duplicateMappings = this.state.dimensionMappings.filter(mapping => mapping.dataField === fieldName);
        if (duplicateMappings.length > 1) {
            const affectedDimensions = duplicateMappings.map(m => m.dimension).join(', ');
            console.log(`DIMENSION-MAPPING: Warning - Field '${fieldName}' is used in multiple dimensions: ${affectedDimensions}`);
            // Log each duplicate mapping for clarity
            duplicateMappings.forEach(mapping => {
                console.log(`DIMENSION-MAPPING: Field '${fieldName}' mapped to dimension '${mapping.dimension}'`);
            });
        }
        this.updateComputedProperties();
        this.saveState();
        this._onStateChanged.fire(this.state);
        console.log('DIMENSION-MAPPING: Single dimension mapping updated', {
            dimension: dimensionName,
            field: fieldName,
            totalMappings: this.state.dimensionMappings.length
        });
    }
    /**
     * Update computed properties based on current state
     */
    updateComputedProperties() {
        // Check if dimension mapping is configured
        this.state.isDimensionMappingConfigured = this.areDimensionsMapped();
        // Check if ready to launch visualization
        this.state.isReadyToLaunch = this.canLaunchVisualization();
    }
    /**
     * Check if dimensions are properly mapped
     */
    areDimensionsMapped() {
        if (!this.state.selectedChart) {
            return false;
        }
        const requiredDimensions = this.state.selectedChart.dimensions.filter(d => d.required);
        return requiredDimensions.every(dimension => this.state.dimensionMappings.some(mapping => mapping.dimension === dimension.name));
    }
    /**
     * Check if visualization can be launched
     */
    canLaunchVisualization() {
        return !!(this.state.selectedChart &&
            this.state.selectedJsonPath &&
            this.state.isDimensionMappingConfigured);
    }
    /**
     * Save state to persistent storage
     */
    saveState() {
        try {
            this.context.workspaceState.update('visualizeDataState', this.state);
            console.log('BABIA-TEMPLATES: State saved to workspace storage');
        }
        catch (error) {
            console.error('BABIA-TEMPLATES: Failed to save state:', error);
        }
    }
    /**
     * Load state from persistent storage
     */
    loadState() {
        try {
            const savedState = this.context.workspaceState.get('visualizeDataState');
            if (savedState) {
                console.log('VISUALIZE-STATE: Loading saved state from workspace storage:', {
                    selectedChart: savedState.selectedChart || 'none',
                    selectedJsonPath: savedState.selectedJsonPath || 'none',
                    hasJsonAnalysis: !!savedState.jsonAnalysis,
                    hasDimensionMappings: !!savedState.dimensionMappings?.length,
                    isDimensionMappingConfigured: savedState.isDimensionMappingConfigured || false
                });
                // Validate file path if it exists
                const isValidJsonPath = savedState.selectedJsonPath && fs.existsSync(savedState.selectedJsonPath);
                if (savedState.selectedJsonPath && !isValidJsonPath) {
                    console.warn('VISUALIZE-STATE: Stored JSON file no longer exists:', savedState.selectedJsonPath);
                }
                // Ensure all required properties exist with validation
                const validatedState = {
                    ...this.getInitialState(),
                    ...savedState,
                    // Reset file-related state if path is invalid
                    selectedJsonPath: isValidJsonPath ? savedState.selectedJsonPath : undefined,
                    selectedJsonName: isValidJsonPath ? savedState.selectedJsonName : undefined,
                    jsonAnalysis: isValidJsonPath ? savedState.jsonAnalysis : undefined,
                    dimensionMappings: isValidJsonPath ? (savedState.dimensionMappings || []) : [],
                    isDimensionMappingConfigured: isValidJsonPath ? (savedState.isDimensionMappingConfigured || false) : false
                };
                // Recalculate ready state based on validated data
                validatedState.isReadyToLaunch = this.calculateReadyToLaunch(validatedState.selectedChart, validatedState.selectedJsonPath, validatedState.isDimensionMappingConfigured);
                console.log('VISUALIZE-STATE: State loaded and validated:', {
                    finalChart: validatedState.selectedChart,
                    finalJsonPath: validatedState.selectedJsonPath,
                    finalJsonExists: validatedState.selectedJsonPath ? fs.existsSync(validatedState.selectedJsonPath) : false,
                    finalMappingsCount: validatedState.dimensionMappings.length,
                    finalIsConfigured: validatedState.isDimensionMappingConfigured,
                    finalIsReady: validatedState.isReadyToLaunch
                });
                return validatedState;
            }
        }
        catch (error) {
            console.error('VISUALIZE-STATE: Failed to load state:', error);
        }
        console.log('VISUALIZE-STATE: No stored state found, using initial state');
        return this.getInitialState();
    }
    /**
     * Cleanup resources
     */
    dispose() {
        this._onStateChanged.dispose();
    }
}
exports.VisualizeDataStateManager = VisualizeDataStateManager;


/***/ }),
/* 45 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.JsonFieldAnalyzer = void 0;
const fs = __importStar(__webpack_require__(6));
/**
 * JSON Field Analyzer
 * Analyzes JSON files to extract available fields and their types
 */
class JsonFieldAnalyzer {
    /**
     * Analyze a JSON file and extract field information
     */
    static async analyzeJsonFile(filePath) {
        console.log(`DIMENSION-MAPPING: Analyzing JSON file: ${filePath}`);
        try {
            // Read and parse JSON file
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const jsonData = JSON.parse(fileContent);
            console.log(`DIMENSION-MAPPING: JSON parsed successfully`);
            // Analyze the data structure
            const analysisResult = this.analyzeDataStructure(jsonData, filePath);
            console.log(`DIMENSION-MAPPING: Found ${analysisResult.fields.length} fields in ${analysisResult.recordCount} records`);
            analysisResult.fields.forEach(field => {
                console.log(`DIMENSION-MAPPING: Field '${field.name}' - Type: ${field.type}, Numeric: ${field.isNumeric}, Values: ${field.valueCount}`);
            });
            return analysisResult;
        }
        catch (error) {
            console.error(`DIMENSION-MAPPING: Error analyzing JSON file:`, error);
            return {
                success: false,
                fields: [],
                error: `Failed to analyze JSON file: ${error instanceof Error ? error.message : 'Unknown error'}`,
                recordCount: 0,
                filePath
            };
        }
    }
    /**
     * Analyze data structure and extract field information
     */
    static analyzeDataStructure(data, filePath) {
        const fields = new Map();
        let recordCount = 0;
        // Handle different data structures
        if (Array.isArray(data)) {
            // Array of objects
            recordCount = data.length;
            data.forEach((record, index) => {
                if (typeof record === 'object' && record !== null) {
                    this.analyzeRecord(record, fields, index < 10); // Only collect samples from first 10 records
                }
            });
        }
        else if (typeof data === 'object' && data !== null) {
            // Single object
            recordCount = 1;
            this.analyzeRecord(data, fields, true);
        }
        else {
            throw new Error('JSON data must be an object or array of objects');
        }
        return {
            success: true,
            fields: Array.from(fields.values()),
            recordCount,
            filePath
        };
    }
    /**
     * Analyze a single record and update field information
     */
    static analyzeRecord(record, fields, collectSamples) {
        for (const [fieldName, value] of Object.entries(record)) {
            let fieldInfo = fields.get(fieldName);
            if (!fieldInfo) {
                fieldInfo = {
                    name: fieldName,
                    type: 'unknown',
                    isNumeric: false,
                    sampleValues: [],
                    valueCount: 0
                };
                fields.set(fieldName, fieldInfo);
            }
            // Skip null/undefined values
            if (value === null || value === undefined) {
                return;
            }
            fieldInfo.valueCount++;
            // Determine field type
            const valueType = this.getValueType(value);
            if (fieldInfo.type === 'unknown') {
                fieldInfo.type = valueType;
            }
            else if (fieldInfo.type !== valueType) {
                // Mixed types - mark as string by default
                fieldInfo.type = 'string';
            }
            // Check if numeric
            if (this.isNumericValue(value)) {
                fieldInfo.isNumeric = true;
            }
            // Collect sample values
            if (collectSamples && fieldInfo.sampleValues.length < 5) {
                fieldInfo.sampleValues.push(value);
            }
        }
    }
    /**
     * Get the type of a value
     */
    static getValueType(value) {
        if (typeof value === 'string') {
            return 'string';
        }
        if (typeof value === 'number') {
            return 'number';
        }
        if (typeof value === 'boolean') {
            return 'boolean';
        }
        if (Array.isArray(value)) {
            return 'array';
        }
        if (typeof value === 'object') {
            return 'object';
        }
        if (value === null) {
            return 'null';
        }
        return 'unknown';
    }
    /**
     * Check if a value is numeric
     */
    static isNumericValue(value) {
        if (typeof value === 'number') {
            return !isNaN(value) && isFinite(value);
        }
        if (typeof value === 'string') {
            const num = parseFloat(value);
            return !isNaN(num) && isFinite(num) && value.trim() !== '';
        }
        return false;
    }
    /**
     * Get fields suitable for a specific dimension type
     */
    static getFieldsForDimensionType(analysisResult, dimensionDataType) {
        if (!analysisResult.success) {
            return [];
        }
        if (dimensionDataType === 'numeric') {
            return analysisResult.fields.filter(field => field.isNumeric);
        }
        // For 'any' type, return all fields
        return analysisResult.fields;
    }
    /**
     * Format field for display in QuickPick
     */
    static formatFieldForDisplay(field) {
        const typeInfo = field.isNumeric ? `${field.type} (numeric)` : field.type;
        const sampleText = field.sampleValues.length > 0
            ? `Samples: ${field.sampleValues.slice(0, 3).map(v => JSON.stringify(v)).join(', ')}`
            : '';
        return {
            label: field.name,
            description: typeInfo,
            detail: `${field.valueCount} values${sampleText ? ' • ' + sampleText : ''}`
        };
    }
}
exports.JsonFieldAnalyzer = JsonFieldAnalyzer;


/***/ }),
/* 46 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TemplateProcessor = void 0;
const dimensionValidator_1 = __webpack_require__(47);
const templateCharts_1 = __webpack_require__(43);
const fs = __importStar(__webpack_require__(6));
const path = __importStar(__webpack_require__(5));
/**
 * BabiaXR Template Processor
 * Main and centralized processor for generating XR visualization HTML files
 * Handles template processing, placeholder replacement, and HTML generation
 */
class TemplateProcessor {
    /**
     * Main method to generate complete XR visualization index.html
     * This is the centralized method that both visualize data and XR analysis should use
     */
    static async generateXRVisualization(chartId, mappings, title, dataSource, context, outputPath) {
        try {
            console.log('TEMPLATE_PROCESSOR: Starting XR visualization generation');
            console.log('TEMPLATE_PROCESSOR: Chart ID:', chartId);
            console.log('TEMPLATE_PROCESSOR: Mappings:', mappings);
            console.log('TEMPLATE_PROCESSOR: Title:', title);
            console.log('TEMPLATE_PROCESSOR: Data source:', dataSource);
            // Find the chart template
            const chart = templateCharts_1.chartTemplates.find(c => c.id === chartId);
            if (!chart) {
                return { success: false, error: `Chart type '${chartId}' not found` };
            }
            // Get visualization settings
            const visualizationSettings = await this.getVisualizationSettings();
            console.log('TEMPLATE_PROCESSOR: Using visualization settings:', visualizationSettings);
            // Load XR base template
            const xrTemplate = await this.loadXRTemplate(context);
            if (!xrTemplate) {
                return { success: false, error: 'Failed to load XR template' };
            }
            // Generate chart component HTML
            const chartComponent = await this.generateChartComponent(chart, mappings, title, visualizationSettings.palette);
            // Replace all placeholders in the XR template
            const finalHtml = this.replaceXRTemplatePlaceholders(xrTemplate, {
                title,
                dataSource,
                chartComponent,
                ...visualizationSettings
            });
            // Write the final HTML file
            fs.writeFileSync(outputPath, finalHtml, 'utf8');
            console.log('TEMPLATE_PROCESSOR: Generated XR visualization HTML at:', outputPath);
            return { success: true };
        }
        catch (error) {
            console.error('TEMPLATE_PROCESSOR: Error generating XR visualization:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Get visualization settings (palette, environment, colors)
     */
    static async getVisualizationSettings() {
        // Import visualization settings functions directly (no dynamic import needed)
        const { getSelectedPalette, getSelectedEnvironment, getSelectedBackgroundColor, getSelectedGroundColor } = __webpack_require__(48);
        return {
            palette: await getSelectedPalette(),
            environment: await getSelectedEnvironment(),
            backgroundColor: await getSelectedBackgroundColor(),
            groundColor: await getSelectedGroundColor()
        };
    }
    /**
     * Load XR base template from templates/xr/xr-visualization.html
     */
    static async loadXRTemplate(context) {
        try {
            const templatePath = path.join(context.extensionPath, 'templates', 'xr', 'xr-visualization.html');
            if (!fs.existsSync(templatePath)) {
                console.error('TEMPLATE_PROCESSOR: XR template not found at:', templatePath);
                return null;
            }
            const template = fs.readFileSync(templatePath, 'utf8');
            console.log('TEMPLATE_PROCESSOR: Loaded XR template from:', templatePath);
            return template;
        }
        catch (error) {
            console.error('TEMPLATE_PROCESSOR: Error loading XR template:', error);
            return null;
        }
    }
    /**
     * Generate chart component HTML using the chart template
     */
    static async generateChartComponent(chart, mappings, title, palette) {
        console.log('TEMPLATE_PROCESSOR: Generating chart component for:', chart.id);
        // Create configuration for chart processing
        const config = {
            chartType: chart.id,
            title: title,
            dataFilePath: 'data.json',
            dimensionMappings: mappings,
            options: {
                palette: palette
            }
        };
        // Process the chart template
        const result = await this.processTemplate(chart, mappings, config);
        if (!result.success) {
            console.error('TEMPLATE_PROCESSOR: Chart component generation failed:', result.error);
            return `<!-- Chart generation error: ${result.error || 'Unknown error'} -->`;
        }
        console.log('TEMPLATE_PROCESSOR: Chart component generated successfully');
        return result.html || '';
    }
    /**
     * Replace all placeholders in the XR template
     */
    static replaceXRTemplatePlaceholders(template, values) {
        console.log('TEMPLATE_PROCESSOR: Replacing XR template placeholders');
        let result = template;
        // Define placeholder replacements
        const replacements = {
            'TITLE': values.title,
            'DATA_SOURCE': values.dataSource,
            'CHART_COMPONENT': values.chartComponent,
            'CHART_PALETTE': values.palette,
            'ENVIRONMENT_PRESET': values.environment,
            'BACKGROUND_COLOR': values.backgroundColor,
            'GROUND_COLOR': values.groundColor,
            'TREE_BUILDER': '', // Not needed for basic charts
            'ICON_PATH': '' // Optional
        };
        // Replace all placeholders
        for (const [placeholder, value] of Object.entries(replacements)) {
            const patterns = [
                new RegExp(`\\$\\{${this.escapeRegex(placeholder)}\\}`, 'g'),
                new RegExp(`\\{\\{\\s*${this.escapeRegex(placeholder)}\\s*\\}\\}`, 'g')
            ];
            for (const pattern of patterns) {
                result = result.replace(pattern, value);
            }
        }
        console.log('TEMPLATE_PROCESSOR: XR template placeholders replaced');
        return result;
    }
    /**
     * Process a chart template with given configuration and mappings
     */
    static async processTemplate(chart, mappings, config) {
        // Validate dimensions first
        const validation = dimensionValidator_1.DimensionValidator.validateMappings(chart, mappings);
        if (!validation.isValid) {
            return {
                success: false,
                html: '',
                error: validation.errors.join('; '),
                warnings: validation.warnings
            };
        }
        try {
            // Start with the base template
            let html = chart.htmlTemplate;
            // Create placeholder replacements map
            const replacements = this.createPlaceholderReplacements(chart, mappings, config);
            // Replace all placeholders
            html = this.replacePlaceholders(html, replacements);
            // Validate final HTML
            const htmlValidation = this.validateGeneratedHtml(html);
            if (!htmlValidation.isValid) {
                return {
                    success: false,
                    html: '',
                    error: htmlValidation.error || 'Generated HTML is invalid',
                    warnings: validation.warnings
                };
            }
            return {
                success: true,
                html: html,
                warnings: validation.warnings
            };
        }
        catch (error) {
            return {
                success: false,
                html: '',
                error: `Template processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                warnings: validation.warnings
            };
        }
    }
    /**
     * Create map of placeholder replacements based on mappings and config
     */
    static createPlaceholderReplacements(chart, mappings, config) {
        const replacements = new Map();
        // Add basic configuration replacements
        replacements.set('TITLE', config.title || chart.name);
        replacements.set('DATA_SOURCE', config.dataFilePath || 'data.json');
        replacements.set('CHART_ID', `chart-${chart.id}-${Date.now()}`);
        // Add dimension-specific replacements
        for (const mapping of mappings) {
            const dimension = chart.dimensions.find(d => d.name === mapping.dimension);
            if (dimension) {
                // Create various placeholder formats for the dimension
                const upperDimension = mapping.dimension.toUpperCase();
                const fieldName = mapping.dataField;
                replacements.set(`${upperDimension}_FIELD`, fieldName);
                replacements.set(`${mapping.dimension}_field`, fieldName);
                replacements.set(mapping.dimension, fieldName);
                // Special common dimension mappings
                switch (mapping.dimension.toLowerCase()) {
                    case 'key':
                    case 'category':
                        replacements.set('KEY_FIELD', fieldName);
                        replacements.set('CATEGORY_FIELD', fieldName);
                        break;
                    case 'size':
                    case 'value':
                        replacements.set('SIZE_FIELD', fieldName);
                        replacements.set('VALUE_FIELD', fieldName);
                        break;
                    case 'height':
                        replacements.set('HEIGHT_FIELD', fieldName);
                        break;
                    case 'color':
                        replacements.set('COLOR_FIELD', fieldName);
                        break;
                }
            }
        }
        // Add chart-specific attributes
        if (config.options) {
            for (const [key, value] of Object.entries(config.options)) {
                replacements.set(key.toUpperCase(), String(value));
                replacements.set(key, String(value));
            }
        }
        return replacements;
    }
    /**
     * Replace placeholders in template with actual values
     */
    static replacePlaceholders(template, replacements) {
        let result = template;
        // Replace {{PLACEHOLDER}} format
        for (const [placeholder, value] of replacements) {
            const patterns = [
                new RegExp(`\\{\\{\\s*${this.escapeRegex(placeholder)}\\s*\\}\\}`, 'g'),
                new RegExp(`\\$\\{\\s*${this.escapeRegex(placeholder)}\\s*\\}`, 'g')
            ];
            for (const pattern of patterns) {
                result = result.replace(pattern, value);
            }
        }
        // Check for remaining unresolved placeholders and warn
        const unresolvedPlaceholders = result.match(/\{\{[^}]+\}\}|\$\{[^}]+\}/g);
        if (unresolvedPlaceholders) {
            console.warn('Unresolved placeholders found:', unresolvedPlaceholders);
        }
        return result;
    }
    /**
     * Escape special regex characters
     */
    static escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    /**
     * Basic validation of generated HTML
     */
    static validateGeneratedHtml(html) {
        // Check for basic HTML structure
        if (!html || html.trim() === '') {
            return { isValid: false, error: 'Generated HTML is empty' };
        }
        // Check for remaining unresolved placeholders
        const unresolvedPlaceholders = html.match(/\{\{[^}]+\}\}/g);
        if (unresolvedPlaceholders && unresolvedPlaceholders.length > 0) {
            return {
                isValid: false,
                error: `Unresolved placeholders: ${unresolvedPlaceholders.join(', ')}`
            };
        }
        // Check for BabiaXR components
        if (!html.includes('babia-') && !html.includes('a-entity')) {
            return {
                isValid: false,
                error: 'Generated HTML does not contain BabiaXR components'
            };
        }
        return { isValid: true };
    }
    /**
     * Get available placeholders for a chart
     */
    static getAvailablePlaceholders(chart) {
        const placeholders = [
            'TITLE',
            'DATA_SOURCE',
            'CHART_ID'
        ];
        // Add dimension-based placeholders
        for (const dimension of chart.dimensions) {
            const upperDimension = dimension.name.toUpperCase();
            placeholders.push(`${upperDimension}_FIELD`);
        }
        return placeholders;
    }
    /**
     * Preview template with sample data for testing
     */
    static async previewTemplate(chart, sampleMappings) {
        const defaultMappings = sampleMappings || chart.dimensions.map(dim => ({
            dimension: dim.name,
            dataField: `sample_${dim.name}`
        }));
        const defaultConfig = {
            chartType: chart.id,
            title: `Sample ${chart.name}`,
            dataFilePath: 'sample-data.json',
            dimensionMappings: defaultMappings
        };
        const result = await this.processTemplate(chart, defaultMappings, defaultConfig);
        return result.success ? (result.html || '') : `<!-- Error: ${result.error || 'Unknown error'} -->`;
    }
}
exports.TemplateProcessor = TemplateProcessor;


/***/ }),
/* 47 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DimensionValidator = void 0;
/**
 * BabiaXR Dimension Validator
 * Validates dimension mappings against chart requirements
 */
class DimensionValidator {
    /**
     * Validate dimension mappings for a given chart
     */
    static validateMappings(chart, mappings) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };
        // Check for required dimensions
        const requiredDimensions = chart.dimensions.filter(d => d.required);
        const mappedDimensions = new Set(mappings.map(m => m.dimension));
        for (const requiredDim of requiredDimensions) {
            if (!mappedDimensions.has(requiredDim.name)) {
                result.errors.push(`Required dimension '${requiredDim.name}' (${requiredDim.label}) is not mapped`);
                result.isValid = false;
            }
        }
        // Check for invalid dimension names
        const validDimensionNames = new Set(chart.dimensions.map(d => d.name));
        for (const mapping of mappings) {
            if (!validDimensionNames.has(mapping.dimension)) {
                result.errors.push(`Unknown dimension '${mapping.dimension}' for chart type '${chart.name}'`);
                result.isValid = false;
            }
        }
        // Check for duplicate mappings
        const dimensionCounts = new Map();
        for (const mapping of mappings) {
            const count = dimensionCounts.get(mapping.dimension) || 0;
            dimensionCounts.set(mapping.dimension, count + 1);
        }
        for (const [dimension, count] of dimensionCounts) {
            if (count > 1) {
                result.errors.push(`Dimension '${dimension}' is mapped multiple times`);
                result.isValid = false;
            }
        }
        // Check for empty data fields
        for (const mapping of mappings) {
            if (!mapping.dataField || mapping.dataField.trim() === '') {
                result.errors.push(`Dimension '${mapping.dimension}' has no data field specified`);
                result.isValid = false;
            }
        }
        // Add warnings for optional dimensions that are not mapped
        const optionalDimensions = chart.dimensions.filter(d => !d.required);
        for (const optionalDim of optionalDimensions) {
            if (!mappedDimensions.has(optionalDim.name)) {
                result.warnings.push(`Optional dimension '${optionalDim.name}' (${optionalDim.label}) is not mapped`);
            }
        }
        return result;
    }
    /**
     * Validate a specific data field against dimension requirements
     */
    static validateDataField(dimensionName, dataField, chart) {
        const dimension = chart.dimensions.find(d => d.name === dimensionName);
        if (!dimension) {
            return {
                isValid: false,
                error: `Dimension '${dimensionName}' does not exist for chart type '${chart.name}'`
            };
        }
        if (!dataField || dataField.trim() === '') {
            return {
                isValid: false,
                error: `Data field for dimension '${dimensionName}' cannot be empty`
            };
        }
        // Additional validation can be added here for data type checking
        // when we have access to actual data structure
        return { isValid: true };
    }
    /**
     * Get missing required dimensions
     */
    static getMissingRequiredDimensions(chart, mappings) {
        const requiredDimensions = chart.dimensions.filter(d => d.required);
        const mappedDimensions = new Set(mappings.map(m => m.dimension));
        return requiredDimensions
            .filter(d => !mappedDimensions.has(d.name))
            .map(d => d.name);
    }
    /**
     * Check if all required dimensions are mapped
     */
    static areAllRequiredDimensionsMapped(chart, mappings) {
        return this.getMissingRequiredDimensions(chart, mappings).length === 0;
    }
}
exports.DimensionValidator = DimensionValidator;


/***/ }),
/* 48 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


/**
 * Visualization Settings Module
 * Main entry point for visualization configuration management
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getAllSelectedSettings = exports.getSelectedPalette = exports.getSelectedEnvironment = exports.getSelectedGroundColor = exports.getSelectedBackgroundColor = exports.initializeSettingsAccessors = exports.VisualizationSettingsInteractionHandler = exports.VisualizationSettingsTreeItem = exports.VisualizationSettingsItemFactory = exports.VisualizationSettingsStorage = exports.DEFAULT_VISUALIZATION_SETTINGS = void 0;
var settingsModel_1 = __webpack_require__(49);
Object.defineProperty(exports, "DEFAULT_VISUALIZATION_SETTINGS", ({ enumerable: true, get: function () { return settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS; } }));
var settingsStorage_1 = __webpack_require__(50);
Object.defineProperty(exports, "VisualizationSettingsStorage", ({ enumerable: true, get: function () { return settingsStorage_1.VisualizationSettingsStorage; } }));
var visualizationSettingsItems_1 = __webpack_require__(51);
Object.defineProperty(exports, "VisualizationSettingsItemFactory", ({ enumerable: true, get: function () { return visualizationSettingsItems_1.VisualizationSettingsItemFactory; } }));
Object.defineProperty(exports, "VisualizationSettingsTreeItem", ({ enumerable: true, get: function () { return visualizationSettingsItems_1.VisualizationSettingsTreeItem; } }));
var handleSettingsInteraction_1 = __webpack_require__(53);
Object.defineProperty(exports, "VisualizationSettingsInteractionHandler", ({ enumerable: true, get: function () { return handleSettingsInteraction_1.VisualizationSettingsInteractionHandler; } }));
// Export settings accessors for babia-templates integration
var settingsAccessors_1 = __webpack_require__(55);
Object.defineProperty(exports, "initializeSettingsAccessors", ({ enumerable: true, get: function () { return settingsAccessors_1.initializeSettingsAccessors; } }));
Object.defineProperty(exports, "getSelectedBackgroundColor", ({ enumerable: true, get: function () { return settingsAccessors_1.getSelectedBackgroundColor; } }));
Object.defineProperty(exports, "getSelectedGroundColor", ({ enumerable: true, get: function () { return settingsAccessors_1.getSelectedGroundColor; } }));
Object.defineProperty(exports, "getSelectedEnvironment", ({ enumerable: true, get: function () { return settingsAccessors_1.getSelectedEnvironment; } }));
Object.defineProperty(exports, "getSelectedPalette", ({ enumerable: true, get: function () { return settingsAccessors_1.getSelectedPalette; } }));
Object.defineProperty(exports, "getAllSelectedSettings", ({ enumerable: true, get: function () { return settingsAccessors_1.getAllSelectedSettings; } }));


/***/ }),
/* 49 */
/***/ ((__unused_webpack_module, exports) => {


/**
 * Visualization Settings Model
 * Defines the structure and interfaces for visualization configuration
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SETTING_FIELDS = exports.HEX_COLOR_REGEX = exports.CHART_PALETTES = exports.ENVIRONMENT_PRESETS = exports.PREDEFINED_COLORS = exports.DEFAULT_VISUALIZATION_SETTINGS = void 0;
exports.isValidHexColor = isValidHexColor;
/**
 * Default visualization settings
 */
exports.DEFAULT_VISUALIZATION_SETTINGS = {
    backgroundColor: '#FFFFFF',
    groundColor: '#000000',
    environmentPreset: 'default',
    chartPalette: 'ubuntu'
};
/**
 * Predefined color options for quick selection
 */
exports.PREDEFINED_COLORS = [
    { label: '#FFFFFF (white)', value: '#FFFFFF' },
    { label: '#000000 (black)', value: '#000000' },
    { label: '#B10DC9 (pink)', value: '#B10DC9' }
];
/**
 * Available environment preset options with descriptions
 */
exports.ENVIRONMENT_PRESETS = [
    { label: 'none', value: 'none', description: 'No environment, just a sky' },
    { label: 'default', value: 'default', description: 'Default environment with hills and sky' },
    { label: 'forest', value: 'forest', description: 'A forest with trees and directional light' },
    { label: 'egypt', value: 'egypt', description: 'Egyptian landscape with sand and pyramids' },
    { label: 'dream', value: 'dream', description: 'Surreal dreamlike environment' },
    { label: 'volcano', value: 'volcano', description: 'Volcanic terrain with lava and smoke' },
    { label: 'arches', value: 'arches', description: 'Desert with rock arches' },
    { label: 'tron', value: 'tron', description: 'Futuristic Tron-like environment' },
    { label: 'japan', value: 'japan', description: 'Stylized Japanese landscape' },
    { label: 'threetowers', value: 'threetowers', description: 'Fantasy environment with three towers' },
    { label: 'poison', value: 'poison', description: 'Toxic environment with green fog' },
    { label: 'contact', value: 'contact', description: 'Sci-fi environment with landing pad' }
];
/**
 * Available chart palette options with descriptions
 */
exports.CHART_PALETTES = [
    { label: 'ubuntu', value: 'ubuntu', description: 'Ubuntu style colors (default)' },
    { label: 'blues', value: 'blues', description: 'Variations of blue colors' },
    { label: 'bussiness', value: 'bussiness', description: 'Professional business colors' },
    { label: 'commerce', value: 'commerce', description: 'E-commerce friendly palette' },
    { label: 'flat', value: 'flat', description: 'Flat design color scheme' },
    { label: 'foxy', value: 'foxy', description: 'FireFox palette with oranges and blues' },
    { label: 'icecream', value: 'icecream', description: 'Sweet pastel colors' },
    { label: 'pearl', value: 'pearl', description: 'Pearlescent subtle colors' },
    { label: 'sunset', value: 'sunset', description: 'Warm sunset color gradients' }
];
/**
 * Validation for hex color format
 */
exports.HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
/**
 * Validate hex color format
 */
function isValidHexColor(color) {
    return exports.HEX_COLOR_REGEX.test(color);
}
/**
 * Configuration for all setting fields
 */
exports.SETTING_FIELDS = [
    {
        key: 'backgroundColor',
        label: 'Background Color',
        type: 'color',
        description: 'Set the background color for the visualization scene',
        icon: 'color-mode'
    },
    {
        key: 'groundColor',
        label: 'Ground Color',
        type: 'color',
        description: 'Set the ground color for the visualization scene',
        icon: 'symbol-color'
    },
    {
        key: 'environmentPreset',
        label: 'Environment Preset',
        type: 'preset',
        description: 'Choose an environment preset for the scene',
        icon: 'globe'
    },
    {
        key: 'chartPalette',
        label: 'Chart Palette',
        type: 'palette',
        description: 'Select color palette for chart visualization',
        icon: 'symbol-misc'
    }
];


/***/ }),
/* 50 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VisualizationSettingsStorage = void 0;
const fs = __importStar(__webpack_require__(6));
const path = __importStar(__webpack_require__(5));
const settingsModel_1 = __webpack_require__(49);
/**
 * Visualization Settings Storage
 * Manages persistent storage and retrieval of visualization configuration using file system
 */
class VisualizationSettingsStorage {
    static VISUALIZATION_CONFIG_DIR = 'visualization-configuration';
    static SETTINGS_FILE = 'visualization-settings.json';
    static LEGACY_STORAGE_KEY = 'visualizationSettings'; // For migration
    context;
    constructor(context) {
        this.context = context;
        console.log('VISUALIZATION-SETTINGS: Storage manager initialized with file-based storage');
    }
    /**
     * Get the visualization configuration directory path
     */
    getConfigDirectory() {
        const globalStorageUri = this.context.globalStorageUri;
        return path.join(globalStorageUri.fsPath, VisualizationSettingsStorage.VISUALIZATION_CONFIG_DIR);
    }
    /**
     * Get the settings file path
     */
    getSettingsFilePath() {
        return path.join(this.getConfigDirectory(), VisualizationSettingsStorage.SETTINGS_FILE);
    }
    /**
     * Ensure the configuration directory exists
     */
    ensureConfigDirectory() {
        const configDir = this.getConfigDirectory();
        try {
            if (!fs.existsSync(configDir)) {
                console.log(`VISUALIZATION-SETTINGS: Creating configuration directory: ${configDir}`);
                fs.mkdirSync(configDir, { recursive: true });
            }
        }
        catch (error) {
            console.error('VISUALIZATION-SETTINGS: Error creating configuration directory:', error);
            throw new Error(`Failed to create configuration directory: ${error}`);
        }
    }
    /**
     * Migrate legacy settings from globalState to file system
     */
    migrateLegacySettings() {
        try {
            const legacySettings = this.context.globalState.get(VisualizationSettingsStorage.LEGACY_STORAGE_KEY);
            if (legacySettings && !fs.existsSync(this.getSettingsFilePath())) {
                console.log('VISUALIZATION-SETTINGS: Migrating legacy settings to file system');
                const settingsFilePath = this.getSettingsFilePath();
                const jsonSettings = {
                    backgroundColor: legacySettings.backgroundColor,
                    groundColor: legacySettings.groundColor,
                    environment: legacySettings.environmentPreset,
                    palette: legacySettings.chartPalette
                };
                fs.writeFileSync(settingsFilePath, JSON.stringify(jsonSettings, null, 2), 'utf8');
                console.log('VISUALIZATION-SETTINGS: Legacy settings migration completed with all settings');
            }
        }
        catch (error) {
            console.error('VISUALIZATION-SETTINGS: Error during legacy migration:', error);
            // Don't throw - migration failure shouldn't prevent normal operation
        }
    }
    /**
     * Get current visualization settings from file system
     */
    getSettings() {
        try {
            // Ensure directory exists and migrate legacy settings if needed
            this.ensureConfigDirectory();
            this.migrateLegacySettings();
            const settingsFilePath = this.getSettingsFilePath();
            if (fs.existsSync(settingsFilePath)) {
                const fileContent = fs.readFileSync(settingsFilePath, 'utf8');
                const jsonSettings = JSON.parse(fileContent);
                // Build complete settings from JSON with fallbacks to defaults
                const settings = {
                    backgroundColor: jsonSettings.backgroundColor || settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS.backgroundColor,
                    groundColor: jsonSettings.groundColor || settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS.groundColor,
                    environmentPreset: jsonSettings.environment,
                    chartPalette: jsonSettings.palette
                };
                console.log('VISUALIZATION-SETTINGS: Loaded settings from file', settings);
                return settings;
            }
        }
        catch (error) {
            console.error('VISUALIZATION-SETTINGS: Failed to load settings from file:', error);
        }
        console.log('VISUALIZATION-SETTINGS: Using default settings');
        return { ...settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS };
    }
    /**
     * Save visualization settings to file system
     */
    async saveSettings(settings) {
        try {
            this.ensureConfigDirectory();
            const settingsFilePath = this.getSettingsFilePath();
            // Create settings object for JSON file (all four settings)
            const jsonSettings = {
                backgroundColor: settings.backgroundColor,
                groundColor: settings.groundColor,
                environment: settings.environmentPreset,
                palette: settings.chartPalette
            };
            // Save to JSON file
            fs.writeFileSync(settingsFilePath, JSON.stringify(jsonSettings, null, 2), 'utf8');
            // Also save complete settings to globalState for backward compatibility
            await this.context.globalState.update(VisualizationSettingsStorage.LEGACY_STORAGE_KEY, settings);
            console.log('VISUALIZATION-SETTINGS: Settings saved to file and globalState', settings);
        }
        catch (error) {
            console.error('VISUALIZATION-SETTINGS: Failed to save settings:', error);
            throw new Error(`Failed to save visualization settings: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Update a single setting field
     */
    async updateSetting(key, value) {
        const currentSettings = this.getSettings();
        const updatedSettings = {
            ...currentSettings,
            [key]: value
        };
        await this.saveSettings(updatedSettings);
        console.log(`VISUALIZATION-SETTINGS: Updated ${key} to '${value}'`);
    }
    /**
     * Reset settings to defaults
     */
    async resetSettings() {
        await this.saveSettings({ ...settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS });
        console.log('VISUALIZATION-SETTINGS: Settings reset to defaults');
    }
    /**
     * Check if settings exist in storage
     */
    hasStoredSettings() {
        const settingsFilePath = this.getSettingsFilePath();
        return fs.existsSync(settingsFilePath);
    }
    /**
     * Get formatted settings for display
     */
    getFormattedSettings() {
        const settings = this.getSettings();
        return {
            backgroundColor: settings.backgroundColor,
            groundColor: settings.groundColor,
            environmentPreset: settings.environmentPreset,
            chartPalette: settings.chartPalette
        };
    }
    /**
     * Validate settings structure
     */
    validateSettings(settings) {
        return (typeof settings === 'object' &&
            typeof settings.backgroundColor === 'string' &&
            typeof settings.groundColor === 'string' &&
            typeof settings.environmentPreset === 'string' &&
            typeof settings.chartPalette === 'string');
    }
}
exports.VisualizationSettingsStorage = VisualizationSettingsStorage;


/***/ }),
/* 51 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VisualizationSettingsIcons = exports.VisualizationSettingsItemFactory = exports.VisualizationSettingsTreeItem = void 0;
const vscode = __importStar(__webpack_require__(1));
const settingsModel_1 = __webpack_require__(49);
const dynamicColorIconGenerator_1 = __webpack_require__(52);
/**
 * Tree item for visualization settings
 */
class VisualizationSettingsTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    type;
    settingField;
    currentValue;
    command;
    iconPath;
    tooltip;
    description;
    contextValue;
    constructor(label, collapsibleState, type, settingField, currentValue, command, iconPath, tooltip, description, contextValue) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.type = type;
        this.settingField = settingField;
        this.currentValue = currentValue;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip;
        this.description = description;
        this.contextValue = contextValue;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.VisualizationSettingsTreeItem = VisualizationSettingsTreeItem;
/**
 * Factory for creating visualization settings items
 */
class VisualizationSettingsItemFactory {
    /**
     * Create all visualization settings items with dynamic color icons
     */
    static async createVisualizationSettingsItems(settings, context) {
        console.log('VISUALIZATION-SETTINGS: Creating settings items with dynamic color icons...');
        const items = await Promise.all(settingsModel_1.SETTING_FIELDS.map(field => this.createSettingItem(field, settings, context)));
        console.log(`VISUALIZATION-SETTINGS: Created ${items.length} setting items`);
        return items;
    }
    /**
     * Create individual setting tree item with dynamic color icon support
     */
    static async createSettingItem(field, settings, context) {
        const currentValue = settings[field.key];
        // Format the display value (remove Unicode block for color fields since we have icons now)
        let displayValue = String(currentValue);
        let iconPath;
        if (field.type === 'color') {
            console.log(`COLOR-PICKER: Processing color field ${field.key} with value ${currentValue}`);
            try {
                // Generate dynamic color icon
                const normalizedColor = dynamicColorIconGenerator_1.DynamicColorIconGenerator.normalizeHexColor(currentValue);
                const colorIconUri = await dynamicColorIconGenerator_1.DynamicColorIconGenerator.getOrCreateColorIcon(context, field.key, normalizedColor);
                // Clean up old icons for this setting
                dynamicColorIconGenerator_1.DynamicColorIconGenerator.cleanupOldColorIcons(context, field.key, normalizedColor);
                iconPath = colorIconUri;
                console.log(`COLOR-PICKER: Successfully created color icon for ${field.key}`);
            }
            catch (error) {
                console.error(`COLOR-PICKER: Error creating color icon for ${field.key}:`, error);
                // Fallback to theme icon
                iconPath = new vscode.ThemeIcon(field.icon);
            }
        }
        else {
            // Use regular theme icon for non-color fields
            iconPath = new vscode.ThemeIcon(field.icon);
        }
        const item = new VisualizationSettingsTreeItem(field.label, vscode.TreeItemCollapsibleState.None, 'settings-field', field, displayValue, {
            command: 'codeXR.visualizationSettings.configure',
            title: `Configure ${field.label}`,
            arguments: [field.key]
        }, iconPath, `${field.description}\nCurrent value: ${currentValue}`, displayValue, 'visualization-settings-field');
        return item;
    }
    /**
     * Create setting item with updated value
     */
    static async createUpdatedSettingItem(field, newValue, context) {
        const dummySettings = { [field.key]: newValue };
        return await this.createSettingItem(field, dummySettings, context);
    }
}
exports.VisualizationSettingsItemFactory = VisualizationSettingsItemFactory;
/**
 * Icons for visualization settings items
 */
class VisualizationSettingsIcons {
    static backgroundColor = new vscode.ThemeIcon('color-mode');
    static groundColor = new vscode.ThemeIcon('symbol-color');
    static environmentPreset = new vscode.ThemeIcon('globe');
    static chartPalette = new vscode.ThemeIcon('symbol-misc');
    static section = new vscode.ThemeIcon('settings-gear');
}
exports.VisualizationSettingsIcons = VisualizationSettingsIcons;


/***/ }),
/* 52 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DynamicColorIconGenerator = void 0;
const vscode = __importStar(__webpack_require__(1));
const fs = __importStar(__webpack_require__(6));
const path = __importStar(__webpack_require__(5));
/**
 * Dynamic SVG Color Icon Generator
 * Generates and manages SVG icons for color visualization in tree items
 */
class DynamicColorIconGenerator {
    static VISUALIZATION_CONFIG_DIR = 'visualization-configuration';
    static ICON_SIZE = 16; // 16x16 pixels for VS Code tree items
    /**
     * Generate a square SVG icon for a given hex color
     */
    static generateColorSVG(hexColor) {
        // Ensure the color is properly formatted
        const cleanColor = hexColor.startsWith('#') ? hexColor : `#${hexColor}`;
        console.log(`COLOR-PICKER: Generating SVG for color ${cleanColor}`);
        return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${this.ICON_SIZE}" height="${this.ICON_SIZE}" viewBox="0 0 ${this.ICON_SIZE} ${this.ICON_SIZE}" xmlns="http://www.w3.org/2000/svg">
    <!-- Background square with subtle border -->
    <rect x="1" y="1" width="14" height="14" 
          fill="${cleanColor}" 
          stroke="rgba(255,255,255,0.3)" 
          stroke-width="0.5" 
          rx="2" ry="2"/>
    <!-- Subtle inner shadow effect -->
    <rect x="1.5" y="1.5" width="13" height="13" 
          fill="none" 
          stroke="rgba(0,0,0,0.15)" 
          stroke-width="0.5" 
          rx="1.5" ry="1.5"/>
</svg>`;
    }
    /**
     * Get the global storage directory for color icons
     */
    static getColorIconsDirectory(context) {
        const globalStorageUri = context.globalStorageUri;
        const colorIconsPath = path.join(globalStorageUri.fsPath, this.VISUALIZATION_CONFIG_DIR);
        console.log(`COLOR-PICKER: Visualization configuration directory: ${colorIconsPath}`);
        return colorIconsPath;
    }
    /**
     * Ensure the color icons directory exists
     */
    static ensureColorIconsDirectory(context) {
        const configPath = this.getColorIconsDirectory(context);
        try {
            if (!fs.existsSync(configPath)) {
                console.log(`COLOR-PICKER: Creating visualization configuration directory: ${configPath}`);
                fs.mkdirSync(configPath, { recursive: true });
            }
        }
        catch (error) {
            console.error(`COLOR-PICKER: Error creating visualization configuration directory:`, error);
            throw new Error(`Failed to create visualization configuration directory: ${error}`);
        }
    }
    /**
     * Generate filename for a color icon
     */
    static getColorIconFilename(settingKey, hexColor) {
        // Remove # from hex color and make it safe for filename
        const cleanColor = hexColor.replace('#', '').toLowerCase();
        return `${settingKey}_${cleanColor}.svg`;
    }
    /**
     * Generate and save a color icon, return the file URI
     */
    static async generateColorIcon(context, settingKey, hexColor) {
        console.log(`COLOR-PICKER: Generating color icon for ${settingKey} with color ${hexColor}`);
        try {
            // Ensure directory exists
            this.ensureColorIconsDirectory(context);
            // Generate SVG content
            const svgContent = this.generateColorSVG(hexColor);
            // Create filename and full path
            const filename = this.getColorIconFilename(settingKey, hexColor);
            const configPath = this.getColorIconsDirectory(context);
            const iconPath = path.join(configPath, filename);
            // Write SVG file
            fs.writeFileSync(iconPath, svgContent, 'utf8');
            console.log(`COLOR-PICKER: Color icon saved to: ${iconPath}`);
            // Return VS Code URI
            const iconUri = vscode.Uri.file(iconPath);
            console.log(`COLOR-PICKER: Color icon URI: ${iconUri.toString()}`);
            return iconUri;
        }
        catch (error) {
            console.error(`COLOR-PICKER: Error generating color icon for ${settingKey}:`, error);
            throw new Error(`Failed to generate color icon: ${error}`);
        }
    }
    /**
     * Get existing color icon URI if it exists, otherwise generate new one
     */
    static async getOrCreateColorIcon(context, settingKey, hexColor) {
        console.log(`COLOR-PICKER: Getting or creating color icon for ${settingKey} with color ${hexColor}`);
        try {
            const configPath = this.getColorIconsDirectory(context);
            const filename = this.getColorIconFilename(settingKey, hexColor);
            const iconPath = path.join(configPath, filename);
            if (fs.existsSync(iconPath)) {
                console.log(`COLOR-PICKER: Using existing color icon: ${iconPath}`);
                return vscode.Uri.file(iconPath);
            }
            else {
                console.log(`COLOR-PICKER: Creating new color icon for ${settingKey}`);
                return await this.generateColorIcon(context, settingKey, hexColor);
            }
        }
        catch (error) {
            console.error(`COLOR-PICKER: Error getting/creating color icon:`, error);
            throw error;
        }
    }
    /**
     * Clean up old color icons for a specific setting
     */
    static cleanupOldColorIcons(context, settingKey, currentHexColor) {
        console.log(`COLOR-PICKER: Cleaning up old color icons for ${settingKey}`);
        try {
            const configPath = this.getColorIconsDirectory(context);
            if (!fs.existsSync(configPath)) {
                return;
            }
            // Read directory and find old icons for this setting
            const files = fs.readdirSync(configPath);
            const currentFilename = this.getColorIconFilename(settingKey, currentHexColor);
            let cleanedCount = 0;
            files.forEach(file => {
                if (file.startsWith(`${settingKey}_`) && file.endsWith('.svg') && file !== currentFilename) {
                    const oldIconPath = path.join(configPath, file);
                    try {
                        fs.unlinkSync(oldIconPath);
                        cleanedCount++;
                        console.log(`COLOR-PICKER: Removed old color icon: ${file}`);
                    }
                    catch (error) {
                        console.warn(`COLOR-PICKER: Failed to remove old icon ${file}:`, error);
                    }
                }
            });
            if (cleanedCount > 0) {
                console.log(`COLOR-PICKER: Cleaned up ${cleanedCount} old color icons for ${settingKey}`);
            }
        }
        catch (error) {
            console.error(`COLOR-PICKER: Error during cleanup for ${settingKey}:`, error);
            // Don't throw - cleanup is non-critical
        }
    }
    /**
     * Validate hex color format
     */
    static isValidHexColor(color) {
        const hexPattern = /^#[0-9A-Fa-f]{6}$/;
        return hexPattern.test(color);
    }
    /**
     * Normalize hex color to uppercase with # prefix
     */
    static normalizeHexColor(color) {
        if (!color) {
            return '#FFFFFF';
        }
        let normalized = color.trim().toUpperCase();
        if (!normalized.startsWith('#')) {
            normalized = `#${normalized}`;
        }
        return this.isValidHexColor(normalized) ? normalized : '#FFFFFF';
    }
}
exports.DynamicColorIconGenerator = DynamicColorIconGenerator;


/***/ }),
/* 53 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VisualizationSettingsInteractionHandler = void 0;
const vscode = __importStar(__webpack_require__(1));
const settingsModel_1 = __webpack_require__(49);
const settingsStorage_1 = __webpack_require__(50);
const colorPickerUtils_1 = __webpack_require__(54);
const dynamicColorIconGenerator_1 = __webpack_require__(52);
/**
 * Handle Visualization Settings Interactions
 * Manages user interactions with visualization settings items
 */
class VisualizationSettingsInteractionHandler {
    context;
    storage;
    constructor(context) {
        this.context = context;
        console.log('VISUALIZATION-SETTINGS: Interaction handler initialized');
        this.storage = new settingsStorage_1.VisualizationSettingsStorage(context);
    }
    /**
     * Handle configuration of a specific setting field
     */
    async handleSettingConfiguration(settingKey) {
        console.log(`VISUALIZATION-SETTINGS: Configuring setting '${settingKey}'`);
        try {
            switch (settingKey) {
                case 'backgroundColor':
                case 'groundColor':
                    await this.handleColorConfiguration(settingKey);
                    break;
                case 'environmentPreset':
                    await this.handleEnvironmentPresetConfiguration();
                    break;
                case 'chartPalette':
                    await this.handleChartPaletteConfiguration();
                    break;
                default:
                    throw new Error(`Unknown setting key: ${settingKey}`);
            }
        }
        catch (error) {
            console.error(`VISUALIZATION-SETTINGS: Error configuring ${settingKey}:`, error);
            vscode.window.showErrorMessage(`Failed to configure ${settingKey}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Handle color configuration (background or ground color) using HTML-based color picker
     */
    async handleColorConfiguration(colorType) {
        console.log(`VISUALIZATION-SETTINGS: Configuring ${colorType} with HTML color picker`);
        const currentSettings = this.storage.getSettings();
        const currentValue = currentSettings[colorType];
        try {
            // Prepare color picker options
            const fieldName = colorType === 'backgroundColor' ? 'Background Color' : 'Ground Color';
            const options = {
                fieldName,
                currentColor: colorPickerUtils_1.ColorPickerUtils.normalizeColor(currentValue)
            };
            // Create webview panel
            const panel = colorPickerUtils_1.ColorPickerUtils.createColorPickerWebview(this.context, options);
            // Load and set HTML content
            const htmlContent = await colorPickerUtils_1.ColorPickerUtils.loadColorPickerTemplate(this.context, options);
            panel.webview.html = htmlContent;
            // Handle messages from the webview
            const messageDisposable = panel.webview.onDidReceiveMessage(async (message) => {
                switch (message.type) {
                    case 'colorPicker.confirm':
                        const newColor = colorPickerUtils_1.ColorPickerUtils.normalizeColor(message.color);
                        console.log(`VISUALIZATION-SETTINGS: Color confirmed for ${colorType}: ${newColor}`);
                        console.log(`COLOR-PICKER: Generating new icon for ${colorType} with color ${newColor}`);
                        try {
                            // Generate new color icon
                            const iconUri = await dynamicColorIconGenerator_1.DynamicColorIconGenerator.getOrCreateColorIcon(this.context, colorType, newColor);
                            console.log(`COLOR-PICKER: Successfully generated icon for ${colorType}: ${iconUri.toString()}`);
                            // Clean up old icons
                            dynamicColorIconGenerator_1.DynamicColorIconGenerator.cleanupOldColorIcons(this.context, colorType, newColor);
                        }
                        catch (iconError) {
                            console.error(`COLOR-PICKER: Error generating icon for ${colorType}:`, iconError);
                            // Continue with setting update even if icon generation fails
                        }
                        // Update the setting
                        await this.storage.updateSetting(colorType, newColor);
                        // Refresh the tree view to show new icon
                        vscode.commands.executeCommand('codexr.servers.refresh');
                        vscode.window.showInformationMessage(`${fieldName} set to: ${newColor}`);
                        // Close the panel
                        panel.dispose();
                        break;
                    case 'colorPicker.cancel':
                        console.log(`VISUALIZATION-SETTINGS: Color picker cancelled for ${colorType}`);
                        panel.dispose();
                        break;
                }
            });
            // Clean up when panel is disposed
            panel.onDidDispose(() => {
                messageDisposable.dispose();
                console.log(`VISUALIZATION-SETTINGS: Color picker panel disposed for ${colorType}`);
            });
        }
        catch (error) {
            console.error(`VISUALIZATION-SETTINGS: Error opening color picker for ${colorType}:`, error);
            vscode.window.showErrorMessage(`Failed to open color picker: ${error}`);
            // Fallback to the original QuickPick method
            await this.handleColorConfigurationFallback(colorType);
        }
    }
    /**
     * Fallback color configuration using QuickPick (in case HTML color picker fails)
     */
    async handleColorConfigurationFallback(colorType) {
        console.log(`VISUALIZATION-SETTINGS: Using fallback QuickPick for ${colorType}`);
        const currentSettings = this.storage.getSettings();
        const currentValue = currentSettings[colorType];
        // Create QuickPick options
        const colorOptions = [
            ...settingsModel_1.PREDEFINED_COLORS.map(color => ({
                label: color.label,
                value: color.value,
                picked: color.value === currentValue
            })),
            {
                label: 'Pick a custom color...',
                value: 'custom',
                picked: false
            }
        ];
        const selectedOption = await vscode.window.showQuickPick(colorOptions, {
            placeHolder: `Select ${colorType.replace(/([A-Z])/g, ' $1').toLowerCase()}`,
            title: `Configure ${colorType.replace(/([A-Z])/g, ' $1')}`,
            matchOnDescription: true
        });
        if (!selectedOption) {
            console.log(`VISUALIZATION-SETTINGS: ${colorType} configuration cancelled`);
            return;
        }
        let newColor;
        if (selectedOption.value === 'custom') {
            const customColor = await this.getCustomColorInput(colorType, currentValue);
            if (!customColor) {
                return; // User cancelled custom color input
            }
            newColor = customColor;
        }
        else {
            newColor = selectedOption.value;
        }
        // Generate color icon before updating setting
        try {
            console.log(`COLOR-PICKER: Generating fallback icon for ${colorType} with color ${newColor}`);
            const iconUri = await dynamicColorIconGenerator_1.DynamicColorIconGenerator.getOrCreateColorIcon(this.context, colorType, newColor);
            console.log(`COLOR-PICKER: Successfully generated fallback icon for ${colorType}: ${iconUri.toString()}`);
            // Clean up old icons
            dynamicColorIconGenerator_1.DynamicColorIconGenerator.cleanupOldColorIcons(this.context, colorType, newColor);
        }
        catch (iconError) {
            console.error(`COLOR-PICKER: Error generating fallback icon for ${colorType}:`, iconError);
            // Continue with setting update even if icon generation fails
        }
        // Update the setting
        await this.storage.updateSetting(colorType, newColor);
        // Refresh the tree view
        vscode.commands.executeCommand('codexr.servers.refresh');
        console.log(`VISUALIZATION-SETTINGS: ${colorType} updated to '${newColor}'`);
        vscode.window.showInformationMessage(`${colorType.replace(/([A-Z])/g, ' $1')} set to: ${newColor}`);
    }
    /**
     * Get custom color input from user
     */
    async getCustomColorInput(colorType, currentValue) {
        let attempts = 0;
        const maxAttempts = 3;
        while (attempts < maxAttempts) {
            const customColor = await vscode.window.showInputBox({
                prompt: `Enter hex color for ${colorType.replace(/([A-Z])/g, ' $1').toLowerCase()} (e.g., #FF5733)`,
                value: currentValue,
                validateInput: (value) => {
                    if (!value) {
                        return 'Color value is required';
                    }
                    if (!(0, settingsModel_1.isValidHexColor)(value)) {
                        return 'Invalid hex color format. Use format: #RRGGBB (e.g., #FF5733)';
                    }
                    return null;
                }
            });
            if (customColor === undefined) {
                console.log(`VISUALIZATION-SETTINGS: Custom ${colorType} input cancelled`);
                return undefined;
            }
            if ((0, settingsModel_1.isValidHexColor)(customColor)) {
                console.log(`VISUALIZATION-SETTINGS: Valid custom ${colorType} entered: ${customColor}`);
                return customColor;
            }
            attempts++;
            console.log(`VISUALIZATION-SETTINGS: Invalid ${colorType} format attempt ${attempts}/${maxAttempts}: ${customColor}`);
            if (attempts < maxAttempts) {
                const retry = await vscode.window.showErrorMessage(`Invalid hex color format: ${customColor}. Please use format #RRGGBB (e.g., #FF5733)`, 'Try Again', 'Cancel');
                if (retry !== 'Try Again') {
                    console.log(`VISUALIZATION-SETTINGS: Custom ${colorType} input cancelled after ${attempts} attempts`);
                    return undefined;
                }
            }
            else {
                vscode.window.showErrorMessage(`Failed to set ${colorType} after ${maxAttempts} attempts. Please try again later.`);
                console.log(`VISUALIZATION-SETTINGS: Custom ${colorType} input failed after ${maxAttempts} attempts`);
                return undefined;
            }
        }
        return undefined;
    }
    /**
     * Handle environment preset configuration
     */
    async handleEnvironmentPresetConfiguration() {
        console.log('VISUALIZATION-SETTINGS: Configuring environment preset');
        const currentSettings = this.storage.getSettings();
        const currentValue = currentSettings.environmentPreset;
        const presetOptions = settingsModel_1.ENVIRONMENT_PRESETS.map(preset => ({
            label: preset.label,
            description: preset.description,
            value: preset.value,
            picked: preset.value === currentValue
        }));
        const selectedPreset = await vscode.window.showQuickPick(presetOptions, {
            placeHolder: 'Select environment preset',
            title: 'Configure Environment Preset',
            matchOnDescription: true
        });
        if (!selectedPreset) {
            console.log('VISUALIZATION-SETTINGS: Environment preset configuration cancelled');
            return;
        }
        // Update the setting
        await this.storage.updateSetting('environmentPreset', selectedPreset.value);
        // Refresh the tree view
        vscode.commands.executeCommand('codexr.servers.refresh');
        console.log(`VISUALIZATION-SETTINGS: Environment preset updated to '${selectedPreset.value}'`);
        vscode.window.showInformationMessage(`Environment preset set to: ${selectedPreset.label} - ${selectedPreset.description}`);
    }
    /**
     * Handle chart palette configuration
     */
    async handleChartPaletteConfiguration() {
        console.log('VISUALIZATION-SETTINGS: Configuring chart palette');
        const currentSettings = this.storage.getSettings();
        const currentValue = currentSettings.chartPalette;
        const paletteOptions = settingsModel_1.CHART_PALETTES.map(palette => ({
            label: palette.label,
            description: palette.description,
            value: palette.value,
            picked: palette.value === currentValue
        }));
        const selectedPalette = await vscode.window.showQuickPick(paletteOptions, {
            placeHolder: 'Select chart palette',
            title: 'Configure Chart Palette',
            matchOnDescription: true
        });
        if (!selectedPalette) {
            console.log('VISUALIZATION-SETTINGS: Chart palette configuration cancelled');
            return;
        }
        // Update the setting
        await this.storage.updateSetting('chartPalette', selectedPalette.value);
        // Refresh the tree view
        vscode.commands.executeCommand('codexr.servers.refresh');
        console.log(`VISUALIZATION-SETTINGS: Chart palette updated to '${selectedPalette.value}'`);
        vscode.window.showInformationMessage(`Chart palette set to: ${selectedPalette.label} - ${selectedPalette.description}`);
    }
    /**
     * Get current storage instance for external access
     */
    getStorage() {
        return this.storage;
    }
    /**
     * Cleanup resources
     */
    dispose() {
        console.log('VISUALIZATION-SETTINGS: Interaction handler disposed');
    }
}
exports.VisualizationSettingsInteractionHandler = VisualizationSettingsInteractionHandler;


/***/ }),
/* 54 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ColorPickerUtils = void 0;
const vscode = __importStar(__webpack_require__(1));
const fs = __importStar(__webpack_require__(6));
const path = __importStar(__webpack_require__(5));
class ColorPickerUtils {
    static TEMPLATE_PATH = 'templates/utils/color-picker.html';
    /**
     * Load and process the color picker HTML template
     */
    static async loadColorPickerTemplate(context, options) {
        try {
            const templatePath = path.join(context.extensionPath, this.TEMPLATE_PATH);
            let templateContent = fs.readFileSync(templatePath, 'utf8');
            // Replace placeholders
            templateContent = templateContent
                .replace(/\$\{FIELD_NAME\}/g, options.fieldName)
                .replace(/\$\{CURRENT_COLOR\}/g, options.currentColor);
            return templateContent;
        }
        catch (error) {
            console.error('[VISUALIZATION-SETTINGS] Error loading color picker template:', error);
            throw new Error(`Failed to load color picker template: ${error}`);
        }
    }
    /**
     * Create and configure a webview for the color picker
     */
    static createColorPickerWebview(context, options) {
        const panel = vscode.window.createWebviewPanel('colorPicker', `Color Picker - ${options.fieldName}`, vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(context.extensionPath, 'templates'))
            ]
        });
        // Set the icon for the panel
        panel.iconPath = {
            light: vscode.Uri.file(path.join(context.extensionPath, 'resources', 'icon.svg')),
            dark: vscode.Uri.file(path.join(context.extensionPath, 'resources', 'icon.svg'))
        };
        return panel;
    }
    /**
     * Validate hex color format
     */
    static validateHexColor(color) {
        return /^#[0-9a-fA-F]{6}$/.test(color);
    }
    /**
     * Normalize color to uppercase hex format
     */
    static normalizeColor(color) {
        if (this.validateHexColor(color)) {
            return color.toUpperCase();
        }
        return '#FFFFFF'; // Default fallback
    }
    /**
     * Get predefined colors for fallback
     */
    static getPredefinedColors() {
        return [
            '#FFFFFF', // White
            '#000000', // Black
            '#B10DC9', // Purple
            '#FF4081', // Pink
            '#F44336', // Red
            '#FF9800', // Orange
            '#FFEB3B', // Yellow
            '#4CAF50', // Green
            '#2196F3', // Blue
            '#9C27B0', // Violet
            '#607D8B', // Blue Grey
            '#795548' // Brown
        ];
    }
}
exports.ColorPickerUtils = ColorPickerUtils;


/***/ }),
/* 55 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.initializeSettingsAccessors = initializeSettingsAccessors;
exports.getSelectedBackgroundColor = getSelectedBackgroundColor;
exports.getSelectedGroundColor = getSelectedGroundColor;
exports.getSelectedEnvironment = getSelectedEnvironment;
exports.getSelectedPalette = getSelectedPalette;
exports.getAllSelectedSettings = getAllSelectedSettings;
const fs = __importStar(__webpack_require__(6));
const path = __importStar(__webpack_require__(5));
const settingsModel_1 = __webpack_require__(49);
/**
 * Settings Accessors
 * Clean utility functions to access visualization settings for babia-templates integration
 */
// Module-level cache for context
let extensionContext = null;
/**
 * Initialize the settings accessors with extension context
 * Must be called during extension activation
 */
function initializeSettingsAccessors(context) {
    extensionContext = context;
    console.log('VISUALIZATION-SETTINGS: Settings accessors initialized');
}
/**
 * Get the visualization configuration directory path
 */
function getConfigDirectory() {
    if (!extensionContext) {
        throw new Error('Settings accessors not initialized. Call initializeSettingsAccessors() first.');
    }
    const globalStorageUri = extensionContext.globalStorageUri;
    return path.join(globalStorageUri.fsPath, 'visualization-configuration');
}
/**
 * Get the settings file path
 */
function getSettingsFilePath() {
    return path.join(getConfigDirectory(), 'visualization-settings.json');
}
/**
 * Read settings from the JSON file
 */
function readSettingsFromFile() {
    try {
        const settingsFilePath = getSettingsFilePath();
        if (fs.existsSync(settingsFilePath)) {
            const fileContent = fs.readFileSync(settingsFilePath, 'utf8');
            const jsonSettings = JSON.parse(fileContent);
            console.log('VISUALIZATION-SETTINGS: Read settings from file:', jsonSettings);
            return jsonSettings;
        }
    }
    catch (error) {
        console.error('VISUALIZATION-SETTINGS: Error reading settings file:', error);
    }
    return null;
}
/**
 * Get current background color from file storage or globalState fallback
 */
async function getBackgroundColorFromStorage() {
    try {
        // First try to read from JSON file
        const fileSettings = readSettingsFromFile();
        if (fileSettings && fileSettings.backgroundColor) {
            return fileSettings.backgroundColor;
        }
        // Fallback to globalState for backward compatibility
        if (extensionContext) {
            const legacySettings = extensionContext.globalState.get('visualizationSettings');
            if (legacySettings && legacySettings.backgroundColor) {
                return legacySettings.backgroundColor;
            }
        }
    }
    catch (error) {
        console.error('VISUALIZATION-SETTINGS: Error reading background color from storage:', error);
    }
    return settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS.backgroundColor;
}
/**
 * Get current ground color from file storage or globalState fallback
 */
async function getGroundColorFromStorage() {
    try {
        // First try to read from JSON file
        const fileSettings = readSettingsFromFile();
        if (fileSettings && fileSettings.groundColor) {
            return fileSettings.groundColor;
        }
        // Fallback to globalState for backward compatibility
        if (extensionContext) {
            const legacySettings = extensionContext.globalState.get('visualizationSettings');
            if (legacySettings && legacySettings.groundColor) {
                return legacySettings.groundColor;
            }
        }
    }
    catch (error) {
        console.error('VISUALIZATION-SETTINGS: Error reading ground color from storage:', error);
    }
    return settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS.groundColor;
}
/**
 * Get the currently selected background color
 * @returns Promise<string> Hex color value (e.g., "#B10DC9")
 */
async function getSelectedBackgroundColor() {
    console.log('VISUALIZATION-SETTINGS: Getting selected background color');
    const color = await getBackgroundColorFromStorage();
    console.log(`VISUALIZATION-SETTINGS: Background color: ${color}`);
    return color;
}
/**
 * Get the currently selected ground color
 * @returns Promise<string> Hex color value (e.g., "#FFFFFF")
 */
async function getSelectedGroundColor() {
    console.log('VISUALIZATION-SETTINGS: Getting selected ground color');
    const color = await getGroundColorFromStorage();
    console.log(`VISUALIZATION-SETTINGS: Ground color: ${color}`);
    return color;
}
/**
 * Get the currently selected environment preset
 * @returns Promise<string> Environment preset name (e.g., "forest")
 */
async function getSelectedEnvironment() {
    console.log('VISUALIZATION-SETTINGS: Getting selected environment');
    const settings = readSettingsFromFile();
    const environment = settings?.environment || settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS.environmentPreset;
    console.log(`VISUALIZATION-SETTINGS: Environment: ${environment}`);
    return environment;
}
/**
 * Get the currently selected chart palette
 * @returns Promise<string> Chart palette name (e.g., "ubuntu")
 */
async function getSelectedPalette() {
    console.log('VISUALIZATION-SETTINGS: Getting selected chart palette');
    const settings = readSettingsFromFile();
    const palette = settings?.palette || settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS.chartPalette;
    console.log(`VISUALIZATION-SETTINGS: Palette: ${palette}`);
    return palette;
}
/**
 * Get all current settings in a single call (for efficiency)
 * @returns Promise<object> Object containing all current settings
 */
async function getAllSelectedSettings() {
    console.log('VISUALIZATION-SETTINGS: Getting all selected settings');
    const [backgroundColor, groundColor] = await Promise.all([
        getSelectedBackgroundColor(),
        getSelectedGroundColor()
    ]);
    const settings = readSettingsFromFile();
    const environment = settings?.environment || settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS.environmentPreset;
    const palette = settings?.palette || settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS.chartPalette;
    const allSettings = {
        backgroundColor,
        groundColor,
        environment,
        palette
    };
    console.log('VISUALIZATION-SETTINGS: All settings:', allSettings);
    return allSettings;
}


/***/ }),
/* 56 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


/**
 * Server Runtime Module
 *
 * This module provides the complete server runtime infrastructure for the CodeXR extension.
 * It includes HTTP/HTTPS servers, port management, and a unified launcher system.
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MultiServerLauncher = exports.PortManager = exports.HttpsCustomServer = exports.HttpsDefaultServer = exports.HttpServer = void 0;
exports.createServerLauncher = createServerLauncher;
exports.launchServerWithFile = launchServerWithFile;
exports.isPortAvailable = isPortAvailable;
exports.findAvailablePort = findAvailablePort;
exports.getSuggestedPorts = getSuggestedPorts;
// Core server implementations
var httpServer_1 = __webpack_require__(27);
Object.defineProperty(exports, "HttpServer", ({ enumerable: true, get: function () { return httpServer_1.HttpServer; } }));
var httpsDefaultServer_1 = __webpack_require__(30);
Object.defineProperty(exports, "HttpsDefaultServer", ({ enumerable: true, get: function () { return httpsDefaultServer_1.HttpsDefaultServer; } }));
var httpsCustomServer_1 = __webpack_require__(32);
Object.defineProperty(exports, "HttpsCustomServer", ({ enumerable: true, get: function () { return httpsCustomServer_1.HttpsCustomServer; } }));
// Utility classes
var portManager_1 = __webpack_require__(15);
Object.defineProperty(exports, "PortManager", ({ enumerable: true, get: function () { return portManager_1.PortManager; } }));
// Main launcher and types
var multiServerLauncher_1 = __webpack_require__(14);
Object.defineProperty(exports, "MultiServerLauncher", ({ enumerable: true, get: function () { return multiServerLauncher_1.MultiServerLauncher; } }));
// Import for use in utility functions
const multiServerLauncher_2 = __webpack_require__(14);
const portManager_2 = __webpack_require__(15);
/**
 * Create a new multi-server launcher instance
 * @param context - VS Code extension context
 * @returns MultiServerLauncher instance
 */
function createServerLauncher(context) {
    return new multiServerLauncher_2.MultiServerLauncher(context);
}
/**
 * Launch server with a specific HTML file
 * @param context - VS Code extension context
 * @param htmlFilePath - Path to HTML file to serve
 * @param customName - Optional custom display name for the server
 * @returns Promise<MultiServerLaunchResult>
 */
async function launchServerWithFile(context, htmlFilePath, customName) {
    const launcher = new multiServerLauncher_2.MultiServerLauncher(context);
    return launcher.launchServer(htmlFilePath, customName);
}
/**
 * Utility function to check if a port is available
 * @param port - Port number to check
 * @returns Promise<boolean> - True if port is available
 */
async function isPortAvailable(port) {
    return portManager_2.PortManager.isPortAvailable(port);
}
/**
 * Utility function to find an available port
 * @param startPort - Port to start searching from
 * @param endPort - Maximum port to check (optional)
 * @returns Promise<number> - First available port found
 */
async function findAvailablePort(startPort, endPort) {
    return portManager_2.PortManager.findAvailablePort(startPort, endPort);
}
/**
 * Get suggested ports for a service type
 * @param serviceType - Type of service ('http', 'https', 'dev')
 * @returns number[] - Array of suggested ports
 */
function getSuggestedPorts(serviceType) {
    return portManager_2.PortManager.getSuggestedPorts(serviceType);
}


/***/ }),
/* 57 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VisualizationRestorer = void 0;
const vscode = __importStar(__webpack_require__(1));
const fs = __importStar(__webpack_require__(6));
const path = __importStar(__webpack_require__(5));
const index_1 = __webpack_require__(56);
const activeServerRegistry_1 = __webpack_require__(17);
/**
 * Visualization Restorer
 * Responsible for scanning and relaunching stored visualizations
 */
class VisualizationRestorer {
    context;
    visualizeDataPath;
    constructor(context) {
        this.context = context;
        this.visualizeDataPath = path.join(context.globalStorageUri.fsPath, 'visualize-data');
        console.log('BROWSE-VISUALIZATIONS: Restorer initialized with path:', this.visualizeDataPath);
    }
    /**
     * Scan the visualize-data directory for stored visualizations
     */
    async scanStoredVisualizations() {
        console.log('BROWSE-VISUALIZATIONS: Scanning for stored visualizations...');
        const visualizations = [];
        try {
            // Ensure the visualize-data directory exists
            if (!fs.existsSync(this.visualizeDataPath)) {
                console.log('BROWSE-VISUALIZATIONS: visualize-data directory does not exist yet');
                return visualizations;
            }
            // Read directory contents
            const entries = await fs.promises.readdir(this.visualizeDataPath, { withFileTypes: true });
            const folders = entries.filter(entry => entry.isDirectory());
            console.log(`BROWSE-VISUALIZATIONS: Found ${folders.length} folders in visualize-data directory`);
            for (const folder of folders) {
                const folderName = folder.name;
                const folderPath = path.join(this.visualizeDataPath, folderName);
                // Extract name from folder name (everything before the last underscore)
                const lastUnderscoreIndex = folderName.lastIndexOf('_');
                const name = lastUnderscoreIndex > 0 ? folderName.substring(0, lastUnderscoreIndex) : folderName;
                // Check for required files
                const indexPath = path.join(folderPath, 'index.html');
                const dataPath = path.join(folderPath, 'data.json');
                const indexExists = fs.existsSync(indexPath);
                const dataExists = fs.existsSync(dataPath);
                const isValid = indexExists && dataExists;
                const visualization = {
                    name,
                    folderName,
                    folderPath,
                    indexPath,
                    dataPath,
                    isValid
                };
                visualizations.push(visualization);
                console.log(`BROWSE-VISUALIZATIONS: Found visualization "${name}" (${folderName}), valid: ${isValid}`);
                if (!isValid) {
                    console.warn(`BROWSE-VISUALIZATIONS: Invalid visualization - index.html exists: ${indexExists}, data.json exists: ${dataExists}`);
                }
            }
        }
        catch (error) {
            console.error('BROWSE-VISUALIZATIONS: Error scanning visualizations:', error);
            vscode.window.showErrorMessage(`Failed to scan visualizations: ${error instanceof Error ? error.message : String(error)}`);
        }
        console.log(`BROWSE-VISUALIZATIONS: Scan completed, found ${visualizations.length} visualizations`);
        return visualizations;
    }
    /**
     * Launch a stored visualization
     */
    async launchVisualization(visualization) {
        console.log(`BROWSE-VISUALIZATIONS: Launching visualization "${visualization.name}"`);
        try {
            if (!visualization.isValid) {
                throw new Error(`Visualization "${visualization.name}" is missing required files`);
            }
            // Check if visualization is already running
            const activeRegistry = (0, activeServerRegistry_1.getActiveServerRegistry)();
            const activeServers = activeRegistry.getAllServers();
            // Check by custom name or by path
            const alreadyActive = activeServers.some((server) => server.customName === visualization.name ||
                server.filePath === visualization.indexPath);
            if (alreadyActive) {
                console.log(`BROWSE-VISUALIZATIONS: Visualization "${visualization.name}" is already active`);
                vscode.window.showInformationMessage(`Visualization "${visualization.name}" is already running`);
                return;
            }
            // Launch the visualization using the existing server launcher
            console.log(`BROWSE-VISUALIZATIONS: Launching server for visualization "${visualization.name}" with file: ${visualization.indexPath}`);
            await (0, index_1.launchServerWithFile)(this.context, visualization.indexPath, visualization.name // Use the extracted name as customName
            );
            console.log(`BROWSE-VISUALIZATIONS: Successfully launched visualization "${visualization.name}"`);
            vscode.window.showInformationMessage(`Launched visualization: ${visualization.name}`);
        }
        catch (error) {
            console.error(`BROWSE-VISUALIZATIONS: Error launching visualization "${visualization.name}":`, error);
            vscode.window.showErrorMessage(`Failed to launch visualization "${visualization.name}": ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Delete all stored visualizations (Reset All)
     */
    async resetAllVisualizations() {
        console.log('BROWSE-VISUALIZATIONS: Resetting all visualizations...');
        try {
            if (!fs.existsSync(this.visualizeDataPath)) {
                console.log('BROWSE-VISUALIZATIONS: No visualize-data directory to reset');
                return;
            }
            // Get list of folders to delete
            const entries = await fs.promises.readdir(this.visualizeDataPath, { withFileTypes: true });
            const folders = entries.filter(entry => entry.isDirectory());
            if (folders.length === 0) {
                console.log('BROWSE-VISUALIZATIONS: No visualizations to reset');
                vscode.window.showInformationMessage('No stored visualizations to reset');
                return;
            }
            // Confirm deletion
            const confirmResult = await vscode.window.showWarningMessage(`Delete all ${folders.length} stored visualizations? This action cannot be undone.`, { modal: true }, 'Delete All', 'Cancel');
            if (confirmResult !== 'Delete All') {
                console.log('BROWSE-VISUALIZATIONS: Reset cancelled by user');
                return;
            }
            // Delete each folder
            for (const folder of folders) {
                const folderPath = path.join(this.visualizeDataPath, folder.name);
                console.log(`BROWSE-VISUALIZATIONS: Deleting folder: ${folderPath}`);
                try {
                    await fs.promises.rm(folderPath, { recursive: true, force: true });
                }
                catch (deleteError) {
                    console.error(`BROWSE-VISUALIZATIONS: Error deleting folder ${folderPath}:`, deleteError);
                }
            }
            console.log(`BROWSE-VISUALIZATIONS: Reset completed, deleted ${folders.length} visualizations`);
            vscode.window.showInformationMessage(`Deleted ${folders.length} stored visualizations`);
            // Trigger refresh of the tree view
            vscode.commands.executeCommand('codexr.servers.refresh');
        }
        catch (error) {
            console.error('BROWSE-VISUALIZATIONS: Error during reset:', error);
            vscode.window.showErrorMessage(`Failed to reset visualizations: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Get the visualize-data directory path
     */
    getVisualizeDataPath() {
        return this.visualizeDataPath;
    }
}
exports.VisualizationRestorer = VisualizationRestorer;


/***/ }),
/* 58 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.registerCodeAnalysisCommands = registerCodeAnalysisCommands;
const analysisCommands_1 = __webpack_require__(59);
/**
 * Register Code Analysis Commands
 * Entry point for registering all code analysis related commands
 */
function registerCodeAnalysisCommands(context) {
    console.log('[CODE_ANALYSIS] Registering code analysis commands...');
    analysisCommands_1.CodeAnalysisCommands.registerCommands(context);
    console.log('[CODE_ANALYSIS] Code analysis commands registration complete');
}


/***/ }),
/* 59 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CodeAnalysisCommands = void 0;
exports.executeFileAnalysis = executeFileAnalysis;
exports.runXRFileAnalysisCoordinator = runXRFileAnalysisCoordinator;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(5));
const child_process_1 = __webpack_require__(60);
const handleAnalysisClicks_1 = __webpack_require__(61);
const analysisSettingsStorage_1 = __webpack_require__(62);
const pythonEnvStorage_1 = __webpack_require__(63);
const pythonEnvUtils_1 = __webpack_require__(64);
const tempStorageManager_1 = __webpack_require__(66);
const activeAnalysisRegistry_1 = __webpack_require__(69);
const activeAnalysisModel_1 = __webpack_require__(70);
const chartRegistry_1 = __webpack_require__(42);
const xrTemplateRenderer_1 = __webpack_require__(68);
/**
 * Code Analysis Commands
 * Handles all command registrations for the code analysis functionality
 */
class CodeAnalysisCommands {
    /**
     * Register all code analysis commands
     */
    static registerCommands(context) {
        console.log('[CODE_ANALYSIS] Registering code analysis commands...');
        // Main section commands
        const showActiveAnalysesCommand = vscode.commands.registerCommand('codeXR.codeAnalysis.showActiveAnalyses', () => {
            console.log('[CODE_ANALYSIS] Command: showActiveAnalyses executed');
            handleAnalysisClicks_1.CodeAnalysisInteractionHandler.handleSectionClick('active-analyses', context);
        });
        const showAnalysisSettingsCommand = vscode.commands.registerCommand('codeXR.codeAnalysis.showAnalysisSettings', () => {
            console.log('[CODE_ANALYSIS] Command: showAnalysisSettings executed');
            handleAnalysisClicks_1.CodeAnalysisInteractionHandler.handleSectionClick('analysis-settings', context);
        });
        const showFilesByLanguageCommand = vscode.commands.registerCommand('codeXR.codeAnalysis.showFilesByLanguage', () => {
            console.log('[CODE_ANALYSIS] Command: showFilesByLanguage executed');
            handleAnalysisClicks_1.CodeAnalysisInteractionHandler.handleSectionClick('files-by-language', context);
        });
        // Placeholder commands
        const placeholderActiveAnalysesCommand = vscode.commands.registerCommand('codeXR.codeAnalysis.placeholder.activeAnalyses', () => {
            console.log('[CODE_ANALYSIS] Command: placeholder.activeAnalyses executed');
            handleAnalysisClicks_1.CodeAnalysisInteractionHandler.handlePlaceholderClick('activeAnalyses');
        });
        const placeholderAnalysisSettingsCommand = vscode.commands.registerCommand('codeXR.codeAnalysis.placeholder.analysisSettings', () => {
            console.log('[CODE_ANALYSIS] Command: placeholder.analysisSettings executed');
            handleAnalysisClicks_1.CodeAnalysisInteractionHandler.handlePlaceholderClick('analysisSettings');
        });
        const placeholderFilesByLanguageCommand = vscode.commands.registerCommand('codeXR.codeAnalysis.placeholder.filesByLanguage', () => {
            console.log('[CODE_ANALYSIS] Command: placeholder.filesByLanguage executed');
            handleAnalysisClicks_1.CodeAnalysisInteractionHandler.handlePlaceholderClick('filesByLanguage');
        });
        // Analysis mode toggle command
        const toggleAnalysisModeCommand = vscode.commands.registerCommand('codexr.analysis.toggleMode', async () => {
            console.log('[CODE_ANALYSIS] Command: toggleMode executed');
            try {
                const newMode = await analysisSettingsStorage_1.AnalysisSettingsStorage.toggleAnalysisMode(context);
                vscode.window.showInformationMessage(`Analysis mode switched to: ${newMode}`);
                // Refresh the tree view to show the updated mode
                vscode.commands.executeCommand('codexr.servers.refresh');
            }
            catch (error) {
                console.error('[CODE_ANALYSIS] Error toggling analysis mode:', error);
                vscode.window.showErrorMessage('Failed to toggle analysis mode');
            }
        });
        // File analysis commands
        const analyzeFileStaticCommand = vscode.commands.registerCommand('codexr.analysis.fileStatic', async (uri) => {
            console.log('[CODE_ANALYSIS] Command: analyzeFileStatic executed');
            let analysisId;
            try {
                const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
                if (!targetUri) {
                    vscode.window.showErrorMessage('No file selected for analysis');
                    return;
                }
                // Check if file is saved (for unsaved files, suggest saving first)
                if (targetUri.scheme !== 'file') {
                    vscode.window.showWarningMessage('Please save the file before analyzing it.');
                    return;
                }
                console.log(`ANALYSIS_FILE_STATS: Starting static analysis for ${targetUri.fsPath}`);
                // Check if file type is supported
                const supportedExtensions = [
                    '.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp',
                    '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.kts', '.scala', '.sc', '.dart',
                    '.vue', '.html', '.css', '.scss', '.less',
                    // Additional languages for comprehensive analysis
                    '.sol', '.m', '.mm', '.zig', '.ttcn', '.ttcn3', '.erl', '.hrl', '.lua', '.pl', '.pm',
                    '.pod', '.t', '.f90', '.f95', '.f03', '.f08', '.gd'
                ];
                const fileExtension = path.extname(targetUri.fsPath).toLowerCase();
                if (!supportedExtensions.includes(fileExtension)) {
                    vscode.window.showWarningMessage(`File type ${fileExtension} is not currently supported for analysis.`);
                    return;
                }
                vscode.window.showInformationMessage(`Analyzing ${path.basename(targetUri.fsPath)} in Static mode...`);
                // Ensure we have a proper file system path
                let actualFilePath = targetUri.fsPath;
                // Fix URI path if it contains the file:// protocol prefix or similar issues
                if (actualFilePath.startsWith('/file:')) {
                    actualFilePath = actualFilePath.replace('/file:', '');
                    // Remove any leading extra slashes
                    while (actualFilePath.startsWith('//')) {
                        actualFilePath = actualFilePath.substring(1);
                    }
                }
                console.log(`ANALYSIS_FILE_STATS: Corrected file path: ${actualFilePath}`);
                // 🔥 REGISTER ANALYSIS IN ACTIVE ANALYSES
                console.log('[CODE_ANALYSIS] 📋 Registering file analysis in Active Analyses...');
                const registry = activeAnalysisRegistry_1.ActiveAnalysisRegistry.getInstance();
                {
                    const analysisTemplate = activeAnalysisModel_1.ActiveAnalysisFactory.createFileAnalysis(actualFilePath, 'Static', path.extname(actualFilePath).toLowerCase().substring(1) || 'unknown');
                    // Convert to ActiveAnalysisData by removing the id
                    const { id, ...registrationData } = analysisTemplate;
                    analysisId = registry.registerAnalysis(registrationData);
                    console.log(`[CODE_ANALYSIS] ✅ Registered analysis with ID: ${analysisId}`);
                }
                // Run the Python analysis coordinator
                const analysisData = await executeFileAnalysis(context, actualFilePath);
                if (analysisData) {
                    console.log(`ANALYSIS_FILE_STATS: Generated data.json for ${path.basename(targetUri.fsPath)}`, analysisData);
                    // Get current analysis mode to determine how to handle the result
                    const currentMode = await analysisSettingsStorage_1.AnalysisSettingsStorage.getCurrentAnalysisMode(context);
                    if (currentMode === 'Static') {
                        // For Static mode: Create viewer assets and launch server
                        try {
                            console.log(`ANALYSIS_FILE_STATS: Preparing static analysis viewer for ${path.basename(targetUri.fsPath)}`);
                            await (0, tempStorageManager_1.prepareStaticAnalysisViewerAssets)(context, targetUri.fsPath, analysisData);
                            console.log(`ANALYSIS_FILE_STATS: Static analysis viewer launched successfully`);
                        }
                        catch (viewerError) {
                            console.error(`ANALYSIS_FILE_STATS: Failed to prepare static analysis viewer: ${viewerError}`);
                            vscode.window.showErrorMessage(`Failed to launch static analysis viewer: ${viewerError}`);
                            // Fallback: Still store the data for manual access
                            try {
                                const storageUri = await (0, tempStorageManager_1.storeAnalysisJson)(context, targetUri.fsPath, analysisData);
                                console.log(`ANALYSIS_FILE_STATS: Analysis data stored at ${storageUri.fsPath} (fallback)`);
                            }
                            catch (storageError) {
                                console.error(`ANALYSIS_FILE_STATS: Fallback storage also failed: ${storageError}`);
                            }
                        }
                    }
                    else {
                        // For XR mode or other modes: Just store the data
                        try {
                            const storageUri = await (0, tempStorageManager_1.storeAnalysisJson)(context, targetUri.fsPath, analysisData);
                            console.log(`ANALYSIS_FILE_STATS: Analysis data stored at ${storageUri.fsPath}`);
                        }
                        catch (storageError) {
                            console.error(`ANALYSIS_FILE_STATS: Failed to store analysis data: ${storageError}`);
                            // Continue with the rest of the process even if storage fails
                        }
                    }
                    const stats = analysisData;
                    const functionCount = stats.functionCount || 0;
                    const classCount = stats.classCount || 0;
                    const complexity = stats.complexity?.averageComplexity || 0;
                    const commentRatio = Math.round((stats.commentRatio || 0) * 100);
                    const modeMessage = currentMode === 'Static' ? ' (viewer launched)' : '';
                    vscode.window.showInformationMessage(`Analysis completed: ${functionCount} functions, ${classCount} classes, ` +
                        `${commentRatio}% comments, avg complexity ${complexity.toFixed(1)}${modeMessage}`);
                    // 🔥 UPDATE ANALYSIS STATUS TO COMPLETED
                    console.log(`[CODE_ANALYSIS] 🎉 Updating analysis ${analysisId} status to completed`);
                    registry.updateAnalysis(analysisId, 'completed', 100, undefined, {
                        totalLines: stats.totalLines,
                        totalFunctions: functionCount,
                        complexity: complexity
                    });
                }
                else {
                    console.error('ANALYSIS_FILE_STATS: Failed to generate analysis data');
                    vscode.window.showErrorMessage('Analysis failed - no data generated');
                    // 🔥 UPDATE ANALYSIS STATUS TO FAILED
                    console.log(`[CODE_ANALYSIS] ❌ Updating analysis ${analysisId} status to failed`);
                    registry.updateAnalysis(analysisId, 'failed', 0, 'Failed to generate analysis data');
                }
            }
            catch (error) {
                console.error('[CODE_ANALYSIS] Error analyzing file (Static):', error);
                vscode.window.showErrorMessage('Failed to analyze file in Static mode');
                // 🔥 UPDATE ANALYSIS STATUS TO FAILED (if analysisId exists)
                try {
                    if (typeof analysisId !== 'undefined') {
                        console.log(`[CODE_ANALYSIS] ❌ Updating analysis ${analysisId} status to failed due to exception`);
                        const registry = activeAnalysisRegistry_1.ActiveAnalysisRegistry.getInstance();
                        registry.updateAnalysis(analysisId, 'failed', 0, `Analysis failed: ${error}`);
                    }
                }
                catch (registryError) {
                    console.error('[CODE_ANALYSIS] Failed to update analysis status in catch block:', registryError);
                }
            }
        });
        const analyzeFileXRCommand = vscode.commands.registerCommand('codexr.analysis.fileXR', async (uri) => {
            console.log('[CODE_ANALYSIS] Command: analyzeFileXR executed');
            let analysisId;
            try {
                const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
                if (!targetUri) {
                    vscode.window.showErrorMessage('No file selected for analysis');
                    return;
                }
                // Check if file type is supported (same check as static analysis)
                const supportedExtensions = [
                    '.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp',
                    '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.kts', '.scala', '.sc', '.dart',
                    '.vue', '.html', '.css', '.scss', '.less',
                    // Additional languages for comprehensive analysis
                    '.sol', '.m', '.mm', '.zig', '.ttcn', '.ttcn3', '.erl', '.hrl', '.lua', '.pl', '.pm',
                    '.pod', '.t', '.f90', '.f95', '.f03', '.f08', '.gd'
                ];
                const fileExtension = path.extname(targetUri.fsPath).toLowerCase();
                if (!supportedExtensions.includes(fileExtension)) {
                    vscode.window.showWarningMessage(`File type ${fileExtension} is not currently supported for XR analysis.`);
                    return;
                }
                // Ensure we have a proper file system path
                let actualFilePath = targetUri.fsPath;
                // Fix URI path if it contains the file:// protocol prefix or similar issues
                if (actualFilePath.startsWith('/file:')) {
                    actualFilePath = actualFilePath.replace('/file:', '');
                    // Remove any leading extra slashes
                    while (actualFilePath.startsWith('//')) {
                        actualFilePath = actualFilePath.substring(1);
                    }
                }
                console.log(`[CODE_ANALYSIS] Corrected XR file path: ${actualFilePath}`);
                console.log(`[CODE_ANALYSIS] Analyzing file in XR mode: ${actualFilePath}`);
                vscode.window.showInformationMessage(`Analyzing ${path.basename(actualFilePath)} in XR mode...`);
                // 🔥 REGISTER ANALYSIS IN ACTIVE ANALYSES
                console.log('[CODE_ANALYSIS] 📋 Registering XR file analysis in Active Analyses...');
                const registry = activeAnalysisRegistry_1.ActiveAnalysisRegistry.getInstance();
                {
                    const analysisTemplate = activeAnalysisModel_1.ActiveAnalysisFactory.createFileAnalysis(actualFilePath, 'XR', path.extname(actualFilePath).toLowerCase().substring(1) || 'unknown');
                    // Convert to ActiveAnalysisData by removing the id
                    const { id, ...registrationData } = analysisTemplate;
                    analysisId = registry.registerAnalysis(registrationData);
                    console.log(`[CODE_ANALYSIS] ✅ Registered XR analysis with ID: ${analysisId}`);
                }
                // Run the XR Python analysis coordinator
                const analysisData = await runXRFileAnalysisCoordinator(context, actualFilePath);
                if (analysisData) {
                    console.log(`[CODE_ANALYSIS] Generated XR analysis data.json for ${path.basename(actualFilePath)}`, analysisData);
                    // Store the analysis data using the same temp storage as static analysis
                    try {
                        const tempFolder = await (0, tempStorageManager_1.storeAnalysisJson)(context, actualFilePath, analysisData);
                        console.log(`[CODE_ANALYSIS] XR analysis data stored at: ${tempFolder.fsPath}`);
                        // Generate XR visualization index.html
                        try {
                            console.log(`[CODE_ANALYSIS] Generating XR visualization HTML for ${path.basename(actualFilePath)}`);
                            await xrTemplateRenderer_1.XRTemplateRenderer.generateXRVisualization(context, tempFolder, actualFilePath, analysisData);
                            console.log(`[CODE_ANALYSIS] ✅ XR visualization HTML generated successfully`);
                            // Launch XR server with the generated assets
                            try {
                                console.log(`[CODE_ANALYSIS] Launching XR viewer server for ${path.basename(actualFilePath)}`);
                                await (0, tempStorageManager_1.prepareXRAnalysisViewerAssets)(context, tempFolder, actualFilePath);
                                console.log(`[CODE_ANALYSIS] ✅ XR viewer server launched successfully`);
                            }
                            catch (serverError) {
                                console.error(`[CODE_ANALYSIS] ⚠️ Failed to launch XR viewer server: ${serverError}`);
                                vscode.window.showWarningMessage(`XR analysis completed but failed to launch viewer: ${serverError}`);
                            }
                        }
                        catch (htmlError) {
                            console.error(`[CODE_ANALYSIS] ⚠️ Failed to generate XR visualization HTML: ${htmlError}`);
                            // Don't fail the entire analysis, just warn
                            vscode.window.showWarningMessage(`XR analysis completed but failed to generate visualization: ${htmlError}`);
                        }
                        // Update analysis status to completed
                        registry.updateAnalysis(analysisId, 'completed', 100, undefined, {
                            totalLines: analysisData.totalLines || 0,
                            totalFunctions: analysisData.functionCount || 0,
                            complexity: analysisData.complexity?.averageComplexity || 0
                        });
                        vscode.window.showInformationMessage(`XR analysis completed for ${path.basename(actualFilePath)}`);
                    }
                    catch (storageError) {
                        console.error(`[CODE_ANALYSIS] Failed to store XR analysis data: ${storageError}`);
                        vscode.window.showErrorMessage(`Failed to store XR analysis data: ${storageError}`);
                        registry.updateAnalysis(analysisId, 'failed', 0, `Storage failed: ${storageError}`);
                    }
                }
                else {
                    console.error(`[CODE_ANALYSIS] XR analysis returned no data for ${actualFilePath}`);
                    vscode.window.showErrorMessage(`XR analysis failed for ${path.basename(actualFilePath)}`);
                    registry.updateAnalysis(analysisId, 'failed', 0, 'Analysis returned no data');
                }
            }
            catch (error) {
                console.error('[CODE_ANALYSIS] Error analyzing file (XR):', error);
                vscode.window.showErrorMessage('Failed to analyze file in XR mode');
                // 🔥 UPDATE ANALYSIS STATUS TO FAILED (if analysisId exists)
                try {
                    if (typeof analysisId !== 'undefined') {
                        console.log(`[CODE_ANALYSIS] ❌ Updating XR analysis ${analysisId} status to failed due to exception`);
                        const registry = activeAnalysisRegistry_1.ActiveAnalysisRegistry.getInstance();
                        registry.updateAnalysis(analysisId, 'failed', 0, `XR Analysis failed: ${error}`);
                    }
                }
                catch (registryError) {
                    console.error('[CODE_ANALYSIS] Failed to update XR analysis status in catch block:', registryError);
                }
            }
        });
        // Refresh command
        const refreshCommand = vscode.commands.registerCommand('codeXR.codeAnalysis.refresh', () => {
            console.log('[CODE_ANALYSIS] Command: refresh executed');
            vscode.commands.executeCommand('codexr.servers.refresh');
        });
        // File click command
        const fileClickedCommand = vscode.commands.registerCommand('codeXR.codeAnalysis.fileClicked', (filePath) => {
            console.log('[CODE_ANALYSIS] Command: fileClicked executed');
            handleAnalysisClicks_1.CodeAnalysisInteractionHandler.handleFileClick(filePath, context);
        });
        // Theme toggle command
        const toggleThemeCommand = vscode.commands.registerCommand('codexr.analysis.toggleTheme', async () => {
            console.log('[CODE_ANALYSIS] Command: toggleTheme executed');
            try {
                const newTheme = await analysisSettingsStorage_1.AnalysisSettingsStorage.toggleTheme(context);
                vscode.window.showInformationMessage(`Analysis viewer theme switched to: ${newTheme}`);
                // Refresh the tree view to show the updated theme
                vscode.commands.executeCommand('codexr.servers.refresh');
            }
            catch (error) {
                console.error('[CODE_ANALYSIS] Error toggling theme:', error);
                vscode.window.showErrorMessage('Failed to toggle analysis viewer theme');
            }
        });
        // Set theme commands
        const setLightThemeCommand = vscode.commands.registerCommand('codexr.analysis.setLightTheme', async () => {
            console.log('[CODE_ANALYSIS] Command: setLightTheme executed');
            try {
                await analysisSettingsStorage_1.AnalysisSettingsStorage.setTheme(context, 'light');
                vscode.window.showInformationMessage('Analysis viewer theme set to light');
                // Refresh the tree view to show the updated theme
                vscode.commands.executeCommand('codexr.servers.refresh');
            }
            catch (error) {
                console.error('[CODE_ANALYSIS] Error setting light theme:', error);
                vscode.window.showErrorMessage('Failed to set light theme');
            }
        });
        const setDarkThemeCommand = vscode.commands.registerCommand('codexr.analysis.setDarkTheme', async () => {
            console.log('[CODE_ANALYSIS] Command: setDarkTheme executed');
            try {
                await analysisSettingsStorage_1.AnalysisSettingsStorage.setTheme(context, 'dark');
                vscode.window.showInformationMessage('Analysis viewer theme set to dark');
                // Refresh the tree view to show the updated theme
                vscode.commands.executeCommand('codexr.servers.refresh');
            }
            catch (error) {
                console.error('[CODE_ANALYSIS] Error setting dark theme:', error);
                vscode.window.showErrorMessage('Failed to set dark theme');
            }
        });
        // Auto-Analysis Delay command
        const setAutoAnalysisDelayCommand = vscode.commands.registerCommand('codexr.analysis.setAutoAnalysisDelay', async () => {
            console.log('[CODE_ANALYSIS] Command: setAutoAnalysisDelay executed');
            try {
                await handleAnalysisClicks_1.CodeAnalysisInteractionHandler.handleAutoAnalysisDelaySelection(context);
                // Refresh the tree view to show the updated delay
                vscode.commands.executeCommand('codexr.servers.refresh');
            }
            catch (error) {
                console.error('[CODE_ANALYSIS] Error setting auto-analysis delay:', error);
                vscode.window.showErrorMessage('Failed to set auto-analysis delay');
            }
        });
        // Command: Select Chart Type for File Analysis
        const selectChartTypeFileCommand = vscode.commands.registerCommand('codexr.analysis.selectChartTypeFile', async () => {
            console.log('[CODE_ANALYSIS] Command: selectChartTypeFile executed');
            try {
                await handleChartTypeFileSelection(context);
                // Refresh the tree view to show the updated chart type
                vscode.commands.executeCommand('codexr.servers.refresh');
            }
            catch (error) {
                console.error('[CODE_ANALYSIS] Error selecting chart type for file analysis:', error);
                vscode.window.showErrorMessage('Failed to select chart type for file analysis');
            }
        });
        // Command: Map Dimension for File Analysis
        const mapDimensionFileCommand = vscode.commands.registerCommand('codexr.analysis.mapDimensionFile', async (dimensionName, dataType, required) => {
            console.log('[CODE_ANALYSIS] Command: mapDimensionFile executed', { dimensionName, dataType, required });
            // Validate arguments
            if (!dimensionName || typeof dimensionName !== 'string') {
                console.error('[CODE_ANALYSIS] Invalid dimensionName argument:', dimensionName);
                vscode.window.showErrorMessage('Invalid dimension name provided');
                return;
            }
            try {
                await handleDimensionMappingFileSelection(context, dimensionName, dataType, required);
                // Refresh the tree view to show the updated mapping
                vscode.commands.executeCommand('codexr.servers.refresh');
            }
            catch (error) {
                console.error('[CODE_ANALYSIS] Error mapping dimension for file analysis:', error);
                vscode.window.showErrorMessage('Failed to map dimension for file analysis');
            }
        });
        // Command: Reset Analysis Settings to Defaults
        const resetSettingsCommand = vscode.commands.registerCommand('codexr.analysis.resetSettings', async () => {
            console.log('[CODE_ANALYSIS] Command: resetSettings executed');
            try {
                // Show confirmation dialog
                const result = await vscode.window.showWarningMessage('Reset all analysis settings to default values? This will restore chart type to "boats" and clear all dimension mappings.', { modal: true }, 'Reset Settings', 'Cancel');
                if (result === 'Reset Settings') {
                    // Reset to default configuration
                    await analysisSettingsStorage_1.AnalysisSettingsStorage.resetToDefaults(context);
                    // Refresh the tree view to show the updated settings
                    vscode.commands.executeCommand('codexr.servers.refresh');
                    vscode.window.showInformationMessage('Analysis settings have been reset to default values');
                }
            }
            catch (error) {
                console.error('[CODE_ANALYSIS] Error resetting analysis settings:', error);
                vscode.window.showErrorMessage('Failed to reset analysis settings');
            }
        });
        // Add all commands to subscriptions
        context.subscriptions.push(showActiveAnalysesCommand, showAnalysisSettingsCommand, showFilesByLanguageCommand, placeholderActiveAnalysesCommand, placeholderAnalysisSettingsCommand, placeholderFilesByLanguageCommand, toggleAnalysisModeCommand, analyzeFileStaticCommand, analyzeFileXRCommand, refreshCommand, fileClickedCommand, toggleThemeCommand, setLightThemeCommand, setDarkThemeCommand, setAutoAnalysisDelayCommand, selectChartTypeFileCommand, mapDimensionFileCommand, resetSettingsCommand);
        console.log('[CODE_ANALYSIS] All code analysis commands registered successfully');
    }
}
exports.CodeAnalysisCommands = CodeAnalysisCommands;
/**
 * Run analysis for a file and return the analysis data
 * This is a reusable function that can be called from various contexts
 *
 * @param context - VS Code extension context
 * @param filePath - Absolute file path to analyze
 * @returns Promise<any> - Analysis data object
 */
async function executeFileAnalysis(context, filePath) {
    console.log(`[ANALYSIS_EXECUTION] Starting analysis for ${path.basename(filePath)}`);
    try {
        // Run the Python static analysis coordinator
        const analysisData = await runStaticFileAnalysisCoordinator(context, filePath);
        if (!analysisData) {
            throw new Error('Analysis coordinator returned no data');
        }
        console.log(`[ANALYSIS_EXECUTION] Analysis completed for ${path.basename(filePath)}`);
        return analysisData;
    }
    catch (error) {
        console.error(`[ANALYSIS_EXECUTION] Analysis failed for ${path.basename(filePath)}:`, error);
        throw error;
    }
}
/**
 * Run the Python static file analysis coordinator
 */
async function runStaticFileAnalysisCoordinator(context, filePath) {
    return new Promise((resolve, reject) => {
        console.log(`STATIC_ANALYSIS: Running static coordinator for ${filePath}`);
        // Get the path to the Python coordinator script
        const extensionPath = context.extensionPath;
        const coordinatorPath = path.join(extensionPath, 'src', 'code_analysis', 'python', 'static_file_analysis_coordinator.py');
        console.log(`STATIC_ANALYSIS: Using coordinator script: ${coordinatorPath}`);
        // Get virtual environment paths
        const pythonEnvStorage = new pythonEnvStorage_1.PythonEnvStorage(context);
        const venvPath = pythonEnvStorage.getVenvPath();
        const pythonExecutable = pythonEnvUtils_1.PythonEnvUtils.getVenvPythonPath(venvPath);
        console.log(`STATIC_ANALYSIS: Using Python virtual environment: ${venvPath}`);
        console.log(`STATIC_ANALYSIS: Using Python executable: ${pythonExecutable}`);
        // Check if virtual environment exists and use it, otherwise fallback to system Python
        let pythonCommand = 'python3';
        try {
            if (pythonEnvUtils_1.PythonEnvUtils.isValidVenv(venvPath)) {
                pythonCommand = pythonExecutable;
                console.log(`STATIC_ANALYSIS: Using virtual environment Python: ${pythonCommand}`);
            }
            else {
                console.log(`STATIC_ANALYSIS: Virtual environment not found, using system Python: ${pythonCommand}`);
            }
        }
        catch (error) {
            console.log(`STATIC_ANALYSIS: Error checking virtual environment, using system Python: ${error}`);
        }
        // Spawn the Python process
        const pythonProcess = (0, child_process_1.spawn)(pythonCommand, [coordinatorPath, filePath], {
            cwd: path.dirname(coordinatorPath)
        });
        let stdout = '';
        let stderr = '';
        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        pythonProcess.stderr.on('data', (data) => {
            const stderrText = data.toString();
            stderr += stderrText;
            // Log debug messages from the Python script
            const lines = stderrText.split('\n').filter((line) => line.trim());
            lines.forEach((line) => {
                try {
                    const debugMsg = JSON.parse(line);
                    if (debugMsg.debug) {
                        console.log(debugMsg.debug);
                    }
                }
                catch {
                    // Not a JSON debug message, log as is
                    console.log(`STATIC_ANALYSIS: ${line}`);
                }
            });
        });
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(stdout.trim());
                    console.log(`STATIC_ANALYSIS: Analysis completed with status: ${result.status}`);
                    resolve(result);
                }
                catch (error) {
                    console.error(`STATIC_ANALYSIS: Failed to parse JSON output: ${error}`);
                    console.error(`STATIC_ANALYSIS: Raw stdout: ${stdout}`);
                    reject(new Error('Failed to parse static analysis output'));
                }
            }
            else {
                console.error(`STATIC_ANALYSIS: Python process exited with code ${code}`);
                console.error(`STATIC_ANALYSIS: stderr: ${stderr}`);
                reject(new Error(`Static analysis process failed with code ${code}`));
            }
        });
        pythonProcess.on('error', (error) => {
            console.error(`STATIC_ANALYSIS: Failed to start Python process: ${error}`);
            reject(error);
        });
    });
}
/**
 * Run the Python XR file analysis coordinator
 */
async function runXRFileAnalysisCoordinator(context, filePath) {
    return new Promise((resolve, reject) => {
        console.log(`XR_ANALYSIS: Running XR coordinator for ${filePath}`);
        // Get the path to the Python coordinator script
        const extensionPath = context.extensionPath;
        const coordinatorPath = path.join(extensionPath, 'src', 'code_analysis', 'python', 'xr_file_analysis_coordinator.py');
        console.log(`XR_ANALYSIS: Using coordinator script: ${coordinatorPath}`);
        // Get virtual environment paths
        const pythonEnvStorage = new pythonEnvStorage_1.PythonEnvStorage(context);
        const venvPath = pythonEnvStorage.getVenvPath();
        const pythonExecutable = pythonEnvUtils_1.PythonEnvUtils.getVenvPythonPath(venvPath);
        console.log(`XR_ANALYSIS: Using Python virtual environment: ${venvPath}`);
        console.log(`XR_ANALYSIS: Using Python executable: ${pythonExecutable}`);
        // Check if virtual environment exists and use it, otherwise fallback to system Python
        let pythonCommand = 'python3';
        try {
            if (pythonEnvUtils_1.PythonEnvUtils.isValidVenv(venvPath)) {
                pythonCommand = pythonExecutable;
                console.log(`XR_ANALYSIS: Using virtual environment Python: ${pythonCommand}`);
            }
            else {
                console.log(`XR_ANALYSIS: Virtual environment not found, using system Python: ${pythonCommand}`);
            }
        }
        catch (error) {
            console.log(`XR_ANALYSIS: Error checking virtual environment, using system Python: ${error}`);
        }
        // Spawn the Python process
        const pythonProcess = (0, child_process_1.spawn)(pythonCommand, [coordinatorPath, filePath], {
            cwd: path.dirname(coordinatorPath)
        });
        let stdout = '';
        let stderr = '';
        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        pythonProcess.stderr.on('data', (data) => {
            const stderrText = data.toString();
            stderr += stderrText;
            // Log debug messages from the Python script
            const lines = stderrText.split('\n').filter((line) => line.trim());
            lines.forEach((line) => {
                try {
                    const debugMsg = JSON.parse(line);
                    if (debugMsg.debug) {
                        console.log(debugMsg.debug);
                    }
                }
                catch {
                    // Not a JSON debug message, log as is
                    console.log(`XR_ANALYSIS: ${line}`);
                }
            });
        });
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(stdout.trim());
                    console.log(`XR_ANALYSIS: Analysis completed, found ${Array.isArray(result) ? result.length : 'N/A'} functions`);
                    resolve(result);
                }
                catch (error) {
                    console.error(`XR_ANALYSIS: Failed to parse JSON output: ${error}`);
                    console.error(`XR_ANALYSIS: Raw stdout: ${stdout}`);
                    reject(new Error('Failed to parse XR analysis output'));
                }
            }
            else {
                console.error(`XR_ANALYSIS: Python process exited with code ${code}`);
                console.error(`XR_ANALYSIS: stderr: ${stderr}`);
                reject(new Error(`XR analysis process failed with code ${code}`));
            }
        });
        pythonProcess.on('error', (error) => {
            console.error(`XR_ANALYSIS: Failed to start Python process: ${error}`);
            reject(error);
        });
    });
}
/**
 * Handle chart type selection for file analysis
 */
async function handleChartTypeFileSelection(context) {
    console.log('[CODE_ANALYSIS] Handling chart type selection for file analysis');
    try {
        // Get available charts from BabiaXR registry
        const chartRegistry = chartRegistry_1.BabiaChartRegistry.getInstance();
        const availableCharts = chartRegistry.getAllCharts();
        if (availableCharts.length === 0) {
            console.error('[CODE_ANALYSIS] No chart types found in registry');
            vscode.window.showErrorMessage('No chart templates available');
            return;
        }
        // Create quick pick items for available charts
        const quickPickItems = availableCharts.map(chart => ({
            label: chart.name,
            description: chart.description,
            detail: `Category: ${chart.category} | Dimensions: ${chart.dimensions.map(d => d.name).join(', ')}`,
            chartId: chart.id
        }));
        // Show quick pick
        const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Select a chart type for file analysis visualization',
            title: 'Chart Type Selection for File Analysis'
        });
        if (selectedItem && selectedItem.chartId) {
            // Update settings with selected chart type
            await analysisSettingsStorage_1.AnalysisSettingsStorage.setChartTypeFile(context, selectedItem.chartId);
            console.log(`[CODE_ANALYSIS] Chart type selected for file analysis: ${selectedItem.label}`);
            vscode.window.showInformationMessage(`Chart type set to ${selectedItem.label} for file analysis`);
        }
        else {
            console.log('[CODE_ANALYSIS] Chart type selection cancelled');
        }
    }
    catch (error) {
        console.error('[CODE_ANALYSIS] Error in chart type selection:', error);
        vscode.window.showErrorMessage(`Failed to select chart type: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Handle dimension mapping selection for file analysis
 */
async function handleDimensionMappingFileSelection(context, dimensionName, dataType, required) {
    console.log(`[CODE_ANALYSIS] Handling dimension mapping for file analysis: ${dimensionName}`);
    try {
        // Define available data fields from file analysis
        const fieldOptions = [
            {
                label: 'parameters',
                description: 'Number of parameters in functions',
                dataType: 'numeric'
            },
            {
                label: 'lines_count',
                description: 'Lines of code count',
                dataType: 'numeric'
            },
            {
                label: 'ccn',
                description: 'Cyclomatic Complexity Number (McCabe complexity)',
                dataType: 'numeric'
            },
            {
                label: 'function_name',
                description: 'Name of the function',
                dataType: 'text'
            },
            {
                label: 'ccn_density',
                description: 'CCN density (complexity per line of code)',
                dataType: 'numeric'
            }
        ];
        // Filter options based on data type if numeric only
        let availableOptions = fieldOptions;
        if (dataType === 'numeric') {
            availableOptions = fieldOptions.filter(option => option.dataType === 'numeric');
        }
        // Create quick pick items
        const quickPickItems = availableOptions.map(option => ({
            label: option.label,
            description: option.description,
            detail: option.dataType === 'numeric' ? 'Numeric values only' : 'Any value type'
        }));
        // Show quick pick
        const selectedField = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: `Select field to map to dimension "${dimensionName}"`,
            title: `Map Dimension: ${dimensionName} (${dataType}${required ? ', required' : ''})`
        });
        if (selectedField && selectedField.label) {
            // Update dimension mapping
            await analysisSettingsStorage_1.AnalysisSettingsStorage.updateDimensionMappingFile(context, dimensionName, selectedField.label);
            console.log(`[CODE_ANALYSIS] Dimension mapped: ${dimensionName} → ${selectedField.label}`);
            vscode.window.showInformationMessage(`Mapped ${dimensionName} to ${selectedField.label}`);
        }
        else {
            console.log(`[CODE_ANALYSIS] Dimension mapping cancelled for ${dimensionName}`);
        }
    }
    catch (error) {
        console.error(`[CODE_ANALYSIS] Error mapping dimension ${dimensionName}:`, error);
        vscode.window.showErrorMessage(`Failed to map dimension: ${error instanceof Error ? error.message : String(error)}`);
    }
}


/***/ }),
/* 60 */
/***/ ((module) => {

module.exports = require("child_process");

/***/ }),
/* 61 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CodeAnalysisInteractionHandler = void 0;
const vscode = __importStar(__webpack_require__(1));
const analysisSettingsStorage_1 = __webpack_require__(62);
/**
 * Handle clicks and interactions for Code Analysis tree items
 */
class CodeAnalysisInteractionHandler {
    /**
     * Handle main section clicks
     */
    static handleSectionClick(sectionType, context) {
        console.log(`[CODE_ANALYSIS] User clicked on ${sectionType}`);
        switch (sectionType) {
            case 'active-analyses':
                console.log('[CODE_ANALYSIS] User clicked on Active Analyses');
                vscode.window.showInformationMessage('TODO: Implement Active Analyses view logic');
                break;
            case 'analysis-settings':
                console.log('[CODE_ANALYSIS] User clicked on Analysis Settings');
                if (context) {
                    this.showAnalysisSettingsMenu(context);
                }
                else {
                    vscode.window.showErrorMessage('Extension context not available for settings');
                }
                break;
            case 'files-by-language':
                console.log('[CODE_ANALYSIS] User clicked on Files by Language');
                // This will trigger the file scan when the section is expanded
                // No need for a placeholder message anymore
                break;
            default:
                console.log(`[CODE_ANALYSIS] Unknown section type: ${sectionType}`);
                vscode.window.showWarningMessage(`Unknown analysis section: ${sectionType}`);
        }
    }
    /**
     * Handle placeholder item clicks
     */
    static handlePlaceholderClick(placeholderType) {
        console.log(`[CODE_ANALYSIS] User clicked on placeholder: ${placeholderType}`);
        switch (placeholderType) {
            case 'activeAnalyses':
                vscode.window.showInformationMessage('TODO: Implement Active Analyses functionality');
                break;
            case 'analysisSettings':
                vscode.window.showInformationMessage('TODO: Implement Analysis Settings functionality');
                break;
            case 'filesByLanguage':
                vscode.window.showInformationMessage('TODO: Implement Files by Language functionality');
                break;
            default:
                vscode.window.showInformationMessage(`TODO: Implement ${placeholderType} functionality`);
        }
    }
    /**
     * Handle file click - analyzes based on current mode
     */
    static async handleFileClick(filePath, context) {
        console.log(`ANALYSIS: File clicked: ${filePath}`);
        try {
            // Get current analysis mode
            const currentMode = await analysisSettingsStorage_1.AnalysisSettingsStorage.getCurrentAnalysisMode(context);
            console.log(`[CODE_ANALYSIS] Using analysis mode: ${currentMode}`);
            // Create URI from file path
            const fileUri = vscode.Uri.file(filePath);
            // Execute the appropriate analysis command based on current mode
            if (currentMode === 'XR') {
                await vscode.commands.executeCommand('codexr.analysis.fileXR', fileUri);
            }
            else {
                await vscode.commands.executeCommand('codexr.analysis.fileStatic', fileUri);
            }
        }
        catch (error) {
            console.error('[CODE_ANALYSIS] Error handling file click:', error);
            vscode.window.showErrorMessage('Failed to analyze file');
        }
    }
    /**
     * Show analysis settings menu with all options
     */
    static async showAnalysisSettingsMenu(context) {
        const items = [
            {
                label: '$(file) Analysis Mode',
                description: 'Switch between XR and Static analysis modes',
                action: 'analysisMode'
            },
            {
                label: '$(color-mode) Theme',
                description: 'Switch between light and dark themes',
                action: 'theme'
            },
            {
                label: '$(clock) Auto-Analysis Delay',
                description: 'Set delay before re-analyzing changed files',
                action: 'autoAnalysisDelay'
            }
        ];
        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select analysis setting to configure'
        });
        if (selection) {
            switch (selection.action) {
                case 'analysisMode':
                    await this.handleAnalysisModeSelection(context);
                    break;
                case 'theme':
                    await this.handleThemeSelection(context);
                    break;
                case 'autoAnalysisDelay':
                    await this.handleAutoAnalysisDelaySelection(context);
                    break;
            }
        }
    }
    /**
     * Handle analysis mode selection
     */
    static async handleAnalysisModeSelection(context) {
        const items = [
            { label: 'XR Analysis Mode', value: 'XR' },
            { label: 'Static Analysis Mode', value: 'Static' }
        ];
        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select analysis mode'
        });
        if (selection) {
            await analysisSettingsStorage_1.AnalysisSettingsStorage.setAnalysisMode(context, selection.value);
        }
    }
    /**
     * Handle theme selection
     */
    static async handleThemeSelection(context) {
        const items = [
            { label: 'Light Theme', value: 'light' },
            { label: 'Dark Theme', value: 'dark' }
        ];
        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select theme'
        });
        if (selection) {
            await analysisSettingsStorage_1.AnalysisSettingsStorage.setTheme(context, selection.value);
        }
    }
    /**
     * Handle auto-analysis delay selection
     */
    static async handleAutoAnalysisDelaySelection(context) {
        const options = analysisSettingsStorage_1.AnalysisSettingsStorage.getAutoAnalysisDelayOptions();
        const selection = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select auto-analysis delay'
        });
        if (selection) {
            if (selection.value === -1) {
                // Custom input
                const customInput = await vscode.window.showInputBox({
                    prompt: 'Enter custom delay in milliseconds',
                    placeHolder: 'e.g., 2500',
                    validateInput: (value) => {
                        const num = parseInt(value);
                        if (isNaN(num) || num < 0) {
                            return 'Please enter a valid number (0 or greater)';
                        }
                        return null;
                    }
                });
                if (customInput) {
                    const customDelay = parseInt(customInput);
                    await analysisSettingsStorage_1.AnalysisSettingsStorage.setAutoAnalysisDelay(context, customDelay);
                }
            }
            else {
                await analysisSettingsStorage_1.AnalysisSettingsStorage.setAutoAnalysisDelay(context, selection.value);
            }
        }
    }
}
exports.CodeAnalysisInteractionHandler = CodeAnalysisInteractionHandler;


/***/ }),
/* 62 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AnalysisSettingsStorage = exports.AUTO_ANALYSIS_DELAYS = void 0;
const vscode = __importStar(__webpack_require__(1));
/**
 * Auto-analysis delay presets in milliseconds
 */
exports.AUTO_ANALYSIS_DELAYS = {
    REAL_TIME: 0,
    HALF_SECOND: 500,
    ONE_SECOND: 1000,
    THREE_SECONDS: 3000,
    FIVE_SECONDS: 5000,
    TEN_SECONDS: 10000
};
/**
 * Default analysis configuration
 */
const DEFAULT_CONFIG = {
    analysisModeFile: 'XR',
    theme: 'light',
    autoAnalysisDelay: exports.AUTO_ANALYSIS_DELAYS.REAL_TIME,
    // Default chart and dimension mapping for file analysis - using boats chart with XR field names
    chartTypeFile: 'boats', // Default to boats chart for file analysis
    dimensionMappingFile: [
        {
            dimension: 'area',
            dataField: 'parameters' // Same in XR format
        },
        {
            dimension: 'height',
            dataField: 'lineCount' // Updated to XR field name
        },
        {
            dimension: 'color',
            dataField: 'complexity' // Updated to XR field name (was 'ccn')
        }
    ]
};
/**
 * Utility class for managing analysis settings storage
 * Stores configuration in globalStorage/codexr_analysis/configuration.json
 */
class AnalysisSettingsStorage {
    static STORAGE_FOLDER = 'codexr_analysis';
    static CONFIG_FILE = 'configuration.json';
    /**
     * Get the full path to the configuration file
     */
    static getConfigPath(context) {
        return vscode.Uri.joinPath(context.globalStorageUri, this.STORAGE_FOLDER, this.CONFIG_FILE);
    }
    /**
     * Load analysis configuration from storage
     */
    static async loadConfiguration(context) {
        try {
            const configPath = this.getConfigPath(context);
            console.log(`ANALYSIS: Loading configuration from ${configPath.fsPath}`);
            const configData = await vscode.workspace.fs.readFile(configPath);
            const configString = Buffer.from(configData).toString('utf8');
            const loadedConfig = JSON.parse(configString);
            // Validate and merge with defaults
            const config = {
                analysisModeFile: loadedConfig.analysisModeFile || DEFAULT_CONFIG.analysisModeFile,
                theme: loadedConfig.theme || DEFAULT_CONFIG.theme,
                autoAnalysisDelay: loadedConfig.autoAnalysisDelay !== undefined ? loadedConfig.autoAnalysisDelay : DEFAULT_CONFIG.autoAnalysisDelay,
                chartTypeFile: loadedConfig.chartTypeFile || DEFAULT_CONFIG.chartTypeFile,
                dimensionMappingFile: loadedConfig.dimensionMappingFile || DEFAULT_CONFIG.dimensionMappingFile
            };
            console.log(`ANALYSIS: Loaded configuration:`, config);
            return config;
        }
        catch (error) {
            console.log(`ANALYSIS: Could not load configuration, using defaults:`, error);
            // Try to detect theme from VS Code when config is not available
            const detectedTheme = this.getDefaultThemeFromVscode();
            console.log(`ANALYSIS: Detected VS Code theme: ${detectedTheme}`);
            return {
                ...DEFAULT_CONFIG,
                theme: detectedTheme
            };
        }
    }
    /**
     * Save analysis configuration to storage
     */
    static async saveConfiguration(context, config) {
        try {
            const configPath = this.getConfigPath(context);
            console.log(`ANALYSIS: Saving configuration to ${configPath.fsPath}:`, config);
            // Ensure the storage folder exists
            const storageFolder = vscode.Uri.joinPath(context.globalStorageUri, this.STORAGE_FOLDER);
            try {
                await vscode.workspace.fs.createDirectory(storageFolder);
            }
            catch (error) {
                // Directory might already exist, that's fine
            }
            // Save configuration
            const configString = JSON.stringify(config, null, 2);
            const configData = Buffer.from(configString, 'utf8');
            await vscode.workspace.fs.writeFile(configPath, configData);
            console.log(`ANALYSIS: Configuration saved successfully`);
        }
        catch (error) {
            console.error(`ANALYSIS: Failed to save configuration:`, error);
            vscode.window.showErrorMessage(`Failed to save analysis configuration: ${error}`);
        }
    }
    /**
     * Get the current analysis mode
     */
    static async getCurrentAnalysisMode(context) {
        const config = await this.loadConfiguration(context);
        return config.analysisModeFile;
    }
    /**
     * Set the analysis mode and save configuration
     */
    static async setAnalysisMode(context, mode) {
        console.log(`ANALYSIS: Setting analysis mode to: ${mode}`);
        const config = await this.loadConfiguration(context);
        config.analysisModeFile = mode;
        await this.saveConfiguration(context, config);
        // Show confirmation message
        const modeDisplay = mode === 'XR' ? 'XR Analysis Mode' : 'Static Analysis Mode';
        vscode.window.showInformationMessage(`Switched to ${modeDisplay}`);
    }
    /**
     * Toggle between XR and Static analysis modes
     */
    static async toggleAnalysisMode(context) {
        const currentMode = await this.getCurrentAnalysisMode(context);
        const newMode = currentMode === 'XR' ? 'Static' : 'XR';
        await this.setAnalysisMode(context, newMode);
        return newMode;
    }
    /**
     * Get icon for analysis mode
     */
    static getAnalysisModeIcon(mode) {
        switch (mode) {
            case 'XR':
                return new vscode.ThemeIcon('file', new vscode.ThemeColor('charts.purple'));
            case 'Static':
                return new vscode.ThemeIcon('file', new vscode.ThemeColor('charts.green'));
            default:
                return new vscode.ThemeIcon('file');
        }
    }
    /**
     * Get display label for analysis mode
     */
    static getAnalysisModeLabel(mode) {
        return `Analysis Mode (${mode})`;
    }
    /**
     * Get the current theme mode
     */
    static async getCurrentTheme(context) {
        const config = await this.loadConfiguration(context);
        return config.theme;
    }
    /**
     * Set the theme mode and save configuration
     */
    static async setTheme(context, theme) {
        console.log(`ANALYSIS: Setting theme to: ${theme}`);
        const config = await this.loadConfiguration(context);
        config.theme = theme;
        await this.saveConfiguration(context, config);
        console.log(`ANALYSIS: Theme updated to ${theme}`);
    }
    /**
     * Toggle between light and dark themes
     */
    static async toggleTheme(context) {
        const currentTheme = await this.getCurrentTheme(context);
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        await this.setTheme(context, newTheme);
        return newTheme;
    }
    /**
     * Get default theme from VS Code's active color theme
     */
    static getDefaultThemeFromVscode() {
        const theme = vscode.window.activeColorTheme.kind;
        if (theme === vscode.ColorThemeKind.Dark || theme === vscode.ColorThemeKind.HighContrast) {
            return 'dark';
        }
        return 'light';
    }
    /**
     * Get the current auto-analysis delay
     */
    static async getAutoAnalysisDelay(context) {
        const config = await this.loadConfiguration(context);
        return config.autoAnalysisDelay;
    }
    /**
     * Set the auto-analysis delay and save configuration
     */
    static async setAutoAnalysisDelay(context, delay) {
        console.log(`ANALYSIS: Setting auto-analysis delay to: ${delay}ms`);
        const config = await this.loadConfiguration(context);
        config.autoAnalysisDelay = delay;
        await this.saveConfiguration(context, config);
        // Show confirmation message
        const delayDisplay = delay === 0 ? 'Real Time' : `${delay}ms`;
        vscode.window.showInformationMessage(`Auto-analysis delay set to ${delayDisplay}`);
    }
    /**
     * Get display label for auto-analysis delay
     */
    static getAutoAnalysisDelayLabel(delay) {
        switch (delay) {
            case exports.AUTO_ANALYSIS_DELAYS.REAL_TIME:
                return 'Real Time (0s)';
            case exports.AUTO_ANALYSIS_DELAYS.HALF_SECOND:
                return '0.5s';
            case exports.AUTO_ANALYSIS_DELAYS.ONE_SECOND:
                return '1s';
            case exports.AUTO_ANALYSIS_DELAYS.THREE_SECONDS:
                return '3s';
            case exports.AUTO_ANALYSIS_DELAYS.FIVE_SECONDS:
                return '5s';
            case exports.AUTO_ANALYSIS_DELAYS.TEN_SECONDS:
                return '10s';
            default:
                return `${delay}ms (Custom)`;
        }
    }
    /**
     * Get preset delay options for UI
     */
    static getAutoAnalysisDelayOptions() {
        return [
            { label: 'Real Time (0s)', value: exports.AUTO_ANALYSIS_DELAYS.REAL_TIME },
            { label: '0.5s', value: exports.AUTO_ANALYSIS_DELAYS.HALF_SECOND },
            { label: '1s', value: exports.AUTO_ANALYSIS_DELAYS.ONE_SECOND },
            { label: '3s', value: exports.AUTO_ANALYSIS_DELAYS.THREE_SECONDS },
            { label: '5s', value: exports.AUTO_ANALYSIS_DELAYS.FIVE_SECONDS },
            { label: '10s', value: exports.AUTO_ANALYSIS_DELAYS.TEN_SECONDS },
            { label: 'Custom...', value: -1 } // Special value to indicate custom input
        ];
    }
    /**
     * Get the current chart type for file analysis
     */
    static async getChartTypeFile(context) {
        const config = await this.loadConfiguration(context);
        return config.chartTypeFile;
    }
    /**
     * Set the chart type for file analysis and save configuration
     */
    static async setChartTypeFile(context, chartType) {
        console.log(`ANALYSIS: Setting chart type for file analysis to: ${chartType}`);
        const config = await this.loadConfiguration(context);
        config.chartTypeFile = chartType;
        // Reset dimension mappings when chart type changes
        config.dimensionMappingFile = [];
        await this.saveConfiguration(context, config);
        vscode.window.showInformationMessage(`Chart type set to ${chartType}`);
    }
    /**
     * Get the current dimension mapping for file analysis
     */
    static async getDimensionMappingFile(context) {
        const config = await this.loadConfiguration(context);
        return config.dimensionMappingFile;
    }
    /**
     * Set the dimension mapping for file analysis and save configuration
     */
    static async setDimensionMappingFile(context, dimensionMappings) {
        console.log(`ANALYSIS: Setting dimension mapping for file analysis:`, dimensionMappings);
        const config = await this.loadConfiguration(context);
        config.dimensionMappingFile = dimensionMappings;
        await this.saveConfiguration(context, config);
        const mappedCount = dimensionMappings.length;
        vscode.window.showInformationMessage(`${mappedCount} dimension mappings configured`);
    }
    /**
     * Update a single dimension mapping for file analysis
     */
    static async updateDimensionMappingFile(context, dimensionName, dataField) {
        const config = await this.loadConfiguration(context);
        // Remove any existing mapping for this dimension
        config.dimensionMappingFile = config.dimensionMappingFile.filter(m => m.dimension !== dimensionName);
        // Add the new mapping
        config.dimensionMappingFile.push({
            dimension: dimensionName,
            dataField: dataField
        });
        await this.saveConfiguration(context, config);
        console.log(`ANALYSIS: Updated dimension mapping: ${dimensionName} → ${dataField}`);
    }
    /**
     * Reset all settings to default values
     */
    static async resetToDefaults(context) {
        console.log('[ANALYSIS] Resetting all settings to default values...');
        await this.saveConfiguration(context, DEFAULT_CONFIG);
        console.log('[ANALYSIS] Settings reset to defaults successfully');
    }
}
exports.AnalysisSettingsStorage = AnalysisSettingsStorage;


/***/ }),
/* 63 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PythonEnvStorage = void 0;
const path = __importStar(__webpack_require__(5));
const fs = __importStar(__webpack_require__(6));
const pythonEnvUtils_1 = __webpack_require__(64);
/**
 * Manages persistent storage of Python environment metadata
 */
class PythonEnvStorage {
    static PYTHON_ENV_DIR = 'python-env';
    static STATE_FILE = 'state.json';
    static VENV_DIR = 'venv';
    context;
    pythonEnvPath;
    stateFilePath;
    venvPath;
    constructor(context) {
        this.context = context;
        // Initialize paths using global storage
        const globalStorageUri = this.context.globalStorageUri;
        this.pythonEnvPath = path.join(globalStorageUri.fsPath, PythonEnvStorage.PYTHON_ENV_DIR);
        this.stateFilePath = path.join(this.pythonEnvPath, PythonEnvStorage.STATE_FILE);
        this.venvPath = path.join(this.pythonEnvPath, PythonEnvStorage.VENV_DIR);
        console.log(`PYTHON_ENV: Storage initialized at ${this.pythonEnvPath}`);
        console.log(`PYTHON_ENV: Virtual environment path: ${this.venvPath}`);
        console.log(`PYTHON_ENV: State file path: ${this.stateFilePath}`);
        // Ensure the python-env directory exists
        this.ensurePythonEnvDirectory();
    }
    /**
     * Get the virtual environment path
     */
    getVenvPath() {
        return this.venvPath;
    }
    /**
     * Get the Python environment storage path
     */
    getPythonEnvPath() {
        return this.pythonEnvPath;
    }
    /**
     * Save environment metadata to state.json
     */
    async saveMetadata(metadata) {
        try {
            const jsonData = JSON.stringify(metadata, null, 2);
            fs.writeFileSync(this.stateFilePath, jsonData, 'utf-8');
            console.log('PYTHON_ENV: Metadata saved to state file', metadata);
        }
        catch (error) {
            console.error('PYTHON_ENV: Failed to save metadata:', error);
            throw new Error(`Failed to save Python environment metadata: ${error}`);
        }
    }
    /**
     * Load environment metadata from state.json
     */
    loadMetadata() {
        try {
            if (!fs.existsSync(this.stateFilePath)) {
                console.log('PYTHON_ENV: No state file found, returning null');
                return null;
            }
            const jsonData = fs.readFileSync(this.stateFilePath, 'utf-8');
            const metadata = JSON.parse(jsonData);
            console.log('PYTHON_ENV: Metadata loaded from state file', metadata);
            return metadata;
        }
        catch (error) {
            console.error('PYTHON_ENV: Failed to load metadata:', error);
            return null;
        }
    }
    /**
     * Check if virtual environment exists and is valid
     */
    isVenvValid() {
        const isValid = pythonEnvUtils_1.PythonEnvUtils.isValidVenv(this.venvPath);
        console.log(`PYTHON_ENV: Virtual environment validation result: ${isValid}`);
        return isValid;
    }
    /**
     * Delete the virtual environment and metadata
     */
    async deleteEnvironment() {
        try {
            // Remove virtual environment directory
            if (fs.existsSync(this.venvPath)) {
                fs.rmSync(this.venvPath, { recursive: true, force: true });
                console.log('PYTHON_ENV: Virtual environment directory deleted');
            }
            // Remove state file
            if (fs.existsSync(this.stateFilePath)) {
                fs.unlinkSync(this.stateFilePath);
                console.log('PYTHON_ENV: State file deleted');
            }
            console.log('PYTHON_ENV: Environment successfully deleted');
        }
        catch (error) {
            console.error('PYTHON_ENV: Failed to delete environment:', error);
            throw new Error(`Failed to delete Python environment: ${error}`);
        }
    }
    /**
     * Update metadata with new validation timestamp
     */
    async updateValidation() {
        try {
            const metadata = this.loadMetadata();
            if (metadata) {
                metadata.lastValidated = new Date().toISOString();
                await this.saveMetadata(metadata);
                console.log('PYTHON_ENV: Validation timestamp updated');
            }
        }
        catch (error) {
            console.error('PYTHON_ENV: Failed to update validation:', error);
        }
    }
    /**
     * Update dependencies list in metadata
     */
    async updateDependencies(dependencies) {
        try {
            const metadata = this.loadMetadata();
            if (metadata) {
                metadata.dependencies = dependencies;
                await this.saveMetadata(metadata);
                console.log(`PYTHON_ENV: Dependencies updated (${dependencies.length} packages)`);
            }
        }
        catch (error) {
            console.error('PYTHON_ENV: Failed to update dependencies:', error);
        }
    }
    /**
     * Create initial metadata for a new environment
     */
    createInitialMetadata(pythonVersion) {
        const now = new Date().toISOString();
        return {
            venvPath: this.venvPath,
            createdAt: now,
            pythonVersion: pythonVersion,
            isActive: true,
            lastValidated: now,
            dependencies: []
        };
    }
    /**
     * Ensure the python-env directory exists
     */
    ensurePythonEnvDirectory() {
        try {
            if (!pythonEnvUtils_1.PythonEnvUtils.ensureDirectoryExists(this.pythonEnvPath)) {
                throw new Error(`Failed to create python-env directory at ${this.pythonEnvPath}`);
            }
        }
        catch (error) {
            console.error('PYTHON_ENV: Failed to ensure directory exists:', error);
            throw error;
        }
    }
    /**
     * Get storage statistics
     */
    getStorageStats() {
        const stats = {
            envExists: fs.existsSync(this.pythonEnvPath),
            stateExists: fs.existsSync(this.stateFilePath),
            venvSize: undefined
        };
        if (fs.existsSync(this.venvPath)) {
            try {
                // Calculate approximate venv size (simplified)
                const getDirectorySize = (dirPath) => {
                    let size = 0;
                    const items = fs.readdirSync(dirPath);
                    for (const item of items) {
                        const itemPath = path.join(dirPath, item);
                        const stat = fs.statSync(itemPath);
                        if (stat.isDirectory()) {
                            size += getDirectorySize(itemPath);
                        }
                        else {
                            size += stat.size;
                        }
                    }
                    return size;
                };
                stats.venvSize = Math.round(getDirectorySize(this.venvPath) / (1024 * 1024)); // MB
            }
            catch (error) {
                console.log('PYTHON_ENV: Could not calculate venv size:', error);
            }
        }
        return stats;
    }
}
exports.PythonEnvStorage = PythonEnvStorage;


/***/ }),
/* 64 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PythonEnvUtils = void 0;
const fs = __importStar(__webpack_require__(6));
const path = __importStar(__webpack_require__(5));
const os = __importStar(__webpack_require__(65));
/**
 * Platform-specific utilities for Python environment management
 */
class PythonEnvUtils {
    /**
     * Get the Python executable command for the current platform
     */
    static getPythonCommand() {
        const platform = os.platform();
        // On Windows, try python first, then python3
        if (platform === 'win32') {
            return 'python';
        }
        // On Unix-like systems (Linux, macOS), prefer python3
        return 'python3';
    }
    /**
     * Get the virtual environment activation command for the current platform
     */
    static getActivationCommand(venvPath) {
        const platform = os.platform();
        if (platform === 'win32') {
            return path.join(venvPath, 'Scripts', 'activate.bat');
        }
        else {
            return `source ${path.join(venvPath, 'bin', 'activate')}`;
        }
    }
    /**
     * Get the Python executable path within a virtual environment
     */
    static getVenvPythonPath(venvPath) {
        const platform = os.platform();
        if (platform === 'win32') {
            return path.join(venvPath, 'Scripts', 'python.exe');
        }
        else {
            return path.join(venvPath, 'bin', 'python');
        }
    }
    /**
     * Get the pip executable path within a virtual environment
     */
    static getVenvPipPath(venvPath) {
        const platform = os.platform();
        if (platform === 'win32') {
            return path.join(venvPath, 'Scripts', 'pip.exe');
        }
        else {
            return path.join(venvPath, 'bin', 'pip');
        }
    }
    /**
     * Check if a path points to a valid virtual environment
     */
    static isValidVenv(venvPath) {
        try {
            // Check if directory exists
            if (!fs.existsSync(venvPath)) {
                return false;
            }
            // Check for Python executable
            const pythonPath = this.getVenvPythonPath(venvPath);
            if (!fs.existsSync(pythonPath)) {
                return false;
            }
            // Check for pip executable
            const pipPath = this.getVenvPipPath(venvPath);
            if (!fs.existsSync(pipPath)) {
                return false;
            }
            // Check for pyvenv.cfg (standard virtual environment marker)
            const configPath = path.join(venvPath, 'pyvenv.cfg');
            if (!fs.existsSync(configPath)) {
                return false;
            }
            return true;
        }
        catch (error) {
            console.log(`PYTHON_ENV: Error validating venv at ${venvPath}:`, error);
            return false;
        }
    }
    /**
     * Validate a path is safe for virtual environment creation
     */
    static isValidPath(targetPath) {
        try {
            // Check if parent directory exists and is writable
            const parentDir = path.dirname(targetPath);
            if (!fs.existsSync(parentDir)) {
                return false;
            }
            // Check if target path already exists and is not empty
            if (fs.existsSync(targetPath)) {
                const stats = fs.statSync(targetPath);
                if (stats.isDirectory()) {
                    const contents = fs.readdirSync(targetPath);
                    return contents.length === 0; // Only valid if empty
                }
                return false; // File exists at target path
            }
            return true;
        }
        catch (error) {
            console.log(`PYTHON_ENV: Error validating path ${targetPath}:`, error);
            return false;
        }
    }
    /**
     * Extract Python version from a pyvenv.cfg file
     */
    static extractPythonVersion(venvPath) {
        try {
            const configPath = path.join(venvPath, 'pyvenv.cfg');
            if (!fs.existsSync(configPath)) {
                return null;
            }
            const configContent = fs.readFileSync(configPath, 'utf-8');
            const versionMatch = configContent.match(/version\s*=\s*([^\s\n]+)/);
            return versionMatch ? versionMatch[1] : null;
        }
        catch (error) {
            console.log(`PYTHON_ENV: Error extracting version from ${venvPath}:`, error);
            return null;
        }
    }
    /**
     * Get platform-specific environment separator
     */
    static getPathSeparator() {
        return os.platform() === 'win32' ? ';' : ':';
    }
    /**
     * Ensure directory exists, creating it if necessary
     */
    static ensureDirectoryExists(dirPath) {
        try {
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
            return true;
        }
        catch (error) {
            console.error(`PYTHON_ENV: Failed to create directory ${dirPath}:`, error);
            return false;
        }
    }
}
exports.PythonEnvUtils = PythonEnvUtils;


/***/ }),
/* 65 */
/***/ ((module) => {

module.exports = require("os");

/***/ }),
/* 66 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.storeAnalysisJson = storeAnalysisJson;
exports.cleanupAnalysisTemp = cleanupAnalysisTemp;
exports.listStoredAnalyses = listStoredAnalyses;
exports.prepareStaticAnalysisViewerAssets = prepareStaticAnalysisViewerAssets;
exports.updateDataJson = updateDataJson;
exports.prepareXRAnalysisViewerAssets = prepareXRAnalysisViewerAssets;
const vscode = __importStar(__webpack_require__(1));
const fs = __importStar(__webpack_require__(67));
const path = __importStar(__webpack_require__(5));
const nonceGenerator_1 = __webpack_require__(12);
const index_1 = __webpack_require__(56);
const analysisSettingsStorage_1 = __webpack_require__(62);
const fileToServerMap_1 = __webpack_require__(21);
const xrTemplateRenderer_1 = __webpack_require__(68);
/**
 * Temporary Storage Manager for Analysis Results
 *
 * Manages the creation and storage of analysis result files in workspace-scoped
 * temporary directories under context.storageUri/analysis_temp/
 */
/**
 * Store analysis JSON data in a temporary workspace-scoped folder
 *
 * Creates a unique folder structure:
 * {context.storageUri}/analysis_temp/{baseFileName}_{nonce}/data.json
 *
 * @param context - VS Code extension context providing storage URI
 * @param fileName - Name of the analyzed file (with or without path)
 * @param data - Analysis data object to be stored as JSON
 * @returns Promise<vscode.Uri> - URI of the created subfolder containing data.json
 */
async function storeAnalysisJson(context, fileName, data) {
    // Ensure we have a storage URI
    if (!context.storageUri) {
        throw new Error('Extension storage URI not available');
    }
    // Extract the base file name without extension or path
    const baseName = path.parse(fileName).name;
    // Generate a unique nonce for this analysis session
    const nonce = (0, nonceGenerator_1.generateNonce)();
    // Create the target folder path: analysis_temp/{baseName}_{nonce}
    const targetFolder = vscode.Uri.joinPath(context.storageUri, 'analysis_temp', `${baseName}_${nonce}`);
    try {
        // Ensure the folder exists (create recursively)
        await fs.mkdir(targetFolder.fsPath, { recursive: true });
        // Create the data.json file path
        const dataPath = vscode.Uri.joinPath(targetFolder, 'data.json');
        // Write the analysis data as formatted JSON
        await fs.writeFile(dataPath.fsPath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`ANALYSIS_STORAGE: Successfully stored analysis data at ${dataPath.fsPath}`);
        // Return the folder URI (not the file URI)
        return targetFolder;
    }
    catch (error) {
        console.error(`ANALYSIS_STORAGE: Error storing analysis data: ${error}`);
        throw new Error(`Failed to store analysis data: ${error}`);
    }
}
/**
 * Clean up all temporary analysis folders
 *
 * Removes the entire analysis_temp directory and all its contents.
 * This should be called during extension deactivation.
 *
 * @param context - VS Code extension context providing storage URI
 */
async function cleanupAnalysisTemp(context) {
    if (!context.storageUri) {
        console.log('ANALYSIS_STORAGE: No storage URI available for cleanup');
        return;
    }
    const cleanupPath = vscode.Uri.joinPath(context.storageUri, 'analysis_temp');
    try {
        await fs.rm(cleanupPath.fsPath, { recursive: true, force: true });
        console.log(`ANALYSIS_STORAGE: Successfully cleaned up temporary analysis folder at ${cleanupPath.fsPath}`);
    }
    catch (error) {
        // Ignore errors if folder doesn't exist
        console.log(`ANALYSIS_STORAGE: Cleanup completed (folder may not have existed): ${error}`);
    }
}
/**
 * List all stored analysis results
 *
 * Returns information about all currently stored analysis results
 * in the analysis_temp directory.
 *
 * @param context - VS Code extension context providing storage URI
 * @returns Promise<string[]> - Array of folder names containing analysis results
 */
async function listStoredAnalyses(context) {
    if (!context.storageUri) {
        return [];
    }
    const analysisTempPath = vscode.Uri.joinPath(context.storageUri, 'analysis_temp');
    try {
        const entries = await fs.readdir(analysisTempPath.fsPath, { withFileTypes: true });
        return entries
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name);
    }
    catch (error) {
        // Return empty array if directory doesn't exist
        return [];
    }
}
/**
 * Prepare static analysis viewer assets and launch server
 *
 * Creates a complete static analysis viewer by:
 * 1. Creating a temporary folder with unique nonce
 * 2. Copying template files (HTML, CSS, JS)
 * 3. Saving analysis data as data.json
 * 4. Launching a local server to serve the viewer
 *
 * @param context - VS Code extension context providing storage URI
 * @param fileName - Name of the analyzed file (with or without path)
 * @param analysisData - Analysis data object to be stored and displayed
 * @returns Promise<vscode.Uri> - URI of the created viewer folder
 */
async function prepareStaticAnalysisViewerAssets(context, fileName, analysisData) {
    // Ensure we have a storage URI
    if (!context.storageUri) {
        throw new Error('Extension storage URI not available');
    }
    // Extract the base file name without extension or path
    const baseName = path.parse(fileName).name;
    // Get the full filename with extension for server name
    const fullFileName = path.basename(fileName);
    // Generate a unique nonce for this analysis viewer session
    const nonce = (0, nonceGenerator_1.generateNonce)();
    // Create the target folder path: analysis_temp/{baseName}_{nonce}
    const targetFolder = vscode.Uri.joinPath(context.storageUri, 'analysis_temp', `${baseName}_${nonce}`);
    try {
        // Ensure the folder exists (create recursively)
        await fs.mkdir(targetFolder.fsPath, { recursive: true });
        console.log(`ANALYSIS_VIEWER: Created viewer folder at ${targetFolder.fsPath}`);
        // Get extension path for source files
        const extensionPath = context.extensionPath;
        // Define source file paths
        const templateHtmlPath = path.join(extensionPath, 'templates', 'analysis_static', 'fileAnalysis.html');
        const mainJsPath = path.join(extensionPath, 'media', 'analysis', 'fileAnalysismain.js');
        const styleCssPath = path.join(extensionPath, 'media', 'analysis', 'fileAnalysisstyle.css');
        // Define destination file paths
        const indexHtmlPath = path.join(targetFolder.fsPath, 'index.html');
        const jsDestPath = path.join(targetFolder.fsPath, 'fileAnalysismain.js');
        const cssDestPath = path.join(targetFolder.fsPath, 'fileAnalysisstyle.css');
        const dataJsonPath = path.join(targetFolder.fsPath, 'data.json');
        // Step 1: Copy the HTML template and rename to index.html
        console.log(`ANALYSIS_VIEWER: Copying HTML template from ${templateHtmlPath}`);
        let htmlContent = await fs.readFile(templateHtmlPath, 'utf8');
        // Process the HTML template to work in static server mode
        const currentTheme = await analysisSettingsStorage_1.AnalysisSettingsStorage.getCurrentTheme(context);
        htmlContent = processStaticAnalysisTemplate(htmlContent, analysisData, currentTheme);
        await fs.writeFile(indexHtmlPath, htmlContent, 'utf8');
        console.log(`ANALYSIS_VIEWER: Created index.html at ${indexHtmlPath}`);
        // Step 2: Copy the JavaScript file
        console.log(`ANALYSIS_VIEWER: Copying JavaScript from ${mainJsPath}`);
        await fs.copyFile(mainJsPath, jsDestPath);
        console.log(`ANALYSIS_VIEWER: Created fileAnalysismain.js at ${jsDestPath}`);
        // Step 3: Copy the CSS file
        console.log(`ANALYSIS_VIEWER: Copying CSS from ${styleCssPath}`);
        await fs.copyFile(styleCssPath, cssDestPath);
        console.log(`ANALYSIS_VIEWER: Created fileAnalysisstyle.css at ${cssDestPath}`);
        // Step 4: Write the analysis data as data.json
        await fs.writeFile(dataJsonPath, JSON.stringify(analysisData, null, 2), 'utf8');
        console.log(`ANALYSIS_VIEWER: Created data.json at ${dataJsonPath}`);
        // Step 5: Launch the local server
        const customServerName = `Analysis Static ${fullFileName}`;
        console.log(`ANALYSIS_VIEWER: Launching server with name: ${customServerName}`);
        const launchResult = await (0, index_1.launchServerWithFile)(context, indexHtmlPath, customServerName);
        if (launchResult.success) {
            console.log(`ANALYSIS_VIEWER: Server launched successfully at ${launchResult.serverUrl}`);
            // Register the file-to-server mapping for SSE notifications
            if (launchResult.port) {
                console.log(`ANALYSIS_VIEWER: Registering file-to-server mapping for ${fileName}`);
                fileToServerMap_1.fileToServerMap.registerMapping(fileName, {
                    port: launchResult.port,
                    tempDir: targetFolder.fsPath,
                    fileUri: fileName,
                    serverRef: null // Server reference not available from launch result
                });
                console.log(`ANALYSIS_VIEWER: File-to-server mapping registered for ${fileName} on port ${launchResult.port}`);
            }
            // Show success message with server URL
            vscode.window.showInformationMessage(`Static analysis viewer launched for ${fullFileName}`, 'Open in Browser').then(selection => {
                if (selection === 'Open in Browser' && launchResult.serverUrl) {
                    vscode.env.openExternal(vscode.Uri.parse(launchResult.serverUrl));
                }
            });
        }
        else {
            throw new Error(`Failed to launch server: ${launchResult.error}`);
        }
        console.log(`ANALYSIS_VIEWER: Static analysis viewer assets prepared successfully at ${targetFolder.fsPath}`);
        // Return the folder URI
        return targetFolder;
    }
    catch (error) {
        console.error(`ANALYSIS_VIEWER: Error preparing static analysis viewer: ${error}`);
        throw new Error(`Failed to prepare static analysis viewer: ${error}`);
    }
}
/**
 * Update the data.json file in an existing analysis folder
 *
 * Finds existing analysis folders for a file and updates the data.json
 * while preserving other assets (HTML, CSS, JS files).
 *
 * @param context - VS Code extension context providing storage URI
 * @param filePath - Path of the analyzed file
 * @param newData - New analysis data to write to data.json
 * @returns Promise<vscode.Uri[]> - URIs of updated folders
 */
async function updateDataJson(context, filePath, newData) {
    console.log(`[TEMP_STORAGE] Updating data.json for ${path.basename(filePath)}`);
    if (!context.storageUri) {
        throw new Error('Extension storage URI not available');
    }
    const baseName = path.parse(filePath).name;
    const analysisTempPath = vscode.Uri.joinPath(context.storageUri, 'analysis_temp');
    try {
        // Read all directories in analysis_temp
        const entries = await fs.readdir(analysisTempPath.fsPath, { withFileTypes: true });
        const matchingFolders = [];
        for (const entry of entries) {
            if (entry.isDirectory() && entry.name.startsWith(`${baseName}_`)) {
                const folderPath = vscode.Uri.joinPath(analysisTempPath, entry.name);
                const dataJsonPath = vscode.Uri.joinPath(folderPath, 'data.json');
                try {
                    // Update the data.json file
                    console.log(`[TEMP_STORAGE] DEBUG: Writing data.json to: ${dataJsonPath.fsPath}`);
                    await fs.writeFile(dataJsonPath.fsPath, JSON.stringify(newData, null, 2), 'utf8');
                    // Verify file was written by checking if it exists and reading size
                    const stats = await fs.stat(dataJsonPath.fsPath);
                    console.log(`[TEMP_STORAGE] DEBUG: Verified data.json written - Size: ${stats.size} bytes`);
                    // Check if this is an XR analysis folder by looking for index.html
                    const indexHtmlPath = vscode.Uri.joinPath(folderPath, 'index.html');
                    try {
                        await fs.access(indexHtmlPath.fsPath);
                        // index.html exists, this is likely an XR analysis - regenerate it
                        console.log(`[TEMP_STORAGE] Detected XR analysis folder, regenerating index.html for ${entry.name}`);
                        try {
                            await xrTemplateRenderer_1.XRTemplateRenderer.generateXRVisualization(context, folderPath, filePath, newData);
                            console.log(`[TEMP_STORAGE] ✅ Regenerated XR index.html for ${entry.name}`);
                        }
                        catch (xrError) {
                            console.error(`[TEMP_STORAGE] ⚠️ Failed to regenerate XR index.html for ${entry.name}: ${xrError}`);
                            // Continue with the process even if XR HTML generation fails
                        }
                    }
                    catch (indexError) {
                        // index.html doesn't exist, probably a static analysis folder
                        console.log(`[TEMP_STORAGE] No index.html found in ${entry.name}, assuming static analysis folder`);
                    }
                    console.log(`[TEMP_STORAGE] Updated data.json in ${entry.name}`);
                    matchingFolders.push(folderPath);
                }
                catch (error) {
                    console.error(`[TEMP_STORAGE] Failed to update data.json in ${entry.name}:`, error);
                    // Continue with other folders
                }
            }
        }
        if (matchingFolders.length === 0) {
            console.log(`[TEMP_STORAGE] No existing analysis folders found for ${baseName}`);
        }
        else {
            console.log(`[TEMP_STORAGE] Updated ${matchingFolders.length} analysis folder(s) for ${baseName}`);
        }
        return matchingFolders;
    }
    catch (error) {
        console.error(`[TEMP_STORAGE] Error updating data.json:`, error);
        return [];
    }
}
/**
 * Process the static analysis HTML template for standalone server use
 *
 * Replaces VS Code webview placeholders with static server equivalents
 * and injects analysis data directly into the HTML.
 *
 * @param htmlContent - Original HTML template content
 * @param analysisData - Analysis data to inject
 * @param theme - Theme mode ('light' or 'dark')
 * @returns Processed HTML content ready for static server
 */
function processStaticAnalysisTemplate(htmlContent, analysisData, theme) {
    // Replace VS Code webview placeholders with static equivalents
    let processedHtml = htmlContent
        // Replace CSS reference
        .replace('${styleUri}', './fileAnalysisstyle.css')
        // Replace JS reference  
        .replace('${scriptUri}', './fileAnalysismain.js')
        // Remove nonce references for static use
        .replace(/nonce-\$\{nonce\}/g, '')
        .replace(/\$\{nonce\}/g, '')
        // Update CSP for static server
        .replace(/content="default-src 'none'; style-src \$\{webview\.cspSource\}; script-src 'nonce-\$\{nonce\}' https:\/\/cdn\.jsdelivr\.net; img-src data:;"/, 'content="default-src \'self\'; script-src \'self\' \'unsafe-inline\' https://cdn.jsdelivr.net; style-src \'self\' \'unsafe-inline\'; img-src data: \'self\';"');
    // Inject analysis data directly into the HTML
    const dataInjectionScript = `
    <script>
        // Inject analysis data for static server mode
        window.analysisData = ${JSON.stringify(analysisData)};
        // Inject theme setting
        window.initialTheme = '${theme}';
        console.log('ANALYSIS_VIEWER: Analysis data injected into window.analysisData');
        console.log('ANALYSIS_VIEWER: Theme set to:', window.initialTheme);
    </script>`;
    // Insert the data injection script before the main script
    processedHtml = processedHtml.replace(/<script[^>]*src="\.\/fileAnalysismain\.js"[^>]*><\/script>/, dataInjectionScript + '\n    <script src="./fileAnalysismain.js"></script>');
    return processedHtml;
}
/**
 * Prepare XR Analysis Viewer Assets and Launch Server
 *
 * Uses the existing index.html generated by XRTemplateRenderer and launches a server
 *
 * @param context - VS Code extension context
 * @param tempFolder - URI of the temp folder containing index.html and data.json
 * @param fileName - Name of the analyzed file
 * @returns Promise<vscode.Uri> - URI of the viewer folder
 */
async function prepareXRAnalysisViewerAssets(context, tempFolder, fileName) {
    try {
        const baseName = path.basename(fileName);
        const indexHtmlPath = path.join(tempFolder.fsPath, 'index.html');
        // Verify that index.html exists (should be generated by XRTemplateRenderer)
        try {
            await fs.access(indexHtmlPath);
            console.log(`XR_ANALYSIS_VIEWER: Found index.html at ${indexHtmlPath}`);
        }
        catch (error) {
            throw new Error(`index.html not found at ${indexHtmlPath}. XR template generation may have failed.`);
        }
        // Launch the local server for XR analysis
        const customServerName = `Analysis XR ${baseName}`;
        console.log(`XR_ANALYSIS_VIEWER: Launching XR server with name: ${customServerName}`);
        const launchResult = await (0, index_1.launchServerWithFile)(context, indexHtmlPath, customServerName);
        if (launchResult.success) {
            console.log(`XR_ANALYSIS_VIEWER: XR server launched successfully at ${launchResult.serverUrl}`);
            // Register the file-to-server mapping for SSE notifications
            if (launchResult.port) {
                console.log(`XR_ANALYSIS_VIEWER: Registering file-to-server mapping for ${fileName}`);
                fileToServerMap_1.fileToServerMap.registerMapping(fileName, {
                    port: launchResult.port,
                    tempDir: tempFolder.fsPath,
                    fileUri: fileName,
                    serverRef: null // Server reference not available from launch result
                });
                console.log(`XR_ANALYSIS_VIEWER: File-to-server mapping registered for ${fileName} on port ${launchResult.port}`);
            }
            // Show success message with server URL
            vscode.window.showInformationMessage(`XR analysis viewer launched for ${baseName}`, 'Open in Browser').then(selection => {
                if (selection === 'Open in Browser' && launchResult.serverUrl) {
                    vscode.env.openExternal(vscode.Uri.parse(launchResult.serverUrl));
                }
            });
        }
        else {
            throw new Error(`Failed to launch XR server: ${launchResult.error}`);
        }
        console.log(`XR_ANALYSIS_VIEWER: XR analysis viewer assets prepared successfully at ${tempFolder.fsPath}`);
        return tempFolder;
    }
    catch (error) {
        console.error(`XR_ANALYSIS_VIEWER: Error preparing XR analysis viewer: ${error}`);
        throw new Error(`Failed to prepare XR analysis viewer: ${error}`);
    }
}


/***/ }),
/* 67 */
/***/ ((module) => {

module.exports = require("fs/promises");

/***/ }),
/* 68 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.XRTemplateRenderer = void 0;
const path = __importStar(__webpack_require__(5));
const analysisSettingsStorage_1 = __webpack_require__(62);
const templateProcessor_1 = __webpack_require__(46);
/**
 * XR Template Renderer for File Analysis
 * Delegates to centralized TemplateProcessor for HTML generation
 */
class XRTemplateRenderer {
    /**
     * Generate and save index.html for XR file analysis using centralized TemplateProcessor
     *
     * @param context - VS Code extension context
     * @param analysisFolder - URI of the analysis folder (contains data.json)
     * @param filePath - Original file path being analyzed
     * @param analysisData - Analysis data object
     */
    static async generateXRVisualization(context, analysisFolder, filePath, analysisData) {
        console.log(`[XR_TEMPLATE_RENDERER] Generating XR visualization for ${path.basename(filePath)} using centralized TemplateProcessor`);
        try {
            // Get current chart configuration
            const chartType = await analysisSettingsStorage_1.AnalysisSettingsStorage.getChartTypeFile(context);
            const dimensionMappings = await analysisSettingsStorage_1.AnalysisSettingsStorage.getDimensionMappingFile(context);
            console.log(`[XR_TEMPLATE_RENDERER] Using chart type: ${chartType}`);
            console.log(`[XR_TEMPLATE_RENDERER] Dimension mappings:`, dimensionMappings);
            // Convert field names to XR format if needed
            const mappings = dimensionMappings.map(mapping => ({
                dimension: mapping.dimension,
                dataField: this.convertToXRFieldName(mapping.dataField),
                label: mapping.label
            }));
            // Prepare output path for index.html
            const indexHtmlPath = path.join(analysisFolder.fsPath, 'index.html');
            // Use centralized TemplateProcessor to generate the complete XR visualization
            const result = await templateProcessor_1.TemplateProcessor.generateXRVisualization(chartType, mappings, `File Analysis: ${path.basename(filePath)}`, './data.json', context, indexHtmlPath);
            if (!result.success) {
                console.error(`[XR_TEMPLATE_RENDERER] TemplateProcessor failed:`, result.error);
                throw new Error(`Template processing failed: ${result.error}`);
            }
            console.log(`[XR_TEMPLATE_RENDERER] Successfully generated index.html using TemplateProcessor at: ${indexHtmlPath}`);
        }
        catch (error) {
            console.error(`[XR_TEMPLATE_RENDERER] Failed to generate XR visualization:`, error);
            throw error;
        }
    }
    /**
     * Convert field names from static analysis format to XR format
     * Maps legacy field names to standardized XR field names
     */
    static convertToXRFieldName(fieldName) {
        const fieldMappings = {
            'ccn': 'complexity',
            'lines_count': 'lineCount',
            'line_start': 'lineStart',
            'line_end': 'lineEnd',
            'function_name': 'fileName',
            'nloc': 'lineCount',
            'parameters': 'parameters',
            'max_nesting_depth': 'maxNestingDepth',
            'cyclomatic_density': 'cyclomaticDensity'
        };
        return fieldMappings[fieldName] || fieldName;
    }
}
exports.XRTemplateRenderer = XRTemplateRenderer;


/***/ }),
/* 69 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ActiveAnalysisRegistry = void 0;
const vscode = __importStar(__webpack_require__(1));
const activeAnalysisModel_1 = __webpack_require__(70);
const activeServerRegistry_1 = __webpack_require__(17);
const fileToServerMap_1 = __webpack_require__(21);
const SSEManager_1 = __webpack_require__(22);
/**
 * Registry that manages currently tracked active analyses
 * This is a singleton that maintains the state of all active analyses
 */
class ActiveAnalysisRegistry {
    static instance = null;
    activeAnalyses = new Map();
    _onDidChangeAnalyses = new vscode.EventEmitter();
    serverEventSubscription = null;
    /**
     * Event fired when the registry of active analyses changes
     */
    onDidChangeAnalyses = this._onDidChangeAnalyses.event;
    constructor() {
        console.log('[ACTIVE_ANALYSIS_REGISTRY] Initializing active analysis registry');
        this.setupServerEventIntegration();
    }
    /**
     * Set up integration with server events to auto-unregister analyses when servers stop
     */
    setupServerEventIntegration() {
        try {
            const serverRegistry = (0, activeServerRegistry_1.getActiveServerRegistry)();
            // Subscribe to server registry changes
            this.serverEventSubscription = serverRegistry.onRegistryChange((event) => {
                console.log('[ACTIVE_ANALYSIS_REGISTRY] 📡 Received server registry event:', event.type);
                if (event.type === 'serverRemoved' && event.server) {
                    console.log(`[ACTIVE_ANALYSIS_REGISTRY] 🔌 Server removed: ${event.server.url} (port ${event.server.port})`);
                    // Use file-to-server mapping to find associated analysis
                    const fileUri = fileToServerMap_1.fileToServerMap.findFileByPort(event.server.port);
                    let removedAnalysis = false;
                    if (fileUri) {
                        console.log(`[ACTIVE_ANALYSIS_REGISTRY] 🎯 Found analysis file via mapping: ${fileUri}`);
                        // Find and remove the analysis for this file
                        let foundAnalysisId = null;
                        for (const [id, analysis] of this.activeAnalyses.entries()) {
                            if (analysis.path === fileUri) {
                                foundAnalysisId = id;
                                console.log(`[ACTIVE_ANALYSIS_REGISTRY] ✅ Found matching analysis: ${id}`);
                                break;
                            }
                        }
                        if (foundAnalysisId) {
                            this.unregisterAnalysis(foundAnalysisId);
                            removedAnalysis = true;
                            console.log(`[ACTIVE_ANALYSIS_REGISTRY] 🗑️ Auto-removed analysis via file mapping: ${foundAnalysisId}`);
                        }
                        // Clean up SSE clients for this file
                        console.log(`[ACTIVE_ANALYSIS_REGISTRY] 🧹 Cleaning up SSE clients for: ${fileUri}`);
                        SSEManager_1.sseManager.removeAllClients(fileUri);
                        // Remove the mapping
                        fileToServerMap_1.fileToServerMap.unregisterMapping(fileUri);
                    }
                    // Fallback to the old smart matching logic if mapping didn't work
                    if (!removedAnalysis && event.server.customName) {
                        console.log(`[ACTIVE_ANALYSIS_REGISTRY] 🔍 Direct path match failed, trying smart matching for server: ${event.server.customName}`);
                        // Extract filename from custom name (e.g., "Analysis Static tryCodeXr.kt" -> "tryCodeXr.kt")
                        const customNameParts = event.server.customName.split(' ');
                        const possibleFileName = customNameParts[customNameParts.length - 1]; // Last part is usually the filename
                        if (possibleFileName) {
                            console.log(`[ACTIVE_ANALYSIS_REGISTRY] � Looking for analysis with filename: ${possibleFileName}`);
                            // Find analysis by matching filename
                            let foundAnalysisId = null;
                            for (const [id, analysis] of this.activeAnalyses.entries()) {
                                const analysisFileName = analysis.path.split('/').pop() || analysis.path.split('\\').pop();
                                if (analysisFileName === possibleFileName) {
                                    foundAnalysisId = id;
                                    console.log(`[ACTIVE_ANALYSIS_REGISTRY] ✅ Found matching analysis by filename: ${id}`);
                                    break;
                                }
                            }
                            if (foundAnalysisId) {
                                this.unregisterAnalysis(foundAnalysisId);
                                removedAnalysis = true;
                                console.log(`[ACTIVE_ANALYSIS_REGISTRY] 🗑️ Auto-removed analysis via smart matching: ${foundAnalysisId}`);
                            }
                        }
                    }
                    if (!removedAnalysis) {
                        console.log(`[ACTIVE_ANALYSIS_REGISTRY] ⚠️ Could not find associated analysis for stopped server: ${event.server.url}`);
                    }
                }
            });
            console.log('[ACTIVE_ANALYSIS_REGISTRY] 🔗 Server event integration setup complete');
        }
        catch (error) {
            console.warn('[ACTIVE_ANALYSIS_REGISTRY] ⚠️ Error setting up server integration:', error);
        }
    }
    /**
     * Dispose of resources
     */
    dispose() {
        if (this.serverEventSubscription) {
            this.serverEventSubscription.dispose();
            this.serverEventSubscription = null;
            console.log('[ACTIVE_ANALYSIS_REGISTRY] 🧹 Disposed server event subscription');
        }
    }
    /**
     * Get the singleton instance of the registry
     */
    static getInstance() {
        if (!ActiveAnalysisRegistry.instance) {
            ActiveAnalysisRegistry.instance = new ActiveAnalysisRegistry();
        }
        return ActiveAnalysisRegistry.instance;
    }
    /**
     * Register a new analysis
     */
    registerAnalysis(analysis) {
        const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newAnalysis = {
            ...analysis,
            id: analysisId
        };
        console.log('[ACTIVE_ANALYSES_REGISTRY] 🔥 Registering new analysis:', {
            id: analysisId,
            mode: analysis.mode,
            path: analysis.path,
            status: analysis.status,
            language: analysis.language
        });
        this.activeAnalyses.set(analysisId, newAnalysis);
        console.log('[ACTIVE_ANALYSES_REGISTRY] 📊 Total analyses in registry:', this.activeAnalyses.size);
        console.log('[ACTIVE_ANALYSES_REGISTRY] 🔔 Firing onDidChangeAnalyses event');
        this._onDidChangeAnalyses.fire();
        return analysisId;
    }
    /**
     * Update an existing analysis
     */
    updateAnalysis(analysisId, status, progress, error, metadata) {
        const analysis = this.activeAnalyses.get(analysisId);
        if (analysis) {
            console.log('[ACTIVE_ANALYSES_REGISTRY] 🔄 Updating analysis:', {
                id: analysisId,
                oldStatus: analysis.status,
                newStatus: status,
                progress: progress,
                error: error,
                metadata: metadata
            });
            const updatedAnalysis = activeAnalysisModel_1.ActiveAnalysisFactory.updateAnalysisStatus(analysis, status, progress, error, metadata);
            this.activeAnalyses.set(analysisId, updatedAnalysis);
            console.log(`[ACTIVE_ANALYSIS_REGISTRY] ✅ Updated analysis ${analysisId} status to ${status}`);
            console.log('[ACTIVE_ANALYSES_REGISTRY] 🔔 Firing onDidChangeAnalyses event');
            this._onDidChangeAnalyses.fire();
        }
        else {
            console.warn(`[ACTIVE_ANALYSIS_REGISTRY] ⚠️ Analysis ${analysisId} not found for update`);
        }
    }
    /**
     * Remove an analysis from the registry
     */
    unregisterAnalysis(analysisId) {
        if (this.activeAnalyses.has(analysisId)) {
            this.activeAnalyses.delete(analysisId);
            console.log(`[ACTIVE_ANALYSIS_REGISTRY] Unregistered analysis: ${analysisId}`);
            this._onDidChangeAnalyses.fire();
        }
        else {
            console.warn(`[ACTIVE_ANALYSIS_REGISTRY] Attempted to unregister non-existent analysis: ${analysisId}`);
        }
    }
    /**
     * Get all active analyses
     */
    getAllAnalyses() {
        return Array.from(this.activeAnalyses.values());
    }
    /**
     * Get a specific analysis by ID
     */
    getAnalysis(analysisId) {
        return this.activeAnalyses.get(analysisId);
    }
    /**
     * Get analyses for a specific file path
     */
    getAnalysesForPath(path) {
        return Array.from(this.activeAnalyses.values()).filter(analysis => analysis.path === path);
    }
    /**
     * Get count of active analyses
     */
    getActiveCount() {
        return Array.from(this.activeAnalyses.values()).filter(analysis => analysis.status === 'running').length;
    }
    /**
     * Get count of completed analyses
     */
    getCompletedCount() {
        return Array.from(this.activeAnalyses.values()).filter(analysis => analysis.status === 'completed').length;
    }
    /**
     * Get the current count of all active analyses (running + completed)
     */
    getActiveAnalysesCount() {
        return this.activeAnalyses.size;
    }
    /**
     * Remove an analysis by its associated file URI
     * This is used when a server is stopped or the user closes the analysis
     */
    unregisterAnalysisByUri(uri) {
        const targetPath = uri.fsPath;
        console.log(`[ACTIVE_ANALYSIS_REGISTRY] 🔍 Looking for analysis with path: ${targetPath}`);
        // Find analysis by matching file path
        let foundAnalysisId = null;
        for (const [id, analysis] of this.activeAnalyses.entries()) {
            if (analysis.path === targetPath) {
                foundAnalysisId = id;
                console.log(`[ACTIVE_ANALYSIS_REGISTRY] ✅ Found matching analysis: ${id}`);
                break;
            }
        }
        if (foundAnalysisId) {
            this.unregisterAnalysis(foundAnalysisId);
            return true;
        }
        else {
            console.warn(`[ACTIVE_ANALYSIS_REGISTRY] ⚠️ No analysis found for URI: ${targetPath}`);
            return false;
        }
    }
    /**
     * Clear all analyses (useful for cleanup)
     */
    clearAll() {
        console.log('[ACTIVE_ANALYSIS_REGISTRY] Clearing all analyses');
        this.activeAnalyses.clear();
        this._onDidChangeAnalyses.fire();
    }
    /**
     * Start tracking a file analysis
     */
    startFileAnalysis(filePath, mode, language) {
        const analysis = activeAnalysisModel_1.ActiveAnalysisFactory.createFileAnalysis(filePath, mode, language);
        this.registerAnalysis(analysis);
        return analysis.id;
    }
    /**
     * Start tracking a directory analysis
     */
    startDirectoryAnalysis(directoryPath, mode) {
        const analysis = activeAnalysisModel_1.ActiveAnalysisFactory.createDirectoryAnalysis(directoryPath, mode);
        this.registerAnalysis(analysis);
        return analysis.id;
    }
    /**
     * Mark analysis as completed
     */
    completeAnalysis(analysisId, metadata) {
        this.updateAnalysis(analysisId, 'completed', 100, undefined, metadata);
    }
    /**
     * Mark analysis as failed
     */
    failAnalysis(analysisId, error) {
        this.updateAnalysis(analysisId, 'failed', undefined, error);
    }
    /**
     * Get summary statistics
     */
    getSummary() {
        const all = this.getAllAnalyses();
        return {
            total: all.length,
            running: all.filter(a => a.status === 'running').length,
            completed: all.filter(a => a.status === 'completed').length,
            failed: all.filter(a => a.status === 'failed').length
        };
    }
}
exports.ActiveAnalysisRegistry = ActiveAnalysisRegistry;


/***/ }),
/* 70 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ActiveAnalysisFactory = void 0;
/**
 * Factory for creating active analysis objects
 */
class ActiveAnalysisFactory {
    /**
     * Create a new active analysis for a file
     */
    static createFileAnalysis(filePath, mode, language) {
        return {
            id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            path: filePath,
            mode,
            timestamp: new Date(),
            status: 'running',
            language,
            progress: 0
        };
    }
    /**
     * Create a new active analysis for a directory
     */
    static createDirectoryAnalysis(directoryPath, mode) {
        return {
            id: `dir-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            path: directoryPath,
            mode,
            timestamp: new Date(),
            status: 'running',
            progress: 0
        };
    }
    /**
     * Update the status of an existing analysis
     */
    static updateAnalysisStatus(analysis, status, progress, error, metadata) {
        return {
            ...analysis,
            status,
            progress,
            error,
            metadata: metadata || analysis.metadata
        };
    }
}
exports.ActiveAnalysisFactory = ActiveAnalysisFactory;


/***/ }),
/* 71 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.registerGeneralCommands = registerGeneralCommands;
const vscode = __importStar(__webpack_require__(1));
const commonCommands_1 = __webpack_require__(72);
/**
 * Register general/common commands used throughout the extension
 */
function registerGeneralCommands(context) {
    console.log('GENERAL_COMMANDS: Registering general commands');
    // Register the main tree refresh command (replaces codexr.servers.refresh)
    const refreshTreeCommand = vscode.commands.registerCommand('codexr.tree.refresh', () => {
        console.log('GENERAL_COMMANDS: Tree refresh command executed');
        commonCommands_1.CommonCommands.refreshTreeView();
    });
    // Register legacy command for backward compatibility
    const legacyRefreshCommand = vscode.commands.registerCommand('codexr.servers.refresh', () => {
        console.log('GENERAL_COMMANDS: Legacy servers refresh command executed, delegating to tree refresh');
        commonCommands_1.CommonCommands.refreshTreeView();
    });
    // Register a general modular tree refresh command
    const modularTreeRefreshCommand = vscode.commands.registerCommand('codeXR.modularTree.refresh', () => {
        console.log('GENERAL_COMMANDS: Modular tree refresh command executed');
        commonCommands_1.CommonCommands.refreshTreeView();
    });
    // Add commands to subscriptions
    context.subscriptions.push(refreshTreeCommand, legacyRefreshCommand, modularTreeRefreshCommand);
    console.log('GENERAL_COMMANDS: Registered 3 general commands (tree refresh, legacy refresh, modular refresh)');
}


/***/ }),
/* 72 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CommonCommands = void 0;
const vscode = __importStar(__webpack_require__(1));
/**
 * Common commands utility for shared functionality across the extension
 */
class CommonCommands {
    static modularTreeProvider;
    /**
     * Set the modular tree provider for refresh operations
     */
    static setModularTreeProvider(provider) {
        this.modularTreeProvider = provider;
        console.log('COMMON_COMMANDS: Modular tree provider set for refresh operations');
    }
    /**
     * Refresh the entire tree view
     * This replaces the legacy 'codexr.servers.refresh' command
     */
    static refreshTreeView() {
        console.log('COMMON_COMMANDS: Refreshing tree view');
        if (this.modularTreeProvider && typeof this.modularTreeProvider.refresh === 'function') {
            this.modularTreeProvider.refresh();
            console.log('COMMON_COMMANDS: Tree view refreshed successfully');
        }
        else {
            console.warn('COMMON_COMMANDS: No modular tree provider available for refresh');
            // Fallback: try to execute any existing refresh commands
            try {
                vscode.commands.executeCommand('codeXR.modularTree.refresh');
            }
            catch (error) {
                console.error('COMMON_COMMANDS: Failed to refresh tree view:', error);
            }
        }
    }
    /**
     * Legacy method for backward compatibility
     * @deprecated Use refreshTreeView() instead
     */
    static refreshServers() {
        console.log('COMMON_COMMANDS: Legacy refresh servers called, delegating to refreshTreeView');
        this.refreshTreeView();
    }
}
exports.CommonCommands = CommonCommands;


/***/ }),
/* 73 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.registerPythonEnvCommands = registerPythonEnvCommands;
exports.getPythonEnvCommands = getPythonEnvCommands;
exports.deactivatePythonEnvCommands = deactivatePythonEnvCommands;
const vscode = __importStar(__webpack_require__(1));
const pythonEnvCommands_1 = __webpack_require__(74);
/**
 * Python Environment Commands Wrapper
 * Re-exports python environment commands for centralized command registration
 */
let pythonEnvCommands;
/**
 * Registers all Python environment related commands
 */
function registerPythonEnvCommands(context) {
    console.log('PYTHON_ENV: Registering Python environment commands...');
    try {
        // Initialize commands
        pythonEnvCommands = new pythonEnvCommands_1.PythonEnvCommands(context);
        pythonEnvCommands.register(context);
        // Initialize environment on startup
        pythonEnvCommands.initializeOnStartup()
            .then(() => {
            console.log('PYTHON_ENV: Commands registration and initialization completed successfully');
        })
            .catch((error) => {
            console.error('PYTHON_ENV: Initialization failed during command registration:', error);
        });
        console.log('PYTHON_ENV: Python environment commands registered successfully');
    }
    catch (error) {
        console.error('PYTHON_ENV: Failed to register Python environment commands:', error);
        vscode.window.showErrorMessage(`Failed to initialize Python environment commands: ${error}`);
    }
}
/**
 * Get the PythonEnvCommands instance for external access
 */
function getPythonEnvCommands() {
    return pythonEnvCommands;
}
/**
 * Clean up resources when extension is deactivated
 */
function deactivatePythonEnvCommands() {
    console.log('PYTHON_ENV: Deactivating Python environment commands');
    pythonEnvCommands = undefined;
}


/***/ }),
/* 74 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PythonEnvCommands = void 0;
const vscode = __importStar(__webpack_require__(1));
const venvManager_1 = __webpack_require__(75);
/**
 * Python environment command registration and handlers
 */
class PythonEnvCommands {
    venvManager;
    constructor(context) {
        this.venvManager = new venvManager_1.VenvManager(context);
        console.log('PYTHON_ENV: Commands module initialized');
    }
    /**
     * Register all Python environment commands
     */
    register(context) {
        console.log('PYTHON_ENV: Registering commands...');
        const commands = [
            vscode.commands.registerCommand('codeXR.pythonEnv.create', () => this.createEnvironment()),
            vscode.commands.registerCommand('codeXR.pythonEnv.delete', () => this.deleteEnvironment()),
            vscode.commands.registerCommand('codeXR.pythonEnv.status', () => this.showStatus()),
            vscode.commands.registerCommand('codeXR.pythonEnv.installPackage', () => this.installPackage()),
            vscode.commands.registerCommand('codeXR.pythonEnv.reinitialize', () => this.reinitializeEnvironment()),
            vscode.commands.registerCommand('codeXR.pythonEnv.verifyLizard', () => this.verifyLizard())
        ];
        commands.forEach(command => context.subscriptions.push(command));
        console.log(`PYTHON_ENV: Registered ${commands.length} commands`);
    }
    /**
     * Initialize the environment (called on extension startup)
     */
    async initializeOnStartup() {
        console.log('PYTHON_ENV: Initializing environment on startup...');
        try {
            await this.venvManager.initializeEnvironment();
            console.log('PYTHON_ENV: Startup initialization completed successfully');
        }
        catch (error) {
            console.error('PYTHON_ENV: Startup initialization failed:', error);
            // Don't show error to user on startup - just log it
        }
    }
    /**
     * Get the VenvManager instance for external use
     */
    getVenvManager() {
        return this.venvManager;
    }
    /**
     * Command handler: Create new environment
     */
    async createEnvironment() {
        console.log('PYTHON_ENV: Create environment command triggered');
        try {
            const status = this.venvManager.getEnvironmentStatus();
            if (status.exists && status.isValid) {
                const result = await vscode.window.showWarningMessage('A Python virtual environment already exists. Do you want to recreate it?', 'Recreate Environment', 'Cancel');
                if (result !== 'Recreate Environment') {
                    return;
                }
                // Delete existing environment first
                await this.venvManager.deleteEnvironment();
            }
            await this.venvManager.createEnvironment();
        }
        catch (error) {
            console.error('PYTHON_ENV: Create environment command failed:', error);
            vscode.window.showErrorMessage(`Failed to create environment: ${error}`);
        }
    }
    /**
     * Command handler: Delete environment
     */
    async deleteEnvironment() {
        console.log('PYTHON_ENV: Delete environment command triggered');
        try {
            const status = this.venvManager.getEnvironmentStatus();
            if (!status.exists) {
                vscode.window.showInformationMessage('No Python virtual environment exists to delete.');
                return;
            }
            await this.venvManager.deleteEnvironment();
        }
        catch (error) {
            console.error('PYTHON_ENV: Delete environment command failed:', error);
            vscode.window.showErrorMessage(`Failed to delete environment: ${error}`);
        }
    }
    /**
     * Command handler: Show environment status
     */
    async showStatus() {
        console.log('PYTHON_ENV: Status command triggered');
        try {
            const status = this.venvManager.getEnvironmentStatus();
            let message = 'Python Virtual Environment Status:\n\n';
            if (!status.exists) {
                message += '❌ No environment exists\n';
                message += 'Use "Create Python Environment" command to set up a new environment.';
            }
            else {
                message += status.isValid ? '✅ Environment is valid and ready\n\n' : '❌ Environment exists but is invalid\n\n';
                if (status.metadata) {
                    message += `📍 Location: ${status.metadata.venvPath}\n`;
                    message += `🐍 Python Version: ${status.metadata.pythonVersion || 'Unknown'}\n`;
                    message += `📅 Created: ${new Date(status.metadata.createdAt).toLocaleString()}\n`;
                    message += `🔄 Last Validated: ${new Date(status.metadata.lastValidated).toLocaleString()}\n`;
                    message += `📦 Installed Packages: ${status.metadata.dependencies.length}\n`;
                }
                if (status.stats.venvSize !== undefined) {
                    message += `💾 Environment Size: ~${status.stats.venvSize} MB\n`;
                }
                // Check lizard availability
                const lizardCommand = this.venvManager.getLizardCommand();
                if (lizardCommand) {
                    message += `🦎 Lizard: Available\n`;
                }
                else {
                    message += `🦎 Lizard: Not available\n`;
                }
                if (!status.isValid) {
                    message += '\n⚠️ Environment is invalid. Consider recreating it.';
                }
            }
            // Show in information message with option to open output channel for details
            const result = await vscode.window.showInformationMessage(message, { modal: true }, 'Show Details');
            if (result === 'Show Details') {
                this.showDetailedStatus(status);
            }
        }
        catch (error) {
            console.error('PYTHON_ENV: Status command failed:', error);
            vscode.window.showErrorMessage(`Failed to get environment status: ${error}`);
        }
    }
    /**
     * Command handler: Install package
     */
    async installPackage() {
        console.log('PYTHON_ENV: Install package command triggered');
        try {
            const status = this.venvManager.getEnvironmentStatus();
            if (!status.exists || !status.isValid) {
                vscode.window.showErrorMessage('No valid Python environment exists. Create one first.');
                return;
            }
            const packageName = await vscode.window.showInputBox({
                prompt: 'Enter the name of the Python package to install',
                placeHolder: 'e.g., numpy, pandas, matplotlib',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Package name cannot be empty';
                    }
                    // Basic validation for package name
                    if (!/^[a-zA-Z0-9\-_.]+$/.test(value.trim())) {
                        return 'Invalid package name. Use letters, numbers, hyphens, underscores, and dots only.';
                    }
                    return null;
                }
            });
            if (!packageName) {
                return;
            }
            await this.venvManager.installPackage(packageName.trim());
        }
        catch (error) {
            console.error('PYTHON_ENV: Install package command failed:', error);
            vscode.window.showErrorMessage(`Failed to install package: ${error}`);
        }
    }
    /**
     * Command handler: Reinitialize environment
     */
    async reinitializeEnvironment() {
        console.log('PYTHON_ENV: Reinitialize environment command triggered');
        try {
            const result = await vscode.window.showInformationMessage('This will validate and potentially recreate the Python environment. Continue?', 'Reinitialize', 'Cancel');
            if (result !== 'Reinitialize') {
                return;
            }
            await this.venvManager.initializeEnvironment();
            vscode.window.showInformationMessage('Python environment reinitialized successfully!');
        }
        catch (error) {
            console.error('PYTHON_ENV: Reinitialize command failed:', error);
            vscode.window.showErrorMessage(`Failed to reinitialize environment: ${error}`);
        }
    }
    /**
     * Command handler: Verify lizard installation
     */
    async verifyLizard() {
        console.log('PYTHON_ENV: Verify lizard command triggered');
        try {
            const status = this.venvManager.getEnvironmentStatus();
            if (!status.exists || !status.isValid) {
                vscode.window.showErrorMessage('No valid Python environment exists. Create one first.');
                return;
            }
            const isLizardWorking = await this.venvManager.verifyLizardInstallation();
            if (isLizardWorking) {
                const lizardCommand = this.venvManager.getLizardCommand();
                vscode.window.showInformationMessage(`Lizard is installed and working correctly!\n\nCommand: ${lizardCommand}`);
            }
            else {
                const result = await vscode.window.showWarningMessage('Lizard is not working correctly. Would you like to reinstall it?', 'Reinstall Lizard', 'Cancel');
                if (result === 'Reinstall Lizard') {
                    await this.venvManager.installPackage('lizard');
                }
            }
        }
        catch (error) {
            console.error('PYTHON_ENV: Verify lizard command failed:', error);
            vscode.window.showErrorMessage(`Failed to verify lizard: ${error}`);
        }
    }
    /**
     * Show detailed status in output channel
     */
    showDetailedStatus(status) {
        const outputChannel = vscode.window.createOutputChannel('Python Environment Details');
        outputChannel.clear();
        outputChannel.appendLine('=== Python Virtual Environment Details ===\n');
        outputChannel.appendLine(`Environment Exists: ${status.exists}`);
        outputChannel.appendLine(`Environment Valid: ${status.isValid}`);
        outputChannel.appendLine(`State File Exists: ${status.stats.stateExists}`);
        outputChannel.appendLine(`Environment Directory Exists: ${status.stats.envExists}`);
        if (status.stats.venvSize !== undefined) {
            outputChannel.appendLine(`Environment Size: ~${status.stats.venvSize} MB`);
        }
        if (status.metadata) {
            outputChannel.appendLine('\n=== Environment Metadata ===');
            outputChannel.appendLine(`Path: ${status.metadata.venvPath}`);
            outputChannel.appendLine(`Python Version: ${status.metadata.pythonVersion || 'Unknown'}`);
            outputChannel.appendLine(`Created At: ${status.metadata.createdAt}`);
            outputChannel.appendLine(`Last Validated: ${status.metadata.lastValidated}`);
            outputChannel.appendLine(`Is Active: ${status.metadata.isActive}`);
            outputChannel.appendLine('\n=== Installed Packages ===');
            if (status.metadata.dependencies.length > 0) {
                status.metadata.dependencies.forEach((dep) => {
                    outputChannel.appendLine(`  ${dep}`);
                });
            }
            else {
                outputChannel.appendLine('  No packages recorded');
            }
        }
        const pythonPath = this.venvManager.getPythonExecutablePath();
        if (pythonPath) {
            outputChannel.appendLine(`\n=== Python Executable ===`);
            outputChannel.appendLine(`Path: ${pythonPath}`);
        }
        outputChannel.show();
    }
}
exports.PythonEnvCommands = PythonEnvCommands;


/***/ }),
/* 75 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VenvManager = void 0;
const vscode = __importStar(__webpack_require__(1));
const cp = __importStar(__webpack_require__(60));
const pythonEnvStorage_1 = __webpack_require__(63);
const pythonEnvUtils_1 = __webpack_require__(64);
/**
 * Core virtual environment management functionality
 */
class VenvManager {
    storage;
    context;
    constructor(context) {
        this.context = context;
        this.storage = new pythonEnvStorage_1.PythonEnvStorage(context);
        console.log('PYTHON_ENV: VenvManager initialized');
    }
    /**
     * Initialize the Python environment on extension startup
     */
    async initializeEnvironment() {
        console.log('PYTHON_ENV: Initializing Python environment...');
        try {
            // Check if environment already exists and is valid
            const metadata = this.storage.loadMetadata();
            const venvExists = this.storage.isVenvValid();
            if (metadata && venvExists) {
                console.log('PYTHON_ENV: Existing valid environment found');
                await this.activateEnvironment();
                // Check if lizard is available and install if missing
                await this.ensureLizardAvailable();
                await this.storage.updateValidation();
                return;
            }
            // Environment doesn't exist or is invalid - create new one
            console.log('PYTHON_ENV: No valid environment found, creating new one...');
            await this.createEnvironment();
        }
        catch (error) {
            console.error('PYTHON_ENV: Failed to initialize environment:', error);
            vscode.window.showErrorMessage(`Failed to initialize Python environment: ${error}`);
        }
    }
    /**
     * Create a new virtual environment
     */
    async createEnvironment() {
        console.log('PYTHON_ENV: Creating new virtual environment...');
        try {
            // Show progress to user
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Creating Python Virtual Environment",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: "Checking Python installation..." });
                // Verify Python is available
                const pythonCommand = pythonEnvUtils_1.PythonEnvUtils.getPythonCommand();
                const pythonVersion = await this.checkPythonVersion(pythonCommand);
                if (!pythonVersion) {
                    throw new Error(`Python not found. Please install Python 3.7+ and ensure '${pythonCommand}' is in your PATH.`);
                }
                progress.report({ increment: 30, message: `Found Python ${pythonVersion}, creating environment...` });
                // Create virtual environment
                const venvPath = this.storage.getVenvPath();
                await this.executeCommand(`${pythonCommand} -m venv "${venvPath}"`);
                progress.report({ increment: 60, message: "Installing base packages..." });
                // Install basic packages
                await this.installBasePackages();
                progress.report({ increment: 90, message: "Saving environment metadata..." });
                // Save metadata
                const metadata = this.storage.createInitialMetadata(pythonVersion);
                await this.storage.saveMetadata(metadata);
                progress.report({ increment: 100, message: "Environment created successfully!" });
            });
            console.log('PYTHON_ENV: Virtual environment created successfully');
            vscode.window.showInformationMessage('Python virtual environment created successfully!');
        }
        catch (error) {
            console.error('PYTHON_ENV: Failed to create environment:', error);
            throw error;
        }
    }
    /**
     * Activate the virtual environment
     */
    async activateEnvironment() {
        try {
            const venvPath = this.storage.getVenvPath();
            if (!pythonEnvUtils_1.PythonEnvUtils.isValidVenv(venvPath)) {
                throw new Error('Virtual environment is not valid');
            }
            console.log(`PYTHON_ENV: Activating environment at ${venvPath}`);
            // Update metadata to mark as active
            const metadata = this.storage.loadMetadata();
            if (metadata) {
                metadata.isActive = true;
                await this.storage.saveMetadata(metadata);
            }
            console.log('PYTHON_ENV: Environment activated successfully');
        }
        catch (error) {
            console.error('PYTHON_ENV: Failed to activate environment:', error);
            throw error;
        }
    }
    /**
     * Delete the virtual environment
     */
    async deleteEnvironment() {
        console.log('PYTHON_ENV: Deleting virtual environment...');
        try {
            const result = await vscode.window.showWarningMessage('Are you sure you want to delete the Python virtual environment? This action cannot be undone.', { modal: true }, 'Delete Environment');
            if (result !== 'Delete Environment') {
                console.log('PYTHON_ENV: Environment deletion cancelled by user');
                return;
            }
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Deleting Python Virtual Environment",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 50, message: "Removing environment files..." });
                await this.storage.deleteEnvironment();
                progress.report({ increment: 100, message: "Environment deleted successfully!" });
            });
            console.log('PYTHON_ENV: Environment deleted successfully');
            vscode.window.showInformationMessage('Python virtual environment deleted successfully!');
        }
        catch (error) {
            console.error('PYTHON_ENV: Failed to delete environment:', error);
            vscode.window.showErrorMessage(`Failed to delete environment: ${error}`);
        }
    }
    /**
     * Install a package in the virtual environment
     */
    async installPackage(packageName) {
        console.log(`PYTHON_ENV: Installing package: ${packageName}`);
        try {
            const venvPath = this.storage.getVenvPath();
            const pipPath = pythonEnvUtils_1.PythonEnvUtils.getVenvPipPath(venvPath);
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Installing ${packageName}`,
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: "Installing package..." });
                await this.executeCommand(`"${pipPath}" install ${packageName}`);
                progress.report({ increment: 80, message: "Updating dependencies list..." });
                // Update dependencies in metadata
                await this.updateDependenciesList();
                progress.report({ increment: 100, message: "Package installed successfully!" });
            });
            console.log(`PYTHON_ENV: Package ${packageName} installed successfully`);
            vscode.window.showInformationMessage(`Package ${packageName} installed successfully!`);
        }
        catch (error) {
            console.error(`PYTHON_ENV: Failed to install package ${packageName}:`, error);
            vscode.window.showErrorMessage(`Failed to install package ${packageName}: ${error}`);
        }
    }
    /**
     * Get environment status information
     */
    getEnvironmentStatus() {
        const metadata = this.storage.loadMetadata();
        const isValid = this.storage.isVenvValid();
        const stats = this.storage.getStorageStats();
        return {
            exists: metadata !== null,
            isValid: isValid,
            metadata: metadata,
            stats: stats
        };
    }
    /**
     * Get the Python executable path for external use
     */
    getPythonExecutablePath() {
        const venvPath = this.storage.getVenvPath();
        if (!pythonEnvUtils_1.PythonEnvUtils.isValidVenv(venvPath)) {
            return null;
        }
        return pythonEnvUtils_1.PythonEnvUtils.getVenvPythonPath(venvPath);
    }
    /**
     * Get the lizard executable command for external use
     */
    getLizardCommand() {
        const pythonPath = this.getPythonExecutablePath();
        if (!pythonPath) {
            return null;
        }
        // Return the command to run lizard using the virtual environment's Python
        return `"${pythonPath}" -m lizard`;
    }
    /**
     * Verify that lizard is working correctly in the environment
     */
    async verifyLizardInstallation() {
        try {
            const pythonPath = this.getPythonExecutablePath();
            if (!pythonPath) {
                return false;
            }
            // Test lizard by running it with --version flag
            await this.executeCommand(`"${pythonPath}" -m lizard --version`);
            return true;
        }
        catch (error) {
            console.log('PYTHON_ENV: Lizard verification failed:', error);
            return false;
        }
    }
    /**
     * Execute a command and return the result
     */
    async executeCommand(command, cwd) {
        return new Promise((resolve, reject) => {
            console.log(`PYTHON_ENV: Executing command: ${command}`);
            const options = {
                cwd: cwd || process.cwd(),
                timeout: 60000, // 60 second timeout
                maxBuffer: 1024 * 1024 // 1MB buffer
            };
            cp.exec(command, options, (error, stdout, stderr) => {
                if (error) {
                    console.error(`PYTHON_ENV: Command failed: ${command}`, error);
                    console.error(`PYTHON_ENV: stderr: ${stderr}`);
                    reject(new Error(`Command failed: ${error.message}`));
                    return;
                }
                console.log(`PYTHON_ENV: Command completed successfully: ${command}`);
                if (stdout) {
                    console.log(`PYTHON_ENV: stdout: ${stdout.trim()}`);
                }
                resolve(stdout.trim());
            });
        });
    }
    /**
     * Check Python version
     */
    async checkPythonVersion(pythonCommand) {
        try {
            const output = await this.executeCommand(`${pythonCommand} --version`);
            const versionMatch = output.match(/Python\s+(\d+\.\d+\.\d+)/);
            return versionMatch ? versionMatch[1] : null;
        }
        catch (error) {
            console.log(`PYTHON_ENV: Could not get Python version with '${pythonCommand}':`, error);
            return null;
        }
    }
    /**
     * Install base packages in the virtual environment
     */
    async installBasePackages() {
        try {
            const venvPath = this.storage.getVenvPath();
            const pipPath = pythonEnvUtils_1.PythonEnvUtils.getVenvPipPath(venvPath);
            // Upgrade pip first
            console.log('PYTHON_ENV: Upgrading pip...');
            await this.executeCommand(`"${pipPath}" install --upgrade pip`);
            // Install essential packages
            const basePackages = [
                'setuptools',
                'wheel',
                'requests' // Common package for HTTP requests
            ];
            for (const pkg of basePackages) {
                console.log(`PYTHON_ENV: Installing ${pkg}...`);
                await this.executeCommand(`"${pipPath}" install ${pkg}`);
            }
            // Install lizard for code complexity analysis
            await this.installLizardPackage();
            // Update dependencies list
            await this.updateDependenciesList();
            console.log('PYTHON_ENV: Base packages installed successfully');
        }
        catch (error) {
            console.error('PYTHON_ENV: Failed to install base packages:', error);
            throw error;
        }
    }
    /**
     * Ensure lizard package is available in the environment
     */
    async ensureLizardAvailable() {
        try {
            console.log('PYTHON_ENV: Checking lizard availability in existing environment...');
            const isInstalled = await this.isPackageInstalled('lizard');
            if (!isInstalled) {
                console.log('PYTHON_ENV: Lizard not found in existing environment, installing...');
                await this.installLizardPackage();
                await this.updateDependenciesList();
            }
            else {
                console.log('PYTHON_ENV: Lizard is already installed in the environment');
            }
        }
        catch (error) {
            console.warn('PYTHON_ENV: Failed to ensure lizard availability:', error);
            // Don't throw - this shouldn't break the environment initialization
        }
    }
    /**
     * Install lizard package for code complexity analysis
     */
    async installLizardPackage() {
        try {
            console.log('PYTHON_ENV: Installing lizard package for code complexity analysis...');
            const venvPath = this.storage.getVenvPath();
            const pythonPath = pythonEnvUtils_1.PythonEnvUtils.getVenvPythonPath(venvPath);
            // Check if lizard is already installed
            const isInstalled = await this.isPackageInstalled('lizard');
            if (isInstalled) {
                console.log('PYTHON_ENV: Lizard is already installed - skipping installation');
                return;
            }
            // Install lizard using the virtual environment's Python interpreter
            console.log('PYTHON_ENV: Installing lizard via pip...');
            await this.executeCommand(`"${pythonPath}" -m pip install lizard`);
            console.log('PYTHON_ENV: Lizard has been installed successfully');
            // Verify installation by testing lizard import
            try {
                const output = await this.executeCommand(`"${pythonPath}" -c "import lizard; print('Lizard version:', lizard.__version__)"`);
                console.log('PYTHON_ENV: Lizard installation verified successfully -', output.trim());
            }
            catch (verifyError) {
                console.warn('PYTHON_ENV: Lizard installation succeeded but verification failed:', verifyError);
            }
        }
        catch (error) {
            console.error('PYTHON_ENV: Failed to install lizard package:', error);
            // Don't throw the error - lizard installation failure shouldn't break the entire environment setup
            console.warn('PYTHON_ENV: Continuing environment setup despite lizard installation failure');
        }
    }
    /**
     * Check if a package is installed in the virtual environment
     */
    async isPackageInstalled(packageName) {
        try {
            const venvPath = this.storage.getVenvPath();
            const pythonPath = pythonEnvUtils_1.PythonEnvUtils.getVenvPythonPath(venvPath);
            // Try to import the package to check if it's installed
            await this.executeCommand(`"${pythonPath}" -c "import ${packageName}"`);
            return true;
        }
        catch (error) {
            // If import fails, package is not installed
            return false;
        }
    }
    /**
     * Update the dependencies list in metadata
     */
    async updateDependenciesList() {
        try {
            const venvPath = this.storage.getVenvPath();
            const pipPath = pythonEnvUtils_1.PythonEnvUtils.getVenvPipPath(venvPath);
            // Get list of installed packages
            const output = await this.executeCommand(`"${pipPath}" list --format=freeze`);
            const dependencies = output.split('\n')
                .filter(line => line.trim() && !line.startsWith('#'))
                .map(line => line.trim());
            await this.storage.updateDependencies(dependencies);
            console.log(`PYTHON_ENV: Dependencies list updated (${dependencies.length} packages)`);
        }
        catch (error) {
            console.error('PYTHON_ENV: Failed to update dependencies list:', error);
        }
    }
}
exports.VenvManager = VenvManager;


/***/ }),
/* 76 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


/**
 * Modular Views Index
 * Central exports for all modular view components
 */
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ModularTreeDataProvider = void 0;
// Main modular tree provider
var ModularTreeDataProvider_1 = __webpack_require__(77);
Object.defineProperty(exports, "ModularTreeDataProvider", ({ enumerable: true, get: function () { return ModularTreeDataProvider_1.ModularTreeDataProvider; } }));
// Common interfaces and utilities
__exportStar(__webpack_require__(78), exports);
__exportStar(__webpack_require__(119), exports);
// Section providers
__exportStar(__webpack_require__(79), exports);
__exportStar(__webpack_require__(83), exports);
__exportStar(__webpack_require__(87), exports);
__exportStar(__webpack_require__(92), exports);
__exportStar(__webpack_require__(98), exports);
__exportStar(__webpack_require__(115), exports);


/***/ }),
/* 77 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ModularTreeDataProvider = void 0;
const vscode = __importStar(__webpack_require__(1));
const baseInterfaces_1 = __webpack_require__(78);
const servers_1 = __webpack_require__(79);
const active_servers_1 = __webpack_require__(83);
const babia_examples_1 = __webpack_require__(87);
const visualize_data_1 = __webpack_require__(92);
const code_analysis_1 = __webpack_require__(98);
const visualization_settings_1 = __webpack_require__(115);
/**
 * Main modular tree data provider that orchestrates all section providers
 */
class ModularTreeDataProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    sectionProviders = new Map();
    constructor(context) {
        this.context = context;
        console.log('MODULAR_TREE: Initializing modular tree data provider');
        // Initialize all section providers
        this.initializeSectionProviders();
    }
    /**
     * Initialize all section providers
     */
    initializeSectionProviders() {
        console.log('MODULAR_TREE: Initializing section providers');
        // Create and register all section providers
        const providers = [
            new servers_1.ServersSectionProvider(this.context),
            new active_servers_1.ActiveServersSectionProvider(this.context),
            new babia_examples_1.BabiaExamplesSectionProvider(this.context),
            new visualize_data_1.VisualizeDataSectionProvider(this.context),
            new code_analysis_1.CodeAnalysisSectionProvider(this.context),
            new visualization_settings_1.VisualizationSettingsSectionProvider(this.context)
        ];
        // Register providers and listen to their changes
        providers.forEach(provider => {
            const sectionName = provider.getSectionName();
            this.sectionProviders.set(sectionName, provider);
            // Listen to provider changes and propagate them
            if (provider.onDidChangeTreeData) {
                provider.onDidChangeTreeData(() => {
                    console.log(`MODULAR_TREE: Section ${sectionName} changed, refreshing tree`);
                    this.refresh();
                });
            }
            console.log(`MODULAR_TREE: Registered section provider: ${sectionName}`);
        });
        console.log(`MODULAR_TREE: Initialized ${providers.length} section providers`);
    }
    /**
     * Get tree item
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Get children
     */
    async getChildren(element) {
        if (!element) {
            // Root level - return section headers
            console.log('MODULAR_TREE: Loading root sections');
            return this.getRootSections();
        }
        // Get children from the appropriate section provider
        return this.getSectionChildren(element);
    }
    /**
     * Get root sections
     */
    getRootSections() {
        const sections = [];
        // Create section headers from each provider
        this.sectionProviders.forEach((provider, sectionName) => {
            try {
                const sectionItem = provider.getSectionItem();
                // Convert to ModularTreeItem
                const modularItem = new baseInterfaces_1.ModularTreeItem(typeof sectionItem.label === 'string' ? sectionItem.label : sectionItem.label?.label || sectionName.toUpperCase(), sectionItem.collapsibleState || vscode.TreeItemCollapsibleState.Collapsed, sectionName, 'section', sectionItem.command, sectionItem.iconPath, sectionItem.tooltip, sectionItem.description, sectionItem.contextValue);
                sections.push(modularItem);
            }
            catch (error) {
                console.error(`MODULAR_TREE: Error creating section header for ${sectionName}:`, error);
                // Create error section
                sections.push(new baseInterfaces_1.ModularTreeItem(`${sectionName.toUpperCase()} (Error)`, vscode.TreeItemCollapsibleState.None, sectionName, 'error', undefined, new vscode.ThemeIcon('error'), `Error loading ${sectionName} section`));
            }
        });
        console.log(`MODULAR_TREE: Created ${sections.length} root sections`);
        return sections;
    }
    /**
     * Get children for a specific section
     */
    async getSectionChildren(element) {
        const sectionName = element.sectionType;
        const provider = this.sectionProviders.get(sectionName);
        if (!provider) {
            console.error(`MODULAR_TREE: No provider found for section: ${sectionName}`);
            return [];
        }
        try {
            console.log(`MODULAR_TREE: Getting children for section: ${sectionName}`);
            // Convert ModularTreeItem back to the section-specific item type
            let sectionElement = undefined;
            if (element.itemType !== 'section') {
                // Create a section-specific item with the preserved properties
                sectionElement = this.convertToSectionItem(element);
            }
            // Get children from the section provider
            const sectionChildren = await provider.getChildren(sectionElement);
            // Convert to ModularTreeItems
            const modularChildren = sectionChildren.map((child) => {
                // Preserve the original item properties for proper delegation
                const modularItem = new baseInterfaces_1.ModularTreeItem(typeof child.label === 'string' ? child.label : child.label?.label || 'Unknown', child.collapsibleState || vscode.TreeItemCollapsibleState.None, sectionName, child.serverItemType || child.activeServerItemType || child.babiaItemType || child.visualizeDataItemType || child.codeAnalysisItemType || child.visualizationSettingsItemType || child.type || 'item', child.command, child.iconPath, child.tooltip, child.description, child.contextValue);
                // Copy over section-specific properties
                if (child.serverItemType) {
                    modularItem.serverItemType = child.serverItemType;
                }
                if (child.activeServerItemType) {
                    modularItem.activeServerItemType = child.activeServerItemType;
                    modularItem.activeServer = child.activeServer;
                }
                if (child.babiaItemType) {
                    modularItem.babiaItemType = child.babiaItemType;
                    modularItem.babiaExample = child.babiaExample;
                }
                if (child.visualizeDataItemType) {
                    modularItem.visualizeDataItemType = child.visualizeDataItemType;
                    modularItem.visualizeDataItem = child.visualizeDataItem;
                }
                if (child.codeAnalysisItemType) {
                    modularItem.codeAnalysisItemType = child.codeAnalysisItemType;
                    modularItem.originalCodeAnalysisItem = child.originalCodeAnalysisItem;
                }
                if (child.visualizationSettingsItemType) {
                    modularItem.visualizationSettingsItemType = child.visualizationSettingsItemType;
                    modularItem.originalSettingsItem = child.originalSettingsItem;
                }
                return modularItem;
            });
            console.log(`MODULAR_TREE: Retrieved ${modularChildren.length} children for section: ${sectionName}`);
            return modularChildren;
        }
        catch (error) {
            console.error(`MODULAR_TREE: Error getting children for section ${sectionName}:`, error);
            return [new baseInterfaces_1.ModularTreeItem('Error loading items', vscode.TreeItemCollapsibleState.None, sectionName, 'error', undefined, new vscode.ThemeIcon('error'), `Failed to load ${sectionName} items`)];
        }
    }
    /**
     * Convert ModularTreeItem back to section-specific item type
     */
    convertToSectionItem(element) {
        const sectionName = element.sectionType;
        // Create section-specific items based on section type
        switch (sectionName) {
            case 'SERVERS':
                // Import and create ServerTreeItem
                const { ServerTreeItem } = __webpack_require__(81);
                const serverItem = new ServerTreeItem(typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown', element.collapsibleState || vscode.TreeItemCollapsibleState.None, element.serverItemType || 'config-option', element.command, element.iconPath, element.tooltip, element.description, element.contextValue);
                return serverItem;
            case 'activeServers':
                // Import and create ActiveServerTreeItem
                const { ActiveServerTreeItem } = __webpack_require__(85);
                const activeServerItem = new ActiveServerTreeItem(typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown', element.collapsibleState || vscode.TreeItemCollapsibleState.None, element.activeServerItemType || 'server-item', element.command, element.iconPath, element.tooltip, element.description, element.contextValue, element.activeServer);
                return activeServerItem;
            case 'babiaExamples':
                // Import and create BabiaExampleTreeItem
                const { BabiaExampleTreeItem } = __webpack_require__(89);
                const babiaItem = new BabiaExampleTreeItem(typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown', element.collapsibleState || vscode.TreeItemCollapsibleState.None, element.babiaItemType || 'example-item', element.command, element.iconPath, element.tooltip, element.description, element.contextValue, element.babiaExample);
                return babiaItem;
            case 'visualizeData':
                // Import and create VisualizeDataModularTreeItem
                const { VisualizeDataModularTreeItem } = __webpack_require__(94);
                const visualizeItem = new VisualizeDataModularTreeItem(typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown', element.collapsibleState || vscode.TreeItemCollapsibleState.None, element.visualizeDataItemType || 'error', element.command, element.iconPath, element.tooltip, element.description, element.contextValue, element.visualizeDataItem);
                return visualizeItem;
            case 'codeAnalysis':
                // Import and create CodeAnalysisModularTreeItem
                const { CodeAnalysisModularTreeItem } = __webpack_require__(100);
                const codeAnalysisItem = new CodeAnalysisModularTreeItem(typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown', element.collapsibleState || vscode.TreeItemCollapsibleState.None, element.codeAnalysisItemType || 'error', element.command, element.iconPath, element.tooltip, element.description, element.contextValue, element.originalCodeAnalysisItem);
                return codeAnalysisItem;
            case 'visualizationSettings':
                // Import and create VisualizationSettingsModularTreeItem
                const { VisualizationSettingsModularTreeItem } = __webpack_require__(117);
                const settingsItem = new VisualizationSettingsModularTreeItem(typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown', element.collapsibleState || vscode.TreeItemCollapsibleState.None, element.visualizationSettingsItemType || 'error', element.command, element.iconPath, element.tooltip, element.description, element.contextValue, element.originalSettingsItem);
                return settingsItem;
            default:
                // Return the element as-is for other sections
                return element;
        }
    }
    /**
     * Refresh the tree
     */
    refresh() {
        console.log('MODULAR_TREE: Refreshing modular tree');
        this._onDidChangeTreeData.fire();
    }
    /**
     * Get section provider by name
     */
    getSectionProvider(sectionName) {
        return this.sectionProviders.get(sectionName);
    }
    /**
     * Handle clicks on items
     */
    async handleItemClick(item) {
        const sectionName = item.sectionType;
        const provider = this.sectionProviders.get(sectionName);
        if (provider && typeof provider.handleClick === 'function') {
            console.log(`MODULAR_TREE: Delegating click to section provider: ${sectionName}`);
            // Convert back to section-specific item for proper handling
            const sectionItem = this.convertToSectionItem(item);
            await provider.handleClick(sectionItem);
        }
        else {
            console.log(`MODULAR_TREE: No click handler for section: ${sectionName}`);
        }
    }
    /**
     * Handle context menu actions
     */
    async handleContextMenu(action, item) {
        const sectionName = item.sectionType;
        const provider = this.sectionProviders.get(sectionName);
        if (provider && typeof provider.handleContextMenu === 'function') {
            console.log(`MODULAR_TREE: Delegating context menu to section provider: ${sectionName}`);
            // Convert back to section-specific item for proper handling
            const sectionItem = this.convertToSectionItem(item);
            await provider.handleContextMenu(action, sectionItem);
        }
        else {
            console.log(`MODULAR_TREE: No context menu handler for section: ${sectionName}`);
        }
    }
}
exports.ModularTreeDataProvider = ModularTreeDataProvider;


/***/ }),
/* 78 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TreeViewUtils = exports.ModularTreeItem = void 0;
const vscode = __importStar(__webpack_require__(1));
/**
 * Base tree item for modular sections
 */
class ModularTreeItem extends vscode.TreeItem {
    sectionType;
    itemType;
    // Server-specific properties for compatibility
    serverItemType;
    // Active Server-specific properties for compatibility
    activeServerItemType;
    activeServer;
    // Babia Examples-specific properties for compatibility
    babiaItemType;
    babiaExample;
    // Visualize Data-specific properties for compatibility
    visualizeDataItemType;
    visualizeDataItem;
    // Code Analysis-specific properties for compatibility
    codeAnalysisItemType;
    originalCodeAnalysisItem;
    // Visualization Settings-specific properties for compatibility
    visualizationSettingsItemType;
    originalSettingsItem;
    constructor(label, collapsibleState, sectionType, itemType, command, iconPath, tooltip, description, contextValue) {
        super(label, collapsibleState);
        this.sectionType = sectionType;
        this.itemType = itemType;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip || label;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.ModularTreeItem = ModularTreeItem;
/**
 * Common tree view utilities
 */
class TreeViewUtils {
    /**
     * Create a standard error item
     */
    static createErrorItem(message, sectionType) {
        return new ModularTreeItem(message, vscode.TreeItemCollapsibleState.None, sectionType, 'error', undefined, new vscode.ThemeIcon('error'), `Error: ${message}`, 'Error');
    }
    /**
     * Create a standard loading item
     */
    static createLoadingItem(message, sectionType) {
        return new ModularTreeItem(message, vscode.TreeItemCollapsibleState.None, sectionType, 'loading', undefined, new vscode.ThemeIcon('loading~spin'), `Loading: ${message}`, 'Loading...');
    }
    /**
     * Create a standard info item
     */
    static createInfoItem(message, sectionType) {
        return new ModularTreeItem(message, vscode.TreeItemCollapsibleState.None, sectionType, 'info', undefined, new vscode.ThemeIcon('info'), message);
    }
}
exports.TreeViewUtils = TreeViewUtils;


/***/ }),
/* 79 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


/**
 * Servers View Module
 * Exports for the modular Servers section
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ServerClickHandler = exports.ServerItemFactory = exports.ServerTreeItem = exports.ServersSectionProvider = void 0;
// Section Provider
var ServersSectionProvider_1 = __webpack_require__(80);
Object.defineProperty(exports, "ServersSectionProvider", ({ enumerable: true, get: function () { return ServersSectionProvider_1.ServersSectionProvider; } }));
// Items
var serverItems_1 = __webpack_require__(81);
Object.defineProperty(exports, "ServerTreeItem", ({ enumerable: true, get: function () { return serverItems_1.ServerTreeItem; } }));
Object.defineProperty(exports, "ServerItemFactory", ({ enumerable: true, get: function () { return serverItems_1.ServerItemFactory; } }));
// Interactions
var handleServerClicks_1 = __webpack_require__(82);
Object.defineProperty(exports, "ServerClickHandler", ({ enumerable: true, get: function () { return handleServerClicks_1.ServerClickHandler; } }));


/***/ }),
/* 80 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ServersSectionProvider = void 0;
const vscode = __importStar(__webpack_require__(1));
const serverItems_1 = __webpack_require__(81);
const handleServerClicks_1 = __webpack_require__(82);
const serverSettingsManager_1 = __webpack_require__(11);
/**
 * Servers section provider for the modular tree view architecture
 */
class ServersSectionProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    constructor(context) {
        this.context = context;
        console.log('SERVERS: Servers section provider initialized');
    }
    /**
     * Get the main section item
     */
    getSectionItem() {
        console.log('SERVERS: Creating main SERVERS section item');
        return new serverItems_1.ServerTreeItem('SERVERS', vscode.TreeItemCollapsibleState.Expanded, 'config-group', undefined, new vscode.ThemeIcon('server-environment'), 'Server configuration and launch options');
    }
    /**
     * Get children for the servers section
     */
    async getChildren(element) {
        if (!element) {
            // Return main section children
            console.log('SERVERS: Loading main servers section children');
            return this.getMainSectionChildren();
        }
        // Handle sub-items based on type
        switch (element.serverItemType) {
            case 'config-group':
                if (element.label === 'Server Configuration') {
                    return this.getConfigurationChildren();
                }
                break;
            default:
                return [];
        }
        return [];
    }
    /**
     * Get main section children
     */
    getMainSectionChildren() {
        console.log('SERVERS: Creating main section children');
        // Get current server configuration for the start server option
        const port = this.getServerPort();
        const httpMode = this.getHttpMode();
        return [
            serverItems_1.ServerItemFactory.createConfigurationGroup(),
            serverItems_1.ServerItemFactory.createStartServerOption(port, httpMode)
        ];
    }
    /**
     * Get configuration children
     */
    getConfigurationChildren() {
        console.log('SERVERS: Creating configuration children');
        return serverItems_1.ServerItemFactory.createConfigurationOptions();
    }
    /**
     * Get current server port from configuration
     */
    getServerPort() {
        const config = serverSettingsManager_1.ServerSettingsManager.getInstance().getLegacyConfig();
        return config.port;
    }
    /**
     * Get current HTTP mode from configuration
     */
    getHttpMode() {
        const config = serverSettingsManager_1.ServerSettingsManager.getInstance().getLegacyConfig();
        return config.httpMode;
    }
    /**
     * Refresh the section
     */
    refresh() {
        console.log('SERVERS: Refreshing servers section');
        this._onDidChangeTreeData.fire();
    }
    /**
     * Get section name
     */
    getSectionName() {
        return 'SERVERS';
    }
    /**
     * Handle tree item clicks
     */
    async handleItemClick(item) {
        console.log(`SERVERS: Item clicked: ${item.label} (type: ${item.serverItemType})`);
        switch (item.serverItemType) {
            case 'config-group':
                await handleServerClicks_1.ServerClickHandler.handleConfigGroupClick(item);
                break;
            case 'launch-option':
                await handleServerClicks_1.ServerClickHandler.handleLaunchServerClick();
                break;
            case 'config-option':
                const labelStr = typeof item.label === 'string' ? item.label : item.label?.label || '';
                const optionType = this.getConfigOptionType(labelStr);
                await handleServerClicks_1.ServerClickHandler.handleConfigOptionClick(optionType);
                break;
        }
    }
    /**
     * Determine configuration option type from label
     */
    getConfigOptionType(label) {
        if (label.includes('HTTP Mode')) {
            return 'httpMode';
        }
        if (label.includes('Port')) {
            return 'port';
        }
        if (label.includes('Auto-Open')) {
            return 'autoOpen';
        }
        if (label.includes('Open Mode')) {
            return 'openMode';
        }
        if (label.includes('Reset')) {
            return 'reset';
        }
        return 'unknown';
    }
}
exports.ServersSectionProvider = ServersSectionProvider;


/***/ }),
/* 81 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ServerItemFactory = exports.ServerTreeItem = void 0;
const vscode = __importStar(__webpack_require__(1));
const serverSettingsManager_1 = __webpack_require__(11);
/**
 * Get current server configuration for dynamic item creation
 */
function getServerConfig() {
    return serverSettingsManager_1.ServerSettingsManager.getInstance().getLegacyConfig();
}
/**
 * Server tree items for the Servers section
 */
class ServerTreeItem extends vscode.TreeItem {
    serverItemType;
    constructor(label, collapsibleState, serverItemType, command, iconPath, tooltip, description, contextValue) {
        super(label, collapsibleState);
        this.serverItemType = serverItemType;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip || label;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.ServerTreeItem = ServerTreeItem;
/**
 * Factory for creating server-related tree items
 */
class ServerItemFactory {
    /**
     * Create server configuration group item
     */
    static createConfigurationGroup() {
        console.log('SERVERS: Creating Server Configuration group item');
        return new ServerTreeItem('Server Configuration', vscode.TreeItemCollapsibleState.Collapsed, 'config-group', undefined, new vscode.ThemeIcon('settings-gear'), 'Configure server settings');
    }
    /**
     * Create start server option item
     */
    static createStartServerOption(port, httpMode) {
        console.log(`SERVERS: Creating Start Local Server option for port ${port} (${httpMode})`);
        return new ServerTreeItem('Start Local Server', vscode.TreeItemCollapsibleState.None, 'launch-option', {
            command: 'codexr.server.launch',
            title: 'Start Local Server'
        }, new vscode.ThemeIcon('play'), `Start server on port ${port} (${httpMode})`);
    }
    /**
     * Create configuration option items
     */
    static createConfigurationOptions() {
        console.log('SERVERS: Creating server configuration option items');
        const config = getServerConfig();
        return [
            new ServerTreeItem(`HTTP Mode: ${config.httpMode}`, vscode.TreeItemCollapsibleState.None, 'config-option', {
                command: 'codexr.server.config.httpMode',
                title: 'Configure HTTP Mode'
            }, new vscode.ThemeIcon(config.httpMode === 'HTTP' ? 'unlock' : 'lock'), `Click to change server mode (currently: ${config.httpMode})`),
            new ServerTreeItem(`Default Port: ${config.port}`, vscode.TreeItemCollapsibleState.None, 'config-option', {
                command: 'codexr.server.config.port',
                title: 'Configure Port'
            }, new vscode.ThemeIcon('symbol-numeric'), `Click to change default port (currently: ${config.port})`),
            new ServerTreeItem(`Auto-Open: ${config.autoOpen ? 'Enabled' : 'Disabled'}`, vscode.TreeItemCollapsibleState.None, 'config-option', {
                command: 'codexr.server.config.autoOpen',
                title: 'Toggle Auto-Open'
            }, new vscode.ThemeIcon(config.autoOpen ? 'check' : 'x'), `Click to toggle auto-open (currently: ${config.autoOpen ? 'enabled' : 'disabled'})`),
            new ServerTreeItem(`Open Mode: ${config.openMode}`, vscode.TreeItemCollapsibleState.None, 'config-option', {
                command: 'codexr.server.config.openMode',
                title: 'Configure Open Mode'
            }, new vscode.ThemeIcon('window'), `Click to change open mode (currently: ${config.openMode})`),
            new ServerTreeItem('Reset to Default', vscode.TreeItemCollapsibleState.None, 'config-option', {
                command: 'codexr.server.config.resetToDefault',
                title: 'Reset to Default Settings'
            }, new vscode.ThemeIcon('refresh'), 'Reset all server configuration to default values')
        ];
    }
}
exports.ServerItemFactory = ServerItemFactory;


/***/ }),
/* 82 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ServerClickHandler = void 0;
const vscode = __importStar(__webpack_require__(1));
/**
 * Handle server-related click interactions
 */
class ServerClickHandler {
    /**
     * Handle configuration group expansion
     */
    static async handleConfigGroupClick(item) {
        console.log('SERVERS: Configuration group clicked, expanding...');
        // Configuration groups are handled automatically by tree expansion
        // Additional logic can be added here if needed
    }
    /**
     * Handle server launch option click
     */
    static async handleLaunchServerClick() {
        console.log('SERVERS: Start Local Server clicked');
        try {
            // Execute the server launch command
            await vscode.commands.executeCommand('codexr.server.launch');
            console.log('SERVERS: Server launch command executed successfully');
        }
        catch (error) {
            console.error('SERVERS: Error launching server:', error);
            vscode.window.showErrorMessage(`Failed to launch server: ${error}`);
        }
    }
    /**
     * Handle configuration option clicks
     */
    static async handleConfigOptionClick(optionType) {
        console.log(`SERVERS: Configuration option clicked: ${optionType}`);
        switch (optionType) {
            case 'http':
            case 'httpMode':
                await vscode.commands.executeCommand('codexr.server.config.httpMode');
                break;
            case 'port':
                await vscode.commands.executeCommand('codexr.server.config.port');
                break;
            case 'autoOpen':
                await vscode.commands.executeCommand('codexr.server.config.autoOpen');
                break;
            case 'openMode':
                await vscode.commands.executeCommand('codexr.server.config.openMode');
                break;
            case 'reset':
                await vscode.commands.executeCommand('codexr.server.config.resetToDefault');
                break;
            default:
                console.warn(`SERVERS: Unknown configuration option: ${optionType}`);
        }
    }
}
exports.ServerClickHandler = ServerClickHandler;


/***/ }),
/* 83 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


/**
 * Active Servers View Module
 * Exports for the modular Active Servers section
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ActiveServerClickHandler = exports.ActiveServerItemFactory = exports.ActiveServerTreeItem = exports.ActiveServersSectionProvider = void 0;
// Section Provider
var ActiveServersSectionProvider_1 = __webpack_require__(84);
Object.defineProperty(exports, "ActiveServersSectionProvider", ({ enumerable: true, get: function () { return ActiveServersSectionProvider_1.ActiveServersSectionProvider; } }));
// Items
var activeServerItems_1 = __webpack_require__(85);
Object.defineProperty(exports, "ActiveServerTreeItem", ({ enumerable: true, get: function () { return activeServerItems_1.ActiveServerTreeItem; } }));
Object.defineProperty(exports, "ActiveServerItemFactory", ({ enumerable: true, get: function () { return activeServerItems_1.ActiveServerItemFactory; } }));
// Interactions
var handleActiveServerClicks_1 = __webpack_require__(86);
Object.defineProperty(exports, "ActiveServerClickHandler", ({ enumerable: true, get: function () { return handleActiveServerClicks_1.ActiveServerClickHandler; } }));


/***/ }),
/* 84 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ActiveServersSectionProvider = void 0;
const vscode = __importStar(__webpack_require__(1));
const activeServerItems_1 = __webpack_require__(85);
const handleActiveServerClicks_1 = __webpack_require__(86);
const activeServerRegistry_1 = __webpack_require__(17);
/**
 * Active Servers section provider - manages running servers display and control
 */
class ActiveServersSectionProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    clickHandler;
    constructor(context) {
        this.context = context;
        console.log('ACTIVE_SERVERS_MODULAR: Initializing Active Servers section provider');
        this.clickHandler = new handleActiveServerClicks_1.ActiveServerClickHandler(context);
        // Listen to registry changes for active servers
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        console.log(`ACTIVE_SERVERS_MODULAR: Connected to active server registry, current servers: ${registry.getAllServers().length}`);
        registry.onRegistryChange(() => {
            console.log('ACTIVE_SERVERS_MODULAR: Active servers registry changed, refreshing section');
            this.refresh();
        });
    }
    /**
     * Get the section name for identification
     */
    getSectionName() {
        return 'activeServers';
    }
    /**
     * Get the section header item
     */
    getSectionItem() {
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const activeServers = registry.getAllServers();
        const runningCount = activeServers.filter(server => server.status === 'running').length;
        const title = runningCount > 0
            ? `ACTIVE SERVERS (${runningCount} running)`
            : 'ACTIVE SERVERS';
        return new activeServerItems_1.ActiveServerTreeItem(title, vscode.TreeItemCollapsibleState.Expanded, 'no-servers', // Using this as section header type
        undefined, new vscode.ThemeIcon('server-process'), 'Currently running servers', undefined, 'activeServersSection');
    }
    /**
     * Get children items for the Active Servers section
     */
    async getChildren(element) {
        // If element is provided, it means we're getting children for a specific item
        // For the Active Servers section, we only have flat items, so return empty for sub-items
        if (element) {
            return [];
        }
        console.log('ACTIVE_SERVERS_MODULAR: Loading active servers section children');
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const activeServers = registry.getAllServers();
        const runningServers = activeServers.filter(server => server.status === 'running');
        console.log(`ACTIVE_SERVERS_MODULAR: Found ${activeServers.length} total servers, ${runningServers.length} running`);
        // Show "No active servers" message if no servers exist
        if (activeServers.length === 0) {
            console.log('ACTIVE_SERVERS_MODULAR: No servers found, showing "No active servers" message');
            return [activeServerItems_1.ActiveServerItemFactory.createNoServersItem()];
        }
        const children = [];
        // Add "Stop All Servers" option if there are 2 or more running servers
        if (runningServers.length >= 2) {
            console.log(`ACTIVE_SERVERS_MODULAR: Adding "Stop All Servers" option for ${runningServers.length} running servers`);
            children.push(activeServerItems_1.ActiveServerItemFactory.createStopAllServersItem(runningServers.length));
        }
        // Add individual server items
        console.log(`ACTIVE_SERVERS_MODULAR: Creating ${activeServers.length} individual server items`);
        const serverItems = activeServers.map(server => activeServerItems_1.ActiveServerItemFactory.createServerItem(server));
        children.push(...serverItems);
        console.log(`ACTIVE_SERVERS_MODULAR: Returning ${children.length} children for Active Servers section`);
        return children;
    }
    /**
     * Refresh the section
     */
    refresh() {
        console.log('ACTIVE_SERVERS_MODULAR: Refreshing Active Servers section');
        this._onDidChangeTreeData.fire();
    }
    /**
     * Handle item clicks (additional method for interaction)
     */
    async handleClick(item) {
        await this.clickHandler.handleActiveServerClick(item);
    }
    /**
     * Handle context menu actions (additional method for interaction)
     */
    async handleContextMenu(action, item) {
        await this.clickHandler.handleContextMenuAction(action, item);
    }
}
exports.ActiveServersSectionProvider = ActiveServersSectionProvider;


/***/ }),
/* 85 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ActiveServerItemFactory = exports.ActiveServerTreeItem = void 0;
const vscode = __importStar(__webpack_require__(1));
/**
 * Active Server tree items for the Active Servers section
 */
class ActiveServerTreeItem extends vscode.TreeItem {
    activeServerItemType;
    activeServer;
    constructor(label, collapsibleState, activeServerItemType, command, iconPath, tooltip, description, contextValue, activeServer) {
        super(label, collapsibleState);
        this.activeServerItemType = activeServerItemType;
        this.activeServer = activeServer;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip || label;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.ActiveServerTreeItem = ActiveServerTreeItem;
/**
 * Factory for creating active server-related tree items
 */
class ActiveServerItemFactory {
    /**
     * Create "No active servers" message item
     */
    static createNoServersItem() {
        console.log('ACTIVE_SERVERS: Creating "No active servers" message item');
        return new ActiveServerTreeItem('No active servers', vscode.TreeItemCollapsibleState.None, 'no-servers', undefined, new vscode.ThemeIcon('info'), 'No servers are currently running');
    }
    /**
     * Create "Stop All Servers" control option
     */
    static createStopAllServersItem(runningCount) {
        console.log(`ACTIVE_SERVERS: Creating "Stop All Servers" option for ${runningCount} running servers`);
        return new ActiveServerTreeItem('Stop All Servers', vscode.TreeItemCollapsibleState.None, 'control-option', {
            command: 'codeXR.activeServers.stopAllServers',
            title: 'Stop All Servers'
        }, new vscode.ThemeIcon('stop-circle'), `Stop all ${runningCount} running servers`, undefined, 'stopAllServers');
    }
    /**
     * Create individual active server item
     */
    static createServerItem(server) {
        // Use custom name if provided, otherwise fallback to localhost:port
        const label = server.customName?.trim() || `localhost:${server.port}`;
        console.log(`ACTIVE_SERVERS: Creating server item with label: "${label}" (customName: "${server.customName}", port: ${server.port})`);
        const description = ActiveServerItemFactory.getServerDescription(server);
        const icon = ActiveServerItemFactory.getServerIcon(server);
        const tooltip = ActiveServerItemFactory.getServerTooltip(server);
        console.log(`ACTIVE_SERVERS: Creating server item: ${label} (${description})`);
        // Create command to show server actions on left-click
        const command = {
            command: 'codeXR.activeServers.showActions',
            title: 'Show Server Actions',
            arguments: [server.id]
        };
        // Set context value based on certificate mode for conditional menu items
        const contextValue = server.certMode === 'http' ? 'activeServerHttp' : 'activeServerHttps';
        return new ActiveServerTreeItem(label, vscode.TreeItemCollapsibleState.None, 'server-item', command, icon, tooltip, description, contextValue, server);
    }
    /**
     * Get server description based on launch mode
     * @private
     */
    static getServerDescription(server) {
        const mode = server.launchMode === 'browser' ? 'Browser' : 'Panel';
        const status = server.status === 'running' ? '' : ` (${server.status})`;
        return `${mode}${status}`;
    }
    /**
     * Get server icon based on certificate mode and status
     * @private
     */
    static getServerIcon(server) {
        // Base icon selection based on cert mode
        let iconName;
        switch (server.certMode) {
            case 'https-default':
            case 'https-custom':
                iconName = 'shield';
                break;
            case 'http':
            default:
                iconName = 'globe';
                break;
        }
        // Add status indicator if not running
        if (server.status !== 'running') {
            iconName = 'error';
        }
        return new vscode.ThemeIcon(iconName);
    }
    /**
     * Get server tooltip with detailed information
     * @private
     */
    static getServerTooltip(server) {
        const protocol = server.certMode === 'http' ? 'HTTP' : 'HTTPS';
        const mode = server.launchMode === 'browser' ? 'Browser' : 'Panel';
        const status = server.status.charAt(0).toUpperCase() + server.status.slice(1);
        let tooltip = `${protocol} Server (${status})
URL: ${server.url}
Mode: ${mode}
Port: ${server.port}`;
        if (server.htmlFile) {
            const fileName = (__webpack_require__(5).basename)(server.htmlFile);
            tooltip += `\nFile: ${fileName}`;
        }
        if (server.metadata) {
            const metadata = server.metadata; // Type assertion for dynamic metadata
            if (metadata.serverType) {
                tooltip += `\nType: ${metadata.serverType}`;
            }
            if (metadata.portChanged) {
                tooltip += `\nOriginal port was in use`;
            }
            if (metadata.httpsOverridden) {
                tooltip += `\nHTTPS overridden for panel mode`;
            }
        }
        tooltip += `\n\nClick to show details`;
        return tooltip;
    }
}
exports.ActiveServerItemFactory = ActiveServerItemFactory;


/***/ }),
/* 86 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ActiveServerClickHandler = void 0;
const handleServerActions_1 = __webpack_require__(18);
/**
 * Handler for Active Server section interactions
 */
class ActiveServerClickHandler {
    context;
    constructor(context) {
        this.context = context;
    }
    /**
     * Handle clicks on active server items
     */
    async handleActiveServerClick(item) {
        console.log(`ACTIVE_SERVERS_MODULAR: Handling click on active server item: ${item.label} (type: ${item.activeServerItemType})`);
        switch (item.activeServerItemType) {
            case 'server-item':
                await this.handleServerItemClick(item);
                break;
            case 'control-option':
                await this.handleControlOptionClick(item);
                break;
            case 'no-servers':
                // No action needed for informational item
                console.log('ACTIVE_SERVERS_MODULAR: Clicked on "No active servers" info item');
                break;
            default:
                console.warn(`ACTIVE_SERVERS_MODULAR: Unknown active server item type: ${item.activeServerItemType}`);
        }
    }
    /**
     * Handle click on individual server item
     */
    async handleServerItemClick(item) {
        if (!item.activeServer) {
            console.error('ACTIVE_SERVERS_MODULAR: No active server data in server item');
            return;
        }
        console.log(`ACTIVE_SERVERS_MODULAR: Handling server item click for server: ${item.activeServer.id}`);
        // Delegate to existing server actions handler
        await handleServerActions_1.ServerActionHandlers.showServerActions(item.activeServer.id);
    }
    /**
     * Handle click on control options (like "Stop All Servers")
     */
    async handleControlOptionClick(item) {
        console.log(`ACTIVE_SERVERS_MODULAR: Handling control option click: ${item.label}`);
        if (item.contextValue === 'stopAllServers') {
            await this.handleStopAllServers();
        }
        else {
            console.warn(`ACTIVE_SERVERS_MODULAR: Unknown control option: ${item.contextValue}`);
        }
    }
    /**
     * Handle "Stop All Servers" action
     */
    async handleStopAllServers() {
        console.log('ACTIVE_SERVERS_MODULAR: Handling stop all servers action');
        // Delegate to existing stop all servers handler
        await handleServerActions_1.ServerActionHandlers.stopAllServers();
    }
    /**
     * Handle right-click context menu actions
     */
    async handleContextMenuAction(action, item) {
        console.log(`ACTIVE_SERVERS_MODULAR: Handling context menu action: ${action} on item: ${item.label}`);
        switch (action) {
            case 'refresh':
                console.log('ACTIVE_SERVERS_MODULAR: Refreshing active servers view');
                await handleServerActions_1.ServerActionHandlers.refreshServers();
                break;
            case 'stopServer':
                if (item.activeServer) {
                    console.log(`ACTIVE_SERVERS_MODULAR: Stopping server: ${item.activeServer.id}`);
                    await handleServerActions_1.ServerActionHandlers.stopServer(item.activeServer.id);
                }
                break;
            case 'openBrowser':
                if (item.activeServer) {
                    console.log(`ACTIVE_SERVERS_MODULAR: Opening server in browser: ${item.activeServer.id}`);
                    await handleServerActions_1.ServerActionHandlers.openInBrowser(item.activeServer.id);
                }
                break;
            case 'openPanel':
                if (item.activeServer) {
                    console.log(`ACTIVE_SERVERS_MODULAR: Opening server in panel: ${item.activeServer.id}`);
                    await handleServerActions_1.ServerActionHandlers.openInPanel(item.activeServer.id);
                }
                break;
            case 'copyUrl':
                if (item.activeServer) {
                    console.log(`ACTIVE_SERVERS_MODULAR: Copying server URL: ${item.activeServer.id}`);
                    await handleServerActions_1.ServerActionHandlers.copyUrl(item.activeServer.id);
                }
                break;
            case 'showDetails':
                if (item.activeServer) {
                    console.log(`ACTIVE_SERVERS_MODULAR: Showing server details: ${item.activeServer.id}`);
                    await handleServerActions_1.ServerActionHandlers.showServerDetails(item.activeServer.id);
                }
                break;
            default:
                console.warn(`ACTIVE_SERVERS_MODULAR: Unknown context menu action: ${action}`);
        }
    }
}
exports.ActiveServerClickHandler = ActiveServerClickHandler;


/***/ }),
/* 87 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


/**
 * Babia Examples View Module
 * Exports for the modular Babia Examples section
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BabiaExampleClickHandler = exports.BabiaExampleItemFactory = exports.BabiaExampleTreeItem = exports.BabiaExamplesSectionProvider = void 0;
// Section Provider
var BabiaExamplesSectionProvider_1 = __webpack_require__(88);
Object.defineProperty(exports, "BabiaExamplesSectionProvider", ({ enumerable: true, get: function () { return BabiaExamplesSectionProvider_1.BabiaExamplesSectionProvider; } }));
// Items
var babiaExampleItems_1 = __webpack_require__(89);
Object.defineProperty(exports, "BabiaExampleTreeItem", ({ enumerable: true, get: function () { return babiaExampleItems_1.BabiaExampleTreeItem; } }));
Object.defineProperty(exports, "BabiaExampleItemFactory", ({ enumerable: true, get: function () { return babiaExampleItems_1.BabiaExampleItemFactory; } }));
// Interactions
var handleBabiaExampleClicks_1 = __webpack_require__(91);
Object.defineProperty(exports, "BabiaExampleClickHandler", ({ enumerable: true, get: function () { return handleBabiaExampleClicks_1.BabiaExampleClickHandler; } }));


/***/ }),
/* 88 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BabiaExamplesSectionProvider = void 0;
const vscode = __importStar(__webpack_require__(1));
const babiaExampleItems_1 = __webpack_require__(89);
const handleBabiaExampleClicks_1 = __webpack_require__(91);
const exampleLauncher_1 = __webpack_require__(38);
/**
 * Babia Examples section provider - manages example loading and launching
 */
class BabiaExamplesSectionProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    clickHandler;
    exampleLauncher;
    constructor(context) {
        this.context = context;
        console.log('BABIA_EXAMPLES_MODULAR: Initializing Babia Examples section provider');
        this.clickHandler = new handleBabiaExampleClicks_1.BabiaExampleClickHandler(context);
        this.exampleLauncher = new exampleLauncher_1.ExampleLauncher(context);
    }
    /**
     * Get the section name for identification
     */
    getSectionName() {
        return 'babiaExamples';
    }
    /**
     * Get the section header item
     */
    getSectionItem() {
        return new babiaExampleItems_1.BabiaExampleTreeItem('BABIA EXAMPLES', vscode.TreeItemCollapsibleState.Collapsed, 'no-examples', // Using this as section header type
        undefined, new vscode.ThemeIcon('library'), 'Interactive visualization examples', undefined, 'babiaExamplesSection');
    }
    /**
     * Get children items for the Babia Examples section
     */
    async getChildren(element) {
        // If element is provided, it means we're getting children for a specific item
        // For the Babia Examples section, we only have flat items, so return empty for sub-items
        if (element) {
            return [];
        }
        console.log('BABIA_EXAMPLES_MODULAR: Loading Babia examples section children');
        try {
            const examples = await this.exampleLauncher.getExamples();
            if (examples.length === 0) {
                console.log('BABIA_EXAMPLES_MODULAR: No examples found');
                return [babiaExampleItems_1.BabiaExampleItemFactory.createNoExamplesItem()];
            }
            console.log(`BABIA_EXAMPLES_MODULAR: Found ${examples.length} examples`);
            // Create sorted example items
            const children = babiaExampleItems_1.BabiaExampleItemFactory.createSortedExampleItems(examples);
            console.log(`BABIA_EXAMPLES_MODULAR: Returning ${children.length} children for Babia Examples section`);
            return children;
        }
        catch (error) {
            console.error('BABIA_EXAMPLES_MODULAR: Error loading Babia examples:', error);
            return [babiaExampleItems_1.BabiaExampleItemFactory.createErrorItem()];
        }
    }
    /**
     * Refresh the section
     */
    refresh() {
        console.log('BABIA_EXAMPLES_MODULAR: Refreshing Babia Examples section');
        this._onDidChangeTreeData.fire();
    }
    /**
     * Handle item clicks (additional method for interaction)
     */
    async handleClick(item) {
        await this.clickHandler.handleBabiaExampleClick(item);
    }
    /**
     * Handle context menu actions (additional method for interaction)
     */
    async handleContextMenu(action, item) {
        await this.clickHandler.handleContextMenuAction(action, item);
    }
}
exports.BabiaExamplesSectionProvider = BabiaExamplesSectionProvider;


/***/ }),
/* 89 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BabiaExampleItemFactory = exports.BabiaExampleTreeItem = void 0;
const vscode = __importStar(__webpack_require__(1));
const exampleItems_1 = __webpack_require__(90);
/**
 * Babia Example tree items for the Babia Examples section
 */
class BabiaExampleTreeItem extends vscode.TreeItem {
    babiaItemType;
    babiaExample;
    constructor(label, collapsibleState, babiaItemType, command, iconPath, tooltip, description, contextValue, babiaExample) {
        super(label, collapsibleState);
        this.babiaItemType = babiaItemType;
        this.babiaExample = babiaExample;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip || label;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.BabiaExampleTreeItem = BabiaExampleTreeItem;
/**
 * Factory for creating Babia example-related tree items
 */
class BabiaExampleItemFactory {
    /**
     * Create "No examples found" message item
     */
    static createNoExamplesItem() {
        console.log('BABIA_EXAMPLES: Creating "No examples found" message item');
        return new BabiaExampleTreeItem('No examples found', vscode.TreeItemCollapsibleState.None, 'no-examples', undefined, new vscode.ThemeIcon('warning'), 'No Babia examples are available');
    }
    /**
     * Create "Error loading examples" message item
     */
    static createErrorItem() {
        console.log('BABIA_EXAMPLES: Creating error loading examples item');
        return new BabiaExampleTreeItem('Error loading examples', vscode.TreeItemCollapsibleState.None, 'error', undefined, new vscode.ThemeIcon('error'), 'Failed to load Babia examples');
    }
    /**
     * Create individual Babia example item
     */
    static createExampleItem(example) {
        console.log(`BABIA_EXAMPLES: Creating example item: ${example.name} (${example.category})`);
        const icon = BabiaExampleItemFactory.getExampleIcon(example);
        const statusSuffix = example.isValid ? '' : ' (Invalid)';
        const label = `${example.name}${statusSuffix}`;
        // Create command to launch example (only if valid)
        const command = example.isValid ? {
            command: 'codeXR.babiaExamples.launchExample',
            title: 'Launch Example',
            arguments: [example]
        } : undefined;
        const tooltip = example.isValid ?
            `${example.category} example - Click to launch` :
            `${example.category} example - Invalid configuration`;
        return new BabiaExampleTreeItem(label, vscode.TreeItemCollapsibleState.None, 'example-item', command, icon, tooltip, example.category, 'babia-example', example);
    }
    /**
     * Get the appropriate icon for a Babia example
     */
    static getExampleIcon(example) {
        // Use the existing ExampleIcons mapping
        return exampleItems_1.ExampleIcons.getExampleIcon(example.category);
    }
    /**
     * Create sorted example items from a list of examples
     */
    static createSortedExampleItems(examples) {
        console.log(`BABIA_EXAMPLES: Creating sorted tree items for ${examples.length} examples`);
        // Sort examples by category and name
        const sortedExamples = examples.sort((a, b) => {
            if (a.category !== b.category) {
                return a.category.localeCompare(b.category);
            }
            return a.name.localeCompare(b.name);
        });
        return sortedExamples.map(example => BabiaExampleItemFactory.createExampleItem(example));
    }
}
exports.BabiaExampleItemFactory = BabiaExampleItemFactory;


/***/ }),
/* 90 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ExampleIcons = exports.ExampleItemFactory = exports.BabiaExampleTreeItem = void 0;
const vscode = __importStar(__webpack_require__(1));
/**
 * Tree item for Babia examples display
 */
class BabiaExampleTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    type;
    command;
    iconPath;
    tooltip;
    description;
    contextValue;
    example;
    constructor(label, collapsibleState, type, command, iconPath, tooltip, description, contextValue, example) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.type = type;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip;
        this.description = description;
        this.contextValue = contextValue;
        this.example = example;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.BabiaExampleTreeItem = BabiaExampleTreeItem;
/**
 * Example item factory for creating tree items
 */
class ExampleItemFactory {
    /**
     * Create tree item for a Babia example
     */
    static createExampleItem(example) {
        const command = {
            command: 'codeXR.babiaExamples.launchExample',
            title: 'Launch Example',
            arguments: [example]
        };
        const icon = ExampleIcons.getExampleIcon(example.category);
        const tooltip = ExampleItemFactory.createTooltip(example);
        const description = example.isValid ? undefined : '(Invalid)';
        return new BabiaExampleTreeItem(example.name, vscode.TreeItemCollapsibleState.None, 'example', command, icon, tooltip, description, example.isValid ? 'validExample' : 'invalidExample', example);
    }
    /**
     * Create "No examples found" item
     */
    static createNoExamplesItem() {
        return new BabiaExampleTreeItem('No examples found', vscode.TreeItemCollapsibleState.None, 'noExamples', undefined, new vscode.ThemeIcon('info'), 'No Babia examples were found in examples/charts/', undefined, 'noExamples');
    }
    /**
     * Create loading item
     */
    static createLoadingItem() {
        return new BabiaExampleTreeItem('Loading examples...', vscode.TreeItemCollapsibleState.None, 'loading', undefined, new vscode.ThemeIcon('loading~spin'), 'Scanning for Babia examples', undefined, 'loading');
    }
    /**
     * Create tooltip for example
     * @private
     */
    static createTooltip(example) {
        const lines = [
            `Example: ${example.name}`,
            `Category: ${example.category}`,
            `File: ${example.htmlFilePath}`
        ];
        if (example.description) {
            lines.push(`Description: ${example.description}`);
        }
        if (!example.isValid) {
            lines.push('⚠️ This example has issues and may not work properly');
        }
        else {
            lines.push('✅ Click to launch this example');
        }
        return lines.join('\\n');
    }
}
exports.ExampleItemFactory = ExampleItemFactory;
/**
 * Example icons utility
 */
class ExampleIcons {
    /**
     * Get appropriate icon for example category
     */
    static getExampleIcon(category) {
        switch (category.toLowerCase()) {
            case 'pie':
                return new vscode.ThemeIcon('pie-chart');
            case 'bar-chart':
            case 'barsmap':
                return new vscode.ThemeIcon('graph');
            case 'bubble-chart':
                return new vscode.ThemeIcon('circle-large-outline');
            case 'cylinder-chart':
            case 'cylindermap-chart':
                return new vscode.ThemeIcon('package');
            case 'mix':
                return new vscode.ThemeIcon('combine');
            default:
                return new vscode.ThemeIcon('file-code');
        }
    }
    /**
     * Get section icon
     */
    static getSectionIcon() {
        return new vscode.ThemeIcon('library');
    }
}
exports.ExampleIcons = ExampleIcons;


/***/ }),
/* 91 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BabiaExampleClickHandler = void 0;
const vscode = __importStar(__webpack_require__(1));
const exampleLauncher_1 = __webpack_require__(38);
/**
 * Handler for Babia Examples section interactions
 */
class BabiaExampleClickHandler {
    context;
    exampleLauncher;
    constructor(context) {
        this.context = context;
        this.exampleLauncher = new exampleLauncher_1.ExampleLauncher(context);
    }
    /**
     * Handle clicks on Babia example items
     */
    async handleBabiaExampleClick(item) {
        console.log(`BABIA_EXAMPLES_MODULAR: Handling click on example item: ${item.label} (type: ${item.babiaItemType})`);
        switch (item.babiaItemType) {
            case 'example-item':
                await this.handleExampleItemClick(item);
                break;
            case 'no-examples':
            case 'loading':
            case 'error':
                // No action needed for informational items
                console.log(`BABIA_EXAMPLES_MODULAR: Clicked on informational item: ${item.babiaItemType}`);
                break;
            default:
                console.warn(`BABIA_EXAMPLES_MODULAR: Unknown example item type: ${item.babiaItemType}`);
        }
    }
    /**
     * Handle click on individual example item
     */
    async handleExampleItemClick(item) {
        if (!item.babiaExample) {
            console.error('BABIA_EXAMPLES_MODULAR: No example data in example item');
            return;
        }
        if (!item.babiaExample.isValid) {
            console.warn('BABIA_EXAMPLES_MODULAR: Attempted to launch invalid example');
            vscode.window.showWarningMessage(`Example "${item.babiaExample.name}" is invalid and cannot be launched.`);
            return;
        }
        console.log(`BABIA_EXAMPLES_MODULAR: Launching example: ${item.babiaExample.id}`);
        try {
            // Use the example launcher to handle the launch
            await this.exampleLauncher.launchExample(item.babiaExample);
            vscode.window.showInformationMessage(`Example "${item.babiaExample.name}" launched successfully!`);
        }
        catch (error) {
            console.error(`BABIA_EXAMPLES_MODULAR: Error launching example ${item.babiaExample.id}:`, error);
            vscode.window.showErrorMessage(`Failed to launch example "${item.babiaExample.name}": ${error}`);
        }
    }
    /**
     * Handle right-click context menu actions
     */
    async handleContextMenuAction(action, item) {
        console.log(`BABIA_EXAMPLES_MODULAR: Handling context menu action: ${action} on item: ${item.label}`);
        switch (action) {
            case 'refresh':
                console.log('BABIA_EXAMPLES_MODULAR: Refreshing examples view');
                // Refresh will be triggered by the provider
                break;
            case 'launchExample':
                if (item.babiaExample && item.babiaExample.isValid) {
                    console.log(`BABIA_EXAMPLES_MODULAR: Launching example from context menu: ${item.babiaExample.id}`);
                    await this.handleExampleItemClick(item);
                }
                break;
            case 'openInBrowser':
                if (item.babiaExample && item.babiaExample.isValid) {
                    console.log(`BABIA_EXAMPLES_MODULAR: Opening example in browser: ${item.babiaExample.id}`);
                    await this.launchExampleInBrowser(item.babiaExample);
                }
                break;
            case 'openInPanel':
                if (item.babiaExample && item.babiaExample.isValid) {
                    console.log(`BABIA_EXAMPLES_MODULAR: Opening example in panel: ${item.babiaExample.id}`);
                    await this.launchExampleInPanel(item.babiaExample);
                }
                break;
            case 'showDetails':
                if (item.babiaExample) {
                    console.log(`BABIA_EXAMPLES_MODULAR: Showing example details: ${item.babiaExample.id}`);
                    await this.showExampleDetails(item.babiaExample);
                }
                break;
            default:
                console.warn(`BABIA_EXAMPLES_MODULAR: Unknown context menu action: ${action}`);
        }
    }
    /**
     * Launch example specifically in browser
     */
    async launchExampleInBrowser(example) {
        try {
            // For now, use the default launcher - future enhancement could support launch mode selection
            await this.exampleLauncher.launchExample(example);
            vscode.window.showInformationMessage(`Example "${example.name}" launched! (Uses current user configuration for launch mode)`);
        }
        catch (error) {
            console.error(`BABIA_EXAMPLES_MODULAR: Error launching example:`, error);
            vscode.window.showErrorMessage(`Failed to launch example: ${error}`);
        }
    }
    /**
     * Launch example specifically in panel
     */
    async launchExampleInPanel(example) {
        try {
            // For now, use the default launcher - future enhancement could support launch mode selection
            await this.exampleLauncher.launchExample(example);
            vscode.window.showInformationMessage(`Example "${example.name}" launched! (Uses current user configuration for launch mode)`);
        }
        catch (error) {
            console.error(`BABIA_EXAMPLES_MODULAR: Error launching example:`, error);
            vscode.window.showErrorMessage(`Failed to launch example: ${error}`);
        }
    }
    /**
     * Show detailed information about an example
     */
    async showExampleDetails(example) {
        const details = `Example Details:
        
Name: ${example.name}
Category: ${example.category}
File: ${example.htmlFilePath}
Directory: ${example.directory}
Valid: ${example.isValid ? 'Yes' : 'No'}
${example.description ? `Description: ${example.description}` : ''}`;
        vscode.window.showInformationMessage(details, { modal: true });
    }
}
exports.BabiaExampleClickHandler = BabiaExampleClickHandler;


/***/ }),
/* 92 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


/**
 * Visualize Data View Module
 * Exports for the modular Visualize Data section
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VisualizeDataClickHandler = exports.VisualizeDataModularItemFactory = exports.VisualizeDataModularTreeItem = exports.VisualizeDataSectionProvider = void 0;
// Section Provider
var VisualizeDataSectionProvider_1 = __webpack_require__(93);
Object.defineProperty(exports, "VisualizeDataSectionProvider", ({ enumerable: true, get: function () { return VisualizeDataSectionProvider_1.VisualizeDataSectionProvider; } }));
// Items
var visualizeDataItems_1 = __webpack_require__(94);
Object.defineProperty(exports, "VisualizeDataModularTreeItem", ({ enumerable: true, get: function () { return visualizeDataItems_1.VisualizeDataModularTreeItem; } }));
Object.defineProperty(exports, "VisualizeDataModularItemFactory", ({ enumerable: true, get: function () { return visualizeDataItems_1.VisualizeDataModularItemFactory; } }));
// Interactions
var handleVisualizeDataClicks_1 = __webpack_require__(97);
Object.defineProperty(exports, "VisualizeDataClickHandler", ({ enumerable: true, get: function () { return handleVisualizeDataClicks_1.VisualizeDataClickHandler; } }));


/***/ }),
/* 93 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VisualizeDataSectionProvider = void 0;
const vscode = __importStar(__webpack_require__(1));
const visualizeDataItems_1 = __webpack_require__(94);
const handleVisualizeDataClicks_1 = __webpack_require__(97);
const visualizeDataState_1 = __webpack_require__(44);
/**
 * Visualize Data section provider - manages data visualization configuration and launch
 */
class VisualizeDataSectionProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    clickHandler;
    constructor(context) {
        this.context = context;
        console.log('VISUALIZE_DATA_MODULAR: Initializing Visualize Data section provider');
        this.clickHandler = new handleVisualizeDataClicks_1.VisualizeDataClickHandler(context);
        // Listen to state changes if state manager is available
        if (visualizeDataState_1.VisualizeDataStateManager.hasInstance()) {
            const stateManager = visualizeDataState_1.VisualizeDataStateManager.getInstance(context);
            stateManager.onStateChanged(() => {
                console.log('VISUALIZE_DATA_MODULAR: Visualize data state changed, refreshing section');
                this.refresh();
            });
        }
    }
    /**
     * Get the section name for identification
     */
    getSectionName() {
        return 'visualizeData';
    }
    /**
     * Get the section header item
     */
    getSectionItem() {
        return new visualizeDataItems_1.VisualizeDataModularTreeItem('VISUALIZE DATA', vscode.TreeItemCollapsibleState.Collapsed, 'error', // Using this as section header type
        undefined, new vscode.ThemeIcon('chart-scatter'), 'Data visualization configuration and launch', undefined, 'visualizeDataSection');
    }
    /**
     * Get children items for the Visualize Data section
     */
    async getChildren(element) {
        if (!element) {
            // Root level - return main visualize data items
            console.log('VISUALIZE_DATA_MODULAR: Loading visualize data section children');
            return visualizeDataItems_1.VisualizeDataModularItemFactory.createVisualizeDataItems(this.context);
        }
        // Handle sub-items for collapsible sections
        switch (element.visualizeDataItemType) {
            case 'dimension-mapping':
                return this.getDimensionMappingChildren();
            case 'browse-visualizations':
                return this.getBrowseVisualizationChildren();
            default:
                // Most items don't have children
                return [];
        }
    }
    /**
     * Get dimension mapping children
     */
    getDimensionMappingChildren() {
        console.log('VISUALIZE_DATA_MODULAR: Loading dimension mapping children');
        try {
            // Get current state if available
            let state = undefined;
            if (visualizeDataState_1.VisualizeDataStateManager.hasInstance()) {
                const stateManager = visualizeDataState_1.VisualizeDataStateManager.getInstance(this.context);
                state = stateManager.getState();
            }
            return visualizeDataItems_1.VisualizeDataModularItemFactory.createDimensionMappingItems(this.context, state);
        }
        catch (error) {
            console.error('VISUALIZE_DATA_MODULAR: Error loading dimension mapping items:', error);
            return [new visualizeDataItems_1.VisualizeDataModularTreeItem('Error loading dimensions', vscode.TreeItemCollapsibleState.None, 'error', undefined, new vscode.ThemeIcon('error'), 'Failed to load dimension items')];
        }
    }
    /**
     * Get browse visualization children
     */
    async getBrowseVisualizationChildren() {
        console.log('VISUALIZE_DATA_MODULAR: Loading browse visualization children');
        return visualizeDataItems_1.VisualizeDataModularItemFactory.createBrowseVisualizationItems(this.context);
    }
    /**
     * Refresh the section
     */
    refresh() {
        console.log('VISUALIZE_DATA_MODULAR: Refreshing Visualize Data section');
        this._onDidChangeTreeData.fire();
    }
    /**
     * Handle item clicks (additional method for interaction)
     */
    async handleClick(item) {
        await this.clickHandler.handleVisualizeDataClick(item);
    }
    /**
     * Handle context menu actions (additional method for interaction)
     */
    async handleContextMenu(action, item) {
        await this.clickHandler.handleContextMenuAction(action, item);
    }
}
exports.VisualizeDataSectionProvider = VisualizeDataSectionProvider;


/***/ }),
/* 94 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VisualizeDataModularItemFactory = exports.VisualizeDataModularTreeItem = void 0;
const vscode = __importStar(__webpack_require__(1));
const visualizeDataItems_1 = __webpack_require__(95);
const visualizationRestorer_1 = __webpack_require__(57);
const visualizationItem_1 = __webpack_require__(96);
/**
 * Visualize Data tree items for the Visualize Data section
 */
class VisualizeDataModularTreeItem extends vscode.TreeItem {
    visualizeDataItemType;
    visualizeDataItem;
    constructor(label, collapsibleState, visualizeDataItemType, command, iconPath, tooltip, description, contextValue, visualizeDataItem) {
        super(label, collapsibleState);
        this.visualizeDataItemType = visualizeDataItemType;
        this.visualizeDataItem = visualizeDataItem;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip || label;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.VisualizeDataModularTreeItem = VisualizeDataModularTreeItem;
/**
 * Factory for creating Visualize Data-related tree items
 */
class VisualizeDataModularItemFactory {
    /**
     * Create "Error loading visualize data" message item
     */
    static createErrorItem() {
        console.log('VISUALIZE_DATA_MODULAR: Creating error loading visualize data item');
        return new VisualizeDataModularTreeItem('Error loading visualize data', vscode.TreeItemCollapsibleState.None, 'error', undefined, new vscode.ThemeIcon('error'), 'Failed to load visualize data items');
    }
    /**
     * Create main visualize data items
     */
    static createVisualizeDataItems(context) {
        console.log('VISUALIZE_DATA_MODULAR: Creating visualize data items');
        try {
            const visualizeDataItems = visualizeDataItems_1.VisualizeDataItemFactory.createVisualizeDataItems(context);
            const children = visualizeDataItems.map(item => {
                // Handle collapsible dimension mapping and browse visualizations
                let collapsibleState = vscode.TreeItemCollapsibleState.None;
                let itemType = item.type;
                if (item.type === 'dimension-mapping' && item.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
                    collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                }
                else if (item.type === 'browse-visualizations' && item.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
                    collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                }
                return new VisualizeDataModularTreeItem(item.label, collapsibleState, itemType, item.command, item.iconPath, item.tooltip, item.description, item.contextValue, item);
            });
            console.log(`VISUALIZE_DATA_MODULAR: Created ${children.length} visualize data items`);
            return children;
        }
        catch (error) {
            console.error('VISUALIZE_DATA_MODULAR: Error creating visualize data items:', error);
            return [VisualizeDataModularItemFactory.createErrorItem()];
        }
    }
    /**
     * Create dimension mapping sub-items
     */
    static createDimensionMappingItems(context, state) {
        console.log('VISUALIZE_DATA_MODULAR: Creating dimension mapping items');
        try {
            // Provide a default state if none provided
            const stateToUse = state || {
                selectedChart: undefined,
                selectedJsonPath: undefined,
                selectedJsonName: undefined,
                jsonAnalysis: undefined,
                dimensionMappings: [],
                isDimensionMappingConfigured: false,
                isReadyToLaunch: false
            };
            const dimensionItems = visualizeDataItems_1.VisualizeDataItemFactory.createDimensionItems(stateToUse);
            const children = dimensionItems.map(item => {
                return new VisualizeDataModularTreeItem(item.label, vscode.TreeItemCollapsibleState.None, 'dimension-item', item.command, item.iconPath, item.tooltip, item.description, item.contextValue, item);
            });
            console.log(`VISUALIZE_DATA_MODULAR: Created ${children.length} dimension mapping items`);
            return children;
        }
        catch (error) {
            console.error('VISUALIZE_DATA_MODULAR: Error creating dimension mapping items:', error);
            return [new VisualizeDataModularTreeItem('Error loading dimensions', vscode.TreeItemCollapsibleState.None, 'error', undefined, new vscode.ThemeIcon('error'), 'Failed to load dimension items')];
        }
    }
    /**
     * Create browse visualizations sub-items
     */
    static async createBrowseVisualizationItems(context) {
        console.log('VISUALIZE_DATA_MODULAR: Creating browse visualization items');
        try {
            const visualizationRestorer = new visualizationRestorer_1.VisualizationRestorer(context);
            // Scan for stored visualizations
            const visualizations = await visualizationRestorer.scanStoredVisualizations();
            // Create items for visualizations
            const visualizationItems = visualizationItem_1.BrowseVisualizationItemFactory.createStoredVisualizationItems(visualizations);
            // Add reset button if there are visualizations
            if (visualizations.length > 0) {
                visualizationItems.push(visualizationItem_1.BrowseVisualizationItemFactory.createResetAllItem());
            }
            // Convert to modular tree items
            const children = visualizationItems.map((item) => {
                return new VisualizeDataModularTreeItem(item.label, vscode.TreeItemCollapsibleState.None, 'stored-visualization', item.command, item.iconPath, item.tooltip, item.description, item.contextValue);
            });
            console.log(`VISUALIZE_DATA_MODULAR: Created ${children.length} browse visualization items`);
            return children;
        }
        catch (error) {
            console.error('VISUALIZE_DATA_MODULAR: Error loading browse visualizations:', error);
            return [new VisualizeDataModularTreeItem('Error loading visualizations', vscode.TreeItemCollapsibleState.None, 'error', undefined, new vscode.ThemeIcon('error'), 'Failed to load stored visualizations')];
        }
    }
}
exports.VisualizeDataModularItemFactory = VisualizeDataModularItemFactory;


/***/ }),
/* 95 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VisualizeDataIcons = exports.VisualizeDataItemFactory = exports.VisualizeDataTreeItem = void 0;
const vscode = __importStar(__webpack_require__(1));
const visualizeDataState_1 = __webpack_require__(44);
/**
 * Tree item for visualize data items
 */
class VisualizeDataTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    type;
    command;
    iconPath;
    tooltip;
    description;
    contextValue;
    constructor(label, collapsibleState, type, command, iconPath, tooltip, description, contextValue) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.type = type;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip;
        this.description = description;
        this.contextValue = contextValue;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.VisualizeDataTreeItem = VisualizeDataTreeItem;
/**
 * Factory for creating visualize data items
 */
class VisualizeDataItemFactory {
    /**
     * Create all visualize data items with current state
     */
    static createVisualizeDataItems(context) {
        console.log('BABIA-TEMPLATES: Creating visualize data items...');
        // Get current state if context is available and state manager exists
        let stateManager;
        let state;
        try {
            if (context && visualizeDataState_1.VisualizeDataStateManager.hasInstance()) {
                stateManager = visualizeDataState_1.VisualizeDataStateManager.getInstance(context);
                state = stateManager.getState();
                console.log('BABIA-TEMPLATES: Retrieved state from manager', {
                    hasChart: !!state.selectedChart,
                    chartName: state.selectedChart?.name,
                    hasJson: !!state.selectedJsonName,
                    jsonName: state.selectedJsonName
                });
            }
            else if (context) {
                // Try to initialize state manager if context is available
                stateManager = visualizeDataState_1.VisualizeDataStateManager.getInstance(context);
                state = stateManager.getState();
                console.log('BABIA-TEMPLATES: Initialized new state manager');
            }
            else {
                console.log('BABIA-TEMPLATES: No context available, using default state');
            }
        }
        catch (error) {
            // State manager not initialized yet, use default values
            console.log('BABIA-TEMPLATES: Error accessing state manager, using defaults:', error);
        }
        const chartDescription = state?.selectedChart
            ? `Selected: ${state.selectedChart.name}`
            : 'No chart selected';
        const jsonDescription = state?.selectedJsonName
            ? `Selected: ${state.selectedJsonName}`
            : 'No file selected';
        const dimensionDescription = state?.isDimensionMappingConfigured
            ? 'Configured'
            : 'Not configured';
        const launchDescription = state?.isReadyToLaunch
            ? 'Ready to launch'
            : 'Configure required settings';
        console.log('BABIA-TEMPLATES: Item descriptions:', {
            chart: chartDescription,
            json: jsonDescription,
            dimension: dimensionDescription,
            launch: launchDescription
        });
        return [
            // Chart Type
            new VisualizeDataTreeItem('Chart Type', vscode.TreeItemCollapsibleState.None, 'chart-type', {
                command: 'codeXR.visualizeData.chartType',
                title: 'Select Chart Type'
            }, new vscode.ThemeIcon('graph'), 'Select visualization chart type', chartDescription, 'visualize-data-chart-type'),
            // Select JSON File
            new VisualizeDataTreeItem('Select JSON File', vscode.TreeItemCollapsibleState.None, 'select-json', {
                command: 'codeXR.visualizeData.selectJson',
                title: 'Select JSON File'
            }, new vscode.ThemeIcon('file-code'), 'Select JSON data file for visualization', jsonDescription, 'visualize-data-select-json'),
            // Dimension Mapping
            VisualizeDataItemFactory.createDimensionMappingItem(state),
            // Launch Visualization - Icon changes based on readiness
            new VisualizeDataTreeItem('Launch Visualization', vscode.TreeItemCollapsibleState.None, 'launch-visualization', {
                command: 'codeXR.visualizeData.launchVisualization',
                title: 'Launch Visualization'
            }, state?.isReadyToLaunch
                ? new vscode.ThemeIcon('rocket') // Ready to launch - rocket icon
                : new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow')), // Not ready - yellow warning
            'Launch the configured visualization', launchDescription, 'visualize-data-launch'),
            // Browse Visualizations
            new VisualizeDataTreeItem('Browse Visualizations', vscode.TreeItemCollapsibleState.Collapsed, 'browse-visualizations', undefined, // No command - expandable section
            new vscode.ThemeIcon('folder-opened'), 'Browse and launch previously generated visualizations', undefined, 'visualize-data-browse-visualizations')
        ];
    }
    /**
     * Create dimension mapping item with collapsible state
     */
    static createDimensionMappingItem(state) {
        if (!state?.selectedChart || !state?.jsonAnalysis) {
            return new VisualizeDataTreeItem('Dimension Mapping', vscode.TreeItemCollapsibleState.None, 'dimension-mapping', undefined, new vscode.ThemeIcon('settings-gear'), 'Select chart type and JSON file first', 'Not available', 'visualize-data-dimension-mapping');
        }
        const requiredCount = state.selectedChart.dimensions.filter(d => d.required).length;
        const mappedCount = state.dimensionMappings.length;
        const isConfigured = this.areRequiredDimensionsMapped(state);
        const description = isConfigured
            ? `Configured (${mappedCount}/${state.selectedChart.dimensions.length})`
            : `${mappedCount}/${requiredCount} required`;
        return new VisualizeDataTreeItem('Dimension Mapping', vscode.TreeItemCollapsibleState.Collapsed, 'dimension-mapping', undefined, // Remove command to allow expand/collapse behavior
        isConfigured
            ? new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
            : new vscode.ThemeIcon('settings-gear'), 'Configure dimension mapping for visualization - Click to expand/collapse', description, 'visualize-data-dimension-mapping');
    }
    /**
     * Create dimension items for collapsible dimension mapping
     */
    static createDimensionItems(state) {
        if (!state.selectedChart) {
            return [];
        }
        return state.selectedChart.dimensions.map(dimension => this.createDimensionItem(dimension, state));
    }
    /**
     * Create individual dimension tree item
     */
    static createDimensionItem(dimension, state) {
        const currentMapping = state.dimensionMappings.find(m => m.dimension === dimension.name);
        const isRequired = dimension.required;
        // Check for duplicate field usage
        const isDuplicateField = currentMapping && this.isFieldUsedInOtherMappings(currentMapping.dataField, dimension.name, state);
        // Create label with status
        let label = `${dimension.name}`; // Use actual dimension name (key, size)
        let description = '';
        let tooltip = `${dimension.name}`;
        // Add field mapping status
        if (currentMapping) {
            description = `→ ${currentMapping.dataField}`;
            tooltip += `\nMapped to: ${currentMapping.dataField}`;
            if (isDuplicateField) {
                description += ' (duplicate)';
                tooltip += '\n⚠️ Warning: This field is used in multiple mappings';
                console.log(`DIMENSION-MAPPING: Duplicate field usage detected - '${currentMapping.dataField}' is used for multiple dimensions`);
            }
        }
        else {
            description = 'Not Mapped';
            tooltip += '\nNot mapped - Click to select field';
        }
        // Add data type suffix
        const dataTypeSuffix = dimension.dataType === 'numeric' ? ' (numeric only)' : ' (any value)';
        description += dataTypeSuffix;
        tooltip += `\nData type: ${dimension.dataType === 'numeric' ? 'numeric only' : 'any value'}`;
        // Set icon based on mapping status and requirement
        let iconPath;
        if (currentMapping && isDuplicateField) {
            iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.red'));
        }
        else if (currentMapping) {
            iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
        }
        else if (isRequired) {
            iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'));
        }
        else {
            iconPath = new vscode.ThemeIcon('circle-outline');
        }
        return new VisualizeDataTreeItem(label, vscode.TreeItemCollapsibleState.None, 'dimension-item', {
            command: 'codeXR.visualizeData.mapDimensionField',
            title: 'Map Dimension Field',
            arguments: [dimension.name]
        }, iconPath, tooltip, description, 'visualize-data-dimension-item');
    }
    /**
     * Check if all required dimensions are mapped
     */
    static areRequiredDimensionsMapped(state) {
        if (!state.selectedChart) {
            return false;
        }
        const requiredDimensions = state.selectedChart.dimensions.filter(d => d.required);
        return requiredDimensions.every(dimension => state.dimensionMappings.some(mapping => mapping.dimension === dimension.name));
    }
    /**
     * Check if a field is used in other dimension mappings
     */
    static isFieldUsedInOtherMappings(fieldName, currentDimensionName, state) {
        return state.dimensionMappings.some(mapping => mapping.dataField === fieldName && mapping.dimension !== currentDimensionName);
    }
}
exports.VisualizeDataItemFactory = VisualizeDataItemFactory;
/**
 * Icons for visualize data items
 */
class VisualizeDataIcons {
    static chartType = new vscode.ThemeIcon('graph');
    static selectJson = new vscode.ThemeIcon('file-code');
    static dimensionMapping = new vscode.ThemeIcon('settings-gear');
    static launchVisualization = new vscode.ThemeIcon('play');
    static section = new vscode.ThemeIcon('chart-scatter');
}
exports.VisualizeDataIcons = VisualizeDataIcons;


/***/ }),
/* 96 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BrowseVisualizationItemFactory = exports.BrowseVisualizationTreeItem = void 0;
const vscode = __importStar(__webpack_require__(1));
/**
 * Tree item for browse visualizations
 */
class BrowseVisualizationTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    type;
    visualization;
    command;
    iconPath;
    tooltip;
    description;
    contextValue;
    constructor(label, collapsibleState, type, visualization, command, iconPath, tooltip, description, contextValue) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.type = type;
        this.visualization = visualization;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip;
        this.description = description;
        this.contextValue = contextValue;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.BrowseVisualizationTreeItem = BrowseVisualizationTreeItem;
/**
 * Factory for creating browse visualization items
 */
class BrowseVisualizationItemFactory {
    /**
     * Create browse visualizations section
     */
    static createBrowseVisualizationsSection() {
        return new BrowseVisualizationTreeItem('Browse Visualizations', vscode.TreeItemCollapsibleState.Expanded, 'browse-section', undefined, undefined, new vscode.ThemeIcon('folder-opened'), 'Browse previously generated visualizations', undefined, 'browse-visualizations-section');
    }
    /**
     * Create items for stored visualizations
     */
    static createStoredVisualizationItems(visualizations) {
        if (visualizations.length === 0) {
            return [
                new BrowseVisualizationTreeItem('No visualizations found', vscode.TreeItemCollapsibleState.None, 'stored-visualization', undefined, undefined, new vscode.ThemeIcon('info'), 'No stored visualizations available. Generate some visualizations first.', undefined, 'no-visualizations')
            ];
        }
        return visualizations.map(visualization => {
            const isValid = visualization.isValid;
            const icon = isValid ? new vscode.ThemeIcon('play') : new vscode.ThemeIcon('warning');
            const tooltip = isValid
                ? `Launch visualization: ${visualization.name}\nPath: ${visualization.folderPath}`
                : `Invalid visualization: ${visualization.name}\nMissing required files in: ${visualization.folderPath}`;
            const description = isValid ? undefined : '⚠️ Invalid';
            return new BrowseVisualizationTreeItem(visualization.name, vscode.TreeItemCollapsibleState.None, 'stored-visualization', visualization, isValid ? {
                command: 'codeXR.browseVisualizations.launch',
                title: 'Launch Visualization',
                arguments: [visualization]
            } : undefined, icon, tooltip, description, 'stored-visualization');
        });
    }
    /**
     * Create reset all visualizations item
     */
    static createResetAllItem() {
        return new BrowseVisualizationTreeItem('Reset All Visualizations', vscode.TreeItemCollapsibleState.None, 'stored-visualization', undefined, {
            command: 'codeXR.browseVisualizations.resetAll',
            title: 'Reset All Visualizations',
            arguments: []
        }, new vscode.ThemeIcon('trash'), 'Delete all stored visualizations', undefined, 'reset-all-visualizations');
    }
}
exports.BrowseVisualizationItemFactory = BrowseVisualizationItemFactory;


/***/ }),
/* 97 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VisualizeDataClickHandler = void 0;
const vscode = __importStar(__webpack_require__(1));
/**
 * Handler for Visualize Data section interactions
 */
class VisualizeDataClickHandler {
    context;
    constructor(context) {
        this.context = context;
    }
    /**
     * Handle clicks on visualize data items
     */
    async handleVisualizeDataClick(item) {
        console.log(`VISUALIZE_DATA_MODULAR: Handling click on visualize data item: ${item.label} (type: ${item.visualizeDataItemType})`);
        // For most visualize data items, the command is already attached to the tree item
        // and will be executed automatically by VS Code
        switch (item.visualizeDataItemType) {
            case 'chart-type':
                console.log('VISUALIZE_DATA_MODULAR: Chart type selection clicked');
                // Command: 'codeXR.visualizeData.chartType' is already attached
                break;
            case 'select-json':
                console.log('VISUALIZE_DATA_MODULAR: Select JSON file clicked');
                // Command: 'codeXR.visualizeData.selectJson' is already attached
                break;
            case 'dimension-mapping':
                console.log('VISUALIZE_DATA_MODULAR: Dimension mapping clicked');
                // This is a collapsible item, no direct action needed
                break;
            case 'dimension-item':
                console.log('VISUALIZE_DATA_MODULAR: Dimension item clicked');
                // Command varies per dimension item and is already attached
                break;
            case 'launch-visualization':
                console.log('VISUALIZE_DATA_MODULAR: Launch visualization clicked');
                // Command: 'codeXR.visualizeData.launchVisualization' is already attached
                break;
            case 'browse-visualizations':
                console.log('VISUALIZE_DATA_MODULAR: Browse visualizations clicked');
                // This is a collapsible item, no direct action needed
                break;
            case 'stored-visualization':
                console.log('VISUALIZE_DATA_MODULAR: Stored visualization clicked');
                // Command varies per stored visualization and is already attached
                break;
            case 'error':
                console.log('VISUALIZE_DATA_MODULAR: Error item clicked - no action');
                break;
            default:
                console.warn(`VISUALIZE_DATA_MODULAR: Unknown visualize data item type: ${item.visualizeDataItemType}`);
        }
    }
    /**
     * Handle right-click context menu actions
     */
    async handleContextMenuAction(action, item) {
        console.log(`VISUALIZE_DATA_MODULAR: Handling context menu action: ${action} on item: ${item.label}`);
        switch (action) {
            case 'refresh':
                console.log('VISUALIZE_DATA_MODULAR: Refreshing visualize data view');
                // Refresh will be triggered by the provider
                break;
            case 'reset':
                await this.handleResetAction(item);
                break;
            case 'configure':
                await this.handleConfigureAction(item);
                break;
            case 'launch':
                await this.handleLaunchAction(item);
                break;
            case 'details':
                await this.handleShowDetails(item);
                break;
            default:
                console.warn(`VISUALIZE_DATA_MODULAR: Unknown context menu action: ${action}`);
        }
    }
    /**
     * Handle reset action
     */
    async handleResetAction(item) {
        console.log(`VISUALIZE_DATA_MODULAR: Handling reset action for: ${item.label}`);
        switch (item.visualizeDataItemType) {
            case 'chart-type':
                // Reset chart type selection
                await vscode.commands.executeCommand('codeXR.visualizeData.resetChartType');
                break;
            case 'select-json':
                // Reset JSON file selection
                await vscode.commands.executeCommand('codeXR.visualizeData.resetJsonFile');
                break;
            case 'dimension-mapping':
                // Reset all dimension mappings
                await vscode.commands.executeCommand('codeXR.visualizeData.resetDimensions');
                break;
            default:
                vscode.window.showInformationMessage(`Reset not available for ${item.label}`);
        }
    }
    /**
     * Handle configure action
     */
    async handleConfigureAction(item) {
        console.log(`VISUALIZE_DATA_MODULAR: Handling configure action for: ${item.label}`);
        switch (item.visualizeDataItemType) {
            case 'chart-type':
                await vscode.commands.executeCommand('codeXR.visualizeData.chartType');
                break;
            case 'select-json':
                await vscode.commands.executeCommand('codeXR.visualizeData.selectJson');
                break;
            case 'dimension-item':
                // Execute the dimension item's command if available
                if (item.command) {
                    await vscode.commands.executeCommand(item.command.command, ...(item.command.arguments || []));
                }
                break;
            default:
                vscode.window.showInformationMessage(`Configuration not available for ${item.label}`);
        }
    }
    /**
     * Handle launch action
     */
    async handleLaunchAction(item) {
        console.log(`VISUALIZE_DATA_MODULAR: Handling launch action for: ${item.label}`);
        if (item.visualizeDataItemType === 'stored-visualization' && item.command) {
            // Launch stored visualization
            await vscode.commands.executeCommand(item.command.command, ...(item.command.arguments || []));
        }
        else {
            // Launch current visualization configuration
            await vscode.commands.executeCommand('codeXR.visualizeData.launchVisualization');
        }
    }
    /**
     * Show details about the item
     */
    async handleShowDetails(item) {
        console.log(`VISUALIZE_DATA_MODULAR: Showing details for: ${item.label}`);
        let details = `Visualize Data Item Details:

Name: ${item.label}
Type: ${item.visualizeDataItemType}
Description: ${item.description || 'No description available'}
Tooltip: ${item.tooltip || 'No tooltip available'}`;
        if (item.command) {
            details += `\nCommand: ${item.command.command}`;
        }
        if (item.contextValue) {
            details += `\nContext: ${item.contextValue}`;
        }
        vscode.window.showInformationMessage(details, { modal: true });
    }
}
exports.VisualizeDataClickHandler = VisualizeDataClickHandler;


/***/ }),
/* 98 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


/**
 * Code Analysis View Module
 * Exports for the modular Code Analysis section
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CodeAnalysisClickHandler = exports.CodeAnalysisModularItemFactory = exports.CodeAnalysisModularTreeItem = exports.CodeAnalysisSectionProvider = void 0;
// Section Provider
var CodeAnalysisSectionProvider_1 = __webpack_require__(99);
Object.defineProperty(exports, "CodeAnalysisSectionProvider", ({ enumerable: true, get: function () { return CodeAnalysisSectionProvider_1.CodeAnalysisSectionProvider; } }));
// Items
var codeAnalysisItems_1 = __webpack_require__(100);
Object.defineProperty(exports, "CodeAnalysisModularTreeItem", ({ enumerable: true, get: function () { return codeAnalysisItems_1.CodeAnalysisModularTreeItem; } }));
Object.defineProperty(exports, "CodeAnalysisModularItemFactory", ({ enumerable: true, get: function () { return codeAnalysisItems_1.CodeAnalysisModularItemFactory; } }));
// Interactions
var handleCodeAnalysisClicks_1 = __webpack_require__(104);
Object.defineProperty(exports, "CodeAnalysisClickHandler", ({ enumerable: true, get: function () { return handleCodeAnalysisClicks_1.CodeAnalysisClickHandler; } }));


/***/ }),
/* 99 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CodeAnalysisSectionProvider = void 0;
const vscode = __importStar(__webpack_require__(1));
const codeAnalysisItems_1 = __webpack_require__(100);
const handleCodeAnalysisClicks_1 = __webpack_require__(104);
const codeAnalysisTreeView_1 = __webpack_require__(105);
const projectStructureAdapter_1 = __webpack_require__(112);
/**
 * Code Analysis section provider - manages code analysis and file organization
 */
class CodeAnalysisSectionProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    clickHandler;
    codeAnalysisProvider;
    projectStructureAdapter;
    constructor(context) {
        this.context = context;
        console.log('CODE_ANALYSIS_MODULAR: Initializing Code Analysis section provider');
        this.clickHandler = new handleCodeAnalysisClicks_1.CodeAnalysisClickHandler(context);
        this.codeAnalysisProvider = new codeAnalysisTreeView_1.CodeAnalysisTreeDataProvider(context);
        this.projectStructureAdapter = new projectStructureAdapter_1.ProjectStructureModularAdapter(context);
        // Listen to changes from the original code analysis provider
        this.codeAnalysisProvider.onDidChangeTreeData(() => {
            console.log('CODE_ANALYSIS_MODULAR: Code analysis data changed, refreshing section');
            this.refresh();
        });
    }
    /**
     * Get the section name for identification
     */
    getSectionName() {
        return 'codeAnalysis';
    }
    /**
     * Get the section header item
     */
    getSectionItem() {
        return new codeAnalysisItems_1.CodeAnalysisModularTreeItem('CODE ANALYSIS', vscode.TreeItemCollapsibleState.Expanded, // Expanded by default
        'section', undefined, new vscode.ThemeIcon('search-details'), 'Code analysis tools and metrics', undefined, 'codeAnalysisSection');
    }
    /**
     * Get children items for the Code Analysis section
     */
    async getChildren(element) {
        if (!element) {
            // Root level - return main code analysis sections
            console.log('CODE_ANALYSIS_MODULAR: Loading code analysis section children');
            try {
                // Get current state from the original provider
                const filesByLanguage = this.codeAnalysisProvider.filesByLanguage;
                const isScanning = this.codeAnalysisProvider.isScanning || false;
                return codeAnalysisItems_1.CodeAnalysisModularItemFactory.createCodeAnalysisSections(filesByLanguage, isScanning, this.context);
            }
            catch (error) {
                console.error('CODE_ANALYSIS_MODULAR: Error loading code analysis sections:', error);
                return [codeAnalysisItems_1.CodeAnalysisModularItemFactory.createErrorItem()];
            }
        }
        // Handle sub-items for collapsible sections
        if (element.originalCodeAnalysisItem) {
            console.log(`CODE_ANALYSIS_MODULAR: Loading sub-items for: ${element.label}`);
            // Special handling for project structure
            if (element.originalCodeAnalysisItem.type === 'project-structure') {
                console.log('CODE_ANALYSIS_MODULAR: Loading project structure children');
                const projectStructureChildren = await this.projectStructureAdapter.getProjectStructureChildren();
                // Convert to modular items
                return projectStructureChildren.map(child => {
                    const iconPath = typeof child.iconPath === 'string'
                        ? new vscode.ThemeIcon(child.iconPath)
                        : child.iconPath;
                    const tooltip = typeof child.tooltip === 'string'
                        ? child.tooltip
                        : child.tooltip?.value || undefined;
                    const description = typeof child.description === 'string'
                        ? child.description
                        : undefined;
                    return new codeAnalysisItems_1.CodeAnalysisModularTreeItem(typeof child.label === 'string' ? child.label : child.label?.label || 'Unknown', child.collapsibleState || vscode.TreeItemCollapsibleState.None, 'file-item', child.command, iconPath, tooltip, description, child.contextValue, child);
                });
            }
            // Check if this is a project structure item that needs expansion
            if (this.projectStructureAdapter.isProjectStructureItem(element.originalCodeAnalysisItem)) {
                const projectStructureItem = this.projectStructureAdapter.getProjectStructureItem(element.originalCodeAnalysisItem);
                if (projectStructureItem) {
                    console.log(`CODE_ANALYSIS_MODULAR: Loading project structure item children for: ${projectStructureItem.name}`);
                    const projectStructureChildren = await this.projectStructureAdapter.getProjectStructureItemChildren(projectStructureItem);
                    // Convert to modular items
                    return projectStructureChildren.map(child => {
                        const iconPath = typeof child.iconPath === 'string'
                            ? new vscode.ThemeIcon(child.iconPath)
                            : child.iconPath;
                        const tooltip = typeof child.tooltip === 'string'
                            ? child.tooltip
                            : child.tooltip?.value || undefined;
                        const description = typeof child.description === 'string'
                            ? child.description
                            : undefined;
                        return new codeAnalysisItems_1.CodeAnalysisModularTreeItem(typeof child.label === 'string' ? child.label : child.label?.label || 'Unknown', child.collapsibleState || vscode.TreeItemCollapsibleState.None, 'file-item', child.command, iconPath, tooltip, description, child.contextValue, child);
                    });
                }
            }
            return codeAnalysisItems_1.CodeAnalysisModularItemFactory.createCodeAnalysisSubItems(element.originalCodeAnalysisItem, this.codeAnalysisProvider);
        }
        // No sub-items for this element
        return [];
    }
    /**
     * Refresh the section
     */
    refresh() {
        console.log('CODE_ANALYSIS_MODULAR: Refreshing Code Analysis section');
        this._onDidChangeTreeData.fire();
    }
    /**
     * Handle item clicks (additional method for interaction)
     */
    async handleClick(item) {
        await this.clickHandler.handleCodeAnalysisClick(item);
    }
    /**
     * Handle context menu actions (additional method for interaction)
     */
    async handleContextMenu(action, item) {
        await this.clickHandler.handleContextMenuAction(action, item);
    }
    /**
     * Get the underlying code analysis provider (for backward compatibility)
     */
    getCodeAnalysisProvider() {
        return this.codeAnalysisProvider;
    }
    /**
     * Force refresh the file scanning
     */
    async refreshFileScanning() {
        console.log('CODE_ANALYSIS_MODULAR: Force refreshing file scanning');
        // Delegate to the original provider
        if (typeof this.codeAnalysisProvider.forceRefresh === 'function') {
            await this.codeAnalysisProvider.forceRefresh();
        }
        else {
            // Fallback to regular refresh
            this.codeAnalysisProvider.refresh();
        }
    }
}
exports.CodeAnalysisSectionProvider = CodeAnalysisSectionProvider;


/***/ }),
/* 100 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CodeAnalysisModularItemFactory = exports.CodeAnalysisModularTreeItem = void 0;
const vscode = __importStar(__webpack_require__(1));
const analysisTreeItems_1 = __webpack_require__(101);
/**
 * Code Analysis tree items for the Code Analysis section
 */
class CodeAnalysisModularTreeItem extends vscode.TreeItem {
    codeAnalysisItemType;
    originalCodeAnalysisItem;
    constructor(label, collapsibleState, codeAnalysisItemType, command, iconPath, tooltip, description, contextValue, originalCodeAnalysisItem) {
        super(label, collapsibleState);
        this.codeAnalysisItemType = codeAnalysisItemType;
        this.originalCodeAnalysisItem = originalCodeAnalysisItem;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip || label;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.CodeAnalysisModularTreeItem = CodeAnalysisModularTreeItem;
/**
 * Factory for creating Code Analysis-related tree items
 */
class CodeAnalysisModularItemFactory {
    /**
     * Create "Error loading code analysis" message item
     */
    static createErrorItem() {
        console.log('CODE_ANALYSIS_MODULAR: Creating error loading code analysis item');
        return new CodeAnalysisModularTreeItem('Error loading code analysis', vscode.TreeItemCollapsibleState.None, 'error', undefined, new vscode.ThemeIcon('error'), 'Failed to load code analysis items');
    }
    /**
     * Create "Scanning files..." message item
     */
    static createScanningItem() {
        console.log('CODE_ANALYSIS_MODULAR: Creating scanning files item');
        return new CodeAnalysisModularTreeItem('Scanning files...', vscode.TreeItemCollapsibleState.None, 'scanning', undefined, new vscode.ThemeIcon('loading~spin'), 'Scanning workspace files for analysis');
    }
    /**
     * Create main code analysis section items
     */
    static createCodeAnalysisSections(filesByLanguage, isScanning, context) {
        console.log('CODE_ANALYSIS_MODULAR: Creating code analysis section items');
        if (isScanning) {
            return [CodeAnalysisModularItemFactory.createScanningItem()];
        }
        try {
            // Use the existing factory to get the sections with counts
            const analysisItems = analysisTreeItems_1.CodeAnalysisItemFactory.createCodeAnalysisSectionsWithCounts(filesByLanguage || undefined, isScanning);
            const children = analysisItems.map((item) => {
                // Handle iconPath type conversion
                const iconPath = typeof item.iconPath === 'string'
                    ? new vscode.ThemeIcon(item.iconPath)
                    : item.iconPath;
                // Handle tooltip type conversion
                const tooltip = typeof item.tooltip === 'string'
                    ? item.tooltip
                    : item.tooltip?.value || undefined;
                // Handle description type conversion
                const description = typeof item.description === 'string'
                    ? item.description
                    : undefined;
                // Determine collapsible state and item type
                let itemType = 'subsection';
                if (item.type === 'language-group') {
                    itemType = 'language-group';
                }
                else if (item.type === 'file-item') {
                    itemType = 'file-item';
                }
                return new CodeAnalysisModularTreeItem(typeof item.label === 'string' ? item.label : item.label?.label || 'Unknown', item.collapsibleState || vscode.TreeItemCollapsibleState.None, itemType, item.command, iconPath, tooltip, description, item.contextValue, item);
            });
            console.log(`CODE_ANALYSIS_MODULAR: Created ${children.length} code analysis section items`);
            return children;
        }
        catch (error) {
            console.error('CODE_ANALYSIS_MODULAR: Error creating code analysis sections:', error);
            return [CodeAnalysisModularItemFactory.createErrorItem()];
        }
    }
    /**
     * Create sub-items for a code analysis item (delegate to original provider)
     */
    static async createCodeAnalysisSubItems(item, codeAnalysisProvider) {
        console.log(`CODE_ANALYSIS_MODULAR: Creating sub-items for: ${item.label}`);
        try {
            // Delegate to the original code analysis provider
            const subItems = await codeAnalysisProvider.getChildren(item);
            const children = subItems.map((subItem) => {
                // Handle iconPath type conversion
                const iconPath = typeof subItem.iconPath === 'string'
                    ? new vscode.ThemeIcon(subItem.iconPath)
                    : subItem.iconPath;
                // Handle tooltip type conversion
                const tooltip = typeof subItem.tooltip === 'string'
                    ? subItem.tooltip
                    : subItem.tooltip?.value || undefined;
                // Handle description type conversion
                const description = typeof subItem.description === 'string'
                    ? subItem.description
                    : undefined;
                // Determine item type
                let itemType = 'subsection';
                if (subItem.type === 'language-group') {
                    itemType = 'language-group';
                }
                else if (subItem.type === 'file-item') {
                    itemType = 'file-item';
                }
                return new CodeAnalysisModularTreeItem(typeof subItem.label === 'string' ? subItem.label : subItem.label?.label || 'Unknown', subItem.collapsibleState || vscode.TreeItemCollapsibleState.None, itemType, subItem.command, iconPath, tooltip, description, subItem.contextValue, subItem);
            });
            console.log(`CODE_ANALYSIS_MODULAR: Created ${children.length} sub-items`);
            return children;
        }
        catch (error) {
            console.error('CODE_ANALYSIS_MODULAR: Error creating sub-items:', error);
            return [new CodeAnalysisModularTreeItem('Error loading sub-items', vscode.TreeItemCollapsibleState.None, 'error', undefined, new vscode.ThemeIcon('error'), 'Failed to load code analysis sub-items')];
        }
    }
}
exports.CodeAnalysisModularItemFactory = CodeAnalysisModularItemFactory;


/***/ }),
/* 101 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CodeAnalysisItemFactory = exports.CodeAnalysisTreeItem = void 0;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(5));
const fileDisplayUtils_1 = __webpack_require__(102);
const analysisSettingsStorage_1 = __webpack_require__(62);
const chartRegistry_1 = __webpack_require__(42);
/**
 * Get user-friendly display name for data field
 */
function getFieldDisplayName(fieldName) {
    const fieldNames = {
        'parameters': 'Parameters',
        'lines_count': 'Lines Count',
        'ccn': 'CCN (Complexity)',
        'function_name': 'Function Name',
        'ccn_density': 'CCN Density'
    };
    return fieldNames[fieldName] || fieldName;
}
/**
 * Code Analysis tree item that represents different analysis sections and items
 */
class CodeAnalysisTreeItem extends vscode.TreeItem {
    // Declare properties explicitly (iconPath is inherited from TreeItem)
    type;
    fileInfo;
    languageName;
    constructor(labelOrUri, collapsibleState, type, command, iconPath, tooltip, description, contextValue, fileInfo, languageName) {
        // Call super() FIRST with the appropriate arguments
        if (labelOrUri instanceof vscode.Uri) {
            super(labelOrUri, collapsibleState);
            // After super(), we can set the label
            this.label = path.basename(labelOrUri.fsPath);
        }
        else {
            super(labelOrUri, collapsibleState);
        }
        // NOW assign all properties after super() has been called
        this.type = type;
        // Only assign iconPath if it's defined
        if (iconPath !== undefined) {
            this.iconPath = iconPath;
        }
        // Assign other properties
        if (command !== undefined) {
            this.command = command;
        }
        if (tooltip !== undefined) {
            this.tooltip = tooltip;
        }
        if (description !== undefined) {
            this.description = description;
        }
        if (contextValue !== undefined) {
            this.contextValue = contextValue;
        }
        this.fileInfo = fileInfo;
        this.languageName = languageName;
    }
}
exports.CodeAnalysisTreeItem = CodeAnalysisTreeItem;
/**
 * Factory for creating Code Analysis tree items
 */
class CodeAnalysisItemFactory {
    /**
     * Create the main code analysis sections
     */
    static createCodeAnalysisSections() {
        console.log('[CODE_ANALYSIS] Creating main analysis sections');
        return [
            new CodeAnalysisTreeItem('Active Analyses', vscode.TreeItemCollapsibleState.Collapsed, 'active-analyses', {
                command: 'codeXR.codeAnalysis.showActiveAnalyses',
                title: 'Show Active Analyses'
            }, new vscode.ThemeIcon('pulse'), 'View currently running analyses', '', 'active-analyses'),
            new CodeAnalysisTreeItem('Analysis Settings', vscode.TreeItemCollapsibleState.Collapsed, 'analysis-settings', {
                command: 'codeXR.codeAnalysis.showAnalysisSettings',
                title: 'Show Analysis Settings'
            }, new vscode.ThemeIcon('gear'), 'Configure analysis parameters', '', 'analysis-settings'),
            new CodeAnalysisTreeItem('Project Directory Tree', vscode.TreeItemCollapsibleState.Collapsed, 'project-structure', {
                command: 'codexr.codeanalysis.refreshProjectStructure',
                title: 'Refresh Project Structure'
            }, new vscode.ThemeIcon('folder-library'), 'Browse complete project directory structure', '', 'project-structure'),
            new CodeAnalysisTreeItem('Files by Language', vscode.TreeItemCollapsibleState.Collapsed, 'files-by-language', undefined, // No command - let tree expansion handle the scanning
            new vscode.ThemeIcon('files'), 'Browse project files grouped by language', '', 'files-by-language')
        ];
    }
    /**
     * Create the main code analysis sections with file counts
     */
    static createCodeAnalysisSectionsWithCounts(filesByLanguage, isScanning = false, activeAnalysesSummary) {
        console.log('[CODE_ANALYSIS] Creating main analysis sections with file counts');
        // Calculate file summary if data is available, excluding "Unknown Files"
        let filesByLanguageDescription = '';
        if (isScanning) {
            filesByLanguageDescription = 'Scanning project files...';
            console.log('[CODE_ANALYSIS] Scanning in progress, showing scanning message');
        }
        else if (filesByLanguage && Object.keys(filesByLanguage).length > 0) {
            // Filter out "Unknown Files" from the count
            const analyzableLanguages = Object.entries(filesByLanguage)
                .filter(([languageName]) => languageName !== 'Unknown Files');
            const languageCount = analyzableLanguages.length;
            const totalAnalyzableFiles = analyzableLanguages.reduce((total, [, files]) => total + files.length, 0);
            if (languageCount > 0 && totalAnalyzableFiles > 0) {
                // Create descriptive text
                const languageText = languageCount === 1 ? 'language' : 'languages';
                const fileText = totalAnalyzableFiles === 1 ? 'file' : 'files';
                filesByLanguageDescription = `${languageCount} ${languageText}, ${totalAnalyzableFiles} ${fileText} (analyzable)`;
                console.log(`[CODE_ANALYSIS] Updated description: ${filesByLanguageDescription}`);
            }
            else {
                filesByLanguageDescription = 'No analyzable files found';
                console.log('[CODE_ANALYSIS] No analyzable files found in project');
            }
        }
        else {
            filesByLanguageDescription = 'Ready to analyze';
            console.log('[CODE_ANALYSIS] No file data available, showing ready message');
        }
        // Use the provided active analyses summary or default
        const activeAnalysesLabel = activeAnalysesSummary || 'Active Analyses';
        return [
            new CodeAnalysisTreeItem(activeAnalysesLabel, vscode.TreeItemCollapsibleState.Collapsed, 'active-analyses', {
                command: 'codeXR.codeAnalysis.showActiveAnalyses',
                title: 'Show Active Analyses'
            }, new vscode.ThemeIcon('pulse'), 'View currently running analyses', '', 'active-analyses'),
            new CodeAnalysisTreeItem('Analysis Settings', vscode.TreeItemCollapsibleState.Collapsed, 'analysis-settings', {
                command: 'codeXR.codeAnalysis.showAnalysisSettings',
                title: 'Show Analysis Settings'
            }, new vscode.ThemeIcon('gear'), 'Configure analysis parameters', '', 'analysis-settings'),
            new CodeAnalysisTreeItem('Project Directory Tree', vscode.TreeItemCollapsibleState.Collapsed, 'project-structure', {
                command: 'codexr.codeanalysis.refreshProjectStructure',
                title: 'Refresh Project Structure'
            }, new vscode.ThemeIcon('folder-library'), 'Browse complete project directory structure', 'Hierarchical file explorer', 'project-structure'),
            new CodeAnalysisTreeItem('Files by Language', vscode.TreeItemCollapsibleState.Collapsed, 'files-by-language', undefined, // No command - let tree expansion handle the scanning
            new vscode.ThemeIcon('files'), 'Browse project files grouped by language', filesByLanguageDescription, 'files-by-language')
        ];
    }
    /**
     * Create placeholder items for when sections are expanded
     */
    static async createPlaceholderItems(sectionKey, context) {
        const placeholders = [];
        switch (sectionKey) {
            case 'analysis-settings':
                // Get current analysis mode from storage
                const currentMode = context ?
                    await analysisSettingsStorage_1.AnalysisSettingsStorage.getCurrentAnalysisMode(context) :
                    'Static';
                const modeItem = new CodeAnalysisTreeItem(`Analysis Mode: ${currentMode}`, vscode.TreeItemCollapsibleState.None, 'analysis-item', {
                    command: 'codexr.analysis.toggleMode',
                    title: 'Toggle Analysis Mode',
                    arguments: []
                });
                // Set icon based on current mode - use the returned ThemeIcon directly
                const modeIcon = analysisSettingsStorage_1.AnalysisSettingsStorage.getAnalysisModeIcon(currentMode);
                modeItem.iconPath = modeIcon;
                modeItem.tooltip = `Current analysis mode: ${currentMode}. Click to toggle between XR and Static modes.`;
                modeItem.description = `${currentMode === 'XR' ? 'VR/AR visualization' : 'Standard visualization'}`;
                placeholders.push(modeItem);
                // Get current theme from storage
                const currentTheme = context ?
                    await analysisSettingsStorage_1.AnalysisSettingsStorage.getCurrentTheme(context) :
                    'light';
                const themeItem = new CodeAnalysisTreeItem(`Viewer Theme: ${currentTheme}`, vscode.TreeItemCollapsibleState.None, 'analysis-item', {
                    command: 'codexr.analysis.toggleTheme',
                    title: 'Toggle Viewer Theme',
                    arguments: []
                });
                // Set icon based on current theme
                themeItem.iconPath = currentTheme === 'light' ?
                    new vscode.ThemeIcon('color-mode', new vscode.ThemeColor('foreground')) :
                    new vscode.ThemeIcon('color-mode', new vscode.ThemeColor('charts.orange'));
                themeItem.tooltip = `Current viewer theme: ${currentTheme}. Click to toggle between light and dark themes.`;
                themeItem.description = `${currentTheme === 'light' ? 'Light appearance' : 'Dark appearance'}`;
                placeholders.push(themeItem);
                // Get current auto-analysis delay from storage
                const currentDelay = context ?
                    await analysisSettingsStorage_1.AnalysisSettingsStorage.getAutoAnalysisDelay(context) :
                    0;
                const delayItem = new CodeAnalysisTreeItem(`Auto-Analysis Delay: ${analysisSettingsStorage_1.AnalysisSettingsStorage.getAutoAnalysisDelayLabel(currentDelay)}`, vscode.TreeItemCollapsibleState.None, 'analysis-item', {
                    command: 'codexr.analysis.setAutoAnalysisDelay',
                    title: 'Set Auto-Analysis Delay',
                    arguments: []
                });
                // Set icon for delay setting
                delayItem.iconPath = new vscode.ThemeIcon('clock', new vscode.ThemeColor('charts.blue'));
                delayItem.tooltip = `Current auto-analysis delay: ${analysisSettingsStorage_1.AnalysisSettingsStorage.getAutoAnalysisDelayLabel(currentDelay)}. Click to change the delay before re-analyzing changed files.`;
                delayItem.description = `${currentDelay === 0 ? 'Immediate analysis' : 'Delayed analysis'}`;
                placeholders.push(delayItem);
                // Get current chart type for file analysis
                const currentChartType = context ?
                    await analysisSettingsStorage_1.AnalysisSettingsStorage.getChartTypeFile(context) :
                    'donut';
                const chartTypeItem = new CodeAnalysisTreeItem(`Chart Type (File): ${currentChartType}`, vscode.TreeItemCollapsibleState.None, 'chart-type-file', {
                    command: 'codexr.analysis.selectChartTypeFile',
                    title: 'Select Chart Type for File Analysis',
                    arguments: []
                });
                // Set icon for chart type setting - match analysis mode color
                const chartCurrentMode = context ?
                    await analysisSettingsStorage_1.AnalysisSettingsStorage.getCurrentAnalysisMode(context) :
                    'XR';
                const chartModeColor = chartCurrentMode === 'XR' ? 'charts.purple' : 'charts.green';
                chartTypeItem.iconPath = new vscode.ThemeIcon('graph', new vscode.ThemeColor(chartModeColor));
                chartTypeItem.tooltip = `Current chart type for file analysis: ${currentChartType}. Click to select a different chart type.`;
                chartTypeItem.description = `${currentChartType} chart visualization`;
                placeholders.push(chartTypeItem);
                // Add reset to defaults option
                const resetItem = new CodeAnalysisTreeItem('Reset to default values', vscode.TreeItemCollapsibleState.None, 'reset-settings', {
                    command: 'codexr.analysis.resetSettings',
                    title: 'Reset Analysis Settings to Default Values',
                    arguments: []
                });
                resetItem.iconPath = new vscode.ThemeIcon('refresh', new vscode.ThemeColor('charts.red'));
                resetItem.tooltip = 'Reset all analysis settings to their default values (chart type: boats, default dimension mappings, etc.)';
                resetItem.description = 'Restore defaults';
                placeholders.push(resetItem);
                // Get current dimension mappings for file analysis
                const currentDimensionMappings = context ?
                    await analysisSettingsStorage_1.AnalysisSettingsStorage.getDimensionMappingFile(context) :
                    [];
                const mappedCount = currentDimensionMappings.length;
                const dimensionMappingItem = new CodeAnalysisTreeItem(`Dimension Mapping (File)`, vscode.TreeItemCollapsibleState.Collapsed, 'dimension-mapping-file', undefined, // No command - expandable section
                undefined, // Will be set below based on mapping status
                `Configure dimension mapping for file analysis visualization`, `${mappedCount} mapped`);
                // Set icon based on mapping status - match analysis mode color
                const dimCurrentMode = context ?
                    await analysisSettingsStorage_1.AnalysisSettingsStorage.getCurrentAnalysisMode(context) :
                    'XR';
                const dimModeColor = dimCurrentMode === 'XR' ? 'charts.purple' : 'charts.green';
                dimensionMappingItem.iconPath = mappedCount > 0 ?
                    new vscode.ThemeIcon('settings-gear', new vscode.ThemeColor(dimModeColor)) :
                    new vscode.ThemeIcon('settings-gear', new vscode.ThemeColor('charts.orange'));
                placeholders.push(dimensionMappingItem);
                break;
            case 'dimension-mapping-file':
                // Create dimension items based on the current chart type
                if (context) {
                    const chartType = await analysisSettingsStorage_1.AnalysisSettingsStorage.getChartTypeFile(context);
                    const dimensionMappings = await analysisSettingsStorage_1.AnalysisSettingsStorage.getDimensionMappingFile(context);
                    // Get chart metadata from the registry
                    const chartRegistry = chartRegistry_1.BabiaChartRegistry.getInstance();
                    const chartMetadata = chartRegistry.getChart(chartType);
                    if (chartMetadata) {
                        // Create dimension items for the current chart
                        for (const dimension of chartMetadata.dimensions) {
                            const currentMapping = dimensionMappings.find(m => m.dimension === dimension.name);
                            let description = 'Not mapped';
                            let tooltip = `${dimension.label} - ${dimension.description}`;
                            let iconPath;
                            // Add data type information to tooltip
                            if (dimension.dataType === 'numeric') {
                                tooltip += '\n(numeric values only)';
                            }
                            else {
                                tooltip += '\n(any value type)';
                            }
                            if (currentMapping) {
                                // Get user-friendly field name
                                const fieldDisplayName = getFieldDisplayName(currentMapping.dataField);
                                description = `→ ${fieldDisplayName}`;
                                tooltip += `\nMapped to: ${fieldDisplayName}`;
                                iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
                            }
                            else {
                                tooltip += '\nNot mapped - Click to select field';
                                iconPath = dimension.required
                                    ? new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'))
                                    : new vscode.ThemeIcon('circle-outline');
                            }
                            const dimensionItem = new CodeAnalysisTreeItem(dimension.label || dimension.name, vscode.TreeItemCollapsibleState.None, 'dimension-item-file', {
                                command: 'codexr.analysis.mapDimensionFile',
                                title: 'Map Dimension for File Analysis',
                                arguments: [dimension.name, dimension.dataType, dimension.required]
                            }, iconPath, tooltip, description);
                            placeholders.push(dimensionItem);
                        }
                    }
                    else {
                        // Chart type not found - show placeholder
                        placeholders.push(new CodeAnalysisTreeItem(`Unknown chart type: ${chartType}`, vscode.TreeItemCollapsibleState.None, 'analysis-item', undefined, new vscode.ThemeIcon('error'), 'Chart type not found in registry'));
                    }
                }
                else {
                    // No context - show placeholder
                    placeholders.push(new CodeAnalysisTreeItem('Placeholder dimensions (TODO1, TODO2, TODO3)', vscode.TreeItemCollapsibleState.None, 'dimension-item-file', undefined, new vscode.ThemeIcon('circle-outline'), 'Placeholder dimension mapping'));
                }
                break;
            default:
                // Generic placeholder for other sections
                placeholders.push(new CodeAnalysisTreeItem("Configuration options", vscode.TreeItemCollapsibleState.None, 'analysis-item'));
                break;
        }
        return placeholders;
    } /**
     * Create language group items from scanned files
     */
    static createLanguageGroupItems(filesByLanguage, context) {
        console.log('[CODE_ANALYSIS] Creating language group items from scanned files');
        const languageItems = [];
        // Sort languages by file count (descending), but keep "Unknown Files" at the end
        const sortedLanguages = Object.entries(filesByLanguage)
            .sort(([nameA, filesA], [nameB, filesB]) => {
            // Always put "Unknown Files" at the end
            if (nameA === 'Unknown Files') {
                return 1;
            }
            if (nameB === 'Unknown Files') {
                return -1;
            }
            // Sort others by file count (descending)
            return filesB.length - filesA.length;
        });
        sortedLanguages.forEach(([languageName, files]) => {
            const fileCount = files.length;
            const languageInfo = files.length > 0 ? files[0].language : null;
            // Use shared utility for consistent icon display
            let iconPath;
            if (languageName === 'Unknown Files') {
                iconPath = new vscode.ThemeIcon('question');
            }
            else {
                iconPath = fileDisplayUtils_1.FileDisplayUtils.getFileIcon(languageInfo, context);
            }
            const languageItem = new CodeAnalysisTreeItem(languageName, vscode.TreeItemCollapsibleState.Collapsed, 'language-group', undefined, // No command for language groups
            iconPath, `${languageName} - ${fileCount} files found`, `${fileCount} files`, 'language-group', undefined, languageName);
            languageItems.push(languageItem);
        });
        console.log(`[CODE_ANALYSIS] Created ${languageItems.length} language group items`);
        return languageItems;
    }
    /**
     * Create file items for a specific language using shared utility for consistent display
     */
    static createFileItems(languageName, filesByLanguage, context) {
        console.log(`[ANALYSIS] Creating file items for language: ${languageName}`);
        const files = filesByLanguage[languageName] || [];
        return files.map(fileInfo => {
            const fileUri = vscode.Uri.file(fileInfo.fullPath);
            // Use shared utility for consistent file display
            const fileProperties = fileDisplayUtils_1.FileDisplayUtils.createFileTreeItemProperties(fileInfo.fileName, fileInfo.fullPath, 'language', // Use 'language' view type for relative path description
            undefined, // No file size needed for language view
            context, {
                command: 'codeXR.codeAnalysis.fileClicked',
                title: 'Open File',
                arguments: [fileUri]
            });
            console.log(`[ANALYSIS] File icon setup - Path: ${fileUri.fsPath}, Language: ${fileInfo.language?.name || 'unknown'}`);
            // Create tree item with unified display properties
            const treeItem = new CodeAnalysisTreeItem(path.basename(fileInfo.fileName), vscode.TreeItemCollapsibleState.None, 'file-item', fileProperties.command, fileProperties.iconPath, fileProperties.tooltip, fileProperties.description, // Will show relative path
            'file-item', fileInfo);
            // Set the resource URI for context menu and other VS Code features
            treeItem.resourceUri = fileUri;
            return treeItem;
        });
    }
}
exports.CodeAnalysisItemFactory = CodeAnalysisItemFactory;


/***/ }),
/* 102 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FileDisplayUtils = void 0;
exports.getFileIcon = getFileIcon;
exports.getFileDescription = getFileDescription;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(5));
const languageMetadata_1 = __webpack_require__(103);
/**
 * Shared utility for consistent file display across Code Analysis views
 */
class FileDisplayUtils {
    /**
     * Get the appropriate icon for a file based on its language or extension
     * @param filePathOrLanguage - File path, extension, or language info
     * @param context - VS Code extension context for accessing resources
     * @returns vscode.Uri for colored icon or vscode.ThemeIcon for default
     */
    static getFileIcon(filePathOrLanguage, context) {
        if (!context) {
            console.log('FILE_RENDER: No context available — using default icon');
            return vscode.ThemeIcon.File;
        }
        let languageInfo = null;
        // Determine language info from input
        if (typeof filePathOrLanguage === 'string') {
            // If it's a file path, detect language
            languageInfo = (0, languageMetadata_1.getLanguageForFile)(filePathOrLanguage);
        }
        else if (filePathOrLanguage && typeof filePathOrLanguage === 'object') {
            // If it's already a LanguageInfo object
            languageInfo = filePathOrLanguage;
        }
        if (!languageInfo) {
            console.log('FILE_RENDER: No language detected — using default icon');
            return vscode.ThemeIcon.File;
        }
        // Map language names to colored SVG icon filenames
        const iconMapping = {
            'C': 'c.svg',
            'C++': 'cplusplus.svg',
            'C#': 'csharp.svg',
            'Erlang': 'erlang.svg',
            'Fortran': 'fortran.svg',
            'GDScript': 'godot.svg',
            'Go': 'go.svg',
            'HTML': 'html5.svg',
            'Java': 'java.svg',
            'JavaScript': 'javascript.svg',
            'Kotlin': 'kotlin.svg',
            'Lua': 'lua.svg',
            'Objective-C': 'objectivec.svg',
            'Perl': 'perl.svg',
            'PHP': 'php.svg',
            'Python': 'python.svg',
            'Ruby': 'ruby.svg',
            'Rust': 'rust.svg',
            'Scala': 'scala.svg',
            'Solidity': 'solidity.svg',
            'Swift': 'swift.svg',
            'TTCN-3': 'ttcn3.svg',
            'TypeScript': 'typescript.svg',
            'Vue': 'vuejs.svg',
            'Zig': 'zig.svg'
        };
        const iconFileName = iconMapping[languageInfo.name];
        if (iconFileName) {
            const iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'languages_icons', 'color', iconFileName);
            console.log(`FILE_RENDER: Using colored icon for ${languageInfo.name}: ${iconFileName}`);
            return iconPath;
        }
        console.log(`FILE_RENDER: No colored icon found for ${languageInfo.name} — using default icon`);
        return vscode.ThemeIcon.File;
    }
    /**
     * Get context-appropriate description for a file
     * @param filePath - Full file path
     * @param viewType - Type of view requesting the description
     * @param fileSize - Optional file size in bytes (for project view)
     * @returns Formatted description string
     */
    static getFileDescription(filePath, viewType, fileSize) {
        if (viewType === 'project' && fileSize !== undefined) {
            const formattedSize = this.formatFileSize(fileSize);
            console.log(`FILE_RENDER: Project view description for ${path.basename(filePath)}: ${formattedSize}`);
            return formattedSize;
        }
        if (viewType === 'language') {
            // Get relative path from workspace root
            let relativePath = filePath;
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
                if (filePath.startsWith(workspaceRoot)) {
                    relativePath = path.relative(workspaceRoot, filePath);
                }
            }
            console.log(`FILE_RENDER: Language view description for ${path.basename(filePath)}: ${relativePath}`);
            return relativePath;
        }
        console.log(`FILE_RENDER: No description for ${path.basename(filePath)} in view type ${viewType}`);
        return '';
    }
    /**
     * Format file size in human-readable format
     * @param bytes - File size in bytes
     * @returns Formatted size string (e.g., "12.4 KB")
     */
    static formatFileSize(bytes) {
        if (bytes === 0) {
            return '0 B';
        }
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    /**
     * Create a complete file tree item with unified display logic
     * @param fileName - Name of the file
     * @param filePath - Full path to the file
     * @param viewType - Type of view for context-specific description
     * @param fileSize - Optional file size in bytes
     * @param context - VS Code extension context
     * @param command - Optional command to execute on click
     * @returns Configured vscode.TreeItem properties
     */
    static createFileTreeItemProperties(fileName, filePath, viewType, fileSize, context, command) {
        const iconPath = this.getFileIcon(filePath, context);
        const description = this.getFileDescription(filePath, viewType, fileSize);
        // Create detailed tooltip
        const languageInfo = (0, languageMetadata_1.getLanguageForFile)(filePath);
        const tooltipLines = [];
        tooltipLines.push(`**${fileName}**`);
        tooltipLines.push(`Path: ${filePath}`);
        if (languageInfo) {
            tooltipLines.push(`Language: ${languageInfo.name}`);
        }
        if (fileSize !== undefined) {
            tooltipLines.push(`Size: ${this.formatFileSize(fileSize)}`);
        }
        // Add default file open command if none provided
        const finalCommand = command || {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [vscode.Uri.file(filePath)]
        };
        console.log(`FILE_RENDER: Created tree item properties for ${fileName} in ${viewType} view`);
        return {
            iconPath,
            description,
            tooltip: tooltipLines.join('\n'),
            command: finalCommand
        };
    }
    /**
     * Check if a colored icon exists for a given language
     * @param languageName - Name of the programming language
     * @param context - VS Code extension context
     * @returns true if a colored icon is available
     */
    static hasColoredIcon(languageName, context) {
        if (!context) {
            return false;
        }
        const iconMapping = {
            'C': 'c.svg',
            'C++': 'cplusplus.svg',
            'C#': 'csharp.svg',
            'Erlang': 'erlang.svg',
            'Fortran': 'fortran.svg',
            'GDScript': 'godot.svg',
            'Go': 'go.svg',
            'HTML': 'html5.svg',
            'Java': 'java.svg',
            'JavaScript': 'javascript.svg',
            'Kotlin': 'kotlin.svg',
            'Lua': 'lua.svg',
            'Objective-C': 'objectivec.svg',
            'Perl': 'perl.svg',
            'PHP': 'php.svg',
            'Python': 'python.svg',
            'Ruby': 'ruby.svg',
            'Rust': 'rust.svg',
            'Scala': 'scala.svg',
            'Solidity': 'solidity.svg',
            'Swift': 'swift.svg',
            'TTCN-3': 'ttcn3.svg',
            'TypeScript': 'typescript.svg',
            'Vue': 'vuejs.svg',
            'Zig': 'zig.svg'
        };
        return iconMapping[languageName] !== undefined;
    }
    /**
     * Get all supported languages with colored icons
     * @returns Array of language names that have colored icons
     */
    static getSupportedColoredLanguages() {
        return [
            'C', 'C++', 'C#', 'Erlang', 'Fortran', 'GDScript', 'Go', 'HTML',
            'Java', 'JavaScript', 'Kotlin', 'Lua', 'Objective-C', 'Perl',
            'PHP', 'Python', 'Ruby', 'Rust', 'Scala', 'Solidity', 'Swift',
            'TTCN-3', 'TypeScript', 'Vue', 'Zig'
        ];
    }
}
exports.FileDisplayUtils = FileDisplayUtils;
/**
 * Legacy compatibility - re-export for backwards compatibility
 * @deprecated Use FileDisplayUtils.getFileIcon instead
 */
function getFileIcon(filePathOrLanguage, context) {
    console.log('FILE_RENDER: Using deprecated getFileIcon function, please use FileDisplayUtils.getFileIcon');
    return FileDisplayUtils.getFileIcon(filePathOrLanguage, context);
}
/**
 * Legacy compatibility - re-export for backwards compatibility
 * @deprecated Use FileDisplayUtils.getFileDescription instead
 */
function getFileDescription(filePath, viewType, fileSize) {
    console.log('FILE_RENDER: Using deprecated getFileDescription function, please use FileDisplayUtils.getFileDescription');
    return FileDisplayUtils.getFileDescription(filePath, viewType, fileSize);
}


/***/ }),
/* 103 */
/***/ ((__unused_webpack_module, exports) => {


/**
 * Language metadata for file detection and visualization
 * Maps file extensions to language information including VS Code icons
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ExtensionToLanguageMap = exports.SupportedLanguages = void 0;
exports.getLanguageForFile = getLanguageForFile;
exports.getAllLanguageNames = getAllLanguageNames;
exports.isLanguageSupported = isLanguageSupported;
/**
 * Supported languages with their file extensions and VS Code icon IDs
 */
exports.SupportedLanguages = [
    { name: "HTML", extensions: [".html", ".htm"], iconId: "html" },
    { name: "JavaScript", extensions: [".js", ".mjs"], iconId: "javascript" },
    { name: "Python", extensions: [".py", ".pyw"], iconId: "python" },
    { name: "Ruby", extensions: [".rb", ".rbw"], iconId: "ruby" },
    { name: "C", extensions: [".c", ".h"], iconId: "c" },
    { name: "Go", extensions: [".go"], iconId: "go" },
    { name: "Kotlin", extensions: [".kt", ".kts"], iconId: "kotlin" },
    { name: "Objective-C", extensions: [".m", ".mm"], iconId: "objective-c" },
    { name: "Perl", extensions: [".pl", ".pm"], iconId: "perl" },
    { name: "PHP", extensions: [".php", ".phtml"], iconId: "php" },
    { name: "Scala", extensions: [".scala", ".sc"], iconId: "scala" },
    { name: "Solidity", extensions: [".sol"], iconId: "solidity" },
    { name: "Zig", extensions: [".zig"], iconId: "zig" },
    { name: "C#", extensions: [".cs"], iconId: "csharp" },
    { name: "C++", extensions: [".cpp", ".cxx", ".cc", ".c++", ".hpp", ".hxx", ".hh", ".h++"], iconId: "cpp" },
    { name: "Erlang", extensions: [".erl", ".hrl"], iconId: "erlang" },
    { name: "Fortran", extensions: [".f", ".f90", ".f95", ".f03", ".f08"], iconId: "fortran" },
    { name: "GDScript", extensions: [".gd"], iconId: "gdscript" },
    { name: "Java", extensions: [".java"], iconId: "java" },
    { name: "Lua", extensions: [".lua"], iconId: "lua" },
    { name: "Swift", extensions: [".swift"], iconId: "swift" },
    { name: "TTCN-3", extensions: [".ttcn", ".ttcn3"], iconId: "ttcn3" },
    { name: "TypeScript", extensions: [".ts", ".tsx"], iconId: "typescript" },
    { name: "Vue", extensions: [".vue"], iconId: "vue" },
    { name: "JSON", extensions: [".json"], iconId: "json" },
    { name: "XML", extensions: [".xml"], iconId: "xml" },
    { name: "CSS", extensions: [".css"], iconId: "css" },
    { name: "Markdown", extensions: [".md", ".markdown"], iconId: "markdown" }
];
/**
 * Create a map from file extension to language info for fast lookup
 */
exports.ExtensionToLanguageMap = new Map();
// Initialize the extension map
exports.SupportedLanguages.forEach(lang => {
    lang.extensions.forEach(ext => {
        exports.ExtensionToLanguageMap.set(ext.toLowerCase(), lang);
    });
});
/**
 * Get language info for a file path based on its extension
 * @param filePath The file path to analyze
 * @returns Language info or null if not recognized
 */
function getLanguageForFile(filePath) {
    const extension = getFileExtension(filePath);
    return exports.ExtensionToLanguageMap.get(extension) || null;
}
/**
 * Extract file extension from a file path
 * @param filePath The file path
 * @returns The lowercase extension including the dot (e.g., ".js")
 */
function getFileExtension(filePath) {
    const lastDot = filePath.lastIndexOf('.');
    if (lastDot === -1 || lastDot === filePath.length - 1) {
        return '';
    }
    return filePath.substring(lastDot).toLowerCase();
}
/**
 * Get all supported language names
 */
function getAllLanguageNames() {
    return exports.SupportedLanguages.map(lang => lang.name);
}
/**
 * Check if a language is supported
 */
function isLanguageSupported(languageName) {
    return exports.SupportedLanguages.some(lang => lang.name === languageName);
}


/***/ }),
/* 104 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CodeAnalysisClickHandler = void 0;
const vscode = __importStar(__webpack_require__(1));
/**
 * Handler for Code Analysis section interactions
 */
class CodeAnalysisClickHandler {
    context;
    constructor(context) {
        this.context = context;
    }
    /**
     * Handle clicks on code analysis items
     */
    async handleCodeAnalysisClick(item) {
        console.log(`CODE_ANALYSIS_MODULAR: Handling click on code analysis item: ${item.label} (type: ${item.codeAnalysisItemType})`);
        // For most code analysis items, the command is already attached to the tree item
        // and will be executed automatically by VS Code
        switch (item.codeAnalysisItemType) {
            case 'section':
                console.log('CODE_ANALYSIS_MODULAR: Section item clicked');
                // Section items are typically collapsible, no direct action needed
                break;
            case 'subsection':
                console.log('CODE_ANALYSIS_MODULAR: Subsection item clicked');
                // Subsection items may have commands or be collapsible
                break;
            case 'language-group':
                console.log('CODE_ANALYSIS_MODULAR: Language group clicked');
                // Language groups are typically collapsible to show files
                break;
            case 'file-item':
                console.log('CODE_ANALYSIS_MODULAR: File item clicked');
                // File items typically open the file for editing
                await this.handleFileItemClick(item);
                break;
            case 'scanning':
                console.log('CODE_ANALYSIS_MODULAR: Scanning item clicked - no action');
                break;
            case 'error':
                console.log('CODE_ANALYSIS_MODULAR: Error item clicked - no action');
                break;
            default:
                console.warn(`CODE_ANALYSIS_MODULAR: Unknown code analysis item type: ${item.codeAnalysisItemType}`);
        }
    }
    /**
     * Handle click on file item
     */
    async handleFileItemClick(item) {
        // If the item has a command, let VS Code handle it
        if (item.command) {
            console.log(`CODE_ANALYSIS_MODULAR: File item has command: ${item.command.command}`);
            return; // VS Code will execute the command automatically
        }
        // If no command but we have the original item with file info, try to open the file
        if (item.originalCodeAnalysisItem?.fileInfo) {
            const fileInfo = item.originalCodeAnalysisItem.fileInfo;
            console.log(`CODE_ANALYSIS_MODULAR: Opening file: ${fileInfo.relativePath}`);
            try {
                const document = await vscode.workspace.openTextDocument(fileInfo.fullPath);
                await vscode.window.showTextDocument(document);
            }
            catch (error) {
                console.error(`CODE_ANALYSIS_MODULAR: Error opening file ${fileInfo.relativePath}:`, error);
                vscode.window.showErrorMessage(`Failed to open file: ${fileInfo.relativePath}`);
            }
        }
    }
    /**
     * Handle right-click context menu actions
     */
    async handleContextMenuAction(action, item) {
        console.log(`CODE_ANALYSIS_MODULAR: Handling context menu action: ${action} on item: ${item.label}`);
        switch (action) {
            case 'refresh':
                console.log('CODE_ANALYSIS_MODULAR: Refreshing code analysis view');
                // Refresh will be triggered by the provider
                break;
            case 'openFile':
                if (item.codeAnalysisItemType === 'file-item') {
                    await this.handleFileItemClick(item);
                }
                break;
            case 'analyzeFile':
                await this.handleAnalyzeFile(item);
                break;
            case 'showInExplorer':
                await this.handleShowInExplorer(item);
                break;
            case 'copyPath':
                await this.handleCopyPath(item);
                break;
            case 'scanFiles':
                await this.handleScanFiles();
                break;
            default:
                console.warn(`CODE_ANALYSIS_MODULAR: Unknown context menu action: ${action}`);
        }
    }
    /**
     * Handle analyze file action
     */
    async handleAnalyzeFile(item) {
        console.log(`CODE_ANALYSIS_MODULAR: Analyzing file: ${item.label}`);
        if (item.originalCodeAnalysisItem?.fileInfo) {
            const fileInfo = item.originalCodeAnalysisItem.fileInfo;
            // Execute file analysis command if available
            try {
                await vscode.commands.executeCommand('codeXR.codeAnalysis.analyzeFile', fileInfo.fullPath);
            }
            catch (error) {
                console.error(`CODE_ANALYSIS_MODULAR: Error analyzing file:`, error);
                vscode.window.showErrorMessage(`Failed to analyze file: ${fileInfo.relativePath}`);
            }
        }
        else {
            vscode.window.showWarningMessage('Cannot analyze: file information not available');
        }
    }
    /**
     * Handle show in explorer action
     */
    async handleShowInExplorer(item) {
        console.log(`CODE_ANALYSIS_MODULAR: Showing in explorer: ${item.label}`);
        if (item.originalCodeAnalysisItem?.fileInfo) {
            const fileInfo = item.originalCodeAnalysisItem.fileInfo;
            try {
                await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(fileInfo.fullPath));
            }
            catch (error) {
                console.error(`CODE_ANALYSIS_MODULAR: Error showing in explorer:`, error);
                vscode.window.showErrorMessage(`Failed to show in explorer: ${fileInfo.relativePath}`);
            }
        }
        else {
            vscode.window.showWarningMessage('Cannot show in explorer: file information not available');
        }
    }
    /**
     * Handle copy path action
     */
    async handleCopyPath(item) {
        console.log(`CODE_ANALYSIS_MODULAR: Copying path: ${item.label}`);
        if (item.originalCodeAnalysisItem?.fileInfo) {
            const fileInfo = item.originalCodeAnalysisItem.fileInfo;
            try {
                await vscode.env.clipboard.writeText(fileInfo.fullPath);
                vscode.window.showInformationMessage(`Copied path: ${fileInfo.relativePath}`);
            }
            catch (error) {
                console.error(`CODE_ANALYSIS_MODULAR: Error copying path:`, error);
                vscode.window.showErrorMessage(`Failed to copy path: ${fileInfo.relativePath}`);
            }
        }
        else {
            vscode.window.showWarningMessage('Cannot copy path: file information not available');
        }
    }
    /**
     * Handle scan files action
     */
    async handleScanFiles() {
        console.log('CODE_ANALYSIS_MODULAR: Triggering file scan');
        try {
            await vscode.commands.executeCommand('codeXR.codeAnalysis.scanFiles');
            vscode.window.showInformationMessage('File scanning initiated');
        }
        catch (error) {
            console.error('CODE_ANALYSIS_MODULAR: Error triggering file scan:', error);
            vscode.window.showErrorMessage('Failed to initiate file scanning');
        }
    }
}
exports.CodeAnalysisClickHandler = CodeAnalysisClickHandler;


/***/ }),
/* 105 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CodeAnalysisTreeDataProvider = void 0;
const vscode = __importStar(__webpack_require__(1));
const analysisTreeItems_1 = __webpack_require__(101);
const fileScanner_1 = __webpack_require__(106);
const activeAnalysesTreeView_1 = __webpack_require__(107);
const activeAnalysesCommands_1 = __webpack_require__(109);
const fileWatcherManager_1 = __webpack_require__(110);
/**
 * Code Analysis tree data provider that manages the analysis sections
 *
 * Architecture Notes:
 * - This view provides code analysis functionality
 * - Displays active analyses, settings, and file organization
 * - Follows the same patterns as other sections in the unified view
 */
class CodeAnalysisTreeDataProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    filesByLanguage = null;
    isScanning = false;
    activeAnalysesProvider;
    activeAnalysesCommands;
    fileWatcherManager;
    constructor(context) {
        this.context = context;
        console.log('[CODE_ANALYSIS] Code analysis tree data provider initialized');
        // Initialize the active analyses provider and commands
        this.activeAnalysesProvider = new activeAnalysesTreeView_1.ActiveAnalysesTreeDataProvider(context);
        this.activeAnalysesCommands = new activeAnalysesCommands_1.ActiveAnalysesCommands(context);
        this.fileWatcherManager = fileWatcherManager_1.FileWatcherManager.getInstance(context);
        // Listen to Active Analyses changes to refresh the main tree
        this.activeAnalysesProvider.onDidChangeTreeData(() => {
            console.log('[CODE_ANALYSIS] 🔄 Active Analyses changed, refreshing main tree view');
            this.refresh();
        });
        // Start file scanning in the background for better UX
        this.initializeFileScanning();
    }
    /**
     * Initialize file scanning in background for better user experience
     */
    async initializeFileScanning() {
        try {
            console.log('[CODE_ANALYSIS] Starting initial background file scanning...');
            this.isScanning = true;
            // Scan files in background
            this.filesByLanguage = await fileScanner_1.FileScanner.scanWorkspaceFiles();
            this.isScanning = false;
            const status = this.getScanningStatus();
            console.log(`[CODE_ANALYSIS] Initial background file scan completed - Found ${status.fileCount} files in ${status.languageCount} languages`);
            // Refresh the tree to show updated counts
            this.refresh();
        }
        catch (error) {
            console.error('[CODE_ANALYSIS] Error during initial background file scanning:', error);
            this.isScanning = false;
        }
    }
    /**
     * Force refresh file scan data (clears existing data and rescans)
     */
    async forceRefreshFilesScan() {
        console.log('[CODE_ANALYSIS] Force refreshing files scan');
        this.filesByLanguage = null;
        this.isScanning = false;
        // Trigger a new scan
        await this.initializeFileScanning();
    }
    /**
     * Get current scanning status
     */
    isCurrentlyScanning() {
        return this.isScanning;
    }
    /**
     * Check if files have been scanned
     */
    hasScannedFiles() {
        return this.filesByLanguage !== null;
    }
    /**
     * Get scanning status for debugging
     */
    getScanningStatus() {
        const fileCount = this.filesByLanguage ?
            Object.values(this.filesByLanguage).reduce((total, files) => total + files.length, 0) : 0;
        const languageCount = this.filesByLanguage ? Object.keys(this.filesByLanguage).length : 0;
        return {
            isScanning: this.isScanning,
            hasData: this.filesByLanguage !== null,
            fileCount,
            languageCount
        };
    }
    /**
     * Refresh the tree view
     */
    refresh() {
        console.log('[CODE_ANALYSIS] Refreshing code analysis tree view');
        this._onDidChangeTreeData.fire();
    }
    /**
     * Get tree item representation
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Get children for the tree view
     */
    getChildren(element) {
        if (!element) {
            // Root level - return the main analysis sections with file counts if available
            console.log('[CODE_ANALYSIS] Loading root analysis sections');
            return Promise.resolve(analysisTreeItems_1.CodeAnalysisItemFactory.createCodeAnalysisSectionsWithCounts(this.filesByLanguage || undefined, this.isScanning, this.activeAnalysesProvider.getActiveAnalysesSummary()));
        }
        // Handle expanding sections
        switch (element.type) {
            case 'active-analyses':
                console.log('[CODE_ANALYSIS] Loading Active Analyses children');
                return Promise.resolve(this.activeAnalysesProvider.getActiveAnalysesTreeItems());
            case 'analysis-settings':
                console.log('[CODE_ANALYSIS] Loading Analysis Settings children');
                return analysisTreeItems_1.CodeAnalysisItemFactory.createPlaceholderItems('analysis-settings', this.context);
            case 'project-structure':
                console.log('[CODE_ANALYSIS] Loading Project Structure children');
                return analysisTreeItems_1.CodeAnalysisItemFactory.createPlaceholderItems('project-structure', this.context);
            case 'files-by-language':
                console.log('[CODE_ANALYSIS] Loading Files by Language children');
                return this.getFilesByLanguageChildren();
            case 'language-group':
                console.log(`[CODE_ANALYSIS] Loading files for language: ${element.languageName}`);
                return this.getLanguageGroupChildren(element.languageName);
            case 'dimension-mapping-file':
                console.log('[CODE_ANALYSIS] Loading Dimension Mapping (File) children');
                return analysisTreeItems_1.CodeAnalysisItemFactory.createPlaceholderItems('dimension-mapping-file', this.context);
            default:
                console.log('[CODE_ANALYSIS] No children available for this item type');
                return Promise.resolve([]);
        }
    }
    /**
     * Get the main code analysis sections for integration with unified view
     */
    getCodeAnalysisSections() {
        console.log('[CODE_ANALYSIS] Getting code analysis sections for unified view');
        return analysisTreeItems_1.CodeAnalysisItemFactory.createCodeAnalysisSectionsWithCounts(this.filesByLanguage || undefined, this.isScanning, this.activeAnalysesProvider.getActiveAnalysesSummary());
    }
    /**
     * Get children for a specific section type (used by unified view)
     */
    getSectionChildren(sectionType) {
        console.log(`[CODE_ANALYSIS] Getting children for section: ${sectionType}`);
        if (sectionType === 'files-by-language') {
            return this.getFilesByLanguageChildren();
        }
        if (sectionType === 'project-structure') {
            return analysisTreeItems_1.CodeAnalysisItemFactory.createPlaceholderItems('project-structure', this.context);
        }
        if (sectionType === 'dimension-mapping-file') {
            return analysisTreeItems_1.CodeAnalysisItemFactory.createPlaceholderItems('dimension-mapping-file', this.context);
        }
        return analysisTreeItems_1.CodeAnalysisItemFactory.createPlaceholderItems(sectionType, this.context);
    }
    /**
     * Get children for Files by Language section - triggers file scanning
     */
    async getFilesByLanguageChildren() {
        console.log('[CODE_ANALYSIS] Getting Files by Language children');
        // Prevent multiple concurrent scans
        if (this.isScanning) {
            console.log('[CODE_ANALYSIS] Scan already in progress, returning scanning indicator');
            return [new analysisTreeItems_1.CodeAnalysisTreeItem('Scanning files...', vscode.TreeItemCollapsibleState.None, 'analysis-item', undefined, new vscode.ThemeIcon('loading~spin'), 'File scan in progress', 'Please wait', 'scanning')];
        }
        try {
            // Trigger file scan if not already done
            if (!this.filesByLanguage) {
                console.log('ANALYSIS: Scanning files for language analysis...');
                this.isScanning = true;
                this.filesByLanguage = await fileScanner_1.FileScanner.scanWorkspaceFiles();
                this.isScanning = false;
                console.log('[CODE_ANALYSIS] File scan completed, refreshing tree view');
                // Refresh the entire tree to update the root label with counts
                this.refresh();
            }
            // Create language group items
            const languageItems = analysisTreeItems_1.CodeAnalysisItemFactory.createLanguageGroupItems(this.filesByLanguage, this.context);
            if (languageItems.length === 0) {
                return [new analysisTreeItems_1.CodeAnalysisTreeItem('No files found', vscode.TreeItemCollapsibleState.None, 'analysis-item', undefined, new vscode.ThemeIcon('info'), 'No files detected in workspace', '', 'no-files')];
            }
            console.log(`[CODE_ANALYSIS] Returning ${languageItems.length} language groups`);
            return languageItems;
        }
        catch (error) {
            console.error('[CODE_ANALYSIS] Error getting Files by Language children:', error);
            this.isScanning = false;
            return [new analysisTreeItems_1.CodeAnalysisTreeItem('Error scanning files', vscode.TreeItemCollapsibleState.None, 'analysis-item', undefined, new vscode.ThemeIcon('error'), `Failed to scan workspace files: ${error}`, 'Error', 'scan-error')];
        }
    }
    /**
     * Get children for a specific language group
     */
    getLanguageGroupChildren(languageName) {
        console.log(`[CODE_ANALYSIS] Getting children for language group: ${languageName}`);
        if (!this.filesByLanguage) {
            console.warn('[CODE_ANALYSIS] No file data available for language group');
            return Promise.resolve([]);
        }
        // ✅ Pass context for colored language icons
        const fileItems = analysisTreeItems_1.CodeAnalysisItemFactory.createFileItems(languageName, this.filesByLanguage, this.context);
        return Promise.resolve(fileItems);
    }
    /**
     * Legacy method for backward compatibility - use forceRefreshFilesScan instead
     * @deprecated Use forceRefreshFilesScan() instead
     */
    async refreshFilesScan() {
        console.log('[CODE_ANALYSIS] Legacy refreshFilesScan called, delegating to forceRefreshFilesScan');
        await this.forceRefreshFilesScan();
    }
    /**
     * Get the active analyses provider for external access
     */
    getActiveAnalysesProvider() {
        return this.activeAnalysesProvider;
    }
    /**
     * Get the file watcher manager for external access
     */
    getFileWatcherManager() {
        return this.fileWatcherManager;
    }
    /**
     * Start tracking a file analysis
     */
    startFileAnalysis(filePath, mode, language) {
        console.log(`[CODE_ANALYSIS] Starting file analysis tracking for ${filePath}`);
        return this.activeAnalysesProvider.startFileAnalysis(filePath, mode, language);
    }
    /**
     * Start tracking a directory analysis
     */
    startDirectoryAnalysis(directoryPath, mode) {
        console.log(`[CODE_ANALYSIS] Starting directory analysis tracking for ${directoryPath}`);
        return this.activeAnalysesProvider.startDirectoryAnalysis(directoryPath, mode);
    }
    /**
     * Complete an analysis
     */
    completeAnalysis(analysisId, metadata) {
        this.activeAnalysesProvider.completeAnalysis(analysisId, metadata);
    }
    /**
     * Fail an analysis
     */
    failAnalysis(analysisId, error) {
        this.activeAnalysesProvider.failAnalysis(analysisId, error);
    }
}
exports.CodeAnalysisTreeDataProvider = CodeAnalysisTreeDataProvider;


/***/ }),
/* 106 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FileScanner = void 0;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(5));
const languageMetadata_1 = __webpack_require__(103);
/**
 * Scanner for analyzing workspace files and grouping them by programming language
 */
class FileScanner {
    /**
     * Scan all workspace folders and group files by language
     * @returns Promise with files grouped by language
     */
    static async scanWorkspaceFiles() {
        console.log('ANALYSIS: Starting workspace file scan');
        const startTime = Date.now();
        const filesByLanguage = {};
        try {
            // Find all files in the workspace, excluding common build/cache directories and dot folders
            console.log('ANALYSIS: Searching for files using vscode.workspace.findFiles');
            const files = await vscode.workspace.findFiles('**/*', '{**/node_modules/**,**/.venv/**,**/.git/**,**/.svn/**,**/.hg/**,**/.*/**,**/build/**,**/dist/**,**/out/**,**/bin/**,**/__pycache__/**,**/.pytest_cache/**,**/.mypy_cache/**,**/.tox/**,**/.coverage/**}');
            console.log(`ANALYSIS: Found ${files.length} files to analyze`);
            // Filter out directories and process each file
            let processedCount = 0;
            let skippedCount = 0;
            for (const fileUri of files) {
                try {
                    // Get file stats to check if it's a directory
                    const stat = await vscode.workspace.fs.stat(fileUri);
                    // Skip directories
                    if (stat.type === vscode.FileType.Directory) {
                        skippedCount++;
                        continue;
                    }
                    // Process the file
                    const fileInfo = this.createFileInfo(fileUri);
                    this.addFileToLanguageGroup(filesByLanguage, fileInfo);
                    processedCount++;
                    // Log progress for large workspaces
                    if (processedCount % 100 === 0) {
                        console.log(`ANALYSIS: Processed ${processedCount} files so far...`);
                    }
                }
                catch (error) {
                    console.warn(`ANALYSIS: Error processing file ${fileUri.fsPath}:`, error);
                    skippedCount++;
                }
            }
            const endTime = Date.now();
            const duration = endTime - startTime;
            console.log(`ANALYSIS: File scan completed in ${duration}ms`);
            console.log(`ANALYSIS: Processed ${processedCount} files, skipped ${skippedCount} items`);
            console.log(`ANALYSIS: Found files in ${Object.keys(filesByLanguage).length} different languages`);
            // Log language distribution
            this.logLanguageDistribution(filesByLanguage);
            return filesByLanguage;
        }
        catch (error) {
            console.error('ANALYSIS: Error during workspace file scan:', error);
            throw error;
        }
    }
    /**
     * Create file info object from VS Code URI
     */
    static createFileInfo(fileUri) {
        const fullPath = fileUri.fsPath;
        const fileName = path.basename(fullPath);
        // Get relative path from workspace root
        let relativePath = fullPath;
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            if (fullPath.startsWith(workspaceRoot)) {
                relativePath = path.relative(workspaceRoot, fullPath);
            }
        }
        // Determine language based on file extension
        const language = (0, languageMetadata_1.getLanguageForFile)(fullPath);
        return {
            fileName,
            relativePath,
            fullPath,
            language
        };
    }
    /**
     * Add file to the appropriate language group
     */
    static addFileToLanguageGroup(filesByLanguage, fileInfo) {
        const languageName = fileInfo.language?.name || 'Unknown Files';
        if (!filesByLanguage[languageName]) {
            filesByLanguage[languageName] = [];
        }
        filesByLanguage[languageName].push(fileInfo);
    }
    /**
     * Log the distribution of files by language
     */
    static logLanguageDistribution(filesByLanguage) {
        console.log('ANALYSIS: File distribution by language:');
        // Sort languages by file count (descending)
        const sortedLanguages = Object.entries(filesByLanguage)
            .sort(([, filesA], [, filesB]) => filesB.length - filesA.length);
        sortedLanguages.forEach(([language, files]) => {
            console.log(`ANALYSIS: Detected ${files.length} files of ${language}`);
        });
        const totalLanguages = sortedLanguages.length;
        const totalFiles = sortedLanguages.reduce((sum, [, files]) => sum + files.length, 0);
        console.log(`ANALYSIS: Total: ${totalLanguages} languages, ${totalFiles} files detected`);
    }
    /**
     * Get files for a specific language
     */
    static getFilesForLanguage(filesByLanguage, languageName) {
        return filesByLanguage[languageName] || [];
    }
    /**
     * Get all detected languages sorted by file count
     */
    static getLanguagesSortedByCount(filesByLanguage) {
        return Object.entries(filesByLanguage)
            .sort(([, filesA], [, filesB]) => filesB.length - filesA.length)
            .map(([language]) => language);
    }
    /**
     * Get total file count across all languages
     */
    static getTotalFileCount(filesByLanguage) {
        return Object.values(filesByLanguage)
            .reduce((total, files) => total + files.length, 0);
    }
}
exports.FileScanner = FileScanner;


/***/ }),
/* 107 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ActiveAnalysesTreeDataProvider = void 0;
const vscode = __importStar(__webpack_require__(1));
const activeAnalysisRegistry_1 = __webpack_require__(69);
const activeAnalysisItems_1 = __webpack_require__(108);
const analysisTreeItems_1 = __webpack_require__(101);
/**
 * Tree data provider for the Active Analyses section
 * This handles the rendering and management of the Active Analyses tree view
 */
class ActiveAnalysesTreeDataProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    registry;
    constructor(context) {
        this.context = context;
        console.log('[ACTIVE_ANALYSES_TREE] Initializing Active Analyses tree data provider');
        // Get the registry instance
        this.registry = activeAnalysisRegistry_1.ActiveAnalysisRegistry.getInstance();
        // Listen for changes in the registry
        this.registry.onDidChangeAnalyses(() => {
            console.log('[ACTIVE_ANALYSES_TREE] Registry changed, refreshing tree view');
            this.refresh();
        });
    }
    /**
     * Refresh the tree view
     */
    refresh() {
        console.log('[ACTIVE_ANALYSES_TREE] Refreshing active analyses tree view');
        this._onDidChangeTreeData.fire();
    }
    /**
     * Get tree item representation
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Get children for the tree view
     */
    getChildren(element) {
        console.log('[ACTIVE_ANALYSES_TREE_VIEW] 🌲 getChildren called, element:', element?.label);
        if (!element) {
            // Root level - return all active analyses
            const allAnalyses = this.registry.getAllAnalyses();
            console.log('[ACTIVE_ANALYSES_TREE_VIEW] 📊 Retrieved analyses from registry:', allAnalyses.length);
            const treeItems = activeAnalysisItems_1.ActiveAnalysisItemFactory.createActiveAnalysisItems(allAnalyses);
            console.log('[ACTIVE_ANALYSES_TREE_VIEW] 🔄 Created tree items:', treeItems.length);
            return treeItems;
        }
        // No children for individual analysis items
        return [];
    }
    /**
     * Get the active analyses items for display
     */
    getActiveAnalysesItems() {
        const analyses = this.registry.getAllAnalyses();
        console.log(`[ACTIVE_ANALYSES_TREE] Found ${analyses.length} active analyses`);
        // Create items for each analysis
        return activeAnalysisItems_1.ActiveAnalysisItemFactory.createActiveAnalysisItems(analyses);
    }
    /**
     * Get summary of active analyses for the parent tree view
     */
    getActiveAnalysesSummary() {
        const summary = this.registry.getSummary();
        if (summary.total === 0) {
            return 'Active Analyses';
        }
        if (summary.running > 0) {
            return `Active Analyses (${summary.running} running)`;
        }
        return `Active Analyses (${summary.total} total)`;
    }
    /**
     * Get the tree items that should be displayed when this section is expanded
     * This method is called by the parent code analysis tree view
     * Returns CodeAnalysisTreeItem for compatibility with parent tree
     */
    getActiveAnalysesTreeItems() {
        const activeAnalysisItems = this.getActiveAnalysesItems();
        // Convert ActiveAnalysisTreeItem to CodeAnalysisTreeItem for compatibility
        return activeAnalysisItems.map(item => {
            return new analysisTreeItems_1.CodeAnalysisTreeItem(item.label, item.collapsibleState || vscode.TreeItemCollapsibleState.None, 'analysis-item', // Use generic analysis-item type for compatibility
            item.command, item.iconPath, item.tooltip, item.description, item.contextValue);
        });
    }
    /**
     * Check if there are any active analyses
     */
    hasActiveAnalyses() {
        return this.registry.getAllAnalyses().length > 0;
    }
    /**
     * Get count of running analyses
     */
    getRunningCount() {
        return this.registry.getActiveCount();
    }
    /**
     * Get count of total analyses
     */
    getTotalCount() {
        return this.registry.getAllAnalyses().length;
    }
    /**
     * Start tracking a new file analysis
     */
    startFileAnalysis(filePath, mode, language) {
        console.log(`[ACTIVE_ANALYSES_TREE] Starting file analysis for ${filePath} in ${mode} mode`);
        return this.registry.startFileAnalysis(filePath, mode, language);
    }
    /**
     * Start tracking a new directory analysis
     */
    startDirectoryAnalysis(directoryPath, mode) {
        console.log(`[ACTIVE_ANALYSES_TREE] Starting directory analysis for ${directoryPath} in ${mode} mode`);
        return this.registry.startDirectoryAnalysis(directoryPath, mode);
    }
    /**
     * Complete an analysis
     */
    completeAnalysis(analysisId, metadata) {
        console.log(`[ACTIVE_ANALYSES_TREE] Completing analysis ${analysisId}`);
        this.registry.completeAnalysis(analysisId, metadata);
    }
    /**
     * Fail an analysis
     */
    failAnalysis(analysisId, error) {
        console.log(`[ACTIVE_ANALYSES_TREE] Failing analysis ${analysisId}: ${error}`);
        this.registry.failAnalysis(analysisId, error);
    }
    /**
     * Remove an analysis from tracking
     */
    removeAnalysis(analysisId) {
        console.log(`[ACTIVE_ANALYSES_TREE] Removing analysis ${analysisId}`);
        this.registry.unregisterAnalysis(analysisId);
    }
    /**
     * Clear all analyses
     */
    clearAllAnalyses() {
        console.log('[ACTIVE_ANALYSES_TREE] Clearing all analyses');
        this.registry.clearAll();
    }
}
exports.ActiveAnalysesTreeDataProvider = ActiveAnalysesTreeDataProvider;


/***/ }),
/* 108 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ActiveAnalysisItemFactory = exports.ActiveAnalysisTreeItem = void 0;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(5));
/**
 * Tree item representing an active analysis in the VS Code tree view
 */
class ActiveAnalysisTreeItem extends vscode.TreeItem {
    type;
    analysis;
    constructor(labelOrUri, collapsibleState, type, command, iconPath, tooltip, description, contextValue, analysis) {
        // Call super() first with the appropriate arguments
        if (labelOrUri instanceof vscode.Uri) {
            super(labelOrUri, collapsibleState);
            this.label = path.basename(labelOrUri.fsPath);
        }
        else {
            super(labelOrUri, collapsibleState);
        }
        // Assign properties after super() call
        this.type = type;
        this.analysis = analysis;
        if (iconPath !== undefined) {
            this.iconPath = iconPath;
        }
        if (command !== undefined) {
            this.command = command;
        }
        if (tooltip !== undefined) {
            this.tooltip = tooltip;
        }
        if (description !== undefined) {
            this.description = description;
        }
        if (contextValue !== undefined) {
            this.contextValue = contextValue;
        }
    }
}
exports.ActiveAnalysisTreeItem = ActiveAnalysisTreeItem;
/**
 * Factory for creating active analysis tree items
 */
class ActiveAnalysisItemFactory {
    /**
     * Create tree items for active analyses
     */
    static createActiveAnalysisItems(analyses) {
        console.log(`[ACTIVE_ANALYSIS_ITEMS] 🏗️ Creating ${analyses.length} active analysis items`);
        if (analyses.length === 0) {
            console.log('[ACTIVE_ANALYSIS_ITEMS] 📝 No analyses, creating placeholder item');
            return [this.createNoAnalysesItem()];
        }
        const treeItems = analyses.map(analysis => {
            console.log(`[ACTIVE_ANALYSIS_ITEMS] 🔧 Creating item for analysis:`, {
                id: analysis.id,
                path: analysis.path,
                status: analysis.status,
                mode: analysis.mode,
                language: analysis.language
            });
            return this.createAnalysisItem(analysis);
        });
        console.log(`[ACTIVE_ANALYSIS_ITEMS] ✅ Created ${treeItems.length} tree items successfully`);
        return treeItems;
    }
    /**
     * Create a tree item for a single active analysis
     */
    static createAnalysisItem(analysis) {
        const fileName = path.basename(analysis.path);
        const isDirectory = analysis.id.startsWith('dir-');
        // Determine label based on status and progress
        let label = fileName;
        if (analysis.progress !== undefined && analysis.status === 'running') {
            label = `${fileName} (${analysis.progress}%)`;
        }
        // Determine icon based on status
        let iconPath;
        switch (analysis.status) {
            case 'running':
                iconPath = new vscode.ThemeIcon('loading~spin');
                break;
            case 'completed':
                iconPath = new vscode.ThemeIcon('check-all', new vscode.ThemeColor('charts.green'));
                break;
            case 'failed':
                iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
                break;
            case 'paused':
                iconPath = new vscode.ThemeIcon('debug-pause', new vscode.ThemeColor('charts.yellow'));
                break;
            default:
                iconPath = new vscode.ThemeIcon('pulse');
        }
        // Create description
        let description = `${analysis.mode} analysis`;
        if (analysis.language) {
            description += ` • ${analysis.language}`;
        }
        // Create tooltip
        let tooltip = `Path: ${analysis.path}\\n`;
        tooltip += `Mode: ${analysis.mode}\\n`;
        tooltip += `Status: ${analysis.status}\\n`;
        tooltip += `Started: ${analysis.timestamp.toLocaleString()}`;
        if (analysis.error) {
            tooltip += `\\nError: ${analysis.error}`;
        }
        if (analysis.metadata) {
            if (analysis.metadata.totalLines) {
                tooltip += `\\nLines: ${analysis.metadata.totalLines}`;
            }
            if (analysis.metadata.totalFunctions) {
                tooltip += `\\nFunctions: ${analysis.metadata.totalFunctions}`;
            }
        }
        const type = isDirectory ? 'active-analysis-directory' : 'active-analysis-file';
        return new ActiveAnalysisTreeItem(label, vscode.TreeItemCollapsibleState.None, type, {
            command: 'codexr.activeAnalysis.openAnalysis',
            title: 'Open Analysis',
            arguments: [analysis.id]
        }, iconPath, tooltip, description, `active-analysis-${analysis.status}`, analysis);
    }
    /**
     * Create a placeholder item when no analyses are active
     */
    static createNoAnalysesItem() {
        return new ActiveAnalysisTreeItem('No active analyses', vscode.TreeItemCollapsibleState.None, 'active-analysis-placeholder', undefined, new vscode.ThemeIcon('info'), 'No analyses are currently running or tracked', 'Start an analysis to see it here', 'no-active-analyses');
    }
    /**
     * Create summary items showing analysis statistics
     */
    static createSummaryItems(summary) {
        const items = [];
        if (summary.total === 0) {
            return [this.createNoAnalysesItem()];
        }
        // Running analyses
        if (summary.running > 0) {
            items.push(new ActiveAnalysisTreeItem(`${summary.running} Running`, vscode.TreeItemCollapsibleState.None, 'active-analysis-section', undefined, new vscode.ThemeIcon('loading~spin'), `${summary.running} analyses currently in progress`, 'In progress', 'running-analyses'));
        }
        // Completed analyses
        if (summary.completed > 0) {
            items.push(new ActiveAnalysisTreeItem(`${summary.completed} Completed`, vscode.TreeItemCollapsibleState.None, 'active-analysis-section', undefined, new vscode.ThemeIcon('check-all', new vscode.ThemeColor('charts.green')), `${summary.completed} analyses completed successfully`, 'Finished', 'completed-analyses'));
        }
        // Failed analyses
        if (summary.failed > 0) {
            items.push(new ActiveAnalysisTreeItem(`${summary.failed} Failed`, vscode.TreeItemCollapsibleState.None, 'active-analysis-section', undefined, new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red')), `${summary.failed} analyses failed`, 'Errors', 'failed-analyses'));
        }
        return items;
    }
}
exports.ActiveAnalysisItemFactory = ActiveAnalysisItemFactory;


/***/ }),
/* 109 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ActiveAnalysesCommands = void 0;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(5));
const activeAnalysisRegistry_1 = __webpack_require__(69);
const serverControl_1 = __webpack_require__(19);
const activeServerRegistry_1 = __webpack_require__(17);
/**
 * Commands for managing active analyses
 */
class ActiveAnalysesCommands {
    context;
    registry;
    constructor(context) {
        this.context = context;
        this.registry = activeAnalysisRegistry_1.ActiveAnalysisRegistry.getInstance();
        this.registerCommands();
    }
    /**
     * Register all active analysis commands
     */
    registerCommands() {
        console.log('[ACTIVE_ANALYSES_COMMANDS] Registering active analysis commands');
        // Open analysis command
        const openAnalysisCommand = vscode.commands.registerCommand('codexr.activeAnalysis.openAnalysis', (analysisId) => this.openAnalysis(analysisId));
        // Reveal analysis in explorer
        const revealAnalysisCommand = vscode.commands.registerCommand('codexr.activeAnalysis.revealAnalysis', (analysisId) => this.revealAnalysis(analysisId));
        // Remove analysis
        const removeAnalysisCommand = vscode.commands.registerCommand('codexr.activeAnalysis.removeAnalysis', (analysisId) => this.removeAnalysis(analysisId));
        // Clear all analyses
        const clearAllCommand = vscode.commands.registerCommand('codexr.activeAnalysis.clearAll', () => this.clearAllAnalyses());
        // Refresh active analyses view
        const refreshCommand = vscode.commands.registerCommand('codexr.activeAnalysis.refresh', () => this.refreshView());
        // Re-run analysis
        const rerunAnalysisCommand = vscode.commands.registerCommand('codexr.activeAnalysis.rerun', (analysisId) => this.rerunAnalysis(analysisId));
        // Stop analysis (stops server and removes analysis)
        const stopAnalysisCommand = vscode.commands.registerCommand('codexr.activeAnalysis.stopAnalysis', (analysisId) => this.stopAnalysis(analysisId));
        // Add all commands to context subscriptions
        this.context.subscriptions.push(openAnalysisCommand, revealAnalysisCommand, removeAnalysisCommand, clearAllCommand, refreshCommand, rerunAnalysisCommand, stopAnalysisCommand);
        console.log('[ACTIVE_ANALYSES_COMMANDS] Active analysis commands registered successfully');
    }
    /**
     * Open the analysis file or result
     */
    async openAnalysis(analysisId) {
        console.log(`[ACTIVE_ANALYSES_COMMANDS] Opening analysis: ${analysisId}`);
        const analysis = this.registry.getAnalysis(analysisId);
        if (!analysis) {
            vscode.window.showWarningMessage(`Analysis ${analysisId} not found`);
            return;
        }
        try {
            // Try to open the file/directory
            const uri = vscode.Uri.file(analysis.path);
            if (analysis.id.startsWith('dir-')) {
                // For directory analysis, try to show the results or open the directory
                await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: false });
            }
            else {
                // For file analysis, open the file
                const document = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(document);
            }
        }
        catch (error) {
            console.error('[ACTIVE_ANALYSES_COMMANDS] Error opening analysis:', error);
            vscode.window.showErrorMessage(`Failed to open analysis: ${error}`);
        }
    }
    /**
     * Reveal analysis file in the explorer
     */
    async revealAnalysis(analysisId) {
        console.log(`[ACTIVE_ANALYSES_COMMANDS] Revealing analysis: ${analysisId}`);
        const analysis = this.registry.getAnalysis(analysisId);
        if (!analysis) {
            vscode.window.showWarningMessage(`Analysis ${analysisId} not found`);
            return;
        }
        try {
            const uri = vscode.Uri.file(analysis.path);
            await vscode.commands.executeCommand('revealInExplorer', uri);
        }
        catch (error) {
            console.error('[ACTIVE_ANALYSES_COMMANDS] Error revealing analysis:', error);
            vscode.window.showErrorMessage(`Failed to reveal analysis: ${error}`);
        }
    }
    /**
     * Remove an analysis from the active list
     */
    async removeAnalysis(analysisId) {
        console.log(`[ACTIVE_ANALYSES_COMMANDS] Removing analysis: ${analysisId}`);
        const analysis = this.registry.getAnalysis(analysisId);
        if (!analysis) {
            vscode.window.showWarningMessage(`Analysis ${analysisId} not found`);
            return;
        }
        const result = await vscode.window.showWarningMessage(`Remove analysis for ${analysis.path}?`, { modal: true }, 'Remove');
        if (result === 'Remove') {
            this.registry.unregisterAnalysis(analysisId);
            vscode.window.showInformationMessage('Analysis removed from active list');
        }
    }
    /**
     * Clear all analyses with confirmation
     */
    async clearAllAnalyses() {
        console.log('[ACTIVE_ANALYSES_COMMANDS] Clearing all analyses');
        const analyses = this.registry.getAllAnalyses();
        if (analyses.length === 0) {
            vscode.window.showInformationMessage('No active analyses to clear');
            return;
        }
        const result = await vscode.window.showWarningMessage(`Clear all ${analyses.length} active analyses?`, { modal: true }, 'Clear All');
        if (result === 'Clear All') {
            this.registry.clearAll();
            vscode.window.showInformationMessage('All active analyses cleared');
        }
    }
    /**
     * Refresh the active analyses view
     */
    refreshView() {
        console.log('[ACTIVE_ANALYSES_COMMANDS] Refreshing active analyses view');
        // The registry will automatically fire events to refresh the view
        // We could add manual refresh logic here if needed
        vscode.window.showInformationMessage('Active analyses view refreshed');
    }
    /**
     * Re-run an analysis
     */
    async rerunAnalysis(analysisId) {
        console.log(`[ACTIVE_ANALYSES_COMMANDS] Re-running analysis: ${analysisId}`);
        const analysis = this.registry.getAnalysis(analysisId);
        if (!analysis) {
            vscode.window.showWarningMessage(`Analysis ${analysisId} not found`);
            return;
        }
        try {
            // For now, just show a placeholder message
            // In the future, this will trigger the actual analysis
            vscode.window.showInformationMessage(`TODO: Re-run ${analysis.mode} analysis for ${analysis.path}`);
            // Reset the analysis status to running
            this.registry.updateAnalysis(analysisId, 'running', 0);
        }
        catch (error) {
            console.error('[ACTIVE_ANALYSES_COMMANDS] Error re-running analysis:', error);
            vscode.window.showErrorMessage(`Failed to re-run analysis: ${error}`);
        }
    }
    /**
     * Stop an analysis (stops associated server and removes from registry)
     */
    async stopAnalysis(analysisIdOrTreeItem) {
        console.log('[ACTIVE_ANALYSES_COMMANDS] 🔍 stopAnalysis called with:', {
            type: typeof analysisIdOrTreeItem,
            isString: typeof analysisIdOrTreeItem === 'string',
            value: analysisIdOrTreeItem,
            hasAnalysis: analysisIdOrTreeItem?.analysis,
            hasLabel: analysisIdOrTreeItem?.label,
            contextValue: analysisIdOrTreeItem?.contextValue,
            itemType: analysisIdOrTreeItem?.itemType,
            sectionType: analysisIdOrTreeItem?.sectionType
        });
        // Handle both string ID and tree item object
        let analysisId;
        if (typeof analysisIdOrTreeItem === 'string') {
            analysisId = analysisIdOrTreeItem;
        }
        else if (analysisIdOrTreeItem && analysisIdOrTreeItem.analysis && analysisIdOrTreeItem.analysis.id) {
            // Tree item object with analysis property (from Active Analyses tree)
            analysisId = analysisIdOrTreeItem.analysis.id;
        }
        else if (analysisIdOrTreeItem && analysisIdOrTreeItem.label) {
            // Tree item from main code analysis tree - try to find analysis by file name
            const fileName = analysisIdOrTreeItem.label;
            console.log(`[ACTIVE_ANALYSES_COMMANDS] 🔍 Looking for analysis by filename: ${fileName}`);
            const allAnalyses = this.registry.getAllAnalyses();
            const matchingAnalysis = allAnalyses.find(analysis => {
                const analysisFileName = analysis.path.split('/').pop() || analysis.path.split('\\').pop();
                return analysisFileName === fileName;
            });
            if (matchingAnalysis) {
                analysisId = matchingAnalysis.id;
                console.log(`[ACTIVE_ANALYSES_COMMANDS] ✅ Found analysis by filename: ${analysisId}`);
            }
            else {
                console.warn(`[ACTIVE_ANALYSES_COMMANDS] ⚠️ No analysis found for filename: ${fileName}`);
                vscode.window.showWarningMessage(`No active analysis found for file: ${fileName}`);
                return;
            }
        }
        else {
            console.error('[ACTIVE_ANALYSES_COMMANDS] Invalid argument for stopAnalysis:', analysisIdOrTreeItem);
            vscode.window.showErrorMessage('Unable to identify analysis to stop');
            return;
        }
        if (!analysisId) {
            vscode.window.showErrorMessage('Unable to identify analysis to stop');
            return;
        }
        console.log(`[ACTIVE_ANALYSES_COMMANDS] 🛑 Stopping analysis: ${analysisId}`);
        const analysis = this.registry.getAnalysis(analysisId);
        if (!analysis) {
            vscode.window.showWarningMessage(`Analysis ${analysisId} not found`);
            return;
        }
        try {
            const serverRegistry = (0, activeServerRegistry_1.getActiveServerRegistry)();
            const servers = serverRegistry.getAllServers();
            // Find server associated with this analysis
            // Strategy 1: Match by HTML file path (exact match)
            let associatedServer = servers.find((server) => server.htmlFile && server.htmlFile === analysis.path);
            // Strategy 2: If no exact match, look for servers with similar filenames
            if (!associatedServer) {
                const analysisFileName = path.basename(analysis.path);
                const analysisBaseName = path.parse(analysisFileName).name; // Remove extension
                console.log(`[ACTIVE_ANALYSES_COMMANDS] 🔍 Looking for server matching filename: ${analysisFileName} (base: ${analysisBaseName})`);
                // Look for servers whose custom name or HTML file path contains the analysis filename
                associatedServer = servers.find((server) => {
                    // Check custom name (e.g., "Analysis Static tryCodeXr.kt")
                    if (server.customName && server.customName.includes(analysisFileName)) {
                        console.log(`[ACTIVE_ANALYSES_COMMANDS] ✅ Found server by customName: ${server.customName}`);
                        return true;
                    }
                    // Check if HTML file path contains the base filename
                    if (server.htmlFile) {
                        const serverBaseName = path.parse(path.basename(server.htmlFile)).name;
                        const serverDirName = path.basename(path.dirname(server.htmlFile));
                        // Check if the server directory or HTML file contains the analysis base name
                        if (serverDirName.includes(analysisBaseName) || serverBaseName.includes(analysisBaseName)) {
                            console.log(`[ACTIVE_ANALYSES_COMMANDS] ✅ Found server by HTML path: ${server.htmlFile}`);
                            return true;
                        }
                    }
                    return false;
                });
            }
            if (associatedServer) {
                console.log(`[ACTIVE_ANALYSES_COMMANDS] 🔌 Found associated server ${associatedServer.id}, stopping...`);
                const stopped = await serverControl_1.ServerControl.stopServer(associatedServer.id);
                if (stopped) {
                    console.log(`[ACTIVE_ANALYSES_COMMANDS] ✅ Server stopped successfully`);
                    // The server stop event will automatically remove the analysis via our event integration
                    vscode.window.showInformationMessage(`Analysis stopped and server terminated`);
                }
                else {
                    console.warn(`[ACTIVE_ANALYSES_COMMANDS] ⚠️ Failed to stop server, removing analysis anyway`);
                    this.registry.unregisterAnalysis(analysisId);
                    vscode.window.showWarningMessage(`Analysis removed, but server may still be running`);
                }
            }
            else {
                console.log(`[ACTIVE_ANALYSES_COMMANDS] 📝 No associated server found, just removing analysis`);
                // No server found, just remove the analysis
                this.registry.unregisterAnalysis(analysisId);
                vscode.window.showInformationMessage(`Analysis removed`);
            }
        }
        catch (error) {
            console.error('[ACTIVE_ANALYSES_COMMANDS] Error stopping analysis:', error);
            // Fallback: just remove the analysis from registry
            this.registry.unregisterAnalysis(analysisId);
            vscode.window.showErrorMessage(`Failed to stop server, but analysis was removed: ${error}`);
        }
    }
}
exports.ActiveAnalysesCommands = ActiveAnalysesCommands;


/***/ }),
/* 110 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FileWatcherManager = void 0;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(5));
const activeAnalysisRegistry_1 = __webpack_require__(69);
const statusBarDelayTimer_1 = __webpack_require__(111);
const analysisSettingsStorage_1 = __webpack_require__(62);
const analysisCommands_1 = __webpack_require__(59);
const tempStorageManager_1 = __webpack_require__(66);
const SSEManager_1 = __webpack_require__(22);
/**
 * Manages file watchers for files under analysis
 * Detects changes to analyzed files and shows placeholder info messages
 */
class FileWatcherManager {
    context;
    static instance = null;
    watchers = new Map();
    registry;
    delayTimer;
    constructor(context) {
        this.context = context;
        console.log('[FILE_WATCHER_MANAGER] Initializing file watcher manager');
        this.registry = activeAnalysisRegistry_1.ActiveAnalysisRegistry.getInstance();
        this.delayTimer = statusBarDelayTimer_1.StatusBarDelayTimer.getInstance();
        // Listen for changes in active analyses to manage watchers
        this.registry.onDidChangeAnalyses(() => {
            this.updateWatchers();
        });
    }
    /**
     * Get the singleton instance of the file watcher manager
     */
    static getInstance(context) {
        if (!FileWatcherManager.instance && context) {
            FileWatcherManager.instance = new FileWatcherManager(context);
        }
        else if (!FileWatcherManager.instance) {
            throw new Error('FileWatcherManager requires context for initialization');
        }
        return FileWatcherManager.instance;
    }
    /**
     * Update watchers based on current active analyses
     */
    updateWatchers() {
        console.log('[FILE_WATCHER_MANAGER] Updating file watchers');
        const analyses = this.registry.getAllAnalyses();
        const currentFiles = new Set();
        // Collect all files that should be watched
        analyses.forEach(analysis => {
            if (analysis.status === 'running' || analysis.status === 'completed') {
                if (!analysis.id.startsWith('dir-')) {
                    // Only watch individual files, not directories for now
                    currentFiles.add(analysis.path);
                }
            }
        });
        // Remove watchers for files no longer in active analyses
        for (const [filePath, watcher] of this.watchers) {
            if (!currentFiles.has(filePath)) {
                console.log(`[FILE_WATCHER_MANAGER] Removing watcher for ${filePath}`);
                watcher.dispose();
                this.watchers.delete(filePath);
            }
        }
        // Add watchers for new files
        for (const filePath of currentFiles) {
            if (!this.watchers.has(filePath)) {
                this.addWatcher(filePath);
            }
        }
        console.log(`[FILE_WATCHER_MANAGER] Now watching ${this.watchers.size} files`);
    }
    /**
     * Add a file watcher for a specific file
     */
    addWatcher(filePath) {
        console.log(`[FILE_WATCHER_MANAGER] Adding watcher for ${filePath}`);
        try {
            // Create a watcher for the specific file
            const pattern = new vscode.RelativePattern(path.dirname(filePath), path.basename(filePath));
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);
            // Handle file changes
            watcher.onDidChange((uri) => {
                this.onFileChanged(uri.fsPath);
            });
            // Handle file saves (more reliable than onChange for some editors)
            watcher.onDidCreate((uri) => {
                this.onFileChanged(uri.fsPath);
            });
            // Handle file deletion
            watcher.onDidDelete((uri) => {
                this.onFileDeleted(uri.fsPath);
            });
            this.watchers.set(filePath, watcher);
            this.context.subscriptions.push(watcher);
        }
        catch (error) {
            console.error(`[FILE_WATCHER_MANAGER] Error creating watcher for ${filePath}:`, error);
        }
    }
    /**
     * Handle file change events with auto-analysis delay
     */
    async onFileChanged(filePath) {
        console.log(`[FILE_WATCHER_MANAGER] File changed: ${filePath}`);
        // Get analyses for this file
        const analyses = this.registry.getAnalysesForPath(filePath);
        if (analyses.length === 0) {
            return;
        }
        // Get the current auto-analysis delay setting
        const delayMs = await analysisSettingsStorage_1.AnalysisSettingsStorage.getAutoAnalysisDelay(this.context);
        const fileName = path.basename(filePath);
        console.log(`[FILE_WATCHER_MANAGER] Starting auto-analysis delay: ${delayMs}ms for ${fileName}`);
        // Start or restart the delay timer
        const uri = vscode.Uri.file(filePath);
        this.delayTimer.start(uri, delayMs, () => {
            this.executeDelayedAnalysis(filePath, analyses);
        });
    }
    /**
     * Execute the analysis after the delay has completed
     * Supports both Static and XR analysis modes
     */
    async executeDelayedAnalysis(filePath, analyses) {
        const fileName = path.basename(filePath);
        console.log(`[FILE_WATCHER_MANAGER] 🔄 Executing delayed re-analysis for ${fileName}`);
        console.log(`[FILE_WATCHER_MANAGER] Found ${analyses.length} analysis(es) for this file`);
        // Group analyses by mode
        const staticAnalyses = analyses.filter(analysis => analysis.mode === 'Static');
        const xrAnalyses = analyses.filter(analysis => analysis.mode === 'XR');
        console.log(`[FILE_WATCHER_MANAGER] Static analyses: ${staticAnalyses.length}, XR analyses: ${xrAnalyses.length}`);
        try {
            let analysisData;
            // Determine which analysis to run based on the modes present
            if (xrAnalyses.length > 0) {
                // Run XR analysis if there are any XR analyses
                console.log(`[FILE_WATCHER_MANAGER] Running XR analysis for ${fileName}...`);
                analysisData = await (0, analysisCommands_1.runXRFileAnalysisCoordinator)(this.context, filePath);
            }
            else if (staticAnalyses.length > 0) {
                // Run static analysis if there are only static analyses
                console.log(`[FILE_WATCHER_MANAGER] Running static analysis for ${fileName}...`);
                analysisData = await (0, analysisCommands_1.executeFileAnalysis)(this.context, filePath);
            }
            else {
                throw new Error('No valid analysis modes found');
            }
            if (!analysisData) {
                throw new Error('Analysis returned no data');
            }
            console.log(`[FILE_WATCHER_MANAGER] ✅ Analysis completed for ${fileName}`);
            // Step 2: Update existing temp folders with new data.json
            console.log(`[FILE_WATCHER_MANAGER] Updating existing data.json files for ${fileName}...`);
            const updatedFolders = await (0, tempStorageManager_1.updateDataJson)(this.context, filePath, analysisData);
            if (updatedFolders.length > 0) {
                console.log(`[FILE_WATCHER_MANAGER] ✅ Updated ${updatedFolders.length} analysis folder(s) for ${fileName}`);
                // Step 3: Send SSE update notification to clients (for both modes)
                console.log(`[FILE_WATCHER_MANAGER] Sending SSE update notification for ${fileName}...`);
                try {
                    SSEManager_1.sseManager.sendUpdate(filePath);
                    console.log(`[FILE_WATCHER_MANAGER] ✅ SSE update notification sent for ${fileName}`);
                }
                catch (sseError) {
                    console.error(`[FILE_WATCHER_MANAGER] ⚠️ Failed to send SSE update for ${fileName}:`, sseError);
                    // Continue with the rest of the process even if SSE fails
                }
                // Show mode-specific success message to user
                const modeInfo = [];
                if (staticAnalyses.length > 0) {
                    modeInfo.push(`${staticAnalyses.length} Static`);
                }
                if (xrAnalyses.length > 0) {
                    modeInfo.push(`${xrAnalyses.length} XR`);
                }
                vscode.window.showInformationMessage(`Analysis updated: ${fileName} (${modeInfo.join(', ')} viewer${updatedFolders.length > 1 ? 's' : ''} refreshed)`, { modal: false });
                // Update analysis status in registry for all modes
                analyses.forEach(analysis => {
                    console.log(`[FILE_WATCHER_MANAGER] Analysis ${analysis.id} (${analysis.mode}) updated due to file change`);
                    // Update the analysis in registry - mark as completed
                    try {
                        this.registry.updateAnalysis(analysis.id, 'completed', 100);
                    }
                    catch (error) {
                        console.log(`[FILE_WATCHER_MANAGER] Could not update analysis status: ${error}`);
                    }
                });
            }
            else {
                console.log(`[FILE_WATCHER_MANAGER] ⚠️ No existing analysis folders found for ${fileName}`);
                // Inform user that no viewers were found to update
                vscode.window.showWarningMessage(`File ${fileName} changed, but no active analysis viewers found to update.`, { modal: false });
            }
        }
        catch (error) {
            console.error(`[FILE_WATCHER_MANAGER] ❌ Failed to execute delayed re-analysis for ${fileName}:`, error);
            // Show error message to user
            vscode.window.showErrorMessage(`Failed to update analysis for ${fileName}: ${error}`, { modal: false });
            // Mark analyses as failed (both modes)
            analyses.forEach(analysis => {
                this.registry.failAnalysis(analysis.id, `Re-analysis failed: ${error}`);
            });
        }
    }
    /**
     * Handle file deletion events
     */
    onFileDeleted(filePath) {
        console.log(`[FILE_WATCHER_MANAGER] File deleted: ${filePath}`);
        // Cancel any pending delay timer for this file
        const uri = vscode.Uri.file(filePath);
        this.delayTimer.cancel(uri);
        // Get analyses for this file
        const analyses = this.registry.getAnalysesForPath(filePath);
        if (analyses.length > 0) {
            const fileName = path.basename(filePath);
            vscode.window.showWarningMessage(`File ${fileName} was deleted. Active analyses for this file will be marked as failed.`);
            // Mark analyses as failed
            analyses.forEach(analysis => {
                this.registry.failAnalysis(analysis.id, `File was deleted: ${filePath}`);
            });
        }
        // Remove the watcher since the file no longer exists
        const watcher = this.watchers.get(filePath);
        if (watcher) {
            watcher.dispose();
            this.watchers.delete(filePath);
        }
    }
    /**
     * Manually add a file to be watched
     */
    watchFile(filePath) {
        console.log(`[FILE_WATCHER_MANAGER] Manually adding file to watch: ${filePath}`);
        if (!this.watchers.has(filePath)) {
            this.addWatcher(filePath);
        }
    }
    /**
     * Manually remove a file from being watched
     */
    unwatchFile(filePath) {
        console.log(`[FILE_WATCHER_MANAGER] Manually removing file from watch: ${filePath}`);
        // Cancel any pending delay timer for this file
        const uri = vscode.Uri.file(filePath);
        this.delayTimer.cancel(uri);
        const watcher = this.watchers.get(filePath);
        if (watcher) {
            watcher.dispose();
            this.watchers.delete(filePath);
        }
    }
    /**
     * Get list of currently watched files
     */
    getWatchedFiles() {
        return Array.from(this.watchers.keys());
    }
    /**
     * Dispose all watchers
     */
    dispose() {
        console.log('[FILE_WATCHER_MANAGER] Disposing all file watchers');
        // Cancel all delay timers
        this.delayTimer.cancelAll();
        for (const [filePath, watcher] of this.watchers) {
            watcher.dispose();
        }
        this.watchers.clear();
    }
}
exports.FileWatcherManager = FileWatcherManager;


/***/ }),
/* 111 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.StatusBarDelayTimer = void 0;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(5));
/**
 * Manages countdown timers in the VS Code status bar for auto-analysis delays
 * Shows remaining time until re-analysis starts and handles timer resets
 */
class StatusBarDelayTimer {
    static instance = null;
    timers = new Map();
    updateInterval = null;
    constructor() {
        console.log('[STATUS_BAR_TIMER] Initializing status bar delay timer manager');
        this.startUpdateLoop();
    }
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!StatusBarDelayTimer.instance) {
            StatusBarDelayTimer.instance = new StatusBarDelayTimer();
        }
        return StatusBarDelayTimer.instance;
    }
    /**
     * Start or restart a delay timer for a file
     * @param uri File URI that changed
     * @param delayMs Delay in milliseconds before analysis
     * @param onComplete Callback to execute when timer completes
     */
    start(uri, delayMs, onComplete) {
        const filePath = uri.fsPath;
        const fileName = path.basename(filePath);
        console.log(`[STATUS_BAR_TIMER] Starting ${delayMs}ms delay timer for ${fileName}`);
        // Cancel existing timer for this file if any
        this.cancel(uri);
        // For real-time (0ms), execute immediately
        if (delayMs === 0) {
            console.log(`[STATUS_BAR_TIMER] Real-time mode: executing immediately for ${fileName}`);
            onComplete();
            return;
        }
        // Create status bar item
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100 // Priority
        );
        // Set up the timeout
        const timeout = setTimeout(() => {
            console.log(`[STATUS_BAR_TIMER] Timer completed for ${fileName}`);
            onComplete();
            this.cancel(uri);
        }, delayMs);
        // Store timer data
        const timerData = {
            statusBarItem,
            timeout,
            startTime: Date.now(),
            delayMs,
            filePath
        };
        this.timers.set(filePath, timerData);
        // Show initial status
        this.updateStatusDisplay(timerData, fileName);
        statusBarItem.show();
    }
    /**
     * Cancel the timer for a specific file
     * @param uri File URI to cancel timer for
     */
    cancel(uri) {
        const filePath = uri.fsPath;
        const timerData = this.timers.get(filePath);
        if (timerData) {
            const fileName = path.basename(filePath);
            console.log(`[STATUS_BAR_TIMER] Cancelling timer for ${fileName}`);
            clearTimeout(timerData.timeout);
            timerData.statusBarItem.dispose();
            this.timers.delete(filePath);
        }
    }
    /**
     * Cancel all active timers
     */
    cancelAll() {
        console.log(`[STATUS_BAR_TIMER] Cancelling all ${this.timers.size} active timers`);
        for (const timerData of this.timers.values()) {
            clearTimeout(timerData.timeout);
            timerData.statusBarItem.dispose();
        }
        this.timers.clear();
    }
    /**
     * Get list of files with active timers
     */
    getActiveTimers() {
        return Array.from(this.timers.keys());
    }
    /**
     * Check if a file has an active timer
     */
    hasActiveTimer(uri) {
        return this.timers.has(uri.fsPath);
    }
    /**
     * Start the update loop for status bar displays
     */
    startUpdateLoop() {
        this.updateInterval = setInterval(() => {
            for (const [filePath, timerData] of this.timers.entries()) {
                const fileName = path.basename(filePath);
                this.updateStatusDisplay(timerData, fileName);
            }
        }, 100); // Update every 100ms for smooth countdown
    }
    /**
     * Update the status bar display for a timer
     */
    updateStatusDisplay(timerData, fileName) {
        const elapsed = Date.now() - timerData.startTime;
        const remaining = Math.max(0, timerData.delayMs - elapsed);
        if (remaining <= 0) {
            // Timer should have completed by now
            return;
        }
        const remainingSeconds = (remaining / 1000).toFixed(1);
        // Format the status message
        timerData.statusBarItem.text = `$(clock) ${fileName}: ${remainingSeconds}s`;
        timerData.statusBarItem.tooltip = `Auto-analysis for ${fileName} will start in ${remainingSeconds} seconds`;
        timerData.statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
    }
    /**
     * Get timing info for a file (for debugging)
     */
    getTimerInfo(uri) {
        const timerData = this.timers.get(uri.fsPath);
        if (!timerData) {
            return null;
        }
        const elapsed = Date.now() - timerData.startTime;
        const remaining = Math.max(0, timerData.delayMs - elapsed);
        return {
            remaining,
            total: timerData.delayMs
        };
    }
    /**
     * Dispose all resources
     */
    dispose() {
        console.log('[STATUS_BAR_TIMER] Disposing status bar delay timer manager');
        this.cancelAll();
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
}
exports.StatusBarDelayTimer = StatusBarDelayTimer;


/***/ }),
/* 112 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ProjectStructureModularAdapter = void 0;
const vscode = __importStar(__webpack_require__(1));
const projectStructureTreeView_1 = __webpack_require__(113);
const analysisTreeItems_1 = __webpack_require__(101);
const fileDisplayUtils_1 = __webpack_require__(102);
/**
 * Adapter to integrate Project Structure Tree View with the modular Code Analysis system
 */
class ProjectStructureModularAdapter {
    context;
    projectStructureProvider;
    commands;
    constructor(context) {
        this.context = context;
        this.projectStructureProvider = new projectStructureTreeView_1.ProjectStructureTreeDataProvider(context);
        this.commands = new projectStructureTreeView_1.ProjectStructureCommands(this.projectStructureProvider);
        // Register commands
        projectStructureTreeView_1.ProjectStructureCommands.registerCommands(context, this.projectStructureProvider);
        console.log('PROJECT_STRUCTURE_ADAPTER: Initialized project structure adapter for modular system');
    }
    /**
     * Get project structure children as CodeAnalysisTreeItem for integration
     */
    async getProjectStructureChildren() {
        console.log('PROJECT_STRUCTURE_ADAPTER: Getting project structure children for modular view');
        try {
            // Get the actual project structure
            const projectStructure = this.projectStructureProvider.getProjectStructure();
            if (projectStructure.length === 0) {
                return [new analysisTreeItems_1.CodeAnalysisTreeItem('Loading project structure...', vscode.TreeItemCollapsibleState.None, 'analysis-item', undefined, new vscode.ThemeIcon('loading~spin'), 'Project structure is being scanned', 'Please wait', 'loading')];
            }
            // Convert ProjectStructureItem to CodeAnalysisTreeItem
            return this.convertProjectStructureItems(projectStructure);
        }
        catch (error) {
            console.error('PROJECT_STRUCTURE_ADAPTER: Error getting project structure children:', error);
            return [new analysisTreeItems_1.CodeAnalysisTreeItem('Error loading project structure', vscode.TreeItemCollapsibleState.None, 'analysis-item', undefined, new vscode.ThemeIcon('error'), `Failed to load project structure: ${error}`, 'Error', 'error')];
        }
    }
    /**
     * Convert ProjectStructureItem to CodeAnalysisTreeItem
     */
    convertProjectStructureItems(items) {
        return items.map(item => this.convertSingleProjectStructureItem(item));
    }
    /**
     * Convert a single ProjectStructureItem to CodeAnalysisTreeItem
     */
    convertSingleProjectStructureItem(item) {
        const collapsibleState = item.type === 'directory' && item.children && item.children.length > 0
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None;
        // For files, use the shared utility for consistent display
        if (item.type === 'file') {
            const fileProperties = fileDisplayUtils_1.FileDisplayUtils.createFileTreeItemProperties(item.name, item.fullPath, 'project', item.size, this.context);
            // Create the tree item with file-specific properties
            const treeItem = new analysisTreeItems_1.CodeAnalysisTreeItem(item.name, collapsibleState, 'analysis-item', fileProperties.command, fileProperties.iconPath, fileProperties.tooltip, fileProperties.description, 'project-structure-file');
            // Add custom properties to identify this as a project structure item
            treeItem.projectStructureItem = item;
            treeItem.isProjectStructureItem = true;
            return treeItem;
        }
        // Directory handling
        const childCounts = item.children ? this.getChildCounts(item.children) : { directories: 0, files: 0 };
        const total = childCounts.directories + childCounts.files;
        let description = '';
        if (total === 0) {
            description = 'empty';
        }
        else if (total === 1) {
            description = '1 item';
        }
        else {
            description = `${total} items`;
        }
        // Create tooltip for directory
        const tooltipLines = [];
        tooltipLines.push(`**${item.name}**`);
        tooltipLines.push(`Type: ${item.type}`);
        tooltipLines.push(`Path: ${item.relativePath || '/'}`);
        if (item.children && (childCounts.directories > 0 || childCounts.files > 0)) {
            tooltipLines.push(`Contents: ${childCounts.directories} folders, ${childCounts.files} files`);
        }
        // Create the tree item for directory
        const treeItem = new analysisTreeItems_1.CodeAnalysisTreeItem(item.name, collapsibleState, 'analysis-item', undefined, vscode.ThemeIcon.Folder, tooltipLines.join('\n'), description, 'project-structure-directory');
        // Add custom properties to identify this as a project structure item
        treeItem.projectStructureItem = item;
        treeItem.isProjectStructureItem = true;
        return treeItem;
    }
    /**
     * Get children for a project structure directory item
     */
    async getProjectStructureItemChildren(item) {
        if (item.type === 'directory' && item.children) {
            return this.convertProjectStructureItems(item.children);
        }
        return [];
    }
    /**
     * Check if a CodeAnalysisTreeItem is a project structure item
     */
    isProjectStructureItem(item) {
        return item.isProjectStructureItem === true;
    }
    /**
     * Get the project structure item from a CodeAnalysisTreeItem
     */
    getProjectStructureItem(item) {
        return item.projectStructureItem;
    }
    /**
     * Refresh the project structure
     */
    async refresh() {
        await this.projectStructureProvider.refresh();
    }
    /**
     * Get project statistics
     */
    getStatistics() {
        return this.projectStructureProvider.getStatistics();
    }
    /**
     * Get counts of child directories and files
     */
    getChildCounts(children) {
        let directories = 0;
        let files = 0;
        for (const child of children) {
            if (child.type === 'directory') {
                directories++;
            }
            else if (child.type === 'file') {
                files++;
            }
        }
        return { directories, files };
    }
}
exports.ProjectStructureModularAdapter = ProjectStructureModularAdapter;


/***/ }),
/* 113 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ProjectStructureCommands = exports.ProjectStructureTreeItem = exports.ProjectStructureTreeDataProvider = void 0;
exports.createProjectStructureModularItem = createProjectStructureModularItem;
const vscode = __importStar(__webpack_require__(1));
const directoryScanner_1 = __webpack_require__(114);
const baseInterfaces_1 = __webpack_require__(78);
const fileDisplayUtils_1 = __webpack_require__(102);
/**
 * Tree data provider for the Project Directory Tree View
 */
class ProjectStructureTreeDataProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    projectStructure = [];
    scanOptions = {
        maxDepth: 10,
        includeHidden: false,
        calculateSizes: true,
        includeModificationDates: false
    };
    constructor(context) {
        this.context = context;
        // Initial scan
        this.refresh();
    }
    /**
     * Refresh the tree view by rescanning the project structure
     */
    async refresh() {
        console.log('PROJECT_STRUCTURE_TREE: Refreshing project structure');
        try {
            this.projectStructure = await directoryScanner_1.DirectoryScanner.scanProjectStructure(this.scanOptions);
            this._onDidChangeTreeData.fire();
            console.log('PROJECT_STRUCTURE_TREE: Tree view refreshed successfully');
        }
        catch (error) {
            console.error('PROJECT_STRUCTURE_TREE: Error refreshing tree view:', error);
            vscode.window.showErrorMessage(`Failed to refresh project structure: ${error}`);
        }
    }
    /**
     * Update scan options and refresh
     */
    async updateScanOptions(options) {
        this.scanOptions = { ...this.scanOptions, ...options };
        await this.refresh();
    }
    /**
     * Get tree item representation
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Get children of a tree item
     */
    getChildren(element) {
        if (!element) {
            // Root level - return top-level items
            return Promise.resolve(this.projectStructure.map(item => new ProjectStructureTreeItem(item, this.context)));
        }
        // Return children of the element
        if (element.item.children) {
            return Promise.resolve(element.item.children.map(child => new ProjectStructureTreeItem(child, this.context)));
        }
        return Promise.resolve([]);
    }
    /**
     * Get the project structure data
     */
    getProjectStructure() {
        return this.projectStructure;
    }
    /**
     * Find an item by its relative path
     */
    findItem(relativePath) {
        return directoryScanner_1.DirectoryScanner.findItemByPath(this.projectStructure, relativePath);
    }
    /**
     * Get project statistics
     */
    getStatistics() {
        return directoryScanner_1.DirectoryScanner.getProjectStatistics(this.projectStructure);
    }
}
exports.ProjectStructureTreeDataProvider = ProjectStructureTreeDataProvider;
/**
 * Tree item for project structure elements
 */
class ProjectStructureTreeItem extends vscode.TreeItem {
    item;
    context;
    collapsibleState;
    constructor(item, context, collapsibleState) {
        super(item.name, collapsibleState !== undefined
            ? collapsibleState
            : (item.type === 'directory' && item.children && item.children.length > 0)
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None);
        this.item = item;
        this.context = context;
        this.collapsibleState = collapsibleState;
        this.setupTreeItem();
    }
    setupTreeItem() {
        // For files, use the shared utility for consistent display
        if (this.item.type === 'file') {
            const fileProperties = fileDisplayUtils_1.FileDisplayUtils.createFileTreeItemProperties(this.item.name, this.item.fullPath, 'project', this.item.size, this.context);
            this.iconPath = fileProperties.iconPath;
            this.description = fileProperties.description;
            this.tooltip = fileProperties.tooltip;
            this.command = fileProperties.command;
        }
        else {
            // Directory handling
            this.tooltip = this.createTooltip();
            this.description = this.createDescription();
            this.iconPath = vscode.ThemeIcon.Folder;
            // No command for directories
        }
        // Set context value for context menu commands
        this.contextValue = this.item.type;
        // Set resource URI for VS Code integration
        this.resourceUri = vscode.Uri.file(this.item.fullPath);
    }
    createTooltip() {
        const lines = [];
        lines.push(`**${this.item.name}**`);
        lines.push(`Type: ${this.item.type}`);
        lines.push(`Path: ${this.item.relativePath || '/'}`);
        if (this.item.language) {
            lines.push(`Language: ${this.item.language.name}`);
        }
        if (this.item.size !== undefined) {
            lines.push(`Size: ${fileDisplayUtils_1.FileDisplayUtils.formatFileSize(this.item.size)}`);
        }
        if (this.item.lastModified) {
            lines.push(`Modified: ${this.item.lastModified.toLocaleString()}`);
        }
        if (this.item.type === 'directory' && this.item.children) {
            const childCounts = this.getChildCounts(this.item.children);
            if (childCounts.directories > 0 || childCounts.files > 0) {
                lines.push(`Contents: ${childCounts.directories} folders, ${childCounts.files} files`);
            }
        }
        return lines.join('\n');
    }
    createDescription() {
        if (this.item.type === 'file' && this.item.size !== undefined) {
            return fileDisplayUtils_1.FileDisplayUtils.formatFileSize(this.item.size);
        }
        if (this.item.type === 'directory' && this.item.children) {
            const childCounts = this.getChildCounts(this.item.children);
            const total = childCounts.directories + childCounts.files;
            if (total === 0) {
                return 'empty';
            }
            else if (total === 1) {
                return '1 item';
            }
            else {
                return `${total} items`;
            }
        }
        return '';
    }
    getChildCounts(children) {
        let directories = 0;
        let files = 0;
        for (const child of children) {
            if (child.type === 'directory') {
                directories++;
            }
            else if (child.type === 'file') {
                files++;
            }
        }
        return { directories, files };
    }
}
exports.ProjectStructureTreeItem = ProjectStructureTreeItem;
/**
 * Create a modular tree item for the project structure section
 */
function createProjectStructureModularItem() {
    const item = new baseInterfaces_1.ModularTreeItem('Project Directory Tree', vscode.TreeItemCollapsibleState.Collapsed, 'codeAnalysis', 'projectStructure', {
        command: 'codexr.codeanalysis.refreshProjectStructure',
        title: 'Refresh Project Structure'
    }, new vscode.ThemeIcon('folder-library'), 'Browse project structure', 'Browse project structure');
    // Set code analysis specific properties
    item.codeAnalysisItemType = 'section';
    item.originalCodeAnalysisItem = {
        id: 'project-structure',
        label: 'Project Directory Tree',
        description: 'Browse project structure',
        contextValue: 'codeAnalysis.projectStructure'
    };
    return item;
}
/**
 * Commands for project structure tree view
 */
class ProjectStructureCommands {
    treeDataProvider;
    constructor(treeDataProvider) {
        this.treeDataProvider = treeDataProvider;
    }
    /**
     * Register all project structure commands
     */
    static registerCommands(context, treeDataProvider) {
        const commands = new ProjectStructureCommands(treeDataProvider);
        // Refresh command
        const refreshDisposable = vscode.commands.registerCommand('codexr.codeanalysis.refreshProjectStructure', () => commands.refresh());
        // Reveal in explorer command
        const revealDisposable = vscode.commands.registerCommand('codexr.codeanalysis.revealInExplorer', (item) => commands.revealInExplorer(item));
        // Copy path command
        const copyPathDisposable = vscode.commands.registerCommand('codexr.codeanalysis.copyPath', (item) => commands.copyPath(item));
        // Copy relative path command
        const copyRelativePathDisposable = vscode.commands.registerCommand('codexr.codeanalysis.copyRelativePath', (item) => commands.copyRelativePath(item));
        // Show statistics command
        const showStatsDisposable = vscode.commands.registerCommand('codexr.codeanalysis.showProjectStatistics', () => commands.showStatistics());
        // Configure scan options command
        const configureDisposable = vscode.commands.registerCommand('codexr.codeanalysis.configureProjectScan', () => commands.configureScanOptions());
        context.subscriptions.push(refreshDisposable, revealDisposable, copyPathDisposable, copyRelativePathDisposable, showStatsDisposable, configureDisposable);
    }
    /**
     * Refresh the project structure
     */
    async refresh() {
        await this.treeDataProvider.refresh();
        vscode.window.showInformationMessage('Project structure refreshed');
    }
    /**
     * Reveal item in file explorer
     */
    async revealInExplorer(item) {
        const uri = vscode.Uri.file(item.item.fullPath);
        await vscode.commands.executeCommand('revealFileInOS', uri);
    }
    /**
     * Copy full path to clipboard
     */
    async copyPath(item) {
        await vscode.env.clipboard.writeText(item.item.fullPath);
        vscode.window.showInformationMessage(`Copied path: ${item.item.fullPath}`);
    }
    /**
     * Copy relative path to clipboard
     */
    async copyRelativePath(item) {
        const relativePath = item.item.relativePath || item.item.name;
        await vscode.env.clipboard.writeText(relativePath);
        vscode.window.showInformationMessage(`Copied relative path: ${relativePath}`);
    }
    /**
     * Show project statistics
     */
    async showStatistics() {
        const stats = this.treeDataProvider.getStatistics();
        const lines = [];
        lines.push(`**Project Structure Statistics**`);
        lines.push('');
        lines.push(`📁 Directories: ${stats.totalDirectories}`);
        lines.push(`📄 Files: ${stats.totalFiles}`);
        if (stats.totalSize !== undefined) {
            lines.push(`💾 Total Size: ${fileDisplayUtils_1.FileDisplayUtils.formatFileSize(stats.totalSize)}`);
        }
        if (stats.largestFile) {
            lines.push(`🔥 Largest File: ${stats.largestFile.name} (${fileDisplayUtils_1.FileDisplayUtils.formatFileSize(stats.largestFile.size || 0)})`);
        }
        lines.push('');
        lines.push('**Files by Language:**');
        const sortedLanguages = Object.entries(stats.filesByLanguage)
            .sort(([, a], [, b]) => b - a);
        for (const [language, count] of sortedLanguages) {
            lines.push(`  ${language}: ${count} files`);
        }
        const content = lines.join('\n');
        // Show in a new document
        const doc = await vscode.workspace.openTextDocument({
            content,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
    }
    /**
     * Configure scan options
     */
    async configureScanOptions() {
        const options = await this.showScanOptionsQuickPick();
        if (options) {
            await this.treeDataProvider.updateScanOptions(options);
            vscode.window.showInformationMessage('Scan options updated and structure refreshed');
        }
    }
    async showScanOptionsQuickPick() {
        const items = [
            {
                label: 'Include Hidden Files',
                description: 'Show files and folders starting with .',
                picked: false
            },
            {
                label: 'Calculate File Sizes',
                description: 'Show file sizes in tree (may be slower)',
                picked: true
            },
            {
                label: 'Include Modification Dates',
                description: 'Show last modified dates in tooltips',
                picked: false
            }
        ];
        const selected = await vscode.window.showQuickPick(items, {
            canPickMany: true,
            title: 'Configure Project Structure Scan Options'
        });
        if (!selected) {
            return undefined;
        }
        const options = {};
        for (const item of selected) {
            switch (item.label) {
                case 'Include Hidden Files':
                    options.includeHidden = true;
                    break;
                case 'Calculate File Sizes':
                    options.calculateSizes = true;
                    break;
                case 'Include Modification Dates':
                    options.includeModificationDates = true;
                    break;
            }
        }
        return options;
    }
}
exports.ProjectStructureCommands = ProjectStructureCommands;


/***/ }),
/* 114 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DirectoryScanner = void 0;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(5));
const languageMetadata_1 = __webpack_require__(103);
/**
 * Scanner for creating a hierarchical project directory structure
 */
class DirectoryScanner {
    /**
     * Default ignore patterns for common build/cache directories
     */
    static DEFAULT_IGNORE_PATTERNS = [
        'node_modules',
        '.git',
        '.svn',
        '.hg',
        '.venv',
        '__pycache__',
        '.pytest_cache',
        '.mypy_cache',
        '.tox',
        '.coverage',
        'build',
        'dist',
        'out',
        'bin',
        'target',
        '.vscode',
        '.idea',
        '*.vsix',
        '.DS_Store',
        'Thumbs.db'
    ];
    /**
     * Scan workspace folders and create hierarchical project structure
     */
    static async scanProjectStructure(options = {}) {
        console.log('DIRECTORY_SCANNER: Starting project structure scan');
        const startTime = Date.now();
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            console.log('DIRECTORY_SCANNER: No workspace folders found');
            return [];
        }
        const projectStructure = [];
        // Combine default and custom ignore patterns
        const ignorePatterns = [
            ...this.DEFAULT_IGNORE_PATTERNS,
            ...(options.customIgnorePatterns || [])
        ];
        // Scan each workspace folder
        for (const workspaceFolder of workspaceFolders) {
            console.log(`DIRECTORY_SCANNER: Scanning workspace folder: ${workspaceFolder.name}`);
            try {
                const rootItem = await this.scanDirectory(workspaceFolder.uri, workspaceFolder.uri.fsPath, '', ignorePatterns, options, 0);
                if (rootItem) {
                    // For single workspace, use the folder contents directly
                    if (workspaceFolders.length === 1 && rootItem.children) {
                        projectStructure.push(...rootItem.children);
                    }
                    else {
                        // For multiple workspaces, include the workspace folder as root
                        projectStructure.push(rootItem);
                    }
                }
            }
            catch (error) {
                console.error(`DIRECTORY_SCANNER: Error scanning workspace folder ${workspaceFolder.name}:`, error);
            }
        }
        const endTime = Date.now();
        const duration = endTime - startTime;
        const totalItems = this.countItems(projectStructure);
        console.log(`DIRECTORY_SCANNER: Project structure scan completed in ${duration}ms`);
        console.log(`DIRECTORY_SCANNER: Found ${totalItems.directories} directories and ${totalItems.files} files`);
        return projectStructure;
    }
    /**
     * Recursively scan a directory and build its structure
     */
    static async scanDirectory(directoryUri, workspaceRoot, relativePath, ignorePatterns, options, currentDepth) {
        // Check depth limit
        if (options.maxDepth && currentDepth > options.maxDepth) {
            return null;
        }
        const directoryName = path.basename(directoryUri.fsPath);
        // Check if directory should be ignored
        if (this.shouldIgnore(directoryName, ignorePatterns, options.includeHidden)) {
            return null;
        }
        try {
            // Get directory contents
            const entries = await vscode.workspace.fs.readDirectory(directoryUri);
            const children = [];
            // Sort entries: directories first, then files, alphabetically
            const sortedEntries = entries.sort((a, b) => {
                // Directories first
                if (a[1] === vscode.FileType.Directory && b[1] !== vscode.FileType.Directory) {
                    return -1;
                }
                if (b[1] === vscode.FileType.Directory && a[1] !== vscode.FileType.Directory) {
                    return 1;
                }
                // Then alphabetically
                return a[0].localeCompare(b[0]);
            });
            // Process each entry
            for (const [entryName, entryType] of sortedEntries) {
                const entryUri = vscode.Uri.joinPath(directoryUri, entryName);
                const entryRelativePath = relativePath ? path.join(relativePath, entryName) : entryName;
                if (entryType === vscode.FileType.Directory) {
                    // Recursively scan subdirectory
                    const subDirectory = await this.scanDirectory(entryUri, workspaceRoot, entryRelativePath, ignorePatterns, options, currentDepth + 1);
                    if (subDirectory) {
                        children.push(subDirectory);
                    }
                }
                else if (entryType === vscode.FileType.File) {
                    // Check if file should be ignored
                    if (!this.shouldIgnore(entryName, ignorePatterns, options.includeHidden)) {
                        const fileItem = await this.createFileItem(entryUri, workspaceRoot, entryRelativePath, options);
                        if (fileItem) {
                            children.push(fileItem);
                        }
                    }
                }
            }
            // Create directory item
            const directoryItem = {
                name: directoryName,
                relativePath: relativePath,
                fullPath: directoryUri.fsPath,
                type: 'directory',
                children: children
            };
            // Add modification date if requested
            if (options.includeModificationDates) {
                try {
                    const stat = await vscode.workspace.fs.stat(directoryUri);
                    directoryItem.lastModified = new Date(stat.mtime);
                }
                catch (error) {
                    console.warn(`DIRECTORY_SCANNER: Could not get modification date for ${directoryUri.fsPath}`);
                }
            }
            return directoryItem;
        }
        catch (error) {
            console.warn(`DIRECTORY_SCANNER: Error reading directory ${directoryUri.fsPath}:`, error);
            return null;
        }
    }
    /**
     * Create a file item with metadata
     */
    static async createFileItem(fileUri, workspaceRoot, relativePath, options) {
        try {
            const fileName = path.basename(fileUri.fsPath);
            const language = (0, languageMetadata_1.getLanguageForFile)(fileUri.fsPath);
            const fileItem = {
                name: fileName,
                relativePath: relativePath,
                fullPath: fileUri.fsPath,
                type: 'file',
                language: language
            };
            // Add file size if requested
            if (options.calculateSizes) {
                try {
                    const stat = await vscode.workspace.fs.stat(fileUri);
                    fileItem.size = stat.size;
                }
                catch (error) {
                    console.warn(`DIRECTORY_SCANNER: Could not get size for ${fileUri.fsPath}`);
                }
            }
            // Add modification date if requested
            if (options.includeModificationDates) {
                try {
                    const stat = await vscode.workspace.fs.stat(fileUri);
                    fileItem.lastModified = new Date(stat.mtime);
                }
                catch (error) {
                    console.warn(`DIRECTORY_SCANNER: Could not get modification date for ${fileUri.fsPath}`);
                }
            }
            return fileItem;
        }
        catch (error) {
            console.warn(`DIRECTORY_SCANNER: Error processing file ${fileUri.fsPath}:`, error);
            return null;
        }
    }
    /**
     * Check if a file or directory should be ignored
     */
    static shouldIgnore(name, ignorePatterns, includeHidden = false) {
        // Check hidden files/directories
        if (!includeHidden && name.startsWith('.')) {
            return true;
        }
        // Check against ignore patterns
        return ignorePatterns.some(pattern => {
            // Simple glob-like matching
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(name);
            }
            return name === pattern;
        });
    }
    /**
     * Count total directories and files in the structure
     */
    static countItems(items) {
        let directories = 0;
        let files = 0;
        for (const item of items) {
            if (item.type === 'directory') {
                directories++;
                if (item.children) {
                    const childCounts = this.countItems(item.children);
                    directories += childCounts.directories;
                    files += childCounts.files;
                }
            }
            else if (item.type === 'file') {
                files++;
            }
        }
        return { directories, files };
    }
    /**
     * Find an item in the structure by relative path
     */
    static findItemByPath(items, targetPath) {
        for (const item of items) {
            if (item.relativePath === targetPath) {
                return item;
            }
            if (item.children) {
                const found = this.findItemByPath(item.children, targetPath);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }
    /**
     * Get all files in the structure (flattened)
     */
    static getAllFiles(items) {
        const files = [];
        for (const item of items) {
            if (item.type === 'file') {
                files.push(item);
            }
            else if (item.children) {
                files.push(...this.getAllFiles(item.children));
            }
        }
        return files;
    }
    /**
     * Get all directories in the structure (flattened)
     */
    static getAllDirectories(items) {
        const directories = [];
        for (const item of items) {
            if (item.type === 'directory') {
                directories.push(item);
                if (item.children) {
                    directories.push(...this.getAllDirectories(item.children));
                }
            }
        }
        return directories;
    }
    /**
     * Filter items by file extension
     */
    static filterByExtension(items, extensions) {
        const filtered = [];
        for (const item of items) {
            if (item.type === 'file') {
                const ext = path.extname(item.name).toLowerCase();
                if (extensions.includes(ext)) {
                    filtered.push(item);
                }
            }
            else if (item.children) {
                const filteredChildren = this.filterByExtension(item.children, extensions);
                if (filteredChildren.length > 0) {
                    filtered.push({
                        ...item,
                        children: filteredChildren
                    });
                }
            }
        }
        return filtered;
    }
    /**
     * Get statistics about the project structure
     */
    static getProjectStatistics(items) {
        const counts = this.countItems(items);
        const allFiles = this.getAllFiles(items);
        const filesByLanguage = {};
        let totalSize = 0;
        let largestFile;
        for (const file of allFiles) {
            // Count by language
            const languageName = file.language?.name || 'Unknown';
            filesByLanguage[languageName] = (filesByLanguage[languageName] || 0) + 1;
            // Calculate sizes
            if (file.size !== undefined) {
                totalSize += file.size;
                if (!largestFile || (file.size > (largestFile.size || 0))) {
                    largestFile = file;
                }
            }
        }
        return {
            totalDirectories: counts.directories,
            totalFiles: counts.files,
            filesByLanguage,
            totalSize: totalSize > 0 ? totalSize : undefined,
            largestFile
        };
    }
}
exports.DirectoryScanner = DirectoryScanner;


/***/ }),
/* 115 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


/**
 * Visualization Settings View Module
 * Exports for the modular Visualization Settings section
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VisualizationSettingsClickHandler = exports.VisualizationSettingsModularItemFactory = exports.VisualizationSettingsModularTreeItem = exports.VisualizationSettingsSectionProvider = void 0;
// Section Provider
var VisualizationSettingsSectionProvider_1 = __webpack_require__(116);
Object.defineProperty(exports, "VisualizationSettingsSectionProvider", ({ enumerable: true, get: function () { return VisualizationSettingsSectionProvider_1.VisualizationSettingsSectionProvider; } }));
// Items
var visualizationSettingsItems_1 = __webpack_require__(117);
Object.defineProperty(exports, "VisualizationSettingsModularTreeItem", ({ enumerable: true, get: function () { return visualizationSettingsItems_1.VisualizationSettingsModularTreeItem; } }));
Object.defineProperty(exports, "VisualizationSettingsModularItemFactory", ({ enumerable: true, get: function () { return visualizationSettingsItems_1.VisualizationSettingsModularItemFactory; } }));
// Interactions
var handleVisualizationSettingsClicks_1 = __webpack_require__(118);
Object.defineProperty(exports, "VisualizationSettingsClickHandler", ({ enumerable: true, get: function () { return handleVisualizationSettingsClicks_1.VisualizationSettingsClickHandler; } }));


/***/ }),
/* 116 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VisualizationSettingsSectionProvider = void 0;
const vscode = __importStar(__webpack_require__(1));
const visualizationSettingsItems_1 = __webpack_require__(117);
const handleVisualizationSettingsClicks_1 = __webpack_require__(118);
const settingsStorage_1 = __webpack_require__(50);
/**
 * Visualization Settings section provider - manages visualization rendering preferences
 */
class VisualizationSettingsSectionProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    clickHandler;
    visualizationSettingsStorage;
    constructor(context) {
        this.context = context;
        console.log('VISUALIZATION_SETTINGS_MODULAR: Initializing Visualization Settings section provider');
        this.clickHandler = new handleVisualizationSettingsClicks_1.VisualizationSettingsClickHandler(context);
        this.visualizationSettingsStorage = new settingsStorage_1.VisualizationSettingsStorage(context);
    }
    /**
     * Get the section name for identification
     */
    getSectionName() {
        return 'visualizationSettings';
    }
    /**
     * Get the section header item
     */
    getSectionItem() {
        return new visualizationSettingsItems_1.VisualizationSettingsModularTreeItem('VISUALIZATION SETTINGS', vscode.TreeItemCollapsibleState.Collapsed, 'error', // Using this as section header type
        undefined, new vscode.ThemeIcon('settings-gear'), 'Configure visualization rendering preferences', undefined, 'visualizationSettingsSection');
    }
    /**
     * Get children items for the Visualization Settings section
     */
    async getChildren(element) {
        // If element is provided, it means we're getting children for a specific item
        // For the Visualization Settings section, we only have flat items, so return empty for sub-items
        if (element) {
            return [];
        }
        console.log('VISUALIZATION_SETTINGS_MODULAR: Loading visualization settings section children with dynamic color icons');
        try {
            const currentSettings = this.visualizationSettingsStorage.getSettings();
            console.log(`VISUALIZATION_SETTINGS_MODULAR: Loading settings for dynamic icons: ${JSON.stringify(currentSettings)}`);
            const children = await visualizationSettingsItems_1.VisualizationSettingsModularItemFactory.createVisualizationSettingsItems(currentSettings, this.context);
            console.log(`VISUALIZATION_SETTINGS_MODULAR: Created ${children.length} visualization settings items with dynamic icons`);
            return children;
        }
        catch (error) {
            console.error('VISUALIZATION_SETTINGS_MODULAR: Error loading visualization settings items:', error);
            return [visualizationSettingsItems_1.VisualizationSettingsModularItemFactory.createErrorItem()];
        }
    }
    /**
     * Refresh the section
     */
    refresh() {
        console.log('VISUALIZATION_SETTINGS_MODULAR: Refreshing Visualization Settings section');
        this._onDidChangeTreeData.fire();
    }
    /**
     * Handle item clicks (additional method for interaction)
     */
    async handleClick(item) {
        await this.clickHandler.handleVisualizationSettingsClick(item);
    }
    /**
     * Handle context menu actions (additional method for interaction)
     */
    async handleContextMenu(action, item) {
        await this.clickHandler.handleContextMenuAction(action, item);
    }
    /**
     * Get current settings (for external access)
     */
    getCurrentSettings() {
        return this.visualizationSettingsStorage.getSettings();
    }
    /**
     * Update a single setting (for external access)
     */
    async updateSetting(key, value) {
        await this.visualizationSettingsStorage.updateSetting(key, value);
        this.refresh();
    }
}
exports.VisualizationSettingsSectionProvider = VisualizationSettingsSectionProvider;


/***/ }),
/* 117 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VisualizationSettingsModularItemFactory = exports.VisualizationSettingsModularTreeItem = void 0;
const vscode = __importStar(__webpack_require__(1));
const visualizationSettingsItems_1 = __webpack_require__(51);
/**
 * Visualization Settings tree items for the Visualization Settings section
 */
class VisualizationSettingsModularTreeItem extends vscode.TreeItem {
    visualizationSettingsItemType;
    originalSettingsItem;
    constructor(label, collapsibleState, visualizationSettingsItemType, command, iconPath, tooltip, description, contextValue, originalSettingsItem) {
        super(label, collapsibleState);
        this.visualizationSettingsItemType = visualizationSettingsItemType;
        this.originalSettingsItem = originalSettingsItem;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip || label;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.VisualizationSettingsModularTreeItem = VisualizationSettingsModularTreeItem;
/**
 * Factory for creating Visualization Settings-related tree items
 */
class VisualizationSettingsModularItemFactory {
    /**
     * Create "Error loading settings" message item
     */
    static createErrorItem() {
        console.log('VISUALIZATION_SETTINGS_MODULAR: Creating error loading settings item');
        return new VisualizationSettingsModularTreeItem('Error loading settings', vscode.TreeItemCollapsibleState.None, 'error', undefined, new vscode.ThemeIcon('error'), 'Failed to load visualization settings');
    }
    /**
     * Create visualization settings items with dynamic color icons
     */
    static async createVisualizationSettingsItems(settings, context) {
        console.log('VISUALIZATION_SETTINGS_MODULAR: Creating visualization settings items with dynamic color icons');
        try {
            const settingsItems = await visualizationSettingsItems_1.VisualizationSettingsItemFactory.createVisualizationSettingsItems(settings, context);
            const children = settingsItems.map(item => {
                return new VisualizationSettingsModularTreeItem(item.label, vscode.TreeItemCollapsibleState.None, 'settings-field', item.command, item.iconPath, item.tooltip, item.description, item.contextValue, item);
            });
            console.log(`VISUALIZATION_SETTINGS_MODULAR: Created ${children.length} visualization settings items with dynamic icons`);
            return children;
        }
        catch (error) {
            console.error('VISUALIZATION_SETTINGS_MODULAR: Error creating visualization settings items:', error);
            return [VisualizationSettingsModularItemFactory.createErrorItem()];
        }
    }
}
exports.VisualizationSettingsModularItemFactory = VisualizationSettingsModularItemFactory;


/***/ }),
/* 118 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VisualizationSettingsClickHandler = void 0;
const vscode = __importStar(__webpack_require__(1));
/**
 * Handler for Visualization Settings section interactions
 */
class VisualizationSettingsClickHandler {
    context;
    constructor(context) {
        this.context = context;
    }
    /**
     * Handle clicks on visualization settings items
     */
    async handleVisualizationSettingsClick(item) {
        console.log(`VISUALIZATION_SETTINGS_MODULAR: Handling click on visualization settings item: ${item.label} (type: ${item.visualizationSettingsItemType})`);
        // For most visualization settings items, the command is already attached to the tree item
        // and will be executed automatically by VS Code
        switch (item.visualizationSettingsItemType) {
            case 'settings-field':
                console.log('VISUALIZATION_SETTINGS_MODULAR: Settings field clicked');
                // The command to open the color picker is already attached to the item
                // VS Code will execute it automatically
                break;
            case 'error':
                console.log('VISUALIZATION_SETTINGS_MODULAR: Error item clicked - no action');
                break;
            default:
                console.warn(`VISUALIZATION_SETTINGS_MODULAR: Unknown visualization settings item type: ${item.visualizationSettingsItemType}`);
        }
    }
    /**
     * Handle right-click context menu actions
     */
    async handleContextMenuAction(action, item) {
        console.log(`VISUALIZATION_SETTINGS_MODULAR: Handling context menu action: ${action} on item: ${item.label}`);
        switch (action) {
            case 'refresh':
                console.log('VISUALIZATION_SETTINGS_MODULAR: Refreshing visualization settings view');
                // Refresh will be triggered by the provider
                break;
            case 'configure':
                await this.handleConfigureAction(item);
                break;
            case 'reset':
                await this.handleResetAction(item);
                break;
            case 'resetAll':
                await this.handleResetAllAction();
                break;
            case 'export':
                await this.handleExportSettings();
                break;
            case 'import':
                await this.handleImportSettings();
                break;
            default:
                console.warn(`VISUALIZATION_SETTINGS_MODULAR: Unknown context menu action: ${action}`);
        }
    }
    /**
     * Handle configure action (open color picker)
     */
    async handleConfigureAction(item) {
        console.log(`VISUALIZATION_SETTINGS_MODULAR: Configuring setting: ${item.label}`);
        if (item.command) {
            // Execute the item's command (usually opens color picker)
            await vscode.commands.executeCommand(item.command.command, ...(item.command.arguments || []));
        }
        else {
            // Fallback - try to extract setting field and use generic command
            if (item.originalSettingsItem?.settingField) {
                await vscode.commands.executeCommand('codeXR.visualizationSettings.configure', item.originalSettingsItem.settingField.key);
            }
            else {
                vscode.window.showWarningMessage(`Cannot configure: ${item.label}`);
            }
        }
    }
    /**
     * Handle reset single setting action
     */
    async handleResetAction(item) {
        console.log(`VISUALIZATION_SETTINGS_MODULAR: Resetting setting: ${item.label}`);
        try {
            if (item.originalSettingsItem?.settingField) {
                await vscode.commands.executeCommand('codeXR.visualizationSettings.reset', item.originalSettingsItem.settingField.key);
                vscode.window.showInformationMessage(`Reset ${item.label} to default value`);
            }
            else {
                vscode.window.showWarningMessage(`Cannot reset: ${item.label}`);
            }
        }
        catch (error) {
            console.error(`VISUALIZATION_SETTINGS_MODULAR: Error resetting setting:`, error);
            vscode.window.showErrorMessage(`Failed to reset ${item.label}: ${error}`);
        }
    }
    /**
     * Handle reset all settings action
     */
    async handleResetAllAction() {
        console.log('VISUALIZATION_SETTINGS_MODULAR: Resetting all settings');
        const confirmation = await vscode.window.showWarningMessage('Reset all visualization settings to default values?', { modal: true }, 'Reset All', 'Cancel');
        if (confirmation === 'Reset All') {
            try {
                await vscode.commands.executeCommand('codeXR.visualizationSettings.resetAll');
                vscode.window.showInformationMessage('All visualization settings have been reset to default values');
            }
            catch (error) {
                console.error('VISUALIZATION_SETTINGS_MODULAR: Error resetting all settings:', error);
                vscode.window.showErrorMessage(`Failed to reset all settings: ${error}`);
            }
        }
    }
    /**
     * Handle export settings action
     */
    async handleExportSettings() {
        console.log('VISUALIZATION_SETTINGS_MODULAR: Exporting settings');
        try {
            await vscode.commands.executeCommand('codeXR.visualizationSettings.export');
        }
        catch (error) {
            console.error('VISUALIZATION_SETTINGS_MODULAR: Error exporting settings:', error);
            vscode.window.showErrorMessage(`Failed to export settings: ${error}`);
        }
    }
    /**
     * Handle import settings action
     */
    async handleImportSettings() {
        console.log('VISUALIZATION_SETTINGS_MODULAR: Importing settings');
        try {
            await vscode.commands.executeCommand('codeXR.visualizationSettings.import');
        }
        catch (error) {
            console.error('VISUALIZATION_SETTINGS_MODULAR: Error importing settings:', error);
            vscode.window.showErrorMessage(`Failed to import settings: ${error}`);
        }
    }
}
exports.VisualizationSettingsClickHandler = VisualizationSettingsClickHandler;


/***/ }),
/* 119 */
/***/ ((__unused_webpack_module, exports) => {


/**
 * Supported languages configuration for file detection and analysis
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SUPPORTED_LANGUAGES = void 0;
exports.getLanguageByExtension = getLanguageByExtension;
exports.getAllSupportedExtensions = getAllSupportedExtensions;
exports.isSupportedExtension = isSupportedExtension;
exports.getLanguageStats = getLanguageStats;
exports.SUPPORTED_LANGUAGES = {
    // Web Technologies
    html: {
        extensions: ['.html', '.htm'],
        name: 'HTML'
    },
    javascript: {
        extensions: ['.js', '.mjs', '.cjs'],
        name: 'JavaScript'
    },
    typescript: {
        extensions: ['.ts', '.tsx'],
        name: 'TypeScript'
    },
    vue: {
        extensions: ['.vue'],
        name: 'Vue'
    },
    // Backend Languages
    python: {
        extensions: ['.py', '.pyw', '.pyi'],
        name: 'Python'
    },
    ruby: {
        extensions: ['.rb', '.rbw'],
        name: 'Ruby'
    },
    php: {
        extensions: ['.php', '.phtml', '.php3', '.php4', '.php5'],
        name: 'PHP'
    },
    perl: {
        extensions: ['.pl', '.pm'],
        name: 'Perl'
    },
    // System Languages
    c: {
        extensions: ['.c', '.h'],
        name: 'C'
    },
    cplusplus: {
        extensions: ['.cpp', '.cxx', '.cc', '.hpp', '.hxx'],
        name: 'C++'
    },
    csharp: {
        extensions: ['.cs'],
        name: 'C#'
    },
    go: {
        extensions: ['.go'],
        name: 'Go'
    },
    rust: {
        extensions: ['.rs'],
        name: 'Rust'
    },
    zig: {
        extensions: ['.zig'],
        name: 'Zig'
    },
    // JVM Languages
    java: {
        extensions: ['.java'],
        name: 'Java'
    },
    kotlin: {
        extensions: ['.kt', '.kts'],
        name: 'Kotlin'
    },
    scala: {
        extensions: ['.scala', '.sc'],
        name: 'Scala'
    },
    // Mobile
    objectivec: {
        extensions: ['.m', '.mm'],
        name: 'Objective-C'
    },
    swift: {
        extensions: ['.swift'],
        name: 'Swift'
    },
    // Scripting
    lua: {
        extensions: ['.lua'],
        name: 'Lua'
    },
    // Specialized
    solidity: {
        extensions: ['.sol'],
        name: 'Solidity'
    },
    gdscript: {
        extensions: ['.gd'],
        name: 'GDScript'
    },
    ttcn3: {
        extensions: ['.ttcn', '.ttcn3'],
        name: 'TTCN-3'
    },
    erlang: {
        extensions: ['.erl', '.hrl'],
        name: 'Erlang'
    },
    fortran: {
        extensions: ['.f90', '.f95', '.f03', '.f08', '.f'],
        name: 'Fortran'
    }
};
/**
 * Get language configuration by file extension
 */
function getLanguageByExtension(extension) {
    const normalizedExt = extension.toLowerCase();
    for (const [key, config] of Object.entries(exports.SUPPORTED_LANGUAGES)) {
        if (config.extensions.includes(normalizedExt)) {
            return { ...config, icon: key }; // Add the key as icon identifier
        }
    }
    return null;
}
/**
 * Get all supported extensions as a flat array
 */
function getAllSupportedExtensions() {
    return Object.values(exports.SUPPORTED_LANGUAGES)
        .flatMap(config => config.extensions);
}
/**
 * Check if a file extension is supported
 */
function isSupportedExtension(extension) {
    return getLanguageByExtension(extension) !== null;
}
/**
 * Get language statistics for logging
 */
function getLanguageStats() {
    const languages = Object.keys(exports.SUPPORTED_LANGUAGES);
    const extensions = getAllSupportedExtensions();
    return {
        totalLanguages: languages.length,
        totalExtensions: extensions.length
    };
}


/***/ }),
/* 120 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VisualizeDataModel = void 0;
const vscode = __importStar(__webpack_require__(1));
const fs = __importStar(__webpack_require__(6));
const visualizeDataState_1 = __webpack_require__(44);
/**
 * Visualize Data Model
 * Handles state management and validation for visualize data functionality
 */
class VisualizeDataModel {
    /**
     * Reset the visualize data state completely
     * This should be called on extension activation to ensure clean state
     */
    static resetVisualizeDataState(context) {
        console.log('VISUALIZE-STATE: Resetting visualize data state on extension activation');
        try {
            // Clear any existing state from workspace storage
            context.workspaceState.update('visualizeDataState', undefined);
            console.log('VISUALIZE-STATE: Cleared workspace storage');
            // If state manager instance exists, reset it
            if (visualizeDataState_1.VisualizeDataStateManager.hasInstance()) {
                const stateManager = visualizeDataState_1.VisualizeDataStateManager.getInstance(context);
                stateManager.reset();
                console.log('VISUALIZE-STATE: Reset existing state manager instance');
            }
            // Force creation of new clean state manager
            const stateManager = visualizeDataState_1.VisualizeDataStateManager.getInstance(context);
            const state = stateManager.getState();
            console.log('VISUALIZE-STATE: State reset complete', {
                selectedChart: state.selectedChart?.id || 'none',
                selectedJsonPath: state.selectedJsonPath || 'none',
                dimensionMappings: state.dimensionMappings.length,
                isReadyToLaunch: state.isReadyToLaunch
            });
        }
        catch (error) {
            console.error('VISUALIZE-STATE: Error during state reset:', error);
        }
    }
    /**
     * Validate that a file path still exists
     */
    static validateFilePath(filePath) {
        try {
            return fs.existsSync(filePath);
        }
        catch (error) {
            console.warn('VISUALIZE-STATE: Error checking file existence:', error);
            return false;
        }
    }
    /**
     * Validate the current state and clean up invalid entries
     */
    static validateAndCleanState(context) {
        console.log('VISUALIZE-STATE: Validating and cleaning current state');
        if (!visualizeDataState_1.VisualizeDataStateManager.hasInstance()) {
            console.log('VISUALIZE-STATE: No state manager instance to validate');
            return;
        }
        const stateManager = visualizeDataState_1.VisualizeDataStateManager.getInstance(context);
        const state = stateManager.getState();
        let needsUpdate = false;
        // Check if selected JSON file still exists
        if (state.selectedJsonPath) {
            if (!this.validateFilePath(state.selectedJsonPath)) {
                console.log('VISUALIZE-STATE: Selected JSON file no longer exists, clearing:', state.selectedJsonPath);
                stateManager.updateSelectedJson('', '');
                needsUpdate = true;
            }
            else {
                console.log('VISUALIZE-STATE: Selected JSON file is valid:', state.selectedJsonPath);
            }
        }
        // If state was modified, trigger refresh
        if (needsUpdate) {
            console.log('VISUALIZE-STATE: State was cleaned, triggering UI refresh');
            vscode.commands.executeCommand('codexr.servers.refresh');
        }
        else {
            console.log('VISUALIZE-STATE: State validation complete, no changes needed');
        }
    }
    /**
     * Get state summary for debugging
     */
    static getStateSummary(context) {
        if (!visualizeDataState_1.VisualizeDataStateManager.hasInstance()) {
            return 'No state manager instance';
        }
        const stateManager = visualizeDataState_1.VisualizeDataStateManager.getInstance(context);
        const state = stateManager.getState();
        return `State Summary:
  - Chart: ${state.selectedChart?.name || 'Not selected'}
  - JSON File: ${state.selectedJsonName || 'Not selected'}
  - JSON Path Valid: ${state.selectedJsonPath ? this.validateFilePath(state.selectedJsonPath) : 'N/A'}
  - Dimension Mappings: ${state.dimensionMappings.length}
  - Mapping Configured: ${state.isDimensionMappingConfigured}
  - Ready to Launch: ${state.isReadyToLaunch}`;
    }
}
exports.VisualizeDataModel = VisualizeDataModel;


/***/ }),
/* 121 */,
/* 122 */
/***/ ((module) => {

module.exports = require("node:net");

/***/ }),
/* 123 */
/***/ ((module) => {

module.exports = require("node:os");

/***/ }),
/* 124 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.registerVisualizationSettingsCommands = registerVisualizationSettingsCommands;
const visualizationSettingsCommands_1 = __webpack_require__(125);
/**
 * Visualization Settings Commands Wrapper
 * Re-exports visualization settings commands for centralized command registration
 */
/**
 * Registers all visualization settings related commands
 */
function registerVisualizationSettingsCommands(context) {
    console.log('VISUALIZATION-SETTINGS: Registering visualization settings commands...');
    visualizationSettingsCommands_1.VisualizationSettingsCommands.registerCommands(context);
    console.log('VISUALIZATION-SETTINGS: Visualization settings commands registration complete');
}


/***/ }),
/* 125 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VisualizationSettingsCommands = void 0;
const vscode = __importStar(__webpack_require__(1));
const handleSettingsInteraction_1 = __webpack_require__(53);
const settingsAccessors_1 = __webpack_require__(55);
/**
 * Visualization Settings Commands Class
 * Defines what each visualization settings command does
 */
class VisualizationSettingsCommands {
    context;
    interactionHandler;
    constructor(context) {
        this.context = context;
        console.log('VISUALIZATION-SETTINGS: Initializing visualization settings commands...');
        // Initialize settings accessors for global use
        (0, settingsAccessors_1.initializeSettingsAccessors)(context);
        // Initialize the interaction handler
        this.interactionHandler = new handleSettingsInteraction_1.VisualizationSettingsInteractionHandler(context);
    }
    /**
     * Register all visualization settings commands
     */
    static registerCommands(context) {
        console.log('VISUALIZATION-SETTINGS: Registering visualization settings commands...');
        const commandsInstance = new VisualizationSettingsCommands(context);
        commandsInstance.registerAllCommands();
        console.log('VISUALIZATION-SETTINGS: Visualization settings commands registration complete');
    }
    /**
     * Register individual commands
     */
    registerAllCommands() {
        // Command: Configure setting
        const configureSettingCmd = vscode.commands.registerCommand('codeXR.visualizationSettings.configure', async (settingKey) => {
            try {
                console.log(`VISUALIZATION-SETTINGS: Configure command triggered for: ${settingKey}`);
                await this.interactionHandler.handleSettingConfiguration(settingKey);
            }
            catch (error) {
                console.error('VISUALIZATION-SETTINGS: Error in configure command:', error);
                vscode.window.showErrorMessage(`Failed to configure setting: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Register commands with the extension context
        this.context.subscriptions.push(configureSettingCmd);
        // Store interaction handler for cleanup
        this.context.subscriptions.push({
            dispose: () => this.interactionHandler.dispose()
        });
        console.log('VISUALIZATION-SETTINGS: All commands registered successfully');
    }
    /**
     * Dispose of resources
     */
    dispose() {
        this.interactionHandler.dispose();
    }
}
exports.VisualizationSettingsCommands = VisualizationSettingsCommands;


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/ensure chunk */
/******/ 	(() => {
/******/ 		__webpack_require__.f = {};
/******/ 		// This file contains only the entry chunk.
/******/ 		// The chunk loading function for additional chunks
/******/ 		__webpack_require__.e = (chunkId) => {
/******/ 			return Promise.all(Object.keys(__webpack_require__.f).reduce((promises, key) => {
/******/ 				__webpack_require__.f[key](chunkId, promises);
/******/ 				return promises;
/******/ 			}, []));
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/get javascript chunk filename */
/******/ 	(() => {
/******/ 		// This function allow to reference async chunks
/******/ 		__webpack_require__.u = (chunkId) => {
/******/ 			// return url for filenames based on template
/******/ 			return "" + chunkId + ".extension.js";
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/require chunk loading */
/******/ 	(() => {
/******/ 		// no baseURI
/******/ 		
/******/ 		// object to store loaded chunks
/******/ 		// "1" means "loaded", otherwise not loaded yet
/******/ 		var installedChunks = {
/******/ 			0: 1
/******/ 		};
/******/ 		
/******/ 		// no on chunks loaded
/******/ 		
/******/ 		var installChunk = (chunk) => {
/******/ 			var moreModules = chunk.modules, chunkIds = chunk.ids, runtime = chunk.runtime;
/******/ 			for(var moduleId in moreModules) {
/******/ 				if(__webpack_require__.o(moreModules, moduleId)) {
/******/ 					__webpack_require__.m[moduleId] = moreModules[moduleId];
/******/ 				}
/******/ 			}
/******/ 			if(runtime) runtime(__webpack_require__);
/******/ 			for(var i = 0; i < chunkIds.length; i++)
/******/ 				installedChunks[chunkIds[i]] = 1;
/******/ 		
/******/ 		};
/******/ 		
/******/ 		// require() chunk loading for javascript
/******/ 		__webpack_require__.f.require = (chunkId, promises) => {
/******/ 			// "1" is the signal for "already loaded"
/******/ 			if(!installedChunks[chunkId]) {
/******/ 				if(true) { // all chunks have JS
/******/ 					installChunk(require("./" + __webpack_require__.u(chunkId)));
/******/ 				} else installedChunks[chunkId] = 1;
/******/ 			}
/******/ 		};
/******/ 		
/******/ 		// no external install chunk
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(0);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map