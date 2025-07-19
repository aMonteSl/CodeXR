import * as vscode from 'vscode';
import { CodeAnalysisTreeItem, CodeAnalysisItemFactory } from '../../../code_analysis/views/items/analysisTreeItems';
import { FilesByLanguage } from '../../../code_analysis/utils/fileScanner';

/**
 * Code Analysis tree items for the Code Analysis section
 */
export class CodeAnalysisModularTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly codeAnalysisItemType: 'section' | 'subsection' | 'language-group' | 'file-item' | 'error' | 'scanning',
        command?: vscode.Command,
        iconPath?: vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri },
        tooltip?: string,
        description?: string,
        contextValue?: string,
        public readonly originalCodeAnalysisItem?: CodeAnalysisTreeItem
    ) {
        super(label, collapsibleState);
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip || label;
        this.description = description;
        this.contextValue = contextValue;
    }
}

/**
 * Factory for creating Code Analysis-related tree items
 */
export class CodeAnalysisModularItemFactory {
    /**
     * Create "Error loading code analysis" message item
     */
    static createErrorItem(): CodeAnalysisModularTreeItem {
        console.log('CODE_ANALYSIS_MODULAR: Creating error loading code analysis item');
        
        return new CodeAnalysisModularTreeItem(
            'Error loading code analysis',
            vscode.TreeItemCollapsibleState.None,
            'error',
            undefined,
            new vscode.ThemeIcon('error'),
            'Failed to load code analysis items'
        );
    }
    
    /**
     * Create "Scanning files..." message item
     */
    static createScanningItem(): CodeAnalysisModularTreeItem {
        console.log('CODE_ANALYSIS_MODULAR: Creating scanning files item');
        
        return new CodeAnalysisModularTreeItem(
            'Scanning files...',
            vscode.TreeItemCollapsibleState.None,
            'scanning',
            undefined,
            new vscode.ThemeIcon('loading~spin'),
            'Scanning workspace files for analysis'
        );
    }
    
    /**
     * Create main code analysis section items
     */
    static createCodeAnalysisSections(filesByLanguage: FilesByLanguage | null, isScanning: boolean, context: vscode.ExtensionContext): CodeAnalysisModularTreeItem[] {
        console.log('CODE_ANALYSIS_MODULAR: Creating code analysis section items');
        
        if (isScanning) {
            return [CodeAnalysisModularItemFactory.createScanningItem()];
        }

        try {
            // Use the existing factory to get the sections with counts
            const analysisItems = CodeAnalysisItemFactory.createCodeAnalysisSectionsWithCounts(filesByLanguage || undefined, isScanning);
            
            const children = analysisItems.map((item: CodeAnalysisTreeItem) => {
                // Handle iconPath type conversion
                const iconPath = typeof item.iconPath === 'string' 
                    ? new vscode.ThemeIcon(item.iconPath as string)
                    : item.iconPath as (vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | undefined);
                
                // Handle tooltip type conversion
                const tooltip = typeof item.tooltip === 'string' 
                    ? item.tooltip 
                    : item.tooltip?.value || undefined;
                
                // Handle description type conversion
                const description = typeof item.description === 'string' 
                    ? item.description 
                    : undefined;
                
                // Determine collapsible state and item type
                let itemType: 'section' | 'subsection' | 'language-group' | 'file-item' | 'error' | 'scanning' = 'subsection';
                if (item.type === 'language-group') {
                    itemType = 'language-group';
                } else if (item.type === 'file-item') {
                    itemType = 'file-item';
                }
                
                return new CodeAnalysisModularTreeItem(
                    typeof item.label === 'string' ? item.label : item.label?.label || 'Unknown',
                    item.collapsibleState || vscode.TreeItemCollapsibleState.None,
                    itemType,
                    item.command,
                    iconPath,
                    tooltip,
                    description,
                    item.contextValue,
                    item
                );
            });

            console.log(`CODE_ANALYSIS_MODULAR: Created ${children.length} code analysis section items`);
            return children;

        } catch (error) {
            console.error('CODE_ANALYSIS_MODULAR: Error creating code analysis sections:', error);
            return [CodeAnalysisModularItemFactory.createErrorItem()];
        }
    }
    
    /**
     * Create sub-items for a code analysis item (delegate to original provider)
     */
    static async createCodeAnalysisSubItems(item: CodeAnalysisTreeItem, codeAnalysisProvider: any): Promise<CodeAnalysisModularTreeItem[]> {
        console.log(`CODE_ANALYSIS_MODULAR: Creating sub-items for: ${item.label}`);
        
        try {
            // Delegate to the original code analysis provider
            const subItems = await codeAnalysisProvider.getChildren(item);
            
            const children = subItems.map((subItem: any) => {
                // Handle iconPath type conversion
                const iconPath = typeof subItem.iconPath === 'string' 
                    ? new vscode.ThemeIcon(subItem.iconPath as string)
                    : subItem.iconPath as (vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | undefined);
                
                // Handle tooltip type conversion
                const tooltip = typeof subItem.tooltip === 'string' 
                    ? subItem.tooltip 
                    : subItem.tooltip?.value || undefined;
                
                // Handle description type conversion
                const description = typeof subItem.description === 'string' 
                    ? subItem.description 
                    : undefined;
                
                // Determine item type
                let itemType: 'section' | 'subsection' | 'language-group' | 'file-item' | 'error' | 'scanning' = 'subsection';
                if (subItem.type === 'language-group') {
                    itemType = 'language-group';
                } else if (subItem.type === 'file-item') {
                    itemType = 'file-item';
                }
                
                return new CodeAnalysisModularTreeItem(
                    typeof subItem.label === 'string' ? subItem.label : subItem.label?.label || 'Unknown',
                    subItem.collapsibleState || vscode.TreeItemCollapsibleState.None,
                    itemType,
                    subItem.command,
                    iconPath,
                    tooltip,
                    description,
                    subItem.contextValue,
                    subItem
                );
            });

            console.log(`CODE_ANALYSIS_MODULAR: Created ${children.length} sub-items`);
            return children;

        } catch (error) {
            console.error('CODE_ANALYSIS_MODULAR: Error creating sub-items:', error);
            return [new CodeAnalysisModularTreeItem(
                'Error loading sub-items',
                vscode.TreeItemCollapsibleState.None,
                'error',
                undefined,
                new vscode.ThemeIcon('error'),
                'Failed to load code analysis sub-items'
            )];
        }
    }
}
