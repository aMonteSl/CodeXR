import * as vscode from 'vscode';
import * as path from 'path';
import { FileWatchManager } from '../watchers/fileWatchManager';
import { AnalysisMode } from '../model';
import { createAnalysisVisualization, copyStaticAnalysisAssets, updateVisualizationData } from '../utils/sharedAnalysisUtils';
import { analyzeFileStatic } from '../static/index';
import { AnalysisSessionManager, AnalysisType } from '../analysisSessionManager';

// Track open webview panels by file path
const openPanels: Map<string, vscode.WebviewPanel> = new Map();

// Track visualization directories by file path
const visualizationDirs: Map<string, string> = new Map();

/**
 * Creates a static analysis visualization and opens it in a VS Code webview panel
 * @param context Extension context
 * @param filePath Path to file to analyze
 * @returns Promise with visualization folder path or undefined
 */
export async function createStaticVisualization(
  context: vscode.ExtensionContext,
  filePath: string
): Promise<string | undefined> {
  try {
    console.log(`🔍 Starting static analysis visualization for: ${filePath}`);
    
    // Close existing panel if it exists
    const existingPanel = openPanels.get(filePath);
    if (existingPanel) {
      existingPanel.dispose(); // This will trigger onDidDispose and clean up watchers
    }
    
    // Use shared analysis utility to create visualization directory and data.json
    const result = await createAnalysisVisualization(filePath, context);
    if (!result) {
      return undefined;
    }
    
    const { analysisResult, visualizationDir } = result;
    
    // Copy static analysis template and assets
    await copyStaticAnalysisAssets(context, visualizationDir);
    
    // Track visualization directory for this file
    visualizationDirs.set(filePath, visualizationDir);
    
    // Open the visualization in a webview panel
    await openStaticVisualizationPanel(context, visualizationDir, analysisResult.fileName, filePath);
    
    // Set up file watcher for auto-reanalysis (handled by FileWatchManager)
    // The FileWatchManager will call updateStaticVisualization when files change
    const fileWatchManager = FileWatchManager.getInstance();
    if (fileWatchManager) {
      fileWatchManager.startWatching(filePath, AnalysisMode.STATIC);
    }
    
    vscode.window.showInformationMessage(
      `Static analysis complete: ${path.basename(filePath)}`
    );
    
    return visualizationDir;
    
  } catch (error) {
    console.error('Error creating static visualization:', error);
    vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

/**
 * Opens the static analysis visualization in a VS Code webview panel
 * @param context Extension context
 * @param visualizationDir Path to the visualization directory
 * @param fileName Name of the analyzed file
 * @param originalFilePath Original file path for tracking
 */
async function openStaticVisualizationPanel(
  context: vscode.ExtensionContext,
  visualizationDir: string,
  fileName: string,
  originalFilePath: string
): Promise<void> {
  try {
    // Create webview panel on the right side
    const panel = vscode.window.createWebviewPanel(
      'staticAnalysisPanel',
      `Analysis: ${fileName}`,
      vscode.ViewColumn.Two, // Right side panel
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(visualizationDir), // Allow access to the visualization folder
          context.extensionUri // Allow access to extension resources
        ],
        retainContextWhenHidden: true
      }
    );
    
    // Track the panel for this file
    openPanels.set(originalFilePath, panel);
    
    // ✅ Register the analysis session
    const sessionManager = AnalysisSessionManager.getInstance();
    console.log(`🔍 [StaticViz] About to add session for: ${originalFilePath} (${AnalysisType.STATIC})`);
    console.log(`🔍 [StaticViz] Panel exists: ${panel ? 'YES' : 'NO'}`);
    const sessionId = sessionManager.addSession(originalFilePath, AnalysisType.STATIC, panel);
    console.log(`🔍 [StaticViz] Session added with ID: ${sessionId}`);
    
    // Debug session manager state after adding
    sessionManager.debugState();
    
    // Handle panel disposal - clean up watchers and tracking
    panel.onDidDispose(() => {
      console.log(`🗑️ [StaticViz] Panel disposed for: ${originalFilePath}`);
      
      // Remove from tracking
      openPanels.delete(originalFilePath);
      visualizationDirs.delete(originalFilePath);
      
      // ✅ Remove from session manager (will auto-trigger tree refresh)
      console.log(`🗑️ [StaticViz] Removing session for: ${originalFilePath}`);
      const sessionKey = originalFilePath + '::' + AnalysisType.STATIC;
      console.log(`🗑️ [StaticViz] Session key to remove: ${sessionKey}`);
      sessionManager.removeSession(sessionKey);
      console.log(`🗑️ [StaticViz] Session removal complete`);
      
      // Stop file watcher for this file
      const fileWatchManager = FileWatchManager.getInstance();
      if (fileWatchManager) {
        console.log(`🛑 Stopping file watcher for: ${originalFilePath}`);
        fileWatchManager.stopWatching(originalFilePath);
      }
    });
    
    // Load the HTML content from the visualization directory
    await updatePanelContent(panel, visualizationDir);
    
    console.log(`📱 Opened static analysis panel for: ${fileName}`);
    
  } catch (error) {
    console.error('Error opening static visualization panel:', error);
    vscode.window.showErrorMessage(`Failed to open analysis panel: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Updates the webview panel content with the HTML from the visualization directory
 * @param panel Webview panel to update
 * @param visualizationDir Path to the visualization directory
 */
async function updatePanelContent(
  panel: vscode.WebviewPanel,
  visualizationDir: string
): Promise<void> {
  try {
    const fs = require('fs').promises;
    const htmlPath = path.join(visualizationDir, 'index.html');
    const dataPath = path.join(visualizationDir, 'data.json');
    
    let htmlContent = await fs.readFile(htmlPath, 'utf-8');
    const analysisData = JSON.parse(await fs.readFile(dataPath, 'utf-8'));
    
    // Convert file paths to webview URIs
    const cssUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(visualizationDir, 'fileAnalysisstyle.css')));
    const jsUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(visualizationDir, 'fileAnalysismain.js')));
    
    // Generate a simple nonce for security
    const nonce = Date.now().toString();
    
    // Replace placeholders in the HTML template
    htmlContent = htmlContent
      .replace(/\$\{webview\.cspSource\}/g, panel.webview.cspSource)
      .replace(/\$\{styleUri\}/g, cssUri.toString())
      .replace(/\$\{scriptUri\}/g, jsUri.toString())
      .replace(/\$\{nonce\}/g, nonce);
    
    // ✅ CRITICAL FIX: Inject analysis data directly into HTML instead of using fetch
    // Find the closing </head> tag and inject data script before it
    const dataScript = `
  <script nonce="${nonce}">
    window.analysisData = ${JSON.stringify(analysisData)};
  </script>`;
    
    htmlContent = htmlContent.replace('</head>', `${dataScript}\n</head>`);
    
    // Set the webview content
    panel.webview.html = htmlContent;
    
  } catch (error) {
    console.error('Error updating panel content:', error);
    throw error;
  }
}

/**
 * Re-analyzes a file and updates existing visualization without creating new panels or watchers
 * @param filePath Path to file to re-analyze
 * @param context Extension context
 * @returns Promise with visualization folder path or undefined
 */
export async function updateStaticVisualization(
  filePath: string,
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  try {
    console.log(`🔄 Re-analyzing file for static visualization update: ${filePath}`);
    
    // Check if we have a tracked visualization directory for this file
    const visualizationDir = visualizationDirs.get(filePath);
    if (!visualizationDir) {
      console.warn(`No tracked visualization directory for: ${filePath}`);
      return undefined;
    }
    
    // Re-analyze the file using static analysis
    const analysisResult = await analyzeFileStatic(filePath, context);
    if (!analysisResult) {
      console.error('Failed to re-analyze file');
      return undefined;
    }
    
    // Update data.json in the existing visualization directory
    await updateVisualizationData(visualizationDir, analysisResult);
    console.log(`📊 Updated data.json for: ${path.basename(filePath)}`);
    
    // Update the panel content if it's still open
    const panel = openPanels.get(filePath);
    if (panel) {
      await updatePanelContent(panel, visualizationDir);
      console.log(`🔄 Panel content refreshed for: ${path.basename(filePath)}`);
    }
    
    return visualizationDir;
    
  } catch (error) {
    console.error('Error updating static visualization:', error);
    return undefined;
  }
}

/**
 * Cleanup static visualization panels and tracking
 */
export function cleanupStaticVisualizations(): void {
  // Close all open panels
  for (const panel of openPanels.values()) {
    panel.dispose();
  }
  openPanels.clear();
  visualizationDirs.clear();
  
  console.log('🧹 Cleaned up all static visualization panels and tracking');
}

/**
 * Gets the visualization folder for a specific file
 * @param filePath Path to the analyzed file
 * @returns Visualization directory path or undefined
 */
export function getStaticVisualizationFolder(filePath: string): string | undefined {
  return visualizationDirs.get(filePath);
}

/**
 * Gets the open panel for a specific file
 * @param filePath Path to the analyzed file
 * @returns Webview panel or undefined
 */
export function getOpenPanel(filePath: string): vscode.WebviewPanel | undefined {
  return openPanels.get(filePath);
}

/**
 * Closes the panel for a specific file
 * @param filePath Path to the analyzed file
 */
export function closePanelForFile(filePath: string): void {
  const panel = openPanels.get(filePath);
  if (panel) {
    panel.dispose(); // This will trigger onDidDispose and clean up properly
  }
}

/**
 * Gets all files that have open panels
 * @returns Array of file paths with open panels
 */
export function getOpenPanelFiles(): string[] {
  return Array.from(openPanels.keys());
}
