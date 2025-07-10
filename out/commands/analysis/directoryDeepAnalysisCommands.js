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
exports.analyzeDirectoryDeepStatic = analyzeDirectoryDeepStatic;
exports.analyzeProjectDeepStatic = analyzeProjectDeepStatic;
const vscode = __importStar(require("vscode"));
const directoryAnalysisService_1 = require("../../analysis/static/directory/common/directoryAnalysisService");
const directoryAnalysisConfig_1 = require("../../analysis/static/directory/common/directoryAnalysisConfig");
/**
 * Command handler for deep directory analysis (static mode)
 */
async function analyzeDirectoryDeepStatic(directoryUri) {
    try {
        let targetPath;
        if (directoryUri) {
            // Called from context menu
            targetPath = directoryUri.fsPath;
        }
        else {
            // Called from command palette - show folder picker
            const selectedFolder = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select Directory for Deep Analysis'
            });
            if (!selectedFolder || selectedFolder.length === 0) {
                return;
            }
            targetPath = selectedFolder[0].fsPath;
        }
        // Validate path exists and is a directory
        const stat = await vscode.workspace.fs.stat(vscode.Uri.file(targetPath));
        if (!(stat.type & vscode.FileType.Directory)) {
            vscode.window.showErrorMessage('Selected path is not a directory');
            return;
        }
        // Get extension context
        const context = await getExtensionContext();
        if (!context) {
            vscode.window.showErrorMessage('Extension context not available');
            return;
        }
        console.log(`🔍 Starting deep directory analysis: ${targetPath}`);
        // Perform deep directory analysis with explicit deep filters
        await directoryAnalysisService_1.directoryAnalysisService.analyzeDirectory(context, targetPath, {
            recursive: true, // Deep analysis mode
            filters: directoryAnalysisConfig_1.DEFAULT_DEEP_FILTERS // Use deep filters with maxDepth: 50
        }, false // Not project-level
        );
        console.log(`✅ Deep directory analysis completed: ${targetPath}`);
    }
    catch (error) {
        console.error('Error in deep directory analysis command:', error);
        vscode.window.showErrorMessage(`Deep directory analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Command handler for deep project analysis (static mode)
 */
async function analyzeProjectDeepStatic(uri) {
    try {
        // Get current workspace folder
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder is open');
            return;
        }
        const projectPath = workspaceFolder.uri.fsPath;
        // Get extension context
        const context = await getExtensionContext();
        if (!context) {
            vscode.window.showErrorMessage('Extension context not available');
            return;
        }
        // Always analyze the workspace root, regardless of which folder was right-clicked
        console.log(`🔍 Starting deep project analysis - using workspace root: ${projectPath}`);
        // Perform deep project analysis with explicit deep filters
        await directoryAnalysisService_1.directoryAnalysisService.analyzeDirectory(context, projectPath, {
            recursive: true, // Deep analysis mode
            filters: directoryAnalysisConfig_1.DEFAULT_DEEP_FILTERS // Use deep filters with maxDepth: 50
        }, true // Project-level
        );
        console.log(`✅ Deep project analysis completed: ${projectPath}`);
    }
    catch (error) {
        console.error('Error in deep project analysis command:', error);
        vscode.window.showErrorMessage(`Deep project analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Gets the current extension context
 */
async function getExtensionContext() {
    // This will be set by the main extension activation
    return global.codexrExtensionContext;
}
//# sourceMappingURL=directoryDeepAnalysisCommands.js.map