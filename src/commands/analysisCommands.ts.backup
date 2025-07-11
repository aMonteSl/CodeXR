import * as vscode from 'vscode';
import { registerFileAnalysisCommands } from './analysis/fileAnalysisCommands';
import { registerDirectoryAnalysisCommands } from './analysis/directoryAnalysisCommands';
import { registerAnalysisSettingsCommands } from './analysis/settingsCommands';
import { registerTreeDisplayCommands } from './analysis/treeDisplayCommands';
import { registerDebugCommands } from './analysis/debugCommands';
import { registerAnalysisSessionCommands } from './analysisSessionCommands';
import { AnalysisSessionManager, AnalysisType } from '../analysis/analysisSessionManager';

/**
 * Main entry point for all analysis-related commands
 * 
 * This file coordinates the registration of analysis commands by delegating
 * to specialized command modules. Each module handles a specific aspect of
 * the analysis functionality:
 * 
 * - File Analysis: Static, XR, and DOM analysis operations
 * - Settings: Analysis configuration and preferences  
 * - Tree Display: Tree view configuration and sorting
 * - Debug: Diagnostic and troubleshooting commands
 * 
 * The original 1030+ line file has been refactored into focused modules
 * for better maintainability and code organization.
 */

/**
 * Registers all analysis-related commands
 * @param context Extension context for command registration
 * @returns Array of disposables for all registered commands
 */
export function registerAnalysisCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
  console.log('🔧 Registering analysis commands...');
  
  const disposables: vscode.Disposable[] = [];
  
  try {
    // Register file analysis commands (Static, XR, DOM, Tree analysis)
    console.log('📁 Registering file analysis commands...');
    disposables.push(...registerFileAnalysisCommands(context));
    
    // Register directory analysis commands (Static directory/project analysis)
    console.log('📂 Registering directory analysis commands...');
    disposables.push(...registerDirectoryAnalysisCommands(context));
    
    // Register analysis settings commands (Mode, delay, auto-analysis, etc.)
    console.log('⚙️ Registering analysis settings commands...');
    disposables.push(...registerAnalysisSettingsCommands(context));
    
    // Register tree display commands (Sorting, filtering, configuration)
    console.log('🌳 Registering tree display commands...');
    disposables.push(...registerTreeDisplayCommands(context));
    
    // Register debug commands (Diagnostics, troubleshooting)
    console.log('🐛 Registering debug commands...');
    disposables.push(...registerDebugCommands());
    
    // Register analysis session commands (Active analyses management)
    console.log('📊 Registering analysis session commands...');
    disposables.push(...registerAnalysisSessionCommands(context));
    
    // Register tree interaction commands
    console.log('🌳 Registering tree interaction commands...');
    disposables.push(registerDirectoryAnalysisFromTreeCommand(context));
    
    // Register debug command for testing
    console.log('🐛 Registering debug analysis command...');
    disposables.push(registerDebugAnalysisCommand(context));
    
    console.log(`✅ Successfully registered ${disposables.length} analysis commands`);
    
  } catch (error) {
    console.error('❌ Error registering analysis commands:', error);
    vscode.window.showErrorMessage(
      `Failed to register analysis commands: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  
  return disposables;
}

/**
 * Gets the total number of registered commands for diagnostics
 * @returns Number of registered commands
 */
export function getRegisteredCommandCount(): number {
  // This can be used for diagnostics or testing
  const mockContext = {
    subscriptions: [],
    workspaceState: { get: () => undefined, update: () => Promise.resolve() },
    globalState: { get: () => undefined, update: () => Promise.resolve() },
    extensionUri: vscode.Uri.file(''),
    extensionPath: '',
    environmentVariableCollection: {} as any,
    extensionMode: vscode.ExtensionMode.Production,
    logUri: vscode.Uri.file(''),
    storageUri: undefined,
    globalStorageUri: vscode.Uri.file(''),
    secrets: {} as any,
    asAbsolutePath: (relativePath: string) => relativePath,
    // ✅ ADDED: Missing properties
    storagePath: undefined,
    globalStoragePath: '',
    logPath: '',
    extension: {} as any,
    languageModelAccessInformation: {} as any
  } as unknown as vscode.ExtensionContext; // ✅ FIXED: Use unknown cast
  
  return registerAnalysisCommands(mockContext).length;
}

/**
 * Re-exports commonly used functions for backward compatibility
 */
export { refreshTreeProvider } from './shared/commandHelpers';
export { getLanguageName, getFilePathFromUri } from './shared/commandHelpers';

/**
 * Command categories for reference
 */
export const COMMAND_CATEGORIES = {
  FILE_ANALYSIS: 'File Analysis Commands',
  SETTINGS: 'Analysis Settings Commands', 
  TREE_DISPLAY: 'Tree Display Commands',
  DEBUG: 'Debug Commands'
} as const;

/**
 * List of all registered command IDs for reference
 */
export const REGISTERED_COMMANDS = {
  // File Analysis Commands
  ANALYZE_FILE: 'codexr.analyzeFile',
  ANALYZE_FILE_3D: 'codexr.analyzeFile3D', 
  ANALYZE_FILE_FROM_TREE: 'codexr.analyzeFileFromTree',
  OPEN_AND_ANALYZE_FILE: 'codexr.openAndAnalyzeFile',
  VISUALIZE_DOM: 'codexr.visualizeDOM',
  
  // Settings Commands
  TOGGLE_ANALYSIS_MODE: 'codexr.toggleAnalysisMode',
  SET_ANALYSIS_DEBOUNCE_DELAY: 'codexr.setAnalysisDebounceDelay',
  TOGGLE_AUTO_ANALYSIS: 'codexr.toggleAutoAnalysis',
  SET_ANALYSIS_CHART_TYPE: 'codexr.setAnalysisChartType',
  SET_DIMENSION_MAPPING: 'codexr.setDimensionMapping',
  RESET_ANALYSIS_DEFAULTS: 'codexr.resetAnalysisDefaults',
  
  // Tree Display Commands
  CONFIGURE_TREE_DISPLAY: 'codexr.configureTreeDisplay',
  CONFIGURE_LANGUAGE_SORT: 'codexr.configureLanguageSort',
  CONFIGURE_FILE_SORT: 'codexr.configureFileSort',
  CONFIGURE_FILE_LIMIT: 'codexr.configureFileLimit',
  RESET_TREE_DISPLAY_SETTINGS: 'codexr.resetTreeDisplaySettings',
  
  // Debug Commands
  DEBUG_FILE_SYSTEM_WATCHER: 'codexr.debugFileSystemWatcher',
  DEBUG_WATCHERS: 'codexr.debugWatchers',
  REFRESH_ANALYSIS_TREE: 'codexr.refreshAnalysisTree',
  FORCE_REFRESH_ANALYSIS_TREE: 'codexr.forceRefreshAnalysisTree',
  ANALYSIS_SYSTEM_STATUS: 'codexr.analysisSystemStatus',
  CLEAR_ANALYSIS_CACHE: 'codexr.clearAnalysisCache',
  
  // Debug Analysis Command
  DEBUG_ANALYSIS_COMMAND: 'codexr.analysis.debug'
} as const;

/**
 * Register command for directory analysis triggered from tree view
 */
function registerDirectoryAnalysisFromTreeCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.analyzeDirectoryFromTree', async (directoryPath: string) => {
    try {
      console.log(`🔍 Tree-triggered directory analysis: ${directoryPath}`);
      
      // Get the current directory analysis mode setting from VS Code configuration
      const config = vscode.workspace.getConfiguration();
      const currentMode = config.get<string>('codexr.analysis.directoryMode', 'shallow');
      
      const uri = vscode.Uri.file(directoryPath);
      
      if (currentMode === 'deep') {
        // Trigger deep directory analysis command
        await vscode.commands.executeCommand('codexr.analyzeDirectoryDeepStatic', uri);
      } else {
        // Trigger shallow directory analysis command
        await vscode.commands.executeCommand('codexr.analyzeDirectoryStatic', uri);
      }
      
    } catch (error) {
      console.error('Error in directory analysis from tree:', error);
      vscode.window.showErrorMessage(
        `Directory analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

/**
 * Debug command to manually trigger session registration and tree refresh for testing
 */
export function registerDebugAnalysisCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.analysis.debug', async () => {
    console.log('🐛 [DEBUG] Manual debug command triggered');
    
    // Get the session manager
    const sessionManager = AnalysisSessionManager.getInstance();
    
    // Debug current state
    console.log('🐛 [DEBUG] Current session manager state:');
    sessionManager.debugState();
    
    // Manually add a test session
    console.log('🐛 [DEBUG] Adding test session...');
    const testSession = sessionManager.addSession(
      '/home/adrian/CodeXR/test_analysis.py',
      AnalysisType.STATIC,
      { dispose: () => console.log('Test panel disposed') } as any
    );
    console.log(`🐛 [DEBUG] Test session added with ID: ${testSession}`);
    
    // Debug state after adding
    sessionManager.debugState();
    
    vscode.window.showInformationMessage('Debug analysis command executed - check console logs');
  });
}

