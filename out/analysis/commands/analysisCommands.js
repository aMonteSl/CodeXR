"use strict";
/**
 * Analysis Commands Module
 *
 * This module contains all command handlers specifically related to file analysis operations.
 * These commands are exported and registered by the main command registration system.
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
exports.isSupportedFileType = isSupportedFileType;
exports.executeFileAnalysis = executeFileAnalysis;
exports.executeXRAnalysis = executeXRAnalysis;
exports.executeAnalysisWithModeCheck = executeAnalysisWithModeCheck;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const analysisManager_1 = require("../analysisManager");
const dataManager_1 = require("../utils/dataManager");
const languageUtils_1 = require("../../utils/languageUtils");
/**
 * Checks if a file type is supported for analysis
 * @param language Language/file type
 * @returns true if supported
 */
function isSupportedFileType(language) {
    const supportedTypes = [
        'JavaScript', 'TypeScript', 'Python', 'Java', 'C', 'C++', 'C#',
        'Ruby', 'Go', 'PHP', 'Swift', 'Kotlin', 'Rust', 'HTML', 'Vue',
        'Scala', 'Lua', 'Erlang', 'Zig', 'Perl', 'Solidity', 'TTCN-3',
        'Objective-C', 'Objective-C++', 'Fortran', 'GDScript'
    ];
    return supportedTypes.includes(language);
}
/**
 * Analyzes a file and handles result display
 * This is the core analysis function used by various command handlers
 */
async function executeFileAnalysis(filePath, context, showPanel = true) {
    const language = (0, languageUtils_1.getLanguageName)(filePath);
    if (!isSupportedFileType(language)) {
        vscode.window.showWarningMessage(`File type not supported for analysis: ${language}`);
        return false;
    }
    // Show progress
    return await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Analyzing file...',
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 0, message: path.basename(filePath) });
        // Perform analysis
        const result = await (0, analysisManager_1.analyzeFile)(filePath, context);
        if (result) {
            // Store result
            dataManager_1.analysisDataManager.setAnalysisResult(filePath, result);
            // Show analysis results panel if requested
            if (showPanel) {
                await vscode.commands.executeCommand('codexr.updateAnalysisPanel', result);
            }
            // Show success message
            vscode.window.showInformationMessage(`Analysis complete: ${path.basename(filePath)}`);
            // Refresh tree view
            vscode.commands.executeCommand('codexr.refreshView');
            return true;
        }
        return false;
    });
}
/**
 * Executes XR (3D) analysis for a file
 */
async function executeXRAnalysis(filePath, context) {
    const language = (0, languageUtils_1.getLanguageName)(filePath);
    if (!isSupportedFileType(language)) {
        vscode.window.showWarningMessage(`File type not supported for XR analysis: ${language}`);
        return;
    }
    // Show progress and perform XR analysis
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Creating XR Analysis...',
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 0, message: path.basename(filePath) });
        // Import XR analysis manager
        const { createXRVisualization } = await import('../xr/xrAnalysisManager.js');
        // First analyze the file to get the analysis result
        const analysisResult = await (0, analysisManager_1.analyzeFile)(filePath, context);
        if (!analysisResult) {
            throw new Error('Failed to analyze file for XR visualization');
        }
        // Create XR visualization
        await createXRVisualization(context, analysisResult);
        vscode.window.showInformationMessage(`XR Analysis created for ${path.basename(filePath)}`);
    });
}
/**
 * Routes to appropriate analysis based on user's mode preference
 */
async function executeAnalysisWithModeCheck(fileUri, context) {
    // Get the user's preferred analysis mode
    const config = vscode.workspace.getConfiguration('codexr');
    const analysisMode = config.get('analysisMode', 'XR');
    const filePath = fileUri.fsPath;
    // Route to appropriate analysis command based on mode
    if (analysisMode === 'XR') {
        await executeXRAnalysis(filePath, context);
    }
    else {
        await executeFileAnalysis(filePath, context, true);
    }
}
//# sourceMappingURL=analysisCommands.js.map