import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileAnalysisResult, WebviewMessage } from './model';
import { analyzeLizard } from './lizardExecutor';
import { countFileLines, getFileSize, getLanguageName, formatFileSize, classifyComplexity, resolveAnalyzerScriptPath } from './utils';
import { analysisDataManager } from './analysisDataManager';
import { getPythonExecutable, getVenvPath } from '../pythonEnv/utils/pathUtils';
import { executeCommand } from '../pythonEnv/utils/processUtils';
import { createXRVisualization } from './xr/xrAnalysisManager'; // ✅ ELIMINAR openXRVisualization
import { FileWatchManager } from './fileWatchManager';

// Output channel for analysis operations
let analysisOutputChannel: vscode.OutputChannel;

/**
 * Gets or creates the analysis output channel
 */
function getOutputChannel(): vscode.OutputChannel {
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
async function analyzeComments(
  filePath: string,
  outputChannel: vscode.OutputChannel
): Promise<number> {
  try {
    // Get the file extension
    const ext = path.extname(filePath).toLowerCase();
    
    // List of supported extensions for our comment analyzer
    const supportedExtensions = [
      '.py', '.js', '.ts', '.jsx', '.tsx',
      '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp',
      '.cs', '.vue', '.rb'
    ];
    
    // Check if we support this file type
    if (!supportedExtensions.includes(ext)) {
      outputChannel.appendLine(`Skipping comment analysis for unsupported file type: ${ext}`);
      return 0;
    }
    
    outputChannel.appendLine(`[DEBUG] Starting comment analysis for ${filePath} with extension ${ext}`);
    
    const pythonPath = getPythonExecutable(getVenvPath() || '');
    outputChannel.appendLine(`[DEBUG] Using Python executable: ${pythonPath}`);
    
    const scriptPath = resolveAnalyzerScriptPath('python_comment_analyzer.py', outputChannel);
    outputChannel.appendLine(`[DEBUG] Using analyzer script: ${scriptPath}`);

    // Log file content preview for debugging
    try {
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      const previewLines = fileContent.split('\n').slice(0, 10).join('\n');
      outputChannel.appendLine(`[DEBUG] File content preview (first 10 lines):\n${previewLines}\n...`);
    } catch (err) {
      outputChannel.appendLine(`[DEBUG] Could not read file for preview: ${err}`);
    }

    outputChannel.appendLine(`[DEBUG] Executing: ${pythonPath} ${scriptPath} ${filePath}`);
    outputChannel.appendLine(`Analyzing comments in ${path.basename(filePath)}...`);
    
    const output = await executeCommand(
      pythonPath,
      [scriptPath, filePath],
      { showOutput: false }
    );
    
    outputChannel.appendLine(`[DEBUG] Raw output from Python script: ${output}`);

    let result;
    try {
      result = JSON.parse(output);
      outputChannel.appendLine(`[DEBUG] Parsed result: ${JSON.stringify(result)}`);
    } catch (jsonError) {
      outputChannel.appendLine(`[ERROR] Failed to parse JSON output: ${jsonError}`);
      outputChannel.appendLine(`[ERROR] Raw output: ${output}`);
      return 0;
    }
    
    if (result.error) {
      outputChannel.appendLine(`Warning: ${result.error}`);
      return 0;
    }

    outputChannel.appendLine(`Found ${result.commentLines} comment lines in ${path.basename(filePath)} (${ext})`);
    
    if (result.commentLines === 0 && (ext === '.cpp' || ext === '.cs' || ext === '.vue' || ext === '.rb')) {
      outputChannel.appendLine(`[DEBUG] Warning: Zero comments found for ${ext} file. This may indicate an issue with comment detection.`);
    }
    
    return result.commentLines;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`[ERROR] Error analyzing comments: ${errorMessage}`);
    if (error instanceof Error && error.stack) {
      outputChannel.appendLine(`[ERROR] Stack trace: ${error.stack}`);
    }
    return 0;
  }
}

/**
 * Analyzes class declarations in a file
 * @param filePath Path to the file
 * @param outputChannel Output channel for logging
 * @returns Class count or 0 on error
 */
async function analyzeClassCount(
  filePath: string,
  outputChannel: vscode.OutputChannel
): Promise<number> {
  try {
    const pythonPath = getPythonExecutable(getVenvPath() || '');
    
    const scriptPath = resolveAnalyzerScriptPath('class_counter_analyzer.py', outputChannel);

    outputChannel.appendLine(`Analyzing class declarations...`);
    const output = await executeCommand(
      pythonPath,
      [scriptPath, filePath],
      { showOutput: false }
    );

    const result = JSON.parse(output);
    if (result.error) {
      outputChannel.appendLine(`Warning: ${result.error}`);
      return 0;
    }

    outputChannel.appendLine(`Found ${result.classCount} class declarations`);
    return result.classCount;
  } catch (error) {
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
export async function analyzeFile(filePath: string, context: vscode.ExtensionContext): Promise<FileAnalysisResult | undefined> {
  const outputChannel = getOutputChannel();
  outputChannel.clear();
  outputChannel.show();
  outputChannel.appendLine(`Analyzing ${path.basename(filePath)}...`);
  
  try {
    // Basic file info
    const fileSize = await getFileSize(filePath);
    const lineCount = await countFileLines(filePath);
    const language = getLanguageName(filePath);
    
    // Advanced analysis with lizard
    const lizardResults = await analyzeLizard(filePath, outputChannel);
    
    // Run additional analyzers
    const commentCount = await analyzeComments(filePath, outputChannel);
    const classCount = await analyzeClassCount(filePath, outputChannel);
    
    // Update line counts with the accurate comment count from specific analyzer
    if (commentCount > 0) {
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
      const fileWatchManager = FileWatchManager.getInstance();
      if (fileWatchManager) {
        fileWatchManager.setContext(context);
      }

      return basicResult;
    }
    
    // Complete result with lizard data and our additional analyzers
    const result: FileAnalysisResult = {
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
    analysisDataManager.setAnalysisResult(filePath, result);
    
    outputChannel.appendLine('Analysis complete!');
    
    // Start watching this file for changes
    const fileWatchManager = FileWatchManager.getInstance();
    if (fileWatchManager) {
      fileWatchManager.setContext(context);
    }

    return result;
  } catch (error) {
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
export function transformAnalysisDataForWebview(result: FileAnalysisResult): any {
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
    fileSize: formatFileSize(result.fileSize),
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
export function showAnalysisWebView(context: vscode.ExtensionContext, result: FileAnalysisResult): void {
  // Get active panel from data manager with proper file path parameter
  let panel = analysisDataManager.getActiveFileAnalysisPanel(result.filePath);
  
  // Before creating the panel - check if we already have one
  const existingPanel = analysisDataManager.getActiveFileAnalysisPanel(result.filePath);
  if (existingPanel && !existingPanel.disposed) {
    // Re-use the existing panel
    panel = existingPanel;
    panel.reveal();
  } else {
    // Create a new panel
    panel = vscode.window.createWebviewPanel(
      'codeAnalysis', 
      `Analysis: ${result.fileName}`,
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
      }
    );
    
    // Store the panel in the manager with both required parameters
    analysisDataManager.setActiveFileAnalysisPanel(result.filePath, panel);
    analysisDataManager.setAnalysisResult(result.filePath, result);
  }

  // Add a handler for panel disposal
  panel.onDidDispose(() => {
    analysisDataManager.setActiveFileAnalysisPanel(result.filePath, null);
  });
  
  // Rest of panel setup...
  const styleUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, 'media', 'analysis', 'fileAnalysisstyle.css'))
  );
  
  const scriptUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, 'media', 'analysis', 'fileAnalysismain.js'))
  );
  
  // Generate a nonce for CSP
  const nonce = getNonce();
  
  try {
    // Read the HTML template
    const htmlPath = path.join(context.extensionPath, 'templates', 'analysis', 'fileAnalysis.html');
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    // Replace placeholders in HTML template with actual values
    htmlContent = htmlContent
      .replace('${webview.cspSource}', panel.webview.cspSource)
      .replace(/\${nonce}/g, nonce)  // Replace all instances of nonce
      .replace('${styleUri}', styleUri.toString())
      .replace('${scriptUri}', scriptUri.toString());
    
    // Set the webview content
    panel.webview.html = htmlContent;

    // Add the message handler only once when creating the panel
    setUpMessageHandlers(panel, context);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error displaying analysis results: ${errorMessage}`);
    console.error('Error displaying analysis results:', error);
  }

  // Send data with both parameters
  sendAnalysisData(panel, result);
}

// Extract the data sending logic to a separate function
export function sendAnalysisData(panel: vscode.WebviewPanel, result: FileAnalysisResult): void {
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
function setUpMessageHandlers(panel: vscode.WebviewPanel, context: vscode.ExtensionContext): void {
  panel.webview.onDidReceiveMessage(
    (message: WebviewMessage) => {
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
                editor.revealRange(
                  new vscode.Range(position, position),
                  vscode.TextEditorRevealType.InCenter
                );
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
    },
    undefined,
    context.subscriptions
  );
}

/**
 * Shows details about a specific function in a new WebView
 * @param context Extension context
 * @param data Function and file data
 */
export function showFunctionDetailView(
  context: vscode.ExtensionContext,
  data: {function: any, filePath: string, fileName: string, language: string}
): void {
  // Create a unique identifier for this function to ensure it opens in a new tab
  const functionId = `${data.fileName}:${data.function.name}:${data.function.lineStart}`;
  
  // Always create a new panel for each function
  const panel = vscode.window.createWebviewPanel(
    `codexrFunctionAnalysis-${functionId}`,  // Use unique ID in the panel type
    `Function: ${data.function.name}`,
    vscode.ViewColumn.Beside,  // Open beside the current panel
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, 'media')),
        vscode.Uri.file(path.join(context.extensionPath, 'templates'))
      ]
    }
  );
  
  // We still track the most recently opened function panel
  analysisDataManager.setActiveFunctionAnalysisPanel(data.filePath, panel);
  analysisDataManager.setFunctionData(data.filePath, data);
  
  // Add disposal handler
  panel.onDidDispose(() => {
    // Extract the file path from the stored data
    const filePath = data.filePath;
    
    // Clear the function data only if this is the active panel
    if (analysisDataManager.getActiveFunctionAnalysisPanel(filePath) === panel) {
      analysisDataManager.clearFunctionData(filePath);
    }
  });
  
  // Rest of the function remains unchanged...
}

/**
 * Sets up message handlers for function detail view
 */
function setupFunctionViewMessageHandlers(panel: vscode.WebviewPanel, context: vscode.ExtensionContext): void {
  panel.webview.onDidReceiveMessage(
    (message: WebviewMessage) => {
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
                editor.revealRange(
                  new vscode.Range(position, position),
                  vscode.TextEditorRevealType.InCenter
                );
              });
            });
          }
          break;
        case 'backToFileAnalysis':
          // Get file path from panel data
          const filePath = panel.title.split(":")[1]?.trim() || "unknown";
          
          // Fixed: Now passing filePath parameter to both functions
          const analysisPanel = analysisDataManager.getActiveFileAnalysisPanel(filePath);
          const analysisResult = analysisDataManager.getAnalysisResult(filePath);
          
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
    },
    undefined,
    context.subscriptions
  );
}

/**
 * Sends function data to the WebView
 */
function sendFunctionData(panel: vscode.WebviewPanel, data: any): void {
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
function getNonce(): string {
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
export function registerAnalysisCommand(context: vscode.ExtensionContext): vscode.Disposable {
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
        // Store the result in the manager
        analysisDataManager.setAnalysisResult(filePath, result);
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
export function registerAnalysis3DCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.analyzeFile3D', async (fileUri) => {
    // Get the file path
    let filePath: string | undefined;
    
    if (typeof fileUri === 'string') {
      filePath = fileUri;
    } else if (fileUri instanceof vscode.Uri) {
      filePath = fileUri.fsPath;
    } else {
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
      const htmlFilePath = await createXRVisualization(context, result);
      
      if (!htmlFilePath) {
        vscode.window.showErrorMessage(`Failed to create XR visualization for: ${path.basename(filePath)}`);
        return;
      }
      
      // ✅ NO LLAMAR openXRVisualization - createXRVisualization ya abre el navegador
      progress.report({ increment: 30, message: "Visualization opened in browser..." });
      console.log('✅ XR visualization created and opened successfully');
      
      return Promise.resolve();
    });
  });
}