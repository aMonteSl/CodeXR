/**
 * Learn More Items
 * Tree view items for the Learn More section
 */

import * as vscode from 'vscode';

/**
 * Base class for Learn More modular tree items
 */
export class LearnMoreModularTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly learnMoreItemType: string,
        public readonly command?: vscode.Command,
        public readonly iconPath?: vscode.ThemeIcon | vscode.Uri,
        public readonly tooltip?: string,
        public readonly description?: string,
        public readonly contextValue?: string
    ) {
        super(label, collapsibleState);
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip;
        this.description = description;
        this.contextValue = contextValue;
    }
}

/**
 * Factory for creating Learn More tree items
 */
export class LearnMoreModularItemFactory {
    
    /**
     * Create learn more section items
     */
    static createLearnMoreItems(context: vscode.ExtensionContext): LearnMoreModularTreeItem[] {
        console.log('LEARN_MORE: Creating learn more items');
        
        const items: LearnMoreModularTreeItem[] = [];
        
        // Main "Learn More" action item
        const learnMoreItem = new LearnMoreModularTreeItem(
            'Discover CodeXR Features',
            vscode.TreeItemCollapsibleState.None,
            'action',
            {
                command: 'codeXR.learnMore',
                title: 'Learn More',
                arguments: []
            },
            new vscode.ThemeIcon('play-circle', new vscode.ThemeColor('charts.foreground')),
            'Click to explore CodeXR tutorials and examples',
            'Interactive guides & videos',
            'learnMoreAction'
        );
        
        items.push(learnMoreItem);
        
        return items;
    }
}
