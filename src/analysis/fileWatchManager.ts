import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { analyzeFile } from './analysisManager';
import { createXRVisualization, openXRVisualization, getVisualizationFolder } from './xr/xrAnalysisManager';
import { AnalysisMode } from './model';
import { analysisDataManager } from './analysisDataManager';
import { notifyClientsDataRefresh, notifyClientsAnalysisUpdated } from '../server/liveReloadManager';
import { transformAnalysisDataForXR } from './xr/xrDataTransformer';
import { formatXRDataForBabia } from './xr/xrDataFormatter';
import { getActiveServers } from '../server/serverManager';
import { sendAnalysisData } from './analysisManager';
import { notifyClients } from '../server/liveReloadManager';

/**
 * Manages file watchers for analyzed files
 */
export class FileWatchManager {
  private static instance: FileWatchManager | undefined;
  private context: vscode.ExtensionContext | undefined;
  
  // Store multiple file watchers by file path
  private fileWatchers: Map<string, vscode.Disposable> = new Map();
  
  // Track analysis mode for each file
  private fileAnalysisModes: Map<string, AnalysisMode> = new Map();
  
  // Track XR HTML paths for each analyzed file
  private xrHtmlPaths: Map<string, string> = new Map();
  
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private debounceDelay: number = 2000; // Default to 2 seconds
  private autoAnalysisEnabled: boolean = true; // Default to enabled
  
  // Allow adjusting the debounce delay
  public setDebounceDelay(delay: number): void {
    console.log(`Setting debounce delay to ${delay}ms`);
    this.debounceDelay = delay;
  }
  
  // Allow toggling auto-analysis
  public setAutoAnalysis(enabled: boolean): void {
    console.log(`Setting auto-analysis to ${enabled}`);
    this.autoAnalysisEnabled = enabled;
  }
  
  /**
   * Gets the singleton instance of the FileWatchManager
   * @returns The FileWatchManager instance or undefined if not initialized
   */
  public static getInstance(): FileWatchManager | undefined {
    if (!this.instance) {
      this.instance = new FileWatchManager(undefined);
    }
    return this.instance;
  }
  
  /**
   * Initialize the FileWatchManager
   * @param context Extension context
   */
  public static initialize(context: vscode.ExtensionContext): FileWatchManager {
    if (!this.instance) {
      this.instance = new FileWatchManager(context);
    } else {
      this.instance.setContext(context);
    }
    
    // Initialize settings from configuration
    if (context) {
      const config = vscode.workspace.getConfiguration();
      const debounceDelay = config.get<number>('codexr.analysis.debounceDelay', 2000);
      const autoAnalysis = config.get<boolean>('codexr.analysis.autoAnalysis', true);
      
      // Apply settings
      const instance = this.instance;
      instance.setDebounceDelay(debounceDelay);
      instance.setAutoAnalysis(autoAnalysis);
      
      console.log(`FileWatchManager initialized with settings: delay=${debounceDelay}ms, autoAnalysis=${autoAnalysis}`);
    }
    
    return this.instance;
  }

  constructor(private _context: vscode.ExtensionContext | undefined) {
    this.context = _context;
  }
  
  /**
   * Set the extension context
   * @param context Extension context
   */
  public setContext(context: vscode.ExtensionContext): void {
    this.context = context;
  }
  
  /**
   * Set the analysis mode for a specific file
   * @param filePath Path to the file
   * @param mode Analysis mode
   */
  public setAnalysisMode(filePath: string, mode: AnalysisMode): void {
    this.fileAnalysisModes.set(filePath, mode);
  }
  
  /**
   * Start watching a file for changes
   * @param filePath Path to the file to watch
   * @param mode Analysis mode
   */
  public startWatching(filePath: string, mode: AnalysisMode): void {
    // Stop watching this file if already being watched
    this.stopWatching(filePath);
    
    console.log(`Starting to watch ${filePath} in ${mode} mode`);
    
    // Store the analysis mode for this file
    this.fileAnalysisModes.set(filePath, mode);
    
    // Setup file watcher for changes
    const watcher = fs.watch(filePath, (eventType) => {
      if (eventType === 'change') {
        console.log(`Detected change in ${filePath}`);
        this.handleFileChange(filePath);
      }
    });
    
    // Store watcher for disposal later
    this.fileWatchers.set(filePath, { dispose: () => watcher.close() });
  }
  
  /**
   * Stop watching a file
   * @param filePath Path to the file to stop watching
   */
  public stopWatching(filePath: string): void {
    const watcher = this.fileWatchers.get(filePath);
    if (watcher) {
      watcher.dispose();
      this.fileWatchers.delete(filePath);
      console.log(`Stopped watching ${filePath}`);
    }
  }
  
  /**
   * Stop watching all files
   */
  public stopWatchingAll(): void {
    for (const [filePath, watcher] of this.fileWatchers.entries()) {
      watcher.dispose();
      console.log(`Stopped watching ${filePath}`);
    }
    this.fileWatchers.clear();
  }
  
  /**
   * Handle file change by re-analyzing it according to the current mode
   * @param filePath Path to the changed file
   */
  public async handleFileChange(filePath: string): Promise<void> {
    // Skip if auto-analysis is disabled
    if (!this.autoAnalysisEnabled) {
      console.log(`Auto-analysis is disabled, ignoring changes to ${filePath}`);
      return;
    }
    
    // Cancel any pending analysis for this file
    if (this.debounceTimers.has(filePath)) {
      clearTimeout(this.debounceTimers.get(filePath));
    }
    
    // Show subtle indication that analysis is pending
    vscode.window.setStatusBarMessage(`$(sync~spin) CodeXR: Preparing analysis...`);
    
    // Schedule a new analysis after the debounce delay
    this.debounceTimers.set(filePath, setTimeout(async () => {
      await this.performFileAnalysis(filePath);
    }, this.debounceDelay));
  }
  
  // Extrae el código de análisis actual a este método
  private async performFileAnalysis(filePath: string): Promise<void> {
    if (!this.context) {
      console.error('FileWatchManager: Context not set');
      return;
    }
    
    const mode = this.fileAnalysisModes.get(filePath) || AnalysisMode.STATIC;
    console.log(`FileWatchManager: Re-analyzing file ${filePath} in mode ${mode}`);
    
    try {
      switch (mode) {
        case AnalysisMode.STATIC:
          // Re-analyze and display in static mode (webview)
          await this.handleStaticReanalysis(filePath);
          break;
          
        case AnalysisMode.XR:
          // Re-analyze and update XR visualization
          await this.handleXRReanalysis(filePath);
          break;
          
        default:
          console.log(`FileWatchManager: Unknown analysis mode ${mode}`);
      }
    } catch (error) {
      console.error('Error handling file change:', error);
      vscode.window.showErrorMessage(`Error updating analysis: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Handle re-analysis in static mode
   * @param filePath Path to the file to re-analyze
   */
  private async handleStaticReanalysis(filePath: string): Promise<void> {
    if (!this.context) {
      return;
    }
    
    console.log(`Re-analyzing ${filePath} for static visualization update`);
    
    const analysisResult = await analyzeFile(filePath, this.context);
    if (!analysisResult) {
      console.error('Failed to re-analyze file');
      return;
    }
    
    // Update the stored analysis result
    analysisDataManager.setAnalysisResult(filePath, analysisResult);
    
    // Get the active webview panel
    const panel = analysisDataManager.getActiveFileAnalysisPanel(filePath);
    if (panel) {
      // Send the new data to the panel directly
      sendAnalysisData(panel, analysisResult);
      
      console.log('Analysis panel updated with latest data');
    } else {
      console.log('No active panel found or panel was disposed');
      
      // Fallback to command-based update
      vscode.commands.executeCommand('codexr.updateAnalysisPanel', analysisResult, filePath);
    }
  }
  
  /**
   * Handle re-analysis in XR mode
   * @param filePath Path to the file to re-analyze
   */
  private async handleXRReanalysis(filePath: string): Promise<void> {
    if (!this.context) {
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

        // Use fs.writeFileSync to avoid potential issues
        try {
          fs.writeFileSync(dataFilePath, JSON.stringify(babiaCompatibleData, null, 2));
          console.log(`✅ Data file updated at: ${dataFilePath} with ${babiaCompatibleData.length} items`);
          
          // Notify connected clients
          notifyClientsAnalysisUpdated();
          console.log('✅ Notification sent to clients to update visualization');
          
          vscode.window.showInformationMessage('XR visualization updated without exiting AR/VR');
        } catch (writeError) {
          console.error(`Error writing data.json: ${writeError}`);
          vscode.window.showErrorMessage(`Error updating data.json: ${writeError}`);
        }
      } else {
        console.log('No existing visualization folder found, creating new visualization');
        // Create new visualization
        const htmlFilePath = await createXRVisualization(this.context, analysisResult);
        if (htmlFilePath) {
          await openXRVisualization(htmlFilePath, this.context);
        }
      }
    } catch (error) {
      console.error('Error updating XR visualization:', error);
      vscode.window.showErrorMessage(`Error updating XR visualization: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Update the XR HTML path for a specific file
   * @param filePath Path to the analyzed file
   * @param htmlPath Path to the XR HTML file
   */
  public setXRHtmlPath(filePath: string, htmlPath: string): void {
    this.xrHtmlPaths.set(filePath, htmlPath);
  }
  
  /**
   * Get the XR HTML path for a specific file
   * @param filePath Path to the analyzed file
   * @returns Path to the XR HTML file
   */
  public getXRHtmlPath(filePath: string): string | undefined {
    return this.xrHtmlPaths.get(filePath);
  }

  /**
   * Watch a visualization data file for changes
   * @param jsonFilePath Path to the JSON data file to watch
   * @param htmlFilePath Path to the HTML file that uses the data
   */
  public watchVisualizationDataFile(jsonFilePath: string, htmlFilePath: string): void {
    if (!jsonFilePath || !fs.existsSync(jsonFilePath)) {
      console.error(`Cannot watch non-existent JSON file: ${jsonFilePath}`);
      return;
    }

    console.log(`Setting up file watcher for visualization data: ${jsonFilePath}`);
    
    // Watch for changes to the JSON file
    const jsonWatcher = fs.watch(jsonFilePath, (eventType) => {
      if (eventType === 'change') {
        console.log(`JSON file changed: ${jsonFilePath}`);
        
        // Notify clients to refresh their data
        notifyClientsDataRefresh();
      }
    });
    
    // Watch for changes to the HTML file
    if (htmlFilePath && fs.existsSync(htmlFilePath)) {
      const htmlWatcher = fs.watch(htmlFilePath, (eventType) => {
        if (eventType === 'change') {
          console.log(`HTML file changed: ${htmlFilePath}`);
          
          // Notify clients to reload the page
          notifyClients();
        }
      });
      
      // Store the watcher
      this.fileWatchers.set(htmlFilePath, { dispose: () => htmlWatcher.close() });
    }
    
    // Store the JSON watcher
    this.fileWatchers.set(jsonFilePath, { dispose: () => jsonWatcher.close() });
  }
}