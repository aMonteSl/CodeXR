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
exports.analyzeFile = analyzeFile;
exports.showAnalysisWebView = showAnalysisWebView;
exports.sendAnalysisData = sendAnalysisData;
exports.createAnalysisXRVisualization = createAnalysisXRVisualization;
exports.createHTMLDOMVisualization = createHTMLDOMVisualization;
exports.getFileWatchManager = getFileWatchManager;
exports.disposeAnalysis = disposeAnalysis;
const vscode = __importStar(require("vscode"));
const static_1 = require("./static");
const xr_1 = require("./xr");
const html_1 = require("./html");
const dataManager_1 = require("./utils/dataManager");
const watchers_1 = require("./watchers");
const nonceUtils_1 = require("../utils/nonceUtils");
/**
 * Main analysis manager that orchestrates all analysis operations
 * This is the primary entry point for the analysis system
 */
// Output channel for general analysis operations
let analysisOutputChannel;
/**
 * Gets or creates the main analysis output channel
 */
function getOutputChannel() {
    if (!analysisOutputChannel) {
        analysisOutputChannel = vscode.window.createOutputChannel('CodeXR Analysis');
    }
    return analysisOutputChannel;
}
/**
 * Analyzes a single file using the appropriate analysis method
 */
async function analyzeFile(filePath, context) {
    try {
        // For now, we primarily use static analysis
        // In the future, this could route to different analyzers based on file type
        return await (0, static_1.analyzeFileStatic)(filePath, context);
    }
    catch (error) {
        const outputChannel = getOutputChannel();
        outputChannel.appendLine(`❌ Error in main analysis: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}
/**
 * Shows analysis results in a webview panel
 */
async function showAnalysisWebView(analysisResult, context) {
    try {
        const panel = vscode.window.createWebviewPanel('codeAnalysis', `Analysis: ${analysisResult.fileName}`, vscode.ViewColumn.Beside, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(context.extensionPath),
                vscode.Uri.file(require('path').join(context.extensionPath, 'media')),
                vscode.Uri.file(require('path').join(context.extensionPath, 'templates'))
            ]
        });
        // Generate nonce for security
        const nonce = (0, nonceUtils_1.generateNonce)();
        // Get resource URIs
        const styleUri = panel.webview.asWebviewUri(vscode.Uri.file(require('path').join(context.extensionPath, 'media', 'analysis', 'fileAnalysisstyle.css')));
        const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(require('path').join(context.extensionPath, 'media', 'analysis', 'fileAnalysismain.js')));
        // Load and populate the HTML template
        const templatePath = require('path').join(context.extensionPath, 'templates', 'analysis', 'fileAnalysis.html');
        let htmlContent = await require('fs').promises.readFile(templatePath, 'utf8');
        // Replace template variables
        htmlContent = htmlContent
            .replace(/\${nonce}/g, nonce)
            .replace(/\${styleUri}/g, styleUri.toString())
            .replace(/\${scriptUri}/g, scriptUri.toString());
        panel.webview.html = htmlContent;
        // Store panel reference
        dataManager_1.analysisDataManager.setActiveFileAnalysisPanel(analysisResult.filePath, panel);
        // Send analysis data to webview
        await sendAnalysisData(panel, analysisResult);
        // Handle cleanup when panel is closed
        panel.onDidDispose(() => {
            dataManager_1.analysisDataManager.setActiveFileAnalysisPanel(analysisResult.filePath, null);
        });
        // Handle messages from webview
        panel.webview.onDidReceiveMessage(async (message) => {
            await handleWebviewMessage(message, context, analysisResult);
        });
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to show analysis webview: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Sends analysis data to a webview panel
 */
async function sendAnalysisData(panel, analysisResult) {
    try {
        await panel.webview.postMessage({
            command: 'setAnalysisData',
            data: analysisResult
        });
    }
    catch (error) {
        console.error('Error sending analysis data to webview:', error);
    }
}
/**
 * Handles messages received from webview panels
 */
async function handleWebviewMessage(message, context, analysisResult) {
    try {
        switch (message.command) {
            case 'showFunctionDetails':
                await showFunctionDetailsPanel(message.data, context);
                break;
            case 'openInEditor':
                await openFileInEditor(message.data.filePath, message.data.lineNumber);
                break;
            case 'backToFileAnalysis':
                // Re-focus the file analysis panel
                const panel = dataManager_1.analysisDataManager.getActiveFileAnalysisPanel(analysisResult.filePath);
                if (panel) {
                    panel.reveal();
                }
                break;
            default:
                console.warn(`Unknown webview message command: ${message.command}`);
        }
    }
    catch (error) {
        console.error('Error handling webview message:', error);
    }
}
/**
 * Shows detailed function analysis in a separate panel
 */
async function showFunctionDetailsPanel(data, context) {
    try {
        const panel = vscode.window.createWebviewPanel('functionAnalysis', `Function: ${data.function.name}`, vscode.ViewColumn.Beside, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(context.extensionPath),
                vscode.Uri.file(require('path').join(context.extensionPath, 'media')),
                vscode.Uri.file(require('path').join(context.extensionPath, 'templates'))
            ]
        });
        // Generate nonce for security
        const nonce = (0, nonceUtils_1.generateNonce)();
        // Get resource URIs
        const styleUri = panel.webview.asWebviewUri(vscode.Uri.file(require('path').join(context.extensionPath, 'media', 'analysis', 'functionAnalysisstyle.css')));
        const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(require('path').join(context.extensionPath, 'media', 'analysis', 'functionAnalysismain.js')));
        // Load and populate the HTML template
        const templatePath = require('path').join(context.extensionPath, 'templates', 'analysis', 'functionAnalysis.html');
        let htmlContent = await require('fs').promises.readFile(templatePath, 'utf8');
        // Replace template variables
        htmlContent = htmlContent
            .replace(/\${nonce}/g, nonce)
            .replace(/\${styleUri}/g, styleUri.toString())
            .replace(/\${scriptUri}/g, scriptUri.toString());
        panel.webview.html = htmlContent;
        // Store function data and panel reference
        dataManager_1.analysisDataManager.setFunctionData(data.filePath, data);
        dataManager_1.analysisDataManager.setActiveFunctionAnalysisPanel(data.filePath, panel);
        // Send function data to webview
        await panel.webview.postMessage({
            command: 'setFunctionData',
            data: data
        });
        // Handle cleanup when panel is closed
        panel.onDidDispose(() => {
            dataManager_1.analysisDataManager.setActiveFunctionAnalysisPanel(data.filePath, null);
            dataManager_1.analysisDataManager.clearFunctionData(data.filePath);
        });
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to show function details: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Opens a file in the editor at a specific line
 */
async function openFileInEditor(filePath, lineNumber) {
    try {
        const document = await vscode.workspace.openTextDocument(filePath);
        const editor = await vscode.window.showTextDocument(document);
        if (lineNumber && lineNumber > 0) {
            const position = new vscode.Position(lineNumber - 1, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position));
        }
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to open file: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Creates an XR visualization for a file analysis result
 */
async function createAnalysisXRVisualization(context, analysisResult) {
    try {
        return await (0, xr_1.createXRVisualization)(context, analysisResult);
    }
    catch (error) {
        const outputChannel = getOutputChannel();
        outputChannel.appendLine(`❌ Error creating XR visualization: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}
/**
 * Creates a DOM visualization for an HTML file
 */
async function createHTMLDOMVisualization(context, filePath) {
    try {
        const domResult = await (0, html_1.parseHTMLFile)(filePath);
        const fileName = require('path').basename(filePath, require('path').extname(filePath));
        const visualizationFolder = (0, html_1.getDOMVisualizationFolder)(fileName);
        return visualizationFolder;
    }
    catch (error) {
        const outputChannel = getOutputChannel();
        outputChannel.appendLine(`❌ Error creating DOM visualization: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}
/**
 * Gets the file watch manager instance
 */
function getFileWatchManager() {
    return watchers_1.FileWatchManager.getInstance();
}
/**
 * Disposes of analysis resources
 */
function disposeAnalysis() {
    if (analysisOutputChannel) {
        analysisOutputChannel.dispose();
    }
    // Clear all analysis data
    dataManager_1.analysisDataManager.clearAllData();
    // Stop all file watchers
    const fileWatchManager = watchers_1.FileWatchManager.getInstance();
    if (fileWatchManager) {
        fileWatchManager.stopAllWatchers();
    }
}
//# sourceMappingURL=analysisManager.js.map