/**
 * Shared utilities for analysis tree item icons and formatting
 * Centralizes the logic for determining icons and display formatting for analyses
 */

import * as vscode from 'vscode';
import { AnalysisType, AnalysisSession } from '../analysisSessionManager';

/**
 * Get the appropriate icon for an analysis session
 * @param session Analysis session
 * @returns VS Code theme icon with appropriate color
 */
export function getAnalysisIcon(session: AnalysisSession): vscode.ThemeIcon {
  switch (session.analysisType) {
    case AnalysisType.XR:
      // 📄 Purple file icon for XR File analysis
      return new vscode.ThemeIcon('file-code', new vscode.ThemeColor('charts.purple'));
      
    case AnalysisType.STATIC:
      // 📄 Green file icon for Static File analysis
      return new vscode.ThemeIcon('file-code', new vscode.ThemeColor('charts.green'));
      
    case AnalysisType.DOM:
      return new vscode.ThemeIcon('browser', new vscode.ThemeColor('charts.orange'));
      
    case AnalysisType.DIRECTORY:
      // Determine if this is XR or Static directory analysis based on metadata
      const isXRDirectory = session.metadata?.visualizationType === 'xr';
      
      if (isXRDirectory) {
        // 📁 Purple folder icon for XR Directory analysis
        return new vscode.ThemeIcon('folder', new vscode.ThemeColor('charts.purple'));
      } else {
        // 📁 Green folder icon for Static Directory analysis
        return new vscode.ThemeIcon('folder', new vscode.ThemeColor('charts.green'));
      }
      
    default:
      return new vscode.ThemeIcon('file-code');
  }
}

/**
 * Get description text for an analysis session
 * @param session Analysis session
 * @returns Description string
 */
export function getAnalysisDescription(session: AnalysisSession): string {
  let description = `${session.analysisType} Analysis`;
  
  if (session.analysisType === AnalysisType.DIRECTORY && session.metadata?.mode === 'deep') {
    description = `${session.analysisType} Analysis (deep)`;
  }
  
  return description;
}

/**
 * Determine if an analysis session is XR-based
 * @param session Analysis session
 * @returns true if XR analysis, false otherwise
 */
export function isXRAnalysis(session: AnalysisSession): boolean {
  return session.analysisType === AnalysisType.XR || 
         (session.analysisType === AnalysisType.DIRECTORY && session.metadata?.visualizationType === 'xr');
}

/**
 * Server display formatting utilities
 */
export namespace ServerDisplayUtils {
  
  /**
   * Format server display name for XR analysis servers
   * @param analysisFileName Analysis file name (may have DIR: prefix for directories)
   * @param port Server port
   * @returns Formatted display name
   */
  export function formatXRServerDisplayName(analysisFileName: string, port: number): string {
    if (analysisFileName.startsWith('DIR:')) {
      // Directory XR analysis: show directoryName: port (no extra emoji or parentheses)
      const dirName = analysisFileName.substring(4); // Remove 'DIR:' prefix
      return `${dirName}: ${port}`;
    } else {
      // File XR analysis: show filename: port (existing format)
      return `${analysisFileName}: ${port}`;
    }
  }
  
  /**
   * Check if server is XR analysis server
   * @param analysisFileName Analysis file name from server info
   * @returns true if XR analysis server
   */
  export function isXRAnalysisServer(analysisFileName?: string): boolean {
    return analysisFileName !== undefined;
  }
}
