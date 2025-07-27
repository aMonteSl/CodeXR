/**
 * Active Analyses Commands
 * Commands specific to the Active Analyses subsection
 */

import * as vscode from 'vscode';
import { CommandRegistration } from '../analysis_settings/analysis_file_mode';
import { UnifiedSessionRegistry } from '../../../new_engine/core/sessionRegistry';
import { ServerWatcherIntegration } from '../../../services/serverWatcherIntegration';
import { ActiveAnalysesCommands as ActiveAnalysesViewCommands } from '../../../views/subsections/active_analyses/commands/activeAnalysesCommands';

export class ActiveAnalysesCommands {
    
    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Get active analyses command registrations (nested dolls pattern)
     */
    static getCommandRegistrations(
        context: vscode.ExtensionContext, 
        refreshCallback: () => void
    ): CommandRegistration[] {
        console.log('NEW_CODE_ANALYSIS: Collecting Active Analyses command registrations');
        
        // Get the session registry and server watcher
        const sessionRegistry = UnifiedSessionRegistry.getInstance(context);
        const serverWatcher = ServerWatcherIntegration.getInstance(context);
        const viewCommands = ActiveAnalysesViewCommands.getInstance(sessionRegistry, serverWatcher);
        
        // Register commands with the view commands handler (this does the actual registration)
        const disposables = viewCommands.registerCommands();
        
        // Convert disposables to command registrations for the nested pattern
        const commandRegistrations: CommandRegistration[] = [];

        console.log(`NEW_CODE_ANALYSIS: Active Analyses commands registered directly, returning ${commandRegistrations.length} command registrations for nested pattern`);
        return commandRegistrations;
    }
}
