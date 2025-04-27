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
exports.transformAnalysisDataForWebview = transformAnalysisDataForWebview;
exports.showAnalysisWebView = showAnalysisWebView;
exports.sendAnalysisData = sendAnalysisData;
exports.showFunctionDetailView = showFunctionDetailView;
exports.registerAnalysisCommand = registerAnalysisCommand;
exports.registerAnalysis3DCommand = registerAnalysis3DCommand;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const lizardExecutor_1 = require("./lizardExecutor");
const utils_1 = require("./utils");
const analysisDataManager_1 = require("./analysisDataManager");
const pathUtils_1 = require("../pythonEnv/utils/pathUtils");
const processUtils_1 = require("../pythonEnv/utils/processUtils");
const xrAnalysisManager_1 = require("./xr/xrAnalysisManager");
const fileWatchManager_1 = require("./fileWatchManager");
// Output channel for analysis operations
let analysisOutputChannel;
/**
 * Gets or creates the analysis output channel
 */
function getOutputChannel() {
    if (!analysisOutputChannel) {
        analysisOutputChannel = vscode.window.createOutputChannel('CodeXR Analysis');
    }
    return analysisOutputChannel;
}
/**
 * Analyzes Python comments in a file
 * @param filePath Path to the Python file
 * @param outputChannel Output channel for logging
 * @returns Comment line count or 0 on error
 */
async function analyzePythonComments(filePath, outputChannel) {
    // Only analyze Python files
    if (!filePath.toLowerCase().endsWith('.py')) {
        return 0;
    }
    try {
        const pythonPath = (0, pathUtils_1.getPythonExecutable)((0, pathUtils_1.getVenvPath)() || '');
        const scriptPath = (0, utils_1.resolveAnalyzerScriptPath)('python_comment_analyzer.py', outputChannel);
        outputChannel.appendLine(`Analyzing Python comments...`);
        const output = await (0, processUtils_1.executeCommand)(pythonPath, [scriptPath, filePath], { showOutput: false });
        const result = JSON.parse(output);
        if (result.error) {
            outputChannel.appendLine(`Warning: ${result.error}`);
            return 0;
        }
        outputChannel.appendLine(`Found ${result.commentLines} comment lines`);
        return result.commentLines;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Error analyzing Python comments: ${errorMessage}`);
        return 0;
    }
}
/**
 * Analyzes class declarations in a file
 * @param filePath Path to the file
 * @param outputChannel Output channel for logging
 * @returns Class count or 0 on error
 */
async function analyzeClassCount(filePath, outputChannel) {
    try {
        const pythonPath = (0, pathUtils_1.getPythonExecutable)((0, pathUtils_1.getVenvPath)() || '');
        const scriptPath = (0, utils_1.resolveAnalyzerScriptPath)('class_counter_analyzer.py', outputChannel);
        outputChannel.appendLine(`Analyzing class declarations...`);
        const output = await (0, processUtils_1.executeCommand)(pythonPath, [scriptPath, filePath], { showOutput: false });
        const result = JSON.parse(output);
        if (result.error) {
            outputChannel.appendLine(`Warning: ${result.error}`);
            return 0;
        }
        outputChannel.appendLine(`Found ${result.classCount} class declarations`);
        return result.classCount;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Error analyzing class declarations: ${errorMessage}`);
        return 0;
    }
}
/**
 * Analyzes a single file
 * @param filePath Path to the file to analyze
 * @param context Extension context
 * @returns Analysis results or undefined on error
 */
async function analyzeFile(filePath, context) {
    const outputChannel = getOutputChannel();
    outputChannel.clear();
    outputChannel.show();
    outputChannel.appendLine(`Analyzing ${path.basename(filePath)}...`);
    try {
        // Basic file info
        const fileSize = await (0, utils_1.getFileSize)(filePath);
        const lineCount = await (0, utils_1.countFileLines)(filePath);
        const language = (0, utils_1.getLanguageName)(filePath);
        // Advanced analysis with lizard
        const lizardResults = await (0, lizardExecutor_1.analyzeLizard)(filePath, outputChannel);
        // Run additional analyzers
        const commentCount = await analyzePythonComments(filePath, outputChannel);
        const classCount = await analyzeClassCount(filePath, outputChannel);
        // Update line counts with the more accurate comment count for Python files
        if (filePath.toLowerCase().endsWith('.py') && commentCount > 0) {
            lineCount.comment = commentCount;
        }
        if (!lizardResults) {
            outputChannel.appendLine('Advanced analysis unavailable. Using basic analysis only.');
            // Prepare basic result
            const basicResult = {
                filePath,
                fileName: path.basename(filePath),
                language,
                fileSize,
                lineCount,
                classCount, // Use the analyzed class count
                complexity: {
                    averageComplexity: 0,
                    maxComplexity: 0,
                    functionCount: 0,
                    highComplexityFunctions: 0,
                    criticalComplexityFunctions: 0
                },
                functions: [],
                timestamp: Date.now()
            };
            // Log the final result as JSON
            outputChannel.appendLine('ANALYSIS RESULT (JSON):');
            outputChannel.appendLine(JSON.stringify(basicResult, null, 2));
            // Start watching this file for changes
            const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
            if (fileWatchManager) {
                fileWatchManager.setContext(context);
            }
            return basicResult;
        }
        // Complete result with lizard data and our additional analyzers
        const result = {
            filePath,
            fileName: path.basename(filePath),
            language,
            fileSize,
            lineCount,
            classCount, // Use the analyzed class count
            complexity: lizardResults.metrics,
            functions: lizardResults.functions,
            timestamp: Date.now()
        };
        // Log the final result as JSON
        outputChannel.appendLine('ANALYSIS RESULT (JSON):');
        outputChannel.appendLine(JSON.stringify(result, null, 2));
        // Store the result in the data manager
        analysisDataManager_1.analysisDataManager.setAnalysisResult(result);
        outputChannel.appendLine('Analysis complete!');
        // Start watching this file for changes
        const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
        if (fileWatchManager) {
            fileWatchManager.setContext(context);
        }
        return result;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Error analyzing file: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to analyze file: ${errorMessage}`);
        return undefined;
    }
}
/**
 * Transforms file analysis result into format needed by the webview
 * @param result The analysis result to transform
 * @returns Data formatted for webview consumption
 */
function transformAnalysisDataForWebview(result) {
    // Extract complexity distribution
    const complexityDistribution = {
        simple: result.functions.filter(f => f.complexity <= 5).length,
        moderate: result.functions.filter(f => f.complexity > 5 && f.complexity <= 10).length,
        complex: result.functions.filter(f => f.complexity > 10 && f.complexity <= 20).length,
        veryComplex: result.functions.filter(f => f.complexity > 20).length
    };
    // Find highest and lowest complexity functions
    const sortedByComplexity = [...result.functions].sort((a, b) => b.complexity - a.complexity);
    const highestComplexityFunction = sortedByComplexity.length > 0 ?
        { name: sortedByComplexity[0].name, value: sortedByComplexity[0].complexity } :
        { name: 'None', value: 0 };
    const lowestComplexityFunction = sortedByComplexity.length > 0 ?
        { name: sortedByComplexity[sortedByComplexity.length - 1].name, value: sortedByComplexity[sortedByComplexity.length - 1].complexity } :
        { name: 'None', value: 0 };
    // Format the data for the webview
    return {
        fileName: result.fileName,
        filePath: result.filePath,
        language: result.language,
        fileSize: (0, utils_1.formatFileSize)(result.fileSize),
        timestamp: new Date(result.timestamp).toLocaleString(),
        // Line counts
        totalLines: result.lineCount.total,
        codeLines: result.lineCount.code,
        commentLines: result.lineCount.comment,
        blankLines: result.lineCount.blank,
        // Function counts and complexity
        functionCount: result.functions.length,
        classCount: result.classCount,
        avgComplexity: result.complexity.averageComplexity.toFixed(1),
        maxComplexity: result.complexity.maxComplexity,
        highComplexityCount: result.complexity.highComplexityFunctions,
        // Complexity distribution for chart
        complexityDistribution,
        // Highest and lowest complexity functions
        highestComplexityFunction,
        lowestComplexityFunction,
        // Functions data
        functions: result.functions.map(func => ({
            name: func.name,
            lineStart: func.lineStart,
            lineEnd: func.lineEnd,
            lineCount: func.lineCount,
            parameters: func.parameters,
            complexity: func.complexity,
            maxNestingDepth: func.maxNestingDepth || 0
        }))
    };
}
/**
 * This function shows the analysis webview
 * @param context Extension context
 * @param result Analysis result to display
 */
function showAnalysisWebView(context, result) {
    // Check if we already have an active panel
    let panel = analysisDataManager_1.analysisDataManager.getActiveFileAnalysisPanel();
    if (!panel || panel.disposed) {
        // Create new panel if none exists or previous was disposed
        panel = vscode.window.createWebviewPanel('codexrAnalysis', `Analysis: ${result.fileName}`, vscode.ViewColumn.Two, {
            enableScripts: true,
            retainContextWhenHidden: true, // Keep the webview content when hidden
            localResourceRoots: [
                vscode.Uri.file(path.join(context.extensionPath, 'media')),
                vscode.Uri.file(path.join(context.extensionPath, 'templates'))
            ]
        });
        // Store the panel reference
        analysisDataManager_1.analysisDataManager.setActiveFileAnalysisPanel(panel);
        // Add disposal handler
        panel.onDidDispose(() => {
            // Clear the reference when panel is closed by user
            if (analysisDataManager_1.analysisDataManager.getActiveFileAnalysisPanel() === panel) {
                analysisDataManager_1.analysisDataManager.setActiveFileAnalysisPanel(null);
            }
        });
        // Rest of the setup code as before...
        const styleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'media', 'analysis', 'fileAnalysisstyle.css')));
        const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'media', 'analysis', 'fileAnalysismain.js')));
        // Generate a nonce for CSP
        const nonce = getNonce();
        try {
            // Read the HTML template
            const htmlPath = path.join(context.extensionPath, 'templates', 'analysis', 'fileAnalysis.html');
            let htmlContent = fs.readFileSync(htmlPath, 'utf8');
            // Replace placeholders in HTML template with actual values
            htmlContent = htmlContent
                .replace('${webview.cspSource}', panel.webview.cspSource)
                .replace(/\${nonce}/g, nonce) // Replace all instances of nonce
                .replace('${styleUri}', styleUri.toString())
                .replace('${scriptUri}', scriptUri.toString());
            // Set the webview content
            panel.webview.html = htmlContent;
            // Add the message handler only once when creating the panel
            setUpMessageHandlers(panel, context);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Error displaying analysis results: ${errorMessage}`);
            console.error('Error displaying analysis results:', error);
        }
    }
    else {
        // If we're reusing an existing panel, just reveal it
        panel.reveal(vscode.ViewColumn.Two);
    }
    // Always send the latest data - whether the panel is new or existing
    sendAnalysisData(panel, result);
}
// Extract the data sending logic to a separate function
function sendAnalysisData(panel, result) {
    setTimeout(() => {
        const transformedData = transformAnalysisDataForWebview(result);
        panel.webview.postMessage({
            command: 'setAnalysisData',
            data: transformedData
        });
    }, 500);
}
// Extract message handling logic to a separate function
function setUpMessageHandlers(panel, context) {
    panel.webview.onDidReceiveMessage((message) => {
        switch (message.command) {
            case 'openFile':
                if (message.data && message.data.path && message.data.line) {
                    const fileUri = vscode.Uri.file(message.data.path);
                    vscode.workspace.openTextDocument(fileUri).then(doc => {
                        vscode.window.showTextDocument(doc).then(editor => {
                            // Go to specific line
                            const line = Math.max(0, message.data.line - 1);
                            const position = new vscode.Position(line, 0);
                            editor.selection = new vscode.Selection(position, position);
                            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                        });
                    });
                }
                break;
            case 'showFunctionDetails':
                // Handle request to show function details
                if (message.data) {
                    showFunctionDetailView(context, message.data);
                }
                break;
        }
    }, undefined, context.subscriptions);
}
/**
 * Shows details about a specific function in a new WebView
 * @param context Extension context
 * @param data Function and file data
 */
function showFunctionDetailView(context, data) {
    // Create a unique identifier for this function to ensure it opens in a new tab
    const functionId = `${data.fileName}:${data.function.name}:${data.function.lineStart}`;
    // Always create a new panel for each function
    const panel = vscode.window.createWebviewPanel(`codexrFunctionAnalysis-${functionId}`, // Use unique ID in the panel type
    `Function: ${data.function.name}`, vscode.ViewColumn.Beside, // Open beside the current panel
    {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
            vscode.Uri.file(path.join(context.extensionPath, 'media')),
            vscode.Uri.file(path.join(context.extensionPath, 'templates'))
        ]
    });
    // We still track the most recently opened function panel
    analysisDataManager_1.analysisDataManager.setActiveFunctionAnalysisPanel(panel);
    analysisDataManager_1.analysisDataManager.setFunctionData(data);
    // Add disposal handler
    panel.onDidDispose(() => {
        // Clear the function data only if this is the active panel
        if (analysisDataManager_1.analysisDataManager.getActiveFunctionAnalysisPanel() === panel) {
            analysisDataManager_1.analysisDataManager.clearFunctionData();
        }
    });
    // Get the webview-friendly URI for resources
    const styleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'media', 'analysis', 'functionAnalysis.css')));
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'media', 'analysis', 'functionAnalysis.js')));
    // Generate a nonce for CSP
    const nonce = getNonce();
    try {
        // Read the HTML template
        const htmlPath = path.join(context.extensionPath, 'templates', 'analysis', 'functionAnalysis.html');
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');
        // Replace placeholders in HTML template with actual values
        htmlContent = htmlContent
            .replace('${webview.cspSource}', panel.webview.cspSource)
            .replace(/\${nonce}/g, nonce) // Replace all instances of nonce
            .replace('${styleUri}', styleUri.toString())
            .replace('${scriptUri}', scriptUri.toString());
        // Set the webview content
        panel.webview.html = htmlContent;
        // Set up message handlers
        setupFunctionViewMessageHandlers(panel, context);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Error displaying function details: ${errorMessage}`);
        console.error('Error displaying function details:', error);
    }
    // Send the data to the WebView
    sendFunctionData(panel, data);
}
/**
 * Sets up message handlers for function detail view
 */
function setupFunctionViewMessageHandlers(panel, context) {
    panel.webview.onDidReceiveMessage((message) => {
        switch (message.command) {
            case 'openFile':
                if (message.data && message.data.path && message.data.line) {
                    const fileUri = vscode.Uri.file(message.data.path);
                    vscode.workspace.openTextDocument(fileUri).then(doc => {
                        vscode.window.showTextDocument(doc).then(editor => {
                            // Go to specific line
                            const line = Math.max(0, message.data.line - 1);
                            const position = new vscode.Position(line, 0);
                            editor.selection = new vscode.Selection(position, position);
                            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                        });
                    });
                }
                break;
            case 'backToFileAnalysis':
                // Get the file analysis panel - if it exists, reveal it
                const analysisPanel = analysisDataManager_1.analysisDataManager.getActiveFileAnalysisPanel();
                const analysisResult = analysisDataManager_1.analysisDataManager.getAnalysisResult();
                if (analysisPanel && !analysisPanel.disposed && analysisResult) {
                    // Show the file analysis panel
                    analysisPanel.reveal(vscode.ViewColumn.Two);
                    // Re-send the data to ensure it's properly displayed
                    sendAnalysisData(analysisPanel, analysisResult);
                }
                // Close the function detail panel
                panel.dispose();
                break;
        }
    }, undefined, context.subscriptions);
}
/**
 * Sends function data to the WebView
 */
function sendFunctionData(panel, data) {
    setTimeout(() => {
        panel.webview.postMessage({
            command: 'setFunctionData',
            data: data
        });
    }, 500);
}
/**
 * Generate a nonce string for Content Security Policy
 */
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
/**
 * Registers the Static analysis command
 * @param context Extension context
 * @returns Disposable for the registered command
 */
function registerAnalysisCommand(context) {
    return vscode.commands.registerCommand('codexr.analyzeFile', async () => {
        // Get the active editor
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No file is currently open for analysis');
            return;
        }
        const filePath = editor.document.uri.fsPath;
        // Show progress notification
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Analyzing ${path.basename(filePath)}...`,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 30, message: "Running code analysis..." });
            const result = await analyzeFile(filePath, context);
            progress.report({ increment: 70, message: "Preparing visualization..." });
            if (result) {
                // Store the result in the data manager
                analysisDataManager_1.analysisDataManager.setAnalysisResult(result);
                // Show the visualization
                showAnalysisWebView(context, result);
            }
            return Promise.resolve();
        });
    });
}
/**
 * Registers the XR analysis command
 * @param context Extension context
 * @returns Disposable for the registered command
 */
function registerAnalysis3DCommand(context) {
    return vscode.commands.registerCommand('codexr.analyzeFile3D', async (fileUri) => {
        // Get the file path
        let filePath;
        if (typeof fileUri === 'string') {
            filePath = fileUri;
        }
        else if (fileUri instanceof vscode.Uri) {
            filePath = fileUri.fsPath;
        }
        else {
            // Get the active text editor
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No file is open to analyze in XR');
                return;
            }
            filePath = editor.document.uri.fsPath;
        }
        // Show progress notification
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Analyzing ${path.basename(filePath)} for XR visualization...`,
            cancellable: false
        }, async (progress) => {
            // First analyze the file with existing analysis
            progress.report({ increment: 30, message: "Running code analysis..." });
            const result = await analyzeFile(filePath, context);
            if (!result) {
                vscode.window.showErrorMessage(`Failed to analyze file: ${path.basename(filePath)}`);
                return;
            }
            // Create XR visualization
            progress.report({ increment: 40, message: "Creating XR visualization..." });
            const htmlFilePath = await (0, xrAnalysisManager_1.createXRVisualization)(context, result);
            if (!htmlFilePath) {
                vscode.window.showErrorMessage(`Failed to create XR visualization for: ${path.basename(filePath)}`);
                return;
            }
            // Open the visualization
            progress.report({ increment: 30, message: "Launching visualization..." });
            await (0, xrAnalysisManager_1.openXRVisualization)(htmlFilePath, context);
            return Promise.resolve();
        });
    });
}
//# sourceMappingURL=analysisManager.js.map