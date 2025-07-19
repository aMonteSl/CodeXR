import * as vscode from 'vscode';
import * as path from 'path';
import { getLanguageForFile, LanguageInfo } from '../../utils/languageMetadata';

/**
 * Represents a file grouped by language
 */
export interface FileInfo {
    fileName: string;
    relativePath: string;
    fullPath: string;
    language: LanguageInfo | null;
}

/**
 * Files grouped by language
 */
export interface FilesByLanguage {
    [languageName: string]: FileInfo[];
}

/**
 * Scanner for analyzing workspace files and grouping them by programming language
 */
export class FileScanner {
    
    /**
     * Scan all workspace folders and group files by language
     * @returns Promise with files grouped by language
     */
    static async scanWorkspaceFiles(): Promise<FilesByLanguage> {
        console.log('ANALYSIS: Starting workspace file scan');
        
        const startTime = Date.now();
        const filesByLanguage: FilesByLanguage = {};
        
        try {
            // Find all files in the workspace, excluding common build/cache directories and dot folders
            console.log('ANALYSIS: Searching for files using vscode.workspace.findFiles');
            const files = await vscode.workspace.findFiles(
                '**/*', 
                '{**/node_modules/**,**/.venv/**,**/.git/**,**/.svn/**,**/.hg/**,**/.*/**,**/build/**,**/dist/**,**/out/**,**/bin/**,**/__pycache__/**,**/.pytest_cache/**,**/.mypy_cache/**,**/.tox/**,**/.coverage/**}'
            );
            
            console.log(`ANALYSIS: Found ${files.length} files to analyze`);
            
            // Filter out directories and process each file
            let processedCount = 0;
            let skippedCount = 0;
            
            for (const fileUri of files) {
                try {
                    // Get file stats to check if it's a directory
                    const stat = await vscode.workspace.fs.stat(fileUri);
                    
                    // Skip directories
                    if (stat.type === vscode.FileType.Directory) {
                        skippedCount++;
                        continue;
                    }
                    
                    // Process the file
                    const fileInfo = this.createFileInfo(fileUri);
                    this.addFileToLanguageGroup(filesByLanguage, fileInfo);
                    
                    processedCount++;
                    
                    // Log progress for large workspaces
                    if (processedCount % 100 === 0) {
                        console.log(`ANALYSIS: Processed ${processedCount} files so far...`);
                    }
                    
                } catch (error) {
                    console.warn(`ANALYSIS: Error processing file ${fileUri.fsPath}:`, error);
                    skippedCount++;
                }
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            console.log(`ANALYSIS: File scan completed in ${duration}ms`);
            console.log(`ANALYSIS: Processed ${processedCount} files, skipped ${skippedCount} items`);
            console.log(`ANALYSIS: Found files in ${Object.keys(filesByLanguage).length} different languages`);
            
            // Log language distribution
            this.logLanguageDistribution(filesByLanguage);
            
            return filesByLanguage;
            
        } catch (error) {
            console.error('ANALYSIS: Error during workspace file scan:', error);
            throw error;
        }
    }
    
    /**
     * Create file info object from VS Code URI
     */
    private static createFileInfo(fileUri: vscode.Uri): FileInfo {
        const fullPath = fileUri.fsPath;
        const fileName = path.basename(fullPath);
        
        // Get relative path from workspace root
        let relativePath = fullPath;
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            if (fullPath.startsWith(workspaceRoot)) {
                relativePath = path.relative(workspaceRoot, fullPath);
            }
        }
        
        // Determine language based on file extension
        const language = getLanguageForFile(fullPath);
        
        return {
            fileName,
            relativePath,
            fullPath,
            language
        };
    }
    
    /**
     * Add file to the appropriate language group
     */
    private static addFileToLanguageGroup(filesByLanguage: FilesByLanguage, fileInfo: FileInfo): void {
        const languageName = fileInfo.language?.name || 'Unknown Files';
        
        if (!filesByLanguage[languageName]) {
            filesByLanguage[languageName] = [];
        }
        
        filesByLanguage[languageName].push(fileInfo);
    }
    
    /**
     * Log the distribution of files by language
     */
    private static logLanguageDistribution(filesByLanguage: FilesByLanguage): void {
        console.log('ANALYSIS: File distribution by language:');
        
        // Sort languages by file count (descending)
        const sortedLanguages = Object.entries(filesByLanguage)
            .sort(([, filesA], [, filesB]) => filesB.length - filesA.length);
        
        sortedLanguages.forEach(([language, files]) => {
            console.log(`ANALYSIS: Detected ${files.length} files of ${language}`);
        });
        
        const totalLanguages = sortedLanguages.length;
        const totalFiles = sortedLanguages.reduce((sum, [, files]) => sum + files.length, 0);
        console.log(`ANALYSIS: Total: ${totalLanguages} languages, ${totalFiles} files detected`);
    }
    
    /**
     * Get files for a specific language
     */
    static getFilesForLanguage(filesByLanguage: FilesByLanguage, languageName: string): FileInfo[] {
        return filesByLanguage[languageName] || [];
    }
    
    /**
     * Get all detected languages sorted by file count
     */
    static getLanguagesSortedByCount(filesByLanguage: FilesByLanguage): string[] {
        return Object.entries(filesByLanguage)
            .sort(([, filesA], [, filesB]) => filesB.length - filesA.length)
            .map(([language]) => language);
    }
    
    /**
     * Get total file count across all languages
     */
    static getTotalFileCount(filesByLanguage: FilesByLanguage): number {
        return Object.values(filesByLanguage)
            .reduce((total, files) => total + files.length, 0);
    }
}
