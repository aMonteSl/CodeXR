/**
 * Analysis Commands Module
 * 
 * This module contains all command handlers specifically related to file analysis operations.
 * These commands are exported and registered by the main command registration system.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { analyzeFile } from '../analysisManager';
import { analysisDataManager } from '../utils/dataManager';
import { getLanguageName } from '../../utils/languageUtils';

/**
 * Checks if a file type is supported for analysis
 * @param language Language/file type
 * @returns true if supported
 */
export function isSupportedFileType(language: string): boolean {
  const supportedTypes = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C', 'C++', 'C#', 
    'Ruby', 'Go', 'PHP', 'Swift', 'Kotlin', 'Rust', 'HTML', 'Vue',
    'Scala', 'Lua', 'Erlang', 'Zig', 'Perl', 'Solidity', 'TTCN-3',
    'Objective-C', 'Objective-C++', 'Fortran', 'GDScript'
  ];
  
  return supportedTypes.includes(language);
}

/**
 * Analyzes a file and handles result display
 * This is the core analysis function used by various command handlers
 */
export async function executeFileAnalysis(
  filePath: string, 
  context: vscode.ExtensionContext,
  showPanel: boolean = true
): Promise<boolean> {
  const language = getLanguageName(filePath);
  
  if (!isSupportedFileType(language)) {
    vscode.window.showWarningMessage(`File type not supported for analysis: ${language}`);
    return false;
  }
  
  // Show progress
  return await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Analyzing file...',
    cancellable: false
  }, async (progress) => {
    progress.report({ increment: 0, message: path.basename(filePath) });
    
    // Perform analysis
    const result = await analyzeFile(filePath, context);
    
    if (result) {
      // Store result
      analysisDataManager.setAnalysisResult(filePath, result);
      
      // Show analysis results panel if requested
      if (showPanel) {
        await vscode.commands.executeCommand('codexr.updateAnalysisPanel', result);
      }
      
      // Show success message
      vscode.window.showInformationMessage(`Analysis complete: ${path.basename(filePath)}`);
      
      // Refresh tree view
      vscode.commands.executeCommand('codexr.refreshView');
      
      return true;
    }
    
    return false;
  });
}

/**
 * Executes XR (3D) analysis for a file
 */
export async function executeXRAnalysis(
  filePath: string,
  context: vscode.ExtensionContext
): Promise<void> {
  const language = getLanguageName(filePath);
  
  if (!isSupportedFileType(language)) {
    vscode.window.showWarningMessage(`File type not supported for XR analysis: ${language}`);
    return;
  }
  
  // Show progress and perform XR analysis
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Creating XR Analysis...',
    cancellable: false
  }, async (progress) => {
    progress.report({ increment: 0, message: path.basename(filePath) });
    
    // Import XR analysis manager
    const { createXRVisualization } = await import('../xr/xrAnalysisManager.js');
    
    // First analyze the file to get the analysis result
    const analysisResult = await analyzeFile(filePath, context);
    
    if (!analysisResult) {
      throw new Error('Failed to analyze file for XR visualization');
    }
    
    // Create XR visualization
    await createXRVisualization(context, analysisResult);
    
    vscode.window.showInformationMessage(`XR Analysis created for ${path.basename(filePath)}`);
  });
}

/**
 * Routes to appropriate analysis based on user's mode preference
 */
export async function executeAnalysisWithModeCheck(
  fileUri: vscode.Uri,
  context: vscode.ExtensionContext
): Promise<void> {
  // Get the user's preferred analysis mode
  const config = vscode.workspace.getConfiguration('codexr');
  const analysisMode = config.get<string>('analysisMode', 'XR');
  
  const filePath = fileUri.fsPath;
  
  // Route to appropriate analysis command based on mode
  if (analysisMode === 'XR') {
    await executeXRAnalysis(filePath, context);
  } else {
    await executeFileAnalysis(filePath, context, true);
  }
}
