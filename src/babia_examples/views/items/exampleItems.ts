import * as vscode from 'vscode';
import { BabiaExample } from '../../model/babiaExampleModel';

/**
 * Tree item types for Babia examples
 */
export type BabiaExampleTreeItemType = 'examplesSection' | 'example' | 'noExamples' | 'loading';

/**
 * Tree item for Babia examples display
 */
export class BabiaExampleTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: BabiaExampleTreeItemType,
        public readonly command?: vscode.Command,
        public readonly iconPath?: vscode.ThemeIcon | string,
        public readonly tooltip?: string,
        public readonly description?: string,
        public readonly contextValue?: string,
        public readonly example?: BabiaExample
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
 * Example item factory for creating tree items
 */
export class ExampleItemFactory {
    /**
     * Create tree item for a Babia example
     */
    public static createExampleItem(example: BabiaExample): BabiaExampleTreeItem {
        const command: vscode.Command = {
            command: 'codeXR.babiaExamples.launchExample',
            title: 'Launch Example',
            arguments: [example]
        };

        const icon = ExampleIcons.getExampleIcon(example.category);
        const tooltip = ExampleItemFactory.createTooltip(example);
        const description = example.isValid ? undefined : '(Invalid)';

        return new BabiaExampleTreeItem(
            example.name,
            vscode.TreeItemCollapsibleState.None,
            'example',
            command,
            icon,
            tooltip,
            description,
            example.isValid ? 'validExample' : 'invalidExample',
            example
        );
    }

    /**
     * Create "No examples found" item
     */
    public static createNoExamplesItem(): BabiaExampleTreeItem {
        return new BabiaExampleTreeItem(
            'No examples found',
            vscode.TreeItemCollapsibleState.None,
            'noExamples',
            undefined,
            new vscode.ThemeIcon('info'),
            'No Babia examples were found in examples/charts/',
            undefined,
            'noExamples'
        );
    }

    /**
     * Create loading item
     */
    public static createLoadingItem(): BabiaExampleTreeItem {
        return new BabiaExampleTreeItem(
            'Loading examples...',
            vscode.TreeItemCollapsibleState.None,
            'loading',
            undefined,
            new vscode.ThemeIcon('loading~spin'),
            'Scanning for Babia examples',
            undefined,
            'loading'
        );
    }

    /**
     * Create tooltip for example
     * @private
     */
    private static createTooltip(example: BabiaExample): string {
        const lines = [
            `Example: ${example.name}`,
            `Category: ${example.category}`,
            `File: ${example.htmlFilePath}`
        ];

        if (example.description) {
            lines.push(`Description: ${example.description}`);
        }

        if (!example.isValid) {
            lines.push('Warning: This example has issues and may not work properly');
        } else {
            lines.push('Click to launch this example');
        }

        return lines.join('\\n');
    }
}

/**
 * Example icons utility
 */
export class ExampleIcons {
    /**
     * Get appropriate icon for example category
     */
    public static getExampleIcon(category: string): vscode.ThemeIcon {
        switch (category.toLowerCase()) {
            case 'pie':
                return new vscode.ThemeIcon('pie-chart');
            case 'bar-chart':
            case 'barsmap':
                return new vscode.ThemeIcon('graph');
            case 'bubble-chart':
                return new vscode.ThemeIcon('circle-large-outline');
            case 'cylinder-chart':
            case 'cylindermap-chart':
                return new vscode.ThemeIcon('package');
            case 'mix':
                return new vscode.ThemeIcon('combine');
            default:
                return new vscode.ThemeIcon('file-code');
        }
    }

    /**
     * Get section icon
     */
    public static getSectionIcon(): vscode.ThemeIcon {
        return new vscode.ThemeIcon('library');
    }
}
