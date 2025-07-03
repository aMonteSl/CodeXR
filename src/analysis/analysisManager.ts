import * as vscode from 'vscode';
import { FileAnalysisResult, WebviewMessage } from './model';
import { analyzeFileStatic } from './static';
import { createXRVisualization } from './xr';
import { parseHTMLFile, getDOMVisualizationFolder } from './html';
import { analysisDataManager } from './utils/dataManager';
import { FileWatchManager } from './watchers';
import { generateNonce } from '../utils/nonceUtils';

/**
 * Main analysis manager that orchestrates all analysis operations
 * This is the primary entry point for the analysis system
 */

// Output channel for general analysis operations
let analysisOutputChannel: vscode.OutputChannel;

/**
 * Gets or creates the main analysis output channel
 */
function getOutputChannel(): vscode.OutputChannel {
  if (!analysisOutputChannel) {
    analysisOutputChannel = vscode.window.createOutputChannel('CodeXR Analysis');
  }
  return analysisOutputChannel;
}

/**
 * Analyzes a single file using the appropriate analysis method
 */
export async function analyzeFile(
  filePath: string, 
  context: vscode.ExtensionContext
): Promise<FileAnalysisResult | undefined> {
  try {
    // For now, we primarily use static analysis
    // In the future, this could route to different analyzers based on file type
    return await analyzeFileStatic(filePath, context);
  } catch (error) {
    const outputChannel = getOutputChannel();
    outputChannel.appendLine(`❌ Error in main analysis: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

/**
 * Shows analysis results in a webview panel
 */
export async function showAnalysisWebView(
  analysisResult: FileAnalysisResult,
  context: vscode.ExtensionContext
): Promise<void> {
  try {
    const panel = vscode.window.createWebviewPanel(
      'codeAnalysis',
      `Analysis: ${analysisResult.fileName}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(context.extensionPath),
          vscode.Uri.file(require('path').join(context.extensionPath, 'media')),
          vscode.Uri.file(require('path').join(context.extensionPath, 'templates'))
        ]
      }
    );

    // Generate nonce for security
    const nonce = generateNonce();
    
    // Get resource URIs
    const styleUri = panel.webview.asWebviewUri(
      vscode.Uri.file(require('path').join(context.extensionPath, 'media', 'analysis', 'fileAnalysisstyle.css'))
    );
    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.file(require('path').join(context.extensionPath, 'media', 'analysis', 'fileAnalysismain.js'))
    );

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
    analysisDataManager.setActiveFileAnalysisPanel(analysisResult.filePath, panel);

    // Send analysis data to webview
    await sendAnalysisData(panel, analysisResult);

    // Handle cleanup when panel is closed
    panel.onDidDispose(() => {
      analysisDataManager.setActiveFileAnalysisPanel(analysisResult.filePath, null);
    });

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      await handleWebviewMessage(message, context, analysisResult);
    });

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to show analysis webview: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Sends analysis data to a webview panel
 */
export async function sendAnalysisData(
  panel: vscode.WebviewPanel, 
  analysisResult: FileAnalysisResult
): Promise<void> {
  try {
    await panel.webview.postMessage({
      command: 'setAnalysisData',
      data: analysisResult
    });
  } catch (error) {
    console.error('Error sending analysis data to webview:', error);
  }
}

/**
 * Handles messages received from webview panels
 */
async function handleWebviewMessage(
  message: WebviewMessage, 
  context: vscode.ExtensionContext, 
  analysisResult: FileAnalysisResult
): Promise<void> {
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
        const panel = analysisDataManager.getActiveFileAnalysisPanel(analysisResult.filePath);
        if (panel) {
          panel.reveal();
        }
        break;
      
      default:
        console.warn(`Unknown webview message command: ${message.command}`);
    }
  } catch (error) {
    console.error('Error handling webview message:', error);
  }
}

/**
 * Shows detailed function analysis in a separate panel
 */
async function showFunctionDetailsPanel(data: any, context: vscode.ExtensionContext): Promise<void> {
  try {
    const panel = vscode.window.createWebviewPanel(
      'functionAnalysis',
      `Function: ${data.function.name}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(context.extensionPath),
          vscode.Uri.file(require('path').join(context.extensionPath, 'media')),
          vscode.Uri.file(require('path').join(context.extensionPath, 'templates'))
        ]
      }
    );

    // Generate nonce for security
    const nonce = generateNonce();
    
    // Get resource URIs
    const styleUri = panel.webview.asWebviewUri(
      vscode.Uri.file(require('path').join(context.extensionPath, 'media', 'analysis', 'functionAnalysisstyle.css'))
    );
    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.file(require('path').join(context.extensionPath, 'media', 'analysis', 'functionAnalysismain.js'))
    );

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
    analysisDataManager.setFunctionData(data.filePath, data);
    analysisDataManager.setActiveFunctionAnalysisPanel(data.filePath, panel);

    // Send function data to webview
    await panel.webview.postMessage({
      command: 'setFunctionData',
      data: data
    });

    // Handle cleanup when panel is closed
    panel.onDidDispose(() => {
      analysisDataManager.setActiveFunctionAnalysisPanel(data.filePath, null);
      analysisDataManager.clearFunctionData(data.filePath);
    });

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to show function details: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Opens a file in the editor at a specific line
 */
async function openFileInEditor(filePath: string, lineNumber?: number): Promise<void> {
  try {
    const document = await vscode.workspace.openTextDocument(filePath);
    const editor = await vscode.window.showTextDocument(document);
    
    if (lineNumber && lineNumber > 0) {
      const position = new vscode.Position(lineNumber - 1, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position));
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Creates an XR visualization for a file analysis result
 */
export async function createAnalysisXRVisualization(
  context: vscode.ExtensionContext,
  analysisResult: FileAnalysisResult
): Promise<string | undefined> {
  try {
    return await createXRVisualization(context, analysisResult);
  } catch (error) {
    const outputChannel = getOutputChannel();
    outputChannel.appendLine(`❌ Error creating XR visualization: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

/**
 * Creates a DOM visualization for an HTML file
 */
export async function createHTMLDOMVisualization(
  context: vscode.ExtensionContext,
  filePath: string
): Promise<string | undefined> {
  try {
    const domResult = await parseHTMLFile(filePath);
    const fileName = require('path').basename(filePath, require('path').extname(filePath));
    const visualizationFolder = getDOMVisualizationFolder(fileName);
    return visualizationFolder;
  } catch (error) {
    const outputChannel = getOutputChannel();
    outputChannel.appendLine(`❌ Error creating DOM visualization: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

/**
 * Gets the file watch manager instance
 */
export function getFileWatchManager(): FileWatchManager | undefined {
  return FileWatchManager.getInstance();
}

/**
 * Disposes of analysis resources
 */
export function disposeAnalysis(): void {
  if (analysisOutputChannel) {
    analysisOutputChannel.dispose();
  }
  
  // Clear all analysis data
  analysisDataManager.clearAllData();
  
  // Stop all file watchers
  const fileWatchManager = FileWatchManager.getInstance();
  if (fileWatchManager) {
    fileWatchManager.stopAllWatchers();
  }
}
