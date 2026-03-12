/**
 * Project by Language Subsection Provider
 * Manages the Project Structure subsection showing hierarchical directory/file tree
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { CodeAnalysisTreeItem } from '../../items/analysisItems';
import { WorkspaceFileScanner } from '../../../utils/workspaceFileScanner';
import { WorkspaceSnapshotNode, WorkspaceSnapshotService } from '../../../services/workspaceSnapshotService';

export class ProjectByLanguageSubsectionProvider {
    private readonly workspaceSnapshotService: WorkspaceSnapshotService;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.workspaceSnapshotService = WorkspaceSnapshotService.getInstance(context);
    }

    /**
     * Get the subsection header item
     */
    getSubsectionItem(): CodeAnalysisTreeItem {
        this.workspaceSnapshotService.prime();

        const workspaceFolders = vscode.workspace.workspaceFolders;
        const projectName = workspaceFolders && workspaceFolders.length > 0
            ? path.basename(workspaceFolders[0].uri.fsPath)
            : 'Project Structure';

        return new CodeAnalysisTreeItem(
            `Project Structure - ${projectName}`,
            vscode.TreeItemCollapsibleState.Collapsed,
            'subsection',
            undefined,
            new vscode.ThemeIcon('folder-library', new vscode.ThemeColor('charts.foreground')),
            'Project structure organized hierarchically',
            'Browse and analyze files and directories',
            'projectByLanguageSubsection',
        );
    }

    /**
     * Get children for this subsection (root level files and directories)
     */
    async getChildren(): Promise<CodeAnalysisTreeItem[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [new CodeAnalysisTreeItem(
                'No workspace folder open',
                vscode.TreeItemCollapsibleState.None,
                'error',
                undefined,
                new vscode.ThemeIcon('error'),
                'Open a folder to view project structure',
                undefined,
                'error',
            )];
        }

        const items = await this.workspaceSnapshotService.getRootItems();
        return items.map((item) => this.createWorkspaceItem(item));
    }

    /**
     * Get nested children for a specific directory item
     */
    async getNestedChildren(element: CodeAnalysisTreeItem): Promise<CodeAnalysisTreeItem[]> {
        if (!element.contextValue?.startsWith('projectDirectory_')) {
            return [];
        }

        const directoryPath = decodeURIComponent(element.contextValue.replace('projectDirectory_', ''));
        const children = await this.workspaceSnapshotService.getDirectoryChildren(directoryPath);
        return children.map((child) => this.createWorkspaceItem(child));
    }

    /**
     * Handle refresh for this subsection
     */
    refresh(): void {
        void this.workspaceSnapshotService.refresh();
    }

    dispose(): void {
        // Shared workspace snapshot service owns its watcher lifecycle.
    }

    private createWorkspaceItem(node: WorkspaceSnapshotNode): CodeAnalysisTreeItem {
        if (node.isDirectory) {
            return new CodeAnalysisTreeItem(
                node.name,
                vscode.TreeItemCollapsibleState.Collapsed,
                'subsection',
                {
                    command: 'codeXR.analysis.projectStructure.analyzeDirectory',
                    title: 'Analyze Directory',
                    arguments: [node.absolutePath],
                },
                new vscode.ThemeIcon('folder', new vscode.ThemeColor('charts.foreground')),
                `Directory: ${node.name}`,
                'Click to analyze directory',
                `projectDirectory_${encodeURIComponent(node.relativePath)}`,
            );
        }

        if (node.isSupportedFile && node.languageName) {
            return new CodeAnalysisTreeItem(
                node.name,
                vscode.TreeItemCollapsibleState.None,
                'subsection',
                {
                    command: 'codeXR.analysis.projectStructure.analyzeFile',
                    title: 'Analyze File',
                    arguments: [node.absolutePath],
                },
                WorkspaceFileScanner.getLanguageIconUri(this.context, node.languageName),
                `${node.languageName} file: ${node.name}`,
                'Click to analyze file',
                `projectFile_${encodeURIComponent(node.relativePath)}`,
            );
        }

        return new CodeAnalysisTreeItem(
            node.name,
            vscode.TreeItemCollapsibleState.None,
            'subsection',
            undefined,
            new vscode.ThemeIcon('file', new vscode.ThemeColor('charts.foreground')),
            node.name,
            undefined,
            `projectFile_${encodeURIComponent(node.relativePath)}`,
        );
    }
}

