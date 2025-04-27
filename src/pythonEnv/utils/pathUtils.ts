import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

/**
 * Gets the path to the .venv directory in the workspace
 * @returns Path to the .venv directory or undefined if no workspace is open
 */
export function getVenvPath(): string | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }
  
  return path.join(workspaceFolders[0].uri.fsPath, '.venv');
}

/**
 * Gets the path to the Python executable in the .venv
 * @param venvPath Path to the .venv directory
 * @returns Path to the Python executable
 */
export function getPythonExecutable(venvPath: string): string {
  // Different paths based on platform
  if (process.platform === 'win32') {
    return path.join(venvPath, 'Scripts', 'python.exe');
  } else {
    return path.join(venvPath, 'bin', 'python');
  }
}

/**
 * Gets the path to the pip executable in the .venv
 * @param venvPath Path to the .venv directory
 * @returns Path to the pip executable
 */
export function getPipExecutable(venvPath: string): string {
  // Different paths based on platform
  if (process.platform === 'win32') {
    return path.join(venvPath, 'Scripts', 'pip.exe');
  } else {
    return path.join(venvPath, 'bin', 'pip');
  }
}

/**
 * Checks if the .venv directory exists
 * @returns Boolean indicating if .venv exists
 */
export function venvExists(): boolean {
  const venvPath = getVenvPath();
  if (!venvPath) {
    return false;
  }
  
  return fs.existsSync(venvPath);
}

/**
 * Checks if an executable exists in the .venv
 * @param executablePath Path to the executable
 * @returns Boolean indicating if the executable exists
 */
export function executableExists(executablePath: string): boolean {
  return fs.existsSync(executablePath);
}