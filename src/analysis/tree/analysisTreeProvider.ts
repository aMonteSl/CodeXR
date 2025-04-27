import * as vscode from 'vscode';
import * as path from 'path';
import { TreeItem } from '../../ui/treeItems/baseItems';
import { TreeItemType } from '../../ui/treeProvider';
import { 
  AnalysisSectionItem, 
  LanguageGroupItem, 
  AnalysisFileItem,
  AnalysisSettingsItem,
  AnalysisModeOptionItem
} from './analysisTreeItems';

/**
 * Provider for code analysis tree items
 */
export class AnalysisTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined> = new vscode.EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> = this._onDidChangeTreeData.event;

  /**
   * Constructor for the Analysis Tree Provider
   * @param context Extension context for storage
   */
  constructor(private readonly context: vscode.ExtensionContext) {}
  
  /**
   * Method to refresh the tree view
   * @param element Optional element to refresh
   */
  public refresh(element?: TreeItem): void {
    console.log('Refreshing tree view', element?.label);
    this._onDidChangeTreeData.fire(element);
  }

  /**
   * Required implementation for TreeDataProvider
   */
  public getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Required implementation - gets children of a tree item
   */
  public getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if (!element) {
      return getAnalysisChildren(this.context);
    }
    
    console.log('Getting children for element type:', element.contextValue);
    
    switch (element.contextValue) {
      case TreeItemType.ANALYSIS_LANGUAGE_GROUP:
        return getLanguageGroupChildren(element);
      case TreeItemType.ANALYSIS_SETTINGS:
        console.log('Getting settings children');
        return this.getSettingsChildren(this.context.extensionUri.fsPath);
      default:
        return Promise.resolve([]);
    }
  }
  
  /**
   * Gets settings child items
   * @param extensionPath Path to the extension
   * @returns Settings option items
   */
  private async getSettingsChildren(extensionPath: string): Promise<TreeItem[]> {
    console.log('Generating settings children items');
    const config = vscode.workspace.getConfiguration();
    const currentMode = config.get<string>('codexr.analysisMode', 'Static');
    
    console.log('Current analysis mode:', currentMode);
    
    // Create option items for each analysis mode
    const staticOption = new AnalysisModeOptionItem('Static', currentMode === 'Static', extensionPath);
    const xrOption = new AnalysisModeOptionItem('XR', currentMode === 'XR', extensionPath);
    
    return [staticOption, xrOption];
  }
}

/**
 * Gets child elements of the analysis section
 * @returns Tree items for analysis section
 */
export async function getAnalysisChildren(context: vscode.ExtensionContext): Promise<TreeItem[]> {
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    // No workspace is open
    return [createNoWorkspaceItem()];
  }
  
  try {
    // Create settings item
    const extensionPath = context.extensionUri.fsPath;
    const settingsItem = new AnalysisSettingsItem(extensionPath);
    
    // Get all analyzable files and group by language
    const filesByLanguage = await getAnalyzableFilesByLanguage();
    
    if (Object.keys(filesByLanguage).length === 0) {
      // No analyzable files found
      return [settingsItem, createNoFilesItem()];
    }
    
    // Create language group items
    const languageGroups: TreeItem[] = [];
    
    // Sort languages alphabetically (A → Z)
    for (const language of Object.keys(filesByLanguage).sort()) {
      const files = filesByLanguage[language];
      
      // Sort files alphabetically by filename (A → Z)
      files.sort((a, b) => {
        const aName = path.basename(a.fsPath).toLowerCase();
        const bName = path.basename(b.fsPath).toLowerCase();
        return aName.localeCompare(bName);
      });
      
      const languageGroup = new LanguageGroupItem(language, files.length, extensionPath);
      
      // Add file items as children to the language group
      languageGroup.children = files.map(fileUri => new AnalysisFileItem(fileUri, extensionPath));
      
      languageGroups.push(languageGroup);
    }
    
    // Return settings first, then language groups
    return [settingsItem, ...languageGroups];
  } catch (error) {
    console.error('Error fetching analyzable files:', error);
    return [createErrorItem(error)];
  }
}

/**
 * Gets child elements of a language group
 * @param groupItem The language group item
 * @returns Tree items for files in the language group
 */
export function getLanguageGroupChildren(groupItem: TreeItem): Thenable<TreeItem[]> {
  if (groupItem.children) {
    return Promise.resolve(groupItem.children);
  }
  return Promise.resolve([]);
}

/**
 * Creates the section item for code analysis
 * @returns Section tree item for code analysis
 */
export function getAnalysisSectionItem(extensionPath: string): TreeItem {
  return new AnalysisSectionItem(extensionPath);
}

/**
 * Gets analyzable files from workspace grouped by language
 * @returns Map of language to file URIs
 */
async function getAnalyzableFilesByLanguage(): Promise<Record<string, vscode.Uri[]>> {
  const supportedExtensions = ['.py', '.js', '.ts', '.c'];
  const result: Record<string, vscode.Uri[]> = {};
  
  // Skip finding files if no workspace is open
  if (!vscode.workspace.workspaceFolders) {
    return result;
  }
  
  // Exclude common non-user code directories and patterns
  const excludePattern = '{**/node_modules/**,**/.venv/**,**/venv/**,**/.git/**,**/env/**,**/__pycache__/**}';
  
  for (const ext of supportedExtensions) {
    const language = getLanguageFromExtension(ext);
    
    // Find files with the current extension
    let files = await vscode.workspace.findFiles(`**/*${ext}`, excludePattern);
    
    // Apply additional filtering for Python files
    if (ext === '.py') {
      files = files.filter(file => shouldIncludePythonFile(file));
    }
    
    if (files.length > 0) {
      result[language] = files;
    }
  }
  
  return result;
}

/**
 * Determines if a Python file should be included in the analysis view
 * @param fileUri URI of the Python file
 * @returns True if the file should be included, false otherwise
 */
function shouldIncludePythonFile(fileUri: vscode.Uri): boolean {
  const fileName = path.basename(fileUri.fsPath);
  const filePath = fileUri.fsPath;
  
  // Exclude files starting with __ (dunder files)
  if (fileName.startsWith('__')) {
    return false;
  }
  
  // Exclude setup.py files
  if (fileName === 'setup.py') {
    return false;
  }
  
  // Exclude files in virtual environments (additional check beyond glob pattern)
  if (/[/\\]\.?venv[/\\]|[/\\]env[/\\]|[/\\]virtualenv[/\\]|[/\\]\.python-version[/\\]/.test(filePath)) {
    return false;
  }
  
  // Exclude test files if desired
  if (fileName.startsWith('test_') || fileName.endsWith('_test.py') || /[/\\]tests?[/\\]/.test(filePath)) {
    // You can comment this line out if you want to include test files
    // return false;
  }
  
  return true;
}

/**
 * Gets language name from file extension
 */
function getLanguageFromExtension(ext: string): string {
  switch (ext) {
    case '.py':
      return 'Python';
    case '.js':
      return 'JavaScript';
    case '.ts':
      return 'TypeScript';
    case '.c':
      return 'C';
    default:
      return 'Unknown';
  }
}

/**
 * Creates an item when no workspace is open
 */
function createNoWorkspaceItem(): TreeItem {
  return new TreeItem(
    'No workspace open',
    'Open a folder to see analyzable files',
    TreeItemType.ANALYSIS_MESSAGE,
    vscode.TreeItemCollapsibleState.None,
    {
      command: 'vscode.openFolder',
      title: 'Open Folder',
      arguments: []
    },
    new vscode.ThemeIcon('folder')
  );
}

/**
 * Creates an item when no analyzable files are found
 */
function createNoFilesItem(): TreeItem {
  return new TreeItem(
    'No analyzable files found',
    'No files with supported extensions (.py, .js, .ts, .c) found in workspace',
    TreeItemType.ANALYSIS_MESSAGE,
    vscode.TreeItemCollapsibleState.None,
    undefined,
    new vscode.ThemeIcon('info')
  );
}

/**
 * Creates an error item
 */
function createErrorItem(error: any): TreeItem {
  return new TreeItem(
    'Error loading files',
    `Error: ${error instanceof Error ? error.message : String(error)}`,
    TreeItemType.ANALYSIS_MESSAGE,
    vscode.TreeItemCollapsibleState.None,
    undefined,
    new vscode.ThemeIcon('error')
  );
}