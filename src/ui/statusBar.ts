import * as vscode from 'vscode';
import * as path from 'path';
import { FileAnalysis } from '../analysis/models/analysisModel';
import { analyzeFile } from '../analysis/codeAnalyzer';

// Variable for debouncing updates
let statusBarUpdateTimer: NodeJS.Timeout;

/**
 * Creates and initializes the status bar
 */
export function initializeStatusBar(context: vscode.ExtensionContext): vscode.StatusBarItem {
  // Create status bar item
  const jsMetricsStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  jsMetricsStatusBar.command = 'integracionvsaframe.showJSMetricsDetails';
  
  // Set up event handlers for updating
  setupStatusBarEvents(jsMetricsStatusBar, context);
  
  // Initialize if a JS file is already open
  if (vscode.window.activeTextEditor && 
      (vscode.window.activeTextEditor.document.languageId === 'javascript' || 
       vscode.window.activeTextEditor.document.languageId === 'javascriptreact')) {
    updateJSMetricsStatusBar(vscode.window.activeTextEditor.document, jsMetricsStatusBar, context);
  }
  
  return jsMetricsStatusBar;
}

/**
 * Set up event handlers for status bar updates
 */
function setupStatusBarEvents(statusBar: vscode.StatusBarItem, context: vscode.ExtensionContext): void {
  // Update status bar when active editor changes
  vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    if (editor && (editor.document.languageId === 'javascript' || editor.document.languageId === 'javascriptreact')) {
      updateJSMetricsStatusBar(editor.document, statusBar, context);
    } else {
      statusBar.hide();
    }
  });
  
  // Also update on document change
  vscode.workspace.onDidChangeTextDocument(event => {
    if (vscode.window.activeTextEditor && 
        event.document === vscode.window.activeTextEditor.document &&
        (event.document.languageId === 'javascript' || event.document.languageId === 'javascriptreact')) {
      // Use debouncing to avoid too frequent updates
      clearTimeout(statusBarUpdateTimer);
      statusBarUpdateTimer = setTimeout(() => {
        updateJSMetricsStatusBar(event.document, statusBar, context);
      }, 1000);
    }
  });
}

/**
 * Updates the status bar with JS metrics
 */
export async function updateJSMetricsStatusBar(
  document: vscode.TextDocument, 
  statusBar: vscode.StatusBarItem,
  context: vscode.ExtensionContext
) {
  try {
    // Get cached analysis or run a new one
    let fileAnalysis = context.globalState.get(`jsAnalysis:${document.uri.fsPath}`) as FileAnalysis | undefined;
    
    if (!fileAnalysis) {
      fileAnalysis = await analyzeFile(document.uri.fsPath);
      context.globalState.update(`jsAnalysis:${document.uri.fsPath}`, fileAnalysis);
    }
    
    const metrics = fileAnalysis.metrics;
    
    // Update status bar text
    statusBar.text = `$(code) JS Metrics: ${metrics.totalLines}L ${metrics.functionCount}F`;
    statusBar.tooltip = `JavaScript Metrics for ${path.basename(document.uri.fsPath)}
Lines: ${metrics.totalLines}
Code: ${metrics.codeLines}
Comments: ${metrics.commentLines}
Functions: ${metrics.functionCount}
Classes: ${metrics.classCount}
Click for details`;
    
    statusBar.show();
  } catch (error) {
    console.error('Error updating JS metrics status bar:', error);
    statusBar.text = '$(warning) JS Metrics: Error';
    statusBar.show();
  }
}