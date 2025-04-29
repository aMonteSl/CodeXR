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
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const commands_1 = require("./commands");
const statusBarManager_1 = require("./ui/statusBarManager");
const treeProvider_1 = require("./ui/treeProvider");
const serverManager_1 = require("./server/serverManager");
const analysisCommands_1 = require("./commands/analysisCommands");
const pythonEnv_1 = require("./pythonEnv");
const fileWatchManager_1 = require("./analysis/fileWatchManager");
const analysisDataManager_1 = require("./analysis/analysisDataManager");
const xrAnalysisManager_1 = require("./analysis/xr/xrAnalysisManager");
/**
 * This function is executed when the extension is activated
 */
async function activate(context) {
    console.log('Extension "CodeXR" is now active.');
    // Initialize status bar manager
    const statusBarManager = (0, statusBarManager_1.getStatusBarManager)(context);
    // Inicializar FileWatchManager - AÑADIR ESTA LÍNEA
    fileWatchManager_1.FileWatchManager.initialize(context);
    // Register tree data provider for the unified view
    const treeDataProvider = new treeProvider_1.LocalServerProvider(context);
    const treeView = vscode.window.createTreeView('codexr.serverTreeView', {
        treeDataProvider: treeDataProvider
    });
    context.subscriptions.push(treeView);
    // Expose the treeDataProvider globally for updates
    global.treeDataProvider = treeDataProvider;
    // Register all commands ONCE
    // Server/UI commands
    const commandDisposables = (0, commands_1.registerCommands)(context, treeDataProvider);
    context.subscriptions.push(...commandDisposables);
    // Register Python environment commands ONCE
    const pythonEnvDisposables = (0, pythonEnv_1.registerPythonEnvCommands)(context);
    context.subscriptions.push(...pythonEnvDisposables);
    // Register all analysis commands
    const analysisDisposables = (0, analysisCommands_1.registerAnalysisCommands)(context);
    context.subscriptions.push(...analysisDisposables);
    // Check for Python environment at startup (after short delay to not block activation)
    setTimeout(() => {
        (0, pythonEnv_1.checkAndSetupPythonEnvironment)();
    }, 2000);
}
/**
 * This function is executed when the extension is deactivated
 */
async function deactivate() {
    // Clean up any stored data
    analysisDataManager_1.analysisDataManager.clear();
    // Clean up XR visualizations
    (0, xrAnalysisManager_1.cleanupXRVisualizations)();
    // Stop all servers when extension is deactivated
    (0, serverManager_1.stopServer)();
    // Clean up visualization files
    try {
        // Get the path to the visualizations directory
        const visualizationsDir = path.join(__dirname, '..', 'visualizations');
        // Check if the directory exists
        try {
            await fs.access(visualizationsDir);
            // Read all entries in the directory
            const entries = await fs.readdir(visualizationsDir);
            // Delete each entry recursively
            for (const entry of entries) {
                const entryPath = path.join(visualizationsDir, entry);
                console.log(`Cleaning up visualization files: ${entryPath}`);
                await fs.rm(entryPath, { recursive: true, force: true });
            }
            console.log('All visualization files cleaned up successfully');
        }
        catch (err) {
            // Directory doesn't exist, nothing to clean up
            console.log('No visualizations directory found, nothing to clean up');
        }
    }
    catch (error) {
        console.error('Error during cleanup of visualization files:', error);
    }
    // Status bar is disposed automatically through context.subscriptions
}
//# sourceMappingURL=extension.js.map