import { FileAnalysisResult } from '../model';

/**
 * Singleton manager for storing and retrieving analysis data across different views and components
 */
class AnalysisDataManager {
  private static instance: AnalysisDataManager;
  
  // Track analysis results by file path
  private analysisResults: Map<string, FileAnalysisResult> = new Map();
  
  // Track analysis panels by file path
  private fileAnalysisPanels: Map<string, any> = new Map();
  
  // Track function analysis panels by file path
  private functionAnalysisPanels: Map<string, any> = new Map();
  
  // Track function data by file path
  private functionData: Map<string, any> = new Map();

  // Track files that are currently being analyzed
  private filesBeingAnalyzed: Set<string> = new Set();

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): AnalysisDataManager {
    if (!this.instance) {
      this.instance = new AnalysisDataManager();
    }
    return this.instance;
  }

  /**
   * Store analysis result for a specific file
   */
  public setAnalysisResult(filePath: string, result: FileAnalysisResult): void {
    this.analysisResults.set(filePath, result);
  }

  /**
   * Get the analysis result for a specific file
   */
  public getAnalysisResult(filePath: string): FileAnalysisResult | null {
    return this.analysisResults.get(filePath) || null;
  }
  
  /**
   * Get all stored analysis results
   */
  public getAllAnalysisResults(): Map<string, FileAnalysisResult> {
    return this.analysisResults;
  }

  /**
   * Store reference to active file analysis panel for a specific file
   */
  public setActiveFileAnalysisPanel(filePath: string, panel: any): void {
    if (panel === null) {
      this.fileAnalysisPanels.delete(filePath);
    } else {
      this.fileAnalysisPanels.set(filePath, panel);
    }
  }

  /**
   * Get active file analysis panel for a specific file
   */
  public getActiveFileAnalysisPanel(filePath: string): any {
    return this.fileAnalysisPanels.get(filePath) || null;
  }
  
  /**
   * Get all active file analysis panels
   */
  public getAllFileAnalysisPanels(): Map<string, any> {
    return this.fileAnalysisPanels;
  }

  /**
   * Store reference to active function analysis panel for a specific file
   */
  public setActiveFunctionAnalysisPanel(filePath: string, panel: any): void {
    if (panel === null) {
      this.functionAnalysisPanels.delete(filePath);
    } else {
      this.functionAnalysisPanels.set(filePath, panel);
    }
  }

  /**
   * Get active function analysis panel for a specific file
   */
  public getActiveFunctionAnalysisPanel(filePath: string): any {
    return this.functionAnalysisPanels.get(filePath) || null;
  }

  /**
   * Store function data for a specific file
   */
  public setFunctionData(filePath: string, data: any): void {
    this.functionData.set(filePath, data);
  }

  /**
   * Get function data for a specific file
   */
  public getFunctionData(filePath: string): any {
    return this.functionData.get(filePath) || null;
  }

  /**
   * Remove analysis result for a specific file
   */
  public clearAnalysisResult(filePath: string): void {
    this.analysisResults.delete(filePath);
    console.log(`🗑️ Cleared analysis result for: ${filePath}`);
  }

  /**
   * Clear function data for a specific file
   */
  public clearFunctionData(filePath: string): void {
    this.functionData.delete(filePath);
    console.log(`🗑️ Cleared function data for: ${filePath}`);
  }

  /**
   * Mark a file as being analyzed
   */
  public setFileAnalyzing(filePath: string): void {
    this.filesBeingAnalyzed.add(filePath);
    this.refreshTreeView();
  }

  /**
   * Mark a file as no longer being analyzed
   */
  public setFileAnalyzed(filePath: string): void {
    this.filesBeingAnalyzed.delete(filePath);
    this.refreshTreeView();
  }

  /**
   * Check if a file is currently being analyzed
   */
  public isFileBeingAnalyzed(filePath: string): boolean {
    return this.filesBeingAnalyzed.has(filePath);
  }

  /**
   * Get list of files currently being analyzed
   */
  public getFilesBeingAnalyzed(): string[] {
    return Array.from(this.filesBeingAnalyzed);
  }

  /**
   * Get analysis statistics
   */
  public getAnalysisStats(): {
    totalAnalyzedFiles: number;
    totalAnalysisPanels: number;
    totalFunctionPanels: number;
    filesBeingAnalyzed: number;
  } {
    return {
      totalAnalyzedFiles: this.analysisResults.size,
      totalAnalysisPanels: this.fileAnalysisPanels.size,
      totalFunctionPanels: this.functionAnalysisPanels.size,
      filesBeingAnalyzed: this.filesBeingAnalyzed.size
    };
  }

  /**
   * Gets the current status of the analysis data manager
   */
  public getManagerStatus(): {
    analysisResults: number;
    activePanels: number;
    functionPanels: number;
    functionData: number;
    filesBeingAnalyzed: number;
  } {
    return {
      analysisResults: this.analysisResults.size,
      activePanels: this.fileAnalysisPanels.size,
      functionPanels: this.functionAnalysisPanels.size,
      functionData: this.functionData.size,
      filesBeingAnalyzed: this.filesBeingAnalyzed.size
    };
  }

  /**
   * Clear all stored data (for cleanup)
   */
  public clearAllData(): void {
    this.analysisResults.clear();
    this.fileAnalysisPanels.clear();
    this.functionAnalysisPanels.clear();
    this.functionData.clear();
    this.filesBeingAnalyzed.clear();
  }

  /**
   * Refresh the tree view to show changes
   */
  private refreshTreeView(): void {
    // Use setTimeout to avoid multiple simultaneous refreshes
    setTimeout(() => {
      if ((global as any).treeDataProvider) {
        (global as any).treeDataProvider.refresh();
      }
    }, 100);
  }
}

// Export the singleton instance
export const analysisDataManager = AnalysisDataManager.getInstance();
