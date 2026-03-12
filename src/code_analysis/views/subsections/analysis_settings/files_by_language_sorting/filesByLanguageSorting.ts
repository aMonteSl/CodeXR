/**
 * Files by Language Sorting Setting
 * Configuration for sorting Files by Language section
 */

import * as vscode from 'vscode';
import { CodeAnalysisTreeItem } from '../../../items/analysisItems';
import { AnalysisConfigurationStorage } from '../../../../configuration';
import { 
    FilesByLanguageSortingConfig,
    LanguageGroupSortBy,
    LanguageGroupSortDirection,
    FilesSortBy,
    FilesSortDirection
} from '../../../../configuration/models/analysisConfiguration';

export class FilesByLanguageSortingSetting {
    private storage: AnalysisConfigurationStorage;

    constructor(context: vscode.ExtensionContext) {
        this.storage = AnalysisConfigurationStorage.getInstance(context);
    }

    /**
     * Get the tree item for this setting
     */
    async getSettingItem(): Promise<CodeAnalysisTreeItem> {
        const currentConfig = await this.storage.getFilesByLanguageSorting();
        
        const primarySort = `${currentConfig.languageGroupSortBy} ${currentConfig.languageGroupSortDirection}`;
        const secondarySort = currentConfig.languageGroupSecondarySortBy ? 
            `, ${currentConfig.languageGroupSecondarySortBy} ${currentConfig.languageGroupSecondarySortDirection}` : '';
        const filesSort = `Files: ${currentConfig.filesSortBy} ${currentConfig.filesSortDirection}`;
        
        const description = `Groups: ${primarySort}${secondarySort} | ${filesSort}`;
        
        return new CodeAnalysisTreeItem(
            'Files by Language Sorting',
            vscode.TreeItemCollapsibleState.Collapsed,
            'subsection',
            undefined,
            new vscode.ThemeIcon('list-filter'), // Changed to list-filter icon as requested
            description,
            'Configure sorting for Files by Language section',
            'filesByLanguageSortingSetting'
        );
    }

    /**
     * Get children items (sorting options)
     */
    async getChildren(): Promise<CodeAnalysisTreeItem[]> {
        console.log('FILES_BY_LANGUAGE_SORTING: Getting children');
        
        const children: CodeAnalysisTreeItem[] = [];
        const currentConfig = await this.storage.getFilesByLanguageSorting();

        // Language Groups Primary Sorting
        children.push(new CodeAnalysisTreeItem(
            `Language Groups Primary: ${currentConfig.languageGroupSortBy} (${currentConfig.languageGroupSortDirection})`,
            vscode.TreeItemCollapsibleState.None,
            'subsection',
            {
                command: 'codeXR.analysis.selectLanguageGroupPrimarySorting',
                title: 'Select Language Group Primary Sorting',
                arguments: []
            },
            new vscode.ThemeIcon('menu'), // Changed to menu icon as requested
            'Primary sorting for language groups',
            'Click to change primary sorting for language groups',
            'languageGroupPrimarySorting'
        ));

        // Language Groups Secondary Sorting
        const secondaryLabel = currentConfig.languageGroupSecondarySortBy ? 
            `${currentConfig.languageGroupSecondarySortBy} (${currentConfig.languageGroupSecondarySortDirection})` : 
            'None';
        
        children.push(new CodeAnalysisTreeItem(
            `Language Groups Secondary: ${secondaryLabel}`,
            vscode.TreeItemCollapsibleState.None,
            'subsection',
            {
                command: 'codeXR.analysis.selectLanguageGroupSecondarySorting',
                title: 'Select Language Group Secondary Sorting',
                arguments: []
            },
            new vscode.ThemeIcon('menu'), // Changed to menu icon as requested
            'Secondary sorting for language groups',
            'Click to change secondary sorting for language groups',
            'languageGroupSecondarySorting'
        ));

        // Files Sorting
        children.push(new CodeAnalysisTreeItem(
            `Files: ${currentConfig.filesSortBy} (${currentConfig.filesSortDirection})`,
            vscode.TreeItemCollapsibleState.None,
            'subsection',
            {
                command: 'codeXR.analysis.selectFilesSorting',
                title: 'Select Files Sorting',
                arguments: []
            },
            new vscode.ThemeIcon('file-text'),
            'Sorting for files within language groups',
            'Click to change file sorting within language groups',
            'filesSorting'
        ));

        console.log(`FILES_BY_LANGUAGE_SORTING: Generated ${children.length} sorting options`);
        return children;
    }

    /**
     * Update language group primary sorting
     */
    async updateLanguageGroupPrimarySorting(sortBy: LanguageGroupSortBy, direction: LanguageGroupSortDirection): Promise<void> {
        const currentConfig = await this.storage.getFilesByLanguageSorting();
        const updatedConfig: FilesByLanguageSortingConfig = {
            ...currentConfig,
            languageGroupSortBy: sortBy,
            languageGroupSortDirection: direction
        };
        await this.storage.setFilesByLanguageSorting(updatedConfig);
    }

    /**
     * Update language group secondary sorting
     */
    async updateLanguageGroupSecondarySorting(sortBy?: LanguageGroupSortBy, direction?: LanguageGroupSortDirection): Promise<void> {
        const currentConfig = await this.storage.getFilesByLanguageSorting();
        const updatedConfig: FilesByLanguageSortingConfig = {
            ...currentConfig,
            languageGroupSecondarySortBy: sortBy,
            languageGroupSecondarySortDirection: direction
        };
        await this.storage.setFilesByLanguageSorting(updatedConfig);
    }

    /**
     * Update files sorting
     */
    async updateFilesSorting(sortBy: FilesSortBy, direction: FilesSortDirection): Promise<void> {
        const currentConfig = await this.storage.getFilesByLanguageSorting();
        const updatedConfig: FilesByLanguageSortingConfig = {
            ...currentConfig,
            filesSortBy: sortBy,
            filesSortDirection: direction
        };
        await this.storage.setFilesByLanguageSorting(updatedConfig);
    }
}

