import * as vscode from 'vscode';
import * as path from 'path';
import { DirectoryAnalysisManager } from '../../analysis/static/directory/directoryAnalysisManager';
import { DirectoryAnalysisResult, FileMetrics } from '../../analysis/static/directory/directoryAnalysisModel';
import { DEFAULT_SHALLOW_FILTERS } from '../../analysis/static/directory/common/directoryAnalysisConfig';
import { createDirectoryVisualization } from '../../analysis/static/directory/directoryVisualizationManager';
import { createDirectoryXRVisualization, createDirectoryXRVisualizationDeep } from '../../analysis/xr/directoryXRAnalysisManager';
import { directoryWatchManager } from '../../analysis/watchers/directoryWatchManager';
import { checkForDuplicateAnalysis } from '../analysisSessionCommands';
import { AnalysisType } from '../../analysis/analysisSessionManager';
import { analyzeDirectoryDeepStatic, analyzeProjectDeepStatic } from './directoryDeepAnalysisCommands';
import { loadPreviousDirectoryAnalysis, saveDirectoryAnalysisResult } from '../../analysis/shared/directoryAnalysisDataManager';
import { 
  createNotificationProgressCallback, 
  logAnalysisStart, 
  logAnalysisComplete, 
  isInitialAnalysis 
} from '../../analysis/shared/directoryAnalysisProgress';

/**
 * Commands for directory and project-level static analysis
 */

/**
 * Registers directory analysis related commands
 * @param context Extension context
 * @returns Array of disposables for the registered commands
 */
export function registerDirectoryAnalysisCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];
  
  // Unified commands that respect user mode settings
  disposables.push(registerAnalyzeDirectoryCommand(context));
  disposables.push(registerAnalyzeProjectCommand(context));
  
  // Specific commands for each mode
  // Analyze directory (static) command
  disposables.push(registerAnalyzeDirectoryStaticCommand(context));
  
  // Analyze directory deep (static) command
  disposables.push(registerAnalyzeDirectoryDeepStaticCommand());
  
  // Analyze directory (XR) command
  disposables.push(registerAnalyzeDirectoryXRCommand(context));
  
  // Analyze directory deep (XR) command
  disposables.push(registerAnalyzeDirectoryXRDeepCommand(context));
  
  // Analyze project (static) command
  disposables.push(registerAnalyzeProjectStaticCommand(context));
  
  // Analyze project deep (static) command
  disposables.push(registerAnalyzeProjectDeepStaticCommand());
  
  // Analyze project (XR) command
  disposables.push(registerAnalyzeProjectXRCommand(context));
  
  // Analyze project deep (XR) command
  disposables.push(registerAnalyzeProjectXRDeepCommand(context));
  
  return disposables;
}

/**
 * Analyzes a directory with static analysis
 */
function registerAnalyzeDirectoryStaticCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.analyzeDirectoryStatic', async (uri?: vscode.Uri) => {
    try {
      let targetPath: string;
      
      if (uri) {
        // Called from context menu
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type === vscode.FileType.Directory) {
          targetPath = uri.fsPath;
        } else {
          // If it's a file, use its parent directory
          targetPath = path.dirname(uri.fsPath);
        }
      } else {
        // Called from command palette - ask user to select directory
        const selectedUri = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: 'Select Directory to Analyze'
        });
        
        if (!selectedUri || selectedUri.length === 0) {
          return;
        }
        
        targetPath = selectedUri[0].fsPath;
      }
      
      await analyzeDirectory(targetPath, context);
      
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to analyze directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

/**
 * Analyzes the entire project (workspace root) with static analysis
 */
function registerAnalyzeProjectStaticCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.analyzeProjectStatic', async (uri?: vscode.Uri) => {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showWarningMessage('No workspace folder is open. Please open a project first.');
        return;
      }
      
      let targetPath: string;
      
      if (workspaceFolders.length === 1) {
        targetPath = workspaceFolders[0].uri.fsPath;
      } else {
        // Multiple workspace folders - let user choose
        const items = workspaceFolders.map(folder => ({
          label: folder.name,
          description: folder.uri.fsPath,
          uri: folder.uri
        }));
        
        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select workspace folder to analyze'
        });
        
        if (!selected) {
          return;
        }
        
        targetPath = selected.uri.fsPath;
      }
      
      // Always analyze the workspace root, regardless of which folder was right-clicked
      console.log(`🔍 Project analysis triggered - using workspace root: ${targetPath}`);
      await analyzeDirectory(targetPath, context, true); // true = project-level analysis
      
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to analyze project: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

/**
 * Core directory analysis function
 */
async function analyzeDirectory(
  directoryPath: string, 
  context: vscode.ExtensionContext, 
  isProject: boolean = false
): Promise<void> {
  // Check for duplicate analysis
  const action = await checkForDuplicateAnalysis(directoryPath, AnalysisType.DIRECTORY);
  if (action === 'cancel') {
    return;
  } else if (action === 'reopen') {
    return; // Panel was reopened, nothing more to do
  }
  
  const manager = new DirectoryAnalysisManager();
  
  // Show progress indicator
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `${isProject ? 'Project' : 'Directory'} Analysis`,
    cancellable: true
  }, async (progress, token) => {
    const startTime = Date.now();
    
    progress.report({ 
      increment: 0, 
      message: `Scanning ${isProject ? 'project' : 'directory'}...` 
    });
    
    // Set up progress callback
    const progressCallback = (current: number, total: number, currentFile: string) => {
      if (token.isCancellationRequested) {
        throw new Error('Analysis cancelled by user');
      }
      
      const percentage = Math.round((current / total) * 100);
      progress.report({
        increment: percentage / total,
        message: `Analyzing file ${current}/${total}: ${path.basename(currentFile)}`
      });
    };
    
    try {
      // Load previous analysis data if available
      let previousResult: DirectoryAnalysisResult | undefined;
      let dataPath: string | undefined;
      
      try {
        const previousData = await loadPreviousDirectoryAnalysis({
          context,
          directoryPath,
          mode: 'static',
          isProject
        });
        
        previousResult = previousData.previousResult;
        dataPath = previousData.dataPath;
        
        if (previousResult) {
          console.log(`DIRECTORY-ANALYSIS: STATIC Using previous shallow analysis data for incremental scanning`);
        }
      } catch (error) {
        console.warn(`DIRECTORY-ANALYSIS: STATIC Could not load previous shallow analysis data: ${error}`);
      }
      
      // Determine if this is initial analysis
      const isInitial = isInitialAnalysis(previousResult);
      
      // Log analysis start
      logAnalysisStart('static', directoryPath, isInitial);
      
      // Set up standardized progress callback for initial analysis
      const standardProgressCallback = isInitial 
        ? createNotificationProgressCallback(progress, 'static', true)
        : progressCallback; // Use simple callback for incremental
      
      // Perform the shallow analysis (maxDepth = 1)
      manager.setProgressCallback(standardProgressCallback);
      const result = await manager.analyzeDirectory(directoryPath, DEFAULT_SHALLOW_FILTERS, previousResult);
      
      // Log analysis completion
      const duration = Date.now() - startTime;
      const filesAnalyzed = result.metadata.filesAnalyzedThisSession || result.summary.totalFilesAnalyzed;
      const totalFiles = result.metadata.totalFilesConsidered || result.summary.totalFiles;
      logAnalysisComplete('static', directoryPath, filesAnalyzed, totalFiles, isInitial, duration);
      
      // Save the analysis result if we have a data path
      if (dataPath) {
        try {
          await saveDirectoryAnalysisResult(result, dataPath, 'static');
        } catch (error) {
          console.warn(`⚠️ Could not save shallow analysis result: ${error}`);
        }
      }
      
      progress.report({ 
        increment: 100, 
        message: 'Creating visualization...' 
      });
      
      // Show the results with shallow mode
      await createDirectoryVisualization(context, directoryPath, result, isProject, 'shallow');
      
      // Start watching directory for changes in shallow mode
      directoryWatchManager.startWatching(directoryPath, result, isProject, 'shallow');
      
      vscode.window.showInformationMessage(
        `${isProject ? 'Project' : 'Directory'} analysis completed! ` +
        `Analyzed ${result.summary.totalFilesAnalyzed} files out of ${result.summary.totalFiles} total files.`
      );
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('cancelled')) {
        vscode.window.showInformationMessage('Analysis cancelled by user.');
      } else {
        throw error;
      }
    }
  });
}

/**
 * Registers the deep directory analysis command
 */
function registerAnalyzeDirectoryDeepStaticCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.analyzeDirectoryDeepStatic', analyzeDirectoryDeepStatic);
}

/**
 * Registers the deep project analysis command
 */
function registerAnalyzeProjectDeepStaticCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.analyzeProjectDeepStatic', analyzeProjectDeepStatic);
}

/**
 * Analyzes a directory with XR visualization
 */
function registerAnalyzeDirectoryXRCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.analyzeDirectoryXR', async (uri?: vscode.Uri) => {
    try {
      let targetPath: string;
      
      if (uri) {
        // Called from context menu
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type === vscode.FileType.Directory) {
          targetPath = uri.fsPath;
        } else {
          vscode.window.showErrorMessage('Please select a directory to analyze.');
          return;
        }
      } else {
        // Called from command palette
        const selected = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: 'Select Directory to Analyze (XR)'
        });
        
        if (!selected || selected.length === 0) {
          return;
        }
        
        targetPath = selected[0].fsPath;
      }
      
      console.log(`🎯 Directory XR Analysis initiated for: ${targetPath}`);
      
      // Check for existing analysis
      const existingCheck = await checkForDuplicateAnalysis(targetPath, AnalysisType.DIRECTORY);
      if (existingCheck === 'cancel') {
        return;
      }
      
      // Create XR visualization
      await createDirectoryXRVisualization(context, targetPath, false);
      
      vscode.window.showInformationMessage(
        `Directory XR analysis completed! View opened in XR visualization panel.`
      );
      
    } catch (error) {
      console.error('Error in directory XR analysis:', error);
      vscode.window.showErrorMessage(`Failed to analyze directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

/**
 * Analyzes a directory with XR visualization (Deep recursive)
 */
function registerAnalyzeDirectoryXRDeepCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.analyzeDirectoryXRDeep', async (uri?: vscode.Uri) => {
    try {
      let targetPath: string;

      if (uri) {
        // Called from context menu (right-click on folder)
        targetPath = uri.fsPath;
      } else {
        // Called from command palette - show folder picker
        const selectedFolder = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: 'Select Directory to Analyze (Deep XR)'
        });

        if (!selectedFolder || selectedFolder.length === 0) {
          return;
        }

        targetPath = selectedFolder[0].fsPath;
      }

      // Validate path exists and is a directory
      const stat = await vscode.workspace.fs.stat(vscode.Uri.file(targetPath));
      if (!(stat.type & vscode.FileType.Directory)) {
        vscode.window.showErrorMessage('Selected path is not a directory');
        return;
      }

      console.log(`🎯 Directory XR Deep Analysis initiated for: ${targetPath}`);

      // Check for duplicate analysis
      await checkForDuplicateAnalysis(targetPath, AnalysisType.DIRECTORY);

      // Create XR deep visualization
      await createDirectoryXRVisualizationDeep(context, targetPath, false);
      
      vscode.window.showInformationMessage(
        `Directory Deep XR analysis completed! View opened in XR visualization panel.`
      );
      
    } catch (error) {
      console.error('Error in directory XR deep analysis:', error);
      vscode.window.showErrorMessage(`Failed to analyze directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

/**
 * Registers the "Analyze Project (XR)" command
 */
function registerAnalyzeProjectXRCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.analyzeProjectXR', async () => {
    try {
      // Get workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder is open');
        return;
      }

      const targetPath = workspaceFolder.uri.fsPath;
      console.log(`🎯 Project XR Analysis initiated for: ${targetPath}`);

      // Check for duplicate analysis
      await checkForDuplicateAnalysis(targetPath, AnalysisType.DIRECTORY);

      // Create XR visualization (shallow mode)
      await createDirectoryXRVisualization(context, targetPath, true);
      
      vscode.window.showInformationMessage(
        `Project XR analysis completed! View opened in XR visualization panel.`
      );
      
    } catch (error) {
      console.error('Error in project XR analysis:', error);
      vscode.window.showErrorMessage(`Failed to analyze project: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

/**
 * Registers the "Analyze Project Deep (XR)" command
 */
function registerAnalyzeProjectXRDeepCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.analyzeProjectXRDeep', async () => {
    try {
      // Get workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder is open');
        return;
      }

      const targetPath = workspaceFolder.uri.fsPath;
      console.log(`🎯 Project Deep XR Analysis initiated for: ${targetPath}`);

      // Check for duplicate analysis
      await checkForDuplicateAnalysis(targetPath, AnalysisType.DIRECTORY);

      // Create XR deep visualization
      await createDirectoryXRVisualizationDeep(context, targetPath, true);
      
      vscode.window.showInformationMessage(
        `Project Deep XR analysis completed! View opened in XR visualization panel.`
      );
      
    } catch (error) {
      console.error('Error in project deep XR analysis:', error);
      vscode.window.showErrorMessage(`Failed to analyze project: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

/**
 * Registers the unified analyze directory command that respects user mode settings
 * @param context Extension context
 * @returns Command disposable
 */
function registerAnalyzeDirectoryCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.analyzeDirectory', async (uri?: vscode.Uri) => {
    try {
      // Get user's preferred directory analysis mode
      const config = vscode.workspace.getConfiguration();
      const directoryMode = config.get<string>('codexr.analysis.directoryMode', 'static');
      
      console.log(`🔄 Unified directory analysis triggered with mode: ${directoryMode}`);
      
      // Delegate to appropriate specific command based on mode
      switch (directoryMode) {
        case 'static':
          await vscode.commands.executeCommand('codexr.analyzeDirectoryStatic', uri);
          break;
        case 'static-deep':
          await vscode.commands.executeCommand('codexr.analyzeDirectoryDeepStatic', uri);
          break;
        case 'xr':
          await vscode.commands.executeCommand('codexr.analyzeDirectoryXR', uri);
          break;
        case 'xr-deep':
          await vscode.commands.executeCommand('codexr.analyzeDirectoryXRDeep', uri);
          break;
        default:
          console.warn(`Unknown directory mode: ${directoryMode}, falling back to static`);
          await vscode.commands.executeCommand('codexr.analyzeDirectoryStatic', uri);
      }
    } catch (error) {
      console.error('Error in unified directory analysis:', error);
      vscode.window.showErrorMessage(
        `Directory analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

/**
 * Registers the unified analyze project command that respects user mode settings
 * @param context Extension context
 * @returns Command disposable
 */
function registerAnalyzeProjectCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.analyzeProject', async () => {
    try {
      // Get user's preferred directory analysis mode
      const config = vscode.workspace.getConfiguration();
      const directoryMode = config.get<string>('codexr.analysis.directoryMode', 'static');
      
      console.log(`🔄 Unified project analysis triggered with mode: ${directoryMode}`);
      
      // Delegate to appropriate specific command based on mode
      switch (directoryMode) {
        case 'static':
          await vscode.commands.executeCommand('codexr.analyzeProjectStatic');
          break;
        case 'static-deep':
          await vscode.commands.executeCommand('codexr.analyzeProjectDeepStatic');
          break;
        case 'xr':
          await vscode.commands.executeCommand('codexr.analyzeProjectXR');
          break;
        case 'xr-deep':
          await vscode.commands.executeCommand('codexr.analyzeProjectXRDeep');
          break;
        default:
          console.warn(`Unknown directory mode: ${directoryMode}, falling back to static`);
          await vscode.commands.executeCommand('codexr.analyzeProjectStatic');
      }
    } catch (error) {
      console.error('Error in unified project analysis:', error);
      vscode.window.showErrorMessage(
        `Project analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}
