import * as vscode from 'vscode';
import * as path from 'path';
import { getLanguageForFile, LanguageInfo } from './languageMetadata';

/**
 * Shared utility for consistent file display across Code Analysis views
 */
export class FileDisplayUtils {

    /**
     * Get the appropriate icon for a file based on its language or extension
     * @param filePathOrLanguage - File path, extension, or language info
     * @param context - VS Code extension context for accessing resources
     * @returns vscode.Uri for colored icon or vscode.ThemeIcon for default
     */
    static getFileIcon(
        filePathOrLanguage: string | LanguageInfo | null, 
        context?: vscode.ExtensionContext
    ): vscode.ThemeIcon | vscode.Uri {
        
        if (!context) {
            console.log('FILE_RENDER: No context available — using default icon');
            return vscode.ThemeIcon.File;
        }

        let languageInfo: LanguageInfo | null = null;
        
        // Determine language info from input
        if (typeof filePathOrLanguage === 'string') {
            // If it's a file path, detect language
            languageInfo = getLanguageForFile(filePathOrLanguage);
        } else if (filePathOrLanguage && typeof filePathOrLanguage === 'object') {
            // If it's already a LanguageInfo object
            languageInfo = filePathOrLanguage;
        }

        if (!languageInfo) {
            console.log('FILE_RENDER: No language detected — using default icon');
            return vscode.ThemeIcon.File;
        }

        // Map language names to colored SVG icon filenames
        const iconMapping: { [key: string]: string } = {
            'C': 'c.svg',
            'C++': 'cplusplus.svg', 
            'C#': 'csharp.svg',
            'Erlang': 'erlang.svg',
            'Fortran': 'fortran.svg',
            'GDScript': 'godot.svg',
            'Go': 'go.svg',
            'HTML': 'html5.svg',
            'Java': 'java.svg',
            'JavaScript': 'javascript.svg',
            'Kotlin': 'kotlin.svg',
            'Lua': 'lua.svg',
            'Objective-C': 'objectivec.svg',
            'Perl': 'perl.svg',
            'PHP': 'php.svg',
            'Python': 'python.svg',
            'Ruby': 'ruby.svg',
            'Rust': 'rust.svg',
            'Scala': 'scala.svg',
            'Solidity': 'solidity.svg',
            'Swift': 'swift.svg',
            'TTCN-3': 'ttcn3.svg',
            'TypeScript': 'typescript.svg',
            'Vue': 'vuejs.svg',
            'Zig': 'zig.svg'
        };

        const iconFileName = iconMapping[languageInfo.name];
        
        if (iconFileName) {
            const iconPath = vscode.Uri.joinPath(
                context.extensionUri, 
                'resources', 
                'languages_icons', 
                'color', 
                iconFileName
            );
            
            console.log(`FILE_RENDER: Using colored icon for ${languageInfo.name}: ${iconFileName}`);
            return iconPath;
        }

        console.log(`FILE_RENDER: No colored icon found for ${languageInfo.name} — using default icon`);
        return vscode.ThemeIcon.File;
    }

    /**
     * Get context-appropriate description for a file
     * @param filePath - Full file path
     * @param viewType - Type of view requesting the description
     * @param fileSize - Optional file size in bytes (for project view)
     * @returns Formatted description string
     */
    static getFileDescription(
        filePath: string, 
        viewType: 'project' | 'language',
        fileSize?: number
    ): string {
        
        if (viewType === 'project' && fileSize !== undefined) {
            const formattedSize = this.formatFileSize(fileSize);
            console.log(`FILE_RENDER: Project view description for ${path.basename(filePath)}: ${formattedSize}`);
            return formattedSize;
        }
        
        if (viewType === 'language') {
            // Get relative path from workspace root
            let relativePath = filePath;
            
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
                if (filePath.startsWith(workspaceRoot)) {
                    relativePath = path.relative(workspaceRoot, filePath);
                }
            }
            
            console.log(`FILE_RENDER: Language view description for ${path.basename(filePath)}: ${relativePath}`);
            return relativePath;
        }

        console.log(`FILE_RENDER: No description for ${path.basename(filePath)} in view type ${viewType}`);
        return '';
    }

    /**
     * Format file size in human-readable format
     * @param bytes - File size in bytes
     * @returns Formatted size string (e.g., "12.4 KB")
     */
    static formatFileSize(bytes: number): string {
        if (bytes === 0) {
            return '0 B';
        }
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * Create a complete file tree item with unified display logic
     * @param fileName - Name of the file
     * @param filePath - Full path to the file  
     * @param viewType - Type of view for context-specific description
     * @param fileSize - Optional file size in bytes
     * @param context - VS Code extension context
     * @param command - Optional command to execute on click
     * @returns Configured vscode.TreeItem properties
     */
    static createFileTreeItemProperties(
        fileName: string,
        filePath: string,
        viewType: 'project' | 'language',
        fileSize?: number,
        context?: vscode.ExtensionContext,
        command?: vscode.Command
    ): {
        iconPath: vscode.ThemeIcon | vscode.Uri;
        description: string;
        tooltip: string;
        command?: vscode.Command;
    } {
        
        const iconPath = this.getFileIcon(filePath, context);
        const description = this.getFileDescription(filePath, viewType, fileSize);
        
        // Create detailed tooltip
        const languageInfo = getLanguageForFile(filePath);
        const tooltipLines: string[] = [];
        
        tooltipLines.push(`**${fileName}**`);
        tooltipLines.push(`Path: ${filePath}`);
        
        if (languageInfo) {
            tooltipLines.push(`Language: ${languageInfo.name}`);
        }
        
        if (fileSize !== undefined) {
            tooltipLines.push(`Size: ${this.formatFileSize(fileSize)}`);
        }
        
        // Add default file open command if none provided
        const finalCommand = command || {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [vscode.Uri.file(filePath)]
        };

        console.log(`FILE_RENDER: Created tree item properties for ${fileName} in ${viewType} view`);
        
        return {
            iconPath,
            description,
            tooltip: tooltipLines.join('\n'),
            command: finalCommand
        };
    }

    /**
     * Check if a colored icon exists for a given language
     * @param languageName - Name of the programming language
     * @param context - VS Code extension context
     * @returns true if a colored icon is available
     */
    static hasColoredIcon(languageName: string, context?: vscode.ExtensionContext): boolean {
        if (!context) {
            return false;
        }

        const iconMapping: { [key: string]: string } = {
            'C': 'c.svg',
            'C++': 'cplusplus.svg', 
            'C#': 'csharp.svg',
            'Erlang': 'erlang.svg',
            'Fortran': 'fortran.svg',
            'GDScript': 'godot.svg',
            'Go': 'go.svg',
            'HTML': 'html5.svg',
            'Java': 'java.svg',
            'JavaScript': 'javascript.svg',
            'Kotlin': 'kotlin.svg',
            'Lua': 'lua.svg',
            'Objective-C': 'objectivec.svg',
            'Perl': 'perl.svg',
            'PHP': 'php.svg',
            'Python': 'python.svg',
            'Ruby': 'ruby.svg',
            'Rust': 'rust.svg',
            'Scala': 'scala.svg',
            'Solidity': 'solidity.svg',
            'Swift': 'swift.svg',
            'TTCN-3': 'ttcn3.svg',
            'TypeScript': 'typescript.svg',
            'Vue': 'vuejs.svg',
            'Zig': 'zig.svg'
        };

        return iconMapping[languageName] !== undefined;
    }

    /**
     * Get all supported languages with colored icons
     * @returns Array of language names that have colored icons
     */
    static getSupportedColoredLanguages(): string[] {
        return [
            'C', 'C++', 'C#', 'Erlang', 'Fortran', 'GDScript', 'Go', 'HTML',
            'Java', 'JavaScript', 'Kotlin', 'Lua', 'Objective-C', 'Perl', 
            'PHP', 'Python', 'Ruby', 'Rust', 'Scala', 'Solidity', 'Swift',
            'TTCN-3', 'TypeScript', 'Vue', 'Zig'
        ];
    }
}

/**
 * Legacy compatibility - re-export for backwards compatibility
 * @deprecated Use FileDisplayUtils.getFileIcon instead
 */
export function getFileIcon(filePathOrLanguage: string | LanguageInfo | null, context?: vscode.ExtensionContext): vscode.ThemeIcon | vscode.Uri {
    console.log('FILE_RENDER: Using deprecated getFileIcon function, please use FileDisplayUtils.getFileIcon');
    return FileDisplayUtils.getFileIcon(filePathOrLanguage, context);
}

/**
 * Legacy compatibility - re-export for backwards compatibility  
 * @deprecated Use FileDisplayUtils.getFileDescription instead
 */
export function getFileDescription(filePath: string, viewType: 'project' | 'language', fileSize?: number): string {
    console.log('FILE_RENDER: Using deprecated getFileDescription function, please use FileDisplayUtils.getFileDescription');
    return FileDisplayUtils.getFileDescription(filePath, viewType, fileSize);
}
