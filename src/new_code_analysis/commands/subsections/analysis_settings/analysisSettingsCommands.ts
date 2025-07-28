/**
 * Analysis Settings Commands Coordinator
 * Coordinates all commands for the Analysis Settings subsection
 */

import * as vscode from 'vscode';
import { 
    AnalysisFileSetting,
    AnalysisDirectorySetting, 
    ViewThemeSetting, 
    AutoAnalysisDelaySetting,
    AutoAnalysisEnabledSetting
} from '../../../views/subsections/analysis_settings';
import { ChartTypeFileSetting } from '../../../views/subsections/analysis_settings/chart_type_file/chartTypeFile';
import { ChartTypeDirectorySetting } from '../../../views/subsections/analysis_settings/chart_type_directory/chartTypeDirectory';
import { DimensionMappingFileSetting } from '../../../views/subsections/analysis_settings/dimension_mapping_file/dimensionMappingFile';
import { DimensionMappingDirectorySetting } from '../../../views/subsections/analysis_settings/dimension_mapping_directory/dimensionMappingDirectory';
import { FilesByLanguageSortingSetting } from '../../../views/subsections/analysis_settings/files_by_language_sorting';
import { ProfileConfigurationSetting } from '../../../views/subsections/analysis_settings/profile_configuration';
import { AnalysisFileModeCommands, CommandRegistration } from './analysis_file_mode';
import { AnalysisDirectoryModeCommands } from './analysis_directory_mode';
import { ViewThemeCommands } from './view_theme';
import { AutoAnalysisDelayCommands } from './auto_analysis_delay';
import { AutoAnalysisEnabledCommands } from './auto_analysis_enabled';
import { ChartTypeFileCommands } from './chart_type_file/chartTypeFileCommands';
import { ChartTypeDirectoryCommands } from './chart_type_directory/chartTypeDirectoryCommands';
import { DimensionMappingFileCommands } from './dimension_mapping_file/dimensionMappingFileCommands';
import { DimensionMappingDirectoryCommands } from './dimension_mapping_directory/dimensionMappingDirectoryCommands';
import { FilesByLanguageSortingCommands } from './filesByLanguageSortingCommands';
import { ProfileConfigurationCommands } from './profile_configuration';

export class AnalysisSettingsCommands {

    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Get all analysis settings command registrations (nested dolls pattern)
     * Collects commands from all sub-components without registering them
     */
    static getCommandRegistrations(
        context: vscode.ExtensionContext, 
        analysisFileSetting: AnalysisFileSetting,
        analysisDirectorySetting: AnalysisDirectorySetting,
        viewThemeSetting: ViewThemeSetting,
        autoAnalysisDelaySetting: AutoAnalysisDelaySetting,
        autoAnalysisEnabledSetting: AutoAnalysisEnabledSetting,
        chartTypeFileSetting: ChartTypeFileSetting,
        chartTypeDirectorySetting: ChartTypeDirectorySetting,
        dimensionMappingFileSetting: DimensionMappingFileSetting,
        dimensionMappingDirectorySetting: DimensionMappingDirectorySetting,
        filesByLanguageSortingSetting: FilesByLanguageSortingSetting,
        profileConfigurationSetting: ProfileConfigurationSetting,
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

        // Collect analysis directory mode command registrations
        const directoryModeCommands = AnalysisDirectoryModeCommands.getCommandRegistrations(
            context,
            analysisDirectorySetting,
            refreshCallback
        );
        commandRegistrations.push(...directoryModeCommands);

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

        // Collect chart type directory command registrations
        const chartTypeDirectoryCommands = ChartTypeDirectoryCommands.getCommandRegistrations(
            context,
            chartTypeDirectorySetting,
            refreshCallback
        );
        commandRegistrations.push(...chartTypeDirectoryCommands);

        // Collect dimension mapping file command registrations
        const dimensionMappingFileCommands = DimensionMappingFileCommands.getCommandRegistrations(
            context,
            dimensionMappingFileSetting,
            refreshCallback
        );
        commandRegistrations.push(...dimensionMappingFileCommands);

        // Collect dimension mapping directory command registrations
        const dimensionMappingDirectoryCommands = DimensionMappingDirectoryCommands.getCommandRegistrations(
            context,
            dimensionMappingDirectorySetting,
            refreshCallback
        );
        console.log(`ANALYSIS_SETTINGS_COMMANDS: Got ${dimensionMappingDirectoryCommands.length} dimension mapping directory commands`);
        commandRegistrations.push(...dimensionMappingDirectoryCommands);

        // Collect auto-analysis delay command registrations
        const autoAnalysisDelayCommands = AutoAnalysisDelayCommands.getCommandRegistrations(
            context,
            autoAnalysisDelaySetting,
            refreshCallback
        );
        commandRegistrations.push(...autoAnalysisDelayCommands);

        // Collect auto-analysis enabled command registrations
        const autoAnalysisEnabledCommands = AutoAnalysisEnabledCommands.getCommandRegistrations(
            context,
            autoAnalysisEnabledSetting,
            refreshCallback
        );
        commandRegistrations.push(...autoAnalysisEnabledCommands);

        // Collect files by language sorting command registrations
        const filesByLanguageSortingCommands = FilesByLanguageSortingCommands.getCommandRegistrations(
            context,
            filesByLanguageSortingSetting,
            refreshCallback
        );
        commandRegistrations.push(...filesByLanguageSortingCommands);

        // Collect profile configuration command registrations
        const profileConfigurationCommands = ProfileConfigurationCommands.getCommandRegistrations(
            context,
            profileConfigurationSetting,
            refreshCallback
        );
        commandRegistrations.push(...profileConfigurationCommands);

        console.log(`NEW_CODE_ANALYSIS: Collected ${commandRegistrations.length} Analysis Settings command registrations`);
        return commandRegistrations;
    }
}
