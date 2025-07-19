import * as vscode from 'vscode';
import { BabiaExample } from '../../model/babiaExampleModel';
import { ExampleLauncher } from '../../runtime/exampleLauncher';

/**
 * Handle Example Clicks
 * Manages user interactions with Babia examples in the tree view
 */
export class ExampleClickHandler {
    private exampleLauncher: ExampleLauncher;

    constructor(context: vscode.ExtensionContext) {
        this.exampleLauncher = new ExampleLauncher(context);
        console.log('EXAMPLES: Example click handler initialized');
    }

    /**
     * Handle click on an example to launch it
     * @param example The example to launch
     */
    public async handleExampleClick(example: BabiaExample): Promise<void> {
        console.log(`EXAMPLES: User clicked on example "${example.name}"`);

        try {
            if (!example.isValid) {
                await this.handleInvalidExample(example);
                return;
            }

            // Show launching message
            const launchingMessage = vscode.window.setStatusBarMessage(
                `$(loading~spin) Launching Babia example "${example.name}"...`
            );

            try {
                const result = await this.exampleLauncher.launchExample(example);
                
                if (result.success) {
                    console.log(`EXAMPLES: Successfully launched "${example.name}" on port ${result.port}`);
                } else {
                    console.error(`EXAMPLES: Failed to launch "${example.name}":`, result.error);
                }
            } finally {
                launchingMessage.dispose();
            }

        } catch (error) {
            const errorMsg = `Failed to handle example click: ${error instanceof Error ? error.message : String(error)}`;
            console.error('EXAMPLES:', errorMsg);
            vscode.window.showErrorMessage(errorMsg);
        }
    }

    /**
     * Handle click on invalid example
     * @private
     */
    private async handleInvalidExample(example: BabiaExample): Promise<void> {
        console.log(`EXAMPLES: User clicked on invalid example "${example.name}"`);

        const action = await vscode.window.showWarningMessage(
            `Example "${example.name}" is not valid and cannot be launched.`,
            'Show Details',
            'Rescan Examples'
        );

        switch (action) {
            case 'Show Details':
                await this.showExampleDetails(example);
                break;
            case 'Rescan Examples':
                await this.rescanExamples();
                break;
        }
    }

    /**
     * Show example details
     * @private
     */
    private async showExampleDetails(example: BabiaExample): Promise<void> {
        const details = [
            `Example: ${example.name}`,
            `Category: ${example.category}`,
            `Directory: ${example.directory}`,
            `HTML File: ${example.htmlFilePath || 'Not found'}`,
            `Valid: ${example.isValid ? 'Yes' : 'No'}`,
            ''
        ];

        if (example.description) {
            details.push(`Description: ${example.description}`);
        }

        if (!example.isValid) {
            details.push('Issues:');
            details.push('- No valid HTML file found in the example directory');
        }

        const content = details.join('\\n');

        // Create and show a new untitled document with the details
        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'plaintext'
        });

        await vscode.window.showTextDocument(doc);
    }

    /**
     * Rescan examples
     * @private
     */
    private async rescanExamples(): Promise<void> {
        console.log('EXAMPLES: User requested example rescan');
        
        const scanning = vscode.window.setStatusBarMessage('$(loading~spin) Scanning Babia examples...');
        
        try {
            const result = await this.exampleLauncher.scanExamples();
            
            console.log(`EXAMPLES: Rescan complete. Found ${result.validCount} valid, ${result.invalidCount} invalid examples`);
            
            // Refresh the tree view
            vscode.commands.executeCommand('codeXR.babiaExamples.refresh');
            
            // Show result message
            if (result.errors.length > 0) {
                vscode.window.showWarningMessage(
                    `Rescan complete: ${result.validCount} valid, ${result.invalidCount} invalid examples. ${result.errors.length} errors occurred.`
                );
            } else {
                vscode.window.showInformationMessage(
                    `Rescan complete: Found ${result.validCount} valid and ${result.invalidCount} invalid examples.`
                );
            }
            
        } catch (error) {
            console.error('EXAMPLES: Error during rescan:', error);
            vscode.window.showErrorMessage(`Failed to rescan examples: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            scanning.dispose();
        }
    }

    /**
     * Get the example launcher instance
     */
    public getExampleLauncher(): ExampleLauncher {
        return this.exampleLauncher;
    }

    /**
     * Cleanup method
     */
    public async cleanup(): Promise<void> {
        console.log('EXAMPLES: Cleaning up example click handler...');
        await this.exampleLauncher.cleanup();
    }
}
