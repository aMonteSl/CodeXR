import { FileAnalysisResult } from './model';

/**
 * Simple singleton manager to store and retrieve analysis data across views
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
   * @param filePath Path to the analyzed file
   * @param result Analysis result
   */
  public setAnalysisResult(filePath: string, result: FileAnalysisResult): void {
    this.analysisResults.set(filePath, result);
  }

  /**
   * Get the analysis result for a specific file
   * @param filePath Path to the analyzed file
   * @returns Analysis result or null if not found
   */
  public getAnalysisResult(filePath: string): FileAnalysisResult | null {
    return this.analysisResults.get(filePath) || null;
  }
  
  /**
   * Get all stored analysis results
   * @returns Map of file paths to analysis results
   */
  public getAllAnalysisResults(): Map<string, FileAnalysisResult> {
    return this.analysisResults;
  }

  /**
   * Store reference to active file analysis panel for a specific file
   * @param filePath Path to the analyzed file
   * @param panel WebView panel
   */
  public setActiveFileAnalysisPanel(filePath: string, panel: any): void {
    this.fileAnalysisPanels.set(filePath, panel);
  }

  /**
   * Get active file analysis panel for a specific file
   * @param filePath Path to the analyzed file
   * @returns Panel or null if not found
   */
  public getActiveFileAnalysisPanel(filePath: string): any {
    return this.fileAnalysisPanels.get(filePath) || null;
  }
  
  /**
   * Get all active file analysis panels
   * @returns Map of file paths to panels
   */
  public getAllFileAnalysisPanels(): Map<string, any> {
    return this.fileAnalysisPanels;
  }

  /**
   * Store reference to active function analysis panel for a specific file
   * @param filePath Path to the analyzed file
   * @param panel WebView panel
   */
  public setActiveFunctionAnalysisPanel(filePath: string, panel: any): void {
    this.functionAnalysisPanels.set(filePath, panel);
  }

  /**
   * Get active function analysis panel for a specific file
   * @param filePath Path to the analyzed file
   * @returns Panel or null if not found
   */
  public getActiveFunctionAnalysisPanel(filePath: string): any {
    return this.functionAnalysisPanels.get(filePath) || null;
  }

  /**
   * Store function data for a specific file
   * @param filePath Path to the analyzed file
   * @param data Function data
   */
  public setFunctionData(filePath: string, data: any): void {
    this.functionData.set(filePath, data);
  }

  /**
   * Get function data for a specific file
   * @param filePath Path to the analyzed file
   * @returns Function data or null if not found
   */
  public getFunctionData(filePath: string): any {
    return this.functionData.get(filePath) || null;
  }

  /**
   * Clear function data for a specific file
   * @param filePath Path to the analyzed file
   */
  public clearFunctionData(filePath: string): void {
    this.functionData.delete(filePath);
  }

  /**
   * Remove data for a specific file
   * @param filePath Path to the file to remove
   */
  public removeFile(filePath: string): void {
    this.analysisResults.delete(filePath);
    this.fileAnalysisPanels.delete(filePath);
    this.functionAnalysisPanels.delete(filePath);
    this.functionData.delete(filePath);
  }

  /**
   * Clear all stored data
   */
  public clear(): void {
    this.analysisResults.clear();
    this.fileAnalysisPanels.clear();
    this.functionAnalysisPanels.clear();
    this.functionData.clear();
  }
}

// Export the singleton instance
export const analysisDataManager = AnalysisDataManager.getInstance();