import * as vscode from 'vscode';
import { LocalServerProvider } from '../ui/treeProvider';

/**
 * Registers UI-related commands
 * @param treeDataProvider The main tree data provider
 * @returns Array of disposables for registered commands
 */
export function registerUICommands(
  treeDataProvider: LocalServerProvider
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];
  
  // Command to refresh the view
  disposables.push(
    vscode.commands.registerCommand('codexr.refreshView', () => {
      treeDataProvider.refresh();
    })
  );
  
  // Command for refreshing the server view (alias for backwards compatibility)
  disposables.push(
    vscode.commands.registerCommand('codexr.refreshServerView', () => {
      treeDataProvider.refresh();
    })
  );
  
  return disposables;
}