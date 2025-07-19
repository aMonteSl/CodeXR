import * as vscode from 'vscode';
import { SectionProvider } from '../common/baseInterfaces';
import { CodeAnalysisModularTreeItem, CodeAnalysisModularItemFactory } from './items/codeAnalysisItems';
import { CodeAnalysisClickHandler } from './interactions/handleCodeAnalysisClicks';
import { CodeAnalysisTreeDataProvider } from '../../code_analysis/views/codeAnalysisTreeView';
import { ProjectStructureModularAdapter } from './adapters/projectStructureAdapter';

/**
 * Code Analysis section provider - manages code analysis and file organization
 */
export class CodeAnalysisSectionProvider implements SectionProvider<CodeAnalysisModularTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CodeAnalysisModularTreeItem | undefined | null | void> = 
        new vscode.EventEmitter<CodeAnalysisModularTreeItem | undefined | null | void>();
    
    readonly onDidChangeTreeData: vscode.Event<CodeAnalysisModularTreeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private clickHandler: CodeAnalysisClickHandler;
    private codeAnalysisProvider: CodeAnalysisTreeDataProvider;
    private projectStructureAdapter: ProjectStructureModularAdapter;

    constructor(private context: vscode.ExtensionContext) {
        console.log('CODE_ANALYSIS_MODULAR: Initializing Code Analysis section provider');
        this.clickHandler = new CodeAnalysisClickHandler(context);
        this.codeAnalysisProvider = new CodeAnalysisTreeDataProvider(context);
        this.projectStructureAdapter = new ProjectStructureModularAdapter(context);
        
        // Listen to changes from the original code analysis provider
        this.codeAnalysisProvider.onDidChangeTreeData(() => {
            console.log('CODE_ANALYSIS_MODULAR: Code analysis data changed, refreshing section');
            this.refresh();
        });
    }

    /**
     * Get the section name for identification
     */
    getSectionName(): string {
        return 'codeAnalysis';
    }

    /**
     * Get the section header item
     */
    getSectionItem(): CodeAnalysisModularTreeItem {
        return new CodeAnalysisModularTreeItem(
            'CODE ANALYSIS',
            vscode.TreeItemCollapsibleState.Expanded, // Expanded by default
            'section',
            undefined,
            new vscode.ThemeIcon('search-details'),
            'Code analysis tools and metrics',
            undefined,
            'codeAnalysisSection'
        );
    }

    /**
     * Get children items for the Code Analysis section
     */
    async getChildren(element?: CodeAnalysisModularTreeItem): Promise<CodeAnalysisModularTreeItem[]> {
        if (!element) {
            // Root level - return main code analysis sections
            console.log('CODE_ANALYSIS_MODULAR: Loading code analysis section children');
            
            try {
                // Get current state from the original provider
                const filesByLanguage = (this.codeAnalysisProvider as any).filesByLanguage;
                const isScanning = (this.codeAnalysisProvider as any).isScanning || false;
                
                return CodeAnalysisModularItemFactory.createCodeAnalysisSections(
                    filesByLanguage, 
                    isScanning, 
                    this.context
                );
                
            } catch (error) {
                console.error('CODE_ANALYSIS_MODULAR: Error loading code analysis sections:', error);
                return [CodeAnalysisModularItemFactory.createErrorItem()];
            }
        }

        // Handle sub-items for collapsible sections
        if (element.originalCodeAnalysisItem) {
            console.log(`CODE_ANALYSIS_MODULAR: Loading sub-items for: ${element.label}`);
            
            // Special handling for project structure
            if (element.originalCodeAnalysisItem.type === 'project-structure') {
                console.log('CODE_ANALYSIS_MODULAR: Loading project structure children');
                const projectStructureChildren = await this.projectStructureAdapter.getProjectStructureChildren();
                
                // Convert to modular items
                return projectStructureChildren.map(child => {
                    const iconPath = typeof child.iconPath === 'string' 
                        ? new vscode.ThemeIcon(child.iconPath as string)
                        : child.iconPath as (vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | undefined);
                    
                    const tooltip = typeof child.tooltip === 'string' 
                        ? child.tooltip 
                        : child.tooltip?.value || undefined;
                    
                    const description = typeof child.description === 'string' 
                        ? child.description 
                        : undefined;
                    
                    return new CodeAnalysisModularTreeItem(
                        typeof child.label === 'string' ? child.label : child.label?.label || 'Unknown',
                        child.collapsibleState || vscode.TreeItemCollapsibleState.None,
                        'file-item',
                        child.command,
                        iconPath,
                        tooltip,
                        description,
                        child.contextValue,
                        child
                    );
                });
            }
            
            // Check if this is a project structure item that needs expansion
            if (this.projectStructureAdapter.isProjectStructureItem(element.originalCodeAnalysisItem)) {
                const projectStructureItem = this.projectStructureAdapter.getProjectStructureItem(element.originalCodeAnalysisItem);
                if (projectStructureItem) {
                    console.log(`CODE_ANALYSIS_MODULAR: Loading project structure item children for: ${projectStructureItem.name}`);
                    const projectStructureChildren = await this.projectStructureAdapter.getProjectStructureItemChildren(projectStructureItem);
                    
                    // Convert to modular items
                    return projectStructureChildren.map(child => {
                        const iconPath = typeof child.iconPath === 'string' 
                            ? new vscode.ThemeIcon(child.iconPath as string)
                            : child.iconPath as (vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | undefined);
                        
                        const tooltip = typeof child.tooltip === 'string' 
                            ? child.tooltip 
                            : child.tooltip?.value || undefined;
                        
                        const description = typeof child.description === 'string' 
                            ? child.description 
                            : undefined;
                        
                        return new CodeAnalysisModularTreeItem(
                            typeof child.label === 'string' ? child.label : child.label?.label || 'Unknown',
                            child.collapsibleState || vscode.TreeItemCollapsibleState.None,
                            'file-item',
                            child.command,
                            iconPath,
                            tooltip,
                            description,
                            child.contextValue,
                            child
                        );
                    });
                }
            }
            
            return CodeAnalysisModularItemFactory.createCodeAnalysisSubItems(
                element.originalCodeAnalysisItem,
                this.codeAnalysisProvider
            );
        }

        // No sub-items for this element
        return [];
    }

    /**
     * Refresh the section
     */
    refresh(): void {
        console.log('CODE_ANALYSIS_MODULAR: Refreshing Code Analysis section');
        this._onDidChangeTreeData.fire();
    }

    /**
     * Handle item clicks (additional method for interaction)
     */
    async handleClick(item: CodeAnalysisModularTreeItem): Promise<void> {
        await this.clickHandler.handleCodeAnalysisClick(item);
    }

    /**
     * Handle context menu actions (additional method for interaction)
     */
    async handleContextMenu(action: string, item: CodeAnalysisModularTreeItem): Promise<void> {
        await this.clickHandler.handleContextMenuAction(action, item);
    }

    /**
     * Get the underlying code analysis provider (for backward compatibility)
     */
    getCodeAnalysisProvider(): CodeAnalysisTreeDataProvider {
        return this.codeAnalysisProvider;
    }

    /**
     * Force refresh the file scanning
     */
    async refreshFileScanning(): Promise<void> {
        console.log('CODE_ANALYSIS_MODULAR: Force refreshing file scanning');
        
        // Delegate to the original provider
        if (typeof (this.codeAnalysisProvider as any).forceRefresh === 'function') {
            await (this.codeAnalysisProvider as any).forceRefresh();
        } else {
            // Fallback to regular refresh
            this.codeAnalysisProvider.refresh();
        }
    }
}
