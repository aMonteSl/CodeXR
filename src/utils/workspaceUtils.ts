import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Opens a folder in the workspace
 * @param folderPath Path to the folder to open
 * @param openInNewWindow Whether to open in a new window
 */
export async function openFolderInWorkspace(folderPath: string, openInNewWindow: boolean = false): Promise<void> {
  const folderUri = vscode.Uri.file(folderPath);
  
  if (openInNewWindow) {
    // Open in a new window
    await vscode.commands.executeCommand('vscode.openFolder', folderUri, { forceNewWindow: true });
  } else {
    // Get the current workspace folders
    const currentFolders = vscode.workspace.workspaceFolders || [];
    
    if (currentFolders.length === 0) {
      // If there are no workspace folders, simply open this folder
      await vscode.commands.executeCommand('vscode.openFolder', folderUri);
    } else {
      // Add this folder to the workspace
      const success = vscode.workspace.updateWorkspaceFolders(
        currentFolders.length, // index to start deletion
        0, // number of folders to delete
        { uri: folderUri, name: path.basename(folderPath) }
      );
      
      if (success) {
        // Reveal the folder in the explorer
        await vscode.commands.executeCommand('revealInExplorer', folderUri);
      } else {
        vscode.window.showErrorMessage(`Failed to add ${path.basename(folderPath)} to workspace`);
      }
    }
  }
}