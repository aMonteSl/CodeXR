/**
 * Analysis Section Provider
 * Tree data provider for the analysis view section.
 */

import * as vscode from 'vscode';
import { SectionProvider } from '../../views/common/baseInterfaces';
import { CodeAnalysisTreeItem } from './items/analysisItems';
import { CodeAnalysisInteractionHandler } from './interactions/handleAnalysisClicks';
import { UnifiedSessionRegistry } from '../engine/core/sessionRegistry';
import {
    AnalysisSettingsSubsectionProvider,
    ProjectByLanguageSubsectionProvider,
    FilesByLanguageSubsectionProvider,
} from './subsections';
import { ActiveAnalysesDataService } from './subsections/active_analyses/services/activeAnalysesDataService';
import { WorkspaceSnapshotService } from '../services/workspaceSnapshotService';
import { CodeXRLogger } from '../../core/logging/logger';

const logger = CodeXRLogger.getLogger('ANALYSIS');

export class AnalysisSectionProvider implements SectionProvider<CodeAnalysisTreeItem> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<CodeAnalysisTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<CodeAnalysisTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private readonly activeAnalysesDataService: ActiveAnalysesDataService;
    private readonly analysisSettingsSubsection: AnalysisSettingsSubsectionProvider;
    private readonly projectByLanguageSubsection: ProjectByLanguageSubsectionProvider;
    private readonly filesByLanguageSubsection: FilesByLanguageSubsectionProvider;
    private readonly workspaceSnapshotService: WorkspaceSnapshotService;
    private readonly workspaceSnapshotSubscription: vscode.Disposable;
    private readonly sessionRegistrySubscription: vscode.Disposable;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.activeAnalysesDataService = ActiveAnalysesDataService.getInstance();
        this.activeAnalysesDataService.initialize(context);

        this.analysisSettingsSubsection = new AnalysisSettingsSubsectionProvider(context);
        this.projectByLanguageSubsection = new ProjectByLanguageSubsectionProvider(context);
        this.filesByLanguageSubsection = new FilesByLanguageSubsectionProvider(context);
        this.workspaceSnapshotService = WorkspaceSnapshotService.getInstance(context);

        this.workspaceSnapshotSubscription = this.workspaceSnapshotService.onDidChangeSnapshot(() => {
            logger.debug(() => 'Workspace snapshot updated; refreshing ANALYSIS tree.');
            this._onDidChangeTreeData.fire();
        });

        const sessionRegistry = UnifiedSessionRegistry.getInstance(context);
        this.sessionRegistrySubscription = sessionRegistry.onSessionChanged((session) => {
            logger.debug(() => `Session ${session.id} changed to ${session.status}; refreshing ANALYSIS tree.`);
            this.refresh();
        });
    }

    /**
     * Get the section name for identification
     */
    getSectionName(): string {
        return 'analysis';
    }

    /**
     * Get the section header item
     */
    getSectionItem(): CodeAnalysisTreeItem {
        return new CodeAnalysisTreeItem(
            'ANALYSIS',
            vscode.TreeItemCollapsibleState.Expanded,
            'section',
            undefined,
            new vscode.ThemeIcon('beaker'),
            'Analysis tools and settings',
            undefined,
            'codeXR.analysis.section.main',
        );
    }

    /**
     * Refresh the tree view and subsection state.
     */
    refresh(): void {
        this.activeAnalysesDataService.refresh();
        this.analysisSettingsSubsection.refresh();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CodeAnalysisTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: CodeAnalysisTreeItem): Promise<CodeAnalysisTreeItem[]> {
        if (!element) {
            return Promise.all([
                Promise.resolve(this.activeAnalysesDataService.getSubsectionItem()),
                this.analysisSettingsSubsection.getSubsectionItem(),
                Promise.resolve(this.projectByLanguageSubsection.getSubsectionItem()),
                this.filesByLanguageSubsection.getSubsectionItem(),
            ]);
        }

        switch (element.contextValue) {
            case 'activeAnalysesSubsection':
                return this.getActiveAnalysisChildren();
            case 'analysisSettingsSubsection':
                return this.analysisSettingsSubsection.getChildren();
            case 'projectByLanguageSubsection':
                return this.projectByLanguageSubsection.getChildren();
            case 'filesByLanguageSubsection':
                return this.filesByLanguageSubsection.getChildren();
            case 'dimensionMappingFileSetting':
            case 'dimensionMappingDirectorySetting':
            case 'filesByLanguageSortingSetting':
            case 'profileConfigurationSetting':
                return this.analysisSettingsSubsection.getSettingChildren(element);
            case 'unsupportedFilesGroup':
                return this.filesByLanguageSubsection.getNestedChildren(element);
            default:
                if (element.contextValue?.startsWith('languageGroup_')) {
                    return this.filesByLanguageSubsection.getNestedChildren(element);
                }

                if (element.contextValue?.startsWith('projectDirectory_')) {
                    return this.projectByLanguageSubsection.getNestedChildren(element);
                }

                return [];
        }
    }

    /**
     * Handle item selection
     */
    async onItemSelected(item: CodeAnalysisTreeItem): Promise<void> {
        await CodeAnalysisInteractionHandler.handleItemClick(item);
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.workspaceSnapshotSubscription.dispose();
        this.sessionRegistrySubscription.dispose();
        this.filesByLanguageSubsection.dispose();
        this.projectByLanguageSubsection.dispose();
        this._onDidChangeTreeData.dispose();
    }

    private async getActiveAnalysisChildren(): Promise<CodeAnalysisTreeItem[]> {
        try {
            const items = await this.activeAnalysesDataService.getChildren();
            if (!Array.isArray(items)) {
                logger.warn(() => `Active analyses service returned a non-array payload: ${typeof items}.`);
                return [];
            }

            const treeItems: CodeAnalysisTreeItem[] = [];
            for (const item of items) {
                if (!item) {
                    continue;
                }

                const treeItem = new CodeAnalysisTreeItem(
                    item.label || 'Unknown Analysis',
                    vscode.TreeItemCollapsibleState.None,
                    'analysis-result',
                    undefined,
                    item.iconPath,
                    item.description || '',
                    item.description || '',
                    item.contextValue || 'activeAnalysis',
                );

                (treeItem as any).originalAnalysisItem = item;
                treeItems.push(treeItem);
            }

            return treeItems;
        } catch (error) {
            logger.error('Failed to load Active Analyses items.', error);
            return [];
        }
    }
}

