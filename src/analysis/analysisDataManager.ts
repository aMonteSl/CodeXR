import { FileAnalysisResult } from './model';

/**
 * Simple singleton manager to store and retrieve analysis data across views
 */
class AnalysisDataManager {
  private static instance: AnalysisDataManager;
  private latestAnalysisResult: FileAnalysisResult | null = null;
  private activeFileAnalysisPanel: any = null;
  private activeFunctionAnalysisPanel: any = null;
  private latestFunctionData: any = null;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): AnalysisDataManager {
    if (!AnalysisDataManager.instance) {
      AnalysisDataManager.instance = new AnalysisDataManager();
    }
    return AnalysisDataManager.instance;
  }

  /**
   * Store analysis result
   */
  public setAnalysisResult(result: FileAnalysisResult): void {
    this.latestAnalysisResult = result;
  }

  /**
   * Get the latest analysis result
   */
  public getAnalysisResult(): FileAnalysisResult | null {
    return this.latestAnalysisResult;
  }

  /**
   * Store reference to active file analysis panel
   */
  public setActiveFileAnalysisPanel(panel: any): void {
    this.activeFileAnalysisPanel = panel;
  }

  /**
   * Get active file analysis panel
   */
  public getActiveFileAnalysisPanel(): any {
    return this.activeFileAnalysisPanel;
  }

  /**
   * Store reference to active function analysis panel
   */
  public setActiveFunctionAnalysisPanel(panel: any): void {
    this.activeFunctionAnalysisPanel = panel;
  }

  /**
   * Get active function analysis panel
   */
  public getActiveFunctionAnalysisPanel(): any {
    return this.activeFunctionAnalysisPanel;
  }

  /**
   * Store function data
   */
  public setFunctionData(data: any): void {
    this.latestFunctionData = data;
  }

  /**
   * Get the latest function data
   */
  public getFunctionData(): any {
    return this.latestFunctionData;
  }

  /**
   * Clear all stored data
   */
  public clear(): void {
    this.latestAnalysisResult = null;
    this.activeFileAnalysisPanel = null;
    this.activeFunctionAnalysisPanel = null;
    this.latestFunctionData = null;
  }

  /**
   * Clear function analysis data only
   */
  public clearFunctionData(): void {
    this.activeFunctionAnalysisPanel = null;
    this.latestFunctionData = null;
  }
}

export const analysisDataManager = AnalysisDataManager.getInstance();