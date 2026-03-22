import * as vscode from 'vscode';
import { LearnMoreCommands } from '../../learn_more/commands/learnMoreCommands';
import { ExtensionCommandRegistration } from '../shared';

export function getLearnMoreCommandRegistrations(
    _context: vscode.ExtensionContext,
): ExtensionCommandRegistration[] {
    return LearnMoreCommands.getCommandRegistrations();
}
