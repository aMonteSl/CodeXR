import * as vscode from 'vscode';
import { BabiaExamplesCommands } from '../../babia_examples/commands/babiaExamplesCommands';
import { BabiaExamplesTreeDataProvider } from '../../babia_examples/views/babiaExamplesTreeView';

/**
 * Register Babia Examples Commands
 * Entry point for registering all Babia examples related commands
 */
export function registerBabiaExamplesCommands(
    context: vscode.ExtensionContext,
    treeDataProvider?: BabiaExamplesTreeDataProvider
): void {
    console.log('EXAMPLES: Registering Babia examples commands...');
    
    BabiaExamplesCommands.registerCommands(context, treeDataProvider);
    
    console.log('EXAMPLES: Babia examples commands registration complete');
}
