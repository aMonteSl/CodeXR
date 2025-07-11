import * as vscode from 'vscode';

// Import all command modules
import { registerFileAnalysisCommands } from './fileAnalysisCommands';
import { registerDirectoryAnalysisCommands } from './directoryAnalysisCommands';
import { registerAnalysisSettingsCommands } from './settingsCommands';
import { registerTreeDisplayCommands } from './treeDisplayCommands';
import { registerDebugCommands } from './debugCommands';
import { registerAnalysisSessionCommands } from '../analysisSessionCommands';

/**
 * Central analysis command registry
 * 
 * This is the main entry point for all analysis-related commands.
 * It registers commands from specialized modules to avoid conflicts.
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
 * Registers the directory analysis from tree command
 * @param context Extension context
 * @returns Command disposable
 */
function registerDirectoryAnalysisFromTreeCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.analyzeDirectoryFromTree', async (directoryPath: string) => {
    try {
      console.log(`🌳 Analyzing directory from tree: ${directoryPath}`);
      
      // Get user's preferred directory analysis mode
      const config = vscode.workspace.getConfiguration();
      const directoryMode = config.get<string>('codexr.analysis.directoryMode', 'static');
      
      // Convert string path to URI
      const uri = vscode.Uri.file(directoryPath);
      
      // Delegate to appropriate specific command based on mode
      switch (directoryMode) {
        case 'static-deep':
          await vscode.commands.executeCommand('codexr.analyzeDirectoryDeepStatic', uri);
          break;
        default:
          await vscode.commands.executeCommand('codexr.analyzeDirectoryStatic', uri);
      }
    } catch (error) {
      console.error('❌ Error in directory analysis from tree:', error);
      vscode.window.showErrorMessage(
        `Failed to analyze directory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

/**
 * Registers the debug analysis command for testing
 * @param context Extension context
 * @returns Command disposable
 */
function registerDebugAnalysisCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.analysis.debug', async () => {
    try {
      console.log('🐛 Debug analysis command triggered');
      
      // Get analysis session manager
      const { AnalysisSessionManager } = await import('../../analysis/analysisSessionManager.js');
      const sessionManager = AnalysisSessionManager.getInstance();
      
      // Get active sessions
      const activeSessions = sessionManager.getAllSessions();
      
      // Show debug information
      const sessionInfo = activeSessions.map((session: any) => 
        `${session.type}: ${session.filePath} (${session.status})`
      ).join('\\n');
      
      vscode.window.showInformationMessage(
        `Active Analysis Sessions:\\n${sessionInfo || 'No active sessions'}`,
        { modal: false }
      );
      
    } catch (error) {
      console.error('❌ Error in debug analysis command:', error);
      vscode.window.showErrorMessage(
        `Debug analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}
