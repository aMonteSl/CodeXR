import * as vscode from 'vscode';
import * as path from 'path';
import { DirectoryAnalysisResult } from '../directoryAnalysisModel';
import { DirectoryAnalysisManager } from '../directoryAnalysisManager';
import { AnalysisFilters } from '../../utils/scanUtils'; // Import the correct type
import { 
  DirectoryAnalysisOptions, 
  DirectoryAnalysisFilters,
  DEFAULT_SHALLOW_FILTERS,
  DEFAULT_DEEP_FILTERS,
  AnalysisMode
} from './directoryAnalysisConfig';
import { createDirectoryVisualization, updateDirectoryVisualization } from '../directoryVisualizationManager';
import { directoryWatchManager } from '../../../watchers/directoryWatchManager';
import { loadPreviousDirectoryAnalysis, saveDirectoryAnalysisResult } from '../../../shared/directoryAnalysisDataManager';
import { 
  createNotificationProgressCallback, 
  logAnalysisStart, 
  logAnalysisComplete, 
  isInitialAnalysis 
} from '../../../shared/directoryAnalysisProgress';

/**
 * Shared service for directory analysis operations
 * Handles both shallow and deep directory analysis
 */
export class DirectoryAnalysisService {
  private static instance: DirectoryAnalysisService;

  private constructor() {}

  public static getInstance(): DirectoryAnalysisService {
    if (!DirectoryAnalysisService.instance) {
      DirectoryAnalysisService.instance = new DirectoryAnalysisService();
    }
    return DirectoryAnalysisService.instance;
  }

  /**
   * Performs directory analysis based on the specified options
   */
  public async analyzeDirectory(
    context: vscode.ExtensionContext,
    directoryPath: string,
    options: DirectoryAnalysisOptions,
    isProject: boolean = false
  ): Promise<DirectoryAnalysisResult | undefined> {
    try {
      const mode = options.recursive ? 'deep' : 'shallow';
      const filters = this.getFiltersForMode(mode, options.filters);
      
      console.log(`🔍 Starting ${mode} directory analysis: ${directoryPath}`);
      console.log(`📊 Analysis options:`, options);
      console.log(`📊 Analysis filters:`, filters);
      
      // Start progress indicator
      const progressOptions = {
        location: vscode.ProgressLocation.Notification,
        title: `CodeXR: Analyzing ${mode === 'deep' ? 'directory (deep)' : 'directory'}`,
        cancellable: false
      };
      
      return await vscode.window.withProgress(progressOptions, async (progress) => {
        const startTime = Date.now();
        
        progress.report({ message: `Scanning ${directoryPath}...` });
        
        // Load previous analysis data if available
        let previousResult: DirectoryAnalysisResult | undefined;
        let dataPath: string | undefined;
        
        try {
          const previousData = await loadPreviousDirectoryAnalysis({
            context,
            directoryPath,
            mode: mode === 'deep' ? 'deep' : 'static',
            isProject
          });
          
          previousResult = previousData.previousResult;
          dataPath = previousData.dataPath;
          
          if (previousResult) {
            console.log(`DIRECTORY-ANALYSIS: ${mode.toUpperCase()} Using previous analysis data for incremental scanning`);
          }
        } catch (error) {
          console.warn(`DIRECTORY-ANALYSIS: ${mode.toUpperCase()} Could not load previous analysis data: ${error}`);
        }
        
        // Determine if this is initial analysis
        const isInitial = isInitialAnalysis(previousResult);
        
        // Log analysis start
        logAnalysisStart(mode, directoryPath, isInitial);
        
        // Perform the analysis with progress reporting
        const manager = new DirectoryAnalysisManager();
        
        // Set up standardized progress callback
        const progressCallback = createNotificationProgressCallback(progress, mode === 'deep' ? 'deep' : 'static', isInitial);
        manager.setProgressCallback(progressCallback);
        
        const result = await manager.analyzeDirectory(directoryPath, filters, previousResult);
        
        // Clear the progress callback
        manager.clearProgressCallback();
        
        // Log analysis completion
        const duration = Date.now() - startTime;
        const filesAnalyzed = result.metadata.filesAnalyzedThisSession || result.summary.totalFilesAnalyzed;
        const totalFiles = result.metadata.totalFilesConsidered || result.summary.totalFiles;
        logAnalysisComplete(mode, directoryPath, filesAnalyzed, totalFiles, isInitial, duration);
        
        // Save the analysis result if we have a data path
        if (dataPath) {
          try {
            const saveMode = mode === 'deep' ? 'deep' : 'static';
            await saveDirectoryAnalysisResult(result, dataPath, saveMode);
          } catch (error) {
            console.warn(`⚠️ Could not save analysis result: ${error}`);
          }
        }
        
        progress.report({ message: 'Creating visualization...' });
        
        // Create visualization
        const visualizationDir = await createDirectoryVisualization(
          context, 
          directoryPath, 
          result, 
          isProject,
          mode
        );
        
        if (visualizationDir) {
          // Start watching for changes
          await this.setupDirectoryWatcher(directoryPath, mode, isProject, result);
          
          const fileCount = result.summary.totalFilesAnalyzed;
          const modeLabel = mode === 'deep' ? 'deep' : 'shallow';
          console.log(`✅ ${modeLabel} directory analysis completed: ${fileCount} files analyzed`);
          
          // Show completion message
          vscode.window.showInformationMessage(
            `CodeXR: Directory analysis completed (${fileCount} files analyzed)`
          );
        }
        
        return result;
      });
      
    } catch (error) {
      console.error(`Error during ${options.recursive ? 'deep' : 'shallow'} directory analysis:`, error);
      vscode.window.showErrorMessage(
        `Directory analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return undefined;
    }
  }

  /**
   * Updates an existing directory analysis
   */
  public async updateDirectoryAnalysis(
    directoryPath: string,
    mode: AnalysisMode,
    previousResult?: DirectoryAnalysisResult
  ): Promise<DirectoryAnalysisResult | undefined> {
    try {
      const filters = this.getFiltersForMode(mode);
      
      console.log(`🔄 Updating ${mode} directory analysis: ${directoryPath}`);
      
      const manager = new DirectoryAnalysisManager();
      
      // Set up progress callback for updates too
      manager.setProgressCallback((current: number, total: number, currentFile: string) => {
        // For updates, we'll use the output channel instead of a progress bar
        // to avoid interrupting the user's workflow
        const fileName = path.basename(currentFile);
        console.log(`🔄 Re-analyzing: ${fileName} [${current}/${total}]`);
      });
      
      const result = await manager.analyzeDirectory(directoryPath, filters, previousResult);
      
      // Clear the progress callback
      manager.clearProgressCallback();
      
      // Update the visualization
      await updateDirectoryVisualization(directoryPath, result);
      
      console.log(`✅ ${mode} directory analysis updated: ${result.summary.totalFilesAnalyzed} files`);
      return result;
      
    } catch (error) {
      console.error(`Error updating ${mode} directory analysis:`, error);
      return undefined;
    }
  }

  /**
   * Sets up directory watcher for the specified mode
   */
  private async setupDirectoryWatcher(
    directoryPath: string,
    mode: AnalysisMode,
    isProject: boolean,
    result: DirectoryAnalysisResult
  ): Promise<void> {
    try {
      // Stop any existing watcher for this directory
      if (directoryWatchManager.isWatching(directoryPath)) {
        directoryWatchManager.stopWatching(directoryPath);
      }
      
      // Start new watcher with the analysis result
      directoryWatchManager.startWatching(directoryPath, result, isProject, mode);
      
      // Store the analysis mode for this directory
      this.setAnalysisModeForDirectory(directoryPath, mode);
      
      console.log(`👁️ Started ${mode} directory watcher: ${directoryPath}`);
      
    } catch (error) {
      console.error('Error setting up directory watcher:', error);
    }
  }

  /**
   * Gets the appropriate filters for the analysis mode
   */
  private getFiltersForMode(mode: AnalysisMode, customFilters?: DirectoryAnalysisFilters): AnalysisFilters {
    const baseFilters = mode === 'deep' ? DEFAULT_DEEP_FILTERS : DEFAULT_SHALLOW_FILTERS;
    
    // Convert DirectoryAnalysisFilters to AnalysisFilters
    const mergedFilters = customFilters ? { ...baseFilters, ...customFilters } : baseFilters;
    
    const result: AnalysisFilters = {
      maxDepth: mergedFilters.maxDepth,
      excludePatterns: mergedFilters.excludePatterns,
      maxFileSize: mergedFilters.maxFileSize
    };
    
    console.log(`🔧 Converting filters for ${mode} mode:`, result);
    return result;
  }

  /**
   * Stores the analysis mode for a directory (for watcher use)
   */
  private setAnalysisModeForDirectory(directoryPath: string, mode: AnalysisMode): void {
    // Store in a simple map for now - this could be enhanced with persistence later
    if (!this.directoryModes) {
      this.directoryModes = new Map();
    }
    this.directoryModes.set(directoryPath, mode);
  }

  /**
   * Gets the analysis mode for a directory
   */
  public getAnalysisModeForDirectory(directoryPath: string): AnalysisMode {
    return this.directoryModes?.get(directoryPath) || 'shallow';
  }

  private directoryModes?: Map<string, AnalysisMode>;
}

export const directoryAnalysisService = DirectoryAnalysisService.getInstance();
