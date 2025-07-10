/**
 * Shared XR analysis utilities for both shallow and deep directory analysis
 * Provides common functionality for XR visualization, server management, and watcher setup
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { DirectoryAnalysisResult } from '../static/directory/directoryAnalysisModel';
import { DirectoryAnalysisFilters } from '../static/directory/common/directoryAnalysisConfig';
import { generateNonce } from '../../utils/nonceUtils';
import { AnalysisSessionManager, AnalysisType } from '../analysisSessionManager';
import { IncrementalAnalysisEngine, IncrementalAnalysisConfig, transformToFilesArray } from './incrementalAnalysisEngine';
import { SharedDirectoryWatcherManager, DirectoryWatcherOptions } from '../utils/directoryWatcher';
import { createServer, getActiveServers, stopServer, updateServerDisplayInfo } from '../../server/serverManager';
import { ServerInfo, ServerMode } from '../../server/models/serverModel';
import { portManager } from '../../server/portManager';
import { defaultCertificatesExist } from '../../server/certificateManager';
import { injectLiveReloadScript, notifyClientsDataRefresh } from '../../server/liveReloadManager';
import { 
  createNotificationProgressCallback, 
  logAnalysisStart, 
  logAnalysisComplete, 
  isInitialAnalysis 
} from './directoryAnalysisProgress';

/**
 * Configuration for XR analysis
 */
export interface XRAnalysisConfig {
  /** Directory path to analyze */
  directoryPath: string;
  
  /** Analysis filters (determines shallow vs deep) */
  filters: DirectoryAnalysisFilters;
  
  /** Whether this is a project-level analysis */
  isProject: boolean;
  
  /** Extension context */
  context: vscode.ExtensionContext;
  
  /** Previous analysis result for incremental analysis */
  previousResult?: DirectoryAnalysisResult;
  
  /** Analysis mode label for logging */
  modeLabel: string;
}

/**
 * XR analysis result
 */
export interface XRAnalysisResult {
  /** Analysis result data */
  analysisResult: DirectoryAnalysisResult;
  
  /** Visualization directory path */
  visualizationDir: string;
  
  /** Server information */
  serverInfo: ServerInfo;
}

/**
 * Shared XR analysis utilities
 */
export class XRAnalysisManager {
  
  // Track visualization directories by directory path  
  private static visualizationDirs: Map<string, string> = new Map();
  
  // Track active servers by directory path
  private static activeServers: Map<string, ServerInfo> = new Map();
  
  /**
   * Creates an XR analysis visualization
   * @param config XR analysis configuration
   * @returns Promise with XR analysis result or undefined
   */
  static async createXRVisualization(config: XRAnalysisConfig): Promise<XRAnalysisResult | undefined> {
    const { directoryPath, filters, isProject, context, previousResult, modeLabel } = config;
    
    try {
      console.log(`🔍 Creating ${modeLabel} XR visualization for: ${directoryPath}`);
      
      // Close existing panel and server if they exist
      await this.cleanupExistingXR(directoryPath);
      
      // Generate analysis data
      const analysisResult = await this.generateXRAnalysisData({
        directoryPath,
        filters,
        context,
        previousResult,
        modeLabel
      });
      
      if (!analysisResult) {
        vscode.window.showErrorMessage(`Failed to analyze directory for ${modeLabel} XR visualization`);
        return undefined;
      }
      
      // Create visualization directory structure
      const visualizationDir = await this.createXRVisualizationFolder(
        context, 
        directoryPath, 
        analysisResult,
        modeLabel
      );
      if (!visualizationDir) {
        return undefined;
      }
      
      // Copy XR template and assets
      await this.copyXRAssets(context, visualizationDir, analysisResult);
      
      // Start server for XR visualization
      const serverInfo = await this.startXRServer(visualizationDir, context, modeLabel);
      if (!serverInfo) {
        vscode.window.showErrorMessage(`Failed to start server for ${modeLabel} XR visualization`);
        return undefined;
      }
      
      // Track resources
      this.visualizationDirs.set(directoryPath, visualizationDir);
      this.activeServers.set(directoryPath, serverInfo);
      
      // Add to analysis session manager
      const sessionManager = AnalysisSessionManager.getInstance();
      const analysisMode = filters.maxDepth === 1 ? 'shallow' : 'deep';
      sessionManager.addSession(directoryPath, AnalysisType.DIRECTORY, serverInfo, { mode: analysisMode, visualizationType: 'xr' });
      
      // Open the XR visualization in external browser
      await vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
      
      const dirName = path.basename(directoryPath);
      vscode.window.showInformationMessage(
        `${modeLabel} XR Analysis opened in browser: ${dirName}`,
        { modal: false }
      );
      
      // Start directory watcher for hash-based automatic updates
      await this.startXRWatcher(directoryPath, analysisResult, isProject, filters);
      
      console.log(`✅ ${modeLabel} XR visualization created: ${visualizationDir}`);
      console.log(`🌐 XR Server running at: ${serverInfo.url}`);
      
      return {
        analysisResult,
        visualizationDir,
        serverInfo
      };
      
    } catch (error) {
      console.error(`Error creating ${modeLabel} XR visualization:`, error);
      vscode.window.showErrorMessage(`${modeLabel} XR visualization error: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }
  
  /**
   * Generates XR analysis data using the incremental analysis engine
   */
  private static async generateXRAnalysisData(config: {
    directoryPath: string;
    filters: DirectoryAnalysisFilters;
    context: vscode.ExtensionContext;
    previousResult?: DirectoryAnalysisResult;
    modeLabel: string;
  }): Promise<DirectoryAnalysisResult | undefined> {
    const { directoryPath, filters, context, previousResult, modeLabel } = config;
    
    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `${modeLabel} XR Analysis`,
      cancellable: true
    }, async (progress, token) => {
      
      // Check if this is initial analysis
      const isInitial = isInitialAnalysis(previousResult);
      
      // Log analysis start
      logAnalysisStart('xr', directoryPath, isInitial);
      
      // Set up progress callback
      const progressCallback = isInitial 
        ? createNotificationProgressCallback(progress, 'xr', true)
        : (current: number, total: number, currentFile: string) => {
            if (token.isCancellationRequested) {
              throw new Error(`${modeLabel} XR analysis cancelled by user`);
            }
            
            progress.report({
              increment: (1 / total) * 100,
              message: `Re-analyzing changes: ${path.basename(currentFile)}`
            });
          };
      
      try {
        const startTime = Date.now();
        
        console.log(`DIRECTORY-ANALYSIS: Starting ${modeLabel} XR analysis using shared incremental engine`);
        
        // Create incremental analysis engine
        const engine = new IncrementalAnalysisEngine();
        
        // Configure analysis
        const engineConfig: IncrementalAnalysisConfig = {
          directoryPath,
          filters,
          previousResult,
          progressCallback,
          outputChannel: {
            appendLine: (message: string) => console.log(`${modeLabel.toUpperCase()}-XR-ANALYSIS: ${message}`)
          }
        };
        
        // Perform incremental analysis
        const incrementalResult = await engine.performIncrementalAnalysis(engineConfig);
        
        // Transform to files array for XR visualization
        const filesData = transformToFilesArray(incrementalResult);
        
        // Create result compatible with existing code
        const result: DirectoryAnalysisResult = {
          summary: {
            directoryPath,
            totalFiles: incrementalResult.scanResult.totalFiles,
            totalFilesAnalyzed: incrementalResult.scanResult.totalAnalyzableFiles,
            totalFilesNotAnalyzed: incrementalResult.scanResult.totalNonAnalyzableFiles,
            totalLines: filesData.reduce((sum, f) => sum + f.totalLines, 0),
            totalCommentLines: filesData.reduce((sum, f) => sum + f.commentLines, 0),
            totalFunctions: filesData.reduce((sum, f) => sum + f.functionCount, 0),
            totalClasses: filesData.reduce((sum, f) => sum + f.classCount, 0),
            averageComplexity: filesData.length > 0 
              ? filesData.reduce((sum, f) => sum + f.meanComplexity, 0) / filesData.length 
              : 0,
            averageDensity: filesData.length > 0 
              ? filesData.reduce((sum, f) => sum + f.meanDensity, 0) / filesData.length 
              : 0,
            averageParameters: filesData.length > 0 
              ? filesData.reduce((sum, f) => sum + f.meanParameters, 0) / filesData.length 
              : 0,
            languageDistribution: this.calculateLanguageDistribution(filesData),
            fileSizeDistribution: this.calculateFileSizeDistribution(filesData),
            complexityDistribution: this.calculateComplexityDistribution(filesData),
            analyzedAt: new Date().toISOString(),
            totalDuration: Date.now() - startTime
          },
          files: filesData,
          functions: incrementalResult.allFunctions,
          metadata: {
            version: '1.0.0',
            mode: 'directory',
            filters: {
              maxDepth: filters.maxDepth,
              excludePatterns: filters.excludePatterns
            },
            filesAnalyzedThisSession: incrementalResult.filesAnalyzedThisSession,
            totalFilesConsidered: incrementalResult.totalFilesConsidered,
            isIncremental: incrementalResult.isIncremental
          }
        };
        
        // Log completion
        logAnalysisComplete('xr', directoryPath, result.summary.totalFilesAnalyzed, result.summary.totalFiles, isInitial, result.summary.totalDuration);
        
        return result;
        
      } catch (error) {
        console.error(`Error during ${modeLabel} XR analysis:`, error);
        if (token.isCancellationRequested) {
          throw new vscode.CancellationError();
        }
        throw error;
      }
    });
  }
  
  /**
   * Starts XR watcher for automatic updates
   */
  private static async startXRWatcher(
    directoryPath: string,
    initialResult: DirectoryAnalysisResult,
    isProject: boolean,
    filters: DirectoryAnalysisFilters
  ): Promise<void> {
    const sharedWatcherManager = SharedDirectoryWatcherManager.getInstance();
    
    const watcherOptions: DirectoryWatcherOptions = {
      mode: 'xr',
      includeSubdirectories: filters.maxDepth > 1,
      isProject,
      onAnalysisComplete: async (newResult: DirectoryAnalysisResult) => {
        console.log(`🔄 XR watcher analysis complete, updating visualization...`);
        
        const serverInfo = this.activeServers.get(directoryPath);
        if (serverInfo) {
          console.log(`📡 Notifying XR clients of data refresh via SSE`);
          notifyClientsDataRefresh();
        }
      },
      onAnalysisError: (error: Error) => {
        console.error(`❌ XR watcher analysis error:`, error);
        vscode.window.showErrorMessage(`XR re-analysis failed: ${error.message}`);
      }
    };
    
    console.log(`👁️ Starting XR watcher for ${directoryPath} (mode: ${watcherOptions.mode})`);
    sharedWatcherManager.startWatching(directoryPath, watcherOptions, initialResult);
  }
  
  /**
   * Helper methods for calculating distributions
   */
  private static calculateLanguageDistribution(files: any[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    for (const file of files) {
      distribution[file.language] = (distribution[file.language] || 0) + 1;
    }
    return distribution;
  }
  
  private static calculateFileSizeDistribution(files: any[]): any {
    return {
      small: files.filter(f => f.fileSizeBytes < 1024).length,
      medium: files.filter(f => f.fileSizeBytes >= 1024 && f.fileSizeBytes < 10240).length,
      large: files.filter(f => f.fileSizeBytes >= 10240 && f.fileSizeBytes < 102400).length,
      huge: files.filter(f => f.fileSizeBytes >= 102400).length
    };
  }
  
  private static calculateComplexityDistribution(files: any[]): any {
    return {
      low: files.filter(f => f.meanComplexity <= 5).length,
      medium: files.filter(f => f.meanComplexity > 5 && f.meanComplexity <= 10).length,
      high: files.filter(f => f.meanComplexity > 10 && f.meanComplexity <= 20).length,
      critical: files.filter(f => f.meanComplexity > 20).length
    };
  }
  
  /**
   * Cleanup and utility methods - implement core XR functionality
   */
  
  private static async cleanupExistingXR(directoryPath: string): Promise<void> {
    try {
      // Stop any existing watcher
      const sharedWatcherManager = SharedDirectoryWatcherManager.getInstance();
      sharedWatcherManager.stopWatching(directoryPath);
      
      // Stop any existing server
      const existingServer = this.activeServers.get(directoryPath);
      if (existingServer) {
        console.log(`🛑 Stopping existing XR server for: ${directoryPath}`);
        stopServer(existingServer.id);
        this.activeServers.delete(directoryPath);
      }
      
      // Clean up visualization directory reference
      this.visualizationDirs.delete(directoryPath);
      
    } catch (error) {
      console.warn('Error during XR cleanup:', error);
    }
  }
  
  /**
   * Clean up XR visualization resources for a specific directory
   * Called when analysis session is closed
   */
  static async cleanupXRVisualization(directoryPath: string): Promise<void> {
    console.log(`🧹 Cleaning up XR visualization resources for: ${directoryPath}`);
    
    try {
      // Stop watcher
      const sharedWatcherManager = SharedDirectoryWatcherManager.getInstance();
      sharedWatcherManager.stopWatching(directoryPath);
      
      // Stop and remove server
      const existingServer = this.activeServers.get(directoryPath);
      if (existingServer) {
        console.log(`🛑 Stopping XR server: ${existingServer.id}`);
        stopServer(existingServer.id);
        this.activeServers.delete(directoryPath);
      }
      
      // Clean up visualization directory reference
      this.visualizationDirs.delete(directoryPath);
      
      console.log(`✅ XR visualization cleanup complete for: ${directoryPath}`);
      
    } catch (error) {
      console.warn(`⚠️ Error during XR visualization cleanup for ${directoryPath}:`, error);
    }
  }
  
  private static async createXRVisualizationFolder(
    context: vscode.ExtensionContext,
    directoryPath: string,
    analysisResult: DirectoryAnalysisResult,
    modeLabel: string
  ): Promise<string | undefined> {
    try {
      // Create unique visualization directory
      const dirName = path.basename(directoryPath);
      const timestamp = Date.now();
      const visualizationDir = path.join(
        context.globalStorageUri.fsPath,
        'visualizations',
        'xr',
        `${dirName}_${timestamp}`
      );
      
      // Ensure directory exists
      await fs.mkdir(visualizationDir, { recursive: true });
      
      console.log(`📁 Created XR visualization directory: ${visualizationDir}`);
      return visualizationDir;
      
    } catch (error) {
      console.error(`Error creating XR visualization folder:`, error);
      vscode.window.showErrorMessage(`Failed to create XR visualization folder: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }
  
  private static async copyXRAssets(
    context: vscode.ExtensionContext,
    visualizationDir: string,
    analysisResult: DirectoryAnalysisResult
  ): Promise<void> {
    try {
      // Write analysis data
      const dataFilePath = path.join(visualizationDir, 'data.json');
      await fs.writeFile(dataFilePath, JSON.stringify(analysisResult.files, null, 2));
      
      // Copy XR template files
      const templatePath = path.join(context.extensionPath, 'templates', 'xr');
      const templateFiles = ['index.html', 'xr-scene.js', 'style.css'];
      
      for (const fileName of templateFiles) {
        try {
          const sourcePath = path.join(templatePath, fileName);
          const targetPath = path.join(visualizationDir, fileName);
          
          // Read template content
          let content = await fs.readFile(sourcePath, 'utf8');
          
          // Inject live reload if needed
          if (fileName === 'index.html') {
            content = injectLiveReloadScript(content);
          }
          
          await fs.writeFile(targetPath, content);
        } catch (err) {
          console.warn(`Warning: Could not copy ${fileName}:`, err);
        }
      }
      
      console.log(`📋 Copied XR assets to: ${visualizationDir}`);
      
    } catch (error) {
      console.error('Error copying XR assets:', error);
      throw error;
    }
  }
  
  private static async startXRServer(
    visualizationDir: string,
    context: vscode.ExtensionContext,
    modeLabel: string
  ): Promise<ServerInfo | undefined> {
    try {
      // Use HTTP mode for simplicity in the shared manager
      const serverInfo = await createServer(
        visualizationDir,
        ServerMode.HTTP,
        context
      );
      
      if (serverInfo) {
        // Set analysis file name for XR directory analysis to enable proper icon/formatting in Active Servers
        // Extract directory name from the visualization directory path
        const visualizationDirName = path.basename(visualizationDir);
        const dirName = visualizationDirName.split('_')[0]; // Remove timestamp suffix
        updateServerDisplayInfo(serverInfo.id, {
          analysisFileName: `DIR:${dirName}` // Prefix to distinguish directory from file analysis
        });
        
        console.log(`🌐 Started XR server at: ${serverInfo.url}`);
        return serverInfo;
      } else {
        throw new Error('Server creation returned undefined');
      }
      
    } catch (error) {
      console.error('Error starting XR server:', error);
      vscode.window.showErrorMessage(`Failed to start XR server: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }
}
