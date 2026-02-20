import * as vscode from 'vscode';
import { SectionProvider } from '../common/baseInterfaces';
import { BabiaExampleTreeItem, BabiaExampleItemFactory } from './items/babiaExampleItems';
import { BabiaExampleClickHandler } from './interactions/handleBabiaExampleClicks';
import { ExampleLauncher } from '../../babia_examples/runtime/exampleLauncher';

/**
 * Babia Examples section provider - manages example loading and launching
 */
export class BabiaExamplesSectionProvider implements SectionProvider<BabiaExampleTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BabiaExampleTreeItem | undefined | null | void> = 
        new vscode.EventEmitter<BabiaExampleTreeItem | undefined | null | void>();
    
    readonly onDidChangeTreeData: vscode.Event<BabiaExampleTreeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private clickHandler: BabiaExampleClickHandler;
    private exampleLauncher: ExampleLauncher;

    constructor(private context: vscode.ExtensionContext) {
        console.log('BABIA_EXAMPLES_MODULAR: Initializing Babia Examples section provider');
        this.clickHandler = new BabiaExampleClickHandler(context);
        this.exampleLauncher = new ExampleLauncher(context);
    }

    /**
     * Get the section name for identification
     */
    getSectionName(): string {
        return 'babiaExamples';
    }

    /**
     * Get the section header item
     */
    getSectionItem(): BabiaExampleTreeItem {
        return new BabiaExampleTreeItem(
            'BABIA EXAMPLES',
            vscode.TreeItemCollapsibleState.Collapsed,
            'no-examples', // Using this as section header type
            undefined,
            new vscode.ThemeIcon('library'),
            'Interactive visualization examples',
            undefined,
            'babiaExamplesSection'
        );
    }

    /**
     * Get children items for the Babia Examples section
     */
    async getChildren(element?: BabiaExampleTreeItem): Promise<BabiaExampleTreeItem[]> {
        // If element is provided, it means we're getting children for a specific item
        // For the Babia Examples section, we only have flat items, so return empty for sub-items
        if (element) {
            return [];
        }

        console.log('BABIA_EXAMPLES_MODULAR: Loading Babia examples section children');

        try {
            const examples = await this.exampleLauncher.getExamples();
            
            if (examples.length === 0) {
                console.log('BABIA_EXAMPLES_MODULAR: No examples found');
                return [BabiaExampleItemFactory.createNoExamplesItem()];
            }

            console.log(`BABIA_EXAMPLES_MODULAR: Found ${examples.length} examples`);
            
            // Create sorted example items
            const children = BabiaExampleItemFactory.createSortedExampleItems(examples);
            
            console.log(`BABIA_EXAMPLES_MODULAR: Returning ${children.length} children for Babia Examples section`);
            return children;

        } catch (error) {
            console.error('BABIA_EXAMPLES_MODULAR: Error loading Babia examples:', error);
            return [BabiaExampleItemFactory.createErrorItem()];
        }
    }

    /**
     * Refresh the section
     */
    refresh(): void {
        console.log('BABIA_EXAMPLES_MODULAR: Refreshing Babia Examples section');
        this._onDidChangeTreeData.fire();
    }

    /**
     * Handle item clicks (additional method for interaction)
     */
    async handleClick(item: BabiaExampleTreeItem): Promise<void> {
        await this.clickHandler.handleBabiaExampleClick(item);
    }

    /**
     * Handle context menu actions (additional method for interaction)
     */
    async handleContextMenu(action: string, item: BabiaExampleTreeItem): Promise<void> {
        await this.clickHandler.handleContextMenuAction(action, item);
    }
}
