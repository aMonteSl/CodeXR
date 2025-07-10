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
exports.registerDirectoryAnalysisCommands = registerDirectoryAnalysisCommands;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const directoryAnalysisManager_1 = require("../../analysis/static/directory/directoryAnalysisManager");
const directoryAnalysisConfig_1 = require("../../analysis/static/directory/common/directoryAnalysisConfig");
const directoryVisualizationManager_1 = require("../../analysis/static/directory/directoryVisualizationManager");
const directoryXRAnalysisManager_1 = require("../../analysis/xr/directoryXRAnalysisManager");
const directoryWatchManager_1 = require("../../analysis/watchers/directoryWatchManager");
const analysisSessionCommands_1 = require("../analysisSessionCommands");
const analysisSessionManager_1 = require("../../analysis/analysisSessionManager");
const directoryDeepAnalysisCommands_1 = require("./directoryDeepAnalysisCommands");
const directoryAnalysisDataManager_1 = require("../../analysis/shared/directoryAnalysisDataManager");
const directoryAnalysisProgress_1 = require("../../analysis/shared/directoryAnalysisProgress");
/**
 * Commands for directory and project-level static analysis
 */
/**
 * Registers directory analysis related commands
 * @param context Extension context
 * @returns Array of disposables for the registered commands
 */
function registerDirectoryAnalysisCommands(context) {
    const disposables = [];
    // Analyze directory (static) command
    disposables.push(registerAnalyzeDirectoryStaticCommand(context));
    // Analyze directory deep (static) command
    disposables.push(registerAnalyzeDirectoryDeepStaticCommand());
    // Analyze directory (XR) command
    disposables.push(registerAnalyzeDirectoryXRCommand(context));
    // Analyze directory deep (XR) command
    disposables.push(registerAnalyzeDirectoryXRDeepCommand(context));
    // Analyze project (static) command
    disposables.push(registerAnalyzeProjectStaticCommand(context));
    // Analyze project deep (static) command
    disposables.push(registerAnalyzeProjectDeepStaticCommand());
    // Analyze project (XR) command
    disposables.push(registerAnalyzeProjectXRCommand(context));
    // Analyze project deep (XR) command
    disposables.push(registerAnalyzeProjectXRDeepCommand(context));
    return disposables;
}
/**
 * Analyzes a directory with static analysis
 */
function registerAnalyzeDirectoryStaticCommand(context) {
    return vscode.commands.registerCommand('codexr.analyzeDirectoryStatic', async (uri) => {
        try {
            let targetPath;
            if (uri) {
                // Called from context menu
                const stat = await vscode.workspace.fs.stat(uri);
                if (stat.type === vscode.FileType.Directory) {
                    targetPath = uri.fsPath;
                }
                else {
                    // If it's a file, use its parent directory
                    targetPath = path.dirname(uri.fsPath);
                }
            }
            else {
                // Called from command palette - ask user to select directory
                const selectedUri = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: 'Select Directory to Analyze'
                });
                if (!selectedUri || selectedUri.length === 0) {
                    return;
                }
                targetPath = selectedUri[0].fsPath;
            }
            await analyzeDirectory(targetPath, context);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to analyze directory: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Analyzes the entire project (workspace root) with static analysis
 */
function registerAnalyzeProjectStaticCommand(context) {
    return vscode.commands.registerCommand('codexr.analyzeProjectStatic', async (uri) => {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showWarningMessage('No workspace folder is open. Please open a project first.');
                return;
            }
            let targetPath;
            if (workspaceFolders.length === 1) {
                targetPath = workspaceFolders[0].uri.fsPath;
            }
            else {
                // Multiple workspace folders - let user choose
                const items = workspaceFolders.map(folder => ({
                    label: folder.name,
                    description: folder.uri.fsPath,
                    uri: folder.uri
                }));
                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Select workspace folder to analyze'
                });
                if (!selected) {
                    return;
                }
                targetPath = selected.uri.fsPath;
            }
            // Always analyze the workspace root, regardless of which folder was right-clicked
            console.log(`🔍 Project analysis triggered - using workspace root: ${targetPath}`);
            await analyzeDirectory(targetPath, context, true); // true = project-level analysis
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to analyze project: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Core directory analysis function
 */
async function analyzeDirectory(directoryPath, context, isProject = false) {
    // Check for duplicate analysis
    const action = await (0, analysisSessionCommands_1.checkForDuplicateAnalysis)(directoryPath, analysisSessionManager_1.AnalysisType.DIRECTORY);
    if (action === 'cancel') {
        return;
    }
    else if (action === 'reopen') {
        return; // Panel was reopened, nothing more to do
    }
    const manager = new directoryAnalysisManager_1.DirectoryAnalysisManager();
    // Show progress indicator
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `${isProject ? 'Project' : 'Directory'} Analysis`,
        cancellable: true
    }, async (progress, token) => {
        const startTime = Date.now();
        progress.report({
            increment: 0,
            message: `Scanning ${isProject ? 'project' : 'directory'}...`
        });
        // Set up progress callback
        const progressCallback = (current, total, currentFile) => {
            if (token.isCancellationRequested) {
                throw new Error('Analysis cancelled by user');
            }
            const percentage = Math.round((current / total) * 100);
            progress.report({
                increment: percentage / total,
                message: `Analyzing file ${current}/${total}: ${path.basename(currentFile)}`
            });
        };
        try {
            // Load previous analysis data if available
            let previousResult;
            let dataPath;
            try {
                const previousData = await (0, directoryAnalysisDataManager_1.loadPreviousDirectoryAnalysis)({
                    context,
                    directoryPath,
                    mode: 'static',
                    isProject
                });
                previousResult = previousData.previousResult;
                dataPath = previousData.dataPath;
                if (previousResult) {
                    console.log(`DIRECTORY-ANALYSIS: STATIC Using previous shallow analysis data for incremental scanning`);
                }
            }
            catch (error) {
                console.warn(`DIRECTORY-ANALYSIS: STATIC Could not load previous shallow analysis data: ${error}`);
            }
            // Determine if this is initial analysis
            const isInitial = (0, directoryAnalysisProgress_1.isInitialAnalysis)(previousResult);
            // Log analysis start
            (0, directoryAnalysisProgress_1.logAnalysisStart)('static', directoryPath, isInitial);
            // Set up standardized progress callback for initial analysis
            const standardProgressCallback = isInitial
                ? (0, directoryAnalysisProgress_1.createNotificationProgressCallback)(progress, 'static', true)
                : progressCallback; // Use simple callback for incremental
            // Perform the shallow analysis (maxDepth = 1)
            manager.setProgressCallback(standardProgressCallback);
            const result = await manager.analyzeDirectory(directoryPath, directoryAnalysisConfig_1.DEFAULT_SHALLOW_FILTERS, previousResult);
            // Log analysis completion
            const duration = Date.now() - startTime;
            const filesAnalyzed = result.metadata.filesAnalyzedThisSession || result.summary.totalFilesAnalyzed;
            const totalFiles = result.metadata.totalFilesConsidered || result.summary.totalFiles;
            (0, directoryAnalysisProgress_1.logAnalysisComplete)('static', directoryPath, filesAnalyzed, totalFiles, isInitial, duration);
            // Save the analysis result if we have a data path
            if (dataPath) {
                try {
                    await (0, directoryAnalysisDataManager_1.saveDirectoryAnalysisResult)(result, dataPath, 'static');
                }
                catch (error) {
                    console.warn(`⚠️ Could not save shallow analysis result: ${error}`);
                }
            }
            progress.report({
                increment: 100,
                message: 'Creating visualization...'
            });
            // Show the results with shallow mode
            await (0, directoryVisualizationManager_1.createDirectoryVisualization)(context, directoryPath, result, isProject, 'shallow');
            // Start watching directory for changes in shallow mode
            directoryWatchManager_1.directoryWatchManager.startWatching(directoryPath, result, isProject, 'shallow');
            vscode.window.showInformationMessage(`${isProject ? 'Project' : 'Directory'} analysis completed! ` +
                `Analyzed ${result.summary.totalFilesAnalyzed} files out of ${result.summary.totalFiles} total files.`);
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('cancelled')) {
                vscode.window.showInformationMessage('Analysis cancelled by user.');
            }
            else {
                throw error;
            }
        }
    });
}
/**
 * Registers the deep directory analysis command
 */
function registerAnalyzeDirectoryDeepStaticCommand() {
    return vscode.commands.registerCommand('codexr.analyzeDirectoryDeepStatic', directoryDeepAnalysisCommands_1.analyzeDirectoryDeepStatic);
}
/**
 * Registers the deep project analysis command
 */
function registerAnalyzeProjectDeepStaticCommand() {
    return vscode.commands.registerCommand('codexr.analyzeProjectDeepStatic', directoryDeepAnalysisCommands_1.analyzeProjectDeepStatic);
}
/**
 * Analyzes a directory with XR visualization
 */
function registerAnalyzeDirectoryXRCommand(context) {
    return vscode.commands.registerCommand('codexr.analyzeDirectoryXR', async (uri) => {
        try {
            let targetPath;
            if (uri) {
                // Called from context menu
                const stat = await vscode.workspace.fs.stat(uri);
                if (stat.type === vscode.FileType.Directory) {
                    targetPath = uri.fsPath;
                }
                else {
                    vscode.window.showErrorMessage('Please select a directory to analyze.');
                    return;
                }
            }
            else {
                // Called from command palette
                const selected = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: 'Select Directory to Analyze (XR)'
                });
                if (!selected || selected.length === 0) {
                    return;
                }
                targetPath = selected[0].fsPath;
            }
            console.log(`🎯 Directory XR Analysis initiated for: ${targetPath}`);
            // Check for existing analysis
            const existingCheck = await (0, analysisSessionCommands_1.checkForDuplicateAnalysis)(targetPath, analysisSessionManager_1.AnalysisType.DIRECTORY);
            if (existingCheck === 'cancel') {
                return;
            }
            // Create XR visualization
            await (0, directoryXRAnalysisManager_1.createDirectoryXRVisualization)(context, targetPath, false);
            vscode.window.showInformationMessage(`Directory XR analysis completed! View opened in XR visualization panel.`);
        }
        catch (error) {
            console.error('Error in directory XR analysis:', error);
            vscode.window.showErrorMessage(`Failed to analyze directory: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Analyzes a directory with XR visualization (Deep recursive)
 */
function registerAnalyzeDirectoryXRDeepCommand(context) {
    return vscode.commands.registerCommand('codexr.analyzeDirectoryXRDeep', async (uri) => {
        try {
            let targetPath;
            if (uri) {
                // Called from context menu (right-click on folder)
                targetPath = uri.fsPath;
            }
            else {
                // Called from command palette - show folder picker
                const selectedFolder = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: 'Select Directory to Analyze (Deep XR)'
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
            console.log(`🎯 Directory XR Deep Analysis initiated for: ${targetPath}`);
            // Check for duplicate analysis
            await (0, analysisSessionCommands_1.checkForDuplicateAnalysis)(targetPath, analysisSessionManager_1.AnalysisType.DIRECTORY);
            // Create XR deep visualization
            await (0, directoryXRAnalysisManager_1.createDirectoryXRVisualizationDeep)(context, targetPath, false);
            vscode.window.showInformationMessage(`Directory Deep XR analysis completed! View opened in XR visualization panel.`);
        }
        catch (error) {
            console.error('Error in directory XR deep analysis:', error);
            vscode.window.showErrorMessage(`Failed to analyze directory: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Registers the "Analyze Project (XR)" command
 */
function registerAnalyzeProjectXRCommand(context) {
    return vscode.commands.registerCommand('codexr.analyzeProjectXR', async () => {
        try {
            // Get workspace folder
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder is open');
                return;
            }
            const targetPath = workspaceFolder.uri.fsPath;
            console.log(`🎯 Project XR Analysis initiated for: ${targetPath}`);
            // Check for duplicate analysis
            await (0, analysisSessionCommands_1.checkForDuplicateAnalysis)(targetPath, analysisSessionManager_1.AnalysisType.DIRECTORY);
            // Create XR visualization (shallow mode)
            await (0, directoryXRAnalysisManager_1.createDirectoryXRVisualization)(context, targetPath, true);
            vscode.window.showInformationMessage(`Project XR analysis completed! View opened in XR visualization panel.`);
        }
        catch (error) {
            console.error('Error in project XR analysis:', error);
            vscode.window.showErrorMessage(`Failed to analyze project: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Registers the "Analyze Project Deep (XR)" command
 */
function registerAnalyzeProjectXRDeepCommand(context) {
    return vscode.commands.registerCommand('codexr.analyzeProjectXRDeep', async () => {
        try {
            // Get workspace folder
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder is open');
                return;
            }
            const targetPath = workspaceFolder.uri.fsPath;
            console.log(`🎯 Project Deep XR Analysis initiated for: ${targetPath}`);
            // Check for duplicate analysis
            await (0, analysisSessionCommands_1.checkForDuplicateAnalysis)(targetPath, analysisSessionManager_1.AnalysisType.DIRECTORY);
            // Create XR deep visualization
            await (0, directoryXRAnalysisManager_1.createDirectoryXRVisualizationDeep)(context, targetPath, true);
            vscode.window.showInformationMessage(`Project Deep XR analysis completed! View opened in XR visualization panel.`);
        }
        catch (error) {
            console.error('Error in project deep XR analysis:', error);
            vscode.window.showErrorMessage(`Failed to analyze project: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
//# sourceMappingURL=directoryAnalysisCommands.js.map