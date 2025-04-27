import * as vscode from 'vscode';
import * as path from 'path';
import { getPythonExecutable, venvExists, getVenvPath } from '../pythonEnv/utils/pathUtils';
import { executeCommand } from '../pythonEnv/utils/processUtils';
import { setupPythonEnvironment } from '../pythonEnv/commands';
import { FunctionInfo, ComplexityMetrics } from './model';

/**
 * Checks if lizard is available in the Python environment
 * @returns True if lizard is available
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
 * @param outputChannel Output channel for logs
 * @returns Whether lizard is available
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
 * @param filePath Path to the file to analyze
 * @param outputChannel Output channel for logs
 * @returns Object containing functions and metrics, or undefined on error
 */
export async function analyzeLizard(
  filePath: string, 
  outputChannel: vscode.OutputChannel
): Promise<{functions: FunctionInfo[], metrics: ComplexityMetrics} | undefined> {
  // Ensure lizard is available
  const available = await ensureLizardAvailable(outputChannel);
  if (!available) {
    outputChannel.appendLine('Lizard is not available. Cannot perform advanced analysis.');
    return undefined;
  }
  
  const venvPath = getVenvPath();
  if (!venvPath) {
    outputChannel.appendLine('Python environment not found');
    return undefined;
  }
  
  const pythonPath = getPythonExecutable(venvPath);
  
  try {
    outputChannel.appendLine(`Running lizard analysis on ${path.basename(filePath)}...`);
    
    // FIXED: Use correct path resolution that doesn't depend on extension path
    // First try extension path, then fall back to direct path if needed
    let analyzerScriptPath = '';
    
    // Method 1: Try to get from extension
    try {
      const extPath = vscode.extensions.getExtension('codexr')?.extensionPath;
      if (extPath) {
        analyzerScriptPath = path.join(extPath, 'src', 'analysis', 'python', 'lizard_analyzer.py');
        // Verify file exists
        if (!require('fs').existsSync(analyzerScriptPath)) {
          analyzerScriptPath = ''; // Reset if not found
        }
      }
    } catch (e) {
      outputChannel.appendLine(`Extension path resolution failed: ${e}`);
    }
    
    // Method 2: Try to use __dirname-based path
    if (!analyzerScriptPath) {
      // Get directory of current file
      const currentDir = __dirname;
      // Navigate to project root and then to python dir
      analyzerScriptPath = path.join(currentDir, '..', 'analysis', 'python', 'lizard_analyzer.py');
    }
    
    // Method 3: Last resort - direct hardcoded path
    if (!require('fs').existsSync(analyzerScriptPath)) {
      analyzerScriptPath = '/home/adrian/CodeXR/src/analysis/python/lizard_analyzer.py';
    }
    
    outputChannel.appendLine(`Using analyzer script at: ${analyzerScriptPath}`);
    
    // Execute the Python script
    const output = await executeCommand(
      pythonPath,
      [analyzerScriptPath, filePath],
      { showOutput: false }
    );
    
    // Parse the JSON output
    const result = JSON.parse(output);
    
    if (result.status === 'error') {
      throw new Error(result.error || 'Unknown error running lizard analysis');
    }
    
    // Extract functions and metrics from the result
    const functions: FunctionInfo[] = result.functions || [];
    const metrics: ComplexityMetrics = result.metrics || {
      averageComplexity: 0,
      maxComplexity: 0,
      functionCount: 0,
      highComplexityFunctions: 0,
      criticalComplexityFunctions: 0
    };
    
    // Log some results
    outputChannel.appendLine(`Found ${functions.length} functions/methods`);
    
    // Apply the same fix to other analyzer calls
    return { functions, metrics };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`Error executing lizard analysis: ${errorMessage}`);
    
    // Return empty data structure rather than undefined
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
}