import * as vscode from 'vscode';
import { ActiveServersCommands } from '../../active_servers/commands/activeServersCommands';

/**
 * Interface for tree data providers that support refresh
 */
interface RefreshableTreeProvider {
    refresh(): void;
}

/**
 * Active Servers Commands Wrapper
 * Re-exports active servers commands for centralized command registration
 */

/**
 * Register all active servers commands
 * @param context VS Code extension context
 * @param treeDataProvider Any tree data provider that supports refresh operations
 */
export function registerActiveServersCommands(
    context: vscode.ExtensionContext, 
    treeDataProvider?: RefreshableTreeProvider
): void {
    console.log('COMMANDS: Registering active servers commands');
    ActiveServersCommands.registerCommands(context, treeDataProvider);
}

/**
 * Get active servers command IDs for external reference
 */
export function getActiveServersCommandIds(): Record<string, string> {
    return ActiveServersCommands.getCommandIds();
}
