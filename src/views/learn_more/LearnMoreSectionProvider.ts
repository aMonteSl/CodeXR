/**
 * Learn More Section Provider
 * Manages the Learn More section for CodeXR tutorials and documentation
 */

import * as vscode from 'vscode';
import { BaseSectionProvider } from '../common/baseInterfaces';
import { LearnMoreModularTreeItem, LearnMoreModularItemFactory } from './items/learnMoreItems';
import { LearnMoreClickHandler } from './interactions/handleLearnMoreClicks';

/**
 * Learn More section provider - provides access to CodeXR learning resources
 */
export class LearnMoreSectionProvider extends BaseSectionProvider<LearnMoreModularTreeItem> {
    private clickHandler: LearnMoreClickHandler;

    constructor(context: vscode.ExtensionContext) {
        super(context);
        console.log('LEARN_MORE: Initializing Learn More section provider');
        this.clickHandler = new LearnMoreClickHandler(context);
    }

    getSectionName(): string {
        return 'learnMore';
    }

    getSectionItem(): LearnMoreModularTreeItem {
        return new LearnMoreModularTreeItem(
            'LEARN MORE',
            vscode.TreeItemCollapsibleState.Collapsed,
            'section',
            undefined,
            new vscode.ThemeIcon('book', new vscode.ThemeColor('charts.foreground')),
            'Access CodeXR documentation, tutorials, and examples',
            'Official docs & tutorials',
            'learnMoreSection'
        );
    }

    async getChildren(element?: LearnMoreModularTreeItem): Promise<LearnMoreModularTreeItem[]> {
        if (!element) {
            console.log('LEARN_MORE: Loading learn more section children');
            return LearnMoreModularItemFactory.createLearnMoreItems(this.context);
        }
        return [];
    }

    handleItemClick(item: LearnMoreModularTreeItem): void {
        console.log('LEARN_MORE: Item clicked:', item.label);
        this.clickHandler.handleClick(item);
    }
}
