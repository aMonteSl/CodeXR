import * as vscode from 'vscode';
import { BabiaExample } from '../../../babia_examples/model/babiaExampleModel';
import { ExampleIcons } from '../../../babia_examples/views/items/exampleItems';

/**
 * Babia Example tree items for the Babia Examples section
 */
export class BabiaExampleTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly babiaItemType: 'example-item' | 'no-examples' | 'loading' | 'error',
        command?: vscode.Command,
        iconPath?: vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri },
        tooltip?: string,
        description?: string,
        contextValue?: string,
        public readonly babiaExample?: BabiaExample
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
 * Factory for creating Babia example-related tree items
 */
export class BabiaExampleItemFactory {
    /**
     * Create "No examples found" message item
     */
    static createNoExamplesItem(): BabiaExampleTreeItem {
        console.log('BABIA_EXAMPLES: Creating "No examples found" message item');
        
        return new BabiaExampleTreeItem(
            'No examples found',
            vscode.TreeItemCollapsibleState.None,
            'no-examples',
            undefined,
            new vscode.ThemeIcon('warning'),
            'No Babia examples are available'
        );
    }
    
    /**
     * Create "Error loading examples" message item
     */
    static createErrorItem(): BabiaExampleTreeItem {
        console.log('BABIA_EXAMPLES: Creating error loading examples item');
        
        return new BabiaExampleTreeItem(
            'Error loading examples',
            vscode.TreeItemCollapsibleState.None,
            'error',
            undefined,
            new vscode.ThemeIcon('error'),
            'Failed to load Babia examples'
        );
    }
    
    /**
     * Create individual Babia example item
     */
    static createExampleItem(example: BabiaExample): BabiaExampleTreeItem {
        console.log(`BABIA_EXAMPLES: Creating example item: ${example.name} (${example.category})`);
        
        const icon = BabiaExampleItemFactory.getExampleIcon(example);
        const statusSuffix = example.isValid ? '' : ' (Invalid)';
        const label = `${example.name}${statusSuffix}`;
        
        // Create command to launch example (only if valid)
        const command = example.isValid ? {
            command: 'codeXR.babiaExamples.launchExample',
            title: 'Launch Example',
            arguments: [example]
        } : undefined;
        
        const tooltip = example.isValid ? 
            `${example.category} example - Click to launch` : 
            `${example.category} example - Invalid configuration`;
        
        return new BabiaExampleTreeItem(
            label,
            vscode.TreeItemCollapsibleState.None,
            'example-item',
            command,
            icon,
            tooltip,
            example.category,
            'babia-example',
            example
        );
    }
    
    /**
     * Get the appropriate icon for a Babia example
     */
    private static getExampleIcon(example: BabiaExample): vscode.ThemeIcon {
        // Use the existing ExampleIcons mapping
        return ExampleIcons.getExampleIcon(example.category);
    }
    
    /**
     * Create sorted example items from a list of examples
     */
    static createSortedExampleItems(examples: BabiaExample[]): BabiaExampleTreeItem[] {
        console.log(`BABIA_EXAMPLES: Creating sorted tree items for ${examples.length} examples`);
        
        // Sort examples by category and name
        const sortedExamples = examples.sort((a, b) => {
            if (a.category !== b.category) {
                return a.category.localeCompare(b.category);
            }
            return a.name.localeCompare(b.name);
        });

        return sortedExamples.map(example => 
            BabiaExampleItemFactory.createExampleItem(example)
        );
    }
}
