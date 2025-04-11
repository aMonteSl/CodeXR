import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { initializeStatusBar } from './ui/statusBar';
import { AnalysisViewProvider } from './analysis/providers/analysisViewProvider';
import { LocalServerProvider } from './ui/treeProvider';
import { stopServer } from './server/serverManager';

/**
 * This function is executed when the extension is activated
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "CodeXR" is now active.');

  // Initialize status bar
  const jsMetricsStatusBar = initializeStatusBar(context);
  context.subscriptions.push(jsMetricsStatusBar);

  // Register tree data provider for the unified view
  const treeDataProvider = new LocalServerProvider(context);

  // Register tree view
  const treeView = vscode.window.createTreeView('codexr.serverTreeView', {
    treeDataProvider: treeDataProvider
  });
  context.subscriptions.push(treeView);

  // Register the Analysis View Provider
  const analysisViewProvider = new AnalysisViewProvider(context.extensionUri);
  console.log('AnalysisViewProvider instance created');

  // Register the provider
  const analysisViewRegistration = vscode.window.registerWebviewViewProvider(
    'codexr.analysisView',
    analysisViewProvider,
    {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    }
  );
  console.log('AnalysisViewProvider registered');
  context.subscriptions.push(analysisViewRegistration);

  // Register all commands
  const commandDisposables = registerCommands(context, treeDataProvider, analysisViewProvider);
  context.subscriptions.push(...commandDisposables);
}

/**
 * This function is executed when the extension is deactivated
 */
export function deactivate() {
  stopServer(); // Ensure all servers are stopped when extension is deactivated
}
