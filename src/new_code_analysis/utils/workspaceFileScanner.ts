/**
 * Workspace File Scanner
 * Scans workspace for files and groups them by programming language
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { getLanguageForFile, LanguageInfo } from '../../utils/languageMetadata';
import { SUPPORTED_LANGUAGES } from '../../utils/supportedLanguages';

export interface FilesByLanguage {
    [languageName: string]: {
        language: LanguageInfo;
        files: string[];
    };
}

export interface WorkspaceFilesSummary {
    supportedFiles: FilesByLanguage;
    unsupportedFiles: string[];
    totalLanguages: number;
    totalFiles: number;
}

export class WorkspaceFileScanner {
    
    /**
     * Scan workspace for all files and group by programming language
     */
    static async scanWorkspaceFiles(): Promise<WorkspaceFilesSummary> {
        console.log('WORKSPACE_FILE_SCANNER: Starting workspace file scan...');
        
        const supportedFiles: FilesByLanguage = {};
        const unsupportedFiles: string[] = [];
        
        try {
            // Get all workspace folders
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                console.log('WORKSPACE_FILE_SCANNER: No workspace folders found');
                return {
                    supportedFiles,
                    unsupportedFiles,
                    totalLanguages: 0,
                    totalFiles: 0
                };
            }

            // Define patterns to exclude
            const excludePatterns = [
                '**/node_modules/**',
                '**/.*/**',
                '**/.git/**',
                '**/dist/**',
                '**/build/**',
                '**/out/**',
                '**/coverage/**',
                '**/.vscode/**',
                '**/target/**',
                '**/__pycache__/**',
                '**/*.pyc',
                '**/*.pyo',
                '**/*.min.js',
                '**/*.min.css',
                '**/package-lock.json',
                '**/yarn.lock',
                '**/Cargo.lock',
                '**/Gemfile.lock'
            ];

            // Scan each workspace folder
            for (const folder of workspaceFolders) {
                console.log(`WORKSPACE_FILE_SCANNER: Scanning folder: ${folder.uri.fsPath}`);
                
                // Find all files, excluding common build/dependency directories
                const files = await vscode.workspace.findFiles(
                    new vscode.RelativePattern(folder, '**/*'),
                    `{${excludePatterns.join(',')}}`,
                    10000 // Limit to prevent performance issues
                );

                console.log(`WORKSPACE_FILE_SCANNER: Found ${files.length} files in ${folder.name}`);

                // Process each file
                for (const fileUri of files) {
                    const filePath = fileUri.fsPath;
                    const relativePath = vscode.workspace.asRelativePath(fileUri);
                    
                    // Skip directories (just in case)
                    try {
                        const stat = await vscode.workspace.fs.stat(fileUri);
                        if (stat.type === vscode.FileType.Directory) {
                            continue;
                        }
                    } catch (error) {
                        // Skip files that can't be accessed
                        continue;
                    }

                    // Detect language
                    const languageInfo = getLanguageForFile(filePath);
                    
                    if (languageInfo) {
                        // File is supported
                        if (!supportedFiles[languageInfo.name]) {
                            supportedFiles[languageInfo.name] = {
                                language: languageInfo,
                                files: []
                            };
                        }
                        supportedFiles[languageInfo.name].files.push(relativePath);
                    } else {
                        // File is not supported for analysis
                        unsupportedFiles.push(relativePath);
                    }
                }
            }

            // Sort files within each language group
            Object.values(supportedFiles).forEach(languageGroup => {
                languageGroup.files.sort();
            });
            
            // Sort unsupported files
            unsupportedFiles.sort();

            const totalLanguages = Object.keys(supportedFiles).length;
            const totalFiles = Object.values(supportedFiles).reduce((sum, group) => sum + group.files.length, 0) + unsupportedFiles.length;

            console.log(`WORKSPACE_FILE_SCANNER: Scan complete - ${totalLanguages} languages, ${totalFiles} total files`);
            console.log(`WORKSPACE_FILE_SCANNER: Supported languages:`, Object.keys(supportedFiles));
            console.log(`WORKSPACE_FILE_SCANNER: Unsupported files count: ${unsupportedFiles.length}`);

            return {
                supportedFiles,
                unsupportedFiles,
                totalLanguages,
                totalFiles
            };

        } catch (error) {
            console.error('WORKSPACE_FILE_SCANNER: Error scanning workspace:', error);
            return {
                supportedFiles,
                unsupportedFiles,
                totalLanguages: 0,
                totalFiles: 0
            };
        }
    }

    /**
     * Get icon URI for a programming language
     */
    static getLanguageIconUri(context: vscode.ExtensionContext, languageName: string): vscode.Uri {
        // Map language names to icon file names
        const iconMapping: { [key: string]: string } = {
            'Python': 'python.svg',
            'JavaScript': 'javascript.svg',
            'TypeScript': 'typescript.svg',
            'Java': 'java.svg',
            'C': 'c.svg',
            'C++': 'cplusplus.svg',
            'C#': 'csharp.svg',
            'Go': 'go.svg',
            'Ruby': 'ruby.svg',
            'PHP': 'php.svg',
            'Swift': 'swift.svg',
            'Kotlin': 'kotlin.svg',
            'Scala': 'scala.svg',
            'Lua': 'lua.svg',
            'Perl': 'perl.svg',
            'Erlang': 'erlang.svg',
            'Fortran': 'fortran.svg',
            'Objective-C': 'objectivec.svg',
            'Solidity': 'solidity.svg',
            'TTCN-3': 'ttcn3.svg',
            'Vue': 'vuejs.svg',
            'Zig': 'zig.svg',
            'HTML': 'html5.svg',
            'GDScript': 'godot.svg'
        };

        const iconFileName = iconMapping[languageName] || 'default.svg';
        return vscode.Uri.joinPath(context.extensionUri, 'resources', 'languages_icons', 'color', iconFileName);
    }
}
