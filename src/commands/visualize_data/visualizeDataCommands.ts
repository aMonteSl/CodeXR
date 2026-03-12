import * as vscode from 'vscode';
import { VisualizeDataCommands } from '../../visualize_data/commands/visualizeDataCommands';
import { ExtensionCommandRegistration } from '../shared';

export function getVisualizeDataCommandRegistrations(
    context: vscode.ExtensionContext,
): ExtensionCommandRegistration[] {
    return VisualizeDataCommands.getCommandRegistrations(context);
}
