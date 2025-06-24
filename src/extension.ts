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
import { registerAnalysisCommands } from './commands/analysisCommands';
import { registerPythonEnvCommands, checkAndSetupPythonEnvironment } from './pythonEnv';
import { FileWatchManager } from './analysis/fileWatchManager';
import { analysisDataManager } from './analysis/analysisDataManager';
import { cleanupXRVisualizations } from './analysis/xr/xrAnalysisManager';
import { cleanupDOMVisualizations } from './analysis/html/domVisualizationManager';

/**
 * This function is executed when the extension is activated
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('🚀 Extension "CodeXR" is now active.');

  // Initialize status bar manager
  const statusBarManager = getStatusBarManager(context);
  
  // ✅ CRITICAL: Initialize FileWatchManager with proper settings
  console.log('🔧 Initializing FileWatchManager...');
  const fileWatchManager = FileWatchManager.initialize(context);
  
  if (fileWatchManager) {
    console.log('✅ FileWatchManager initialized successfully');
  } else {
    console.error('❌ Failed to initialize FileWatchManager');
  }
  
  // Register tree data provider for the unified view
  const treeDataProvider = new LocalServerProvider(context);
  const treeView = vscode.window.createTreeView('codexr.serverTreeView', {
    treeDataProvider: treeDataProvider
  });
  context.subscriptions.push(treeView);

  // Register tree data provider disposal
  context.subscriptions.push({
    dispose: () => {
      console.log('🧹 Disposing tree data provider...');
      treeDataProvider.dispose();
    }
  });

  // Expose the treeDataProvider globally for updates
  global.treeDataProvider = treeDataProvider;

  // Register all commands ONCE
  console.log('📝 Registering server/UI commands...');
  const commandDisposables = registerCommands(context, treeDataProvider);
  context.subscriptions.push(...commandDisposables);
  
  // Register Python environment commands ONCE
  console.log('🐍 Registering Python environment commands...');
  const pythonEnvDisposables = registerPythonEnvCommands(context);
  context.subscriptions.push(...pythonEnvDisposables);
  
  // Register all analysis commands
  console.log('🔬 Registering analysis commands...');
  const analysisDisposables = registerAnalysisCommands(context);
  context.subscriptions.push(...analysisDisposables);
  
  console.log(`✅ Registered ${commandDisposables.length + pythonEnvDisposables.length + analysisDisposables.length} commands total`);
  
  // Check for Python environment at startup (after short delay to not block activation)
  setTimeout(() => {
    console.log('🔍 Checking Python environment...');
    checkAndSetupPythonEnvironment();
  }, 2000);

  // Log file system watcher status after initialization
  setTimeout(() => {
    const watcherStatus = treeDataProvider.getFileSystemWatcherStatus();
    console.log('📊 File System Watcher Status:', watcherStatus);
  }, 3000);
  
  console.log('🎉 CodeXR extension activation completed!');
}

/**
 * This function is executed when the extension is deactivated
 */
export async function deactivate() {
  console.log('🧹 Deactivating CodeXR extension...');
  
  // Clean up any stored data
  analysisDataManager.clear();
  
  // Clean up XR visualizations
  cleanupXRVisualizations();
  
  // Clean up DOM visualizations
  cleanupDOMVisualizations();
  
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
  
  console.log('✅ CodeXR extension deactivated successfully');
}
