declare global {
  var treeDataProvider: any;
}

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { registerCommands } from './commands';
import { getStatusBarManager } from './ui/statusBarManager';
import { LocalServerProvider } from './ui/treeProvider';
import { stopServer } from './server/serverManager';
import { registerPythonEnvCommands, checkAndSetupPythonEnvironment } from './pythonEnv';
import { analysisDataManager } from './analysis/analysisDataManager';
import { registerAnalysisCommands } from './commands/analysisCommands';
import { cleanupXRVisualizations } from './analysis/xr/xrAnalysisManager';
import { FileWatchManager } from './analysis/fileWatchManager';

/**
 * This function is executed when the extension is activated
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('Extension "CodeXR" is now active.');

  // Initialize status bar manager
  const statusBarManager = getStatusBarManager(context);
  
  // Inicializar FileWatchManager - AÑADIR ESTA LÍNEA
  FileWatchManager.initialize(context);
  
  // Register tree data provider for the unified view
  const treeDataProvider = new LocalServerProvider(context);
  const treeView = vscode.window.createTreeView('codexr.serverTreeView', {
    treeDataProvider: treeDataProvider
  });
  context.subscriptions.push(treeView);

  // Expose the treeDataProvider globally for updates
  global.treeDataProvider = treeDataProvider;

  // Register all commands ONCE
  // Server/UI commands
  const commandDisposables = registerCommands(context, treeDataProvider);
  context.subscriptions.push(...commandDisposables);
  
  // Register Python environment commands ONCE
  const pythonEnvDisposables = registerPythonEnvCommands(context);
  context.subscriptions.push(...pythonEnvDisposables);
  
  // Register all analysis commands ONCE - this is the only place that should register analysis commands
  const analysisDisposables = registerAnalysisCommands(context);
  context.subscriptions.push(...analysisDisposables);
  
  // Check for Python environment at startup (after short delay to not block activation)
  setTimeout(() => {
    checkAndSetupPythonEnvironment();
  }, 2000);
}

/**
 * This function is executed when the extension is deactivated
 */
export async function deactivate() {
  // Clean up any stored data
  analysisDataManager.clear();
  
  // Clean up XR visualizations
  cleanupXRVisualizations();
  
  // Stop all servers when extension is deactivated
  stopServer();
  
  // Clean up visualization files
  try {
    // Get the path to the visualizations directory
    const visualizationsDir = path.join(__dirname, '..', 'visualizations');
    
    // Check if the directory exists
    try {
      await fs.access(visualizationsDir);
      
      // Read all entries in the directory
      const entries = await fs.readdir(visualizationsDir);
      
      // Delete each entry recursively
      for (const entry of entries) {
        const entryPath = path.join(visualizationsDir, entry);
        console.log(`Cleaning up visualization files: ${entryPath}`);
        await fs.rm(entryPath, { recursive: true, force: true });
      }
      
      console.log('All visualization files cleaned up successfully');
    } catch (err) {
      // Directory doesn't exist, nothing to clean up
      console.log('No visualizations directory found, nothing to clean up');
    }
  } catch (error) {
    console.error('Error during cleanup of visualization files:', error);
  }
  
  // Status bar is disposed automatically through context.subscriptions
}
