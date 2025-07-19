import * as vscode from 'vscode';
import * as path from 'path';
import { getLanguageForFile, LanguageInfo } from '../../utils/languageMetadata';

/**
 * Represents a directory or file in the project structure
 */
export interface ProjectStructureItem {
    name: string;
    relativePath: string;
    fullPath: string;
    type: 'directory' | 'file';
    language?: LanguageInfo | null;
    children?: ProjectStructureItem[];
    size?: number;
    lastModified?: Date;
}

/**
 * Configuration for directory scanning
 */
export interface DirectoryScanOptions {
    /**
     * Maximum depth to scan (0 = unlimited)
     */
    maxDepth?: number;
    
    /**
     * Whether to include hidden files/directories (starting with .)
     */
    includeHidden?: boolean;
    
    /**
     * Custom ignore patterns (in addition to default patterns)
     */
    customIgnorePatterns?: string[];
    
    /**
     * Whether to calculate file sizes
     */
    calculateSizes?: boolean;
    
    /**
     * Whether to get last modified dates
     */
    includeModificationDates?: boolean;
}

/**
 * Scanner for creating a hierarchical project directory structure
 */
export class DirectoryScanner {
    
    /**
     * Default ignore patterns for common build/cache directories
     */
    private static readonly DEFAULT_IGNORE_PATTERNS = [
        'node_modules',
        '.git',
        '.svn',
        '.hg',
        '.venv',
        '__pycache__',
        '.pytest_cache',
        '.mypy_cache',
        '.tox',
        '.coverage',
        'build',
        'dist',
        'out',
        'bin',
        'target',
        '.vscode',
        '.idea',
        '*.vsix',
        '.DS_Store',
        'Thumbs.db'
    ];

    /**
     * Scan workspace folders and create hierarchical project structure
     */
    static async scanProjectStructure(options: DirectoryScanOptions = {}): Promise<ProjectStructureItem[]> {
        console.log('DIRECTORY_SCANNER: Starting project structure scan');
        
        const startTime = Date.now();
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        if (!workspaceFolders || workspaceFolders.length === 0) {
            console.log('DIRECTORY_SCANNER: No workspace folders found');
            return [];
        }

        const projectStructure: ProjectStructureItem[] = [];
        
        // Combine default and custom ignore patterns
        const ignorePatterns = [
            ...this.DEFAULT_IGNORE_PATTERNS,
            ...(options.customIgnorePatterns || [])
        ];

        // Scan each workspace folder
        for (const workspaceFolder of workspaceFolders) {
            console.log(`DIRECTORY_SCANNER: Scanning workspace folder: ${workspaceFolder.name}`);
            
            try {
                const rootItem = await this.scanDirectory(
                    workspaceFolder.uri,
                    workspaceFolder.uri.fsPath,
                    '',
                    ignorePatterns,
                    options,
                    0
                );
                
                if (rootItem) {
                    // For single workspace, use the folder contents directly
                    if (workspaceFolders.length === 1 && rootItem.children) {
                        projectStructure.push(...rootItem.children);
                    } else {
                        // For multiple workspaces, include the workspace folder as root
                        projectStructure.push(rootItem);
                    }
                }
                
            } catch (error) {
                console.error(`DIRECTORY_SCANNER: Error scanning workspace folder ${workspaceFolder.name}:`, error);
            }
        }

        const endTime = Date.now();
        const duration = endTime - startTime;
        const totalItems = this.countItems(projectStructure);
        
        console.log(`DIRECTORY_SCANNER: Project structure scan completed in ${duration}ms`);
        console.log(`DIRECTORY_SCANNER: Found ${totalItems.directories} directories and ${totalItems.files} files`);
        
        return projectStructure;
    }

    /**
     * Recursively scan a directory and build its structure
     */
    private static async scanDirectory(
        directoryUri: vscode.Uri,
        workspaceRoot: string,
        relativePath: string,
        ignorePatterns: string[],
        options: DirectoryScanOptions,
        currentDepth: number
    ): Promise<ProjectStructureItem | null> {
        
        // Check depth limit
        if (options.maxDepth && currentDepth > options.maxDepth) {
            return null;
        }

        const directoryName = path.basename(directoryUri.fsPath);
        
        // Check if directory should be ignored
        if (this.shouldIgnore(directoryName, ignorePatterns, options.includeHidden)) {
            return null;
        }

        try {
            // Get directory contents
            const entries = await vscode.workspace.fs.readDirectory(directoryUri);
            const children: ProjectStructureItem[] = [];

            // Sort entries: directories first, then files, alphabetically
            const sortedEntries = entries.sort((a, b) => {
                // Directories first
                if (a[1] === vscode.FileType.Directory && b[1] !== vscode.FileType.Directory) {
                    return -1;
                }
                if (b[1] === vscode.FileType.Directory && a[1] !== vscode.FileType.Directory) {
                    return 1;
                }
                // Then alphabetically
                return a[0].localeCompare(b[0]);
            });

            // Process each entry
            for (const [entryName, entryType] of sortedEntries) {
                const entryUri = vscode.Uri.joinPath(directoryUri, entryName);
                const entryRelativePath = relativePath ? path.join(relativePath, entryName) : entryName;

                if (entryType === vscode.FileType.Directory) {
                    // Recursively scan subdirectory
                    const subDirectory = await this.scanDirectory(
                        entryUri,
                        workspaceRoot,
                        entryRelativePath,
                        ignorePatterns,
                        options,
                        currentDepth + 1
                    );
                    
                    if (subDirectory) {
                        children.push(subDirectory);
                    }
                    
                } else if (entryType === vscode.FileType.File) {
                    // Check if file should be ignored
                    if (!this.shouldIgnore(entryName, ignorePatterns, options.includeHidden)) {
                        const fileItem = await this.createFileItem(
                            entryUri,
                            workspaceRoot,
                            entryRelativePath,
                            options
                        );
                        
                        if (fileItem) {
                            children.push(fileItem);
                        }
                    }
                }
            }

            // Create directory item
            const directoryItem: ProjectStructureItem = {
                name: directoryName,
                relativePath: relativePath,
                fullPath: directoryUri.fsPath,
                type: 'directory',
                children: children
            };

            // Add modification date if requested
            if (options.includeModificationDates) {
                try {
                    const stat = await vscode.workspace.fs.stat(directoryUri);
                    directoryItem.lastModified = new Date(stat.mtime);
                } catch (error) {
                    console.warn(`DIRECTORY_SCANNER: Could not get modification date for ${directoryUri.fsPath}`);
                }
            }

            return directoryItem;

        } catch (error) {
            console.warn(`DIRECTORY_SCANNER: Error reading directory ${directoryUri.fsPath}:`, error);
            return null;
        }
    }

    /**
     * Create a file item with metadata
     */
    private static async createFileItem(
        fileUri: vscode.Uri,
        workspaceRoot: string,
        relativePath: string,
        options: DirectoryScanOptions
    ): Promise<ProjectStructureItem | null> {
        
        try {
            const fileName = path.basename(fileUri.fsPath);
            const language = getLanguageForFile(fileUri.fsPath);

            const fileItem: ProjectStructureItem = {
                name: fileName,
                relativePath: relativePath,
                fullPath: fileUri.fsPath,
                type: 'file',
                language: language
            };

            // Add file size if requested
            if (options.calculateSizes) {
                try {
                    const stat = await vscode.workspace.fs.stat(fileUri);
                    fileItem.size = stat.size;
                } catch (error) {
                    console.warn(`DIRECTORY_SCANNER: Could not get size for ${fileUri.fsPath}`);
                }
            }

            // Add modification date if requested
            if (options.includeModificationDates) {
                try {
                    const stat = await vscode.workspace.fs.stat(fileUri);
                    fileItem.lastModified = new Date(stat.mtime);
                } catch (error) {
                    console.warn(`DIRECTORY_SCANNER: Could not get modification date for ${fileUri.fsPath}`);
                }
            }

            return fileItem;

        } catch (error) {
            console.warn(`DIRECTORY_SCANNER: Error processing file ${fileUri.fsPath}:`, error);
            return null;
        }
    }

    /**
     * Check if a file or directory should be ignored
     */
    private static shouldIgnore(name: string, ignorePatterns: string[], includeHidden: boolean = false): boolean {
        // Check hidden files/directories
        if (!includeHidden && name.startsWith('.')) {
            return true;
        }

        // Check against ignore patterns
        return ignorePatterns.some(pattern => {
            // Simple glob-like matching
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(name);
            }
            return name === pattern;
        });
    }

    /**
     * Count total directories and files in the structure
     */
    private static countItems(items: ProjectStructureItem[]): { directories: number; files: number } {
        let directories = 0;
        let files = 0;

        for (const item of items) {
            if (item.type === 'directory') {
                directories++;
                if (item.children) {
                    const childCounts = this.countItems(item.children);
                    directories += childCounts.directories;
                    files += childCounts.files;
                }
            } else if (item.type === 'file') {
                files++;
            }
        }

        return { directories, files };
    }

    /**
     * Find an item in the structure by relative path
     */
    static findItemByPath(items: ProjectStructureItem[], targetPath: string): ProjectStructureItem | null {
        for (const item of items) {
            if (item.relativePath === targetPath) {
                return item;
            }
            
            if (item.children) {
                const found = this.findItemByPath(item.children, targetPath);
                if (found) {
                    return found;
                }
            }
        }
        
        return null;
    }

    /**
     * Get all files in the structure (flattened)
     */
    static getAllFiles(items: ProjectStructureItem[]): ProjectStructureItem[] {
        const files: ProjectStructureItem[] = [];

        for (const item of items) {
            if (item.type === 'file') {
                files.push(item);
            } else if (item.children) {
                files.push(...this.getAllFiles(item.children));
            }
        }

        return files;
    }

    /**
     * Get all directories in the structure (flattened)
     */
    static getAllDirectories(items: ProjectStructureItem[]): ProjectStructureItem[] {
        const directories: ProjectStructureItem[] = [];

        for (const item of items) {
            if (item.type === 'directory') {
                directories.push(item);
                if (item.children) {
                    directories.push(...this.getAllDirectories(item.children));
                }
            }
        }

        return directories;
    }

    /**
     * Filter items by file extension
     */
    static filterByExtension(items: ProjectStructureItem[], extensions: string[]): ProjectStructureItem[] {
        const filtered: ProjectStructureItem[] = [];

        for (const item of items) {
            if (item.type === 'file') {
                const ext = path.extname(item.name).toLowerCase();
                if (extensions.includes(ext)) {
                    filtered.push(item);
                }
            } else if (item.children) {
                const filteredChildren = this.filterByExtension(item.children, extensions);
                if (filteredChildren.length > 0) {
                    filtered.push({
                        ...item,
                        children: filteredChildren
                    });
                }
            }
        }

        return filtered;
    }

    /**
     * Get statistics about the project structure
     */
    static getProjectStatistics(items: ProjectStructureItem[]): {
        totalDirectories: number;
        totalFiles: number;
        filesByLanguage: { [language: string]: number };
        totalSize?: number;
        largestFile?: ProjectStructureItem;
    } {
        const counts = this.countItems(items);
        const allFiles = this.getAllFiles(items);
        
        const filesByLanguage: { [language: string]: number } = {};
        let totalSize = 0;
        let largestFile: ProjectStructureItem | undefined;

        for (const file of allFiles) {
            // Count by language
            const languageName = file.language?.name || 'Unknown';
            filesByLanguage[languageName] = (filesByLanguage[languageName] || 0) + 1;

            // Calculate sizes
            if (file.size !== undefined) {
                totalSize += file.size;
                
                if (!largestFile || (file.size > (largestFile.size || 0))) {
                    largestFile = file;
                }
            }
        }

        return {
            totalDirectories: counts.directories,
            totalFiles: counts.files,
            filesByLanguage,
            totalSize: totalSize > 0 ? totalSize : undefined,
            largestFile
        };
    }
}
