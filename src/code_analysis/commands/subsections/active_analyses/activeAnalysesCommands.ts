/**
 * Active Analyses Commands
 * Commands specific to the Active Analyses subsection.
 */

import * as vscode from 'vscode';
import { CommandRegistration } from '../analysis_settings/analysis_file_mode';
import { UnifiedSessionRegistry } from '../../../engine/core/sessionRegistry';
import { ServerWatcherIntegration } from '../../../services/serverWatcherIntegration';
import { ActiveAnalysesCommands as ActiveAnalysesViewCommands } from '../../../views/subsections/active_analyses/commands/activeAnalysesCommands';

export class ActiveAnalysesCommands {
    constructor(private context: vscode.ExtensionContext) {}

    static getCommandRegistrations(
        context: vscode.ExtensionContext,
        _refreshCallback: () => void,
    ): CommandRegistration[] {
        const sessionRegistry = UnifiedSessionRegistry.getInstance(context);
        const serverWatcher = ServerWatcherIntegration.getInstance(context);
        // This is the canonical command-registration path and therefore the
        // first caller in normal extension activation. Pass the context here,
        // rather than hoping the tree provider initializes the singleton
        // later: the current AnalysisSectionProvider reads Active Analyses
        // directly and does not construct that legacy subsection provider.
        const viewCommands = ActiveAnalysesViewCommands.getInstance(
            sessionRegistry,
            serverWatcher,
            context,
        );
        return viewCommands.getCommandRegistrations();
    }
}
