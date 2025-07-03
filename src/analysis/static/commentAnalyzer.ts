import * as vscode from 'vscode';
import * as path from 'path';
import { getPythonExecutable, getVenvPath } from '../../pythonEnv/utils/pathUtils';
import { executeCommand } from '../../pythonEnv/utils/processUtils';
import { resolveAnalyzerScriptPath, isSupportedExtension } from '../utils/analysisUtils';

/**
 * Comment analyzer for extracting comment statistics from code files
 */

/**
 * Analyzes comments in a file using the appropriate analyzer
 */
export async function analyzeComments(
  filePath: string,
  outputChannel: vscode.OutputChannel
): Promise<number> {
  try {
    const ext = path.extname(filePath).toLowerCase();
    
    if (!isSupportedExtension(ext)) {
      outputChannel.appendLine(`Skipping comment analysis for unsupported file type: ${ext}`);
      return 0;
    }
    
    outputChannel.appendLine(`[DEBUG] Starting comment analysis for ${filePath} with extension ${ext}`);
    
    // Verify that virtual environment and Python exist
    const venvPath = getVenvPath();
    if (!venvPath) {
      outputChannel.appendLine('[ERROR] No virtual environment found');
      return 0;
    }
    
    const pythonPath = getPythonExecutable(venvPath);
    outputChannel.appendLine(`[DEBUG] Using Python executable: ${pythonPath}`);
    
    const scriptPath = resolveAnalyzerScriptPath('python_comment_analyzer.py', outputChannel);
    outputChannel.appendLine(`[DEBUG] Using analyzer script: ${scriptPath}`);

    // Log file content preview for debugging
    try {
      const fs = require('fs');
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      const preview = fileContent.split('\n').slice(0, 3).join('\n');
      outputChannel.appendLine(`[DEBUG] File preview (first 3 lines): ${preview}`);
    } catch (e) {
      outputChannel.appendLine(`[DEBUG] Could not read file for preview: ${e}`);
    }
    
    // Execute the Python analyzer
    const output = await executeCommand(
      pythonPath,
      [scriptPath, filePath],
      { showOutput: false }
    );

    outputChannel.appendLine(`[DEBUG] Raw output from Python script: ${output}`);

    let result;
    try {
      result = JSON.parse(output);
      outputChannel.appendLine(`[DEBUG] Parsed result: ${JSON.stringify(result)}`);
    } catch (jsonError) {
      outputChannel.appendLine(`[ERROR] Failed to parse JSON output: ${jsonError}`);
      outputChannel.appendLine(`[ERROR] Raw output: ${output}`);
      return 0;
    }
    
    if (result.error) {
      outputChannel.appendLine(`Warning: ${result.error}`);
      return 0;
    }

    outputChannel.appendLine(`Found ${result.commentLines} comment lines in ${path.basename(filePath)} (${ext})`);
    return result.commentLines;
  } catch (error) {
    outputChannel.appendLine(`[ERROR] Error analyzing comments: ${error instanceof Error ? error.message : String(error)}`);
    outputChannel.appendLine(`[ERROR] Stack trace: ${error instanceof Error ? error.stack : 'No stack trace available'}`);
    return 0;
  }
}
