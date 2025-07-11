import * as vscode from 'vscode';
// Fix the import path
import { registerServerCommands } from './serverCommands';
import { registerBabiaCommands } from './babiaCommands';
import { registerUiCommands } from './uiCommands'; // Fixed casing here
import { LocalServerProvider } from '../ui/treeProvider';

/**
 * Refreshes the tree view
 */
export function registerRefreshTreeViewCommand(treeDataProvider: any): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.refreshTreeView', () => {
    if (treeDataProvider && typeof treeDataProvider.refresh === 'function') {
      treeDataProvider.refresh();
    }
  });
}

/**
 * Registers all commands for the extension
 * @param context Extension context for storage
 * @param treeDataProvider The main tree data provider
 * @returns Array of disposables for all registered commands
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  treeDataProvider: LocalServerProvider
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];
  
  // Register each group of commands
  disposables.push(...registerServerCommands(context, treeDataProvider));
  // DISABLED: Legacy babia commands that use old template system
  // disposables.push(...registerBabiaCommands(context, treeDataProvider));
  disposables.push(...registerUiCommands(context, treeDataProvider)); // Fixed casing and added context parameter
  
  // Eliminar esta línea que registra el comando duplicado
  // disposables.push(registerSetAnalysisChartTypeCommand()); // Nuevo comando añadido
  
  // We no longer register analysis commands here since they are registered in extension.ts
  
  // Add the refresh command
  disposables.push(registerRefreshTreeViewCommand(treeDataProvider));
  
  return disposables;
}