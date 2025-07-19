import * as vscode from 'vscode';
import { BabiaExampleTreeItem } from '../items/babiaExampleItems';
import { ExampleLauncher } from '../../../babia_examples/runtime/exampleLauncher';

/**
 * Handler for Babia Examples section interactions
 */
export class BabiaExampleClickHandler {
    private exampleLauncher: ExampleLauncher;

    constructor(private context: vscode.ExtensionContext) {
        this.exampleLauncher = new ExampleLauncher(context);
    }

    /**
     * Handle clicks on Babia example items
     */
    async handleBabiaExampleClick(item: BabiaExampleTreeItem): Promise<void> {
        console.log(`BABIA_EXAMPLES_MODULAR: Handling click on example item: ${item.label} (type: ${item.babiaItemType})`);

        switch (item.babiaItemType) {
            case 'example-item':
                await this.handleExampleItemClick(item);
                break;
                
            case 'no-examples':
            case 'loading':
            case 'error':
                // No action needed for informational items
                console.log(`BABIA_EXAMPLES_MODULAR: Clicked on informational item: ${item.babiaItemType}`);
                break;
                
            default:
                console.warn(`BABIA_EXAMPLES_MODULAR: Unknown example item type: ${item.babiaItemType}`);
        }
    }

    /**
     * Handle click on individual example item
     */
    private async handleExampleItemClick(item: BabiaExampleTreeItem): Promise<void> {
        if (!item.babiaExample) {
            console.error('BABIA_EXAMPLES_MODULAR: No example data in example item');
            return;
        }

        if (!item.babiaExample.isValid) {
            console.warn('BABIA_EXAMPLES_MODULAR: Attempted to launch invalid example');
            vscode.window.showWarningMessage(`Example "${item.babiaExample.name}" is invalid and cannot be launched.`);
            return;
        }

        console.log(`BABIA_EXAMPLES_MODULAR: Launching example: ${item.babiaExample.id}`);
        
        try {
            // Use the example launcher to handle the launch
            await this.exampleLauncher.launchExample(item.babiaExample);
            
            vscode.window.showInformationMessage(`Example "${item.babiaExample.name}" launched successfully!`);
            
        } catch (error) {
            console.error(`BABIA_EXAMPLES_MODULAR: Error launching example ${item.babiaExample.id}:`, error);
            vscode.window.showErrorMessage(`Failed to launch example "${item.babiaExample.name}": ${error}`);
        }
    }

    /**
     * Handle right-click context menu actions
     */
    async handleContextMenuAction(action: string, item: BabiaExampleTreeItem): Promise<void> {
        console.log(`BABIA_EXAMPLES_MODULAR: Handling context menu action: ${action} on item: ${item.label}`);

        switch (action) {
            case 'refresh':
                console.log('BABIA_EXAMPLES_MODULAR: Refreshing examples view');
                // Refresh will be triggered by the provider
                break;
                
            case 'launchExample':
                if (item.babiaExample && item.babiaExample.isValid) {
                    console.log(`BABIA_EXAMPLES_MODULAR: Launching example from context menu: ${item.babiaExample.id}`);
                    await this.handleExampleItemClick(item);
                }
                break;
                
            case 'openInBrowser':
                if (item.babiaExample && item.babiaExample.isValid) {
                    console.log(`BABIA_EXAMPLES_MODULAR: Opening example in browser: ${item.babiaExample.id}`);
                    await this.launchExampleInBrowser(item.babiaExample);
                }
                break;
                
            case 'openInPanel':
                if (item.babiaExample && item.babiaExample.isValid) {
                    console.log(`BABIA_EXAMPLES_MODULAR: Opening example in panel: ${item.babiaExample.id}`);
                    await this.launchExampleInPanel(item.babiaExample);
                }
                break;
                
            case 'showDetails':
                if (item.babiaExample) {
                    console.log(`BABIA_EXAMPLES_MODULAR: Showing example details: ${item.babiaExample.id}`);
                    await this.showExampleDetails(item.babiaExample);
                }
                break;
                
            default:
                console.warn(`BABIA_EXAMPLES_MODULAR: Unknown context menu action: ${action}`);
        }
    }

    /**
     * Launch example specifically in browser
     */
    private async launchExampleInBrowser(example: any): Promise<void> {
        try {
            // For now, use the default launcher - future enhancement could support launch mode selection
            await this.exampleLauncher.launchExample(example);
            vscode.window.showInformationMessage(`Example "${example.name}" launched! (Uses current user configuration for launch mode)`);
        } catch (error) {
            console.error(`BABIA_EXAMPLES_MODULAR: Error launching example:`, error);
            vscode.window.showErrorMessage(`Failed to launch example: ${error}`);
        }
    }

    /**
     * Launch example specifically in panel
     */
    private async launchExampleInPanel(example: any): Promise<void> {
        try {
            // For now, use the default launcher - future enhancement could support launch mode selection
            await this.exampleLauncher.launchExample(example);
            vscode.window.showInformationMessage(`Example "${example.name}" launched! (Uses current user configuration for launch mode)`);
        } catch (error) {
            console.error(`BABIA_EXAMPLES_MODULAR: Error launching example:`, error);
            vscode.window.showErrorMessage(`Failed to launch example: ${error}`);
        }
    }

    /**
     * Show detailed information about an example
     */
    private async showExampleDetails(example: any): Promise<void> {
        const details = `Example Details:
        
Name: ${example.name}
Category: ${example.category}
File: ${example.htmlFilePath}
Directory: ${example.directory}
Valid: ${example.isValid ? 'Yes' : 'No'}
${example.description ? `Description: ${example.description}` : ''}`;

        vscode.window.showInformationMessage(details, { modal: true });
    }
}
