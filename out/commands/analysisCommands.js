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
exports.REGISTERED_COMMANDS = exports.COMMAND_CATEGORIES = exports.getFilePathFromUri = exports.getLanguageName = exports.refreshTreeProvider = void 0;
exports.registerAnalysisCommands = registerAnalysisCommands;
exports.getRegisteredCommandCount = getRegisteredCommandCount;
exports.registerDebugAnalysisCommand = registerDebugAnalysisCommand;
const vscode = __importStar(require("vscode"));
const fileAnalysisCommands_1 = require("./analysis/fileAnalysisCommands");
const settingsCommands_1 = require("./analysis/settingsCommands");
const treeDisplayCommands_1 = require("./analysis/treeDisplayCommands");
const debugCommands_1 = require("./analysis/debugCommands");
const analysisSessionCommands_1 = require("./analysisSessionCommands");
const analysisSessionManager_1 = require("../analysis/analysisSessionManager");
/**
 * Main entry point for all analysis-related commands
 *
 * This file coordinates the registration of analysis commands by delegating
 * to specialized command modules. Each module handles a specific aspect of
 * the analysis functionality:
 *
 * - File Analysis: Static, XR, and DOM analysis operations
 * - Settings: Analysis configuration and preferences
 * - Tree Display: Tree view configuration and sorting
 * - Debug: Diagnostic and troubleshooting commands
 *
 * The original 1030+ line file has been refactored into focused modules
 * for better maintainability and code organization.
 */
/**
 * Registers all analysis-related commands
 * @param context Extension context for command registration
 * @returns Array of disposables for all registered commands
 */
function registerAnalysisCommands(context) {
    console.log('🔧 Registering analysis commands...');
    const disposables = [];
    try {
        // Register file analysis commands (Static, XR, DOM, Tree analysis)
        console.log('📁 Registering file analysis commands...');
        disposables.push(...(0, fileAnalysisCommands_1.registerFileAnalysisCommands)(context));
        // Register analysis settings commands (Mode, delay, auto-analysis, etc.)
        console.log('⚙️ Registering analysis settings commands...');
        disposables.push(...(0, settingsCommands_1.registerAnalysisSettingsCommands)(context));
        // Register tree display commands (Sorting, filtering, configuration)
        console.log('🌳 Registering tree display commands...');
        disposables.push(...(0, treeDisplayCommands_1.registerTreeDisplayCommands)(context));
        // Register debug commands (Diagnostics, troubleshooting)
        console.log('🐛 Registering debug commands...');
        disposables.push(...(0, debugCommands_1.registerDebugCommands)());
        // Register analysis session commands (Active analyses management)
        console.log('📊 Registering analysis session commands...');
        disposables.push(...(0, analysisSessionCommands_1.registerAnalysisSessionCommands)(context));
        // Register debug command for testing
        console.log('🐛 Registering debug analysis command...');
        disposables.push(registerDebugAnalysisCommand(context));
        console.log(`✅ Successfully registered ${disposables.length} analysis commands`);
    }
    catch (error) {
        console.error('❌ Error registering analysis commands:', error);
        vscode.window.showErrorMessage(`Failed to register analysis commands: ${error instanceof Error ? error.message : String(error)}`);
    }
    return disposables;
}
/**
 * Gets the total number of registered commands for diagnostics
 * @returns Number of registered commands
 */
function getRegisteredCommandCount() {
    // This can be used for diagnostics or testing
    const mockContext = {
        subscriptions: [],
        workspaceState: { get: () => undefined, update: () => Promise.resolve() },
        globalState: { get: () => undefined, update: () => Promise.resolve() },
        extensionUri: vscode.Uri.file(''),
        extensionPath: '',
        environmentVariableCollection: {},
        extensionMode: vscode.ExtensionMode.Production,
        logUri: vscode.Uri.file(''),
        storageUri: undefined,
        globalStorageUri: vscode.Uri.file(''),
        secrets: {},
        asAbsolutePath: (relativePath) => relativePath,
        // ✅ ADDED: Missing properties
        storagePath: undefined,
        globalStoragePath: '',
        logPath: '',
        extension: {},
        languageModelAccessInformation: {}
    }; // ✅ FIXED: Use unknown cast
    return registerAnalysisCommands(mockContext).length;
}
/**
 * Re-exports commonly used functions for backward compatibility
 */
var commandHelpers_1 = require("./shared/commandHelpers");
Object.defineProperty(exports, "refreshTreeProvider", { enumerable: true, get: function () { return commandHelpers_1.refreshTreeProvider; } });
var commandHelpers_2 = require("./shared/commandHelpers");
Object.defineProperty(exports, "getLanguageName", { enumerable: true, get: function () { return commandHelpers_2.getLanguageName; } });
Object.defineProperty(exports, "getFilePathFromUri", { enumerable: true, get: function () { return commandHelpers_2.getFilePathFromUri; } });
/**
 * Command categories for reference
 */
exports.COMMAND_CATEGORIES = {
    FILE_ANALYSIS: 'File Analysis Commands',
    SETTINGS: 'Analysis Settings Commands',
    TREE_DISPLAY: 'Tree Display Commands',
    DEBUG: 'Debug Commands'
};
/**
 * List of all registered command IDs for reference
 */
exports.REGISTERED_COMMANDS = {
    // File Analysis Commands
    ANALYZE_FILE: 'codexr.analyzeFile',
    ANALYZE_FILE_3D: 'codexr.analyzeFile3D',
    ANALYZE_FILE_FROM_TREE: 'codexr.analyzeFileFromTree',
    OPEN_AND_ANALYZE_FILE: 'codexr.openAndAnalyzeFile',
    VISUALIZE_DOM: 'codexr.visualizeDOM',
    // Settings Commands
    TOGGLE_ANALYSIS_MODE: 'codexr.toggleAnalysisMode',
    SET_ANALYSIS_DEBOUNCE_DELAY: 'codexr.setAnalysisDebounceDelay',
    TOGGLE_AUTO_ANALYSIS: 'codexr.toggleAutoAnalysis',
    SET_ANALYSIS_CHART_TYPE: 'codexr.setAnalysisChartType',
    SET_DIMENSION_MAPPING: 'codexr.setDimensionMapping',
    RESET_ANALYSIS_DEFAULTS: 'codexr.resetAnalysisDefaults',
    // Tree Display Commands
    CONFIGURE_TREE_DISPLAY: 'codexr.configureTreeDisplay',
    CONFIGURE_LANGUAGE_SORT: 'codexr.configureLanguageSort',
    CONFIGURE_FILE_SORT: 'codexr.configureFileSort',
    CONFIGURE_FILE_LIMIT: 'codexr.configureFileLimit',
    RESET_TREE_DISPLAY_SETTINGS: 'codexr.resetTreeDisplaySettings',
    // Debug Commands
    DEBUG_FILE_SYSTEM_WATCHER: 'codexr.debugFileSystemWatcher',
    DEBUG_WATCHERS: 'codexr.debugWatchers',
    REFRESH_ANALYSIS_TREE: 'codexr.refreshAnalysisTree',
    FORCE_REFRESH_ANALYSIS_TREE: 'codexr.forceRefreshAnalysisTree',
    ANALYSIS_SYSTEM_STATUS: 'codexr.analysisSystemStatus',
    CLEAR_ANALYSIS_CACHE: 'codexr.clearAnalysisCache',
    // Debug Analysis Command
    DEBUG_ANALYSIS_COMMAND: 'codexr.analysis.debug'
};
/**
 * Debug command to manually trigger session registration and tree refresh for testing
 */
function registerDebugAnalysisCommand(context) {
    return vscode.commands.registerCommand('codexr.analysis.debug', async () => {
        console.log('🐛 [DEBUG] Manual debug command triggered');
        // Get the session manager
        const sessionManager = analysisSessionManager_1.AnalysisSessionManager.getInstance();
        // Debug current state
        console.log('🐛 [DEBUG] Current session manager state:');
        sessionManager.debugState();
        // Manually add a test session
        console.log('🐛 [DEBUG] Adding test session...');
        const testSession = sessionManager.addSession('/home/adrian/CodeXR/test_analysis.py', analysisSessionManager_1.AnalysisType.STATIC, { dispose: () => console.log('Test panel disposed') });
        console.log(`🐛 [DEBUG] Test session added with ID: ${testSession}`);
        // Debug state after adding
        sessionManager.debugState();
        vscode.window.showInformationMessage('Debug analysis command executed - check console logs');
    });
}
//# sourceMappingURL=analysisCommands.js.map