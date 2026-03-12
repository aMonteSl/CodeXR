import * as vscode from 'vscode';
import { BabiaExamplesCommands } from '../../babia_examples/commands/babiaExamplesCommands';
import { BabiaExamplesTreeDataProvider } from '../../babia_examples/views/babiaExamplesTreeView';
import { ExtensionCommandRegistration } from '../shared';

export function getBabiaExamplesCommandRegistrations(
    context: vscode.ExtensionContext,
    treeDataProvider?: BabiaExamplesTreeDataProvider,
): ExtensionCommandRegistration[] {
    return BabiaExamplesCommands.getCommandRegistrations(context, treeDataProvider);
}
