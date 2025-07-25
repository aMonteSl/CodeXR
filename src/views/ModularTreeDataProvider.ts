import * as vscode from 'vscode';
import { SectionProvider, ModularTreeItem } from './common/baseInterfaces';
import { ServersSectionProvider } from './servers';
import { ActiveServersSectionProvider } from './active_servers';
import { BabiaExamplesSectionProvider } from './babia_examples';
import { VisualizeDataSectionProvider } from './visualize_data';
import { NewCodeAnalysisSectionProvider } from '../new_code_analysis/views/NewCodeAnalysisSectionProvider';
import { VisualizationSettingsSectionProvider } from './visualization_settings';
import { LearnMoreSectionProvider } from './learn_more';

/**
 * Main modular tree data provider that orchestrates all section providers
 */
export class ModularTreeDataProvider implements vscode.TreeDataProvider<ModularTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ModularTreeItem | undefined | null | void> = 
        new vscode.EventEmitter<ModularTreeItem | undefined | null | void>();
    
    readonly onDidChangeTreeData: vscode.Event<ModularTreeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private sectionProviders: Map<string, SectionProvider<any>> = new Map();

    constructor(private context: vscode.ExtensionContext) {
        console.log('MODULAR_TREE: Initializing modular tree data provider');
        
        // Initialize all section providers
        this.initializeSectionProviders();
    }

    /**
     * Initialize all section providers
     */
    private initializeSectionProviders(): void {
        console.log('MODULAR_TREE: Initializing section providers');
        
        // Create and register all section providers
        const providers = [
            new ServersSectionProvider(this.context),
            new ActiveServersSectionProvider(this.context),
            new BabiaExamplesSectionProvider(this.context),
            new VisualizeDataSectionProvider(this.context),
            new NewCodeAnalysisSectionProvider(this.context),
            new VisualizationSettingsSectionProvider(this.context),
            new LearnMoreSectionProvider(this.context)
        ];

        // Register providers and listen to their changes
        providers.forEach(provider => {
            const sectionName = provider.getSectionName();
            this.sectionProviders.set(sectionName, provider);
            
            // Listen to provider changes and propagate them
            if (provider.onDidChangeTreeData) {
                provider.onDidChangeTreeData(() => {
                    console.log(`MODULAR_TREE: Section ${sectionName} changed, refreshing tree`);
                    this.refresh();
                });
            }
            
            console.log(`MODULAR_TREE: Registered section provider: ${sectionName}`);
        });

        console.log(`MODULAR_TREE: Initialized ${providers.length} section providers`);
    }

    /**
     * Get tree item
     */
    getTreeItem(element: ModularTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children
     */
    async getChildren(element?: ModularTreeItem): Promise<ModularTreeItem[]> {
        if (!element) {
            // Root level - return section headers
            console.log('MODULAR_TREE: Loading root sections');
            return this.getRootSections();
        }

        // Get children from the appropriate section provider
        return this.getSectionChildren(element);
    }

    /**
     * Get root sections
     */
    private getRootSections(): ModularTreeItem[] {
        const sections: ModularTreeItem[] = [];

        // Create section headers from each provider
        this.sectionProviders.forEach((provider, sectionName) => {
            try {
                const sectionItem = provider.getSectionItem();
                
                // Convert to ModularTreeItem
                const modularItem = new ModularTreeItem(
                    typeof sectionItem.label === 'string' ? sectionItem.label : sectionItem.label?.label || sectionName.toUpperCase(),
                    sectionItem.collapsibleState || vscode.TreeItemCollapsibleState.Collapsed,
                    sectionName,
                    'section',
                    sectionItem.command,
                    sectionItem.iconPath,
                    sectionItem.tooltip,
                    sectionItem.description,
                    sectionItem.contextValue
                );

                sections.push(modularItem);
                
            } catch (error) {
                console.error(`MODULAR_TREE: Error creating section header for ${sectionName}:`, error);
                
                // Create error section
                sections.push(new ModularTreeItem(
                    `${sectionName.toUpperCase()} (Error)`,
                    vscode.TreeItemCollapsibleState.None,
                    sectionName,
                    'error',
                    undefined,
                    new vscode.ThemeIcon('error'),
                    `Error loading ${sectionName} section`
                ));
            }
        });

        console.log(`MODULAR_TREE: Created ${sections.length} root sections`);
        return sections;
    }

    /**
     * Get children for a specific section
     */
    private async getSectionChildren(element: ModularTreeItem): Promise<ModularTreeItem[]> {
        const sectionName = element.sectionType;
        const provider = this.sectionProviders.get(sectionName);

        if (!provider) {
            console.error(`MODULAR_TREE: No provider found for section: ${sectionName}`);
            return [];
        }

        try {
            console.log(`MODULAR_TREE: Getting children for section: ${sectionName}`);
            
            // Convert ModularTreeItem back to the section-specific item type
            let sectionElement: any = undefined;
            if (element.itemType !== 'section') {
                // Create a section-specific item with the preserved properties
                sectionElement = this.convertToSectionItem(element);
            }
            
            // Get children from the section provider
            const sectionChildren = await provider.getChildren(sectionElement);
            
            // Convert to ModularTreeItems
            const modularChildren = sectionChildren.map((child: any) => {
                // Preserve the original item properties for proper delegation
                const modularItem = new ModularTreeItem(
                    typeof child.label === 'string' ? child.label : child.label?.label || 'Unknown',
                    child.collapsibleState || vscode.TreeItemCollapsibleState.None,
                    sectionName,
                    child.serverItemType || child.activeServerItemType || child.babiaItemType || child.visualizeDataItemType || child.codeAnalysisItemType || child.newCodeAnalysisItemType || child.visualizationSettingsItemType || child.learnMoreItemType || child.type || 'item',
                    child.command,
                    child.iconPath,
                    child.tooltip,
                    child.description,
                    child.contextValue
                );
                
                // Copy over section-specific properties
                if (child.serverItemType) {
                    modularItem.serverItemType = child.serverItemType;
                }
                if (child.activeServerItemType) {
                    (modularItem as any).activeServerItemType = child.activeServerItemType;
                    (modularItem as any).activeServer = child.activeServer;
                }
                if (child.babiaItemType) {
                    (modularItem as any).babiaItemType = child.babiaItemType;
                    (modularItem as any).babiaExample = child.babiaExample;
                }
                if (child.visualizeDataItemType) {
                    (modularItem as any).visualizeDataItemType = child.visualizeDataItemType;
                    (modularItem as any).visualizeDataItem = child.visualizeDataItem;
                }
                if (child.codeAnalysisItemType) {
                    (modularItem as any).codeAnalysisItemType = child.codeAnalysisItemType;
                    (modularItem as any).originalCodeAnalysisItem = child.originalCodeAnalysisItem;
                }
                if (child.newCodeAnalysisItemType) {
                    (modularItem as any).newCodeAnalysisItemType = child.newCodeAnalysisItemType;
                    (modularItem as any).originalNewCodeAnalysisItem = child.originalNewCodeAnalysisItem;
                }
                if (child.visualizationSettingsItemType) {
                    (modularItem as any).visualizationSettingsItemType = child.visualizationSettingsItemType;
                    (modularItem as any).originalSettingsItem = child.originalSettingsItem;
                }
                if (child.learnMoreItemType) {
                    (modularItem as any).learnMoreItemType = child.learnMoreItemType;
                    (modularItem as any).originalLearnMoreItem = child.originalLearnMoreItem;
                }
                
                return modularItem;
            });

            console.log(`MODULAR_TREE: Retrieved ${modularChildren.length} children for section: ${sectionName}`);
            return modularChildren;

        } catch (error) {
            console.error(`MODULAR_TREE: Error getting children for section ${sectionName}:`, error);
            return [new ModularTreeItem(
                'Error loading items',
                vscode.TreeItemCollapsibleState.None,
                sectionName,
                'error',
                undefined,
                new vscode.ThemeIcon('error'),
                `Failed to load ${sectionName} items`
            )];
        }
    }

    /**
     * Convert ModularTreeItem back to section-specific item type
     */
    private convertToSectionItem(element: ModularTreeItem): any {
        const sectionName = element.sectionType;
        
        // Create section-specific items based on section type
        switch (sectionName) {
            case 'SERVERS':
                // Import and create ServerTreeItem
                const { ServerTreeItem } = require('./servers/items/serverItems');
                const serverItem = new ServerTreeItem(
                    typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown',
                    element.collapsibleState || vscode.TreeItemCollapsibleState.None,
                    element.serverItemType || 'config-option',
                    element.command,
                    element.iconPath,
                    element.tooltip,
                    element.description,
                    element.contextValue
                );
                return serverItem;
                
            case 'activeServers':
                // Import and create ActiveServerTreeItem
                const { ActiveServerTreeItem } = require('./active_servers/items/activeServerItems');
                const activeServerItem = new ActiveServerTreeItem(
                    typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown',
                    element.collapsibleState || vscode.TreeItemCollapsibleState.None,
                    (element as any).activeServerItemType || 'server-item',
                    element.command,
                    element.iconPath,
                    element.tooltip,
                    element.description,
                    element.contextValue,
                    (element as any).activeServer
                );
                return activeServerItem;
                
            case 'babiaExamples':
                // Import and create BabiaExampleTreeItem
                const { BabiaExampleTreeItem } = require('./babia_examples/items/babiaExampleItems');
                const babiaItem = new BabiaExampleTreeItem(
                    typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown',
                    element.collapsibleState || vscode.TreeItemCollapsibleState.None,
                    (element as any).babiaItemType || 'example-item',
                    element.command,
                    element.iconPath,
                    element.tooltip,
                    element.description,
                    element.contextValue,
                    (element as any).babiaExample
                );
                return babiaItem;
                
            case 'visualizeData':
                // Import and create VisualizeDataModularTreeItem
                const { VisualizeDataModularTreeItem } = require('./visualize_data/items/visualizeDataItems');
                const visualizeItem = new VisualizeDataModularTreeItem(
                    typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown',
                    element.collapsibleState || vscode.TreeItemCollapsibleState.None,
                    (element as any).visualizeDataItemType || 'error',
                    element.command,
                    element.iconPath,
                    element.tooltip,
                    element.description,
                    element.contextValue,
                    (element as any).visualizeDataItem
                );
                return visualizeItem;
                
            case 'newCodeAnalysis':
                // Import and create NewCodeAnalysisTreeItem
                const { NewCodeAnalysisTreeItem } = require('../new_code_analysis/views/items/newCodeAnalysisItems');
                const newCodeAnalysisItem = new NewCodeAnalysisTreeItem(
                    typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown',
                    element.collapsibleState || vscode.TreeItemCollapsibleState.None,
                    (element as any).type || 'item',
                    element.command,
                    element.iconPath,
                    element.tooltip,
                    element.description,
                    element.contextValue
                );
                return newCodeAnalysisItem;
                
            case 'visualizationSettings':
                // Import and create VisualizationSettingsModularTreeItem
                const { VisualizationSettingsModularTreeItem } = require('./visualization_settings/items/visualizationSettingsItems');
                const settingsItem = new VisualizationSettingsModularTreeItem(
                    typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown',
                    element.collapsibleState || vscode.TreeItemCollapsibleState.None,
                    (element as any).visualizationSettingsItemType || 'error',
                    element.command,
                    element.iconPath,
                    element.tooltip,
                    element.description,
                    element.contextValue,
                    (element as any).originalSettingsItem
                );
                return settingsItem;
                
            case 'learnMore':
                // Import and create LearnMoreModularTreeItem
                const { LearnMoreModularTreeItem } = require('./learn_more/items/learnMoreItems');
                const learnMoreItem = new LearnMoreModularTreeItem(
                    typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown',
                    element.collapsibleState || vscode.TreeItemCollapsibleState.None,
                    (element as any).learnMoreItemType || 'action',
                    element.command,
                    element.iconPath,
                    element.tooltip,
                    element.description,
                    element.contextValue
                );
                return learnMoreItem;
                
            default:
                // Return the element as-is for other sections
                return element;
        }
    }

    /**
     * Refresh the tree
     */
    refresh(): void {
        console.log('MODULAR_TREE: Refreshing modular tree - START');
        console.log('MODULAR_TREE: Firing _onDidChangeTreeData event');
        this._onDidChangeTreeData.fire();
        console.log('MODULAR_TREE: Refreshing modular tree - COMPLETE');
    }

    /**
     * Get section provider by name
     */
    getSectionProvider(sectionName: string): SectionProvider<any> | undefined {
        return this.sectionProviders.get(sectionName);
    }

    /**
     * Handle clicks on items
     */
    async handleItemClick(item: ModularTreeItem): Promise<void> {
        const sectionName = item.sectionType;
        const provider = this.sectionProviders.get(sectionName);

        if (provider && typeof (provider as any).handleClick === 'function') {
            console.log(`MODULAR_TREE: Delegating click to section provider: ${sectionName}`);
            
            // Convert back to section-specific item for proper handling
            const sectionItem = this.convertToSectionItem(item);
            await (provider as any).handleClick(sectionItem);
        } else {
            console.log(`MODULAR_TREE: No click handler for section: ${sectionName}`);
        }
    }

    /**
     * Handle context menu actions
     */
    async handleContextMenu(action: string, item: ModularTreeItem): Promise<void> {
        const sectionName = item.sectionType;
        const provider = this.sectionProviders.get(sectionName);

        if (provider && typeof (provider as any).handleContextMenu === 'function') {
            console.log(`MODULAR_TREE: Delegating context menu to section provider: ${sectionName}`);
            
            // Convert back to section-specific item for proper handling
            const sectionItem = this.convertToSectionItem(item);
            await (provider as any).handleContextMenu(action, sectionItem);
        } else {
            console.log(`MODULAR_TREE: No context menu handler for section: ${sectionName}`);
        }
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        console.log('MODULAR_TREE: Disposing modular tree data provider');
        
        // Dispose of all section providers
        for (const [sectionName, provider] of this.sectionProviders) {
            if ((provider as any).dispose) {
                console.log(`MODULAR_TREE: Disposing section provider: ${sectionName}`);
                (provider as any).dispose();
            }
        }
        
        this.sectionProviders.clear();
    }
}
