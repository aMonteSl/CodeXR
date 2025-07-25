/**
 * New Code Analysis Commands Registration
 * Command registration for new code analysis module
 * This is the final level of the "nested dolls" architecture
 */

import * as vscode from 'vscode';
import { NewCodeAnalysisCommands } from '../../new_code_analysis/commands/newCodeAnalysisCommands';
import { CommandRegistration } from '../../new_code_analysis/commands/subsections/analysis_settings/analysis_file_mode';

/**
 * Register all new code analysis commands
 * This is the ONLY place where VS Code commands are actually registered
 */
export function registerNewCodeAnalysisCommands(
    context: vscode.ExtensionContext, 
    refreshCallback?: () => void
): void {
    console.log('COMMAND_REGISTRATION: Starting New Code Analysis commands registration');
    console.log('COMMAND_REGISTRATION: refreshCallback provided:', refreshCallback !== undefined);

    try {
        // Get all command registrations using the "nested dolls" pattern
        const commandRegistrations = NewCodeAnalysisCommands.getCommandRegistrations(context, refreshCallback);

        console.log(`COMMAND_REGISTRATION: Processing ${commandRegistrations.length} command registrations`);

        // Helper function to safely register commands (avoid duplicates)
        const safeRegisterCommand = (registration: CommandRegistration) => {
            try {
                const command = vscode.commands.registerCommand(
                    registration.commandId, 
                    registration.callback
                );
                context.subscriptions.push(command);
                console.log(`COMMAND_REGISTRATION: ✓ Registered: ${registration.commandId} - ${registration.description}`);
                return true;
            } catch (error) {
                console.warn(`COMMAND_REGISTRATION: ⚠️ Command ${registration.commandId} may already exist:`, error);
                return false;
            }
        };

        // Register all collected commands
        let successCount = 0;
        let failureCount = 0;

        commandRegistrations.forEach(registration => {
            console.log(`COMMAND_REGISTRATION: Attempting to register: ${registration.commandId}`);
            if (safeRegisterCommand(registration)) {
                successCount++;
            } else {
                failureCount++;
            }
        });

        console.log(`COMMAND_REGISTRATION: New Code Analysis commands registration complete`);
        console.log(`COMMAND_REGISTRATION: ✓ Successfully registered: ${successCount} commands`);
        if (failureCount > 0) {
            console.log(`COMMAND_REGISTRATION: ⚠️ Failed to register: ${failureCount} commands (may already exist)`);
        }

    } catch (error) {
        console.error('COMMAND_REGISTRATION: Error during New Code Analysis commands registration:', error);
        throw error;
    }
}
