/**
 * New Code Analysis Commands
 * Command handlers for the new code analysis functionality
 * Implements the "nested dolls" architecture pattern
 */

import * as vscode from 'vscode';
import { 
    AnalysisSettingsCommands,
    ActiveAnalysesCommands,
    ProjectByLanguageCommands,
    FilesByLanguageCommands
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
import { ChartTypeFileSetting } from '../views/subsections/analysis_settings/chart_type_file/chartTypeFile';
import { ChartTypeDirectorySetting } from '../views/subsections/analysis_settings/chart_type_directory/chartTypeDirectory';
import { DimensionMappingFileSetting } from '../views/subsections/analysis_settings/dimension_mapping_file/dimensionMappingFile';
import { DimensionMappingDirectorySetting } from '../views/subsections/analysis_settings/dimension_mapping_directory/dimensionMappingDirectory';
import { FilesByLanguageSortingSetting } from '../views/subsections/analysis_settings/files_by_language_sorting';
import { ProfileConfigurationSetting } from '../views/subsections/analysis_settings/profile_configuration';
import { AnalysisConfigurationStorage } from '../configuration/analysisConfigurationStorage';

/**
 * Main command coordinator for New Code Analysis
 * Follows the "nested dolls" pattern: collects all command registrations
 * without actually registering them - that's done at the top level
 */
export class NewCodeAnalysisCommands {
    
    /**
     * Get all new code analysis command registrations (nested dolls pattern)
     * This collects all commands from subsections without registering them
     */
    static getCommandRegistrations(
        context: vscode.ExtensionContext,
        refreshCallback?: () => void
    ): CommandRegistration[] {
        console.log('NEW_CODE_ANALYSIS: Collecting all command registrations');

        // Create a default refresh callback if none provided
        const defaultRefreshCallback = refreshCallback || (() => {
            console.log('NEW_CODE_ANALYSIS: Default refresh callback executed');
        });

        // Create setting instances
        const tempAnalysisFileSetting = new AnalysisFileSetting(context);
        const tempAnalysisDirectorySetting = new AnalysisDirectorySetting(context);
        const tempViewThemeSetting = new ViewThemeSetting(context);
        const tempAutoAnalysisDelaySetting = new AutoAnalysisDelaySetting(context);
        const tempChartTypeFileSetting = new ChartTypeFileSetting(context);
        const tempChartTypeDirectorySetting = new ChartTypeDirectorySetting(context);
        const tempDimensionMappingFileSetting = new DimensionMappingFileSetting(context);
        const tempDimensionMappingDirectorySetting = new DimensionMappingDirectorySetting(context);
        const tempFilesByLanguageSortingSetting = new FilesByLanguageSortingSetting(context);
        
        // Create profile configuration setting with storage
        const storage = AnalysisConfigurationStorage.getInstance(context);
        const tempProfileConfigurationSetting = new ProfileConfigurationSetting(context, storage);

        const allCommandRegistrations: CommandRegistration[] = [];

        // Collect subsection command registrations
        const analysisSettingsCommands = AnalysisSettingsCommands.getCommandRegistrations(
            context, 
            tempAnalysisFileSetting,
            tempAnalysisDirectorySetting,
            tempViewThemeSetting,
            tempAutoAnalysisDelaySetting,
            tempChartTypeFileSetting,
            tempChartTypeDirectorySetting,
            tempDimensionMappingFileSetting,
            tempDimensionMappingDirectorySetting,
            tempFilesByLanguageSortingSetting,
            tempProfileConfigurationSetting,
            defaultRefreshCallback
        );
        allCommandRegistrations.push(...analysisSettingsCommands);

        const activeAnalysesCommands = ActiveAnalysesCommands.getCommandRegistrations(
            context, 
            defaultRefreshCallback
        );
        allCommandRegistrations.push(...activeAnalysesCommands);

        const projectByLanguageCommands = ProjectByLanguageCommands.getCommandRegistrations(
            context, 
            defaultRefreshCallback
        );
        allCommandRegistrations.push(...projectByLanguageCommands);

        const filesByLanguageCommands = FilesByLanguageCommands.getCommandRegistrations(
            context, 
            defaultRefreshCallback
        );
        allCommandRegistrations.push(...filesByLanguageCommands);

        // Add main section commands
        const mainCommands = NewCodeAnalysisCommands.getMainCommandRegistrations(
            context, 
            defaultRefreshCallback
        );
        allCommandRegistrations.push(...mainCommands);

        // Add file analysis commands (these are direct registrations, not command registrations)
        // This now includes both LivePanel and XR commands
        const fileAnalysisCommands = FileAnalysisCommands.registerCommands(context);
        // Note: FileAnalysisCommands returns disposables directly, not CommandRegistrations
        // These will be automatically added to the context subscriptions

        // Add directory analysis commands
        const directoryAnalysisCommands = DirectoryAnalysisCommands.registerCommands(context);
        // Note: DirectoryAnalysisCommands returns disposables directly, not CommandRegistrations
        // This includes DirectoryAnalysisLivePanelCommands internally

        // Add project analysis commands
        const projectAnalysisCommands = ProjectAnalysisCommands.registerCommands(context);
        // Note: ProjectAnalysisCommands returns disposables directly, not CommandRegistrations

        // Add clean analysis commands
        const cleanAnalysisCommands = CleanAnalysisCommands.getCommandRegistrations(
            context, 
            defaultRefreshCallback
        );
        allCommandRegistrations.push(...cleanAnalysisCommands);

        // Add DOM visualization commands
        const domVisualizationCommands = DOMVisualizationCommands.getCommandRegistrations(
            context, 
            defaultRefreshCallback
        );
        allCommandRegistrations.push(...domVisualizationCommands);

        // Execute startup cleanup
        CleanAnalysisCommands.executeStartupCleanup(context);

        console.log(`NEW_CODE_ANALYSIS: Collected total of ${allCommandRegistrations.length} command registrations + file analysis commands`);
        
        // Log specific commands for debugging
        const dimensionMappingDirectoryCommands = allCommandRegistrations.filter(cmd => 
            cmd.commandId.includes('DimensionMappingDirectory')
        );
        console.log(`NEW_CODE_ANALYSIS: Found ${dimensionMappingDirectoryCommands.length} dimension mapping directory commands:`, 
            dimensionMappingDirectoryCommands.map(cmd => cmd.commandId));
        
        return allCommandRegistrations;
    }

    /**
     * Get main section command registrations (not subsection-specific)
     */
    private static getMainCommandRegistrations(
        context: vscode.ExtensionContext,
        refreshCallback: () => void
    ): CommandRegistration[] {
        console.log('NEW_CODE_ANALYSIS: Collecting main command registrations');
        
        // TODO: Add main new code analysis commands
        const mainCommands: CommandRegistration[] = [
            // Example main commands:
            // {
            //     commandId: 'newCodeAnalysis.refresh',
            //     callback: refreshCallback,
            //     description: 'Refresh New Code Analysis tree view'
            // }
        ];

        console.log(`NEW_CODE_ANALYSIS: Collected ${mainCommands.length} main command registrations`);
        return mainCommands;
    }
}
