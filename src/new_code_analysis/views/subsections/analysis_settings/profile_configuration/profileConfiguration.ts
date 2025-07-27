/**
 * Profile Configuration Setting
 * Manages saving, loading, and resetting analysis configuration profiles
 */

import * as vscode from 'vscode';
import { NewCodeAnalysisTreeItem } from '../../../items/newCodeAnalysisItems';
import { AnalysisConfigurationStorage } from '../../../../configuration/analysisConfigurationStorage';

export class ProfileConfigurationSetting {

    constructor(
        private context: vscode.ExtensionContext,
        private storage: AnalysisConfigurationStorage
    ) {
        console.log('PROFILE_CONFIGURATION: Initializing Profile Configuration setting');
    }

    /**
     * Get the setting item (collapsible)
     */
    async getSettingItem(): Promise<NewCodeAnalysisTreeItem> {
        console.log('PROFILE_CONFIGURATION: Creating profile configuration setting item');
        
        return new NewCodeAnalysisTreeItem(
            'Profile Configuration',
            vscode.TreeItemCollapsibleState.Collapsed,
            'subsection',
            undefined,
            new vscode.ThemeIcon('account', new vscode.ThemeColor('charts.blue')),
            'Manage analysis configuration profiles',
            'Save, load, reset, and delete configuration profiles',
            'profileConfigurationSetting'
        );
    }

    /**
     * Get children items for Profile Configuration
     */
    async getChildren(): Promise<NewCodeAnalysisTreeItem[]> {
        console.log('PROFILE_CONFIGURATION: Getting Profile Configuration children');
        
        const children: NewCodeAnalysisTreeItem[] = [];

        // Reset to Defaults
        children.push(new NewCodeAnalysisTreeItem(
            'Reset to Defaults',
            vscode.TreeItemCollapsibleState.None,
            'subsection',
            {
                command: 'newCodeAnalysis.resetToDefaults',
                title: 'Reset to Default Values',
                arguments: []
            },
            new vscode.ThemeIcon('debug-restart', new vscode.ThemeColor('charts.red')),
            'Reset all analysis settings to default values',
            'Restore factory defaults',
            'resetToDefaults'
        ));

        // Save Profile
        children.push(new NewCodeAnalysisTreeItem(
            'Save Profile',
            vscode.TreeItemCollapsibleState.None,
            'subsection',
            {
                command: 'newCodeAnalysis.saveProfile',
                title: 'Save Current Configuration as Profile',
                arguments: []
            },
            new vscode.ThemeIcon('save', new vscode.ThemeColor('charts.green')),
            'Save current configuration as a named profile',
            'Create new profile',
            'saveProfile'
        ));

        // Load Profile
        children.push(new NewCodeAnalysisTreeItem(
            'Load Profile',
            vscode.TreeItemCollapsibleState.None,
            'subsection',
            {
                command: 'newCodeAnalysis.loadProfile',
                title: 'Load Configuration Profile',
                arguments: []
            },
            new vscode.ThemeIcon('folder-opened', new vscode.ThemeColor('charts.blue')),
            'Load a previously saved configuration profile',
            'Restore saved profile',
            'loadProfile'
        ));

        // Delete Profile
        children.push(new NewCodeAnalysisTreeItem(
            'Delete Profile',
            vscode.TreeItemCollapsibleState.None,
            'subsection',
            {
                command: 'newCodeAnalysis.deleteProfile',
                title: 'Delete Configuration Profile',
                arguments: []
            },
            new vscode.ThemeIcon('trash', new vscode.ThemeColor('charts.red')),
            'Delete a previously saved configuration profile',
            'Remove saved profile',
            'deleteProfile'
        ));

        console.log(`PROFILE_CONFIGURATION: Created ${children.length} profile configuration items`);
        return children;
    }

    /**
     * Get default configuration values
     */
    getDefaultConfiguration(): any {
        return {
            analysisFileMode: 'XR',
            analysisDirectoryMode: 'XR', 
            viewTheme: 'Dark', // Default theme
            chartTypeFile: 'boats',
            chartTypeDirectory: 'boats',
            dimensionMappingFile: {
                area: 'parameters',
                height: 'lineCount',
                color: 'complexity'
            },
            dimensionMappingDirectory: {
                area: 'functionCount',
                height: 'totalLines',
                color: 'meanComplexity'
            },
            autoAnalysisDelay: {
                type: '3s',
                customMs: undefined
            },
            filesByLanguageSorting: {
                languageGroupSortBy: 'alphabetical',
                languageGroupSortDirection: 'ascending',
                filesSortBy: 'alphabetical',
                filesSortDirection: 'ascending'
            }
        };
    }

    /**
     * Detect user's VS Code theme
     */
    private detectVSCodeTheme(): 'light' | 'dark' | 'auto' {
        const colorTheme = vscode.window.activeColorTheme;
        if (colorTheme.kind === vscode.ColorThemeKind.Light) {
            return 'light';
        } else if (colorTheme.kind === vscode.ColorThemeKind.Dark || colorTheme.kind === vscode.ColorThemeKind.HighContrast) {
            return 'dark';
        }
        return 'dark'; // Default fallback
    }

    /**
     * Reset configuration to defaults
     */
    async resetToDefaults(): Promise<void> {
        console.log('PROFILE_CONFIGURATION: Resetting to default values');
        
        try {
            const defaults = this.getDefaultConfiguration();
            
            // Always use Dark theme as default
            defaults.viewTheme = 'Dark';
            
            // Apply all default values
            await this.storage.setAnalysisFileMode(defaults.analysisFileMode);
            await this.storage.setAnalysisDirectoryMode(defaults.analysisDirectoryMode);
            await this.storage.setViewTheme(defaults.viewTheme);
            await this.storage.setChartTypeFile(defaults.chartTypeFile);
            await this.storage.setDirectoryChartType(defaults.chartTypeDirectory);
            await this.storage.setDimensionMappingFile(defaults.dimensionMappingFile);
            await this.storage.setDimensionMappingDirectory(defaults.dimensionMappingDirectory);
            await this.storage.setAutoAnalysisDelay(defaults.autoAnalysisDelay);
            await this.storage.setFilesByLanguageSorting(defaults.filesByLanguageSorting);
            
            console.log('PROFILE_CONFIGURATION: Successfully reset to defaults:', defaults);
            vscode.window.showInformationMessage('Analysis settings reset to default values');
            
        } catch (error) {
            console.error('PROFILE_CONFIGURATION: Error resetting to defaults:', error);
            vscode.window.showErrorMessage(`Failed to reset to defaults: ${error}`);
            throw error;
        }
    }
}
