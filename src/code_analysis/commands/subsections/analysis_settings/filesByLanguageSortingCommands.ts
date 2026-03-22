/**
 * Files by Language Sorting Commands
 * Commands for configuring Files by Language sorting
 */

import * as vscode from 'vscode';
import { CommandRegistration } from './analysis_file_mode';
import { FilesByLanguageSortingSetting } from '../../../views/subsections/analysis_settings/files_by_language_sorting';
import { AnalysisConfigurationStorage } from '../../../configuration/analysisConfigurationStorage';
import {
    LanguageGroupSortBy,
    LanguageGroupSortDirection,
    FilesSortBy,
    FilesSortDirection
} from '../../../configuration/models/analysisConfiguration';

export class FilesByLanguageSortingCommands {

    /**
     * Get Files by Language Sorting command registrations
     */
    static getCommandRegistrations(
        context: vscode.ExtensionContext,
        filesByLanguageSortingSetting: FilesByLanguageSortingSetting,
        refreshCallback: () => void
    ): CommandRegistration[] {
        console.log('ANALYSIS: Collecting Files by Language Sorting command registrations');

        const commandRegistrations: CommandRegistration[] = [
            // Language Group Primary Sorting
            {
                commandId: 'codeXR.analysis.selectLanguageGroupPrimarySorting',
                callback: async () => {
                    await FilesByLanguageSortingCommands.selectLanguageGroupPrimarySorting(context, filesByLanguageSortingSetting, refreshCallback);
                },
                description: 'Select primary sorting for language groups'
            },

            // Language Group Secondary Sorting
            {
                commandId: 'codeXR.analysis.selectLanguageGroupSecondarySorting',
                callback: async () => {
                    await FilesByLanguageSortingCommands.selectLanguageGroupSecondarySorting(context, filesByLanguageSortingSetting, refreshCallback);
                },
                description: 'Select secondary sorting for language groups'
            },

            // Files Sorting
            {
                commandId: 'codeXR.analysis.selectFilesSorting',
                callback: async () => {
                    await FilesByLanguageSortingCommands.selectFilesSorting(filesByLanguageSortingSetting, refreshCallback);
                },
                description: 'Select sorting for files within language groups'
            }
        ];

        console.log(`ANALYSIS: Collected ${commandRegistrations.length} Files by Language Sorting command registrations`);
        return commandRegistrations;
    }

    /**
     * Show picker for language group primary sorting
     */
    private static async selectLanguageGroupPrimarySorting(
        context: vscode.ExtensionContext,
        setting: FilesByLanguageSortingSetting,
        refreshCallback: () => void
    ): Promise<void> {
        console.log('ANALYSIS: Showing language group primary sorting picker');

        // Get current configuration to check for conflicts
        const storage = AnalysisConfigurationStorage.getInstance(context);
        const currentConfig = await storage.getFilesByLanguageSorting();

        const options = [
            { label: 'Alphabetical Ascending', sortBy: 'alphabetical' as LanguageGroupSortBy, direction: 'ascending' as LanguageGroupSortDirection },
            { label: 'Alphabetical Descending', sortBy: 'alphabetical' as LanguageGroupSortBy, direction: 'descending' as LanguageGroupSortDirection },
            { label: 'File Count Ascending', sortBy: 'fileCount' as LanguageGroupSortBy, direction: 'ascending' as LanguageGroupSortDirection },
            { label: 'File Count Descending', sortBy: 'fileCount' as LanguageGroupSortBy, direction: 'descending' as LanguageGroupSortDirection }
        ];

        const picked = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select primary sorting for language groups',
            title: 'Language Groups Primary Sorting'
        });

        if (picked) {
            // Check if the new primary conflicts with current secondary
            const newPrimarySortBy = picked.sortBy;
            const currentSecondarySortBy = currentConfig.languageGroupSecondarySortBy;

            // If secondary uses the same type as the new primary, reset secondary to None
            if (currentSecondarySortBy && currentSecondarySortBy === newPrimarySortBy) {
                console.log('ANALYSIS: Primary conflicts with secondary, resetting secondary to None');
                await setting.updateLanguageGroupSecondarySorting(undefined, undefined);
                vscode.window.showInformationMessage(`Secondary sorting reset to None to avoid conflict with primary sorting`);
            }

            await setting.updateLanguageGroupPrimarySorting(picked.sortBy, picked.direction);
            refreshCallback();
            vscode.window.showInformationMessage(`Language groups primary sorting changed to: ${picked.label}`);
        }
    }

    /**
     * Show picker for language group secondary sorting
     */
    private static async selectLanguageGroupSecondarySorting(
        context: vscode.ExtensionContext,
        setting: FilesByLanguageSortingSetting,
        refreshCallback: () => void
    ): Promise<void> {
        console.log('ANALYSIS: Showing language group secondary sorting picker');

        // Get current configuration to determine what's available for secondary
        const storage = AnalysisConfigurationStorage.getInstance(context);
        const currentConfig = await storage.getFilesByLanguageSorting();
        const primarySortBy = currentConfig.languageGroupSortBy;

        // Build options - only show the option NOT selected in primary, plus None
        type OptionType = { label: string; sortBy?: LanguageGroupSortBy; direction?: LanguageGroupSortDirection };
        const options: OptionType[] = [{ label: 'None', sortBy: undefined, direction: undefined }];
        
        if (primarySortBy === 'alphabetical') {
            // Primary is alphabetical, so secondary can be fileCount
            options.push(
                { label: 'File Count Ascending', sortBy: 'fileCount', direction: 'ascending' },
                { label: 'File Count Descending', sortBy: 'fileCount', direction: 'descending' }
            );
        } else if (primarySortBy === 'fileCount') {
            // Primary is fileCount, so secondary can be alphabetical
            options.push(
                { label: 'Alphabetical Ascending', sortBy: 'alphabetical', direction: 'ascending' },
                { label: 'Alphabetical Descending', sortBy: 'alphabetical', direction: 'descending' }
            );
        }

        const picked = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select secondary sorting for language groups (optional)',
            title: 'Language Groups Secondary Sorting'
        });

        if (picked) {
            await setting.updateLanguageGroupSecondarySorting(picked.sortBy, picked.direction);
            refreshCallback();
            const message = picked.sortBy ? 
                `Language groups secondary sorting changed to: ${picked.label}` :
                'Language groups secondary sorting disabled';
            vscode.window.showInformationMessage(message);
        }
    }

    /**
     * Show picker for files sorting
     */
    private static async selectFilesSorting(
        setting: FilesByLanguageSortingSetting,
        refreshCallback: () => void
    ): Promise<void> {
        console.log('ANALYSIS: Showing files sorting picker');

        const options = [
            { label: 'Alphabetical Ascending', sortBy: 'alphabetical' as FilesSortBy, direction: 'ascending' as FilesSortDirection },
            { label: 'Alphabetical Descending', sortBy: 'alphabetical' as FilesSortBy, direction: 'descending' as FilesSortDirection },
            { label: 'Last Modified Ascending (Oldest First)', sortBy: 'lastModified' as FilesSortBy, direction: 'ascending' as FilesSortDirection },
            { label: 'Last Modified Descending (Newest First)', sortBy: 'lastModified' as FilesSortBy, direction: 'descending' as FilesSortDirection }
        ];

        const picked = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select sorting for files within language groups',
            title: 'Files Sorting'
        });

        if (picked) {
            await setting.updateFilesSorting(picked.sortBy, picked.direction);
            refreshCallback();
            vscode.window.showInformationMessage(`Files sorting changed to: ${picked.label}`);
        }
    }
}

