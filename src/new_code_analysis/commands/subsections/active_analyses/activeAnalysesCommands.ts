/**
 * Active Analyses Commands
 * Commands specific to the Active Analyses subsection
 */

import * as vscode from 'vscode';
import { CommandRegistration } from '../analysis_settings/analysis_file_mode';

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
        
        // TODO: Add actual active analyses commands
        const commandRegistrations: CommandRegistration[] = [
            // Example commands:
            // {
            //     commandId: 'newCodeAnalysis.showActiveAnalyses',
            //     callback: () => { /* implementation */ },
            //     description: 'Show Active Analyses view'
            // }
        ];

        console.log(`NEW_CODE_ANALYSIS: Collected ${commandRegistrations.length} Active Analyses command registrations`);
        return commandRegistrations;
    }
}
