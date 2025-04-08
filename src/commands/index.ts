import * as vscode from 'vscode';
import { registerAnalysisCommands } from './analysisCommands';
import { registerServerCommands } from './serverCommands';
import { registerBabiaCommands } from './babiaCommands';
import { registerUICommands } from './uiCommands';
import { LocalServerProvider } from '../ui/treeProvider';
import { AnalysisViewProvider } from '../analysis/providers/analysisViewProvider';

/**
 * Registers all commands for the extension
 * @param context Extension context for storage
 * @param treeDataProvider The main tree data provider
 * @param analysisViewProvider The analysis view provider
 * @returns Array of disposables for all registered commands
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  treeDataProvider: LocalServerProvider,
  analysisViewProvider: AnalysisViewProvider
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];
  
  // Register each group of commands
  disposables.push(...registerAnalysisCommands(context, analysisViewProvider));
  disposables.push(...registerServerCommands(context, treeDataProvider));
  disposables.push(...registerBabiaCommands(context, treeDataProvider));
  disposables.push(...registerUICommands(treeDataProvider));
  
  return disposables;
}