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
exports.registerAnalysisCommands = registerAnalysisCommands;
const vscode = __importStar(require("vscode"));
// Import all command modules
const fileAnalysisCommands_1 = require("./fileAnalysisCommands");
const directoryAnalysisCommands_1 = require("./directoryAnalysisCommands");
const settingsCommands_1 = require("./settingsCommands");
const treeDisplayCommands_1 = require("./treeDisplayCommands");
const debugCommands_1 = require("./debugCommands");
const analysisSessionCommands_1 = require("../analysisSessionCommands");
/**
 * Central analysis command registry
 *
 * This is the main entry point for all analysis-related commands.
 * It registers commands from specialized modules to avoid conflicts.
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
        // Register directory analysis commands (Static directory/project analysis)
        console.log('📂 Registering directory analysis commands...');
        disposables.push(...(0, directoryAnalysisCommands_1.registerDirectoryAnalysisCommands)(context));
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
        // Register tree interaction commands
        console.log('🌳 Registering tree interaction commands...');
        disposables.push(registerDirectoryAnalysisFromTreeCommand(context));
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
 * Registers the directory analysis from tree command
 * @param context Extension context
 * @returns Command disposable
 */
function registerDirectoryAnalysisFromTreeCommand(context) {
    return vscode.commands.registerCommand('codexr.analyzeDirectoryFromTree', async (directoryPath) => {
        try {
            console.log(`🌳 Analyzing directory from tree: ${directoryPath}`);
            // Get user's preferred directory analysis mode
            const config = vscode.workspace.getConfiguration();
            const directoryMode = config.get('codexr.analysis.directoryMode', 'static');
            // Convert string path to URI
            const uri = vscode.Uri.file(directoryPath);
            // Delegate to appropriate specific command based on mode
            switch (directoryMode) {
                case 'static-deep':
                    await vscode.commands.executeCommand('codexr.analyzeDirectoryDeepStatic', uri);
                    break;
                default:
                    await vscode.commands.executeCommand('codexr.analyzeDirectoryStatic', uri);
            }
        }
        catch (error) {
            console.error('❌ Error in directory analysis from tree:', error);
            vscode.window.showErrorMessage(`Failed to analyze directory: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Registers the debug analysis command for testing
 * @param context Extension context
 * @returns Command disposable
 */
function registerDebugAnalysisCommand(context) {
    return vscode.commands.registerCommand('codexr.analysis.debug', async () => {
        try {
            console.log('🐛 Debug analysis command triggered');
            // Get analysis session manager
            const { AnalysisSessionManager } = await import('../../analysis/analysisSessionManager.js');
            const sessionManager = AnalysisSessionManager.getInstance();
            // Get active sessions
            const activeSessions = sessionManager.getAllSessions();
            // Show debug information
            const sessionInfo = activeSessions.map((session) => `${session.type}: ${session.filePath} (${session.status})`).join('\\n');
            vscode.window.showInformationMessage(`Active Analysis Sessions:\\n${sessionInfo || 'No active sessions'}`, { modal: false });
        }
        catch (error) {
            console.error('❌ Error in debug analysis command:', error);
            vscode.window.showErrorMessage(`Debug analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
//# sourceMappingURL=index.js.map