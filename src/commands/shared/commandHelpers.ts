import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Shared helper functions for command operations
 */

/**
 * Gets the language name based on file extension
 * @param filePath Path to the file
 * @returns Language name or 'Unknown' if not supported
 */
export function getLanguageName(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  
  const languageMap: Record<string, string> = {
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.py': 'Python',
    '.java': 'Java',
    '.c': 'C',
    '.cpp': 'C++',
    '.cxx': 'C++',
    '.cc': 'C++',
    '.h': 'C/C++ Headers',
    '.hpp': 'C/C++ Headers',
    '.cs': 'C#',
    '.php': 'PHP',
    '.rb': 'Ruby',
    '.go': 'Go',
    '.rs': 'Rust',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
    '.kts': 'Kotlin',
    '.html': 'HTML',
    '.htm': 'HTML',
    '.vue': 'Vue',
    '.scala': 'Scala',
    '.sc': 'Scala',
    '.lua': 'Lua',
    '.erl': 'Erlang',
    '.hrl': 'Erlang',
    '.zig': 'Zig',
    '.pl': 'Perl',
    '.pm': 'Perl',
    '.pod': 'Perl',
    '.t': 'Perl',
    '.gd': 'GDScript',
    '.sol': 'Solidity',
    '.f': 'Fortran',
    '.f77': 'Fortran',
    '.f90': 'Fortran',
    '.f95': 'Fortran',
    '.f03': 'Fortran',
    '.f08': 'Fortran',
    '.for': 'Fortran',
    '.ftn': 'Fortran',
    '.ttcn3': 'TTCN-3',
    '.ttcn': 'TTCN-3',
    '.3mp': 'TTCN-3',
    '.m': 'Objective-C',
    '.mm': 'Objective-C'
  };
  
  return languageMap[ext] || 'Unknown';
}

/**
 * Extracts file path from URI or active editor
 * @param fileUri Optional URI to extract path from
 * @returns File path or undefined if not available
 */
export function getFilePathFromUri(fileUri?: vscode.Uri): string | undefined {
  if (fileUri) {
    return fileUri.fsPath;
  }
  
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No file is currently open');
    return undefined;
  }
  
  return editor.document.uri.fsPath;
}

/**
 * Creates a tree item for displaying error messages
 * @param message Error message to display
 * @param tooltip Optional tooltip text
 * @returns TreeItem-like object for displaying the error
 */
export function createErrorItem(message: string, tooltip?: string): any {
  return {
    label: message,
    tooltip: tooltip || message,
    collapsibleState: vscode.TreeItemCollapsibleState.None,
    iconPath: new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground')),
    contextValue: 'error'
  };
}

/**
 * Refreshes the tree data provider if available
 * @param showMessage Whether to show a success message
 */
export function refreshTreeProvider(showMessage: boolean = false): void {
  const treeDataProvider = (global as any).treeDataProvider;
  
  if (treeDataProvider && typeof treeDataProvider.refresh === 'function') {
    treeDataProvider.refresh();
    
    if (showMessage) {
      vscode.window.showInformationMessage('Tree view refreshed');
    }
  } else if (showMessage) {
    vscode.window.showWarningMessage('Tree data provider not available');
  }
}

/**
 * Shows a progress notification while executing an async operation
 * @param title Title of the progress notification
 * @param operation Async operation to execute
 * @param progressUpdates Optional progress update messages
 * @returns Result of the operation
 */
export async function withProgressNotification<T>(
  title: string,
  operation: (progress: vscode.Progress<{ increment?: number; message?: string }>) => Promise<T>,
  cancellable: boolean = false
): Promise<T> {
  return vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title,
    cancellable
  }, operation);
}