import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseHTMLFile, prepareHTMLForTemplate, DOMAnalysisResult } from './htmlDomParser';
import { createServer, updateServerDisplayInfo, getActiveServers, stopServer } from '../../server/serverManager';
import { ServerMode } from '../../server/models/serverModel';
// ✅ NEW: Import FileWatchManager and AnalysisMode for DOM live-reload
import { FileWatchManager } from '../fileWatchManager';
import { AnalysisMode } from '../model';

// ✅ ADD: Track DOM visualization folders by filename (similar to XR analysis)
const domVisualizationFolders: Map<string, string> = new Map();

/**
 * ✅ NEW: Get active DOM visualization server for a specific file
 * @param fileName HTML file name
 * @returns ServerInfo if found, undefined otherwise
 */
export function getActiveDOMVisualizationServer(fileName: string): any {
  const activeServers = getActiveServers();
  return activeServers.find(server => {
    return server.analysisFileName === fileName && 
           server.displayUrl?.includes('XR DOM Visualization');
  });
}

/**
 * ✅ NEW: Close existing DOM visualization server for a specific file
 * @param fileName HTML file name
 * @returns true if server was found and closed, false otherwise
 */
export function closeExistingDOMVisualizationServer(fileName: string): boolean {
  const existingServer = getActiveDOMVisualizationServer(fileName);
  
  if (existingServer) {
    console.log(`🛑 Closing existing DOM visualization server for ${fileName}: ${existingServer.url}`);
    stopServer(existingServer.id);
    return true;
  }
  
  return false;
}

/**
 * Creates a DOM visualization for an HTML file
 * @param filePath Path to the HTML file
 * @param context Extension context
 * @returns Path to the created visualization or undefined on error
 */
export async function createDOMVisualization(
  filePath: string,
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  try {
    // Parse the HTML file
    const domAnalysis = await parseHTMLFile(filePath);
    
    // Prepare HTML content for template
    const templateHTML = prepareHTMLForTemplate(domAnalysis);
    
    // Create the visualization folder
    const visualizationsDir = path.join(context.extensionPath, 'visualizations');
    
    try {
      await fs.promises.access(visualizationsDir);
    } catch (e) {
      await fs.promises.mkdir(visualizationsDir, { recursive: true });
    }
    
    // ✅ UPDATED: Check for existing visualization folder (similar to XR analysis)
    const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
    const existingFolder = domVisualizationFolders.get(fileNameWithoutExt);
    
    let visualizationDir: string;
    
    if (existingFolder && await fs.promises.access(existingFolder).then(() => true).catch(() => false)) {
      // Reuse existing folder
      visualizationDir = existingFolder;
      console.log(`♻️ Reusing existing DOM visualization folder: ${visualizationDir}`);
    } else {
      // Create new folder
      const timestamp = Date.now();
      visualizationDir = path.join(visualizationsDir, `dom-${fileNameWithoutExt}-${timestamp}`);
      await fs.promises.mkdir(visualizationDir, { recursive: true });
      
      // Track this folder
      domVisualizationFolders.set(fileNameWithoutExt, visualizationDir);
      console.log(`📁 Created new DOM visualization folder: ${visualizationDir}`);
    }
    
    // Process the template with the HTML content
    const htmlContent = await processDOMVisualizationTemplate(domAnalysis, templateHTML, context);
    
    // Save the HTML file
    const htmlFilePath = path.join(visualizationDir, 'index.html');
    await fs.promises.writeFile(htmlFilePath, htmlContent);
    
    // Get server mode from user configuration
    const userServerMode = context.globalState.get<ServerMode>('serverMode') || ServerMode.HTTPS_DEFAULT_CERTS;
    
    // Create and start server
    const serverInfo = await createServer(visualizationDir, userServerMode, context);
    
    if (serverInfo) {
      // Update server display info for DOM visualization
      const originalFileName = path.basename(filePath);
      const updated = updateServerDisplayInfo(serverInfo.id, {
        analysisFileName: originalFileName,
        displayUrl: `${originalFileName}: ${serverInfo.port} - XR DOM Visualization`
      });
      
      if (updated) {
        console.log(`✅ Updated server display info for DOM visualization: ${originalFileName}`);
        
        // Refresh tree view to show updated server info
        vscode.commands.executeCommand('codexr.refreshTreeView');
      }
      
      // Automatically open browser
      console.log(`🌐 Opening DOM visualization in browser: ${serverInfo.url}`);
      await vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
      
      // ✅ NEW: Set up file watching for DOM live-reload
      const fileWatchManager = FileWatchManager.getInstance();
      if (fileWatchManager) {
        // Set the DOM HTML path for this file
        fileWatchManager.setDOMHtmlPath(filePath, htmlFilePath);
        
        // Start watching the original HTML file in DOM mode
        fileWatchManager.startWatching(filePath, AnalysisMode.DOM);
        
        console.log(`🔍 Started file watching for DOM live-reload: ${originalFileName}`);
      } else {
        console.warn('⚠️ FileWatchManager not available, DOM live-reload not enabled');
      }

      // Show simple success message
      vscode.window.showInformationMessage(
        `DOM visualization server started for ${originalFileName}`,
        { modal: false }
      );
      
      return htmlFilePath;
    } else {
      vscode.window.showErrorMessage('Failed to start DOM visualization server');
      return undefined;
    }
    
  } catch (error) {
    vscode.window.showErrorMessage(`Error creating DOM visualization: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

/**
 * ✅ NEW: Cleanup DOM visualization folders
 */
export function cleanupDOMVisualizations(): void {
  domVisualizationFolders.clear();
}

/**
 * ✅ NEW: Get DOM visualization folder for a specific file name
 * @param fileName File name without extension
 * @returns Visualization directory path or undefined if not found
 */
export function getDOMVisualizationFolder(fileName: string): string | undefined {
  return domVisualizationFolders.get(fileName);
}

/**
 * Processes the DOM visualization template with all placeholders
 * @param domAnalysis DOM analysis result
 * @param templateHTML Single-line HTML content
 * @param context Extension context
 * @returns Processed HTML content
 */
async function processDOMVisualizationTemplate(
  domAnalysis: DOMAnalysisResult,
  templateHTML: string,
  context: vscode.ExtensionContext
): Promise<string> {
  // Load the DOM visualization template
  const templatePath = path.join(context.extensionPath, 'templates', 'xr', 'dom-visualization-template.html');
  let template = await fs.promises.readFile(templatePath, 'utf-8');
  
  // Get environment settings from context with proper defaults
  const backgroundColor = context.globalState.get<string>('babiaBackgroundColor') || '#FFFFFF';
  const environmentPreset = context.globalState.get<string>('babiaEnvironmentPreset') || 'forest';
  const groundColor = context.globalState.get<string>('babiaGroundColor') || '#85144b';
  
  // Create title
  const title = `DOM Visualization - ${domAnalysis.fileName}`;
  
  // Replace all placeholders including HTML_CONTENT
  template = template
    .replace(/\$\{TITLE\}/g, title)
    .replace(/\$\{FILE_NAME\}/g, domAnalysis.fileName)
    .replace(/\$\{BACKGROUND_COLOR\}/g, backgroundColor)
    .replace(/\$\{ENVIRONMENT_PRESET\}/g, environmentPreset)
    .replace(/\$\{GROUND_COLOR\}/g, groundColor)
    .replace(/\$\{HTML_CONTENT\}/g, templateHTML);
  
  return template;
}