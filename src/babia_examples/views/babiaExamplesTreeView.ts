import * as vscode from 'vscode';
import { BabiaExample } from '../model/babiaExampleModel';
import { ExampleLauncher } from '../runtime/exampleLauncher';
import { BabiaExampleTreeItem, ExampleItemFactory, ExampleIcons } from './items/exampleItems';

/**
 * Babia Examples Tree Data Provider
 * Provides the tree view for Babia visualization examples
 */
export class BabiaExamplesTreeDataProvider implements vscode.TreeDataProvider<BabiaExampleTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BabiaExampleTreeItem | undefined | null | void> = new vscode.EventEmitter<BabiaExampleTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<BabiaExampleTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private exampleLauncher: ExampleLauncher;
    private isLoading: boolean = false;

    constructor(private context: vscode.ExtensionContext) {
        this.exampleLauncher = new ExampleLauncher(context);
        console.log('EXAMPLES_UI: Babia examples tree data provider initialized for direct example display');
    }

    /**
     * Refresh the tree view
     */
    public refresh(): void {
        console.log('EXAMPLES_UI: Refreshing tree view');
        this._onDidChangeTreeData.fire();
    }

    /**
     * Get tree item representation
     */
    getTreeItem(element: BabiaExampleTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children for the tree view
     */
    async getChildren(element?: BabiaExampleTreeItem): Promise<BabiaExampleTreeItem[]> {
        if (!element) {
            // Root level - return examples directly (no nested container)
            console.log('EXAMPLES_UI: Loading examples directly at root level for clean UI');
            return this.getExampleItems();
        }

        // No nested items for now
        return [];
    }

    /**
     * Get example items
     * @private
     */
    private async getExampleItems(): Promise<BabiaExampleTreeItem[]> {
        console.log('EXAMPLES_UI: Loading example items directly in tree view...');

        if (this.isLoading) {
            return [ExampleItemFactory.createLoadingItem()];
        }

        try {
            this.isLoading = true;
            
            const examples = await this.exampleLauncher.getExamples();
            
            if (examples.length === 0) {
                console.log('EXAMPLES_UI: No examples found for direct display');
                return [ExampleItemFactory.createNoExamplesItem()];
            }

            // Sort examples by category and name
            const sortedExamples = examples.sort((a, b) => {
                if (a.category !== b.category) {
                    return a.category.localeCompare(b.category);
                }
                return a.name.localeCompare(b.name);
            });

            console.log(`EXAMPLES_UI: Creating tree items for ${sortedExamples.length} examples for direct display`);

            const items = sortedExamples.map(example => 
                ExampleItemFactory.createExampleItem(example)
            );

            // Add valid count to console
            const validCount = examples.filter(ex => ex.isValid).length;
            const invalidCount = examples.length - validCount;
            console.log(`EXAMPLES_UI: Loaded ${validCount} valid and ${invalidCount} invalid examples for direct display`);

            return items;

        } catch (error) {
            console.error('EXAMPLES_UI: Error loading examples for direct display:', error);
            
            // Return error item
            return [
                new BabiaExampleTreeItem(
                    'Error loading examples',
                    vscode.TreeItemCollapsibleState.None,
                    'noExamples',
                    {
                        command: 'codeXR.babiaExamples.refresh',
                        title: 'Retry'
                    },
                    new vscode.ThemeIcon('error'),
                    `Error: ${error instanceof Error ? error.message : String(error)}. Click to retry.`,
                    undefined,
                    'error'
                )
            ];
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Force rescan of examples
     */
    public async rescan(): Promise<void> {
        console.log('EXAMPLES_UI: Force rescanning examples for direct display...');
        this.isLoading = true;
        this.refresh(); // Show loading state
        
        try {
            await this.exampleLauncher.scanExamples();
        } finally {
            this.isLoading = false;
            this.refresh(); // Show results
        }
    }

    /**
     * Get example launcher instance
     */
    public getExampleLauncher(): ExampleLauncher {
        return this.exampleLauncher;
    }

    /**
     * Cleanup method
     */
    public async cleanup(): Promise<void> {
        console.log('EXAMPLES_UI: Cleaning up tree data provider...');
        await this.exampleLauncher.cleanup();
    }
}
