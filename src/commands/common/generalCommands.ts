import * as vscode from 'vscode';
import { CommonCommands } from '../../utils/commonCommands';

/**
 * Register general/common commands used throughout the extension
 */
export function registerGeneralCommands(context: vscode.ExtensionContext): void {
    console.log('GENERAL_COMMANDS: Registering general commands');
    
    // Register the main tree refresh command (replaces codexr.servers.refresh)
    const refreshTreeCommand = vscode.commands.registerCommand('codexr.tree.refresh', () => {
        console.log('GENERAL_COMMANDS: Tree refresh command executed');
        CommonCommands.refreshTreeView();
    });
    
    // Register legacy command for backward compatibility
    const legacyRefreshCommand = vscode.commands.registerCommand('codexr.servers.refresh', () => {
        console.log('GENERAL_COMMANDS: Legacy servers refresh command executed, delegating to tree refresh');
        CommonCommands.refreshTreeView();
    });
    
    // Register a general modular tree refresh command
    const modularTreeRefreshCommand = vscode.commands.registerCommand('codeXR.modularTree.refresh', () => {
        console.log('GENERAL_COMMANDS: Modular tree refresh command executed');
        CommonCommands.refreshTreeView();
    });
    
    // Add commands to subscriptions
    context.subscriptions.push(
        refreshTreeCommand,
        legacyRefreshCommand,
        modularTreeRefreshCommand
    );
    
    console.log('GENERAL_COMMANDS: Registered 3 general commands (tree refresh, legacy refresh, modular refresh)');
}
