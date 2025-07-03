import * as vscode from 'vscode';
import { AnalysisSessionManager, AnalysisType } from '../analysis/analysisSessionManager';

/**
 * Commands for analysis session management
 */

/**
 * Registers analysis session management commands
 */
export function registerAnalysisSessionCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  // Reopen analysis command
  disposables.push(registerReopenAnalysisCommand());

  // Close analysis command
  disposables.push(registerCloseAnalysisCommand());

  return disposables;
}

/**
 * Registers the reopen analysis command
 */
function registerReopenAnalysisCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.reopenAnalysis', async (filePath: string, analysisType: AnalysisType) => {
    try {
      const sessionManager = AnalysisSessionManager.getInstance();
      
      // Try to reopen existing session
      const reopened = sessionManager.reopenSession(filePath, analysisType);
      
      if (reopened) {
        vscode.window.showInformationMessage(`Reopened ${analysisType} analysis for ${filePath}`);
      } else {
        // Session might be stale, trigger new analysis
        await triggerNewAnalysis(filePath, analysisType);
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to reopen analysis: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

/**
 * Registers the close analysis command
 */
function registerCloseAnalysisCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.closeAnalysis', async (treeItem?: any) => {
    try {
      let filePath: string;
      let analysisType: AnalysisType;

      if (treeItem && treeItem.session) {
        // Called from tree context menu
        filePath = treeItem.session.filePath;
        analysisType = treeItem.session.analysisType;
      } else {
        // Called directly with parameters
        filePath = arguments[0];
        analysisType = arguments[1];
      }

      if (!filePath || !analysisType) {
        vscode.window.showErrorMessage('Invalid analysis session');
        return;
      }

      const sessionManager = AnalysisSessionManager.getInstance();
      sessionManager.closeSession(filePath, analysisType);
      
      vscode.window.showInformationMessage(`Closed ${analysisType} analysis for ${filePath.split('/').pop()}`);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to close analysis: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

/**
 * Checks for duplicate analysis and prompts user for action
 */
export async function checkForDuplicateAnalysis(filePath: string, analysisType: AnalysisType): Promise<'proceed' | 'reopen' | 'cancel'> {
  const sessionManager = AnalysisSessionManager.getInstance();
  
  if (!sessionManager.hasSession(filePath, analysisType)) {
    return 'proceed'; // No duplicate, proceed with new analysis
  }

  const fileName = filePath.split('/').pop() || filePath;
  const message = `A ${analysisType} analysis is already active for "${fileName}". What would you like to do?`;
  
  const choice = await vscode.window.showInformationMessage(
    message,
    { modal: true },
    'Reopen Existing',
    'Close & Start Fresh',
    'Cancel'
  );

  switch (choice) {
    case 'Reopen Existing':
      const reopened = sessionManager.reopenSession(filePath, analysisType);
      if (reopened) {
        return 'reopen';
      } else {
        // Session was stale, close it and proceed with new
        sessionManager.closeSession(filePath, analysisType);
        return 'proceed';
      }
    
    case 'Close & Start Fresh':
      sessionManager.closeSession(filePath, analysisType);
      return 'proceed';
    
    default:
      return 'cancel';
  }
}

/**
 * Triggers a new analysis based on type
 */
async function triggerNewAnalysis(filePath: string, analysisType: AnalysisType): Promise<void> {
  const fileUri = vscode.Uri.file(filePath);

  switch (analysisType) {
    case AnalysisType.XR:
      await vscode.commands.executeCommand('codexr.analyzeFile3D', fileUri);
      break;
    case AnalysisType.STATIC:
      await vscode.commands.executeCommand('codexr.analyzeFile', fileUri);
      break;
    case AnalysisType.DOM:
      await vscode.commands.executeCommand('codexr.showDOMVisualization', fileUri);
      break;
    default:
      throw new Error(`Unknown analysis type: ${analysisType}`);
  }
}
