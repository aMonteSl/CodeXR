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
exports.registerSetAnalysisModeCommand = registerSetAnalysisModeCommand;
exports.registerSetAnalysisDebounceDelayCommand = registerSetAnalysisDebounceDelayCommand;
exports.registerToggleAutoAnalysisCommand = registerToggleAutoAnalysisCommand;
exports.registerRefreshAnalysisTreeCommand = registerRefreshAnalysisTreeCommand;
exports.registerSetAnalysisChartTypeCommand = registerSetAnalysisChartTypeCommand;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const analysisManager_1 = require("../analysis/analysisManager");
const fileWatchManager_1 = require("../analysis/fileWatchManager");
const model_1 = require("../analysis/model");
const xrAnalysisManager_1 = require("../analysis/xr/xrAnalysisManager");
const analysisDataManager_1 = require("../analysis/analysisDataManager");
/**
 * Registers all analysis-related commands
 * @param context Extension context for storage
 * @returns Array of disposables for registered commands
 */
function registerAnalysisCommands(context) {
    // Use an array to collect all command disposables
    const disposables = [];
    // IMPORTANT: Don't register these since they would conflict with our new ones
    // Register analyze command
    // disposables.push(registerAnalysisCommand(context));
    // Register 3D analysis command
    // disposables.push(registerAnalysis3DCommand(context));
    // Register the command to switch analysis modes
    disposables.push(registerSetAnalysisModeCommand());
    // Actualizar el comando de análisis desde el árbol
    disposables.push(vscode.commands.registerCommand('codexr.analyzeFileFromTree', async (filePath) => {
        console.log(`Analyzing file from tree: ${filePath}`);
        // Fix the showAnalysisWebView calls to include both required parameters
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Analyzing ${path.basename(filePath)}...`,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 30, message: "Running code analysis..." });
            const result = await (0, analysisManager_1.analyzeFile)(filePath, context);
            progress.report({ increment: 70, message: "Preparing visualization..." });
            if (result) {
                // Store result for potential updates
                analysisDataManager_1.analysisDataManager.setAnalysisResult(filePath, result);
                // Display the analysis in the webview
                (0, analysisManager_1.showAnalysisWebView)(context, result);
            }
            return Promise.resolve();
        });
    }));
    // Register standard analysis command (replacing the previous implementation)
    const analyzeFileCommand = vscode.commands.registerCommand('codexr.analyzeFile', async (fileUri) => {
        try {
            // Get the active file if no fileUri is provided
            if (!fileUri) {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage('No file selected for analysis.');
                    return;
                }
                fileUri = editor.document.uri;
            }
            // At this point fileUri is guaranteed to be defined
            const filePath = fileUri.fsPath;
            console.log(`Starting analysis of file: ${filePath}`);
            // Show progress notification
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Analyzing ${path.basename(filePath)}...`,
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 30, message: "Running code analysis..." });
                // Use filePath instead of fileUri.fsPath
                const result = await (0, analysisManager_1.analyzeFile)(filePath, context);
                progress.report({ increment: 70, message: "Preparing visualization..." });
                if (result) {
                    // Store result for potential updates
                    analysisDataManager_1.analysisDataManager.setAnalysisResult(filePath, result);
                    // Display the analysis in the webview
                    (0, analysisManager_1.showAnalysisWebView)(context, result);
                    // Set up file watcher after successful analysis
                    const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
                    if (fileWatchManager) {
                        fileWatchManager.setContext(context);
                        fileWatchManager.setAnalysisMode(filePath, model_1.AnalysisMode.STATIC);
                        fileWatchManager.startWatching(filePath, model_1.AnalysisMode.STATIC);
                        console.log(`File watcher set up for static analysis of ${filePath}`);
                    }
                }
                else {
                    vscode.window.showErrorMessage('Failed to analyze file. Check console for details.');
                }
                return Promise.resolve();
            });
        }
        catch (error) {
            console.error('Error analyzing file in static mode:', error);
            vscode.window.showErrorMessage(`Error analyzing file: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    disposables.push(analyzeFileCommand);
    // Reemplazar el comando de análisis XR
    const analyzeFile3DCommand = vscode.commands.registerCommand('codexr.analyzeFile3D', async (fileUri) => {
        try {
            // Get the active file if no fileUri is provided
            if (!fileUri) {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage('No file selected for analysis.');
                    return;
                }
                fileUri = editor.document.uri;
            }
            // At this point fileUri is guaranteed to be defined
            const filePath = fileUri.fsPath;
            console.log(`Starting XR analysis of file: ${filePath}`);
            // Show progress notification
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Preparing XR visualization for ${path.basename(filePath)}...`,
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 30, message: "Running code analysis..." });
                // Use filePath instead of fileUri.fsPath
                const result = await (0, analysisManager_1.analyzeFile)(filePath, context);
                if (!result) {
                    vscode.window.showErrorMessage('Failed to analyze file for XR visualization.');
                    return Promise.resolve();
                }
                progress.report({ increment: 60, message: "Creating XR visualization..." });
                // Store result for potential updates
                analysisDataManager_1.analysisDataManager.setAnalysisResult(filePath, result);
                // Create and open XR visualization
                const htmlFilePath = await (0, xrAnalysisManager_1.createXRVisualization)(context, result);
                if (htmlFilePath) {
                    progress.report({ increment: 90, message: "Opening visualization in browser..." });
                    // Set up file watcher after successful analysis
                    const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
                    if (fileWatchManager) {
                        fileWatchManager.setContext(context);
                        fileWatchManager.setAnalysisMode(filePath, model_1.AnalysisMode.XR);
                        fileWatchManager.startWatching(filePath, model_1.AnalysisMode.XR);
                        // Para el modo XR, también configurar la ruta del HTML
                        fileWatchManager.setXRHtmlPath(filePath, htmlFilePath);
                    }
                    // Open the visualization in the browser
                    await (0, xrAnalysisManager_1.openXRVisualization)(htmlFilePath, context);
                }
                else {
                    vscode.window.showErrorMessage('Failed to create XR visualization.');
                }
                return Promise.resolve();
            });
        }
        catch (error) {
            console.error('Error analyzing file for XR:', error);
            vscode.window.showErrorMessage(`Error creating XR visualization: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    disposables.push(analyzeFile3DCommand);
    // Command to analyze multiple files in XR mode
    const analyzeMultipleFiles3DCommand = vscode.commands.registerCommand('codexr.analyzeMultipleFiles3D', async (fileUris) => {
        try {
            // If no fileUris provided, let the user select files
            if (!fileUris || fileUris.length === 0) {
                const options = {
                    canSelectMany: true,
                    openLabel: 'Analyze Files in XR',
                    filters: {
                        'Code Files': ['py', 'js', 'ts', 'c', 'cpp', 'java']
                    }
                };
                fileUris = await vscode.window.showOpenDialog(options);
                if (!fileUris || fileUris.length === 0) {
                    return;
                }
            }
            // Show progress notification
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Preparing XR visualizations for ${fileUris.length} files...`,
                cancellable: false
            }, async (progress) => {
                // Process each file
                for (let i = 0; i < fileUris.length; i++) {
                    const fileUri = fileUris[i];
                    const filePath = fileUri.fsPath;
                    const fileName = path.basename(filePath);
                    progress.report({
                        increment: (100 / fileUris.length),
                        message: `Analyzing ${fileName} (${i + 1}/${fileUris.length})`
                    });
                    // Analyze the file
                    const result = await (0, analysisManager_1.analyzeFile)(filePath, context);
                    if (result) {
                        // Store the result
                        analysisDataManager_1.analysisDataManager.setAnalysisResult(filePath, result);
                        // Create XR visualization
                        const htmlFilePath = await (0, xrAnalysisManager_1.createXRVisualization)(context, result);
                        if (htmlFilePath) {
                            // Set up file watcher
                            const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
                            if (fileWatchManager) {
                                fileWatchManager.setContext(context);
                                fileWatchManager.setAnalysisMode(filePath, model_1.AnalysisMode.XR);
                                fileWatchManager.startWatching(filePath, model_1.AnalysisMode.XR);
                                fileWatchManager.setXRHtmlPath(filePath, htmlFilePath);
                            }
                            // Open visualization in browser
                            await (0, xrAnalysisManager_1.openXRVisualization)(htmlFilePath, context, filePath);
                        }
                    }
                }
                return Promise.resolve();
            });
        }
        catch (error) {
            console.error('Error analyzing multiple files:', error);
            vscode.window.showErrorMessage(`Error analyzing files: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    disposables.push(analyzeMultipleFiles3DCommand);
    // Command to open and analyze file in static mode
    const openAndAnalyzeFileCommand = vscode.commands.registerCommand('codexr.openAndAnalyzeFile', async (fileUri) => {
        try {
            // First, open the document
            await vscode.window.showTextDocument(fileUri);
            // Then analyze it
            await vscode.commands.executeCommand('codexr.analyzeFile', fileUri);
        }
        catch (error) {
            console.error('Error opening and analyzing file:', error);
            vscode.window.showErrorMessage(`Error analyzing file: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    disposables.push(openAndAnalyzeFileCommand);
    // Command to open and analyze file in XR mode
    const openAndAnalyzeFile3DCommand = vscode.commands.registerCommand('codexr.openAndAnalyzeFile3D', async (fileUri) => {
        try {
            // First, open the document
            await vscode.window.showTextDocument(fileUri);
            // Then analyze it in XR mode
            await vscode.commands.executeCommand('codexr.analyzeFile3D', fileUri);
        }
        catch (error) {
            console.error('Error opening and analyzing file in XR mode:', error);
            vscode.window.showErrorMessage(`Error analyzing file in XR: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    disposables.push(openAndAnalyzeFile3DCommand);
    // Register the command to set analysis debounce delay
    disposables.push(registerSetAnalysisDebounceDelayCommand());
    // Register the command to toggle auto-analysis
    disposables.push(registerToggleAutoAnalysisCommand());
    // Add our refresh tree command
    disposables.push(registerRefreshAnalysisTreeCommand());
    // Register the command to set the analysis chart type
    disposables.push(registerSetAnalysisChartTypeCommand());
    return disposables;
}
/**
 * Sets the default analysis mode
 */
function registerSetAnalysisModeCommand() {
    return vscode.commands.registerCommand('codexr.setAnalysisMode', async (mode) => {
        console.log('Setting analysis mode to:', mode);
        const config = vscode.workspace.getConfiguration();
        await config.update('codexr.analysisMode', mode, vscode.ConfigurationTarget.Global);
        // Show confirmation message
        vscode.window.showInformationMessage(`Default analysis mode set to: ${mode}`);
        // Use type assertion to avoid TypeScript error
        if (global.treeDataProvider) {
            global.treeDataProvider.refresh();
        }
        else {
            // Fallback
            await vscode.commands.executeCommand('codexr.refreshTreeView');
        }
    });
}
/**
 * Sets the analysis debounce delay
 */
function registerSetAnalysisDebounceDelayCommand() {
    return vscode.commands.registerCommand('codexr.setAnalysisDebounceDelay', async () => {
        const options = [
            { label: "Very Quick (500ms)", value: 500 },
            { label: "Quick (1 second)", value: 1000 },
            { label: "Standard (2 seconds)", value: 2000 },
            { label: "Relaxed (3 seconds)", value: 3000 },
            { label: "Extended (5 seconds)", value: 5000 }
        ];
        const selection = await vscode.window.showQuickPick(options.map(option => ({
            label: option.label,
            description: `${option.value}ms`,
            value: option.value
        })), {
            placeHolder: 'Select debounce delay',
            title: 'How long to wait before auto-analyzing after a file change'
        });
        if (selection) {
            console.log('Setting analysis debounce delay to:', selection.value);
            // Update configuration
            const config = vscode.workspace.getConfiguration();
            await config.update('codexr.analysis.debounceDelay', selection.value, vscode.ConfigurationTarget.Global);
            // Update FileWatchManager directly
            const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
            if (fileWatchManager) {
                fileWatchManager.setDebounceDelay(selection.value);
            }
            // Show confirmation
            vscode.window.showInformationMessage(`Analysis debounce delay set to: ${selection.label}`);
            // Refresh tree view
            if (global.treeDataProvider) {
                global.treeDataProvider.refresh();
            }
            else {
                await vscode.commands.executeCommand('codexr.refreshTreeView');
            }
        }
    });
}
/**
 * Toggles automatic analysis
 */
function registerToggleAutoAnalysisCommand() {
    return vscode.commands.registerCommand('codexr.toggleAutoAnalysis', async () => {
        const config = vscode.workspace.getConfiguration();
        const currentSetting = config.get('codexr.analysis.autoAnalysis', true);
        // Toggle the setting
        const newSetting = !currentSetting;
        console.log('Toggling auto-analysis from', currentSetting, 'to', newSetting);
        // Update configuration
        await config.update('codexr.analysis.autoAnalysis', newSetting, vscode.ConfigurationTarget.Global);
        // Update FileWatchManager directly
        const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
        if (fileWatchManager) {
            fileWatchManager.setAutoAnalysis(newSetting);
        }
        // Show confirmation
        vscode.window.showInformationMessage(`Auto-analysis ${newSetting ? 'enabled' : 'disabled'}`);
        // Refresh tree view
        if (global.treeDataProvider) {
            global.treeDataProvider.refresh();
        }
        else {
            await vscode.commands.executeCommand('codexr.refreshTreeView');
        }
    });
}
/**
 * Sets the analysis debounce delay
 */
function registerRefreshAnalysisTreeCommand() {
    return vscode.commands.registerCommand('codexr.refreshAnalysisTree', async () => {
        // Usa el proveedor global si está disponible
        if (global.treeDataProvider) {
            console.log('Refreshing analysis tree via global provider');
            global.treeDataProvider.refresh();
        }
        else {
            // Fallback - intenta usar el comando estándar de refresh
            console.log('Refreshing tree view via command');
            await vscode.commands.executeCommand('codexr.refreshTreeView');
        }
        vscode.window.showInformationMessage('Analysis tree refreshed');
    });
}
/**
 * Registers the command to set the analysis chart type
 */
function registerSetAnalysisChartTypeCommand() {
    return vscode.commands.registerCommand('codexr.setAnalysisChartType', async () => {
        const options = [
            { label: "Boats", description: "3D Blocks Visualization", value: "boats" },
            { label: "Bars", description: "Classic 2D Bar Chart", value: "bars" },
            { label: "Cylinders", description: "3D Cylinder Chart", value: "cyls" },
            { label: "Bars Map", description: "3D Bars Layout", value: "barsmap" },
            { label: "Pie Chart", description: "Circular Sectors Chart", value: "pie" },
            { label: "Donut Chart", description: "Ring Chart with Center Hole", value: "donut" }
        ];
        const selection = await vscode.window.showQuickPick(options.map(option => ({
            label: option.label,
            description: option.description,
            value: option.value
        })), {
            placeHolder: 'Select chart type for visualizations',
            title: 'Which chart type should be used for code analysis?'
        });
        if (selection) {
            console.log('Setting analysis chart type to:', selection.value);
            // Update configuration
            const config = vscode.workspace.getConfiguration();
            await config.update('codexr.analysis.chartType', selection.value, vscode.ConfigurationTarget.Global);
            // Show confirmation
            vscode.window.showInformationMessage(`Analysis chart type set to: ${selection.label}`);
            // Refresh tree view to show updated setting
            if (global.treeDataProvider) {
                global.treeDataProvider.refresh();
            }
            else {
                await vscode.commands.executeCommand('codexr.refreshTreeView');
            }
        }
    });
}
//# sourceMappingURL=analysisCommands.js.map