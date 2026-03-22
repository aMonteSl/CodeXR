/**
 * Files by Language Subsection Provider
 * Manages the Files by Language subsection of New Code Analysis
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { CodeAnalysisTreeItem } from '../../items/analysisItems';
import { WorkspaceFileScanner } from '../../../utils/workspaceFileScanner';
import { FilesByLanguageSortingUtils } from '../../../utils/filesByLanguageSortingUtils';
import { AnalysisConfigurationStorage } from '../../../configuration/analysisConfigurationStorage';
import { WorkspaceSnapshotService } from '../../../services/workspaceSnapshotService';
import { CodeXRLogger } from '../../../../core/logging/logger';

const logger = CodeXRLogger.getLogger('FILES_BY_LANGUAGE');

export class FilesByLanguageSubsectionProvider {
    private readonly storage: AnalysisConfigurationStorage;
    private readonly workspaceSnapshotService: WorkspaceSnapshotService;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.storage = AnalysisConfigurationStorage.getInstance(context);
        this.workspaceSnapshotService = WorkspaceSnapshotService.getInstance(context);
    }

    /**
     * Get the subsection header item.
     */
    async getSubsectionItem(): Promise<CodeAnalysisTreeItem> {
        this.workspaceSnapshotService.prime();
        const snapshot = this.workspaceSnapshotService.getSummarySnapshot();

        if (!snapshot) {
            return new CodeAnalysisTreeItem(
                'Files by Language',
                vscode.TreeItemCollapsibleState.Collapsed,
                'subsection',
                undefined,
                new vscode.ThemeIcon('folder'),
                'Loading workspace summary...',
                'Loading workspace summary...',
                'filesByLanguageSubsection',
            );
        }

        const description = `(${snapshot.totalLanguages} languages - ${snapshot.totalFiles} files) - Individual files organized by programming language`;

        return new CodeAnalysisTreeItem(
            'Files by Language',
            vscode.TreeItemCollapsibleState.Collapsed,
            'subsection',
            undefined,
            new vscode.ThemeIcon('folder'),
            description,
            description,
            'filesByLanguageSubsection',
        );
    }

    /**
     * Get children for this subsection (language groups + unsupported files).
     */
    async getChildren(): Promise<CodeAnalysisTreeItem[]> {
        const snapshot = await this.workspaceSnapshotService.getSnapshot();
        const sortingConfig = await this.storage.getFilesByLanguageSorting();
        const children: CodeAnalysisTreeItem[] = [];

        const sortedLanguageGroups = FilesByLanguageSortingUtils.sortLanguageGroups(
            snapshot.supportedFiles,
            sortingConfig,
        );

        for (const languageGroup of sortedLanguageGroups) {
            const iconUri = WorkspaceFileScanner.getLanguageIconUri(this.context, languageGroup.languageName);
            children.push(new CodeAnalysisTreeItem(
                languageGroup.languageName,
                vscode.TreeItemCollapsibleState.Collapsed,
                'subsection',
                undefined,
                iconUri,
                `${languageGroup.fileCount} files`,
                `${languageGroup.fileCount} files of ${languageGroup.languageName}`,
                `languageGroup_${languageGroup.languageName}`,
            ));
        }

        if (snapshot.unsupportedFiles.length > 0) {
            children.push(new CodeAnalysisTreeItem(
                'Unsupported Files',
                vscode.TreeItemCollapsibleState.Collapsed,
                'subsection',
                undefined,
                new vscode.ThemeIcon('file-text', new vscode.ThemeColor('editorWarning.foreground')),
                `${snapshot.unsupportedFiles.length} files`,
                `${snapshot.unsupportedFiles.length} files not supported for analysis`,
                'unsupportedFilesGroup',
            ));
        }

        return children;
    }

    /**
     * Get files for a specific language group.
     */
    async getLanguageGroupFiles(languageName: string): Promise<CodeAnalysisTreeItem[]> {
        const snapshot = await this.workspaceSnapshotService.getSnapshot();
        const languageGroup = snapshot.supportedFiles[languageName];

        if (!languageGroup) {
            return [];
        }

        const sortingConfig = await this.storage.getFilesByLanguageSorting();
        const sortedFiles = await FilesByLanguageSortingUtils.sortFilesInGroup(
            languageGroup.files,
            sortingConfig,
        );

        const iconUri = WorkspaceFileScanner.getLanguageIconUri(this.context, languageName);
        return sortedFiles.map((filePath) => new CodeAnalysisTreeItem(
            path.basename(filePath),
            vscode.TreeItemCollapsibleState.None,
            'file-item',
            {
                command: 'codeXR.analysis.runAndAnalyzeFile',
                title: 'Run and Analyze File',
                arguments: [filePath, languageName],
            },
            iconUri,
            filePath,
            `${filePath} - Click to run and analyze`,
            `languageFile_${languageName}_${encodeURIComponent(filePath)}`,
        ));
    }

    /**
     * Get unsupported files.
     */
    async getUnsupportedFiles(): Promise<CodeAnalysisTreeItem[]> {
        const snapshot = await this.workspaceSnapshotService.getSnapshot();
        const sortedUnsupportedFiles = [...snapshot.unsupportedFiles].sort();

        return sortedUnsupportedFiles.map((filePath) => {
            const fileName = path.basename(filePath);
            const fileExtension = path.extname(filePath);

            let fullFilePath: vscode.Uri | undefined;
            try {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders && workspaceFolders.length > 0) {
                    const workspaceRoot = workspaceFolders[0].uri.fsPath;
                    fullFilePath = vscode.Uri.file(path.resolve(workspaceRoot, filePath));
                } else {
                    fullFilePath = vscode.Uri.file(filePath);
                }
            } catch (error) {
                logger.warn(() => `Failed to create file URI for ${filePath}.`, error);
                try {
                    fullFilePath = vscode.Uri.file(filePath);
                } catch {
                    fullFilePath = undefined;
                }
            }

            return new CodeAnalysisTreeItem(
                fileName,
                vscode.TreeItemCollapsibleState.None,
                'file-item',
                fullFilePath ? {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [fullFilePath],
                } : undefined,
                new vscode.ThemeIcon('file-text'),
                filePath,
                `${fileExtension} file - Click to open`,
                `unsupportedFile_${encodeURIComponent(filePath)}`,
            );
        });
    }

    /**
     * Force refresh of files data.
     */
    refresh(): void {
        void this.workspaceSnapshotService.refresh();
    }

    /**
     * Get specific children for nested items.
     */
    async getNestedChildren(element: CodeAnalysisTreeItem): Promise<CodeAnalysisTreeItem[]> {
        if (element.contextValue?.startsWith('languageGroup_')) {
            const languageName = element.contextValue.replace('languageGroup_', '');
            return this.getLanguageGroupFiles(languageName);
        }

        if (element.contextValue === 'unsupportedFilesGroup') {
            return this.getUnsupportedFiles();
        }

        return [];
    }

    /**
     * Dispose of resources.
     */
    dispose(): void {
        // Shared workspace snapshot service owns its watcher lifecycle.
    }
}


