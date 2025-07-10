import * as vscode from 'vscode';
import { directoryAnalysisService } from '../../analysis/static/directory/common/directoryAnalysisService';
import { DEFAULT_DEEP_FILTERS } from '../../analysis/static/directory/common/directoryAnalysisConfig';

/**
 * Command handler for deep directory analysis (static mode)
 */
export async function analyzeDirectoryDeepStatic(directoryUri?: vscode.Uri): Promise<void> {
  try {
    let targetPath: string;

    if (directoryUri) {
      // Called from context menu
      targetPath = directoryUri.fsPath;
    } else {
      // Called from command palette - show folder picker
      const selectedFolder = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Directory for Deep Analysis'
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

    // Get extension context
    const context = await getExtensionContext();
    if (!context) {
      vscode.window.showErrorMessage('Extension context not available');
      return;
    }

    console.log(`🔍 Starting deep directory analysis: ${targetPath}`);

    // Perform deep directory analysis with explicit deep filters
    await directoryAnalysisService.analyzeDirectory(
      context, 
      targetPath, 
      { 
        recursive: true, // Deep analysis mode
        filters: DEFAULT_DEEP_FILTERS // Use deep filters with maxDepth: 50
      },
      false // Not project-level
    );

    console.log(`✅ Deep directory analysis completed: ${targetPath}`);

  } catch (error) {
    console.error('Error in deep directory analysis command:', error);
    vscode.window.showErrorMessage(
      `Deep directory analysis failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Command handler for deep project analysis (static mode)
 */
export async function analyzeProjectDeepStatic(uri?: vscode.Uri): Promise<void> {
  try {
    // Get current workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder is open');
      return;
    }

    const projectPath = workspaceFolder.uri.fsPath;

    // Get extension context
    const context = await getExtensionContext();
    if (!context) {
      vscode.window.showErrorMessage('Extension context not available');
      return;
    }

    // Always analyze the workspace root, regardless of which folder was right-clicked
    console.log(`🔍 Starting deep project analysis - using workspace root: ${projectPath}`);

    // Perform deep project analysis with explicit deep filters
    await directoryAnalysisService.analyzeDirectory(
      context, 
      projectPath, 
      { 
        recursive: true, // Deep analysis mode
        filters: DEFAULT_DEEP_FILTERS // Use deep filters with maxDepth: 50
      },
      true // Project-level
    );

    console.log(`✅ Deep project analysis completed: ${projectPath}`);

  } catch (error) {
    console.error('Error in deep project analysis command:', error);
    vscode.window.showErrorMessage(
      `Deep project analysis failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Gets the current extension context
 */
async function getExtensionContext(): Promise<vscode.ExtensionContext | undefined> {
  // This will be set by the main extension activation
  return (global as any).codexrExtensionContext;
}
