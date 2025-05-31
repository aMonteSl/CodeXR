import * as vscode from 'vscode';
import * as path from 'path';
import { TreeItem } from '../../ui/treeItems/baseItems';
import { TreeItemType } from '../../ui/treeProvider';
import { 
  AnalysisSectionItem, 
  AnalysisSettingsItem,
  LanguageGroupItem,
  AnalysisFileItem,
  AnalysisModeOptionItem,
  AnalysisDelayOptionItem,
  AnalysisAutoOptionItem
} from './analysisTreeItems';
import { DimensionMappingItem } from './dimensionMappingTreeItem'; // ✅ Añadir import

/**
 * Tree data provider for analysis section
 */
export class AnalysisTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {} // ✅ Añadir context como propiedad

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      // Root level - return analysis section
      const extensionPath = this.context.extensionUri.fsPath; // ✅ Usar context en lugar de this.extensionPath
      return [new AnalysisSectionItem(extensionPath)];
    }

    // Handle different element types
    if (!element.type) { // ✅ Verificar si existe la propiedad type
      return [];
    }

    switch (element.type) {
      case TreeItemType.ANALYSIS_SECTION:
        return getAnalysisChildren(this.context);

      case TreeItemType.ANALYSIS_SETTINGS:
        // ✅ Usar el método getChildren del AnalysisSettingsItem
        if (element instanceof AnalysisSettingsItem) {
          console.log('🔧 Using AnalysisSettingsItem.getChildren()');
          return element.getChildren();
        }
        // Fallback to old method if needed
        const extensionPath = this.context.extensionUri.fsPath; // ✅ Usar context
        return this.getSettingsChildren(extensionPath);

      case TreeItemType.ANALYSIS_LANGUAGE_GROUP:
        if (element instanceof LanguageGroupItem) {
          return element.children || [];
        }
        return [];

      case TreeItemType.DIMENSION_MAPPING:
        // ✅ AÑADIR SOPORTE PARA DIMENSION MAPPING
        if (element instanceof DimensionMappingItem) {
          console.log('🎯 Using DimensionMappingItem.getChildren()');
          return element.getChildren();
        }
        return [];

      default:
        return [];
    }
  }

  /**
   * Gets settings child items
   * @param extensionPath Path to the extension
   * @returns Settings option items
   */
  private async getSettingsChildren(extensionPath: string): Promise<TreeItem[]> {
    console.log('DEBUG: getSettingsChildren called with path:', extensionPath);
    const config = vscode.workspace.getConfiguration();
    
    // Get current mode setting
    const currentMode = config.get<string>('codexr.analysisMode', 'Static');
    
    // Get current debounce delay setting
    const debounceDelay = config.get<number>('codexr.analysis.debounceDelay', 2000);
    
    // Get current auto-analysis setting
    const autoAnalysis = config.get<boolean>('codexr.analysis.autoAnalysis', true);
    
    console.log('DEBUG: Current settings:', { 
      analysisMode: currentMode, 
      debounceDelay, 
      autoAnalysis 
    });
    
    // Create option items
    const staticOption = new AnalysisModeOptionItem('Static', currentMode === 'Static', extensionPath);
    const xrOption = new AnalysisModeOptionItem('XR', currentMode === 'XR', extensionPath);
    const delayOption = new AnalysisDelayOptionItem(debounceDelay, extensionPath);
    const autoOption = new AnalysisAutoOptionItem(autoAnalysis, extensionPath);
    
    const result = [staticOption, xrOption, delayOption, autoOption];
    console.log('DEBUG: Returning items:', result.map(item => item.label));
    return result;
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
    const settingsItem = new AnalysisSettingsItem(extensionPath, context);
    
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
      
      // ✅ ARREGLAR LA CREACIÓN DE AnalysisFileItem CON TODOS LOS ARGUMENTOS REQUERIDOS
      languageGroup.children = files.map(fileUri => {
        const filePath = fileUri.fsPath;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        let relativePath = filePath;
        
        // ✅ CALCULAR LA RUTA RELATIVA RESPECTO AL WORKSPACE
        if (workspaceFolders && workspaceFolders.length > 0) {
          const workspaceRoot = workspaceFolders[0].uri.fsPath;
          relativePath = path.relative(workspaceRoot, filePath);
        }
        
        // ✅ CREAR AnalysisFileItem CON LOS 4 ARGUMENTOS REQUERIDOS
        return new AnalysisFileItem(
          filePath,        // filePath: string
          relativePath,    // relativePath: string  
          language,        // language: string
          extensionPath    // extensionPath: string
        );
      });
      
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
  // Update supported extensions to include new languages
  const supportedExtensions = [
    '.py', '.js', '.ts', '.c', 
    '.cpp', '.cc', '.cxx', // C++
    '.cs',                 // C#
    '.vue',                // Vue
    '.rb'                  // Ruby
  ];
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
    case '.cpp':
    case '.cc':
    case '.cxx':
      return 'C++';
    case '.cs':
      return 'C#';
    case '.vue':
      return 'Vue';
    case '.rb':
      return 'Ruby';
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