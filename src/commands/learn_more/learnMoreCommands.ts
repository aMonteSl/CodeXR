/**
 * Learn More Commands Wrapper
 * Re-exports learn more commands for centralized command registration
 */

import * as vscode from 'vscode';
import { LearnMoreCommands } from '../../learn_more/commands/learnMoreCommands';

/**
 * Registers all learn more related commands
 */
export function registerLearnMoreCommands(context: vscode.ExtensionContext): void {
    console.log('LEARN_MORE: Registering learn more commands...');
    
    LearnMoreCommands.registerCommands(context);
    
    console.log('LEARN_MORE: Learn more commands registration complete');
}
