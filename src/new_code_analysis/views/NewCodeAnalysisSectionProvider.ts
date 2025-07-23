/**
 * New Code Analysis Section Provider
 * Tree data provider for the new code analysis view section
 */

import * as vscode from 'vscode';
import { SectionProvider } from '../../views/common/baseInterfaces';
import { NewCodeAnalysisTreeItem, NewCodeAnalysisItemFactory } from './items/newCodeAnalysisItems';
import { NewCodeAnalysisInteractionHandler } from './interactions/handleNewCodeAnalysisClicks';
import { 
    AnalysisSettingsSubsectionProvider,
    ActiveAnalysesSubsectionProvider,
    ProjectByLanguageSubsectionProvider,
    FilesByLanguageSubsectionProvider
} from './subsections';
import { AnalysisSessionRegistry } from '../engine/registry/analysisSessionRegistry';

/**
 * TODO: Implement tree data provider for new code analysis
 * - Provide tree structure for analysis results
 * - Handle data refresh and updates
 * - Manage analysis state
 * - Integrate with analysis engine
 */

export class NewCodeAnalysisSectionProvider implements SectionProvider<NewCodeAnalysisTreeItem> {
    
    private _onDidChangeTreeData: vscode.EventEmitter<NewCodeAnalysisTreeItem | undefined | null | void> = new vscode.EventEmitter<NewCodeAnalysisTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<NewCodeAnalysisTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    // Subsection providers
    private activeAnalysesSubsection: ActiveAnalysesSubsectionProvider;
    private analysisSettingsSubsection: AnalysisSettingsSubsectionProvider;
    private projectByLanguageSubsection: ProjectByLanguageSubsectionProvider;
    private filesByLanguageSubsection: FilesByLanguageSubsectionProvider;

    constructor(private context: vscode.ExtensionContext) {
        console.log('NEW_CODE_ANALYSIS: Initializing New Code Analysis section provider');
        
        // Initialize subsections
        this.activeAnalysesSubsection = new ActiveAnalysesSubsectionProvider(context);
        this.analysisSettingsSubsection = new AnalysisSettingsSubsectionProvider(context);
        this.projectByLanguageSubsection = new ProjectByLanguageSubsectionProvider(context);
        this.filesByLanguageSubsection = new FilesByLanguageSubsectionProvider(context);

        // Setup real-time refresh callback for Files by Language
        this.filesByLanguageSubsection.setRefreshCallback(() => {
            console.log('NEW_CODE_ANALYSIS: Files by Language triggered refresh');
            this.refresh();
        });

        // Set up listener for analysis session changes to auto-refresh UI
        const sessionRegistry = AnalysisSessionRegistry.getInstance();
        sessionRegistry.onSessionChanged((session) => {
            console.log(`NEW_CODE_ANALYSIS: Session ${session.id} changed to ${session.status} - auto-refreshing UI`);
            this.refresh();
        });

        // Commands are now registered centrally in src/commands/new_code_analysis
        // following the "nested dolls" architecture pattern
        console.log('NEW_CODE_ANALYSIS: Section provider initialized. Commands registered centrally.');
    }

    /**
     * Get the section name for identification
     */
    getSectionName(): string {
        return 'newCodeAnalysis';
    }

    /**
     * Get the section header item
     */
    getSectionItem(): NewCodeAnalysisTreeItem {
        return new NewCodeAnalysisTreeItem(
            'NEW CODE ANALYSIS',
            vscode.TreeItemCollapsibleState.Expanded,
            'section',
            undefined,
            new vscode.ThemeIcon('search-view-icon'),
            'New experimental code analysis tools',
            undefined,
            'newCodeAnalysisSection'
        );
    }

    /**
     * Refresh the tree view and all subsections
     */
    refresh(): void {
        console.log('NEW_CODE_ANALYSIS: ========== REFRESH CALLED ==========');
        console.log('NEW_CODE_ANALYSIS: Refreshing all subsections');

        // Refresh all subsections
        this.activeAnalysesSubsection.refresh();
        this.analysisSettingsSubsection.refresh();
        this.projectByLanguageSubsection.refresh();
        this.filesByLanguageSubsection.refresh();

        // Fire the tree data change event
        console.log('NEW_CODE_ANALYSIS: About to fire _onDidChangeTreeData');
        this._onDidChangeTreeData.fire();
        console.log('NEW_CODE_ANALYSIS: ========== REFRESH COMPLETE ==========');
    }    /**
     * TODO: Get tree item representation
     */
    getTreeItem(element: NewCodeAnalysisTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children for tree element
     */
    async getChildren(element?: NewCodeAnalysisTreeItem): Promise<NewCodeAnalysisTreeItem[]> {
        if (!element) {
            // Return root subsections
            const subsections = await Promise.all([
                this.activeAnalysesSubsection.getSubsectionItem(),
                this.analysisSettingsSubsection.getSubsectionItem(),
                this.projectByLanguageSubsection.getSubsectionItem(),
                this.filesByLanguageSubsection.getSubsectionItem()
            ]);
            return subsections;
        }

        // Handle children for specific subsections
        switch (element.contextValue) {
            case 'activeAnalysesSubsection':
                return this.activeAnalysesSubsection.getChildren();
            case 'analysisSettingsSubsection':
                return this.analysisSettingsSubsection.getChildren();
            case 'projectByLanguageSubsection':
                return this.projectByLanguageSubsection.getChildren();
            case 'filesByLanguageSubsection':
                return this.filesByLanguageSubsection.getChildren();
            
            // Handle nested settings like dimension mapping
            case 'dimensionMappingFileSetting':
                return this.analysisSettingsSubsection.getSettingChildren(element);
            
            case 'filesByLanguageSortingSetting':
                return this.analysisSettingsSubsection.getSettingChildren(element);
            
            // Handle Files by Language nested children
            case 'unsupportedFilesGroup':
                return this.filesByLanguageSubsection.getNestedChildren(element);
                
            default:
                // Check if it's a language group
                if (element.contextValue?.startsWith('languageGroup_')) {
                    return this.filesByLanguageSubsection.getNestedChildren(element);
                }
                return Promise.resolve([]);
        }
    }

    /**
     * TODO: Handle item selection
     */
    async onItemSelected(item: NewCodeAnalysisTreeItem): Promise<void> {
        await NewCodeAnalysisInteractionHandler.handleItemClick(item);
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        console.log('NEW_CODE_ANALYSIS: Disposing New Code Analysis section provider');
        
        // Dispose of subsections
        if (this.filesByLanguageSubsection) {
            this.filesByLanguageSubsection.dispose();
        }
        
        // Note: Other subsections can also implement dispose if needed
    }
}
