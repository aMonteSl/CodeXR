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
const index_1 = require("./commands/index");
const views_1 = require("./views");
const commonCommands_1 = require("./utils/commonCommands");
const serverSettingsManager_1 = require("./servers/storage/serverSettingsManager");
const activeServerRegistry_1 = require("./active_servers/registry/activeServerRegistry");
const index_2 = require("./visualization_settings/index");
const visualizeDataModel_1 = require("./visualize_data/model/visualizeDataModel");
const tempStorageManager_1 = require("./code_analysis/utils/tempStorageManager");
const fileWatcherManager_1 = require("./code_analysis/runtime/fileWatcherManager");
const statusBarDelayTimer_1 = require("./code_analysis/runtime/statusBarDelayTimer");
const SSEManager_1 = require("./servers/runtime/sse/SSEManager");
const fileToServerMap_1 = require("./utils/fileToServerMap");
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
        // Step 5: Register visualization settings commands
        console.log('VISUALIZATION-SETTINGS: Registering visualization settings commands');
        (0, index_2.registerVisualizationSettingsCommands)(context);
        console.log('VISUALIZATION-SETTINGS: Commands registered successfully');
        // Step 6: Reset Visualize Data state to ensure clean UI/model synchronization
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
//# sourceMappingURL=extension.js.map