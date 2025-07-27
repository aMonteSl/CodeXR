/**
 * New Code Analysis Section Provider
 * Tree data provider for the new code analysis view section
 */

import * as vscode from 'vscode';
import { SectionProvider } from '../../views/common/baseInterfaces';
import { NewCodeAnalysisTreeItem, NewCodeAnalysisItemFactory } from './items/newCodeAnalysisItems';
import { NewCodeAnalysisInteractionHandler } from './interactions/handleNewCodeAnalysisClicks';
import { UnifiedSessionRegistry } from '../new_engine/core/sessionRegistry';
import { 
    AnalysisSettingsSubsectionProvider,
    ProjectByLanguageSubsectionProvider,
    FilesByLanguageSubsectionProvider
} from './subsections';
// SIMPLIFIED: Direct data service instead of subsection provider
import { ActiveAnalysesDataService } from './subsections/active_analyses/services/activeAnalysesDataService';
import { ActiveAnalysesCommands } from './subsections/active_analyses/commands/activeAnalysesCommands';

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

    // SIMPLIFIED: Direct services instead of subsection providers
    private activeAnalysesDataService: ActiveAnalysesDataService;
    private analysisSettingsSubsection: AnalysisSettingsSubsectionProvider;
    private projectByLanguageSubsection: ProjectByLanguageSubsectionProvider;
    private filesByLanguageSubsection: FilesByLanguageSubsectionProvider;

    constructor(private context: vscode.ExtensionContext) {
        console.log('NEW_CODE_ANALYSIS: Initializing New Code Analysis section provider');
        
        // SIMPLIFIED: Initialize direct services
        this.activeAnalysesDataService = ActiveAnalysesDataService.getInstance();
        this.activeAnalysesDataService.initialize(context);
        // Note: ActiveAnalysesCommands will be initialized by the activeAnalysesDataService
        // No need to initialize it here as it's handled by the data service internally
        
        // Initialize subsections
        this.analysisSettingsSubsection = new AnalysisSettingsSubsectionProvider(context);
        this.projectByLanguageSubsection = new ProjectByLanguageSubsectionProvider(context);
        this.filesByLanguageSubsection = new FilesByLanguageSubsectionProvider(context);

        // Setup real-time refresh callback for Files by Language
        this.filesByLanguageSubsection.setRefreshCallback(() => {
            console.log('NEW_CODE_ANALYSIS: Files by Language triggered refresh');
            this.refresh();
        });

        // Set up listener for analysis session changes to auto-refresh UI
        const sessionRegistry = UnifiedSessionRegistry.getInstance(context);
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
            'NEW ANALYSIS',
            vscode.TreeItemCollapsibleState.Expanded,
            'section',
            undefined, // command
            new vscode.ThemeIcon('beaker'),
            'New Analysis Tools and Settings',
            undefined, // description
            'newCodeAnalysis.section.main'
        );
    }

    /**
     * Refresh the tree view and all subsections
     */
    refresh(): void {
        console.log('NEW_CODE_ANALYSIS: ========== REFRESH CALLED ==========');
        console.log('NEW_CODE_ANALYSIS: Refreshing all subsections');

        // SIMPLIFIED: Refresh direct data service instead of subsection
        this.activeAnalysesDataService.refresh();
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
            // Return root subsections - SIMPLIFIED: Direct data service call
            const subsections = await Promise.all([
                Promise.resolve(this.activeAnalysesDataService.getSubsectionItem()),
                this.analysisSettingsSubsection.getSubsectionItem(),
                this.projectByLanguageSubsection.getSubsectionItem(),
                this.filesByLanguageSubsection.getSubsectionItem()
            ]);
            return subsections;
        }

        // Handle children for specific subsections
        switch (element.contextValue) {
            case 'activeAnalysesSubsection':
                // SIMPLIFIED: Direct data service call with safe mapping
                try {
                    console.log('NEW_CODE_ANALYSIS: Getting active analyses children...');
                    const items = await this.activeAnalysesDataService.getChildren();
                    console.log('NEW_CODE_ANALYSIS: Received items:', items?.length || 0);
                    
                    if (!items || !Array.isArray(items)) {
                        console.warn('NEW_CODE_ANALYSIS: activeAnalysesDataService.getChildren() returned invalid data:', typeof items);
                        return [];
                    }
                    
                    const treeItems = [];
                    for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        if (!item) {
                            console.warn(`NEW_CODE_ANALYSIS: Found null/undefined item at index ${i}`);
                            continue;
                        }
                        
                        try {
                            const treeItem = new NewCodeAnalysisTreeItem(
                                item.label || 'Unknown Analysis',
                                vscode.TreeItemCollapsibleState.None,
                                'analysis-result' as const,
                                undefined, // command
                                item.iconPath,
                                item.description || '',
                                item.description || '',
                                item.contextValue || 'activeAnalysis'
                            );
                            
                            // Store the original item for command access
                            (treeItem as any).originalNewCodeAnalysisItem = item;
                            treeItems.push(treeItem);
                            
                        } catch (itemError) {
                            console.error(`NEW_CODE_ANALYSIS: Error creating tree item at index ${i}:`, itemError);
                        }
                    }
                    
                    console.log('NEW_CODE_ANALYSIS: Created', treeItems.length, 'tree items');
                    return treeItems;
                    
                } catch (error) {
                    console.error('NEW_CODE_ANALYSIS: Error getting active analyses children:', error);
                    return [];
                }
            case 'analysisSettingsSubsection':
                return this.analysisSettingsSubsection.getChildren();
            case 'projectByLanguageSubsection':
                return this.projectByLanguageSubsection.getChildren();
            case 'filesByLanguageSubsection':
                return this.filesByLanguageSubsection.getChildren();
            
            // Handle nested settings like dimension mapping
            case 'dimensionMappingFileSetting':
                return this.analysisSettingsSubsection.getSettingChildren(element);
            
            case 'dimensionMappingDirectorySetting':
                return this.analysisSettingsSubsection.getSettingChildren(element);
            
            case 'filesByLanguageSortingSetting':
                return this.analysisSettingsSubsection.getSettingChildren(element);
            
            case 'profileConfigurationSetting':
                return this.analysisSettingsSubsection.getSettingChildren(element);
            
            // Handle Files by Language nested children
            case 'unsupportedFilesGroup':
                return this.filesByLanguageSubsection.getNestedChildren(element);
                
            default:
                // Check if it's a language group
                if (element.contextValue?.startsWith('languageGroup_')) {
                    return this.filesByLanguageSubsection.getNestedChildren(element);
                }
                // Check if it's a project directory
                if (element.contextValue?.startsWith('projectDirectory_')) {
                    return this.projectByLanguageSubsection.getNestedChildren(element);
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
