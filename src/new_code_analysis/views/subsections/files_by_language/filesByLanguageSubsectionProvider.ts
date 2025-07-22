/**
 * Files by Language Subsection Provider
 * Manages the Files by Language subsection of New Code Analysis
 */

import * as vscode from 'vscode';
import { NewCodeAnalysisTreeItem } from '../../items/newCodeAnalysisItems';
import { WorkspaceFileScanner, WorkspaceFilesSummary } from '../../../utils/workspaceFileScanner';

export class FilesByLanguageSubsectionProvider {
    private cachedSummary: WorkspaceFilesSummary | null = null;
    private lastScanTime: number = 0;
    private readonly CACHE_DURATION = 30000; // 30 seconds cache
    
    constructor(private context: vscode.ExtensionContext) {
        console.log('NEW_CODE_ANALYSIS: Initializing Files by Language subsection provider');
    }

    /**
     * Get the subsection header item
     */
    async getSubsectionItem(): Promise<NewCodeAnalysisTreeItem> {
        const summary = await this.getWorkspaceFilesSummary();
        
        const description = `${summary.totalLanguages} programming languages - ${summary.totalFiles} files`;
        
        return new NewCodeAnalysisTreeItem(
            'Files by Language',
            vscode.TreeItemCollapsibleState.Collapsed,
            'subsection',
            undefined,
            new vscode.ThemeIcon('files'),
            description,
            'Individual files organized by programming language',
            'filesByLanguageSubsection'
        );
    }

    /**
     * Get children for this subsection (language groups + unsupported files)
     */
    async getChildren(): Promise<NewCodeAnalysisTreeItem[]> {
        console.log('NEW_CODE_ANALYSIS: Getting Files by Language children');
        
        const summary = await this.getWorkspaceFilesSummary();
        const children: NewCodeAnalysisTreeItem[] = [];

        // Add supported language groups
        const languageNames = Object.keys(summary.supportedFiles).sort();
        
        for (const languageName of languageNames) {
            const languageGroup = summary.supportedFiles[languageName];
            const fileCount = languageGroup.files.length;
            
            // Get icon for this language
            const iconUri = WorkspaceFileScanner.getLanguageIconUri(this.context, languageName);
            
            const languageItem = new NewCodeAnalysisTreeItem(
                languageName,
                vscode.TreeItemCollapsibleState.Collapsed,
                'subsection',
                undefined,
                iconUri,
                `${fileCount} files`,
                `${fileCount} files of ${languageName}`,
                `languageGroup_${languageName}`
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

        const children: NewCodeAnalysisTreeItem[] = [];
        const iconUri = WorkspaceFileScanner.getLanguageIconUri(this.context, languageName);

        for (const filePath of languageGroup.files) {
            const fileName = require('path').basename(filePath);
            
            const fileItem = new NewCodeAnalysisTreeItem(
                fileName,
                vscode.TreeItemCollapsibleState.None,
                'file-item',
                {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [vscode.Uri.file(require('path').resolve(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', filePath))]
                },
                iconUri,
                filePath,
                `Click to open ${fileName}`,
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
        const children: NewCodeAnalysisTreeItem[] = [];

        for (const filePath of summary.unsupportedFiles) {
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
}
