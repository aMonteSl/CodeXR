/**
 * Learn More Section Provider
 * Manages the Learn More section for CodeXR tutorials and documentation
 */

import * as vscode from 'vscode';
import { SectionProvider } from '../common/baseInterfaces';
import { LearnMoreModularTreeItem, LearnMoreModularItemFactory } from './items/learnMoreItems';
import { LearnMoreClickHandler } from './interactions/handleLearnMoreClicks';

/**
 * Learn More section provider - provides access to CodeXR learning resources
 */
export class LearnMoreSectionProvider implements SectionProvider<LearnMoreModularTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<LearnMoreModularTreeItem | undefined | null | void> = 
        new vscode.EventEmitter<LearnMoreModularTreeItem | undefined | null | void>();
    
    readonly onDidChangeTreeData: vscode.Event<LearnMoreModularTreeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private clickHandler: LearnMoreClickHandler;

    constructor(private context: vscode.ExtensionContext) {
        console.log('LEARN_MORE: Initializing Learn More section provider');
        this.clickHandler = new LearnMoreClickHandler(context);
    }

    /**
     * Get the section name for identification
     */
    getSectionName(): string {
        return 'learnMore';
    }

    /**
     * Get the section header item
     */
    getSectionItem(): LearnMoreModularTreeItem {
        return new LearnMoreModularTreeItem(
            'LEARN MORE',
            vscode.TreeItemCollapsibleState.Collapsed,
            'section', // Section header type
            undefined,
            new vscode.ThemeIcon('info', new vscode.ThemeColor('charts.foreground')),
            'Discover CodeXR features with tutorials and examples',
            'Tutorials, examples & videos',
            'learnMoreSection'
        );
    }

    /**
     * Get children items for the Learn More section
     */
    async getChildren(element?: LearnMoreModularTreeItem): Promise<LearnMoreModularTreeItem[]> {
        if (!element) {
            // Root level - return main learn more items
            console.log('LEARN_MORE: Loading learn more section children');
            return LearnMoreModularItemFactory.createLearnMoreItems(this.context);
        }

        // No nested children for now
        return [];
    }

    /**
     * Get tree item representation
     */
    getTreeItem(element: LearnMoreModularTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Refresh the Learn More section
     */
    refresh(): void {
        console.log('LEARN_MORE: Refreshing Learn More section');
        this._onDidChangeTreeData.fire();
    }

    /**
     * Handle item selection/click events
     */
    handleItemClick(item: LearnMoreModularTreeItem): void {
        console.log('LEARN_MORE: Item clicked:', item.label);
        this.clickHandler.handleClick(item);
    }
}
