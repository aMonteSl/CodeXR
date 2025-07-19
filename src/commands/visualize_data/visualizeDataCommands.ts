import * as vscode from 'vscode';
import { VisualizeDataCommands } from '../../visualize_data/commands/visualizeDataCommands';

/**
 * Register Visualize Data Commands
 * Entry point for registering all visualize data related commands
 */
export function registerVisualizeDataCommands(context: vscode.ExtensionContext): void {
    console.log('VISUALIZE_DATA: Registering visualize data commands...');
    
    VisualizeDataCommands.registerCommands(context);
    
    console.log('VISUALIZE_DATA: Visualize data commands registration complete');
}
