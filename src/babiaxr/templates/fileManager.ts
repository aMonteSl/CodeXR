import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Saves processed HTML content to a file and copies related data files
 */
export async function saveHtmlToFile(
  html: string, 
  fileName: string, 
  originalDataPath?: string, 
  isRemoteData: boolean = false
): Promise<string | undefined> {
  try {
    // Request directory name
    const projectName = await vscode.window.showInputBox({
      prompt: 'Name of the directory for the visualization',
      placeHolder: 'my-visualization',
      value: path.basename(fileName, '.html').toLowerCase().replace(/\s+/g, '-')
    });
    
    if (!projectName) return undefined;
    
    // Determine base directory
    let baseDir = vscode.workspace.workspaceFolders ? 
      vscode.workspace.workspaceFolders[0].uri.fsPath : 
      require('os').homedir();
    
    // Request location
    const dirOptions: vscode.OpenDialogOptions = {
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select folder for the project'
    };
    
    const selectedDir = await vscode.window.showOpenDialog(dirOptions);
    if (selectedDir && selectedDir.length > 0) {
      baseDir = selectedDir[0].fsPath;
    }
    
    // Create project directory
    const projectDir = path.join(baseDir, projectName);
    
    // Handle existing directory case
    if (fs.existsSync(projectDir)) {
      const overwrite = await vscode.window.showWarningMessage(
        `The folder '${projectName}' already exists. Do you want to overwrite its contents?`,
        'Overwrite', 'Cancel'
      );
      
      if (overwrite !== 'Overwrite') {
        return undefined;
      }
    } else {
      fs.mkdirSync(projectDir, { recursive: true });
    }
    
    // Save the HTML file in the project folder
    const htmlPath = path.join(projectDir, 'index.html');
    
    // Copy the JSON data file
    if (originalDataPath && !isRemoteData) {
      const dataFileName = path.basename(originalDataPath);
      const destDataPath = path.join(projectDir, dataFileName);
      
      // Copy the file
      fs.copyFileSync(originalDataPath, destDataPath);
      
      // Update the URL in the HTML
      html = html.replace(/babia-queryjson="url: .*?"/, `babia-queryjson="url: ${dataFileName}"`);
    }
    
    // Save the HTML
    fs.writeFileSync(htmlPath, html);
    
    // Success message
    vscode.window.showInformationMessage(
      `Visualization created in: ${projectDir}`,
      'Open folder'
    ).then(selection => {
      if (selection === 'Open folder') {
        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(projectDir));
      }
    });
    
    return htmlPath;
  } catch (error) {
    vscode.window.showErrorMessage(`Error saving project: ${error}`);
    return undefined;
  }
}

/**
 * Exports a visualization to a specified directory
 * @param html HTML content to save
 * @param dataFiles Map of data files to copy (filename -> content)
 * @returns Path to the exported HTML file or undefined if operation was cancelled
 */
export async function exportVisualization(
  html: string,
  dataFiles: Map<string, Buffer | string>
): Promise<string | undefined> {
  try {
    // Ask for export location
    const options: vscode.SaveDialogOptions = {
      defaultUri: vscode.Uri.file(path.join(
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || require('os').homedir(),
        'visualization.html'
      )),
      filters: {
        'HTML files': ['html'],
      },
      title: 'Export Visualization'
    };
    
    const fileUri = await vscode.window.showSaveDialog(options);
    if (!fileUri) {
      return undefined;
    }
    
    const htmlPath = fileUri.fsPath;
    const dirPath = path.dirname(htmlPath);
    
    // Save the HTML file
    fs.writeFileSync(htmlPath, html);
    
    // Save all data files in the same directory
    for (const [filename, content] of dataFiles.entries()) {
      const filePath = path.join(dirPath, filename);
      if (typeof content === 'string') {
        fs.writeFileSync(filePath, content);
      } else {
        fs.writeFileSync(filePath, content);
      }
    }
    
    return htmlPath;
  } catch (error) {
    vscode.window.showErrorMessage(`Error exporting visualization: ${error}`);
    return undefined;
  }
}