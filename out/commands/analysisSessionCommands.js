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
exports.registerAnalysisSessionCommands = registerAnalysisSessionCommands;
exports.checkForDuplicateAnalysis = checkForDuplicateAnalysis;
const vscode = __importStar(require("vscode"));
const analysisSessionManager_1 = require("../analysis/analysisSessionManager");
/**
 * Commands for analysis session management
 */
/**
 * Registers analysis session management commands
 */
function registerAnalysisSessionCommands(context) {
    const disposables = [];
    // Reopen analysis command
    disposables.push(registerReopenAnalysisCommand());
    // Close analysis command
    disposables.push(registerCloseAnalysisCommand());
    return disposables;
}
/**
 * Registers the reopen analysis command
 */
function registerReopenAnalysisCommand() {
    return vscode.commands.registerCommand('codexr.reopenAnalysis', async (filePath, analysisType) => {
        try {
            const sessionManager = analysisSessionManager_1.AnalysisSessionManager.getInstance();
            // Try to reopen existing session
            const reopened = sessionManager.reopenSession(filePath, analysisType);
            if (reopened) {
                vscode.window.showInformationMessage(`Reopened ${analysisType} analysis for ${filePath}`);
            }
            else {
                // Session might be stale, trigger new analysis
                await triggerNewAnalysis(filePath, analysisType);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to reopen analysis: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Registers the close analysis command
 */
function registerCloseAnalysisCommand() {
    return vscode.commands.registerCommand('codexr.closeAnalysis', async (treeItem) => {
        try {
            let filePath;
            let analysisType;
            if (treeItem && treeItem.session) {
                // Called from tree context menu
                filePath = treeItem.session.filePath;
                analysisType = treeItem.session.analysisType;
            }
            else {
                // Called directly with parameters
                filePath = arguments[0];
                analysisType = arguments[1];
            }
            if (!filePath || !analysisType) {
                vscode.window.showErrorMessage('Invalid analysis session');
                return;
            }
            const sessionManager = analysisSessionManager_1.AnalysisSessionManager.getInstance();
            sessionManager.closeSession(filePath, analysisType);
            vscode.window.showInformationMessage(`Closed ${analysisType} analysis for ${filePath.split('/').pop()}`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to close analysis: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Checks for duplicate analysis and prompts user for action
 */
async function checkForDuplicateAnalysis(filePath, analysisType) {
    const sessionManager = analysisSessionManager_1.AnalysisSessionManager.getInstance();
    if (!sessionManager.hasSession(filePath, analysisType)) {
        return 'proceed'; // No duplicate, proceed with new analysis
    }
    const fileName = filePath.split('/').pop() || filePath;
    const message = `A ${analysisType} analysis is already active for "${fileName}". What would you like to do?`;
    const choice = await vscode.window.showInformationMessage(message, { modal: true }, 'Reopen Existing', 'Close & Start Fresh', 'Cancel');
    switch (choice) {
        case 'Reopen Existing':
            const reopened = sessionManager.reopenSession(filePath, analysisType);
            if (reopened) {
                return 'reopen';
            }
            else {
                // Session was stale, close it and proceed with new
                sessionManager.closeSession(filePath, analysisType);
                return 'proceed';
            }
        case 'Close & Start Fresh':
            sessionManager.closeSession(filePath, analysisType);
            return 'proceed';
        default:
            return 'cancel';
    }
}
/**
 * Triggers a new analysis based on type
 */
async function triggerNewAnalysis(filePath, analysisType) {
    const fileUri = vscode.Uri.file(filePath);
    switch (analysisType) {
        case analysisSessionManager_1.AnalysisType.XR:
            await vscode.commands.executeCommand('codexr.analyzeFile3D', fileUri);
            break;
        case analysisSessionManager_1.AnalysisType.STATIC:
            await vscode.commands.executeCommand('codexr.analyzeFile', fileUri);
            break;
        case analysisSessionManager_1.AnalysisType.DOM:
            await vscode.commands.executeCommand('codexr.showDOMVisualization', fileUri);
            break;
        default:
            throw new Error(`Unknown analysis type: ${analysisType}`);
    }
}
//# sourceMappingURL=analysisSessionCommands.js.map