import * as vscode from 'vscode';
import * as path from 'path';
import { analyzeFile, analyzeDirectory } from '../analysis/codeAnalyzer';
import { FileAnalysis, ProjectAnalysis, CodeMetrics } from '../analysis/models/analysisModel';
import { AnalysisViewProvider } from '../analysis/providers/analysisViewProvider';
// Corregir la importación
import { createAnalysisPanel } from '../ui/panels/analysisPanel';

/**
 * Registers all analysis-related commands
 * @param context Extension context for storage
 * @param analysisViewProvider Provider for analysis view
 * @returns Array of disposables for registered commands
 */
export function registerAnalysisCommands(
  context: vscode.ExtensionContext,
  analysisViewProvider: AnalysisViewProvider
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];
  
  // Command to analyze the current file
  disposables.push(
    vscode.commands.registerCommand('codexr.analyzeCurrentFile', async () => {
      try {
        console.log('analyzeCurrentFile command started');
        
        // Try to open the analysis view first
        await vscode.commands.executeCommand('codexr.openAnalysisView');
        console.log('Analysis view should be open now');
        
        // Wait a moment for the view to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Waited for view initialization');
        
        // Get the active editor
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showInformationMessage('No file is currently open');
          return;
        }
        
        const filePath = editor.document.uri.fsPath;
        
        // Show progress indicator
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Analyzing file...',
            cancellable: false
          },
          async (progress) => {
            progress.report({ increment: 0 });
            
            // Analyze the file
            const result = await analyzeFile(filePath);
            
            progress.report({ increment: 100 });
            
            // Display results
            vscode.commands.executeCommand('codexr.showAnalysisInPanel', result);
            
            // Show quick summary
            const message = `Analysis complete: ${result.metrics.totalLines} lines, ${result.metrics.functionCount} functions`;
            vscode.window.showInformationMessage(message);
          }
        );
      } catch (error) {
        console.error('Error in analyzeCurrentFile:', error);
        vscode.window.showErrorMessage(
          `Error analyzing file: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  // Command to analyze a folder
  disposables.push(
    vscode.commands.registerCommand('codexr.analyzeFolder', async (folderUri?: vscode.Uri) => {
      try {
        let folderPath: string;
        
        // If folderUri is provided (from right-click), use it directly
        if (folderUri) {
          folderPath = folderUri.fsPath;
        } else {
          // If not provided (from command palette), show folder picker
          const folders = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Folder to Analyze'
          });
          
          if (!folders || folders.length === 0) {
            return;
          }
          
          folderPath = folders[0].fsPath;
        }
        
        // Show progress
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Analyzing folder...',
            cancellable: false
          },
          async (progress) => {
            progress.report({ increment: 0, message: 'Scanning files...' });
            
            // Analyze the folder
            const result = await analyzeDirectory(folderPath);
            
            progress.report({ increment: 100, message: 'Done!' });
            
            // Show results
            vscode.commands.executeCommand('codexr.showAnalysisInPanel', result);
            
            // Show quick summary
            const message = `Analysis complete: ${result.files.length} files, ${result.summary.totalLines} lines, ${result.summary.functionCount} functions`;
            vscode.window.showInformationMessage(message);
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error analyzing folder: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  // Command to open the analysis view
  disposables.push(
    vscode.commands.registerCommand('codexr.openAnalysisView', async () => {
      console.log('openAnalysisView command called');
      try {
        // Try to focus on the view
        await vscode.commands.executeCommand('codexr.analysisView.focus');
        console.log('Successfully focused analysis view');
      } catch (error) {
        console.error('Error opening analysis view:', error);
        
        // If that doesn't work, try to open the view in another way
        try {
          await vscode.commands.executeCommand('workbench.view.explorer');
          console.log('Explorer view focused');
          
          // Wait a bit and then try to open our view
          setTimeout(async () => {
            try {
              await vscode.commands.executeCommand('codexr.analysisView.focus');
              console.log('Analysis view focused after delay');
            } catch (err) {
              console.error('Failed to focus analysis view after delay:', err);
            }
          }, 1000);
        } catch (error) {
          console.error('Error opening explorer view:', error);
        }
      }
    })
  );

  // Command to show analysis in panel
  disposables.push(
    vscode.commands.registerCommand('codexr.showAnalysisInPanel', async (analysis: FileAnalysis | ProjectAnalysis) => {
      try {
        await createAnalysisPanel(context.extensionUri, analysis);
      } catch (error) {
        console.error('Error showing analysis in panel:', error);
        vscode.window.showErrorMessage(`Error showing analysis: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  // Command to show detailed JS metrics
  disposables.push(
    vscode.commands.registerCommand('codexr.showJSMetricsDetails', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      
      const fileAnalysis = context.globalState.get(`jsAnalysis:${editor.document.uri.fsPath}`) as FileAnalysis | undefined;
      if (fileAnalysis && fileAnalysis.metrics) {
        showDetailedMetrics(fileAnalysis.metrics);
      } else {
        vscode.window.showInformationMessage('No analysis available for this file');
      }
    })
  );
  
  return disposables;
}

/**
 * Shows detailed metrics in a modal dialog
 * @param metrics Metrics to display
 */
function showDetailedMetrics(metrics: CodeMetrics) {
  vscode.window.showInformationMessage(
    `JavaScript Metrics:
    
    • Lines of Code: ${metrics.totalLines}
    • Code Lines: ${metrics.codeLines}
    • Comment Lines: ${metrics.commentLines}
    • Blank Lines: ${metrics.blankLines}
    • Functions: ${metrics.functionCount}
    • Classes: ${metrics.classCount}`,
    { modal: true }
  );
}