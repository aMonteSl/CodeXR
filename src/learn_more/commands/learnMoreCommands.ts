/**
 * Learn More Commands
 * Handles commands related to learning more about CodeXR functionality
 */

import * as vscode from 'vscode';

export class LearnMoreCommands {
    
    /**
     * Register all learn more related commands
     */
    static registerCommands(context: vscode.ExtensionContext): void {
        console.log('LEARN_MORE: Registering learn more commands...');
        
        // Main learn more command
        const learnMoreCommand = vscode.commands.registerCommand('codeXR.learnMore', () => {
            LearnMoreCommands.handleLearnMore();
        });
        
        context.subscriptions.push(learnMoreCommand);
        
        console.log('LEARN_MORE: Learn more commands registered successfully');
    }
    
    /**
     * Handle the main learn more action
     * Opens the CodeXR documentation website
     */
    private static handleLearnMore(): void {
        console.log('LEARN_MORE: Learn more action triggered - opening CodeXR documentation website');
        
        // Open the CodeXR documentation website
        const websiteUrl = 'https://amontesl.github.io/code-xr-docs/';
        
        vscode.window.showInformationMessage(
            'Opening CodeXR Documentation Website...',
            'Open Website'
        ).then(selection => {
            if (selection === 'Open Website') {
                vscode.env.openExternal(vscode.Uri.parse(websiteUrl));
            }
        });
        
        // Also open directly for immediate access
        vscode.env.openExternal(vscode.Uri.parse(websiteUrl));
    }
}
