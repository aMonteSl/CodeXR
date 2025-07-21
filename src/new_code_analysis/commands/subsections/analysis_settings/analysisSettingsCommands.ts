/**
 * Analysis Settings Commands Coordinator
 * Coordinates all commands for the Analysis Settings subsection
 */

import * as vscode from 'vscode';
import { 
    AnalysisFileSetting, 
    ViewThemeSetting, 
    AutoAnalysisDelaySetting 
} from '../../../views/subsections/analysis_settings';
import { AnalysisFileModeCommands, CommandRegistration } from './analysis_file_mode';
import { ViewThemeCommands } from './view_theme';
import { AutoAnalysisDelayCommands } from './auto_analysis_delay';

export class AnalysisSettingsCommands {

    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Get all analysis settings command registrations (nested dolls pattern)
     * Collects commands from all sub-components without registering them
     */
    static getCommandRegistrations(
        context: vscode.ExtensionContext, 
        analysisFileSetting: AnalysisFileSetting,
        viewThemeSetting: ViewThemeSetting,
        autoAnalysisDelaySetting: AutoAnalysisDelaySetting,
        refreshCallback: () => void
    ): CommandRegistration[] {
        console.log('NEW_CODE_ANALYSIS: Collecting Analysis Settings command registrations');

        const commandRegistrations: CommandRegistration[] = [];

        // Collect analysis file mode command registrations
        const fileModeCommands = AnalysisFileModeCommands.getCommandRegistrations(
            context, 
            analysisFileSetting, 
            refreshCallback
        );
        commandRegistrations.push(...fileModeCommands);

        // Collect view theme command registrations
        const viewThemeCommands = ViewThemeCommands.getCommandRegistrations(
            context,
            viewThemeSetting,
            refreshCallback
        );
        commandRegistrations.push(...viewThemeCommands);

        // Collect auto-analysis delay command registrations
        const autoAnalysisDelayCommands = AutoAnalysisDelayCommands.getCommandRegistrations(
            context,
            autoAnalysisDelaySetting,
            refreshCallback
        );
        commandRegistrations.push(...autoAnalysisDelayCommands);

        console.log(`NEW_CODE_ANALYSIS: Collected ${commandRegistrations.length} Analysis Settings command registrations`);
        return commandRegistrations;
    }
}
