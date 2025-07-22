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
import { ChartTypeFileSetting } from '../../../views/subsections/analysis_settings/chart_type_file/chartTypeFile';
import { DimensionMappingFileSetting } from '../../../views/subsections/analysis_settings/dimension_mapping_file/dimensionMappingFile';
import { FilesByLanguageSortingSetting } from '../../../views/subsections/analysis_settings/files_by_language_sorting';
import { AnalysisFileModeCommands, CommandRegistration } from './analysis_file_mode';
import { ViewThemeCommands } from './view_theme';
import { AutoAnalysisDelayCommands } from './auto_analysis_delay';
import { ChartTypeFileCommands } from './chart_type_file/chartTypeFileCommands';
import { DimensionMappingFileCommands } from './dimension_mapping_file/dimensionMappingFileCommands';
import { FilesByLanguageSortingCommands } from './filesByLanguageSortingCommands';

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
        chartTypeFileSetting: ChartTypeFileSetting,
        dimensionMappingFileSetting: DimensionMappingFileSetting,
        filesByLanguageSortingSetting: FilesByLanguageSortingSetting,
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

        // Collect chart type file command registrations
        const chartTypeFileCommands = ChartTypeFileCommands.getCommandRegistrations(
            context,
            chartTypeFileSetting,
            refreshCallback
        );
        commandRegistrations.push(...chartTypeFileCommands);

        // Collect dimension mapping file command registrations
        const dimensionMappingFileCommands = DimensionMappingFileCommands.getCommandRegistrations(
            context,
            dimensionMappingFileSetting,
            refreshCallback
        );
        commandRegistrations.push(...dimensionMappingFileCommands);

        // Collect auto-analysis delay command registrations
        const autoAnalysisDelayCommands = AutoAnalysisDelayCommands.getCommandRegistrations(
            context,
            autoAnalysisDelaySetting,
            refreshCallback
        );
        commandRegistrations.push(...autoAnalysisDelayCommands);

        // Collect files by language sorting command registrations
        const filesByLanguageSortingCommands = FilesByLanguageSortingCommands.getCommandRegistrations(
            context,
            filesByLanguageSortingSetting,
            refreshCallback
        );
        commandRegistrations.push(...filesByLanguageSortingCommands);

        console.log(`NEW_CODE_ANALYSIS: Collected ${commandRegistrations.length} Analysis Settings command registrations`);
        return commandRegistrations;
    }
}
