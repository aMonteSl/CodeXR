import * as vscode from 'vscode';
import * as path from 'path';
import { 
  registerAnalysisCommand, 
  registerAnalysis3DCommand, 
  analyzeFile, 
  showAnalysisWebView, 
  transformAnalysisDataForWebview
} from '../analysis/analysisManager';
import { FileWatchManager } from '../analysis/fileWatchManager';
import { FileAnalysisResult, AnalysisMode } from '../analysis/model';
import { createXRVisualization, openXRVisualization } from '../analysis/xr/xrAnalysisManager';
import { analysisDataManager } from '../analysis/analysisDataManager';

/**
 * Registers all analysis-related commands
 * @param context Extension context for storage
 * @returns Array of disposables for registered commands
 */
export function registerAnalysisCommands(
  context: vscode.ExtensionContext
): vscode.Disposable[] {
  // Use an array to collect all command disposables
  const disposables: vscode.Disposable[] = [];
  
  // IMPORTANT: Don't register these since they would conflict with our new ones
  // Register analyze command
  // disposables.push(registerAnalysisCommand(context));
  
  // Register 3D analysis command
  // disposables.push(registerAnalysis3DCommand(context));
  
  // Register the command to switch analysis modes
  disposables.push(registerSetAnalysisModeCommand());

  // Actualizar el comando de análisis desde el árbol
  disposables.push(vscode.commands.registerCommand('codexr.analyzeFileFromTree', async (filePath: string) => {
    console.log(`Analyzing file from tree: ${filePath}`);
    
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Analyzing ${path.basename(filePath)}...`,
      cancellable: false
    }, async (progress) => {
      try {
        progress.report({ increment: 30, message: "Running code analysis..." });
        
        const result = await analyzeFile(filePath, context);
        
        progress.report({ increment: 70, message: "Preparing visualization..." });
        
        if (result) {
          // Store result for potential updates
          analysisDataManager.setAnalysisResult(result);
          
          // Display the analysis in the webview
          showAnalysisWebView(context, result);
        } else {
          vscode.window.showErrorMessage('Failed to analyze file. Check console for details.');
        }
      } catch (error) {
        console.error('Error in analyzeFileFromTree:', error);
        vscode.window.showErrorMessage(`Error analyzing file: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      return Promise.resolve();
    });
  }));

  // Register command to update analysis panel with new data
  const updateAnalysisPanelCommand = vscode.commands.registerCommand('codexr.updateAnalysisPanel', (analysisResult: FileAnalysisResult) => {
    // Get the active panel
    const activePanel = analysisDataManager.getActiveFileAnalysisPanel();
    if (activePanel) {
      // Transform the data for the webview before sending it
      const transformedData = transformAnalysisDataForWebview(analysisResult);
      
      activePanel.webview.postMessage({
        command: 'setAnalysisData',
        data: transformedData
      });
    }
  });
  disposables.push(updateAnalysisPanelCommand);

  // Register standard analysis command (replacing the previous implementation)
  const analyzeFileCommand = vscode.commands.registerCommand('codexr.analyzeFile', async (fileUri?: vscode.Uri) => {
    try {
      // Get the active file if no fileUri is provided
      if (!fileUri) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage('No file selected for analysis.');
          return;
        }
        fileUri = editor.document.uri;
      }
      
      // At this point fileUri is guaranteed to be defined
      const filePath = fileUri.fsPath;
      console.log(`Starting analysis of file: ${filePath}`);
      
      // Show progress notification
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Analyzing ${path.basename(filePath)}...`,
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 30, message: "Running code analysis..." });
        
        // Use filePath instead of fileUri.fsPath
        const result = await analyzeFile(filePath, context);
        
        progress.report({ increment: 70, message: "Preparing visualization..." });
        
        if (result) {
          // Store result for potential updates
          analysisDataManager.setAnalysisResult(result);
          
          // Display the analysis in the webview
          showAnalysisWebView(context, result);
        } else {
          vscode.window.showErrorMessage('Failed to analyze file. Check console for details.');
        }
        
        return Promise.resolve();
      });
    } catch (error) {
      console.error('Error analyzing file in static mode:', error);
      vscode.window.showErrorMessage(`Error analyzing file: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  disposables.push(analyzeFileCommand);
  
  // Reemplazar el comando de análisis XR
  const analyzeFile3DCommand = vscode.commands.registerCommand('codexr.analyzeFile3D', async (fileUri?: vscode.Uri) => {
    try {
      // Get the active file if no fileUri is provided
      if (!fileUri) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage('No file selected for analysis.');
          return;
        }
        fileUri = editor.document.uri;
      }
      
      // At this point fileUri is guaranteed to be defined
      const filePath = fileUri.fsPath;
      console.log(`Starting XR analysis of file: ${filePath}`);
      
      // Show progress notification
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Preparing XR visualization for ${path.basename(filePath)}...`,
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 30, message: "Running code analysis..." });
        
        // Use filePath instead of fileUri.fsPath
        const result = await analyzeFile(filePath, context);
        
        if (!result) {
          vscode.window.showErrorMessage('Failed to analyze file for XR visualization.');
          return Promise.resolve();
        }
        
        progress.report({ increment: 60, message: "Creating XR visualization..." });
        
        // Store result for potential updates
        analysisDataManager.setAnalysisResult(result);
        
        // Create and open XR visualization
        const htmlFilePath = await createXRVisualization(context, result);
        
        if (htmlFilePath) {
          progress.report({ increment: 90, message: "Opening visualization in browser..." });
          
          // Set up file watcher after successful analysis
          const fileWatchManager = FileWatchManager.getInstance();
          if (fileWatchManager) {
            fileWatchManager.setContext(context);
            fileWatchManager.setAnalysisMode(AnalysisMode.XR);
            fileWatchManager.startWatching(filePath, AnalysisMode.XR);
            // Para el modo XR, también configurar la ruta del HTML
            fileWatchManager.setLastXRHtmlPath(htmlFilePath);
          }
          
          // Open the visualization in the browser
          await openXRVisualization(htmlFilePath, context);
        } else {
          vscode.window.showErrorMessage('Failed to create XR visualization.');
        }
        
        return Promise.resolve();
      });
    } catch (error) {
      console.error('Error analyzing file for XR:', error);
      vscode.window.showErrorMessage(`Error creating XR visualization: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  disposables.push(analyzeFile3DCommand);
  
  // Command to open and analyze file in static mode
  const openAndAnalyzeFileCommand = vscode.commands.registerCommand('codexr.openAndAnalyzeFile', async (fileUri: vscode.Uri) => {
    try {
      // First, open the document
      await vscode.window.showTextDocument(fileUri);
      
      // Then analyze it
      await vscode.commands.executeCommand('codexr.analyzeFile', fileUri);
    } catch (error) {
      console.error('Error opening and analyzing file:', error);
      vscode.window.showErrorMessage(`Error analyzing file: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  disposables.push(openAndAnalyzeFileCommand);
  
  // Command to open and analyze file in XR mode
  const openAndAnalyzeFile3DCommand = vscode.commands.registerCommand('codexr.openAndAnalyzeFile3D', async (fileUri: vscode.Uri) => {
    try {
      // First, open the document
      await vscode.window.showTextDocument(fileUri);
      
      // Then analyze it in XR mode
      await vscode.commands.executeCommand('codexr.analyzeFile3D', fileUri);
    } catch (error) {
      console.error('Error opening and analyzing file in XR mode:', error);
      vscode.window.showErrorMessage(`Error analyzing file in XR: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  disposables.push(openAndAnalyzeFile3DCommand);

  return disposables;
}

/**
 * Sets the default analysis mode
 */
export function registerSetAnalysisModeCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.setAnalysisMode', async (mode: string) => {
    console.log('Setting analysis mode to:', mode);
    
    const config = vscode.workspace.getConfiguration();
    await config.update('codexr.analysisMode', mode, vscode.ConfigurationTarget.Global);
    
    // Show confirmation message
    vscode.window.showInformationMessage(`Default analysis mode set to: ${mode}`);
    
    // Use type assertion to avoid TypeScript error
    if ((global as any).treeDataProvider) {
      (global as any).treeDataProvider.refresh();
    } else {
      // Fallback
      await vscode.commands.executeCommand('codexr.refreshTreeView');
    }
  });
}

