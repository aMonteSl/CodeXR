import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { FileAnalysisResult } from '../model';
import { analyzeFileStatic } from '../static/index';
import { generateNonce } from '../../utils/nonceUtils';

/**
 * Shared analysis utilities for both Static and XR analysis modes
 * This module contains common logic that was previously duplicated
 */

/**
 * Performs file analysis and creates visualization directory with data.json
 * @param filePath Path to the file to analyze
 * @param context VS Code extension context
 * @returns Object containing analysis result and visualization directory path
 */
export async function createAnalysisVisualization(
  filePath: string,
  context: vscode.ExtensionContext
): Promise<{ analysisResult: FileAnalysisResult; visualizationDir: string } | undefined> {
  try {
    console.log(`🔍 Starting analysis for: ${filePath}`);
    
    // Perform the actual file analysis (shared between static and XR)
    const analysisResult = await analyzeFileStatic(filePath, context);
    if (!analysisResult) {
      vscode.window.showErrorMessage('Failed to analyze file');
      return undefined;
    }
    
    const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
    const nonce = generateNonce();
    
    // Create visualization directory
    const visualizationsDir = path.join(context.extensionPath, 'visualizations');
    
    try {
      await fs.mkdir(visualizationsDir, { recursive: true });
    } catch (e) {
      // Directory exists, continue
    }
    
    const visualizationDir = path.join(
      visualizationsDir,
      `${fileNameWithoutExt}_${nonce}`
    );
    
    await fs.mkdir(visualizationDir, { recursive: true });
    console.log(`📁 Created visualization directory: ${visualizationDir}`);
    
    // Save analysis data as JSON
    const dataFilePath = path.join(visualizationDir, 'data.json');
    await fs.writeFile(dataFilePath, JSON.stringify(analysisResult, null, 2));
    console.log(`💾 Saved analysis data: ${dataFilePath}`);
    
    return { analysisResult, visualizationDir };
    
  } catch (error) {
    console.error('Error creating analysis visualization:', error);
    vscode.window.showErrorMessage(`Analysis error: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

/**
 * Copies static analysis template and assets to visualization directory
 * @param context VS Code extension context
 * @param visualizationDir Target directory for the files
 */
export async function copyStaticAnalysisAssets(
  context: vscode.ExtensionContext,
  visualizationDir: string
): Promise<void> {
  try {
    // Copy the HTML template
    const templatePath = path.join(context.extensionPath, 'templates', 'analysis', 'fileAnalysis.html');
    const htmlPath = path.join(visualizationDir, 'index.html');
    await fs.copyFile(templatePath, htmlPath);
    console.log(`📄 Copied HTML template: ${htmlPath}`);
    
    // Copy CSS file
    const cssSourcePath = path.join(context.extensionPath, 'media', 'analysis', 'fileAnalysisstyle.css');
    const cssDestPath = path.join(visualizationDir, 'fileAnalysisstyle.css');
    await fs.copyFile(cssSourcePath, cssDestPath);
    console.log(`🎨 Copied CSS file: ${cssDestPath}`);
    
    // Copy JS file
    const jsSourcePath = path.join(context.extensionPath, 'media', 'analysis', 'fileAnalysismain.js');
    const jsDestPath = path.join(visualizationDir, 'fileAnalysismain.js');
    await fs.copyFile(jsSourcePath, jsDestPath);
    console.log(`⚡ Copied JS file: ${jsDestPath}`);
    
  } catch (error) {
    console.error('Error copying static analysis assets:', error);
    throw error;
  }
}

/**
 * Updates existing visualization data.json with new analysis results
 * @param visualizationDir Path to the visualization directory
 * @param analysisResult New analysis results
 */
export async function updateVisualizationData(
  visualizationDir: string,
  analysisResult: FileAnalysisResult
): Promise<void> {
  try {
    const dataFilePath = path.join(visualizationDir, 'data.json');
    await fs.writeFile(dataFilePath, JSON.stringify(analysisResult, null, 2));
    console.log(`🔄 Updated analysis data: ${dataFilePath}`);
  } catch (error) {
    console.error('Error updating visualization data:', error);
    throw error;
  }
}
