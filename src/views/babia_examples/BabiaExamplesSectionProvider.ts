import * as vscode from 'vscode';
import { BaseSectionProvider } from '../common/baseInterfaces';
import { BabiaExampleTreeItem, BabiaExampleItemFactory } from './items/babiaExampleItems';
import { BabiaExampleClickHandler } from './interactions/handleBabiaExampleClicks';
import { ExampleLauncher } from '../../babia_examples/runtime/exampleLauncher';

/**
 * Babia Examples section provider - manages example loading and launching
 */
export class BabiaExamplesSectionProvider extends BaseSectionProvider<BabiaExampleTreeItem> {
    private clickHandler: BabiaExampleClickHandler;
    private exampleLauncher: ExampleLauncher;

    constructor(context: vscode.ExtensionContext) {
        super(context);
        console.log('BABIA_EXAMPLES_MODULAR: Initializing Babia Examples section provider');
        this.clickHandler = new BabiaExampleClickHandler(context);
        this.exampleLauncher = new ExampleLauncher(context);
    }

    getSectionName(): string {
        return 'babiaExamples';
    }

    getSectionItem(): BabiaExampleTreeItem {
        return new BabiaExampleTreeItem(
            'BABIA EXAMPLES',
            vscode.TreeItemCollapsibleState.Collapsed,
            'no-examples',
            undefined,
            new vscode.ThemeIcon('library'),
            'Interactive visualization examples',
            undefined,
            'babiaExamplesSection'
        );
    }

    async getChildren(element?: BabiaExampleTreeItem): Promise<BabiaExampleTreeItem[]> {
        if (element) {
            return [];
        }

        console.log('BABIA_EXAMPLES_MODULAR: Loading Babia examples section children');

        try {
            const examples = await this.exampleLauncher.getExamples();

            // The credits row is always last, and stays reachable even when the
            // scan finds nothing or fails.
            const libraryInfo = BabiaExampleItemFactory.createLibraryInfoItem();

            if (examples.length === 0) {
                console.log('BABIA_EXAMPLES_MODULAR: No examples found');
                return [BabiaExampleItemFactory.createNoExamplesItem(), libraryInfo];
            }

            console.log(`BABIA_EXAMPLES_MODULAR: Found ${examples.length} examples`);
            const children = BabiaExampleItemFactory.createSortedExampleItems(examples);
            children.push(libraryInfo);
            console.log(`BABIA_EXAMPLES_MODULAR: Returning ${children.length} children for Babia Examples section`);
            return children;

        } catch (error) {
            console.error('BABIA_EXAMPLES_MODULAR: Error loading Babia examples:', error);
            return [
                BabiaExampleItemFactory.createErrorItem(),
                BabiaExampleItemFactory.createLibraryInfoItem(),
            ];
        }
    }

    async handleClick(item: BabiaExampleTreeItem): Promise<void> {
        await this.clickHandler.handleBabiaExampleClick(item);
    }

    async handleContextMenu(action: string, item: BabiaExampleTreeItem): Promise<void> {
        await this.clickHandler.handleContextMenuAction(action, item);
    }
}
