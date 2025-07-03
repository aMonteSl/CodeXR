import * as vscode from 'vscode';
import * as path from 'path';
import { FunctionInfo, ComplexityMetrics } from '../model';
import { getPythonExecutable, venvExists, getVenvPath } from '../../pythonEnv/utils/pathUtils';
import { executeCommand } from '../../pythonEnv/utils/processUtils';
import { setupPythonEnvironment } from '../../pythonEnv/commands';
import { resolveAnalyzerScriptPath } from '../utils';

/**
 * Lizard analyzer for extracting complexity metrics from code files
 */

/**
 * Checks if lizard is available in the Python environment
 */
export async function isLizardAvailable(): Promise<boolean> {
  if (!venvExists()) {
    return false;
  }
  
  const venvPath = getVenvPath();
  if (!venvPath) {
    return false;
  }
  
  const pythonPath = getPythonExecutable(venvPath);
  
  try {
    // Simple version check
    await executeCommand(pythonPath, ['-m', 'lizard', '--version']);
    return true;
  } catch (error) {
    console.error('Error checking lizard availability:', error);
    return false;
  }
}

/**
 * Ensures lizard is available, setting up if needed
 */
export async function ensureLizardAvailable(outputChannel: vscode.OutputChannel): Promise<boolean> {
  if (await isLizardAvailable()) {
    return true;
  }
  
  outputChannel.appendLine('Lizard not found. Setting up Python environment...');
  
  try {
    await setupPythonEnvironment(true);
    
    // Check again after setup
    return await isLizardAvailable();
  } catch (error) {
    outputChannel.appendLine(`Error setting up lizard: ${error}`);
    return false;
  }
}

/**
 * Runs lizard analysis on a file using our custom Python script
 */
export async function analyzeLizard(
  filePath: string, 
  outputChannel: vscode.OutputChannel
): Promise<{functions: FunctionInfo[], metrics: ComplexityMetrics} | undefined> {
  try {
    outputChannel.appendLine(`Starting Lizard analysis for: ${path.basename(filePath)}`);
    
    // Ensure lizard is available
    if (!(await ensureLizardAvailable(outputChannel))) {
      outputChannel.appendLine('❌ Lizard not available, skipping analysis');
      return undefined;
    }
    
    const venvPath = getVenvPath();
    if (!venvPath) {
      outputChannel.appendLine('❌ No virtual environment found');
      return undefined;
    }
    
    const pythonPath = getPythonExecutable(venvPath);
    let analyzerScriptPath = resolveAnalyzerScriptPath('lizard_analyzer.py', outputChannel);
    
    // Method 2: Try to use __dirname-based path
    if (!analyzerScriptPath || !require('fs').existsSync(analyzerScriptPath)) {
      // Get directory of current file
      const currentDir = __dirname;
      // Use the known working path directly
      const analyzerRelativePath = path.join(currentDir, '..', '..', '..', 'src', 'analysis', 'python', 'lizard_analyzer.py');
      
      if (require('fs').existsSync(analyzerRelativePath)) {
        analyzerScriptPath = analyzerRelativePath;
      }
    }
    
    // Method 3: Try to resolve from the workspace folders
    if (!analyzerScriptPath || !require('fs').existsSync(analyzerScriptPath)) {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        const workspacePath = path.join(workspaceFolder.uri.fsPath, 'src', 'analysis', 'python', 'lizard_analyzer.py');
        if (require('fs').existsSync(workspacePath)) {
          analyzerScriptPath = workspacePath;
        }
      }
    }
    
    if (!require('fs').existsSync(analyzerScriptPath)) {
      outputChannel.appendLine(`❌ Could not find lizard_analyzer.py script`);
      outputChannel.appendLine(`Last attempted path: ${analyzerScriptPath}`);
      return undefined;
    }
    
    outputChannel.appendLine(`✓ Using analyzer script: ${analyzerScriptPath}`);
    outputChannel.appendLine(`✓ Using Python: ${pythonPath}`);
    
    const output = await executeCommand(
      pythonPath,
      [analyzerScriptPath, filePath],
      { showOutput: false }
    );
    
    outputChannel.appendLine(`Raw lizard output: ${output.substring(0, 200)}...`);
    
    let result;
    try {
      result = JSON.parse(output);
    } catch (jsonError) {
      outputChannel.appendLine(`❌ Failed to parse Lizard JSON output: ${jsonError}`);
      outputChannel.appendLine(`Raw output: ${output}`);
      return undefined;
    }
    
    if (result.error) {
      outputChannel.appendLine(`❌ Lizard analysis error: ${result.error}`);
      return undefined;
    }
    
    if (!result.functions || !Array.isArray(result.functions)) {
      outputChannel.appendLine(`⚠️ No functions found in Lizard output`);
      return {
        functions: [],
        metrics: {
          averageComplexity: 0,
          maxComplexity: 0,
          functionCount: 0,
          highComplexityFunctions: 0,
          criticalComplexityFunctions: 0
        }
      };
    }
    
    const functions: FunctionInfo[] = result.functions.map((func: any) => ({
      name: func.name || 'Unknown',
      lineStart: func.lineStart || 0,
      lineEnd: func.lineEnd || 0,
      lineCount: func.lineCount || 0,
      complexity: func.complexity || 0,
      parameters: func.parameters || 0,  // Fixed: was func.parameter_count
      maxNestingDepth: func.maxNestingDepth || 0,
      cyclomaticDensity: func.cyclomaticDensity || 0  // Fixed: use value from Python script
    }));
    
    const metrics: ComplexityMetrics = result.metrics || {
      averageComplexity: 0,
      maxComplexity: 0,
      functionCount: functions.length,
      highComplexityFunctions: functions.filter(f => f.complexity > 10).length,
      criticalComplexityFunctions: functions.filter(f => f.complexity > 25).length
    };
    
    outputChannel.appendLine(`✅ Lizard analysis completed: ${functions.length} functions, avg complexity: ${metrics.averageComplexity}`);
    
    return { functions, metrics };
    
  } catch (error) {
    outputChannel.appendLine(`❌ Error during Lizard analysis: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}
