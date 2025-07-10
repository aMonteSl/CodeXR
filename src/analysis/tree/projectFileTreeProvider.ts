import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Project File Tree Item - represents a file or folder in the workspace
 */
export class ProjectFileItem extends vscode.TreeItem {
  constructor(
    public readonly fsPath: string,
    public readonly label: string,
    public readonly isDirectory: boolean,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    
    this.tooltip = fsPath;
    this.description = isDirectory ? '' : path.extname(fsPath);
    
    // Set appropriate icons
    if (isDirectory) {
      this.iconPath = new vscode.ThemeIcon('folder');
      this.contextValue = 'projectFolder';
    } else {
      this.iconPath = this.getFileIcon(path.extname(fsPath));
      this.contextValue = 'projectFile';
      
      // Make files clickable to open them
      this.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [vscode.Uri.file(fsPath)]
      };
    }
    
    // Set resource URI for VS Code to handle file operations
    this.resourceUri = vscode.Uri.file(fsPath);
    
    console.log(`DEPURATION: Created ProjectFileItem - ${isDirectory ? 'DIR' : 'FILE'}: ${label} at ${fsPath}`);
  }
  
  /**
   * Get appropriate icon for file based on extension
   */
  private getFileIcon(extension: string): vscode.ThemeIcon {
    const iconMap: { [key: string]: string } = {
      '.js': 'file-code',
      '.jsx': 'file-code',
      '.ts': 'file-code',
      '.tsx': 'file-code',
      '.py': 'file-code',
      '.html': 'file-code',
      '.css': 'file-code',
      '.scss': 'file-code',
      '.less': 'file-code',
      '.json': 'json',
      '.xml': 'file-code',
      '.yml': 'file-code',
      '.yaml': 'file-code',
      '.md': 'markdown',
      '.txt': 'file-text',
      '.log': 'file-text',
      '.gitignore': 'file-text',
      '.env': 'file-text',
      '.config': 'settings-gear',
      '.sh': 'terminal',
      '.bat': 'terminal',
      '.ps1': 'terminal'
    };
    
    const iconId = iconMap[extension.toLowerCase()] || 'file';
    return new vscode.ThemeIcon(iconId);
  }
}

/**
 * Project File Tree Provider - shows the actual workspace file structure
 */
export class ProjectFileTreeProvider implements vscode.TreeDataProvider<ProjectFileItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ProjectFileItem | undefined | null | void> = new vscode.EventEmitter<ProjectFileItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ProjectFileItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor() {
    console.log('DEPURATION: ProjectFileTreeProvider initialized');
  }

  refresh(): void {
    console.log('DEPURATION: ProjectFileTreeProvider refresh triggered');
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ProjectFileItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ProjectFileItem): Promise<ProjectFileItem[]> {
    console.log(`DEPURATION: getChildren called for element: ${element ? element.label : 'ROOT'}`);
    
    if (!element) {
      // Root level - return workspace root folder
      return this.getWorkspaceRoot();
    }

    // Get children of a specific folder
    if (element.isDirectory) {
      return this.getDirectoryChildren(element.fsPath);
    }

    // Files don't have children
    return [];
  }

  /**
   * Get the workspace root folder as the top-level item
   */
  private async getWorkspaceRoot(): Promise<ProjectFileItem[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    console.log(`DEPURATION: Found ${workspaceFolders?.length || 0} workspace folders`);
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.log('DEPURATION: No workspace folders found');
      return [];
    }

    const rootFolder = workspaceFolders[0];
    const rootPath = rootFolder.uri.fsPath;
    const rootName = path.basename(rootPath);
    
    console.log(`DEPURATION: Using workspace root: ${rootName} at ${rootPath}`);
    
    const rootItem = new ProjectFileItem(
      rootPath,
      rootName,
      true,
      vscode.TreeItemCollapsibleState.Expanded
    );
    
    return [rootItem];
  }

  /**
   * Get children of a directory
   */
  private async getDirectoryChildren(directoryPath: string): Promise<ProjectFileItem[]> {
    console.log(`DEPURATION: Reading directory: ${directoryPath}`);
    
    try {
      const entries = await fs.readdir(directoryPath, { withFileTypes: true });
      console.log(`DEPURATION: Found ${entries.length} entries in ${directoryPath}`);
      
      const items: ProjectFileItem[] = [];
      const folders: ProjectFileItem[] = [];
      const files: ProjectFileItem[] = [];
      
      for (const entry of entries) {
        const fullPath = path.join(directoryPath, entry.name);
        const isDirectory = entry.isDirectory();
        
        console.log(`DEPURATION: Processing ${isDirectory ? 'DIR' : 'FILE'}: ${entry.name}`);
        
        // Skip hidden files and common build directories based on VS Code settings
        if (this.shouldSkipEntry(entry.name, isDirectory)) {
          console.log(`DEPURATION: Skipping ${entry.name}`);
          continue;
        }
        
        const collapsibleState = isDirectory 
          ? vscode.TreeItemCollapsibleState.Collapsed 
          : vscode.TreeItemCollapsibleState.None;
        
        const item = new ProjectFileItem(fullPath, entry.name, isDirectory, collapsibleState);
        
        if (isDirectory) {
          folders.push(item);
        } else {
          files.push(item);
        }
      }
      
      // Sort folders first, then files, alphabetically within each group
      folders.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
      files.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
      
      items.push(...folders, ...files);
      console.log(`DEPURATION: Returning ${items.length} items (${folders.length} folders, ${files.length} files)`);
      
      return items;
      
    } catch (error) {
      console.error(`DEPURATION: Error reading directory ${directoryPath}:`, error);
      return [];
    }
  }

  /**
   * Determine if an entry should be skipped based on VS Code settings and common patterns
   */
  private shouldSkipEntry(name: string, isDirectory: boolean): boolean {
    // Get VS Code file exclude patterns
    const filesConfig = vscode.workspace.getConfiguration('files');
    const excludePatterns = filesConfig.get<{[key: string]: boolean}>('exclude') || {};
    
    // Check VS Code exclude patterns
    for (const [pattern, exclude] of Object.entries(excludePatterns)) {
      if (exclude && this.matchesGlobPattern(name, pattern)) {
        return true;
      }
    }
    
    // Additional common patterns to skip
    const commonSkipPatterns = [
      'node_modules',
      'dist',
      'build',
      'out',
      'target',
      'bin',
      'obj',
      '__pycache__',
      '.git',
      '.svn',
      '.hg',
      'coverage'
    ];
    
    if (isDirectory && commonSkipPatterns.includes(name)) {
      return true;
    }
    
    // Skip hidden files/folders if not shown in VS Code
    if (name.startsWith('.') && excludePatterns['**/.*']) {
      return true;
    }
    
    return false;
  }

  /**
   * Simple glob pattern matching
   */
  private matchesGlobPattern(fileName: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')  // ** matches any number of directories
      .replace(/\*/g, '[^/]*') // * matches any characters except /
      .replace(/\?/g, '.')     // ? matches any single character
      .replace(/\./g, '\\.');  // Escape literal dots
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(fileName);
  }
}
