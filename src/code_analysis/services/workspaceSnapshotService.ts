import * as path from 'path';
import * as vscode from 'vscode';
import { getLanguageForFile } from '../../utils/languageMetadata';
import { CodeXRLogger } from '../../core/logging/logger';
import { FilesByLanguage } from '../utils/workspaceFileScanner';
import { shouldSkipWorkspaceEntry, sortWorkspaceEntries } from './workspaceSnapshotModel';

const SUMMARY_CACHE_KEY = 'codeXR.analysis.filesByLanguage.summaryCache';
const LEGACY_SUMMARY_CACHE_KEYS = [
    'codeXR.newCodeAnalysis.filesByLanguage.summaryCache',
    'codeXR.codeXR.analysis.filesByLanguage.summaryCache',
];
const WATCHER_REFRESH_DEBOUNCE_MS = 250;
const logger = CodeXRLogger.getLogger('WORKSPACE_SNAPSHOT');

export interface WorkspaceSummarySnapshot {
    totalLanguages: number;
    totalFiles: number;
    updatedAt: number;
}

export interface WorkspaceSnapshotNode {
    name: string;
    relativePath: string;
    absolutePath: string;
    isDirectory: boolean;
    languageName?: string;
    isSupportedFile?: boolean;
    children: WorkspaceSnapshotNode[];
}

export interface WorkspaceSnapshot {
    workspaceName: string;
    workspaceRootPath: string | null;
    rootItems: WorkspaceSnapshotNode[];
    supportedFiles: FilesByLanguage;
    unsupportedFiles: string[];
    totalLanguages: number;
    totalFiles: number;
    updatedAt: number;
}

interface DirectoryScanEntry {
    name: string;
    isDirectory: boolean;
    isFile: boolean;
    isSymbolicLink: boolean;
}

interface DirectoryScanResult {
    node: WorkspaceSnapshotNode;
    supportedFiles: FilesByLanguage;
    unsupportedFiles: string[];
}

export class WorkspaceSnapshotService {
    private static instance: WorkspaceSnapshotService | undefined;

    private readonly _onDidChangeSnapshot = new vscode.EventEmitter<void>();
    readonly onDidChangeSnapshot: vscode.Event<void> = this._onDidChangeSnapshot.event;

    private snapshot: WorkspaceSnapshot | null = null;
    private snapshotLoadPromise: Promise<WorkspaceSnapshot> | null = null;
    private cachedSummary: WorkspaceSummarySnapshot | null;
    private readonly directoryIndex = new Map<string, WorkspaceSnapshotNode>();
    private fileWatcher: vscode.FileSystemWatcher | null = null;
    private refreshTimer: NodeJS.Timeout | undefined;
    private pendingRefreshAfterCurrentScan = false;

    private constructor(private readonly context: vscode.ExtensionContext) {
        this.cachedSummary = this.getStoredSummarySnapshot();

        const workspaceFoldersSubscription = vscode.workspace.onDidChangeWorkspaceFolders(() => {
            this.recreateWatcher();
            this.invalidateSnapshot();
            this.scheduleBackgroundRefresh();
        });

        this.context.subscriptions.push(workspaceFoldersSubscription);
    }

    static getInstance(context: vscode.ExtensionContext): WorkspaceSnapshotService {
        if (!WorkspaceSnapshotService.instance) {
            WorkspaceSnapshotService.instance = new WorkspaceSnapshotService(context);
        }

        return WorkspaceSnapshotService.instance;
    }

    prime(): void {
        this.ensureWatcher();

        if (!this.snapshot && !this.snapshotLoadPromise) {
            this.refreshInBackground();
        }
    }

    getSummarySnapshot(): WorkspaceSummarySnapshot | null {
        if (this.snapshot) {
            return {
                totalLanguages: this.snapshot.totalLanguages,
                totalFiles: this.snapshot.totalFiles,
                updatedAt: this.snapshot.updatedAt,
            };
        }

        return this.cachedSummary;
    }

    async getSnapshot(): Promise<WorkspaceSnapshot> {
        this.ensureWatcher();

        if (this.snapshot) {
            return this.snapshot;
        }

        return this.loadSnapshot(false);
    }

    async getRootItems(): Promise<WorkspaceSnapshotNode[]> {
        const snapshot = await this.getSnapshot();
        return snapshot.rootItems;
    }

    async getDirectoryChildren(relativePath: string): Promise<WorkspaceSnapshotNode[]> {
        const snapshot = await this.getSnapshot();

        if (!relativePath) {
            return snapshot.rootItems;
        }

        return this.directoryIndex.get(relativePath)?.children ?? [];
    }

    async refresh(): Promise<WorkspaceSnapshot> {
        this.invalidateSnapshot();
        return this.loadSnapshot(true);
    }

    dispose(): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = undefined;
        }

        this.fileWatcher?.dispose();
        this.fileWatcher = null;
        this.snapshot = null;
        this.snapshotLoadPromise = null;
        this.directoryIndex.clear();
        this._onDidChangeSnapshot.dispose();
    }

    private recreateWatcher(): void {
        this.fileWatcher?.dispose();
        this.fileWatcher = null;
        this.ensureWatcher();
    }

    private ensureWatcher(): void {
        if (this.fileWatcher) {
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        this.fileWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceFolder, '**/*'),
        );

        this.fileWatcher.onDidCreate((uri) => this.handleWorkspaceChange(uri));
        this.fileWatcher.onDidDelete((uri) => this.handleWorkspaceChange(uri));
        this.fileWatcher.onDidChange((uri) => this.handleWorkspaceChange(uri));

        this.context.subscriptions.push(this.fileWatcher);
    }

    private handleWorkspaceChange(uri: vscode.Uri): void {
        logger.debug(() => `Workspace snapshot invalidated by change at ${uri.fsPath}.`);
        this.invalidateSnapshot();

        if (this.snapshotLoadPromise) {
            this.pendingRefreshAfterCurrentScan = true;
            return;
        }

        this.scheduleBackgroundRefresh();
    }

    private scheduleBackgroundRefresh(): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }

        this.refreshTimer = setTimeout(() => {
            this.refreshTimer = undefined;
            this.refreshInBackground();
        }, WATCHER_REFRESH_DEBOUNCE_MS);
    }

    private refreshInBackground(): void {
        if (this.snapshotLoadPromise) {
            this.pendingRefreshAfterCurrentScan = true;
            return;
        }

        void this.loadSnapshot(true).catch((error) => {
            logger.warn('Background workspace snapshot refresh failed.', error);
        });
    }

    private async loadSnapshot(emitChangeEvent: boolean): Promise<WorkspaceSnapshot> {
        if (this.snapshotLoadPromise) {
            return this.snapshotLoadPromise;
        }

        this.snapshotLoadPromise = this.buildSnapshot();

        try {
            const snapshot = await this.snapshotLoadPromise;
            this.snapshot = snapshot;
            this.indexSnapshot(snapshot);
            await this.persistSummarySnapshot(snapshot);

            if (emitChangeEvent) {
                this._onDidChangeSnapshot.fire();
            }

            return snapshot;
        } catch (error) {
            logger.warn('Failed to build workspace snapshot.', error);
            const fallbackSnapshot = this.createEmptySnapshot();
            this.snapshot = fallbackSnapshot;
            this.indexSnapshot(fallbackSnapshot);
            await this.persistSummarySnapshot(fallbackSnapshot);

            if (emitChangeEvent) {
                this._onDidChangeSnapshot.fire();
            }

            return fallbackSnapshot;
        } finally {
            this.snapshotLoadPromise = null;

            if (this.pendingRefreshAfterCurrentScan) {
                this.pendingRefreshAfterCurrentScan = false;
                this.scheduleBackgroundRefresh();
            }
        }
    }

    private async buildSnapshot(): Promise<WorkspaceSnapshot> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return this.createEmptySnapshot();
        }

        const workspaceRootPath = workspaceFolder.uri.fsPath;
        const rootResult = await this.scanDirectory(workspaceFolder.uri, '');
        const supportedFiles = this.sortSupportedFiles(rootResult.supportedFiles);
        const unsupportedFiles = [...rootResult.unsupportedFiles].sort();
        const totalLanguages = Object.keys(supportedFiles).length;
        const totalSupportedFiles = Object.values(supportedFiles).reduce((sum, group) => sum + group.files.length, 0);
        const totalFiles = totalSupportedFiles + unsupportedFiles.length;
        const updatedAt = Date.now();

        return {
            workspaceName: path.basename(workspaceRootPath),
            workspaceRootPath,
            rootItems: rootResult.node.children,
            supportedFiles,
            unsupportedFiles,
            totalLanguages,
            totalFiles,
            updatedAt,
        };
    }

    private async scanDirectory(directoryUri: vscode.Uri, relativePath: string): Promise<DirectoryScanResult> {
        let directoryEntries: [string, vscode.FileType][];

        try {
            directoryEntries = await vscode.workspace.fs.readDirectory(directoryUri);
        } catch (error) {
            logger.warn(() => `Failed to read directory ${directoryUri.fsPath}; skipping it in workspace snapshot.`, error);
            return {
                node: this.createDirectoryNode(directoryUri, relativePath, []),
                supportedFiles: {},
                unsupportedFiles: [],
            };
        }

        const normalizedEntries = sortWorkspaceEntries(
            directoryEntries
                .map(([name, type]): DirectoryScanEntry => ({
                    name,
                    isDirectory: (type & vscode.FileType.Directory) !== 0,
                    isFile: (type & vscode.FileType.File) !== 0,
                    isSymbolicLink: (type & vscode.FileType.SymbolicLink) !== 0,
                }))
                .filter((entry) => !entry.isSymbolicLink && !shouldSkipWorkspaceEntry(entry.name) && (entry.isDirectory || entry.isFile)),
        );

        const children: WorkspaceSnapshotNode[] = [];
        const supportedFiles: FilesByLanguage = {};
        const unsupportedFiles: string[] = [];

        for (const entry of normalizedEntries) {
            const entryUri = vscode.Uri.joinPath(directoryUri, entry.name);
            const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;

            if (entry.isDirectory) {
                const childDirectory = await this.scanDirectory(entryUri, entryRelativePath);
                children.push(childDirectory.node);
                this.mergeSupportedFiles(supportedFiles, childDirectory.supportedFiles);
                unsupportedFiles.push(...childDirectory.unsupportedFiles);
                continue;
            }

            const language = getLanguageForFile(entryUri.fsPath);
            children.push({
                name: entry.name,
                relativePath: entryRelativePath,
                absolutePath: entryUri.fsPath,
                isDirectory: false,
                languageName: language?.name,
                isSupportedFile: Boolean(language),
                children: [],
            });

            if (language) {
                if (!supportedFiles[language.name]) {
                    supportedFiles[language.name] = {
                        language,
                        files: [],
                    };
                }

                supportedFiles[language.name].files.push(entryRelativePath);
            } else {
                unsupportedFiles.push(entryRelativePath);
            }
        }

        return {
            node: this.createDirectoryNode(directoryUri, relativePath, children),
            supportedFiles,
            unsupportedFiles,
        };
    }

    private createDirectoryNode(
        directoryUri: vscode.Uri,
        relativePath: string,
        children: WorkspaceSnapshotNode[],
    ): WorkspaceSnapshotNode {
        return {
            name: path.basename(directoryUri.fsPath),
            relativePath,
            absolutePath: directoryUri.fsPath,
            isDirectory: true,
            children,
        };
    }

    private mergeSupportedFiles(target: FilesByLanguage, incoming: FilesByLanguage): void {
        for (const [languageName, group] of Object.entries(incoming)) {
            if (!target[languageName]) {
                target[languageName] = {
                    language: group.language,
                    files: [],
                };
            }

            target[languageName].files.push(...group.files);
        }
    }

    private sortSupportedFiles(groups: FilesByLanguage): FilesByLanguage {
        const sortedGroups: FilesByLanguage = {};

        for (const [languageName, group] of Object.entries(groups)) {
            sortedGroups[languageName] = {
                language: group.language,
                files: [...group.files].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' })),
            };
        }

        return sortedGroups;
    }

    private indexSnapshot(snapshot: WorkspaceSnapshot): void {
        this.directoryIndex.clear();

        for (const rootItem of snapshot.rootItems) {
            this.indexNode(rootItem);
        }
    }

    private indexNode(node: WorkspaceSnapshotNode): void {
        if (!node.isDirectory) {
            return;
        }

        this.directoryIndex.set(node.relativePath, node);

        for (const child of node.children) {
            this.indexNode(child);
        }
    }

    private getStoredSummarySnapshot(): WorkspaceSummarySnapshot | null {
        const currentSnapshot = this.context.workspaceState.get<WorkspaceSummarySnapshot | null>(SUMMARY_CACHE_KEY, null);
        if (currentSnapshot) {
            return currentSnapshot;
        }

        for (const legacyKey of LEGACY_SUMMARY_CACHE_KEYS) {
            const legacySnapshot = this.context.workspaceState.get<WorkspaceSummarySnapshot | null>(legacyKey, null);
            if (legacySnapshot) {
                void this.context.workspaceState.update(SUMMARY_CACHE_KEY, legacySnapshot);
                void this.context.workspaceState.update(legacyKey, undefined);
                return legacySnapshot;
            }
        }

        return null;
    }

    private async persistSummarySnapshot(snapshot: WorkspaceSnapshot): Promise<void> {
        if (!snapshot.workspaceRootPath) {
            this.cachedSummary = null;
            await this.context.workspaceState.update(SUMMARY_CACHE_KEY, null);
            return;
        }

        this.cachedSummary = {
            totalLanguages: snapshot.totalLanguages,
            totalFiles: snapshot.totalFiles,
            updatedAt: snapshot.updatedAt,
        };

        await this.context.workspaceState.update(SUMMARY_CACHE_KEY, this.cachedSummary);
    }

    private invalidateSnapshot(): void {
        this.snapshot = null;
        this.directoryIndex.clear();
    }

    private createEmptySnapshot(): WorkspaceSnapshot {
        return {
            workspaceName: 'Project Structure',
            workspaceRootPath: null,
            rootItems: [],
            supportedFiles: {},
            unsupportedFiles: [],
            totalLanguages: 0,
            totalFiles: 0,
            updatedAt: Date.now(),
        };
    }
}


