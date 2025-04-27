import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { createEnvironment } from './environmentManager';
import { installPackage } from './packageManager';
import { PackageStatus, PythonEnvironmentStatus } from './models/environmentModel';
import { venvExists, getVenvPath } from './utils/pathUtils';

// Output channel for Python environment operations
let pythonEnvOutputChannel: vscode.OutputChannel;

/**
 * Sets up the Python environment and installs required packages
 * @param silent Whether to suppress info messages (used for automatic setup)
 */
export async function setupPythonEnvironment(silent: boolean = false): Promise<void> {
  // Create output channel if it doesn't exist
  if (!pythonEnvOutputChannel) {
    pythonEnvOutputChannel = vscode.window.createOutputChannel('CodeXR Python Environment');
  }
  
  pythonEnvOutputChannel.clear();
  pythonEnvOutputChannel.show();
  pythonEnvOutputChannel.appendLine('Setting up Python environment...');
  
  // Show an information message that the process is starting (unless in silent mode)
  if (!silent) {
    vscode.window.showInformationMessage(
      '[CodeXR] Setting up Python environment. This may take a few moments...',
      { modal: false }
    );
  }
  
  try {
    // Create virtual environment
    const envInfo = await createEnvironment(pythonEnvOutputChannel);
    
    if (envInfo.status === PythonEnvironmentStatus.ERROR) {
      throw new Error(envInfo.error);
    }
    
    // Install lizard package
    pythonEnvOutputChannel.appendLine('Installing required package: lizard...');
    
    const lizardInfo = await installPackage('lizard', envInfo, pythonEnvOutputChannel);
    
    if (lizardInfo.status === PackageStatus.ERROR) {
      throw new Error(`Failed to install lizard: ${lizardInfo.error}`);
    }
    
    // Show success message
    const message = envInfo.status === PythonEnvironmentStatus.CREATED
      ? '[CodeXR] Python environment successfully created and lizard installed.'
      : '[CodeXR] Python environment verified and lizard is installed.';
    
    if (!silent || envInfo.status === PythonEnvironmentStatus.CREATED) {
      vscode.window.showInformationMessage(message);
    }
    pythonEnvOutputChannel.appendLine(message);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`[CodeXR] Failed to set up Python environment: ${errorMessage}`);
    pythonEnvOutputChannel.appendLine(`Error: ${errorMessage}`);
  }
}

/**
 * Check if .venv exists; if not, automatically set it up
 */
export async function checkAndSetupPythonEnvironment(): Promise<void> {
  // If no workspace is open, we can't set up the environment
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    return;
  }
  
  // Check if user has disabled automatic setup
  const config = vscode.workspace.getConfiguration('codexr.analysis');
  const autoSetup = config.get<boolean>('autoSetupPython', true);
  
  if (!autoSetup) {
    return;
  }
  
  // Check if .venv exists
  if (!venvExists()) {
    // Run setup in silent mode to avoid too many popups
    await setupPythonEnvironment(true);
  }
}

/**
 * Registers all Python environment commands
 * @param context Extension context
 * @returns Array of disposables
 */
export function registerPythonEnvCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];
  
  // Create output channel
  pythonEnvOutputChannel = vscode.window.createOutputChannel('CodeXR Python Environment');
  context.subscriptions.push(pythonEnvOutputChannel);
  
  // Register command to setup Python environment
  disposables.push(
    vscode.commands.registerCommand('codexr.setupPythonEnvironment', () => setupPythonEnvironment(false))
  );
  
  // Register a workspace listener to automatically check for Python environment
  const workspaceListener = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    checkAndSetupPythonEnvironment();
  });
  
  disposables.push(workspaceListener);
  context.subscriptions.push(workspaceListener);
  
  return disposables;
}