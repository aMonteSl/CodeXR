/**
 * Directory Analysis Commands
 * Commands for analyzing directories.
 */

import * as vscode from 'vscode';
import { DirectoryAnalysisLivePanelCommands } from './directoryAnalysisLivePanelCommands';
import { DirectoryAnalysisXRCommands } from './directoryAnalysisXRCommands';
import { CommandRegistration } from '../subsections/analysis_settings/analysis_file_mode';

export class DirectoryAnalysisCommands {
    static getCommandRegistrations(context: vscode.ExtensionContext): CommandRegistration[] {
        return [
            ...DirectoryAnalysisLivePanelCommands.getCommandRegistrations(context),
            ...DirectoryAnalysisXRCommands.getCommandRegistrations(context),
        ];
    }
}
