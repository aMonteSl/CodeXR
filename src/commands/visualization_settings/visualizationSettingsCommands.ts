import * as vscode from 'vscode';
import { VisualizationSettingsCommands } from '../../visualization_settings/commands/visualizationSettingsCommands';
import { ExtensionCommandRegistration } from '../shared';

export function getVisualizationSettingsCommandRegistrations(
    context: vscode.ExtensionContext,
): ExtensionCommandRegistration[] {
    return VisualizationSettingsCommands.getCommandRegistrations(context);
}
