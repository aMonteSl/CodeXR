/**
 * New Code Analysis Commands
 * Command metadata collector for the new analysis module.
 */

import * as vscode from 'vscode';
import {
    AnalysisSettingsCommands,
    ActiveAnalysesCommands,
    ProjectByLanguageCommands,
    FilesByLanguageCommands,
} from './subsections';
import { FileAnalysisCommands } from './file_analysis';
import { DirectoryAnalysisCommands, ProjectAnalysisCommands } from './directory_analysis';
import { CleanAnalysisCommands } from './clean_analysis';
import { DOMVisualizationCommands } from './dom_visualization';
import { CommandRegistration } from './subsections/analysis_settings/analysis_file_mode';
import { AnalysisFileSetting } from '../views/subsections/analysis_settings/analysis_file_mode/analysisFileMode';
import { AnalysisDirectorySetting } from '../views/subsections/analysis_settings/analysis_directory_mode/analysisDirectoryMode';
import { ViewThemeSetting } from '../views/subsections/analysis_settings/view_theme/viewTheme';
import { AutoAnalysisDelaySetting } from '../views/subsections/analysis_settings/auto_analysis_delay/autoAnalysisDelay';
import { AutoAnalysisEnabledSetting } from '../views/subsections/analysis_settings/auto_analysis_enabled/autoAnalysisEnabled';
import { ChartTypeFileSetting } from '../views/subsections/analysis_settings/chart_type_file/chartTypeFile';
import { ChartTypeDirectorySetting } from '../views/subsections/analysis_settings/chart_type_directory/chartTypeDirectory';
import { DimensionMappingFileSetting } from '../views/subsections/analysis_settings/dimension_mapping_file/dimensionMappingFile';
import { DimensionMappingDirectorySetting } from '../views/subsections/analysis_settings/dimension_mapping_directory/dimensionMappingDirectory';
import { FilesByLanguageSortingSetting } from '../views/subsections/analysis_settings/files_by_language_sorting';
import { ProfileConfigurationSetting } from '../views/subsections/analysis_settings/profile_configuration';
import { AnalysisConfigurationStorage } from '../configuration/analysisConfigurationStorage';

export class CodeAnalysisCommands {
    static getCommandRegistrations(
        context: vscode.ExtensionContext,
        refreshCallback?: () => void,
    ): CommandRegistration[] {
        console.log('ANALYSIS: Collecting all command registrations');

        const defaultRefreshCallback = refreshCallback || (() => {
            console.log('ANALYSIS: Default refresh callback executed');
        });

        const tempAnalysisFileSetting = new AnalysisFileSetting(context);
        const tempAnalysisDirectorySetting = new AnalysisDirectorySetting(context);
        const tempViewThemeSetting = new ViewThemeSetting(context);
        const tempAutoAnalysisDelaySetting = new AutoAnalysisDelaySetting(context);
        const tempAutoAnalysisEnabledSetting = new AutoAnalysisEnabledSetting(context);
        const tempChartTypeFileSetting = new ChartTypeFileSetting(context);
        const tempChartTypeDirectorySetting = new ChartTypeDirectorySetting(context);
        const tempDimensionMappingFileSetting = new DimensionMappingFileSetting(context);
        const tempDimensionMappingDirectorySetting = new DimensionMappingDirectorySetting(context);
        const tempFilesByLanguageSortingSetting = new FilesByLanguageSortingSetting(context);
        const storage = AnalysisConfigurationStorage.getInstance(context);
        const tempProfileConfigurationSetting = new ProfileConfigurationSetting(context, storage);

        const registrations: CommandRegistration[] = [];
        registrations.push(...AnalysisSettingsCommands.getCommandRegistrations(
            context,
            tempAnalysisFileSetting,
            tempAnalysisDirectorySetting,
            tempViewThemeSetting,
            tempAutoAnalysisDelaySetting,
            tempAutoAnalysisEnabledSetting,
            tempChartTypeFileSetting,
            tempChartTypeDirectorySetting,
            tempDimensionMappingFileSetting,
            tempDimensionMappingDirectorySetting,
            tempFilesByLanguageSortingSetting,
            tempProfileConfigurationSetting,
            defaultRefreshCallback,
        ));
        registrations.push(...ActiveAnalysesCommands.getCommandRegistrations(context, defaultRefreshCallback));
        registrations.push(...ProjectByLanguageCommands.getCommandRegistrations(context, defaultRefreshCallback));
        registrations.push(...FilesByLanguageCommands.getCommandRegistrations(context, defaultRefreshCallback));
        registrations.push(...FileAnalysisCommands.getCommandRegistrations(context));
        registrations.push(...DirectoryAnalysisCommands.getCommandRegistrations(context));
        registrations.push(...ProjectAnalysisCommands.getCommandRegistrations(context));
        registrations.push(...CleanAnalysisCommands.getCommandRegistrations(context, defaultRefreshCallback));
        registrations.push(...DOMVisualizationCommands.getCommandRegistrations(context, defaultRefreshCallback));
        registrations.push(...CodeAnalysisCommands.getMainCommandRegistrations(context, defaultRefreshCallback));

        return registrations;
    }

    private static getMainCommandRegistrations(
        _context: vscode.ExtensionContext,
        _refreshCallback: () => void,
    ): CommandRegistration[] {
        return [];
    }
}

