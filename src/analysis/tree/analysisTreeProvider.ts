import * as vscode from 'vscode';
import * as path from 'path';
import { TreeItem } from '../../ui/treeItems/baseItems';
import { TreeItemType } from '../../ui/treeProvider';
import { 
  AnalysisSectionItem,
  AnalysisFileItem,
  AnalysisSettingsItem
} from './analysisTreeItems';
import { DimensionMappingItem } from './dimensionMappingTreeItem';

/**
 * Tree data provider for analysis section
 */
export class AnalysisTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      return getAnalysisChildren(this.context);
    }

    switch (element.type) {
      case TreeItemType.ANALYSIS_SETTINGS:
        return this.getSettingsChildren(this.context.extensionPath);
      case TreeItemType.ANALYSIS_LANGUAGE_GROUP:
        return getLanguageGroupChildren(element);
      case TreeItemType.DIMENSION_MAPPING:
        if (element instanceof DimensionMappingItem) {
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
    const settingsItem = new AnalysisSettingsItem(extensionPath, this.context);
    return settingsItem.getChildren();
  }
}

/**
 * Gets child elements of the analysis section
 * @returns Tree items for analysis section
 */
export async function getAnalysisChildren(context: vscode.ExtensionContext): Promise<TreeItem[]> {
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    return [createNoWorkspaceItem()];
  }
  
  try {
    // Get analyzable files grouped by language
    const filesByLanguage = await getAnalyzableFilesByLanguage();
    const items: TreeItem[] = [];
    
    // Add settings first
    items.push(new AnalysisSettingsItem(context.extensionPath, context));
    
    // Create language group items
    for (const [language, files] of Object.entries(filesByLanguage)) {
      if (files.length > 0) {
        const languageGroupItem = new LanguageGroupItem(language, files.length, context.extensionPath);
        
        // Create file items for this language
        const fileItems = files.map(fileUri => {
          const filePath = fileUri.fsPath;
          const relativePath = vscode.workspace.asRelativePath(filePath);
          return new AnalysisFileItem(filePath, relativePath, language, context.extensionPath);
        });
        
        languageGroupItem.children = fileItems;
        items.push(languageGroupItem);
      }
    }
    
    if (items.length === 1) { // Only settings item
      items.push(createNoFilesItem());
    }
    
    return items;
  } catch (error) {
    console.error('Error getting analysis children:', error);
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
 */
async function getAnalyzableFilesByLanguage(): Promise<Record<string, vscode.Uri[]>> {
  const supportedExtensions = [
    '.py', '.js', '.ts', '.c', 
    '.cpp', '.cc', '.cxx', '.h', '.hpp',
    '.cs', '.java', '.vue', '.rb',
    '.m', '.mm',    // Objective-C
    '.swift',       // Swift
    '.ttcn3', '.ttcn', '.3mp',  // TTCN-3
    '.php', '.phtml', '.php3', '.php4', '.php5', '.phps',  // PHP
    '.scala', '.sc',  // Scala
    '.gd',          // GDScript
    '.go',          // Golang
    '.lua',         // Lua
    '.rs',          // Rust
    '.f', '.f77', '.f90', '.f95', '.f03', '.f08', '.for', '.ftn',  // Fortran
    '.kt', '.kts',  // Kotlin
    '.sol',         // Solidity
    '.erl', '.hrl', // Erlang
    '.zig',         // Zig
    '.pl', '.pm', '.pod', '.t'  // Perl
  ];
  const result: Record<string, vscode.Uri[]> = {};
  
  // Skip finding files if no workspace is open
  if (!vscode.workspace.workspaceFolders) {
    return result;
  }
  
  // Exclude common non-user code directories and patterns
  const excludePattern = '{**/node_modules/**,**/.venv/**,**/venv/**,**/.git/**,**/env/**,**/__pycache__/**,**/target/**,**/build/**,**/DerivedData/**,**/Pods/**,**/vendor/**,**/Cargo.toml,**/go.mod}';
  
  for (const ext of supportedExtensions) {
    const files = await vscode.workspace.findFiles(`**/*${ext}`, excludePattern);
    
    if (files.length > 0) {
      // Filter files based on language-specific rules
      let filteredFiles: vscode.Uri[] = [];
      
      if (ext === '.py') {
        filteredFiles = files.filter(shouldIncludePythonFile);
      } else if (ext === '.java') {
        filteredFiles = files.filter(shouldIncludeJavaFile);
      } else if (ext === '.m' || ext === '.mm') {
        filteredFiles = files.filter(shouldIncludeObjectiveCFile);
      } else if (ext === '.swift') {
        filteredFiles = files.filter(shouldIncludeSwiftFile);
      } else if (ext === '.ttcn3' || ext === '.ttcn' || ext === '.3mp') {
        filteredFiles = files.filter(shouldIncludeTTCN3File);
      } else if (ext === '.php' || ext === '.phtml' || ext === '.php3' || ext === '.php4' || ext === '.php5' || ext === '.phps') {
        filteredFiles = files.filter(shouldIncludePHPFile);
      } else if (ext === '.scala' || ext === '.sc') {
        filteredFiles = files.filter(shouldIncludeScalaFile);
      } else if (ext === '.go') {
        filteredFiles = files.filter(shouldIncludeGoFile);
      } else if (ext === '.rs') {
        filteredFiles = files.filter(shouldIncludeRustFile);
      } else if (ext === '.kt' || ext === '.kts') {
        filteredFiles = files.filter(shouldIncludeKotlinFile);
      } else {
        filteredFiles = files;
      }
      
      if (filteredFiles.length > 0) {
        const language = getLanguageFromExtension(ext);
        result[language] = (result[language] || []).concat(filteredFiles);
      }
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
    return false;
  }
  
  return true;
}

/**
 * Determines if a Java file should be included in the analysis view
 * @param fileUri URI of the Java file
 * @returns True if the file should be included, false otherwise
 */
function shouldIncludeJavaFile(fileUri: vscode.Uri): boolean {
  const fileName = path.basename(fileUri.fsPath);
  const filePath = fileUri.fsPath;
  
  // Exclude files in build directories
  if (/[/\\](target|build|out)[/\\]/.test(filePath)) {
    return false;
  }
  
  // Exclude Maven/Gradle wrapper files
  if (fileName.includes('wrapper') || fileName.startsWith('mvnw') || fileName.startsWith('gradlew')) {
    return false;
  }
  
  // Exclude test files (optional - you might want to analyze these)
  if (fileName.endsWith('Test.java') || fileName.endsWith('Tests.java') || /[/\\](test|tests)[/\\]/.test(filePath)) {
    return false;
  }
  
  return true;
}

/**
 * Determines if an Objective-C file should be included
 */
function shouldIncludeObjectiveCFile(fileUri: vscode.Uri): boolean {
  const fileName = path.basename(fileUri.fsPath);
  const filePath = fileUri.fsPath;
  
  // Exclude files in build directories
  if (/[/\\](build|DerivedData|Pods)[/\\]/.test(filePath)) {
    return false;
  }
  
  // Exclude test files (optional)
  if (fileName.endsWith('Test.m') || fileName.endsWith('Tests.m') || /[/\\](test|tests)[/\\]/.test(filePath)) {
    return false;
  }
  
  return true;
}

/**
 * Determines if a Swift file should be included
 */
function shouldIncludeSwiftFile(fileUri: vscode.Uri): boolean {
  const fileName = path.basename(fileUri.fsPath);
  const filePath = fileUri.fsPath;
  
  // Exclude files in build directories
  if (/[/\\](build|DerivedData|Pods)[/\\]/.test(filePath)) {
    return false;
  }
  
  // Exclude test files (optional)
  if (fileName.endsWith('Test.swift') || fileName.endsWith('Tests.swift') || /[/\\](test|tests)[/\\]/.test(filePath)) {
    return false;
  }
  
  return true;
}

/**
 * Determines if a TTCN-3 file should be included
 */
function shouldIncludeTTCN3File(fileUri: vscode.Uri): boolean {
  const fileName = path.basename(fileUri.fsPath);
  const filePath = fileUri.fsPath;
  
  // Exclude files in build directories
  if (/[/\\](build|out|target)[/\\]/.test(filePath)) {
    return false;
  }
  
  // Exclude temporary files
  if (fileName.startsWith('.') || fileName.endsWith('.tmp')) {
    return false;
  }
  
  return true;
}

/**
 * Determines if a PHP file should be included
 */
function shouldIncludePHPFile(fileUri: vscode.Uri): boolean {
  const fileName = path.basename(fileUri.fsPath);
  const filePath = fileUri.fsPath;
  
  // Exclude files in vendor directories (Composer packages)
  if (/[/\\]vendor[/\\]/.test(filePath)) {
    return false;
  }
  
  // Exclude files in cache directories
  if (/[/\\](cache|tmp|temp)[/\\]/.test(filePath)) {
    return false;
  }
  
  // Exclude test files (optional)
  if (fileName.endsWith('Test.php') || fileName.endsWith('Tests.php') || /[/\\](test|tests)[/\\]/.test(filePath)) {
    return false;
  }
  
  return true;
}

/**
 * Determines if a Scala file should be included
 */
function shouldIncludeScalaFile(fileUri: vscode.Uri): boolean {
  const fileName = path.basename(fileUri.fsPath);
  const filePath = fileUri.fsPath;
  
  // Exclude files in build directories
  if (/[/\\](target|build|out|project)[/\\]/.test(filePath)) {
    return false;
  }
  
  // Exclude test files (optional)
  if (fileName.endsWith('Test.scala') || fileName.endsWith('Tests.scala') || fileName.endsWith('Spec.scala') || /[/\\](test|tests)[/\\]/.test(filePath)) {
    return false;
  }
  
  return true;
}

/**
 * Determines if a Go file should be included
 */
function shouldIncludeGoFile(fileUri: vscode.Uri): boolean {
  const fileName = path.basename(fileUri.fsPath);
  const filePath = fileUri.fsPath;
  
  // Exclude files in vendor directories
  if (/[/\\]vendor[/\\]/.test(filePath)) {
    return false;
  }
  
  // Exclude test files (optional)
  if (fileName.endsWith('_test.go') || /[/\\](test|tests)[/\\]/.test(filePath)) {
    return false;
  }
  
  return true;
}

/**
 * Determines if a Rust file should be included
 */
function shouldIncludeRustFile(fileUri: vscode.Uri): boolean {
  const fileName = path.basename(fileUri.fsPath);
  const filePath = fileUri.fsPath;
  
  // Exclude files in target directories
  if (/[/\\]target[/\\]/.test(filePath)) {
    return false;
  }
  
  // Exclude test files in tests directory (optional)
  if (/[/\\]tests[/\\]/.test(filePath)) {
    return false;
  }
  
  return true;
}

/**
 * Determines if a Kotlin file should be included
 */
function shouldIncludeKotlinFile(fileUri: vscode.Uri): boolean {
  const fileName = path.basename(fileUri.fsPath);
  const filePath = fileUri.fsPath;
  
  // Exclude files in build directories
  if (/[/\\](build|target|out)[/\\]/.test(filePath)) {
    return false;
  }
  
  // Exclude test files (optional)
  if (fileName.endsWith('Test.kt') || fileName.endsWith('Tests.kt') || /[/\\](test|tests)[/\\]/.test(filePath)) {
    return false;
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
    case '.h':
      return 'C Header';
    case '.cpp':
    case '.cc':
    case '.cxx':
      return 'C++';
    case '.hpp':
    case '.hxx':
      return 'C++ Header';
    case '.cs':
      return 'C#';
    case '.java':
      return 'Java';
    case '.vue':
      return 'Vue';
    case '.rb':
      return 'Ruby';
    case '.m':
      return 'Objective-C';
    case '.mm':
      return 'Objective-C++';
    case '.swift':
      return 'Swift';
    case '.ttcn3':
    case '.ttcn':
    case '.3mp':
      return 'TTCN-3';
    case '.php':
    case '.phtml':
    case '.php3':
    case '.php4':
    case '.php5':
    case '.phps':
      return 'PHP';
    case '.scala':
    case '.sc':
      return 'Scala';
    case '.gd':
      return 'GDScript';
    case '.go':
      return 'Go';
    case '.lua':
      return 'Lua';
    case '.rs':
      return 'Rust';
    case '.f':
    case '.f77':
    case '.for':
    case '.ftn':
      return 'Fortran 77';
    case '.f90':
    case '.f95':
    case '.f03':
    case '.f08':
      return 'Fortran';
    case '.kt':
      return 'Kotlin';
    case '.kts':
      return 'Kotlin Script';
    case '.sol':
      return 'Solidity';
    case '.erl':
      return 'Erlang';
    case '.hrl':
      return 'Erlang Header';
    case '.zig':
      return 'Zig';
    case '.pl':
      return 'Perl';
    case '.pm':
      return 'Perl Module';
    case '.pod':
      return 'Perl POD';
    case '.t':
      return 'Perl Test';
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
    'No files with supported extensions found in workspace',
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

/**
 * ✅ RESTAURAR LanguageGroupItem USANDO ICONOS PNG
 * Container for language file groups
 */
class LanguageGroupItem extends TreeItem {
  constructor(language: string, fileCount: number, extensionPath: string) {
    // ✅ USAR LA FUNCIÓN getLanguageIcon RESTAURADA
    const languageIcon = getLanguageIcon(language, extensionPath);
    
    super(
      language,
      `${language} files that can be analyzed`,
      TreeItemType.ANALYSIS_LANGUAGE_GROUP,
      vscode.TreeItemCollapsibleState.Expanded,
      undefined,
      languageIcon // ✅ USAR EL ICONO DE LA FUNCIÓN
    );
    
    this.description = `(${fileCount} files)`;
  }
}

/**
 * ✅ RESTAURAR LA FUNCIÓN getLanguageIcon CON ICONOS PNG
 * Gets appropriate icon for language using PNG files
 */
function getLanguageIcon(language: string, extensionPath: string): any {
  let iconFileName: string;
  
  switch (language) {
    case 'Python':
      iconFileName = 'python.png';
      break;
    case 'JavaScript':
      iconFileName = 'javascript.png';
      break;
    case 'TypeScript':
      iconFileName = 'typescript.png';
      break;
    case 'Java':
      iconFileName = 'java.png';
      break;
    case 'C':
    case 'C Header':
      iconFileName = 'c.png';
      break;
    case 'C++':
    case 'C++ Header':
      iconFileName = 'cpp.png';
      break;
    case 'C#':
      iconFileName = 'csharp.png';
      break;
    case 'Vue':
      iconFileName = 'vue.png';
      break;
    case 'Ruby':
      iconFileName = 'ruby.png';
      break;
    case 'Objective-C':
    case 'Objective-C++':
      iconFileName = 'objective-c.png';
      break;
    case 'Swift':
      iconFileName = 'swift.png';
      break;
    case 'TTCN-3':
      iconFileName = 'ttcn3.png';
      break;
    case 'PHP':
      iconFileName = 'php.png';
      break;
    case 'Scala':
      iconFileName = 'scala.png';
      break;
    // ✅ AÑADIR ICONOS PARA NUEVOS LENGUAJES
    case 'GDScript':
      iconFileName = 'gdscript.png';
      break;
    case 'Go':
      iconFileName = 'go.png';
      break;
    case 'Lua':
      iconFileName = 'lua.png';
      break;
    case 'Rust':
      iconFileName = 'rust.png';
      break;
    case 'Fortran':
    case 'Fortran 77':
      iconFileName = 'fortran.png';
      break;
    case 'Kotlin':
    case 'Kotlin Script':
      iconFileName = 'kotlin.png';
      break;
    case 'Solidity':
      iconFileName = 'solidity.png';
      break;
    case 'Erlang':
    case 'Erlang Header':
      iconFileName = 'erlang.png';
      break;
    case 'Zig':
      iconFileName = 'zig.png';
      break;
    case 'Perl':
    case 'Perl Module':
    case 'Perl POD':
    case 'Perl Test':
      iconFileName = 'perl.png';
      break;
    default:
      iconFileName = 'file-code.png';
  }
  
  console.log(`🎨 Language: "${language}" → Icon: "${iconFileName}"`);
  
  return {
    light: vscode.Uri.file(path.join(extensionPath, 'resources', 'languajes_icons', iconFileName)),
    dark: vscode.Uri.file(path.join(extensionPath, 'resources', 'languajes_icons', iconFileName))
  };
}