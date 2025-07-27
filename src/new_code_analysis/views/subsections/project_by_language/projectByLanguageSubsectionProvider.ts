/**
 * Project by Language Subsection Provider
 * Manages the Project Structure subsection showing hierarchical directory/file tree
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { NewCodeAnalysisTreeItem } from '../../items/newCodeAnalysisItems';
import { WorkspaceFileScanner } from '../../../utils/workspaceFileScanner';
import { isSupportedExtension, getLanguageByExtension } from '../../../../utils/supportedLanguages';

interface ProjectStructureItem {
    name: string;
    path: string;
    isDirectory: boolean;
    language?: string;
    children?: ProjectStructureItem[];
}

export class ProjectByLanguageSubsectionProvider {
    
    constructor(private context: vscode.ExtensionContext) {
        console.log('NEW_CODE_ANALYSIS: Initializing Project Structure subsection provider');
    }

    /**
     * Get the subsection header item
     */
    getSubsectionItem(): NewCodeAnalysisTreeItem {
        // Get project name from workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const projectName = workspaceFolders && workspaceFolders.length > 0 
            ? path.basename(workspaceFolders[0].uri.fsPath)
            : 'Project Structure';
        
        return new NewCodeAnalysisTreeItem(
            `Project Structure - ${projectName}`,
            vscode.TreeItemCollapsibleState.Collapsed,
            'subsection',
            undefined,
            new vscode.ThemeIcon('folder-library', new vscode.ThemeColor('charts.foreground')),
            'Project structure organized hierarchically',
            'Browse and analyze files and directories',
            'projectByLanguageSubsection'
        );
    }

    /**
     * Get children for this subsection (root level files and directories)
     */
    async getChildren(): Promise<NewCodeAnalysisTreeItem[]> {
        console.log('NEW_CODE_ANALYSIS: Getting Project Structure children');
        
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return [new NewCodeAnalysisTreeItem(
                    'No workspace folder open',
                    vscode.TreeItemCollapsibleState.None,
                    'error',
                    undefined,
                    new vscode.ThemeIcon('error'),
                    'Open a folder to view project structure',
                    undefined,
                    'error'
                )];
            }

            const rootPath = workspaceFolders[0].uri.fsPath;
            const items = await this.getDirectoryItems(rootPath, true);
            
            console.log(`NEW_CODE_ANALYSIS: Found ${items.length} root items`);
            return items;
            
        } catch (error) {
            console.error('NEW_CODE_ANALYSIS: Error getting project structure:', error);
            return [new NewCodeAnalysisTreeItem(
                'Error reading project structure',
                vscode.TreeItemCollapsibleState.None,
                'error',
                undefined,
                new vscode.ThemeIcon('error'),
                `Failed to read project: ${error}`,
                undefined,
                'error'
            )];
        }
    }

    /**
     * Get nested children for a specific directory item
     */
    async getNestedChildren(element: NewCodeAnalysisTreeItem): Promise<NewCodeAnalysisTreeItem[]> {
        console.log(`NEW_CODE_ANALYSIS: Getting nested children for: ${element.label}`);
        
        if (element.contextValue?.startsWith('projectDirectory_')) {
            const directoryPath = element.contextValue.replace('projectDirectory_', '');
            return await this.getDirectoryItems(directoryPath, false);
        }
        
        return [];
    }

    /**
     * Get items (files and directories) for a specific directory
     */
    private async getDirectoryItems(directoryPath: string, isRoot: boolean = false): Promise<NewCodeAnalysisTreeItem[]> {
        const items: NewCodeAnalysisTreeItem[] = [];
        
        try {
            const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
            
            // Sort: directories first, then files, both alphabetically
            const sortedEntries = entries.sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) {
                    return -1;
                }
                if (!a.isDirectory() && b.isDirectory()) {
                    return 1;
                }
                return a.name.localeCompare(b.name);
            });

            for (const entry of sortedEntries) {
                // Skip hidden files/directories and common ignore patterns
                if (this.shouldSkipEntry(entry.name)) {
                    continue;
                }

                const fullPath = path.join(directoryPath, entry.name);
                
                if (entry.isDirectory()) {
                    const directoryItem = await this.createDirectoryItem(entry.name, fullPath);
                    items.push(directoryItem);
                } else {
                    const fileItem = await this.createFileItem(entry.name, fullPath);
                    items.push(fileItem);
                }
            }
            
        } catch (error) {
            console.error(`NEW_CODE_ANALYSIS: Error reading directory ${directoryPath}:`, error);
        }
        
        return items;
    }

    /**
     * Create a directory tree item
     */
    private async createDirectoryItem(name: string, fullPath: string): Promise<NewCodeAnalysisTreeItem> {
        return new NewCodeAnalysisTreeItem(
            name,
            vscode.TreeItemCollapsibleState.Collapsed,
            'subsection',
            {
                command: 'newCodeAnalysis.projectStructure.analyzeDirectory',
                title: 'Analyze Directory',
                arguments: [fullPath]
            },
            new vscode.ThemeIcon('folder', new vscode.ThemeColor('charts.foreground')),
            `Directory: ${name}`,
            `Click to analyze directory`,
            `projectDirectory_${fullPath}`
        );
    }

    /**
     * Create a file tree item
     */
    private async createFileItem(name: string, fullPath: string): Promise<NewCodeAnalysisTreeItem> {
        const ext = path.extname(name).toLowerCase();
        const isSupported = isSupportedExtension(ext);
        
        if (isSupported) {
            // Supported file - use language icon and description
            const languageConfig = getLanguageByExtension(ext);
            const language = languageConfig?.name || 'Unknown';
            
            // Get language icon from resources using the language name
            let iconUri: vscode.Uri | vscode.ThemeIcon = WorkspaceFileScanner.getLanguageIconUri(this.context, language);
            
            return new NewCodeAnalysisTreeItem(
                name,
                vscode.TreeItemCollapsibleState.None,
                'subsection',
                {
                    command: 'newCodeAnalysis.projectStructure.analyzeFile',
                    title: 'Analyze File',
                    arguments: [fullPath]
                },
                iconUri,
                `${language} file: ${name}`,
                `Click to analyze file`,
                `projectFile_${fullPath}`
            );
        } else {
            // Unsupported file - use white file icon, no description
            return new NewCodeAnalysisTreeItem(
                name,
                vscode.TreeItemCollapsibleState.None,
                'subsection',
                undefined, // No command for unsupported files
                new vscode.ThemeIcon('file', new vscode.ThemeColor('charts.foreground')),
                name, // Just the filename, no description
                undefined, // No tooltip for unsupported files
                `projectFile_${fullPath}`
            );
        }
    }

    /**
     * Check if entry should be skipped
     */
    private shouldSkipEntry(name: string): boolean {
        const skipPatterns = [
            /^\./,          // Hidden files/directories
            /^node_modules$/,
            /^\.git$/,
            /^\.vscode$/,
            /^dist$/,
            /^build$/,
            /^out$/,
            /^coverage$/,
            /^target$/,
            /^bin$/,
            /^obj$/,
            /^\.DS_Store$/,
            /^Thumbs\.db$/
        ];
        
        return skipPatterns.some(pattern => pattern.test(name));
    }

    /**
     * Handle refresh for this subsection
     */
    refresh(): void {
        // TODO: Refresh project by language data
        console.log('NEW_CODE_ANALYSIS: Refreshing Project by Language subsection');
    }
}
