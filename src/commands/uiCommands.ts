import * as vscode from 'vscode';
import { LocalServerProvider } from '../ui/treeProvider';
import { AnalysisPanel } from '../ui/panels/analysisPanel';

// Add this interface to define the type
interface AnalysisResult {
  [key: string]: any;
}

/**
 * Registers UI-related commands
 * @param treeDataProvider The main tree data provider
 * @returns Array of disposables for registered commands
 */
export function registerUiCommands(context: vscode.ExtensionContext, treeDataProvider: LocalServerProvider): vscode.Disposable[] {
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
  
  // Make sure this command is properly registered and calls the panel update
  disposables.push(
    vscode.commands.registerCommand('codexr.updateAnalysisPanel', (analysisResult: AnalysisResult) => {
      // Get the extension URI
      const extension = vscode.extensions.getExtension('codexr.codexr');
      if (extension) {
        // Ensure we're calling the proper update method
        AnalysisPanel.update(analysisResult, extension.extensionUri);
        
        // Add debug logging to verify data flow
        console.log('Analysis panel update triggered with latest data');
      } else {
        console.error('Could not get extension URI for updateAnalysisPanel command');
        vscode.window.showErrorMessage('Failed to update analysis panel: Extension not found');
      }
    })
  );
  
  // Return the disposables
  return disposables;
}