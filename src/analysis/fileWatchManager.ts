import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs'; // Regular fs for existsSync and watch
import * as fsPromises from 'fs/promises'; // Use separate import for promises
import { analyzeFile } from './analysisManager';
import { createXRVisualization, openXRVisualization, getVisualizationFolder } from './xr/xrAnalysisManager';
import { AnalysisMode } from './model';
import { analysisDataManager } from './analysisDataManager';
import { notifyClientsDataRefresh, notifyClientsAnalysisUpdated } from '../server/liveReloadManager';
import { transformAnalysisDataForXR } from './xr/xrDataTransformer';
import { formatXRDataForBabia } from './xr/xrDataFormatter';
import { getActiveServers } from '../server/serverManager'; // Import missing function

/**
 * Manages file watchers for analyzed files
 */
export class FileWatchManager {
  private static instance: FileWatchManager | undefined;
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private currentFilePath: string | undefined;
  private lastXRHtmlPath: string | undefined; // Store the path to the last XR HTML file
  private currentMode: AnalysisMode = AnalysisMode.STATIC; // Default mode
  
  /**
   * Gets the singleton instance of the FileWatchManager
   * @returns The FileWatchManager instance or undefined if not initialized
   */
  public static getInstance(): FileWatchManager | undefined {
    return FileWatchManager.instance;
  }
  
  /**
   * Initialize the FileWatchManager
   * @param context Extension context
   */
  public static initialize(context: vscode.ExtensionContext): FileWatchManager {
    if (!FileWatchManager.instance) {
      FileWatchManager.instance = new FileWatchManager(context);
    }
    return FileWatchManager.instance;
  }

  constructor(private context: vscode.ExtensionContext | undefined) {
    // Set as the singleton instance
    FileWatchManager.instance = this;
  }
  
  /**
   * Set the extension context
   * @param context Extension context
   */
  public setContext(context: vscode.ExtensionContext): void {
    this.context = context;
    console.log('FileWatchManager: Context set');
  }
  
  /**
   * Set the current analysis mode
   * @param mode Analysis mode
   */
  public setAnalysisMode(mode: AnalysisMode): void {
    this.currentMode = mode;
    console.log(`FileWatchManager: Analysis mode set to ${mode}`);
  }
  
  /**
   * Start watching a file for changes
   * @param filePath Path to the file to watch
   * @param mode Analysis mode to use for re-analysis
   */
  public startWatching(filePath: string, mode?: AnalysisMode): void {
    // Stop any existing watcher
    this.stopWatching();
    
    if (!this.context) {
      console.error('FileWatchManager: Context not set');
      return;
    }
    
    // Update current mode if provided
    if (mode) {
      this.currentMode = mode;
    }
    
    console.log(`FileWatchManager: Starting to watch ${filePath} in mode ${this.currentMode}`);
    
    // Store the current file path
    this.currentFilePath = filePath;
    
    // Create a new file watcher for the specific file
    const filePattern = new vscode.RelativePattern(
      path.dirname(filePath),
      path.basename(filePath)
    );
    
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(filePattern);
    
    // Register change event - REEMPLAZA ESTA PARTE SI ES DIFERENTE
    this.fileWatcher.onDidChange(async (uri) => {
      console.log(`FileWatchManager: Detected change in ${uri.fsPath}`);
      
      // Only trigger re-analysis if the changed file is the one we're watching
      if (uri.fsPath === this.currentFilePath) {
        console.log('FileWatchManager: File matched, re-analyzing...');
        await this.handleFileChange(uri.fsPath);
      } else {
        console.log(`FileWatchManager: File doesn't match current (${this.currentFilePath}), ignoring change`);
      }
    });
    
    // Add the watcher to disposables for proper cleanup
    this.context.subscriptions.push(this.fileWatcher);
  }
  
  /**
   * Stop watching the current file
   */
  public stopWatching(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = undefined;
      console.log('FileWatchManager: Stopped watching file');
    }
    this.currentFilePath = undefined;
  }
  
  /**
   * Handle file change by re-analyzing it according to the current mode
   * @param filePath Path to the changed file
   */
  private async handleFileChange(filePath: string): Promise<void> {
    if (!this.context) {
      console.error('FileWatchManager: Context not set');
      return;
    }
    
    console.log(`FileWatchManager: Re-analyzing file ${filePath} in mode ${this.currentMode}`);
    
    try {
      switch (this.currentMode) {
        case AnalysisMode.STATIC:
          // Re-analyze and display in static mode (webview)
          await this.handleStaticReanalysis(filePath);
          break;
          
        case AnalysisMode.XR:
          // Re-analyze and update XR visualization
          await this.handleXRReanalysis(filePath);
          break;
          
        default:
          console.log(`FileWatchManager: Unknown analysis mode ${this.currentMode}`);
      }
    } catch (error) {
      console.error('Error during re-analysis:', error);
      vscode.window.showErrorMessage(`Error during automatic re-analysis: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Handle re-analysis in static mode
   * @param filePath Path to the file to re-analyze
   */
  private async handleStaticReanalysis(filePath: string): Promise<void> {
    if (!this.context) {
      console.error('No context available for static reanalysis');
      return;
    }
    
    console.log(`Re-analyzing file in static mode: ${filePath}`);
    
    // Re-analyze the file using the existing analyze function
    const analysisResult = await analyzeFile(filePath, this.context);
    
    if (!analysisResult) {
      console.error('Failed to re-analyze file for static visualization');
      return;
    }
    
    // Store the updated result in the analysisDataManager
    analysisDataManager.setAnalysisResult(analysisResult);
    
    // Notify the webview panel to update its content (if it's still open)
    console.log('Sending update to analysis panel');
    vscode.commands.executeCommand('codexr.updateAnalysisPanel', analysisResult);
  }
  
  /**
   * Handle re-analysis in XR mode
   * @param filePath Path to the file to re-analyze
   */
  private async handleXRReanalysis(filePath: string): Promise<void> {
    if (!this.context) {
      console.error('No context available for XR reanalysis');
      return;
    }
    
    try {
      console.log(`🔄 Re-analyzing file ${filePath} for XR update...`);
      const analysisResult = await analyzeFile(filePath, this.context);
      
      if (!analysisResult) {
        console.error('❌ Failed to re-analyze file for XR visualization');
        return;
      }
      
      // Get the file name without extension for folder lookup
      const fileNameWithoutExt = path.basename(analysisResult.fileName, path.extname(analysisResult.fileName));
      
      // Look up the existing visualization folder
      const existingFolder = getVisualizationFolder(fileNameWithoutExt);
      
      if (existingFolder) {
        console.log(`Found existing visualization folder: ${existingFolder}`);
        
        // Path to the existing data.json file
        const dataFilePath = path.join(existingFolder, 'data.json');
        console.log(`Updating data.json at: ${dataFilePath}`);
        
        // Transform the analysis data for XR visualization
        console.log(`Analysis result contains ${analysisResult.functions.length} functions`);
        const transformedData = transformAnalysisDataForXR(analysisResult);
        console.log('Transformed data for XR');
        let babiaCompatibleData = formatXRDataForBabia(transformedData);
        console.log(`Final formatted data has ${babiaCompatibleData.length} functions`);

        // IMPORTANTE: Usa fs.writeFileSync en lugar de la versión async para evitar problemas
        try {
          const fs = require('fs');
          fs.writeFileSync(dataFilePath, JSON.stringify(babiaCompatibleData, null, 2));
          console.log(`✅ Data file updated at: ${dataFilePath} with ${babiaCompatibleData.length} items`);
          
          // Notificar a los clientes conectados
          notifyClientsAnalysisUpdated();
          console.log('✅ Notificación enviada a los clientes para actualizar visualización');
          
          vscode.window.showInformationMessage('Visualización XR actualizada sin salir de AR/VR');
        } catch (writeError) {
          console.error(`Error al escribir data.json: ${writeError}`);
          vscode.window.showErrorMessage(`Error al actualizar data.json: ${writeError}`);
        }
      } else {
        console.log('No se encontró una carpeta de visualización existente, creando nueva visualización');
        // Crear nueva visualización
        const htmlFilePath = await createXRVisualization(this.context, analysisResult);
        if (htmlFilePath) {
          await openXRVisualization(htmlFilePath, this.context);
        }
      }
    } catch (error) {
      console.error('Error updating XR visualization:', error);
      vscode.window.showErrorMessage(`Error al actualizar visualización XR: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Update the last XR HTML path
   * @param htmlPath Path to the XR HTML file
   */
  public setLastXRHtmlPath(htmlPath: string): void {
    this.lastXRHtmlPath = htmlPath;
  }
  
  /**
   * Get the last XR HTML path
   * @returns Path to the last XR HTML file
   */
  public getLastXRHtmlPath(): string | undefined {
    return this.lastXRHtmlPath;
  }

  /**
   * Watch a JSON data file for a manually created visualization
   * @param jsonFilePath Path to the JSON data file
   * @param htmlFilePath Path to the HTML visualization file
   */
  public watchVisualizationDataFile(jsonFilePath: string, htmlFilePath: string): void {
    if (!fs.existsSync(jsonFilePath)) {
      console.error(`Cannot watch non-existent data file: ${jsonFilePath}`);
      return;
    }

    console.log(`🔍 Setting up watcher for visualization data file: ${jsonFilePath}`);
    
    // Create a file watcher for the JSON data file using Node's fs.watch
    const watcher = fs.watch(jsonFilePath, (eventType, filename) => {
      if (eventType === 'change') {
        console.log(`📊 Visualization data file changed: ${jsonFilePath}`);
        
        // Use an immediately invoked async function to handle async operations
        (async () => {
          try {
            // Read the file to ensure it's a valid JSON
            const data = await fsPromises.readFile(jsonFilePath, 'utf8');
            JSON.parse(data); // This will throw if invalid JSON
            
            // Find active servers serving this HTML file
            const activeServers = getActiveServers().filter((server) => 
              path.dirname(server.filePath) === path.dirname(htmlFilePath));
              
            if (activeServers.length > 0) {
              console.log(`🔄 Notifying clients to refresh visualization data for ${path.basename(htmlFilePath)}`);
              notifyClientsDataRefresh();
            } else {
              console.log(`ℹ️ No active servers found for ${htmlFilePath}, data refresh notification skipped`);
            }
          } catch (error) {
            console.error(`❌ Error processing visualization data update: ${error instanceof Error ? error.message : String(error)}`);
          }
        })();
      }
    });
    
    // Store the watcher for cleanup on extension deactivation
    if (this.context) {
      this.context.subscriptions.push({ 
        dispose: () => {
          if (watcher) {
            watcher.close();
          }
        } 
      });
    }
  }
}