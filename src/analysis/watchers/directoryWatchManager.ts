import * as vscode from 'vscode';
import * as path from 'path';
import { debounce } from '../../utils/debounceUtils';
import { DirectoryAnalysisManager } from '../static/directory/directoryAnalysisManager';
import { DirectoryAnalysisResult } from '../static/directory/directoryAnalysisModel';
import { createDirectoryVisualization, getOpenPanel, updateDirectoryVisualization } from '../static/directory/directoryVisualizationManager';
import { DEFAULT_FILTERS } from '../static/utils/scanUtils';
import { DEFAULT_SHALLOW_FILTERS, DEFAULT_DEEP_FILTERS } from '../static/directory/common/directoryAnalysisConfig';

/**
 * Manages directory watchers for automatic re-analysis on file changes
 */
export class DirectoryWatchManager {
  private static instance: DirectoryWatchManager | undefined;
  private context: vscode.ExtensionContext | undefined;
  
  // Store directory watchers by directory path
  private directoryWatchers: Map<string, vscode.Disposable> = new Map();
  
  // Track latest analysis results for change detection
  private lastAnalysisResults: Map<string, DirectoryAnalysisResult> = new Map();
  
  // Track whether directories are project-level analysis
  private isProjectAnalysis: Map<string, boolean> = new Map();
  
  // Track analysis modes for directories (shallow vs deep)
  private analysisMode: Map<string, 'shallow' | 'deep'> = new Map();
  
  // Debounced re-analysis functions
  private debouncedAnalysisFunctions: Map<string, (() => void)> = new Map();
  
  // Status bar management
  private statusMessages: Map<string, vscode.Disposable> = new Map();
  private countdownIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  // Configuration
  private debounceDelay: number = 2000; // Default to 2 seconds
  private autoAnalysisEnabled: boolean = true; // Default to enabled

  /**
   * Gets the singleton instance
   */
  static getInstance(): DirectoryWatchManager {
    if (!DirectoryWatchManager.instance) {
      DirectoryWatchManager.instance = new DirectoryWatchManager();
    }
    return DirectoryWatchManager.instance;
  }

  /**
   * Initializes the directory watch manager
   */
  initialize(context: vscode.ExtensionContext): void {
    console.log(`RE-ANALYSIS: DirectoryWatchManager.initialize() called`);
    this.context = context;
    this.loadConfiguration();
    
    // Listen for configuration changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('codexr.analysis')) {
          console.log(`RE-ANALYSIS: Configuration changed, reloading settings`);
          this.loadConfiguration();
          this.updateAllDebounceFunctions();
        }
      })
    );
    
    console.log(`RE-ANALYSIS: DirectoryWatchManager initialized successfully`);
  }

  /**
   * Loads configuration from VS Code settings
   */
  private loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration();
    const oldDelay = this.debounceDelay;
    const oldEnabled = this.autoAnalysisEnabled;
    
    this.debounceDelay = config.get<number>('codexr.analysis.debounceDelay', 2000);
    this.autoAnalysisEnabled = config.get<boolean>('codexr.analysis.autoAnalysis', true);
    
    console.log(`📊 DirectoryWatchManager loaded config: debounceDelay=${this.debounceDelay}ms, autoAnalysis=${this.autoAnalysisEnabled}`);
    console.log(`RE-ANALYSIS: Configuration loaded - debounceDelay: ${oldDelay}ms -> ${this.debounceDelay}ms, autoAnalysis: ${oldEnabled} -> ${this.autoAnalysisEnabled}`);
  }

  /**
   * Updates all debounce functions with new delay
   */
  private updateAllDebounceFunctions(): void {
    for (const [directoryPath] of this.directoryWatchers) {
      this.createDebouncedAnalysisFunction(directoryPath);
    }
  }

  /**
   * Creates a debounced analysis function for a directory
   */
  private createDebouncedAnalysisFunction(directoryPath: string): void {
    console.log(`RE-ANALYSIS: Creating debounced analysis function for ${directoryPath} with ${this.debounceDelay}ms delay`);
    
    const debouncedFunction = debounce(async () => {
      console.log(`RE-ANALYSIS: Debounce timer expired, starting re-analysis for ${directoryPath}`);
      
      if (!this.autoAnalysisEnabled) {
        console.log(`RE-ANALYSIS: Auto-analysis is disabled, skipping re-analysis for ${directoryPath}`);
        return;
      }

      try {
        // Clear countdown and show analyzing message
        this.clearStatusMessage(directoryPath);
        const dirName = path.basename(directoryPath);
        const analyzingMessage = vscode.window.setStatusBarMessage(
          `$(sync~spin) CodeXR: Re-analyzing ${dirName}/ now...`
        );
        this.statusMessages.set(directoryPath, analyzingMessage);

        console.log(`🔄 Auto-analyzing directory: ${directoryPath}`);
        console.log(`RE-ANALYSIS: Starting DirectoryAnalysisManager.analyzeDirectory for ${directoryPath}`);
        
        const manager = new DirectoryAnalysisManager();
        const previousResult = this.lastAnalysisResults.get(directoryPath);
        const isProject = this.isProjectAnalysis.get(directoryPath) || false;
        const mode = this.analysisMode.get(directoryPath) || 'shallow';
        
        console.log(`RE-ANALYSIS: Analysis config - isProject: ${isProject}, mode: ${mode}, hasPreviousResult: ${!!previousResult}`);
        
        // Get appropriate filters based on analysis mode
        const filters = mode === 'deep' ? DEFAULT_DEEP_FILTERS : DEFAULT_SHALLOW_FILTERS;
        
        // Perform incremental analysis using previous result for optimization
        const result = await manager.analyzeDirectory(directoryPath, filters, previousResult);
        
        console.log(`RE-ANALYSIS: Analysis completed for ${directoryPath}, total files: ${result.summary.totalFilesAnalyzed}`);
        
        // Update stored result
        this.lastAnalysisResults.set(directoryPath, result);
        
        // Check if panel is open and refresh it
        const existingPanel = getOpenPanel(directoryPath);
        if (existingPanel) {
          console.log(`🔄 Panel is open for ${directoryPath}, updating visualization...`);
          console.log(`RE-ANALYSIS: Updating existing panel visualization for ${directoryPath}`);
          // Update the existing panel with new data (preserves scroll position)
          await updateDirectoryVisualization(directoryPath, result);
          console.log(`✅ Directory visualization update completed for ${directoryPath}`);
          console.log(`RE-ANALYSIS: Panel update completed for ${directoryPath}`);
        } else if (this.context) {
          console.log(`📝 No open panel for ${directoryPath}, creating new visualization...`);
          console.log(`RE-ANALYSIS: Creating new visualization for ${directoryPath}`);
          // Create new visualization if no panel is open but context is available
          await createDirectoryVisualization(this.context, directoryPath, result, isProject);
        } else {
          console.log(`⚠️ No panel and no context for ${directoryPath}`);
          console.log(`RE-ANALYSIS: No panel or context available for ${directoryPath}`);
        }
        
        // Clear analyzing message and show completion
        this.clearStatusMessage(directoryPath);
        const completionMessage = vscode.window.setStatusBarMessage(
          `$(check) CodeXR: ${dirName}/ re-analysis completed (${result.summary.totalFilesAnalyzed} files)`
        );
        this.statusMessages.set(directoryPath, completionMessage);
        
        console.log(`RE-ANALYSIS: Re-analysis completed successfully for ${directoryPath}`);
        
        // Clear completion message after 3 seconds
        setTimeout(() => {
          this.clearStatusMessage(directoryPath);
        }, 3000);
        
      } catch (error) {
        console.error('Error during auto directory analysis:', error);
        console.log(`RE-ANALYSIS: Error during re-analysis for ${directoryPath}: ${error instanceof Error ? error.message : String(error)}`);
        
        // Clear analyzing message and show error
        this.clearStatusMessage(directoryPath);
        const errorMessage = vscode.window.setStatusBarMessage(
          `$(error) CodeXR: Directory analysis failed`
        );
        this.statusMessages.set(directoryPath, errorMessage);
        
        // Clear error message after 5 seconds
        setTimeout(() => {
          this.clearStatusMessage(directoryPath);
        }, 5000);
        
        vscode.window.showErrorMessage(
          `Auto directory analysis failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }, this.debounceDelay);

    this.debouncedAnalysisFunctions.set(directoryPath, debouncedFunction);
    console.log(`RE-ANALYSIS: Debounced analysis function created and stored for ${directoryPath}`);
  }

  /**
   * Starts watching a directory for file changes
   */
  startWatching(
    directoryPath: string, 
    initialResult: DirectoryAnalysisResult, 
    isProject: boolean = false,
    mode: 'shallow' | 'deep' = 'shallow'
  ): void {
    console.log(`RE-ANALYSIS: DirectoryWatchManager.startWatching() called for ${directoryPath} (mode: ${mode})`);
    console.log(`RE-ANALYSIS: Is project analysis: ${isProject}`);
    console.log(`RE-ANALYSIS: Auto-analysis enabled: ${this.autoAnalysisEnabled}`);
    console.log(`RE-ANALYSIS: Debounce delay: ${this.debounceDelay}ms`);
    
    // Stop any existing watcher for this directory
    this.stopWatching(directoryPath);

    console.log(`👁️ Starting directory watch (${mode}): ${directoryPath}`);

    // Store the initial analysis result, project flag, and mode
    this.lastAnalysisResults.set(directoryPath, initialResult);
    this.isProjectAnalysis.set(directoryPath, isProject);
    this.analysisMode.set(directoryPath, mode);

    // Create debounced analysis function
    this.createDebouncedAnalysisFunction(directoryPath);

    // Create file watcher pattern based on mode
    const pattern = mode === 'deep' 
      ? new vscode.RelativePattern(directoryPath, '**/*') // Recursive pattern
      : new vscode.RelativePattern(directoryPath, '*');   // Shallow pattern
    
    console.log(`RE-ANALYSIS: File watcher pattern: ${pattern.pattern} (base: ${pattern.baseUri?.fsPath || 'none'})`);
    
    // Create file system watcher
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    // Handle file creation
    watcher.onDidCreate(uri => {
      console.log(`📁➕ File created in watched directory (${mode}): ${uri.fsPath}`);
      console.log(`RE-ANALYSIS: File creation detected - triggering analysis`);
      this.triggerAnalysis(directoryPath);
    });

    // Handle file changes
    watcher.onDidChange(uri => {
      console.log(`📁✏️ File changed in watched directory (${mode}): ${uri.fsPath}`);
      console.log(`RE-ANALYSIS: File change detected - triggering analysis`);
      this.triggerAnalysis(directoryPath);
    });

    // Handle file deletion
    watcher.onDidDelete(uri => {
      console.log(`📁🗑️ File deleted in watched directory (${mode}): ${uri.fsPath}`);
      console.log(`RE-ANALYSIS: File deletion detected - triggering analysis`);
      this.triggerAnalysis(directoryPath);
    });

    // Store the watcher
    this.directoryWatchers.set(directoryPath, watcher);

    // Add to context subscriptions if available
    if (this.context) {
      this.context.subscriptions.push(watcher);
    }

    console.log(`RE-ANALYSIS: DirectoryWatchManager successfully initialized for ${directoryPath}`);
  }

  /**
   * Triggers debounced analysis for a directory
   */
  private triggerAnalysis(directoryPath: string): void {
    console.log(`RE-ANALYSIS: DirectoryWatchManager.triggerAnalysis() called for ${directoryPath}`);
    
    if (!this.autoAnalysisEnabled) {
      console.log(`RE-ANALYSIS: Auto-analysis is disabled, skipping re-analysis for ${directoryPath}`);
      return;
    }

    const debouncedFunction = this.debouncedAnalysisFunctions.get(directoryPath);
    if (debouncedFunction) {
      console.log(`RE-ANALYSIS: Found debounced function for ${directoryPath}, triggering with ${this.debounceDelay}ms delay`);
      // Show countdown status message
      this.updateStatusMessage(directoryPath, '', true);
      debouncedFunction();
    } else {
      console.log(`RE-ANALYSIS: No debounced function found for ${directoryPath}`);
    }
  }

  /**
   * Stops watching a directory
   */
  stopWatching(directoryPath: string): void {
    console.log(`RE-ANALYSIS: DirectoryWatchManager.stopWatching() called for ${directoryPath}`);
    
    const watcher = this.directoryWatchers.get(directoryPath);
    if (watcher) {
      console.log(`👁️❌ Stopping directory watch: ${directoryPath}`);
      console.log(`RE-ANALYSIS: Disposing watcher for ${directoryPath}`);
      watcher.dispose();
      this.directoryWatchers.delete(directoryPath);
    } else {
      console.log(`RE-ANALYSIS: No active watcher found for ${directoryPath}`);
    }

    // Clean up status messages
    this.clearStatusMessage(directoryPath);

    // Clean up stored data
    this.lastAnalysisResults.delete(directoryPath);
    this.isProjectAnalysis.delete(directoryPath);
    this.debouncedAnalysisFunctions.delete(directoryPath);
    
    console.log(`RE-ANALYSIS: Cleanup completed for ${directoryPath}`);
  }

  /**
   * Stops all directory watchers
   */
  stopAllWatchers(): void {
    console.log('🛑 Stopping all directory watchers');
    
    for (const [directoryPath] of this.directoryWatchers) {
      this.stopWatching(directoryPath);
    }
  }

  /**
   * Gets all watched directories
   */
  getWatchedDirectories(): string[] {
    return Array.from(this.directoryWatchers.keys());
  }

  /**
   * Checks if a directory is being watched
   */
  isWatching(directoryPath: string): boolean {
    return this.directoryWatchers.has(directoryPath);
  }

  /**
   * Gets the latest analysis result for a directory
   */
  getLatestResult(directoryPath: string): DirectoryAnalysisResult | undefined {
    return this.lastAnalysisResults.get(directoryPath);
  }

  /**
   * Updates the debounce delay and recreates debounced functions
   */
  setDebounceDelay(delay: number): void {
    this.debounceDelay = delay;
    this.updateAllDebounceFunctions();
  }

  /**
   * Enables or disables auto-analysis
   */
  setAutoAnalysisEnabled(enabled: boolean): void {
    this.autoAnalysisEnabled = enabled;
  }

  /**
   * Updates status message for a directory with countdown
   */
  private updateStatusMessage(directoryPath: string, message: string, showCountdown: boolean = false): void {
    // Clear existing message and countdown
    this.clearStatusMessage(directoryPath);
    
    if (showCountdown) {
      // Start countdown display
      this.startCountdownDisplay(directoryPath, this.debounceDelay);
    } else {
      // Set simple message
      const statusMessage = vscode.window.setStatusBarMessage(message);
      this.statusMessages.set(directoryPath, statusMessage);
      
      // Clear the message after 3 seconds
      setTimeout(() => {
        this.clearStatusMessage(directoryPath);
      }, 3000);
    }
  }

  /**
   * Starts countdown display for a directory
   */
  private startCountdownDisplay(directoryPath: string, totalTime: number): void {
    const dirName = path.basename(directoryPath);
    const startTime = Date.now();
    let lastDisplayedSeconds = Math.ceil(totalTime / 1000);
    
    // Initial status message
    const initialMessage = vscode.window.setStatusBarMessage(
      `$(clock) CodeXR: Re-analyzing ${dirName}/ in ${lastDisplayedSeconds}s...`
    );
    this.statusMessages.set(directoryPath, initialMessage);
    
    // Start countdown interval (update every 100ms for smooth countdown)
    const countdownInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, totalTime - elapsed);
      const remainingSeconds = Math.ceil(remaining / 1000);
      
      // Update display only when seconds change
      if (remainingSeconds !== lastDisplayedSeconds && remaining > 0) {
        lastDisplayedSeconds = remainingSeconds;
        
        // Clear previous message
        if (this.statusMessages.has(directoryPath)) {
          this.statusMessages.get(directoryPath)?.dispose();
        }
        
        // Create progress bar effect
        const progress = Math.round(((totalTime - remaining) / totalTime) * 10);
        const progressBar = '█'.repeat(progress) + '░'.repeat(10 - progress);
        
        // Show updated countdown with progress bar
        const countdownMessage = vscode.window.setStatusBarMessage(
          `$(sync~spin) CodeXR: ${dirName}/ re-analysis in ${remainingSeconds}s ${progressBar}`
        );
        this.statusMessages.set(directoryPath, countdownMessage);
      }
      
      // Clear countdown when time is up
      if (remaining <= 0) {
        clearInterval(countdownInterval);
        this.countdownIntervals.delete(directoryPath);
        
        // Show "analyzing now" message
        if (this.statusMessages.has(directoryPath)) {
          this.statusMessages.get(directoryPath)?.dispose();
        }
        
        const analyzingMessage = vscode.window.setStatusBarMessage(
          `$(microscope) CodeXR: Re-analyzing ${dirName}/ now...`
        );
        this.statusMessages.set(directoryPath, analyzingMessage);
      }
    }, 100); // Update every 100ms for smooth countdown
    
    this.countdownIntervals.set(directoryPath, countdownInterval);
  }

  /**
   * Clears status message and countdown for a directory
   */
  private clearStatusMessage(directoryPath: string): void {
    // Clear countdown interval
    if (this.countdownIntervals.has(directoryPath)) {
      clearInterval(this.countdownIntervals.get(directoryPath)!);
      this.countdownIntervals.delete(directoryPath);
    }
    
    // Clear status message
    if (this.statusMessages.has(directoryPath)) {
      this.statusMessages.get(directoryPath)?.dispose();
      this.statusMessages.delete(directoryPath);
    }
  }

  /**
   * Disposes all resources
   */
  dispose(): void {
    this.stopAllWatchers();
    
    // Clear all status messages
    for (const [directoryPath] of this.statusMessages) {
      this.clearStatusMessage(directoryPath);
    }
    
    DirectoryWatchManager.instance = undefined;
  }
}

// Export singleton instance
export const directoryWatchManager = DirectoryWatchManager.getInstance();
