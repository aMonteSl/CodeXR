import * as vscode from 'vscode';
import * as path from 'path';
import { analyzeFile } from '../codeAnalyzer';
import { FileAnalysis, CodeMetrics } from '../models/analysisModel';
import { TreeItem } from '../../ui/treeItems/baseItems';
import { TreeItemType } from '../../ui/treeProvider';

/**
 * Specialized tree item for JavaScript files with analysis metrics
 */
export class JavaScriptFileItem extends TreeItem {
  constructor(
    public readonly label: string,
    public readonly filePath: string,
    public readonly metrics?: CodeMetrics
  ) {
    // Create tooltip text first
    const tooltipText = metrics 
      ? `${label}\n\nLines: ${metrics.totalLines}\nCode: ${metrics.codeLines}\nComments: ${metrics.commentLines}\nBlank: ${metrics.blankLines}\nFunctions: ${metrics.functionCount}\nClasses: ${metrics.classCount}`
      : label;
    
    // Create description text
    const description = metrics 
      ? `${metrics.totalLines} lines, ${metrics.functionCount} functions` 
      : 'not analyzed';
    
    super(
      label,
      tooltipText, // Pass tooltipText here instead of description
      TreeItemType.JS_FILE,
      vscode.TreeItemCollapsibleState.None,
      undefined,
      new vscode.ThemeIcon('file-code')
    );
    
    // Set description separately since we used tooltip in the super constructor
    this.description = description;
    
    // Set resource URI properly
    this.resourceUri = vscode.Uri.file(filePath);
    
    // Set command to open file
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [vscode.Uri.file(filePath)]
    };
  }
}

/**
 * Provider for JavaScript analysis tree items
 */
export class AnalysisTreeProvider {
  /**
   * Constructor for the Analysis Tree Provider
   * @param context Extension context for storage
   */
  constructor(private readonly context: vscode.ExtensionContext) {}
  
  /**
   * Gets JavaScript files with analysis metrics
   * @returns Tree items for JavaScript files with metrics
   */
  public async getJavaScriptFilesChildren(): Promise<TreeItem[]> {
    try {
      if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return [];
      }
      
      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      
      // Find JavaScript files in the workspace
      const jsFiles = await vscode.workspace.findFiles(
        '{**/*.js,**/*.jsx}',
        '**/node_modules/**'
      );
      
      // Limit to 10 files for performance
      const filesToAnalyze = jsFiles.slice(0, 10);
      
      // Analyze each file and create tree items
      const items: TreeItem[] = [];
      
      for (const file of filesToAnalyze) {
        try {
          // Check if we have cached analysis first
          const cachedAnalysis = this.context.globalState.get(`jsAnalysis:${file.fsPath}`) as FileAnalysis | undefined;
          
          if (cachedAnalysis) {
            items.push(new JavaScriptFileItem(
              path.basename(file.fsPath),
              file.fsPath,
              cachedAnalysis.metrics
            ));
          } else {
            // Analyze file if not cached
            const analysis = await analyzeFile(file.fsPath);
            
            // Cache the analysis for future use
            this.context.globalState.update(`jsAnalysis:${file.fsPath}`, analysis);
            
            items.push(new JavaScriptFileItem(
              path.basename(file.fsPath),
              file.fsPath,
              analysis.metrics
            ));
          }
        } catch (error) {
          console.error(`Error analyzing file ${file.fsPath}:`, error);
          
          // Add file without metrics
          items.push(new JavaScriptFileItem(
            path.basename(file.fsPath),
            file.fsPath
          ));
        }
      }
      
      return items;
    } catch (error) {
      console.error('Error getting JavaScript files:', error);
      return [];
    }
  }
  
  /**
   * Creates a container item for JavaScript files
   * @returns Container tree item for JavaScript files
   */
  public getJavaScriptFilesContainer(): TreeItem {
    return new TreeItem(
      "JavaScript Files",
      "JavaScript files in the project",
      TreeItemType.JS_FILES_CONTAINER,
      vscode.TreeItemCollapsibleState.Collapsed,
      undefined,
      new vscode.ThemeIcon('folder')
    );
  }
}