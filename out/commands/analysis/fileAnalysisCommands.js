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
exports.registerFileAnalysisCommands = registerFileAnalysisCommands;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const analysisManager_1 = require("../../analysis/analysisManager");
const xrAnalysisManager_1 = require("../../analysis/xr/xrAnalysisManager");
const domVisualizationManager_1 = require("../../analysis/html/domVisualizationManager");
const analysisDataManager_1 = require("../../analysis/analysisDataManager");
const fileWatchManager_1 = require("../../analysis/fileWatchManager");
const model_1 = require("../../analysis/model");
const commandHelpers_1 = require("../shared/commandHelpers");
const serverConflictHandler_1 = require("./serverConflictHandler");
/**
 * Commands for file analysis operations
 */
/**
 * Registers file analysis related commands
 * @param context Extension context
 * @returns Array of disposables for the registered commands
 */
function registerFileAnalysisCommands(context) {
    const disposables = [];
    // Static analysis command
    disposables.push(registerStaticAnalysisCommand(context));
    // XR analysis command
    disposables.push(registerXRAnalysisCommand(context));
    // Tree analysis command
    disposables.push(registerTreeAnalysisCommand(context));
    // Open and analyze command
    disposables.push(registerOpenAndAnalyzeCommand());
    // DOM visualization command
    disposables.push(registerDOMVisualizationCommand(context));
    return disposables;
}
/**
 * Registers the static analysis command
 * @param context Extension context
 * @returns Command disposable
 */
function registerStaticAnalysisCommand(context) {
    return vscode.commands.registerCommand('codexr.analyzeFile', async (fileUri) => {
        const filePath = (0, commandHelpers_1.getFilePathFromUri)(fileUri);
        if (!filePath) {
            return;
        }
        console.log(`🔍 Starting STATIC analysis of file: ${filePath}`);
        // ✅ CHECK: Make sure file is not already being analyzed
        if (analysisDataManager_1.analysisDataManager.isFileBeingAnalyzed(filePath)) {
            vscode.window.showWarningMessage(`File ${path.basename(filePath)} is already being analyzed. Please wait for the current analysis to complete.`);
            return;
        }
        // ✅ IMMEDIATE FEEDBACK: Show that analysis is starting
        vscode.window.showInformationMessage(`Starting analysis of ${path.basename(filePath)}...`, { modal: false });
        await (0, commandHelpers_1.withProgressNotification)(`Analyzing ${path.basename(filePath)}...`, async (progress) => {
            progress.report({ increment: 10, message: "Initializing analysis..." });
            try {
                // ✅ MARK FILE AS BEING ANALYZED IMMEDIATELY
                analysisDataManager_1.analysisDataManager.setFileAnalyzing(filePath);
                progress.report({ increment: 30, message: "Running code analysis..." });
                const result = await (0, analysisManager_1.analyzeFile)(filePath, context);
                if (!result) {
                    vscode.window.showErrorMessage('Failed to analyze file.');
                    return;
                }
                progress.report({ increment: 70, message: "Preparing visualization..." });
                // Store result
                analysisDataManager_1.analysisDataManager.setAnalysisResult(filePath, result);
                // Show static webview
                (0, analysisManager_1.showAnalysisWebView)(context, result);
                // Configure file watcher for static analysis
                configureFileWatcher(filePath, model_1.AnalysisMode.STATIC, context);
                console.log(`✅ Static analysis completed for ${path.basename(filePath)}`);
            }
            catch (error) {
                console.error('❌ Error in static analysis:', error);
                vscode.window.showErrorMessage(`Error analyzing file: ${error instanceof Error ? error.message : String(error)}`);
            }
            finally {
                // ✅ ALWAYS MARK AS COMPLETED
                analysisDataManager_1.analysisDataManager.setFileAnalyzed(filePath);
            }
        });
    });
}
/**
 * Registers the XR analysis command
 * @param context Extension context
 * @returns Command disposable
 */
function registerXRAnalysisCommand(context) {
    return vscode.commands.registerCommand('codexr.analyzeFile3D', async (fileUri) => {
        const filePath = (0, commandHelpers_1.getFilePathFromUri)(fileUri);
        if (!filePath) {
            return;
        }
        const fileName = path.basename(filePath);
        console.log(`🔮 Starting XR analysis of file: ${filePath}`);
        // Check for existing server conflicts
        const serverAction = await (0, serverConflictHandler_1.handleExistingServerConflict)(filePath, fileName);
        if (serverAction === 'cancel' || serverAction === 'open') {
            return;
        }
        // ✅ CHECK: Make sure file is not already being analyzed
        if (analysisDataManager_1.analysisDataManager.isFileBeingAnalyzed(filePath)) {
            vscode.window.showWarningMessage(`File ${fileName} is already being analyzed. Please wait for the current analysis to complete.`);
            return;
        }
        // ✅ IMMEDIATE FEEDBACK: Show that analysis is starting
        vscode.window.showInformationMessage(`Starting XR analysis of ${fileName}...`, { modal: false });
        await (0, commandHelpers_1.withProgressNotification)(`Creating XR visualization for ${fileName}...`, async (progress) => {
            progress.report({ increment: 10, message: "Initializing XR analysis..." });
            try {
                // ✅ MARK FILE AS BEING ANALYZED IMMEDIATELY
                analysisDataManager_1.analysisDataManager.setFileAnalyzing(filePath);
                progress.report({ increment: 30, message: "Running code analysis..." });
                const result = await (0, analysisManager_1.analyzeFile)(filePath, context);
                if (!result) {
                    vscode.window.showErrorMessage('Failed to analyze file.');
                    return;
                }
                progress.report({ increment: 70, message: "Creating XR visualization..." });
                // Store result
                analysisDataManager_1.analysisDataManager.setAnalysisResult(filePath, result);
                // Create XR visualization
                const xrPath = await (0, xrAnalysisManager_1.createXRVisualization)(context, result);
                if (!xrPath) {
                    vscode.window.showErrorMessage('Failed to create XR visualization.');
                    return;
                }
                // Configure file watcher for XR analysis
                configureFileWatcher(filePath, model_1.AnalysisMode.XR, context);
                console.log(`✅ XR analysis completed for ${fileName}`);
            }
            catch (error) {
                console.error('❌ Error in XR analysis:', error);
                vscode.window.showErrorMessage(`Error creating XR visualization: ${error instanceof Error ? error.message : String(error)}`);
            }
            finally {
                // ✅ ALWAYS MARK AS COMPLETED
                analysisDataManager_1.analysisDataManager.setFileAnalyzed(filePath);
            }
        });
    });
}
/**
 * Registers the tree analysis command
 * @param context Extension context
 * @returns Command disposable
 */
function registerTreeAnalysisCommand(context) {
    return vscode.commands.registerCommand('codexr.analyzeFileFromTree', async (filePath) => {
        console.log(`🌳 Analyzing file from tree: ${filePath}`);
        const fileName = path.basename(filePath);
        const fileExtension = path.extname(filePath).toLowerCase();
        // ✅ VALIDATION: Check if filePath is valid
        if (!filePath || typeof filePath !== 'string') {
            vscode.window.showErrorMessage('Invalid file path provided for analysis');
            return;
        }
        // ✅ CHECK: Make sure file exists
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
        }
        catch {
            vscode.window.showErrorMessage(`File not found: ${filePath}`);
            return;
        }
        // ✅ CHECK: Make sure file is not already being analyzed
        if (analysisDataManager_1.analysisDataManager.isFileBeingAnalyzed(filePath)) {
            vscode.window.showWarningMessage(`File ${fileName} is already being analyzed. Please wait for the current analysis to complete.`);
            return;
        }
        try {
            // Special handling for HTML files - Always use DOM visualization
            if (fileExtension === '.html' || fileExtension === '.htm') {
                return await handleHTMLFileFromTree(filePath, fileName, context);
            }
            // Special handling for unknown files
            const language = (0, commandHelpers_1.getLanguageName)(filePath);
            if (language === 'Unknown') {
                vscode.window.showInformationMessage(`File "${fileName}" has an unsupported extension (${fileExtension}). ` +
                    `CodeXR currently supports programming languages and HTML files for analysis.`, 'OK');
                return;
            }
            // For supported files: Use configured analysis mode
            await handleSupportedFileFromTree(filePath, fileName, context);
        }
        catch (error) {
            console.error('Error analyzing file from tree:', error);
            vscode.window.showErrorMessage(`Error analyzing file: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Registers the open and analyze command
 * @returns Command disposable
 */
function registerOpenAndAnalyzeCommand() {
    return vscode.commands.registerCommand('codexr.openAndAnalyzeFile', async (filePath) => {
        console.log(`📂 Opening and analyzing file: ${filePath}`);
        try {
            // Open the file in editor first
            const document = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(document);
            // Then run static analysis
            await vscode.commands.executeCommand('codexr.analyzeFile', vscode.Uri.file(filePath));
        }
        catch (error) {
            console.error('Error opening and analyzing file:', error);
            vscode.window.showErrorMessage(`Error opening file: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Registers the DOM visualization command
 * @param context Extension context
 * @returns Command disposable
 */
function registerDOMVisualizationCommand(context) {
    return vscode.commands.registerCommand('codexr.visualizeDOM', async (fileUri) => {
        try {
            // Get file path from URI or active editor
            let filePath;
            if (fileUri) {
                filePath = fileUri.fsPath;
            }
            else {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    filePath = editor.document.uri.fsPath;
                }
            }
            if (!filePath) {
                vscode.window.showErrorMessage('No HTML file selected');
                return;
            }
            // Verify it's an HTML file
            const fileExtension = path.extname(filePath).toLowerCase();
            if (fileExtension !== '.html' && fileExtension !== '.htm') {
                vscode.window.showErrorMessage('Please select an HTML file');
                return;
            }
            const fileName = path.basename(filePath);
            // Check for existing server conflicts
            const serverAction = await (0, serverConflictHandler_1.handleExistingServerConflict)(filePath, fileName);
            if (serverAction === 'cancel' || serverAction === 'open') {
                return;
            }
            // Show processing message
            vscode.window.showInformationMessage(`Creating DOM visualization for: ${fileName}...`, 'OK');
            // Create DOM visualization
            const result = await (0, domVisualizationManager_1.createDOMVisualization)(filePath, context);
            if (!result) {
                vscode.window.showErrorMessage(`Failed to create DOM visualization for ${fileName}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error creating DOM visualization: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Handles HTML file analysis from tree
 * @param filePath Path to the HTML file
 * @param fileName Name of the file
 * @param context Extension context
 */
async function handleHTMLFileFromTree(filePath, fileName, context) {
    console.log(`🌐 HTML file detected: ${fileName}, launching DOM visualization`);
    // Check for existing DOM visualization server conflicts
    const serverAction = await (0, serverConflictHandler_1.handleExistingServerConflict)(filePath, fileName);
    if (serverAction === 'cancel' || serverAction === 'open') {
        return;
    }
    // Execute DOM visualization command directly
    await vscode.commands.executeCommand('codexr.visualizeDOM', vscode.Uri.file(filePath));
}
/**
 * Handles supported file analysis from tree
 * @param filePath Path to the file
 * @param fileName Name of the file
 * @param context Extension context
 */
async function handleSupportedFileFromTree(filePath, fileName, context) {
    const config = vscode.workspace.getConfiguration();
    const currentMode = config.get('codexr.analysisMode', 'XR'); // ✅ CHANGED: Default from 'Static' to 'XR'
    console.log(`Using configured analysis mode: ${currentMode} for ${fileName}`);
    if (currentMode === 'XR') {
        // Check for existing server conflicts first
        const serverAction = await (0, serverConflictHandler_1.handleExistingServerConflict)(filePath, fileName);
        if (serverAction === 'cancel' || serverAction === 'open') {
            return;
        }
        // Execute XR analysis command directly
        await vscode.commands.executeCommand('codexr.analyzeFile3D', vscode.Uri.file(filePath));
    }
    else {
        // Execute static analysis command
        await vscode.commands.executeCommand('codexr.analyzeFile', vscode.Uri.file(filePath));
    }
    // Configure file watcher for the analysis mode
    configureFileWatcher(filePath, currentMode === 'XR' ? model_1.AnalysisMode.XR : model_1.AnalysisMode.STATIC, context);
}
/**
 * Configures file watcher for analysis
 * @param filePath Path to the file
 * @param mode Analysis mode
 * @param context Extension context
 */
function configureFileWatcher(filePath, mode, context) {
    const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
    // ✅ FIXED: Complete the function implementation
    if (fileWatchManager) {
        console.log(`🔧 Configuring file watcher for ${path.basename(filePath)} in ${mode} mode`);
        // Set the analysis mode for this file
        fileWatchManager.setAnalysisMode(filePath, mode);
        // Start watching the file
        fileWatchManager.startWatching(filePath, mode);
        console.log(`✅ File watcher configured successfully for ${path.basename(filePath)}`);
    }
    else {
        console.warn('⚠️ FileWatchManager not available, skipping file watcher configuration');
    }
}
//# sourceMappingURL=fileAnalysisCommands.js.map