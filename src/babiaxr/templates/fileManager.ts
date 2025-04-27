import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileWatchManager } from '../../analysis/fileWatchManager';
import { injectVisualizationLiveReloadScript } from '../../server/liveReloadManager';

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
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }
    
    // Create a subdirectory for data
    const dataDir = path.join(projectDir, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Save the HTML file in the project folder
    const htmlPath = path.join(projectDir, 'index.html');
    
    // Handle the data file
    let finalDataPath = '';
    if (originalDataPath && !isRemoteData) {
      try {
        // Create a cleaner file name
        const cleanFileName = path.basename(originalDataPath)
          .replace(/^temp_/, '')  // Remove temp_ prefix
          .replace(/_\d+\.json$/, '.json');  // Remove timestamp
        
        const destDataPath = path.join(dataDir, cleanFileName);
        
        console.log(`Attempting to copy data file from ${originalDataPath} to ${destDataPath}`);
        
        // Verify the source file
        if (!fs.existsSync(originalDataPath)) {
          console.error(`Original data file not found: ${originalDataPath}`);
          vscode.window.showWarningMessage(`Data file not found: ${originalDataPath}`);
          
          const errorMsg = `Could not find the data file at ${originalDataPath}. Check if the file exists and has proper permissions.`;
          vscode.window.showErrorMessage(errorMsg);
          
          throw new Error(errorMsg);
        }
        
        // Get the content directly
        const dataContent = fs.readFileSync(originalDataPath, 'utf8');
        
        // Write directly to the destination
        fs.writeFileSync(destDataPath, dataContent);
        
        console.log(`Successfully copied data to ${destDataPath}`);
        
        // Update the URL in the HTML to point to the new file
        const relativeDataPath = path.join('data', cleanFileName);
        html = html.replace(/babia-queryjson="url: .*?"/, `babia-queryjson="url: ${relativeDataPath}"`);
        
        // After copying data, get the final data path
        finalDataPath = destDataPath;
        
        // Register watcher for the data file (new code)
        // Get the FileWatchManager instance
        const fileWatchManager = FileWatchManager.getInstance();
        if (fileWatchManager) {
          // Register this JSON file for watching
          fileWatchManager.watchVisualizationDataFile(finalDataPath, htmlPath);
        }
      } catch (error) {
        console.error(`Error handling data file:`, error);
        vscode.window.showErrorMessage(`Error handling data file: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Add visualization-specific live reload capability
    html = injectVisualizationLiveReloadScript(html);
    
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