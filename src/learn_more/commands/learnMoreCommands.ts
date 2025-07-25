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
     * TODO: In the future, this will open the CodeXR documentation website
     */
    private static handleLearnMore(): void {
        console.log('LEARN_MORE: Learn more action triggered');
        
        // TODO: Replace with actual website URL when available
        vscode.window.showInformationMessage(
            'In the future: Learn more about CodeXR with examples and videos!',
            'Coming Soon'
        ).then(selection => {
            if (selection === 'Coming Soon') {
                vscode.window.showInformationMessage(
                    'Stay tuned! The CodeXR learning center with interactive tutorials and video guides is coming soon. 🚀'
                );
            }
        });
        
        // Future implementation:
        // vscode.env.openExternal(vscode.Uri.parse('https://codexr-learning-center.com'));
    }
}
