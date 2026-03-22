/**
 * File Analysis Commands
 * Main coordinator for all file analysis commands.
 */

import * as vscode from 'vscode';
import { FileAnalysisLivePanelCommands } from './fileAnalysisLivePanelCommands';
import { FileAnalysisXRCommands } from './fileAnalysisXRCommands';
import { CommandRegistration } from '../subsections/analysis_settings/analysis_file_mode';

export class FileAnalysisCommands {
    static getCommandRegistrations(context: vscode.ExtensionContext): CommandRegistration[] {
        return [
            ...FileAnalysisLivePanelCommands.getCommandRegistrations(context),
            ...FileAnalysisXRCommands.getCommandRegistrations(context),
        ];
    }
}
