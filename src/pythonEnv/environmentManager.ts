import * as vscode from 'vscode';
import * as fs from 'fs';
import { executeCommand } from './utils/processUtils';
import { 
  getVenvPath, 
  getPythonExecutable, 
  getPipExecutable, 
  venvExists,
  executableExists
} from './utils/pathUtils';
import { 
  PythonEnvironmentInfo, 
  PythonEnvironmentStatus 
} from './models/environmentModel';

/**
 * Gets the path to the system Python executable
 * @returns Path to the system Python executable
 */
export async function getSystemPythonPath(): Promise<string> {
  // First try to get from settings
  const config = vscode.workspace.getConfiguration('codexr.analysis');
  const configuredPath = config.get<string>('pythonPath');
  
  if (configuredPath && configuredPath.trim() !== '') {
    return configuredPath;
  }
  
  // Fallback to python3 or python
  try {
    await executeCommand('python3', ['--version']);
    return 'python3';
  } catch (error) {
    try {
      await executeCommand('python', ['--version']);
      return 'python';
    } catch (error) {
      throw new Error('No Python installation found. Please install Python or configure the path in settings.');
    }
  }
}

/**
 * Checks the status of the Python environment
 * @returns Environment information
 */
export async function checkEnvironment(): Promise<PythonEnvironmentInfo> {
  const venvPath = getVenvPath();
  
  if (!venvPath) {
    return {
      path: '',
      status: PythonEnvironmentStatus.ERROR,
      error: 'No workspace folder open'
    };
  }
  
  if (!venvExists()) {
    return {
      path: venvPath,
      status: PythonEnvironmentStatus.NOT_FOUND
    };
  }
  
  const pythonExecutable = getPythonExecutable(venvPath);
  const pipExecutable = getPipExecutable(venvPath);
  
  if (!executableExists(pythonExecutable) || !executableExists(pipExecutable)) {
    return {
      path: venvPath,
      status: PythonEnvironmentStatus.ERROR,
      error: 'Virtual environment exists but executables are missing'
    };
  }
  
  return {
    path: venvPath,
    status: PythonEnvironmentStatus.FOUND,
    pythonExecutable,
    pipExecutable
  };
}

/**
 * Creates a Python virtual environment
 * @param outputChannel Output channel to show progress
 * @returns Environment information
 */
export async function createEnvironment(outputChannel: vscode.OutputChannel): Promise<PythonEnvironmentInfo> {
  try {
    // Check if environment already exists
    const envInfo = await checkEnvironment();
    
    if (envInfo.status === PythonEnvironmentStatus.FOUND) {
      return envInfo;
    }
    
    if (envInfo.status === PythonEnvironmentStatus.ERROR && envInfo.error !== 'No workspace folder open') {
      throw new Error(envInfo.error);
    }
    
    const venvPath = getVenvPath();
    if (!venvPath) {
      throw new Error('No workspace folder open');
    }
    
    // Get system Python path
    const pythonPath = await getSystemPythonPath();
    
    // Create the virtual environment
    outputChannel.appendLine(`Creating Python virtual environment at ${venvPath}...`);
    outputChannel.show();
    
    await executeCommand(
      pythonPath, 
      ['-m', 'venv', venvPath], 
      { showOutput: true, outputChannel }
    );
    
    // Verify the environment was created
    const newEnvInfo = await checkEnvironment();
    
    if (newEnvInfo.status !== PythonEnvironmentStatus.FOUND) {
      throw new Error('Failed to create virtual environment');
    }
    
    // Return the created environment info
    return {
      ...newEnvInfo,
      status: PythonEnvironmentStatus.CREATED
    };
  } catch (error) {
    // Handle errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`Error creating Python environment: ${errorMessage}`);
    
    return {
      path: getVenvPath() || '',
      status: PythonEnvironmentStatus.ERROR,
      error: errorMessage
    };
  }
}