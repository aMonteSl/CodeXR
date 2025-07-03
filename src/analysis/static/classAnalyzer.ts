import * as vscode from 'vscode';
import * as path from 'path';
import { getPythonExecutable, getVenvPath } from '../../pythonEnv/utils/pathUtils';
import { executeCommand } from '../../pythonEnv/utils/processUtils';
import { resolveAnalyzerScriptPath, isSupportedExtension } from '../utils/analysisUtils';

/**
 * Class analyzer for extracting class count statistics from code files
 */

/**
 * Analyzes class declarations in a file
 */
export async function analyzeClassCount(
  filePath: string,
  outputChannel: vscode.OutputChannel
): Promise<number> {
  try {
    const ext = path.extname(filePath).toLowerCase();
    
    if (!isSupportedExtension(ext)) {
      outputChannel.appendLine(`Skipping class analysis for unsupported file type: ${ext}`);
      return 0;
    }
    
    outputChannel.appendLine(`[DEBUG] Starting class analysis for ${filePath} with extension ${ext}`);
    
    // Verify that virtual environment and Python exist
    const venvPath = getVenvPath();
    if (!venvPath) {
      outputChannel.appendLine('[ERROR] No virtual environment found');
      return 0;
    }
    
    const pythonPath = getPythonExecutable(venvPath);
    const scriptPath = resolveAnalyzerScriptPath('class_counter_analyzer.py', outputChannel);
    
    // Execute the Python analyzer
    const output = await executeCommand(
      pythonPath,
      [scriptPath, filePath],
      { showOutput: false }
    );

    outputChannel.appendLine(`[DEBUG] Raw output from class analyzer: ${output}`);

    let result;
    try {
      result = JSON.parse(output);
      outputChannel.appendLine(`[DEBUG] Parsed class analysis result: ${JSON.stringify(result)}`);
    } catch (jsonError) {
      outputChannel.appendLine(`[ERROR] Failed to parse JSON output: ${jsonError}`);
      outputChannel.appendLine(`[ERROR] Raw output: ${output}`);
      return 0;
    }
    
    if (result.error) {
      outputChannel.appendLine(`Warning: ${result.error}`);
      return 0;
    }

    const classCount = result.classCount || 0;
    outputChannel.appendLine(`Found ${classCount} classes in ${path.basename(filePath)} (${ext})`);
    return classCount;
    
  } catch (error) {
    outputChannel.appendLine(`[ERROR] Error analyzing classes: ${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }
}
