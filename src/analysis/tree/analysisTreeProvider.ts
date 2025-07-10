import * as vscode from 'vscode';
import * as path from 'path'; // ✅ ADDED: Missing path import
import { TreeItem } from '../../ui/treeItems/baseItems';
import { TreeItemType } from '../../ui/treeProvider'; // ✅ ADDED: Missing TreeItemType import
import { FileSystemWatcher } from '../watchers/fileSystemWatcher';
import { FileWatchManager } from '../watchers/fileWatchManager';
// ✅ REMOVED: Circular imports - we'll import these inside functions where needed
import { 
  AnalysisSettingsItem, 
  AnalysisSectionItem, 
  LanguageGroupItem, 
  FilesPerLanguageContainer,
  AnalysisFileItem 
} from './analysisTreeItems.js'; // ✅ ADDED: Direct imports with .js extension
import { getTreeDisplayConfig, sortLanguageEntries, limitAndSortFiles } from './treeDisplayConfig.js'; // ✅ ADDED: Missing utility imports
import { AnalysisSessionManager } from '../analysisSessionManager';

/**
 * Tree data provider for analysis section
 */
export class AnalysisTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private fileSystemWatcher: FileSystemWatcher;
  // ✅ NEW: Countdown refresh timer
  private countdownRefreshTimer: NodeJS.Timeout | undefined;

  constructor(private context: vscode.ExtensionContext) {
    this.fileSystemWatcher = FileSystemWatcher.getInstance();
    this.setupFileSystemWatcher();
    
    // ✅ NEW: Start countdown refresh timer for live updates
    this.startCountdownRefreshTimer();
    
    // ✅ NEW: Listen to analysis session changes
    const sessionManager = AnalysisSessionManager.getInstance();
    console.log(`🔗 [TreeProvider] Connecting to session manager...`);
    sessionManager.onDidChangeTreeData(() => {
      console.log('🔄 [TreeProvider] Analysis sessions changed, refreshing tree...');
      this.refresh();
    });
    console.log(`✅ [TreeProvider] Connected to session manager events`);
  }

  /**
   * ✅ NEW: Starts a timer to refresh tree view during active countdowns
   */
  private startCountdownRefreshTimer(): void {
    // Refresh tree view every 2 seconds when there are active countdowns
    this.countdownRefreshTimer = setInterval(() => {
      // ✅ FIXED: Now FileWatchManager is properly imported
      const fileWatchManager = FileWatchManager.getInstance();
      if (fileWatchManager) {
        const watcherStatus = fileWatchManager.getWatcherStatus();
        // ✅ FIXED: Add type annotation for detail parameter
        const hasActiveCountdowns = watcherStatus.activeTimerDetails.some((detail: any) => detail.hasCountdown);
        
        if (hasActiveCountdowns) {
          console.log('🔄 Refreshing tree view for countdown updates');
          this.refresh();
        }
      }
    }, 2000); // Refresh every 2 seconds when countdowns are active
  }

  private setupFileSystemWatcher(): void {
    this.fileSystemWatcher.initialize(() => {
      console.log('🔄 AnalysisTreeProvider: File system change detected, refreshing...');
      this.refresh();
    });
  }

  refresh(): void {
    console.log('🔄 AnalysisTreeProvider: Refreshing tree view...');
    
    // Debug session manager state
    const sessionManager = AnalysisSessionManager.getInstance();
    sessionManager.debugState();
    
    console.log('🔄 AnalysisTreeProvider: Firing onDidChangeTreeData event...');
    this._onDidChangeTreeData.fire();
    console.log('✅ AnalysisTreeProvider: onDidChangeTreeData event fired!');
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    console.log(`DEPURATION: getChildren called with element:`, element ? `${element.type}:${element.label}` : 'ROOT');
    
    if (!element) {
      // Root level: return analysis section
      console.log('DEPURATION: Returning root analysis section');
      return [getAnalysisSectionItem(this.context.extensionPath)];
    }

    // ✅ FIXED: Handle different element types properly
    console.log('DEPURATION: Getting children for element type:', element.type, 'label:', element.label);

    switch (element.type) {
      case TreeItemType.ANALYSIS_SECTION:
        console.log('DEPURATION: Handling ANALYSIS_SECTION');
        return await getAnalysisChildren(this.context);
      
      case TreeItemType.ACTIVE_ANALYSES_SECTION:
        console.log('DEPURATION: Handling ACTIVE_ANALYSES_SECTION');
        return await getActiveAnalysesChildren(this.context);
      
      case TreeItemType.FILES_PER_LANGUAGE_CONTAINER:
        console.log('DEPURATION: Handling FILES_PER_LANGUAGE_CONTAINER');
        return await getFilesPerLanguageChildren(this.context);
      
      case TreeItemType.FILES_BY_DIRECTORY_CONTAINER:
        console.log('DEPURATION: Handling FILES_BY_DIRECTORY_CONTAINER');
        // Check if the element has its own getChildren method
        const { ProjectFileContainer } = await import('./analysisTreeItems.js');
        if (element instanceof ProjectFileContainer) {
          console.log('DEPURATION: Element is ProjectFileContainer, calling its getChildren() method');
          return await element.getChildren();
        }
        return [];
      
      case TreeItemType.DIRECTORY_FOLDER:
        console.log('DEPURATION: Handling DIRECTORY_FOLDER for:', element.label);
        return await getDirectoryFolderChildren(element);
      
      case TreeItemType.ANALYSIS_LANGUAGE_GROUP:
        console.log('DEPURATION: Handling ANALYSIS_LANGUAGE_GROUP for:', element.label);
        return await getLanguageGroupChildren(element, this.context);
      
      case TreeItemType.ANALYSIS_SETTINGS:
        console.log('DEPURATION: Handling ANALYSIS_SETTINGS');
        // ✅ FIXED: Handle settings children properly
        if (element instanceof AnalysisSettingsItem) {
          return await element.getChildren();
        }
        return [];
      
      case TreeItemType.DIMENSION_MAPPING:
        console.log('DEPURATION: Handling DIMENSION_MAPPING');
        // ✅ FIXED: Import and handle dimension mapping
        try {
          const { DimensionMappingItem } = await import('./dimensionMappingTreeItem.js');
          if (element instanceof DimensionMappingItem) {
            return await element.getChildren();
          }
        } catch (error) {
          console.error('❌ Error loading dimension mapping children:', error);
        }
        return [];
      
      default:
        console.log('DEPURATION: Unknown element type:', element.type);
        return [];
    }
  }

  public triggerRefresh(): void {
    console.log('🔄 AnalysisTreeProvider: Manual refresh triggered');
    this.refresh();
  }

  public getFileSystemWatcherStatus() {
    return this.fileSystemWatcher.getStatus();
  }

  public dispose(): void {
    console.log('🧹 AnalysisTreeProvider: Disposing...');
    
    // ✅ CLEAR: Stop countdown refresh timer
    if (this.countdownRefreshTimer) {
      clearInterval(this.countdownRefreshTimer);
      this.countdownRefreshTimer = undefined;
    }
    
    this.fileSystemWatcher.dispose();
  }
}

/**
 * Gets child elements of the analysis section with the new container structure
 */
export async function getAnalysisChildren(context: vscode.ExtensionContext): Promise<TreeItem[]> {
  try {
    console.log('📊 Getting analysis children...');
    
    const children: TreeItem[] = [];
    
    // Add Active Analyses section first with count
    const { ActiveAnalysesSection } = await import('./analysisTreeItems.js');
    const sessionManager = AnalysisSessionManager.getInstance();
    const activeAnalysesCount = sessionManager.getSessionCount();
    children.push(new ActiveAnalysesSection(context.extensionPath, activeAnalysesCount));
    
    // ✅ FIXED: Use imported class
    children.push(new AnalysisSettingsItem(context.extensionPath, context));
    
    // Get all analyzable files
    const filesByLanguage = await getAnalyzableFilesByLanguage();
    const languages = Object.keys(filesByLanguage);
    const totalFiles = Object.values(filesByLanguage).reduce((sum, files) => sum + files.length, 0);
    
    if (languages.length === 0) {
      console.log('📂 No analyzable files found in workspace');
      children.push(createErrorItem(
        'No analyzable files found',
        'No supported programming language files were found in the current workspace'
      ));
      return children;
    }
    
    // ✅ NEW: Add Project Files section for directory browsing
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const rootPath = workspaceFolders[0].uri.fsPath;
      const rootName = path.basename(rootPath);
      console.log(`DEPURATION: Creating ProjectFileContainer for workspace: ${rootName} at path: ${rootPath}`);
      
      const { ProjectFileContainer } = await import('./analysisTreeItems.js');
      const projectFileContainer = new ProjectFileContainer(rootPath, context.extensionPath);
      children.push(projectFileContainer);
      console.log(`DEPURATION: Added ProjectFileContainer to children with label: ${projectFileContainer.label}`);
    } else {
      console.log(`DEPURATION: No workspace folders found, skipping ProjectFileContainer`);
    }
    
    // ✅ MOVED: Add Files per Language section (main analysis tree functionality)
    children.push(new FilesPerLanguageContainer(languages.length, totalFiles, context.extensionPath));
    
    console.log(`✅ Analysis children created: ${children.length} items (${languages.length} languages, ${totalFiles} files)`);
    return children;
    
  } catch (error) {
    console.error('❌ Error getting analysis children:', error);
    return [
      createErrorItem(
        'Error loading files',
        `Failed to load analyzable files: ${error instanceof Error ? error.message : String(error)}`
      )
    ];
  }
}

/**
 * Gets child elements of the Files per Language container
 */
export async function getFilesPerLanguageChildren(context: vscode.ExtensionContext): Promise<TreeItem[]> {
  try {
    console.log('📁 Getting files per language children...');
    
    // Get all analyzable files grouped by language
    const filesByLanguage = await getAnalyzableFilesByLanguage();
    // ✅ FIXED: Use imported function
    const config = getTreeDisplayConfig(context);
    
    // ✅ FIXED: Use imported function
    const sortedLanguageEntries = sortLanguageEntries(filesByLanguage, config);
    
    // Create language group items
    const languageItems: TreeItem[] = [];
    
    for (const [language, files] of sortedLanguageEntries) {
      // ✅ FIXED: Use imported function
      const limitedFiles = limitAndSortFiles(files, config);
      
      console.log(`📂 Creating language group for ${language}: ${files.length} total files, ${limitedFiles.length} showing`);
      
      // ✅ FIXED: Use imported class and set correct properties
      const languageGroupItem = new LanguageGroupItem(
        language,
        files.length,        // Total file count
        limitedFiles.length, // Showing file count (after limiting)
        context.extensionPath
      );
      
      // ✅ CRITICAL: Store the files data in the item for retrieval later
      (languageGroupItem as any).filesData = limitedFiles;
      
      languageItems.push(languageGroupItem);
    }
    
    console.log(`✅ Files per language children created: ${languageItems.length} language groups`);
    return languageItems;
    
  } catch (error) {
    console.error('❌ Error getting files per language children:', error);
    return [
      createErrorItem(
        'Error loading language groups',
        `Failed to load files by language: ${error instanceof Error ? error.message : String(error)}`
      )
    ];
  }
}

/**
 * ✅ FIXED: Gets child elements of a language group (individual files)
 */
export async function getLanguageGroupChildren(groupItem: TreeItem, context: vscode.ExtensionContext): Promise<TreeItem[]> {
  try {
    console.log('📂 Getting language group children for:', groupItem.label);
    
    // ✅ FIXED: Extract language name from label (remove file count info)
    const labelStr = typeof groupItem.label === 'string' ? groupItem.label : String(groupItem.label || '');
    const languageName = labelStr.split(' (')[0]; // Extract language name before the count
    
    if (!languageName) {
      console.log('📂 No language name found for group item');
      return [];
    }
    
    console.log('📂 Processing language:', languageName);
    
    // ✅ NEW: Try to get files from stored data first (more efficient)
    const storedFiles = (groupItem as any).filesData as vscode.Uri[];
    
    let filesToProcess: vscode.Uri[] = [];
    
    if (storedFiles && Array.isArray(storedFiles)) {
      console.log(`📂 Using stored files for ${languageName}: ${storedFiles.length} files`);
      filesToProcess = storedFiles;
    } else {
      console.log(`📂 No stored files, fetching fresh data for ${languageName}`);
      // Fallback: fetch fresh data
      const filesByLanguage = await getAnalyzableFilesByLanguage();
      const config = getTreeDisplayConfig(context);
      const filesForLanguage = filesByLanguage[languageName];
      
      if (!filesForLanguage || filesForLanguage.length === 0) {
        console.log(`📂 No files found for language: ${languageName}`);
        return [];
      }
      
      filesToProcess = limitAndSortFiles(filesForLanguage, config);
    }
    
    // Create file items
    const fileItems: TreeItem[] = [];
    
    for (const fileUri of filesToProcess) {
      const filePath = fileUri.fsPath;
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
      // ✅ FIXED: path is now imported
      const relativePath = workspaceFolder 
        ? path.relative(workspaceFolder.uri.fsPath, filePath)
        : path.basename(filePath);
      
      // ✅ FIXED: Use imported class
      const fileItem = new AnalysisFileItem(
        filePath,
        relativePath,
        languageName,
        context.extensionPath
      );
      
      fileItems.push(fileItem);
    }
    
    console.log(`✅ Created ${fileItems.length} file items for ${languageName}`);
    return fileItems;
    
  } catch (error) {
    console.error('❌ Error getting language group children:', error);
    return [
      createErrorItem(
        'Error loading files',
        `Failed to load files for this language: ${error instanceof Error ? error.message : String(error)}`
      )
    ];
  }
}

/**
 * Creates a tree item for displaying error messages
 */
function createErrorItem(message: string, tooltip?: string): TreeItem {
  return new TreeItem(
    message,
    tooltip || message,
    // ✅ FIXED: TreeItemType is now imported
    TreeItemType.ANALYSIS_MESSAGE,
    vscode.TreeItemCollapsibleState.None,
    undefined,
    new vscode.ThemeIcon('error')
  );
}

/**
 * Creates the section item for code analysis
 */
export function getAnalysisSectionItem(extensionPath: string): TreeItem {
  // ✅ FIXED: Use imported class
  return new AnalysisSectionItem(extensionPath);
}

/**
 * Gets analyzable files from workspace grouped by language
 */
async function getAnalyzableFilesByLanguage(): Promise<Record<string, vscode.Uri[]>> {
  const filesByLanguage: Record<string, vscode.Uri[]> = {};
  
  if (!vscode.workspace.workspaceFolders) {
    console.log('📂 No workspace folders found');
    return filesByLanguage;
  }

  try {
    // ✅ COMPREHENSIVE EXCLUDE PATTERN (keep as before)
    const excludePattern = `{${[
      // Hidden directories (starting with dot)
      '**/.venv/**',
      '**/.git/**',
      '**/.svn/**',
      '**/.hg/**',
      '**/.bzr/**',
      '**/.idea/**',
      '**/.vscode/**',
      '**/.vs/**',
      '**/.eclipse/**',
      '**/.settings/**',
      '**/.metadata/**',
      '**/.pytest_cache/**',
      '**/.coverage/**',
      '**/.nyc_output/**',
      '**/.sass-cache/**',
      
      // Build and output directories
      '**/node_modules/**',
      '**/bower_components/**',
      '**/vendor/**',
      '**/dist/**',
      '**/build/**',
      '**/target/**',        // Maven
      '**/bin/**',
      '**/obj/**',
      '**/out/**',
      '**/release/**',
      '**/debug/**',
      
      // Python specific
      '**/__pycache__/**',
      '**/site-packages/**',
      '**/Scripts/**',       // Windows venv
      '**/lib/python*/**',   // Unix venv
      '**/Lib/**',           // Windows Python
      '**/DLLs/**',
      '**/Include/**',
      
      // JavaScript/Node.js specific
      '**/.next/**',
      '**/.nuxt/**',
      '**/coverage/**',
      '**/public/build/**',
      
      // Java specific
      '**/classes/**',
      '**/generated/**',
      '**/META-INF/**',
      
      // .NET specific
      '**/packages/**',
      
      // Temporary and cache directories
      '**/tmp/**',
      '**/temp/**',
      '**/cache/**',
      '**/logs/**',
      
      // Package manager files and directories
      '**/yarn.lock',
      '**/package-lock.json',
      '**/composer.lock',
      '**/Pipfile.lock',
      
      // Documentation directories that might contain code examples
      '**/docs/**',
      '**/documentation/**'
    ].join(',')}}`;

    console.log('🔍 Searching for ALL files with simplified unknown detection...');
    
    // ✅ SIMPLIFIED APPROACH: Search for ALL files at once
    const allFiles = await vscode.workspace.findFiles(
      '**/*',  // Find ALL files
      excludePattern
    );
    
    console.log(`📄 Found ${allFiles.length} total files, categorizing by extension...`);
    
    // ✅ PROCESS ALL FILES: Categorize each file by its extension
    for (const file of allFiles) {
      // ✅ FIXED: path is now imported
      const fileName = path.basename(file.fsPath);
      const ext = path.extname(file.fsPath).toLowerCase();
      
      // Skip hidden files (starting with dot)
      if (fileName.startsWith('.')) {
        continue;
      }
      
      // Get language from extension
      const language = getLanguageFromExtension(ext);
      
      // Apply basic file filtering
      if (shouldIncludeFile(file, language)) {
        if (!filesByLanguage[language]) {
          filesByLanguage[language] = [];
        }
        filesByLanguage[language].push(file);
      }
    }
    
    // Log results
    const totalFiles = Object.values(filesByLanguage).reduce((sum, files) => sum + files.length, 0);
    console.log(`🔍 Categorized ${totalFiles} files into ${Object.keys(filesByLanguage).length} languages`);
    
    // Log breakdown by language
    for (const [language, files] of Object.entries(filesByLanguage)) {
      console.log(`  📁 ${language}: ${files.length} files`);
    }
    
    return filesByLanguage;
    
  } catch (error) {
    console.error('❌ Error finding analyzable files:', error);
    return filesByLanguage;
  }
}

/**
 * ✅ UPDATED: Gets language name from file extension - simplified logic
 */
function getLanguageFromExtension(ext: string): string {
  const languageMap: Record<string, string> = {
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.py': 'Python',
    '.c': 'C',
    '.h': 'C/C++ Headers',
    '.cpp': 'C++',
    '.cc': 'C++',
    '.cxx': 'C++',
    '.hpp': 'C/C++ Headers',
    '.cs': 'C#',
    '.java': 'Java',
    '.vue': 'Vue',
    '.rb': 'Ruby',
    '.m': 'Objective-C',
    '.mm': 'Objective-C',
    '.swift': 'Swift',
    '.ttcn': 'TTCN-3',
    '.ttcn3': 'TTCN-3',
    '.3mp': 'TTCN-3',
    '.php': 'PHP',
    '.phtml': 'PHP',
    '.php3': 'PHP',
    '.php4': 'PHP',
    '.php5': 'PHP',
    '.phps': 'PHP',
    '.scala': 'Scala',
    '.sc': 'Scala',
    '.gd': 'GDScript',
    '.go': 'Go',
    '.lua': 'Lua',
    '.rs': 'Rust',
    '.f': 'Fortran',
    '.f77': 'Fortran',
    '.f90': 'Fortran',
    '.f95': 'Fortran',
    '.f03': 'Fortran',
    '.f08': 'Fortran',
    '.for': 'Fortran',
    '.ftn': 'Fortran',
    '.kt': 'Kotlin',
    '.kts': 'Kotlin',
    '.sol': 'Solidity',
    '.erl': 'Erlang',
    '.hrl': 'Erlang',
    '.zig': 'Zig',
    '.pl': 'Perl',
    '.pm': 'Perl',
    '.pod': 'Perl',
    '.t': 'Perl',
    '.html': 'HTML',
    '.htm': 'HTML'
  };
  
  // ✅ SIMPLE LOGIC: If extension not in our map, it's "Unknown Files"
  return languageMap[ext] || 'Unknown Files';
}

/**
 * ✅ SIMPLIFIED: Determines if a file should be included (much simpler now)
 */
function shouldIncludeFile(fileUri: vscode.Uri, language: string): boolean {
  // ✅ FIXED: path is now imported
  const fileName = path.basename(fileUri.fsPath);
  
  // Skip hidden files (already handled above, but double-check)
  if (fileName.startsWith('.')) {
    return false;
  }
  
  // ✅ SIMPLE LOGIC: Include almost everything, with minimal exclusions
  
  // For "Unknown Files", apply basic filtering
  if (language === 'Unknown Files') {
    return shouldIncludeUnknownFile(fileUri);
  }
  
  // For known languages, apply minimal filtering
  switch (language) {
    case 'Python':
      return shouldIncludePythonFile(fileUri);
    case 'Java':
      return shouldIncludeJavaFile(fileUri);
    default:
      return true; // Include all other known language files
  }
}

/**
 * ✅ SIMPLIFIED: Determines if an unknown file should be included
 */
function shouldIncludeUnknownFile(fileUri: vscode.Uri): boolean {
  // ✅ FIXED: path is now imported
  const fileName = path.basename(fileUri.fsPath);
  const ext = path.extname(fileName).toLowerCase();
  
  // ✅ MUCH SIMPLER: Only exclude obviously non-useful files
  const excludeExtensions = [
    // Binary files
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
    '.mp3', '.mp4', '.avi', '.mkv', '.wav', '.ogg',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.ttf', '.otf', '.woff', '.woff2', '.eot',
    '.dll', '.so', '.dylib', '.exe', '.bin',
    '.jar', '.war', '.ear', '.class',
    '.pyc', '.pyo', '.pyd',
    '.o', '.obj', '.lib', '.a',
    
    // Minified files
    '.min.js', '.min.css',
    
    // Temporary files
    '.bak', '.tmp', '.temp', '.swp', '.swo'
  ];
  
  // ✅ SIMPLE: If not in exclude list, include it
  if (excludeExtensions.includes(ext)) {
    return false;
  }
  
  // ✅ INCLUDE: .txt, .md, .json, .xml, .yml, .yaml, .ini, .cfg, .conf, etc.
  // These are files users might want to see even if they're not "code"
  return true;
}

// Keep the existing simple functions:
function shouldIncludePythonFile(fileUri: vscode.Uri): boolean {
  // ✅ FIXED: path is now imported
  const fileName = path.basename(fileUri.fsPath);
  
  // Exclude specific Python files
  const excludePatterns = [
    /^__pycache__/,
    /\.pyc$/,
    /\.pyo$/,
    /\.pyd$/,
    /^setup\.py$/,
    /^conftest\.py$/
  ];
  
  return !excludePatterns.some(pattern => pattern.test(fileName));
}

function shouldIncludeJavaFile(fileUri: vscode.Uri): boolean {
  // ✅ FIXED: path is now imported
  const fileName = path.basename(fileUri.fsPath);
  
  // Exclude generated files (containing $ usually indicates inner classes)
  return !fileName.includes('$');
}

/**
 * Gets child elements for the Active Analyses section
 */
export async function getActiveAnalysesChildren(context: vscode.ExtensionContext): Promise<TreeItem[]> {
  try {
    console.log('🔍 [TreeProvider] === GETTING ACTIVE ANALYSES CHILDREN ===');
    
    const sessionManager = AnalysisSessionManager.getInstance();
    console.log('🔍 [TreeProvider] Session manager instance obtained');
    
    const activeSessions = sessionManager.getAllSessions();
    console.log(`🔍 [TreeProvider] getAllSessions() returned: ${activeSessions}`);
    console.log(`🔍 [TreeProvider] Sessions array length: ${activeSessions.length}`);
    console.log(`🔍 [TreeProvider] Sessions array type: ${typeof activeSessions}`);
    console.log(`🔍 [TreeProvider] Sessions array isArray: ${Array.isArray(activeSessions)}`);
    
    // Debug each session
    activeSessions.forEach((session, index) => {
      console.log(`🔍 [TreeProvider] Session ${index + 1}:`);
      console.log(`  - File: ${session.fileName} (${session.filePath})`);
      console.log(`  - Type: ${session.analysisType}`);
      console.log(`  - ID: ${session.id}`);
      console.log(`  - Created: ${session.created}`);
    });
    
    if (activeSessions.length === 0) {
      console.log(`📝 [TreeProvider] No active sessions, showing placeholder message`);
      return [
        createErrorItem(
          'No active analyses',
          'No analyses are currently running. Start an analysis from the Files per Language section.'
        )
      ];
    }
    
    // Import ActiveAnalysisItem and create items for each session
    console.log('🔍 [TreeProvider] Importing ActiveAnalysisItem...');
    const { ActiveAnalysisItem } = await import('./analysisTreeItems.js');
    console.log('🔍 [TreeProvider] ActiveAnalysisItem imported successfully');
    
    const children = activeSessions.map((session, index) => {
      console.log(`🎯 [TreeProvider] Creating tree item ${index + 1} for: ${session.fileName} (${session.analysisType})`);
      const item = new ActiveAnalysisItem(session, context.extensionPath);
      console.log(`🎯 [TreeProvider] Tree item created: ${item.label} (type: ${item.type})`);
      return item;
    });
    
    console.log(`✅ [TreeProvider] Active analyses children created: ${children.length} items`);
    console.log('🔍 [TreeProvider] === END GETTING ACTIVE ANALYSES CHILDREN ===');
    return children;
    
  } catch (error) {
    console.error('❌ [TreeProvider] Error getting active analyses children:', error);
    return [
      createErrorItem(
        'Error loading active analyses',
        `Failed to load active analyses: ${error instanceof Error ? error.message : String(error)}`
      )
    ];
  }
}

/**
 * Get children for Files by Directory container
 */
export async function getFilesByDirectoryChildren(context: vscode.ExtensionContext): Promise<TreeItem[]> {
  try {
    console.log('DEPURATION: Getting files by directory children...');
    
    const workspaceFolders = vscode.workspace.workspaceFolders;
    console.log(`DEPURATION: Found ${workspaceFolders?.length || 0} workspace folders`);
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.log('DEPURATION: No workspace folders found, returning error item');
      return [
        createErrorItem(
          'No workspace open',
          'Open a workspace or folder to browse files by directory'
        )
      ];
    }
    
    const rootPath = workspaceFolders[0].uri.fsPath;
    const rootName = path.basename(rootPath);
    console.log(`DEPURATION: Using root workspace folder: ${rootPath} (name: ${rootName})`);
    
    const { DirectoryFolderItem } = await import('./analysisTreeItems.js');
    
    // Return a single root folder item that shows the workspace structure
    const rootItem = new DirectoryFolderItem(rootPath, '', context.extensionPath);
    console.log(`DEPURATION: Created root DirectoryFolderItem for: ${rootPath}`);
    
    return [rootItem];
    
  } catch (error) {
    console.error('DEPURATION: Error getting files by directory children:', error);
    return [
      createErrorItem(
        'Error loading directory structure',
        `Failed to load directory structure: ${error}`
      )
    ];
  }
}

/**
 * Get children for a directory folder
 */
export async function getDirectoryFolderChildren(element: TreeItem): Promise<TreeItem[]> {
  try {
    console.log(`DEPURATION: Getting directory folder children for element: ${element.label}, type: ${element.type}`);
    
    const { DirectoryFolderItem } = await import('./analysisTreeItems.js');
    
    if (element instanceof DirectoryFolderItem) {
      console.log(`DEPURATION: Element is DirectoryFolderItem, calling getChildren() for path: ${element.folderPath}`);
      const children = await element.getChildren();
      console.log(`DEPURATION: DirectoryFolderItem.getChildren() returned ${children.length} children`);
      return children;
    }
    
    console.log(`DEPURATION: Element is not DirectoryFolderItem, returning empty array`);
    return [];
    
  } catch (error) {
    console.error('DEPURATION: Error getting directory folder children:', error);
    return [
      createErrorItem(
        'Error loading folder',
        `Failed to load folder contents: ${error}`
      )
    ];
  }
}