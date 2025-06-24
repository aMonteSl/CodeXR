import * as vscode from 'vscode';
import * as path from 'path';
import { analyzeFile, showAnalysisWebView } from '../../analysis/analysisManager';
import { createXRVisualization } from '../../analysis/xr/xrAnalysisManager';
import { createDOMVisualization } from '../../analysis/html/domVisualizationManager';
import { analysisDataManager } from '../../analysis/analysisDataManager';
import { FileWatchManager } from '../../analysis/fileWatchManager';
import { AnalysisMode } from '../../analysis/model';
import { getFilePathFromUri, getLanguageName, withProgressNotification } from '../shared/commandHelpers';
import { handleExistingServerConflict } from './serverConflictHandler';

/**
 * Commands for file analysis operations
 */

/**
 * Registers file analysis related commands
 * @param context Extension context
 * @returns Array of disposables for the registered commands
 */
export function registerFileAnalysisCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];
  
  // Static analysis command
  disposables.push(registerStaticAnalysisCommand(context));
  
  // XR analysis command
  disposables.push(registerXRAnalysisCommand(context));
  
  // Tree analysis command
  disposables.push(registerTreeAnalysisCommand(context));
  
  // Open and analyze command
  disposables.push(registerOpenAndAnalyzeCommand());
  
  // DOM visualization command
  disposables.push(registerDOMVisualizationCommand(context));
  
  return disposables;
}

/**
 * Registers the static analysis command
 * @param context Extension context
 * @returns Command disposable
 */
function registerStaticAnalysisCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.analyzeFile', async (fileUri?: vscode.Uri) => {
    const filePath = getFilePathFromUri(fileUri);
    if (!filePath) {
      return;
    }

    console.log(`🔍 Starting STATIC analysis of file: ${filePath}`);

    // ✅ CHECK: Make sure file is not already being analyzed
    if (analysisDataManager.isFileBeingAnalyzed(filePath)) {
      vscode.window.showWarningMessage(
        `File ${path.basename(filePath)} is already being analyzed. Please wait for the current analysis to complete.`
      );
      return;
    }

    // ✅ IMMEDIATE FEEDBACK: Show that analysis is starting
    vscode.window.showInformationMessage(
      `Starting analysis of ${path.basename(filePath)}...`,
      { modal: false }
    );
    
    await withProgressNotification(
      `Analyzing ${path.basename(filePath)}...`,
      async (progress) => {
        progress.report({ increment: 10, message: "Initializing analysis..." });
        
        try {
          // ✅ MARK FILE AS BEING ANALYZED IMMEDIATELY
          analysisDataManager.setFileAnalyzing(filePath);
          
          progress.report({ increment: 30, message: "Running code analysis..." });
          
          const result = await analyzeFile(filePath, context);
          
          if (!result) {
            vscode.window.showErrorMessage('Failed to analyze file.');
            return;
          }

          progress.report({ increment: 70, message: "Preparing visualization..." });
          
          // Store result
          analysisDataManager.setAnalysisResult(filePath, result);
          
          // Show static webview
          showAnalysisWebView(context, result);
          
          // Configure file watcher for static analysis
          configureFileWatcher(filePath, AnalysisMode.STATIC, context);
          
          console.log(`✅ Static analysis completed for ${path.basename(filePath)}`);
        } catch (error) {
          console.error('❌ Error in static analysis:', error);
          vscode.window.showErrorMessage(
            `Error analyzing file: ${error instanceof Error ? error.message : String(error)}`
          );
        } finally {
          // ✅ ALWAYS MARK AS COMPLETED
          analysisDataManager.setFileAnalyzed(filePath);
        }
      }
    );
  });
}

/**
 * Registers the XR analysis command
 * @param context Extension context
 * @returns Command disposable
 */
function registerXRAnalysisCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.analyzeFile3D', async (fileUri?: vscode.Uri) => {
    const filePath = getFilePathFromUri(fileUri);
    if (!filePath) {
      return;
    }

    const fileName = path.basename(filePath);
    console.log(`🔮 Starting XR analysis of file: ${filePath}`);

    // Check for existing server conflicts
    const serverAction = await handleExistingServerConflict(filePath, fileName);
    
    if (serverAction === 'cancel' || serverAction === 'open') {
      return;
    }

    // ✅ CHECK: Make sure file is not already being analyzed
    if (analysisDataManager.isFileBeingAnalyzed(filePath)) {
      vscode.window.showWarningMessage(
        `File ${fileName} is already being analyzed. Please wait for the current analysis to complete.`
      );
      return;
    }

    // ✅ IMMEDIATE FEEDBACK: Show that analysis is starting
    vscode.window.showInformationMessage(
      `Starting XR analysis of ${fileName}...`,
      { modal: false }
    );
    
    await withProgressNotification(
      `Creating XR visualization for ${fileName}...`,
      async (progress) => {
        progress.report({ increment: 10, message: "Initializing XR analysis..." });
        
        try {
          // ✅ MARK FILE AS BEING ANALYZED IMMEDIATELY
          analysisDataManager.setFileAnalyzing(filePath);
          
          progress.report({ increment: 30, message: "Running code analysis..." });
          
          const result = await analyzeFile(filePath, context);
          
          if (!result) {
            vscode.window.showErrorMessage('Failed to analyze file.');
            return;
          }

          progress.report({ increment: 70, message: "Creating XR visualization..." });
          
          // Store result
          analysisDataManager.setAnalysisResult(filePath, result);
          
          // Create XR visualization
          const xrPath = await createXRVisualization(context, result);
          if (!xrPath) {
            vscode.window.showErrorMessage('Failed to create XR visualization.');
            return;
          }
          
          // Configure file watcher for XR analysis
          configureFileWatcher(filePath, AnalysisMode.XR, context);
          
          console.log(`✅ XR analysis completed for ${fileName}`);
        } catch (error) {
          console.error('❌ Error in XR analysis:', error);
          vscode.window.showErrorMessage(
            `Error creating XR visualization: ${error instanceof Error ? error.message : String(error)}`
          );
        } finally {
          // ✅ ALWAYS MARK AS COMPLETED
          analysisDataManager.setFileAnalyzed(filePath);
        }
      }
    );
  });
}

/**
 * Registers the tree analysis command
 * @param context Extension context
 * @returns Command disposable
 */
function registerTreeAnalysisCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.analyzeFileFromTree', async (filePath: string) => {
    console.log(`🌳 Analyzing file from tree: ${filePath}`);
    
    const fileName = path.basename(filePath);
    const fileExtension = path.extname(filePath).toLowerCase();

    // ✅ VALIDATION: Check if filePath is valid
    if (!filePath || typeof filePath !== 'string') {
      vscode.window.showErrorMessage('Invalid file path provided for analysis');
      return;
    }

    // ✅ CHECK: Make sure file exists
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
    } catch {
      vscode.window.showErrorMessage(`File not found: ${filePath}`);
      return;
    }

    // ✅ CHECK: Make sure file is not already being analyzed
    if (analysisDataManager.isFileBeingAnalyzed(filePath)) {
      vscode.window.showWarningMessage(
        `File ${fileName} is already being analyzed. Please wait for the current analysis to complete.`
      );
      return;
    }

    try {
      // Special handling for HTML files - Always use DOM visualization
      if (fileExtension === '.html' || fileExtension === '.htm') {
        return await handleHTMLFileFromTree(filePath, fileName, context);
      }
      
      // Special handling for unknown files
      const language = getLanguageName(filePath);
      if (language === 'Unknown') {
        vscode.window.showInformationMessage(
          `File "${fileName}" has an unsupported extension (${fileExtension}). ` +
          `CodeXR currently supports programming languages and HTML files for analysis.`,
          'OK'
        );
        return;
      }
      
      // For supported files: Use configured analysis mode
      await handleSupportedFileFromTree(filePath, fileName, context);
      
    } catch (error) {
      console.error('Error analyzing file from tree:', error);
      vscode.window.showErrorMessage(
        `Error analyzing file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

/**
 * Registers the open and analyze command
 * @returns Command disposable
 */
function registerOpenAndAnalyzeCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.openAndAnalyzeFile', async (filePath: string) => {
    console.log(`📂 Opening and analyzing file: ${filePath}`);
    
    try {
      // Open the file in editor first
      const document = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(document);
      
      // Then run static analysis
      await vscode.commands.executeCommand('codexr.analyzeFile', vscode.Uri.file(filePath));
    } catch (error) {
      console.error('Error opening and analyzing file:', error);
      vscode.window.showErrorMessage(
        `Error opening file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

/**
 * Registers the DOM visualization command
 * @param context Extension context
 * @returns Command disposable
 */
function registerDOMVisualizationCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.visualizeDOM', async (fileUri?: vscode.Uri) => {
    try {
      // Get file path from URI or active editor
      let filePath: string | undefined;
      
      if (fileUri) {
        filePath = fileUri.fsPath;
      } else {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          filePath = editor.document.uri.fsPath;
        }
      }
      
      if (!filePath) {
        vscode.window.showErrorMessage('No HTML file selected');
        return;
      }
      
      // Verify it's an HTML file
      const fileExtension = path.extname(filePath).toLowerCase();
      if (fileExtension !== '.html' && fileExtension !== '.htm') {
        vscode.window.showErrorMessage('Please select an HTML file');
        return;
      }
      
      const fileName = path.basename(filePath);

      // Check for existing server conflicts
      const serverAction = await handleExistingServerConflict(filePath, fileName);
      
      if (serverAction === 'cancel' || serverAction === 'open') {
        return;
      }
      
      // Show processing message
      vscode.window.showInformationMessage(
        `Creating DOM visualization for: ${fileName}...`,
        'OK'
      );
      
      // Create DOM visualization
      const result = await createDOMVisualization(filePath, context);
      
      if (!result) {
        vscode.window.showErrorMessage(`Failed to create DOM visualization for ${fileName}`);
      }
      
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error creating DOM visualization: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

/**
 * Handles HTML file analysis from tree
 * @param filePath Path to the HTML file
 * @param fileName Name of the file
 * @param context Extension context
 */
async function handleHTMLFileFromTree(
  filePath: string, 
  fileName: string, 
  context: vscode.ExtensionContext
): Promise<void> {
  console.log(`🌐 HTML file detected: ${fileName}, launching DOM visualization`);
  
  // Check for existing DOM visualization server conflicts
  const serverAction = await handleExistingServerConflict(filePath, fileName);
  
  if (serverAction === 'cancel' || serverAction === 'open') {
    return;
  }
  
  // Execute DOM visualization command directly
  await vscode.commands.executeCommand('codexr.visualizeDOM', vscode.Uri.file(filePath));
}

/**
 * Handles supported file analysis from tree
 * @param filePath Path to the file
 * @param fileName Name of the file
 * @param context Extension context
 */
async function handleSupportedFileFromTree(
  filePath: string, 
  fileName: string, 
  context: vscode.ExtensionContext
): Promise<void> {
  const config = vscode.workspace.getConfiguration();
  const currentMode = config.get<string>('codexr.analysisMode', 'XR'); // ✅ CHANGED: Default from 'Static' to 'XR'
  
  console.log(`Using configured analysis mode: ${currentMode} for ${fileName}`);
  
  if (currentMode === 'XR') {
    // Check for existing server conflicts first
    const serverAction = await handleExistingServerConflict(filePath, fileName);
    
    if (serverAction === 'cancel' || serverAction === 'open') {
      return;
    }
    
    // Execute XR analysis command directly
    await vscode.commands.executeCommand('codexr.analyzeFile3D', vscode.Uri.file(filePath));
  } else {
    // Execute static analysis command
    await vscode.commands.executeCommand('codexr.analyzeFile', vscode.Uri.file(filePath));
  }
  
  // Configure file watcher for the analysis mode
  configureFileWatcher(filePath, currentMode === 'XR' ? AnalysisMode.XR : AnalysisMode.STATIC, context);
}

/**
 * Configures file watcher for analysis
 * @param filePath Path to the file
 * @param mode Analysis mode
 * @param context Extension context
 */
function configureFileWatcher(
  filePath: string, 
  mode: AnalysisMode, 
  context: vscode.ExtensionContext
): void {
  const fileWatchManager = FileWatchManager.getInstance();
  
  // ✅ FIXED: Complete the function implementation
  if (fileWatchManager) {
    console.log(`🔧 Configuring file watcher for ${path.basename(filePath)} in ${mode} mode`);
    
    // Set the analysis mode for this file
    fileWatchManager.setAnalysisMode(filePath, mode);
    
    // Start watching the file
    fileWatchManager.startWatching(filePath, mode);
    
    console.log(`✅ File watcher configured successfully for ${path.basename(filePath)}`);
  } else {
    console.warn('⚠️ FileWatchManager not available, skipping file watcher configuration');
  }
}