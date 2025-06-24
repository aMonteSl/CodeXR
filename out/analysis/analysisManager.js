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
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const utils_1 = require("./utils");
const analysisDataManager_1 = require("./analysisDataManager");
const fileWatchManager_1 = require("./fileWatchManager");
const lizardExecutor_1 = require("./lizardExecutor"); // ✅ ADDED: Import missing function
const pathUtils_1 = require("../pythonEnv/utils/pathUtils");
const processUtils_1 = require("../pythonEnv/utils/processUtils");
const nonceUtils_1 = require("../utils/nonceUtils");
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
 * Analyzes comments in a file using the appropriate analyzer
 * @param filePath Path to the file
 * @param outputChannel Output channel for logging
 * @returns Comment line count or 0 on error
 */
async function analyzeComments(filePath, outputChannel) {
    try {
        const ext = path.extname(filePath).toLowerCase();
        // ✅ AÑADIR SCALA A LA LISTA DE EXTENSIONES SOPORTADAS
        if (!ext || !['.py', '.js', '.ts', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.cs', '.java', '.rb', '.vue', '.m', '.mm', '.swift', '.ttcn3', '.ttcn', '.3mp', '.php', '.phtml', '.php3', '.php4', '.php5', '.phps', '.scala', '.sc', '.gd', '.go', '.lua', '.rs', '.f', '.f77', '.f90', '.f95', '.f03', '.f08', '.for', '.ftn', '.kt', '.kts', '.sol', '.erl', '.hrl', '.zig', '.pl', '.pm', '.pod', '.t'].includes(ext)) {
            outputChannel.appendLine(`Skipping comment analysis for unsupported file type: ${ext}`);
            return 0;
        }
        outputChannel.appendLine(`[DEBUG] Starting comment analysis for ${filePath} with extension ${ext}`);
        // ✅ VERIFICAR QUE EXISTE VENV Y PYTHON
        const venvPath = (0, pathUtils_1.getVenvPath)();
        if (!venvPath) {
            outputChannel.appendLine('[ERROR] No virtual environment found');
            return 0;
        }
        const pythonPath = (0, pathUtils_1.getPythonExecutable)(venvPath);
        outputChannel.appendLine(`[DEBUG] Using Python executable: ${pythonPath}`);
        const scriptPath = (0, utils_1.resolveAnalyzerScriptPath)('python_comment_analyzer.py', outputChannel);
        outputChannel.appendLine(`[DEBUG] Using analyzer script: ${scriptPath}`);
        // Log file content preview for debugging
        try {
            const fileContent = await fs.promises.readFile(filePath, 'utf8');
            const preview = fileContent.split('\n').slice(0, 3).join('\n');
            outputChannel.appendLine(`[DEBUG] File preview (first 3 lines): ${preview}`);
        }
        catch (e) {
            outputChannel.appendLine(`[DEBUG] Could not read file for preview: ${e}`);
        }
        // Execute the Python analyzer
        const output = await (0, processUtils_1.executeCommand)(pythonPath, [scriptPath, filePath], { showOutput: false });
        outputChannel.appendLine(`[DEBUG] Raw output from Python script: ${output}`);
        let result;
        try {
            result = JSON.parse(output);
            outputChannel.appendLine(`[DEBUG] Parsed result: ${JSON.stringify(result)}`);
        }
        catch (jsonError) {
            outputChannel.appendLine(`[ERROR] Failed to parse JSON output: ${jsonError}`);
            outputChannel.appendLine(`[ERROR] Raw output: ${output}`);
            return 0;
        }
        if (result.error) {
            outputChannel.appendLine(`Warning: ${result.error}`);
            return 0;
        }
        outputChannel.appendLine(`Found ${result.commentLines} comment lines in ${path.basename(filePath)} (${ext})`);
        return result.commentLines;
    }
    catch (error) {
        outputChannel.appendLine(`[ERROR] Error analyzing comments: ${error instanceof Error ? error.message : String(error)}`);
        outputChannel.appendLine(`[ERROR] Stack trace: ${error instanceof Error ? error.stack : 'No stack trace available'}`);
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
        const ext = path.extname(filePath).toLowerCase();
        // ✅ AÑADIR SCALA A LA LISTA DE EXTENSIONES SOPORTADAS
        if (!ext || !['.py', '.js', '.ts', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.cs', '.java', '.rb', '.vue', '.m', '.mm', '.swift', '.ttcn3', '.ttcn', '.3mp', '.php', '.phtml', '.php3', '.php4', '.php5', '.phps', '.scala', '.sc', '.gd', '.go', '.lua', '.rs', '.f', '.f77', '.f90', '.f95', '.f03', '.f08', '.for', '.ftn', '.kt', '.kts', '.sol', '.erl', '.hrl', '.zig', '.pl', '.pm', '.pod', '.t'].includes(ext)) {
            outputChannel.appendLine(`Skipping class analysis for unsupported file type: ${ext}`);
            return 0;
        }
        outputChannel.appendLine(`[DEBUG] Starting class analysis for ${filePath} with extension ${ext}`);
        // ✅ VERIFICAR QUE EXISTE VENV Y PYTHON
        const venvPath = (0, pathUtils_1.getVenvPath)();
        if (!venvPath) {
            outputChannel.appendLine('[ERROR] No virtual environment found');
            return 0;
        }
        const pythonPath = (0, pathUtils_1.getPythonExecutable)(venvPath);
        const scriptPath = (0, utils_1.resolveAnalyzerScriptPath)('class_counter_analyzer.py', outputChannel);
        // Execute the Python analyzer
        const output = await (0, processUtils_1.executeCommand)(pythonPath, [scriptPath, filePath], { showOutput: false });
        let result;
        try {
            result = JSON.parse(output);
        }
        catch (jsonError) {
            outputChannel.appendLine(`[ERROR] Failed to parse JSON output from class analyzer: ${jsonError}`);
            outputChannel.appendLine(`[ERROR] Raw output: ${output}`);
            return 0;
        }
        if (result.error) {
            outputChannel.appendLine(`Warning: ${result.error}`);
            return 0;
        }
        outputChannel.appendLine(`Found ${result.classCount} classes/interfaces/types`);
        return result.classCount;
    }
    catch (error) {
        outputChannel.appendLine(`[ERROR] Error analyzing classes: ${error instanceof Error ? error.message : String(error)}`);
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
    outputChannel.appendLine(`🔍 Starting analysis of ${path.basename(filePath)}...`);
    // ✅ MARK FILE AS BEING ANALYZED (if not already marked)
    if (!analysisDataManager_1.analysisDataManager.isFileBeingAnalyzed(filePath)) {
        analysisDataManager_1.analysisDataManager.setFileAnalyzing(filePath);
    }
    try {
        console.log(`📊 Analyzing file: ${filePath}`);
        // ✅ BASIC FILE VALIDATION
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        // Get basic file information
        const fileStats = fs.statSync(filePath);
        const fileName = path.basename(filePath);
        const language = (0, utils_1.getLanguageName)(filePath);
        const fileSize = (0, utils_1.formatFileSize)(fileStats.size);
        outputChannel.appendLine(`📄 File: ${fileName}`);
        outputChannel.appendLine(`🏷️ Language: ${language}`);
        outputChannel.appendLine(`📦 Size: ${fileSize}`);
        // Count basic file metrics
        const lineInfo = await (0, utils_1.countFileLines)(filePath);
        outputChannel.appendLine(`📏 Lines: ${lineInfo.total} (Code: ${lineInfo.code}, Comments: ${lineInfo.comment}, Blank: ${lineInfo.blank})`); // ✅ FIXED: Use .comment
        // Initialize function analysis
        let functions = [];
        let complexity = {
            averageComplexity: 0,
            maxComplexity: 0,
            functionCount: 0,
            highComplexityFunctions: 0,
            criticalComplexityFunctions: 0
        };
        // ✅ TRY LIZARD ANALYSIS (with better error handling)
        const venvPath = (0, pathUtils_1.getVenvPath)();
        if (venvPath && fs.existsSync(venvPath)) {
            try {
                outputChannel.appendLine('🐍 Python environment found, running Lizard analysis...');
                const lizardResult = await (0, lizardExecutor_1.analyzeLizard)(filePath, outputChannel);
                if (lizardResult && lizardResult.functions.length > 0) {
                    functions = lizardResult.functions;
                    complexity = lizardResult.metrics;
                    outputChannel.appendLine(`✅ Lizard analysis completed: ${functions.length} functions found`);
                }
                else {
                    outputChannel.appendLine('⚠️ Lizard analysis returned no functions');
                }
            }
            catch (error) {
                outputChannel.appendLine(`⚠️ Lizard analysis failed: ${error instanceof Error ? error.message : String(error)}`);
                outputChannel.appendLine('📊 Continuing with basic analysis...');
                // Fallback to basic analysis without Lizard
                functions = [];
                complexity = {
                    averageComplexity: 0,
                    maxComplexity: 0,
                    functionCount: 0,
                    highComplexityFunctions: 0,
                    criticalComplexityFunctions: 0
                };
            }
        }
        else {
            outputChannel.appendLine('⚠️ No Python virtual environment found. Skipping Lizard analysis...');
        }
        // ✅ ANALYZE COMMENTS (with better error handling)
        let commentLines = 0;
        try {
            commentLines = await analyzeComments(filePath, outputChannel);
            outputChannel.appendLine(`💬 Comments: ${commentLines} lines`);
        }
        catch (error) {
            outputChannel.appendLine(`⚠️ Comment analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        // ✅ ANALYZE CLASSES (with better error handling)
        let classCount = 0;
        try {
            classCount = await analyzeClassCount(filePath, outputChannel);
            outputChannel.appendLine(`🏛️ Classes: ${classCount}`);
        }
        catch (error) {
            outputChannel.appendLine(`⚠️ Class analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        // ✅ BUILD FINAL RESULT
        const result = {
            fileName,
            filePath,
            language,
            fileSize, // ✅ FIXED: Already a string from formatFileSize
            totalLines: lineInfo.total,
            codeLines: lineInfo.code,
            commentLines: Math.max(commentLines, lineInfo.comment), // ✅ FIXED: Use .comment
            blankLines: lineInfo.blank,
            functions,
            functionCount: functions.length,
            classCount,
            complexity,
            timestamp: new Date().toLocaleString() // ✅ FIXED: Return string not number
        };
        outputChannel.appendLine(`✅ Analysis completed successfully for ${fileName}`);
        console.log(`✅ Analysis completed for ${filePath}:`, {
            functions: result.functionCount, // ✅ FIXED: Use functionCount
            complexity: result.complexity.averageComplexity,
            lines: result.totalLines // ✅ FIXED: Use totalLines
        });
        // ✅ MARK ANALYSIS AS COMPLETED
        analysisDataManager_1.analysisDataManager.setFileAnalyzed(filePath);
        return result;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`❌ Analysis failed: ${errorMessage}`);
        console.error('❌ Analysis error:', error);
        // ✅ MARK ANALYSIS AS COMPLETED (even if failed)
        analysisDataManager_1.analysisDataManager.setFileAnalyzed(filePath);
        // ✅ SHOW USER-FRIENDLY ERROR MESSAGE
        vscode.window.showErrorMessage(`Failed to analyze ${path.basename(filePath)}: ${errorMessage}`);
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
    const highestComplexityFunction = sortedByComplexity.length > 0 ? {
        name: sortedByComplexity[0].name,
        value: sortedByComplexity[0].complexity
    } : { name: 'None', value: 0 };
    const lowestComplexityFunction = sortedByComplexity.length > 0 ? {
        name: sortedByComplexity[sortedByComplexity.length - 1].name,
        value: sortedByComplexity[sortedByComplexity.length - 1].complexity
    } : { name: 'None', value: 0 };
    // Return formatted data for the webview
    return {
        fileName: result.fileName,
        language: result.language,
        // ✅ FIXED: Use result.fileSize directly (it's already a string)
        fileSize: result.fileSize,
        timestamp: result.timestamp,
        // ✅ FIXED: Use correct property names from FileAnalysisResult
        totalLines: result.totalLines,
        codeLines: result.codeLines,
        commentLines: result.commentLines,
        blankLines: result.blankLines,
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
    // Get active panel from data manager with proper file path parameter
    let panel = analysisDataManager_1.analysisDataManager.getActiveFileAnalysisPanel(result.filePath);
    // Before creating the panel - check if we already have one
    const existingPanel = analysisDataManager_1.analysisDataManager.getActiveFileAnalysisPanel(result.filePath);
    if (existingPanel && !existingPanel.disposed) {
        console.log(`📄 Reusing existing panel for ${result.fileName}`);
        sendAnalysisData(existingPanel, result);
        existingPanel.reveal(vscode.ViewColumn.Beside);
        return;
    }
    else {
        console.log(`📄 Creating new analysis panel for ${result.fileName}`);
        // Create new panel with specific title
        panel = vscode.window.createWebviewPanel('codeAnalysis', `Analysis: ${result.fileName}`, vscode.ViewColumn.Beside, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media', 'analysis'))],
            retainContextWhenHidden: true
        });
        // Store panel reference
        analysisDataManager_1.analysisDataManager.setActiveFileAnalysisPanel(result.filePath, panel);
    }
    // ✅ NUEVA FUNCIONALIDAD: Detectar cierre del panel y limpiar watcher
    panel.onDidDispose(() => {
        console.log(`🗑️ Analysis panel for ${result.fileName} was closed manually`);
        // Limpiar referencia del panel
        analysisDataManager_1.analysisDataManager.setActiveFileAnalysisPanel(result.filePath, null);
        // ✅ PARAR EL FILE WATCHER PARA ESTE ARCHIVO
        const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
        if (fileWatchManager) {
            console.log(`🛑 Stopping file watcher for ${result.filePath} due to panel closure`);
            fileWatchManager.stopWatching(result.filePath);
            // Mostrar mensaje informativo opcional
            vscode.window.showInformationMessage(`Analysis panel for ${result.fileName} closed. Auto-analysis disabled for this file.`, 'OK');
        }
        // ✅ LIMPIAR DATOS DE ANÁLISIS
        analysisDataManager_1.analysisDataManager.removeFile(result.filePath);
        console.log(`✅ Cleaned up all resources for ${result.fileName}`);
    });
    // Rest of panel setup...
    const styleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'media', 'analysis', 'fileAnalysisstyle.css')));
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'media', 'analysis', 'fileAnalysismain.js')));
    // Generate a nonce for CSP
    const nonce = (0, nonceUtils_1.generateNonce)();
    try {
        const templatePath = path.join(context.extensionPath, 'templates', 'analysis', 'fileAnalysis.html');
        let htmlContent = fs.readFileSync(templatePath, 'utf8');
        // Replace placeholders in the template
        htmlContent = htmlContent
            .replace(/\${webview\.cspSource}/g, panel.webview.cspSource)
            .replace(/\${nonce}/g, nonce)
            .replace(/\${styleUri}/g, styleUri.toString())
            .replace(/\${scriptUri}/g, scriptUri.toString());
        panel.webview.html = htmlContent;
        console.log(`📊 Panel content set for ${result.fileName}`);
    }
    catch (error) {
        console.error('Error reading template file:', error);
        panel.webview.html = `<html><body><h1>Error loading analysis template</h1><p>${error}</p></body></html>`;
    }
    // Setup message handlers
    setUpMessageHandlers(panel, context);
    // Send data with both parameters
    sendAnalysisData(panel, result);
}
// Extract the data sending logic to a separate function
function sendAnalysisData(panel, result) {
    console.log(`📤 Sending updated analysis data for ${result.fileName}`);
    setTimeout(() => {
        const transformedData = transformAnalysisDataForWebview(result);
        // ✅ ADD TIMESTAMP TO SHOW IT'S UPDATED
        transformedData.lastUpdated = new Date().toLocaleTimeString();
        panel.webview.postMessage({
            command: 'setAnalysisData',
            data: transformedData
        });
        console.log(`✅ Analysis data sent to webview for ${result.fileName}`);
    }, 500);
}
// Extract message handling logic to a separate function
function setUpMessageHandlers(panel, context) {
    panel.webview.onDidReceiveMessage((message) => {
        console.log('📨 Received message from webview:', message);
        switch (message.command) {
            case 'showFunctionDetails':
                console.log('🔍 Opening function detail view for:', message.data?.function?.name);
                showFunctionDetailView(context, message.data);
                break;
            case 'openInEditor':
                // Open file at specific line
                if (message.data && message.data.filePath && message.data.lineNumber) {
                    const uri = vscode.Uri.file(message.data.filePath);
                    vscode.window.showTextDocument(uri, {
                        selection: new vscode.Range(message.data.lineNumber - 1, 0, message.data.lineNumber - 1, 0)
                    });
                }
                break;
            case 'goToLine':
                // Navigate to specific line in editor
                if (message.data && message.data.filePath && message.data.lineNumber) {
                    const uri = vscode.Uri.file(message.data.filePath);
                    vscode.window.showTextDocument(uri).then(editor => {
                        const position = new vscode.Position(message.data.lineNumber - 1, 0);
                        editor.selection = new vscode.Selection(position, position);
                        editor.revealRange(new vscode.Range(position, position));
                    });
                }
                break;
            default:
                console.log('Unknown command:', message.command);
        }
    }, undefined, context.subscriptions);
}
/**
 * Shows details about a specific function in a new WebView
 * @param context Extension context
 * @param data Function and file data
 */
function showFunctionDetailView(context, data) {
    console.log('🔍 Creating function detail view for:', data.function.name);
    // Create a unique panel ID based on function and file
    const panelId = `function-${data.fileName}-${data.function.name}`;
    // Check if we already have a panel for this function
    let existingPanel = analysisDataManager_1.analysisDataManager.getActiveFunctionAnalysisPanel(data.filePath);
    if (existingPanel && !existingPanel.disposed) {
        console.log('📋 Reusing existing function panel');
        existingPanel.reveal(vscode.ViewColumn.Two);
        sendFunctionData(existingPanel, data);
        return;
    }
    // Create new webview panel
    const panel = vscode.window.createWebviewPanel('functionAnalysis', `Function: ${data.function.name}`, vscode.ViewColumn.Two, {
        enableScripts: true,
        localResourceRoots: [context.extensionUri],
        retainContextWhenHidden: true
    });
    // Store reference to this panel
    analysisDataManager_1.analysisDataManager.setActiveFunctionAnalysisPanel(data.filePath, panel);
    // Set up the webview content
    const styleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'media', 'analysis', 'functionAnalysisstyle.css')));
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'media', 'analysis', 'functionAnalysismain.js')));
    // Generate nonce for CSP
    const nonce = (0, nonceUtils_1.generateNonce)();
    // Load the function analysis template
    try {
        const templatePath = path.join(context.extensionPath, 'templates', 'analysis', 'functionAnalysis.html');
        let template = fs.readFileSync(templatePath, 'utf8');
        // Replace placeholders
        template = template
            .replace(/\${webview\.cspSource}/g, panel.webview.cspSource)
            .replace(/\${styleUri}/g, styleUri.toString())
            .replace(/\${scriptUri}/g, scriptUri.toString())
            .replace(/\${nonce}/g, nonce);
        panel.webview.html = template;
        console.log('✅ Function panel HTML set successfully');
    }
    catch (error) {
        console.error('❌ Error loading function analysis template:', error);
        panel.webview.html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}';">
        </head>
        <body>
          <h1>Error</h1>
          <p>Could not load function analysis template: ${error}</p>
        </body>
      </html>
    `;
    }
    // Set up message handlers for function panel
    setupFunctionViewMessageHandlers(panel, context);
    // Handle panel disposal
    panel.onDidDispose(() => {
        analysisDataManager_1.analysisDataManager.setActiveFunctionAnalysisPanel(data.filePath, null);
        console.log('🗑️ Function panel disposed');
    });
    // Send function data to webview
    sendFunctionData(panel, data);
}
/**
 * Sets up message handlers for function detail view
 */
function setupFunctionViewMessageHandlers(panel, context) {
    panel.webview.onDidReceiveMessage((message) => {
        console.log('📨 Function panel message:', message);
        switch (message.command) {
            case 'openInEditor':
                // Open file at specific line
                if (message.data && message.data.filePath && message.data.lineNumber) {
                    const uri = vscode.Uri.file(message.data.filePath);
                    vscode.window.showTextDocument(uri, {
                        selection: new vscode.Range(message.data.lineNumber - 1, 0, message.data.lineNumber - 1, 0)
                    });
                }
                break;
            case 'goToLine':
                // Navigate to specific line in editor
                if (message.data && message.data.filePath && message.data.lineNumber) {
                    const uri = vscode.Uri.file(message.data.filePath);
                    vscode.window.showTextDocument(uri).then(editor => {
                        const position = new vscode.Position(message.data.lineNumber - 1, 0);
                        editor.selection = new vscode.Selection(position, position);
                        editor.revealRange(new vscode.Range(position, position));
                    });
                }
                break;
            case 'backToFileAnalysis':
                // Return to file analysis view
                if (message.data && message.data.filePath) {
                    const filePanel = analysisDataManager_1.analysisDataManager.getActiveFileAnalysisPanel(message.data.filePath);
                    if (filePanel && !filePanel.disposed) {
                        filePanel.reveal(vscode.ViewColumn.One);
                    }
                }
                break;
            default:
                console.log('Unknown function panel command:', message.command);
        }
    }, undefined, context.subscriptions);
}
/**
 * Sends function data to the WebView
 */
function sendFunctionData(panel, data) {
    console.log('📤 Sending function data to webview:', data.function.name);
    // Prepare function data for webview
    const functionData = {
        function: data.function,
        filePath: data.filePath,
        fileName: data.fileName,
        language: data.language,
        // Calculate additional metrics
        complexityCategory: getComplexityCategory(data.function.complexity),
        recommendations: getComplexityRecommendations(data.function.complexity)
    };
    // Send data to webview with a delay to ensure it's ready
    setTimeout(() => {
        panel.webview.postMessage({
            command: 'setFunctionData',
            data: functionData
        });
        console.log('✅ Function data sent to webview');
    }, 500);
}
/**
 * Helper function to determine complexity category
 */
function getComplexityCategory(complexity) {
    if (complexity <= 5)
        return 'Simple';
    if (complexity <= 10)
        return 'Moderate';
    if (complexity <= 20)
        return 'Complex';
    return 'Very Complex';
}
/**
 * Helper function to get complexity recommendations
 */
function getComplexityRecommendations(complexity) {
    const recommendations = [];
    if (complexity <= 5) {
        recommendations.push('This function has low complexity and is easy to understand and maintain.');
    }
    else if (complexity <= 10) {
        recommendations.push('This function has moderate complexity. Consider if it can be simplified.');
    }
    else if (complexity <= 20) {
        recommendations.push('This function is complex. Consider breaking it into smaller functions.');
        recommendations.push('Look for opportunities to reduce nesting and conditional logic.');
    }
    else {
        recommendations.push('This function is very complex and should be refactored.');
        recommendations.push('Break it down into multiple smaller, focused functions.');
        recommendations.push('Consider using design patterns to reduce complexity.');
        recommendations.push('Add comprehensive unit tests before refactoring.');
    }
    return recommendations;
}
//# sourceMappingURL=analysisManager.js.map