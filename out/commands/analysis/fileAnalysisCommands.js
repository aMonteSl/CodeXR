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
const domVisualizationManager_1 = require("../../analysis/html/domVisualizationManager");
const staticVisualizationManager_1 = require("../../analysis/static/staticVisualizationManager");
const index_1 = require("../../analysis/static/index");
const dataManager_1 = require("../../analysis/utils/dataManager");
const languageUtils_1 = require("../../utils/languageUtils");
const analysisSessionManager_1 = require("../../analysis/analysisSessionManager");
const analysisSessionCommands_1 = require("../analysisSessionCommands");
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
    // Analyze current file command
    disposables.push(registerAnalyzeCurrentFileCommand(context));
    // Analyze file command (from tree view)
    disposables.push(registerAnalyzeFileCommand(context));
    // Analyze file from tree command
    disposables.push(registerAnalyzeFileFromTreeCommand(context));
    // Analyze file 3D (XR) command
    disposables.push(registerAnalyzeFile3DCommand(context));
    // Open and analyze file command
    disposables.push(registerOpenAndAnalyzeFileCommand(context));
    // Analyze multiple files 3D command
    disposables.push(registerAnalyzeMultipleFiles3DCommand(context));
    // Analyze folder command
    disposables.push(registerAnalyzeFolderCommand(context));
    // Show DOM visualization command
    disposables.push(registerShowDOMVisualizationCommand(context));
    // Visualize DOM command
    disposables.push(registerVisualizeDOMCommand(context));
    // Clear file analysis command
    disposables.push(registerClearFileAnalysisCommand());
    return disposables;
}
/**
 * Registers the analyze current file command
 * @param context Extension context
 * @returns Command disposable
 */
function registerAnalyzeCurrentFileCommand(context) {
    return vscode.commands.registerCommand('codexr.analyzeCurrentFile', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor found');
                return;
            }
            const filePath = editor.document.uri.fsPath;
            const fileExtension = path.extname(filePath).toLowerCase();
            // ✅ Special case: HTML files should always use DOM visualization
            if (fileExtension === '.html' || fileExtension === '.htm') {
                console.log(`🌐 HTML file detected in analyzeCurrentFile: ${filePath}, routing to DOM visualization`);
                return vscode.commands.executeCommand('codexr.visualizeDOM', editor.document.uri);
            }
            const language = (0, languageUtils_1.getLanguageName)(filePath);
            if (!isSupportedFileType(language)) {
                vscode.window.showWarningMessage(`File type not supported for analysis: ${language}`);
                return;
            }
            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Analyzing file...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: path.basename(filePath) });
                // Create static visualization (this performs analysis and shows results)
                const visualizationPath = await (0, staticVisualizationManager_1.createStaticVisualization)(context, filePath);
                if (visualizationPath) {
                    // Show success message
                    vscode.window.showInformationMessage(`Analysis complete: ${path.basename(filePath)}`);
                    // Refresh tree view
                    vscode.commands.executeCommand('codexr.refreshView');
                }
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to analyze file: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Registers the analyze file command (from tree view)
 * @param context Extension context
 * @returns Command disposable
 */
function registerAnalyzeFileCommand(context) {
    return vscode.commands.registerCommand('codexr.analyzeFile', async (fileUri) => {
        try {
            if (!fileUri) {
                vscode.window.showWarningMessage('No file selected');
                return;
            }
            const filePath = fileUri.fsPath;
            const fileExtension = path.extname(filePath).toLowerCase();
            // ✅ Special case: HTML files should always use DOM visualization
            if (fileExtension === '.html' || fileExtension === '.htm') {
                console.log(`🌐 HTML file detected in analyzeFile: ${filePath}, routing to DOM visualization`);
                return vscode.commands.executeCommand('codexr.visualizeDOM', fileUri);
            }
            const language = (0, languageUtils_1.getLanguageName)(filePath);
            if (!isSupportedFileType(language)) {
                vscode.window.showWarningMessage(`File type not supported for analysis: ${language}`);
                return;
            }
            // ✅ Check for duplicate analysis
            const duplicateAction = await (0, analysisSessionCommands_1.checkForDuplicateAnalysis)(filePath, analysisSessionManager_1.AnalysisType.STATIC);
            if (duplicateAction === 'cancel') {
                return; // User cancelled
            }
            if (duplicateAction === 'reopen') {
                return; // Existing analysis reopened
            }
            // ✅ Automatically open the source file in the editor
            try {
                await vscode.window.showTextDocument(fileUri, { preview: false });
            }
            catch (error) {
                console.warn('Could not open source file:', error);
                // Continue with analysis even if file opening fails
            }
            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Analyzing file...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: path.basename(filePath) });
                // Create static visualization (this performs analysis and shows results)
                const visualizationPath = await (0, staticVisualizationManager_1.createStaticVisualization)(context, filePath);
                if (visualizationPath) {
                    // Show success message
                    vscode.window.showInformationMessage(`Analysis complete: ${path.basename(filePath)}`);
                    // Refresh tree view
                    vscode.commands.executeCommand('codexr.refreshView');
                }
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to analyze file: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Registers the analyze file from tree command
 * @param context Extension context
 * @returns Command disposable
 */
function registerAnalyzeFileFromTreeCommand(context) {
    return vscode.commands.registerCommand('codexr.analyzeFileFromTree', async (fileUriOrPath) => {
        try {
            let fileUri;
            // Handle both Uri and string arguments for flexibility
            if (typeof fileUriOrPath === 'string') {
                fileUri = vscode.Uri.file(fileUriOrPath);
            }
            else if (fileUriOrPath && fileUriOrPath.fsPath) {
                fileUri = fileUriOrPath;
            }
            else {
                vscode.window.showWarningMessage('No valid file selected for analysis');
                return;
            }
            const filePath = fileUri.fsPath;
            const fileExtension = path.extname(filePath).toLowerCase();
            // ✅ Special case: HTML files should always use DOM visualization
            if (fileExtension === '.html' || fileExtension === '.htm') {
                console.log(`🌐 HTML file detected: ${filePath}, routing to DOM visualization`);
                return vscode.commands.executeCommand('codexr.visualizeDOM', fileUri);
            }
            // Get the user's preferred analysis mode for non-HTML files
            const config = vscode.workspace.getConfiguration('codexr');
            const analysisMode = config.get('analysisMode', 'XR');
            // Route to appropriate analysis command based on mode
            if (analysisMode === 'XR') {
                return vscode.commands.executeCommand('codexr.analyzeFile3D', fileUri);
            }
            else {
                return vscode.commands.executeCommand('codexr.analyzeFile', fileUri);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to analyze file from tree: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Registers the analyze file 3D (XR) command
 * @param context Extension context
 * @returns Command disposable
 */
function registerAnalyzeFile3DCommand(context) {
    return vscode.commands.registerCommand('codexr.analyzeFile3D', async (fileUri) => {
        try {
            let filePath;
            let targetFileUri;
            if (fileUri) {
                filePath = fileUri.fsPath;
                targetFileUri = fileUri;
            }
            else {
                // Try to get from active editor
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showWarningMessage('No active editor or file selected');
                    return;
                }
                filePath = editor.document.uri.fsPath;
                targetFileUri = editor.document.uri;
            }
            const fileExtension = path.extname(filePath).toLowerCase();
            // ✅ Special case: HTML files should always use DOM visualization
            if (fileExtension === '.html' || fileExtension === '.htm') {
                console.log(`🌐 HTML file detected in analyzeFile3D: ${filePath}, routing to DOM visualization`);
                return vscode.commands.executeCommand('codexr.visualizeDOM', targetFileUri);
            }
            const language = (0, languageUtils_1.getLanguageName)(filePath);
            if (!isSupportedFileType(language)) {
                vscode.window.showWarningMessage(`File type not supported for XR analysis: ${language}`);
                return;
            }
            // ✅ Check for duplicate analysis
            const duplicateAction = await (0, analysisSessionCommands_1.checkForDuplicateAnalysis)(filePath, analysisSessionManager_1.AnalysisType.XR);
            if (duplicateAction === 'cancel') {
                return; // User cancelled
            }
            if (duplicateAction === 'reopen') {
                return; // Existing analysis reopened
            }
            // ✅ Automatically open the source file in the editor
            try {
                await vscode.window.showTextDocument(targetFileUri, { preview: false });
            }
            catch (error) {
                console.warn('Could not open source file:', error);
                // Continue with analysis even if file opening fails
            }
            // Show progress and perform XR analysis
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Creating XR Analysis...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: path.basename(filePath) });
                // Import XR analysis manager
                const { createXRVisualization } = await import('../../analysis/xr/xrAnalysisManager.js');
                // First analyze the file to get the analysis result
                const analysisResult = await (0, index_1.analyzeFileStatic)(filePath, context);
                if (!analysisResult) {
                    throw new Error('Failed to analyze file for XR visualization');
                }
                // Create XR visualization
                await createXRVisualization(context, analysisResult);
                vscode.window.showInformationMessage(`XR Analysis created for ${path.basename(filePath)}`);
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to create XR analysis: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Registers the open and analyze file command
 * @param context Extension context
 * @returns Command disposable
 */
function registerOpenAndAnalyzeFileCommand(context) {
    return vscode.commands.registerCommand('codexr.openAndAnalyzeFile', async (fileUri) => {
        try {
            if (!fileUri) {
                vscode.window.showWarningMessage('No file selected');
                return;
            }
            // Open the file first
            const document = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(document);
            // Then analyze it
            await vscode.commands.executeCommand('codexr.analyzeFile', fileUri);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to open and analyze file: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Registers the analyze multiple files 3D command
 * @param context Extension context
 * @returns Command disposable
 */
function registerAnalyzeMultipleFiles3DCommand(context) {
    return vscode.commands.registerCommand('codexr.analyzeMultipleFiles3D', async () => {
        try {
            // Show file picker for multiple files
            const fileUris = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectMany: true,
                filters: {
                    'Code Files': ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'vue', 'rb', 'go', 'php', 'swift', 'kt', 'rs']
                }
            });
            if (!fileUris || fileUris.length === 0) {
                return;
            }
            // Analyze each file
            for (const fileUri of fileUris) {
                await vscode.commands.executeCommand('codexr.analyzeFile3D', fileUri);
            }
            vscode.window.showInformationMessage(`XR Analysis created for ${fileUris.length} files`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to analyze multiple files: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Registers the analyze folder command
 * @param context Extension context
 * @returns Command disposable
 */
function registerAnalyzeFolderCommand(context) {
    return vscode.commands.registerCommand('codexr.analyzeFolder', async (folderUri) => {
        try {
            let folderPath;
            if (folderUri) {
                folderPath = folderUri.fsPath;
            }
            else {
                // Show folder picker
                const folderUris = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false
                });
                if (!folderUris || folderUris.length === 0) {
                    return;
                }
                folderPath = folderUris[0].fsPath;
            }
            // Show progress and analyze folder
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Analyzing Folder...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: path.basename(folderPath) });
                // Find all supported files in the folder
                const pattern = new vscode.RelativePattern(folderPath, '**/*.{js,jsx,ts,tsx,py,java,c,cpp,cs,vue,rb,go,php,swift,kt,rs}');
                const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 50); // Limit to 50 files
                if (files.length === 0) {
                    vscode.window.showWarningMessage('No supported files found in the selected folder');
                    return;
                }
                // Analyze each file
                for (let i = 0; i < files.length; i++) {
                    progress.report({
                        increment: (100 / files.length),
                        message: `${i + 1}/${files.length}: ${path.basename(files[i].fsPath)}`
                    });
                    await vscode.commands.executeCommand('codexr.analyzeFile', files[i]);
                }
                vscode.window.showInformationMessage(`Analyzed ${files.length} files in folder: ${path.basename(folderPath)}`);
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to analyze folder: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Registers the show DOM visualization command
 * @param context Extension context
 * @returns Command disposable
 */
function registerShowDOMVisualizationCommand(context) {
    return vscode.commands.registerCommand('codexr.showDOMVisualization', async (analysisResult) => {
        try {
            if (!analysisResult) {
                // Try to get from current file
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showWarningMessage('No active editor or analysis result');
                    return;
                }
                const filePath = editor.document.uri.fsPath;
                analysisResult = dataManager_1.analysisDataManager.getAnalysisResult(filePath);
                if (!analysisResult) {
                    vscode.window.showWarningMessage('No analysis result found for current file');
                    return;
                }
            }
            // Show DOM visualization - FIXED: correct parameter order
            await (0, domVisualizationManager_1.showDOMVisualization)(analysisResult, context);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to show DOM visualization: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Registers the visualize DOM command
 * @param context Extension context
 * @returns Command disposable
 */
function registerVisualizeDOMCommand(context) {
    return vscode.commands.registerCommand('codexr.visualizeDOM', async (fileUri) => {
        try {
            let targetFile;
            if (fileUri) {
                targetFile = fileUri.fsPath;
            }
            else {
                // Get the currently active file
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showWarningMessage('No active HTML file to visualize');
                    return;
                }
                targetFile = editor.document.uri.fsPath;
            }
            // Check if it's an HTML file
            if (!targetFile.toLowerCase().endsWith('.html')) {
                vscode.window.showWarningMessage('DOM visualization is only available for HTML files');
                return;
            }
            // Create DOM visualization
            await (0, domVisualizationManager_1.showDOMVisualization)({ filePath: targetFile }, context);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to visualize DOM: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Registers the clear file analysis command
 * @returns Command disposable
 */
function registerClearFileAnalysisCommand() {
    return vscode.commands.registerCommand('codexr.clearFileAnalysis', async (fileUri) => {
        try {
            if (!fileUri) {
                vscode.window.showWarningMessage('No file selected');
                return;
            }
            const filePath = fileUri.fsPath;
            const fileName = path.basename(filePath);
            const confirm = await vscode.window.showWarningMessage(`Clear analysis data for ${fileName}?`, 'Clear', 'Cancel');
            if (confirm === 'Clear') {
                // Clear analysis data
                dataManager_1.analysisDataManager.clearAnalysisResult(filePath);
                // Clear function data if any
                dataManager_1.analysisDataManager.clearFunctionData(filePath);
                // Refresh tree view
                vscode.commands.executeCommand('codexr.refreshView');
                vscode.window.showInformationMessage(`Analysis data cleared for ${fileName}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to clear analysis: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
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
//# sourceMappingURL=fileAnalysisCommands.js.map