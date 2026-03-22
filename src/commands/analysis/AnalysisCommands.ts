/**
 * Analysis Commands Registration
 * Converts analysis registrations to the shared command format.
 */
import * as vscode from 'vscode';
import { CodeAnalysisCommands } from '../../code_analysis/commands/analysisCommands';
import { ExtensionCommandRegistration } from '../shared';
export function getAnalysisCommandRegistrations(
    context: vscode.ExtensionContext,
    refreshCallback?: () => void,
): ExtensionCommandRegistration[] {
    return CodeAnalysisCommands.getCommandRegistrations(context, refreshCallback).map((registration) => ({
        id: registration.commandId,
        module: registration.module ?? 'ANALYSIS',
        description: registration.description,
        handler: async (...args: any[]) => {
            await registration.callback(...args);
        },
        errorMessage: registration.errorMessage,
        silentErrors: registration.silentErrors,
    }));
}

