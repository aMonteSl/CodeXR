import path from 'path';
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

  // ✅ NUEVO: Trackear archivos que están siendo analizados
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
   * @param panel WebView panel or null to clear
   */
  public setActiveFileAnalysisPanel(filePath: string, panel: any): void {
    if (panel === null) {
      // Limpiar referencia
      console.log(`🗑️ Clearing panel reference for ${path.basename(filePath)}`);
      this.fileAnalysisPanels.delete(filePath);
    } else {
      // Establecer nueva referencia
      console.log(`📄 Storing panel reference for ${path.basename(filePath)}`);
      this.fileAnalysisPanels.set(filePath, panel);
    }
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
   * ✅ NUEVA FUNCIÓN: Marcar un archivo como "siendo analizado"
   * Mark a file as being analyzed
   * @param filePath Path to the file being analyzed
   */
  public setFileAnalyzing(filePath: string): void {
    console.log(`🔄 Marking file as being analyzed: ${path.basename(filePath)}`);
    this.filesBeingAnalyzed.add(filePath);
    
    // Refresh tree to show the indicator
    this.refreshTreeView();
  }

  /**
   * ✅ NUEVA FUNCIÓN: Marcar un archivo como "análisis completado"
   * Mark a file as analysis completed
   * @param filePath Path to the file
   */
  public setFileAnalyzed(filePath: string): void {
    console.log(`✅ Marking file analysis as completed: ${path.basename(filePath)}`);
    this.filesBeingAnalyzed.delete(filePath);
    
    // Refresh tree to remove the indicator
    this.refreshTreeView();
  }

  /**
   * ✅ NUEVA FUNCIÓN: Verificar si un archivo está siendo analizado
   * Check if a file is currently being analyzed
   * @param filePath Path to the file
   * @returns True if file is being analyzed
   */
  public isFileBeingAnalyzed(filePath: string): boolean {
    return this.filesBeingAnalyzed.has(filePath);
  }

  /**
   * ✅ NUEVA FUNCIÓN: Obtener lista de archivos siendo analizados
   * Get list of files currently being analyzed
   * @returns Array of file paths being analyzed
   */
  public getFilesBeingAnalyzed(): string[] {
    return Array.from(this.filesBeingAnalyzed);
  }

  /**
   * ✅ HELPER: Refrescar tree view
   * Refresh the tree view to show changes
   */
  private refreshTreeView(): void {
    // Usar setTimeout para evitar múltiples refreshes simultáneos
    setTimeout(() => {
      if ((global as any).treeDataProvider) {
        (global as any).treeDataProvider.refresh();
      }
    }, 100);
  }

  /**
   * Remove data for a specific file
   * @param filePath Path to the file to remove
   */
  public removeFile(filePath: string): void {
    console.log(`🗑️ Removing all data for file: ${path.basename(filePath)}`);
    
    // Dispose panel if it exists
    const panel = this.fileAnalysisPanels.get(filePath);
    if (panel && typeof panel.dispose === 'function') {
      try {
        panel.dispose();
      } catch (error) {
        console.warn(`⚠️ Error disposing panel: ${error}`);
      }
    }
    
    this.analysisResults.delete(filePath);
    this.fileAnalysisPanels.delete(filePath);
    this.functionAnalysisPanels.delete(filePath);
    this.functionData.delete(filePath);
    
    // ✅ LIMPIAR TAMBIÉN EL ESTADO DE ANÁLISIS
    this.filesBeingAnalyzed.delete(filePath);
    
    console.log(`✅ File data cleanup completed for ${path.basename(filePath)}`);
  }

  /**
   * Clear all stored data and dispose of all panels
   */
  public clear(): void {
    console.log('🧹 Clearing all analysis data...');
    
    // Dispose all active panels
    for (const [filePath, panel] of this.fileAnalysisPanels.entries()) {
      if (panel && typeof panel.dispose === 'function') {
        try {
          panel.dispose();
          console.log(`🗑️ Disposed panel for ${path.basename(filePath)}`);
        } catch (error) {
          console.warn(`⚠️ Error disposing panel for ${path.basename(filePath)}: ${error}`);
        }
      }
    }
    
    // Dispose all function panels
    for (const [filePath, panel] of this.functionAnalysisPanels.entries()) {
      if (panel && typeof panel.dispose === 'function') {
        try {
          panel.dispose();
          console.log(`🗑️ Disposed function panel for ${path.basename(filePath)}`);
        } catch (error) {
          console.warn(`⚠️ Error disposing function panel for ${path.basename(filePath)}: ${error}`);
        }
      }
    }
    
    // Clear all maps and sets
    this.analysisResults.clear();
    this.fileAnalysisPanels.clear();
    this.functionAnalysisPanels.clear();
    this.functionData.clear();
    this.filesBeingAnalyzed.clear(); // ✅ LIMPIAR ARCHIVOS SIENDO ANALIZADOS
    
    console.log('✅ All analysis data cleared successfully');
  }

  /**
   * ✅ NUEVA FUNCIÓN: Obtener estadísticas del manager
   * Get manager statistics for debugging
   * @returns Object with current state information
   */
  public getManagerStatus(): {
    analysisResults: number;
    activePanels: number;
    functionPanels: number;
    functionData: number;
    filesBeingAnalyzed: number; // ✅ AÑADIR STAT DE ARCHIVOS SIENDO ANALIZADOS
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
   * ✅ NEW: Clear all stored data (for cleanup)
   */
  public clearAllData(): void {
    console.log('🧹 Clearing all analysis data...');
    
    // Clear analysis results
    this.analysisResults.clear();
    
    // Clear active panels
    for (const [filePath, panel] of this.fileAnalysisPanels) {
      if (panel && typeof panel.dispose === 'function') {
        try {
          panel.dispose();
          console.log(`🗑️ Disposed panel for ${path.basename(filePath)}`);
        } catch (error) {
          console.warn(`⚠️ Error disposing panel for ${path.basename(filePath)}: ${error}`);
        }
      }
    }
    this.fileAnalysisPanels.clear();
    
    // Clear function panels
    for (const [filePath, panel] of this.functionAnalysisPanels) {
      if (panel && typeof panel.dispose === 'function') {
        try {
          panel.dispose();
          console.log(`🗑️ Disposed function panel for ${path.basename(filePath)}`);
        } catch (error) {
          console.warn(`⚠️ Error disposing function panel for ${path.basename(filePath)}: ${error}`);
        }
      }
    }
    this.functionAnalysisPanels.clear();
    
    // Clear function data
    this.functionData.clear();
    
    // Clear files being analyzed
    this.filesBeingAnalyzed.clear();
    
    console.log('✅ All analysis data cleared successfully');
    
    // Refresh tree view
    this.refreshTreeView();
  }
}

// Export the singleton instance
export const analysisDataManager = AnalysisDataManager.getInstance();