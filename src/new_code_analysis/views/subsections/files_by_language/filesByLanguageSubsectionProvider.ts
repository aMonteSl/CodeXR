/**
 * Files by Language Subsection Provider
 * Manages the Files by Language subsection of New Code Analysis
 */

import * as vscode from 'vscode';
import { NewCodeAnalysisTreeItem } from '../../items/newCodeAnalysisItems';
import { WorkspaceFileScanner, WorkspaceFilesSummary } from '../../../utils/workspaceFileScanner';
import { FilesByLanguageSortingUtils, LanguageGroupWithMetadata } from '../../../utils/filesByLanguageSortingUtils';
import { AnalysisConfigurationStorage } from '../../../configuration/analysisConfigurationStorage';
import { LaunchAnalyzeFileXR } from '../../../engine/launchAnalyzeFileXR';
import { LaunchAnalyzeFileLivePanel } from '../../../engine/launchAnalyzeFileLivePanel';
import { LaunchVisualizeDOMPanel } from '../../../engine/launchVisualizeDOMPanel';

export class FilesByLanguageSubsectionProvider {
    private cachedSummary: WorkspaceFilesSummary | null = null;
    private lastScanTime: number = 0;
    private readonly CACHE_DURATION = 30000; // 30 seconds cache
    private storage: AnalysisConfigurationStorage;
    private fileWatcher: vscode.FileSystemWatcher | null = null;
    private refreshCallback: (() => void) | null = null;
    
    constructor(private context: vscode.ExtensionContext) {
        console.log('NEW_CODE_ANALYSIS: Initializing Files by Language subsection provider');
        this.storage = AnalysisConfigurationStorage.getInstance(context);
        this.setupFileWatcher();
    }

    /**
     * Get the subsection header item
     */
    async getSubsectionItem(): Promise<NewCodeAnalysisTreeItem> {
        const summary = await this.getWorkspaceFilesSummary();
        
        const description = `(${summary.totalLanguages} languages - ${summary.totalFiles} files) - Individual files organized by programming language`;
        
        return new NewCodeAnalysisTreeItem(
            'Files by Language',
            vscode.TreeItemCollapsibleState.Collapsed,
            'subsection',
            undefined,
            new vscode.ThemeIcon('folder'), // Changed to folder icon in white as requested
            description, // This goes to tooltip
            description, // This goes to description (visible text)
            'filesByLanguageSubsection'
        );
    }

    /**
     * Get children for this subsection (language groups + unsupported files)
     */
    async getChildren(): Promise<NewCodeAnalysisTreeItem[]> {
        console.log('NEW_CODE_ANALYSIS: Getting Files by Language children');
        
        const summary = await this.getWorkspaceFilesSummary();
        const sortingConfig = await this.storage.getFilesByLanguageSorting();
        const children: NewCodeAnalysisTreeItem[] = [];

        // Sort language groups according to configuration
        const sortedLanguageGroups = FilesByLanguageSortingUtils.sortLanguageGroups(
            summary.supportedFiles,
            sortingConfig
        );
        
        for (const languageGroup of sortedLanguageGroups) {
            const fileCount = languageGroup.fileCount;
            
            // Get icon for this language
            const iconUri = WorkspaceFileScanner.getLanguageIconUri(this.context, languageGroup.languageName);
            
            const languageItem = new NewCodeAnalysisTreeItem(
                languageGroup.languageName,
                vscode.TreeItemCollapsibleState.Collapsed,
                'subsection',
                undefined,
                iconUri,
                `${fileCount} files`,
                `${fileCount} files of ${languageGroup.languageName}`,
                `languageGroup_${languageGroup.languageName}`
            );
            
            children.push(languageItem);
        }

        // Add unsupported files group if there are any
        if (summary.unsupportedFiles.length > 0) {
            const unsupportedItem = new NewCodeAnalysisTreeItem(
                'Unsupported Files',
                vscode.TreeItemCollapsibleState.Collapsed,
                'subsection',
                undefined,
                new vscode.ThemeIcon('file-text', new vscode.ThemeColor('editorWarning.foreground')),
                `${summary.unsupportedFiles.length} files`,
                `${summary.unsupportedFiles.length} files not supported for analysis`,
                'unsupportedFilesGroup'
            );
            
            children.push(unsupportedItem);
        }

        console.log(`NEW_CODE_ANALYSIS: Files by Language children count: ${children.length}`);
        return children;
    }

    /**
     * Get files for a specific language group
     */
    async getLanguageGroupFiles(languageName: string): Promise<NewCodeAnalysisTreeItem[]> {
        console.log(`NEW_CODE_ANALYSIS: Getting files for language: ${languageName}`);
        
        const summary = await this.getWorkspaceFilesSummary();
        const languageGroup = summary.supportedFiles[languageName];
        
        if (!languageGroup) {
            console.log(`NEW_CODE_ANALYSIS: Language group not found: ${languageName}`);
            return [];
        }

        // Get sorting configuration and sort files
        const sortingConfig = await this.storage.getFilesByLanguageSorting();
        const sortedFiles = await FilesByLanguageSortingUtils.sortFilesInGroup(
            languageGroup.files,
            sortingConfig
        );

        const children: NewCodeAnalysisTreeItem[] = [];
        const iconUri = WorkspaceFileScanner.getLanguageIconUri(this.context, languageName);

        for (const filePath of sortedFiles) {
            const fileName = require('path').basename(filePath);
            
            const fileItem = new NewCodeAnalysisTreeItem(
                fileName,
                vscode.TreeItemCollapsibleState.None,
                'file-item',
                {
                    command: 'newCodeAnalysis.runAndAnalyzeFile',
                    title: 'Run and Analyze File',
                    arguments: [filePath, languageName]
                },
                iconUri,
                filePath,
                `${vscode.workspace.asRelativePath(filePath)} - Click to run and analyze`, // Added file path before description
                `languageFile_${languageName}_${encodeURIComponent(filePath)}`
            );
            
            children.push(fileItem);
        }

        console.log(`NEW_CODE_ANALYSIS: Found ${children.length} files for ${languageName}`);
        return children;
    }

    /**
     * Get unsupported files
     */
    async getUnsupportedFiles(): Promise<NewCodeAnalysisTreeItem[]> {
        console.log(`NEW_CODE_ANALYSIS: Getting unsupported files`);
        
        const summary = await this.getWorkspaceFilesSummary();
        
        // Sort unsupported files alphabetically for consistency
        const sortedUnsupportedFiles = [...summary.unsupportedFiles].sort();
        const children: NewCodeAnalysisTreeItem[] = [];

        for (const filePath of sortedUnsupportedFiles) {
            const fileName = require('path').basename(filePath);
            const fileExtension = require('path').extname(filePath);
            
            const fileItem = new NewCodeAnalysisTreeItem(
                fileName,
                vscode.TreeItemCollapsibleState.None,
                'file-item',
                {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [vscode.Uri.file(require('path').resolve(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', filePath))]
                },
                new vscode.ThemeIcon('file-text'),
                filePath,
                `${fileExtension} file - Click to open`,
                `unsupportedFile_${encodeURIComponent(filePath)}`
            );
            
            children.push(fileItem);
        }

        console.log(`NEW_CODE_ANALYSIS: Found ${children.length} unsupported files`);
        return children;
    }

    /**
     * Get workspace files summary with caching
     */
    private async getWorkspaceFilesSummary(): Promise<WorkspaceFilesSummary> {
        const now = Date.now();
        
        // Return cached result if still valid
        if (this.cachedSummary && (now - this.lastScanTime) < this.CACHE_DURATION) {
            console.log('NEW_CODE_ANALYSIS: Using cached workspace files summary');
            return this.cachedSummary;
        }

        // Scan workspace files
        console.log('NEW_CODE_ANALYSIS: Scanning workspace files...');
        this.cachedSummary = await WorkspaceFileScanner.scanWorkspaceFiles();
        this.lastScanTime = now;
        
        return this.cachedSummary;
    }

    /**
     * Force refresh of files data
     */
    async refresh(): Promise<void> {
        console.log('NEW_CODE_ANALYSIS: Refreshing Files by Language subsection');
        this.cachedSummary = null;
        this.lastScanTime = 0;
        // Next call to getWorkspaceFilesSummary() will trigger a fresh scan
    }

    /**
     * Get specific children for nested items
     */
    async getNestedChildren(element: NewCodeAnalysisTreeItem): Promise<NewCodeAnalysisTreeItem[]> {
        console.log(`NEW_CODE_ANALYSIS: Getting nested children for: ${element.contextValue}`);
        
        if (element.contextValue?.startsWith('languageGroup_')) {
            const languageName = element.contextValue.replace('languageGroup_', '');
            return await this.getLanguageGroupFiles(languageName);
        }
        
        if (element.contextValue === 'unsupportedFilesGroup') {
            return await this.getUnsupportedFiles();
        }
        
        return [];
    }

    /**
     * Set refresh callback for real-time updates
     */
    setRefreshCallback(callback: () => void): void {
        this.refreshCallback = callback;
    }

    /**
     * Setup file watcher for real-time updates
     */
    private setupFileWatcher(): void {
        try {
            console.log('NEW_CODE_ANALYSIS: Setting up file watcher for Files by Language');
            
            // Create file watcher for all files in workspace
            this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
            
            // Handle file creation
            this.fileWatcher.onDidCreate((uri) => {
                console.log('NEW_CODE_ANALYSIS: File created:', uri.fsPath);
                this.handleFileChange();
            });
            
            // Handle file deletion
            this.fileWatcher.onDidDelete((uri) => {
                console.log('NEW_CODE_ANALYSIS: File deleted:', uri.fsPath);
                this.handleFileChange();
            });
            
            // Handle file renaming/moving (this triggers delete + create)
            // No need for onDidChange as we only care about structure changes
            
            // Add to context subscriptions for cleanup
            this.context.subscriptions.push(this.fileWatcher);
            
            console.log('NEW_CODE_ANALYSIS: File watcher setup completed');
            
        } catch (error) {
            console.error('NEW_CODE_ANALYSIS: Error setting up file watcher:', error);
        }
    }

    /**
     * Handle file system changes
     */
    private handleFileChange(): void {
        try {
            console.log('NEW_CODE_ANALYSIS: Handling file system change for Files by Language');
            
            // Invalidate cache immediately
            this.cachedSummary = null;
            this.lastScanTime = 0;
            
            // Trigger refresh if callback is available
            if (this.refreshCallback) {
                console.log('NEW_CODE_ANALYSIS: Triggering Files by Language refresh');
                this.refreshCallback();
            }
            
        } catch (error) {
            console.error('NEW_CODE_ANALYSIS: Error handling file change:', error);
        }
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        console.log('NEW_CODE_ANALYSIS: Disposing Files by Language subsection provider');
        
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = null;
        }
        
        this.refreshCallback = null;
        this.cachedSummary = null;
    }
}
