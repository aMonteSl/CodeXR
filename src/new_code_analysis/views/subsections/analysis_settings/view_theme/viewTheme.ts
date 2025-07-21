/**
 * View Theme Setting Item
 * Manages the analysis view theme (Dark/Light/Auto) configuration
 */

import * as vscode from 'vscode';
import { NewCodeAnalysisTreeItem } from '../../../items/newCodeAnalysisItems';
import { AnalysisConfigurationStorage, ViewTheme } from '../../../../configuration';

export { ViewTheme } from '../../../../configuration';

export class ViewThemeSetting {
    private currentTheme: ViewTheme = 'Dark';
    private storage: AnalysisConfigurationStorage;

    constructor(private context: vscode.ExtensionContext) {
        this.storage = AnalysisConfigurationStorage.getInstance(context);
        this.loadSavedTheme();
    }

    /**
     * Get the tree item for this setting
     */
    async getSettingItem(): Promise<NewCodeAnalysisTreeItem> {
        // Always get the current value from storage to ensure it's up to date
        const currentTheme = await this.storage.getViewTheme();
        
        const themeText = currentTheme === 'Dark' 
            ? 'Visual Theme: Dark Mode'
            : 'Visual Theme: Light Mode';
        const iconPath = this.getThemeIcon(currentTheme);

        return new NewCodeAnalysisTreeItem(
            themeText,
            vscode.TreeItemCollapsibleState.None,
            'analysis-result',
            {
                command: 'newCodeAnalysis.toggleViewTheme',
                title: 'Toggle View Theme',
                arguments: []
            },
            iconPath,
            `Click to switch between dark and light visual themes. Current: ${currentTheme} mode for better ${currentTheme === 'Dark' ? 'night coding' : 'daylight visibility'}`,
            currentTheme,
            'viewThemeSetting'
        );
    }

    /**
     * Get appropriate icon for current theme
     */
    private getThemeIcon(theme?: ViewTheme): vscode.ThemeIcon {
        const themeToUse = theme || this.currentTheme;
        switch (themeToUse) {
            case 'Dark':
                return new vscode.ThemeIcon('color-mode', new vscode.ThemeColor('charts.blue'));
            case 'Light':
                return new vscode.ThemeIcon('color-mode', new vscode.ThemeColor('charts.yellow'));
            default:
                return new vscode.ThemeIcon('color-mode', new vscode.ThemeColor('charts.foreground'));
        }
    }

    /**
     * Toggle between Dark and Light themes
     */
    async toggleTheme(): Promise<ViewTheme> {
        this.currentTheme = this.currentTheme === 'Dark' ? 'Light' : 'Dark';
        
        console.log(`NEW_CODE_ANALYSIS: View theme switched to ${this.currentTheme}`);
        
        await this.saveThemeToSettings();
        
        return this.currentTheme;
    }

    /**
     * Get current theme
     */
    getCurrentTheme(): ViewTheme {
        return this.currentTheme;
    }

    /**
     * Set specific theme
     */
    async setTheme(theme: ViewTheme): Promise<void> {
        this.currentTheme = theme;
        await this.saveThemeToSettings();
    }

    /**
     * Load saved theme from globalStorage
     */
    private async loadSavedTheme(): Promise<void> {
        try {
            const savedTheme = await this.storage.getViewTheme();
            this.currentTheme = savedTheme;
            console.log(`NEW_CODE_ANALYSIS: Loaded view theme from storage: ${this.currentTheme}`);
        } catch (error) {
            console.error('NEW_CODE_ANALYSIS: Error loading saved theme, using default:', error);
            this.currentTheme = 'Dark'; // Fallback to default
        }
    }

    /**
     * Save theme to globalStorage
     */
    private async saveThemeToSettings(): Promise<void> {
        try {
            await this.storage.setViewTheme(this.currentTheme);
            console.log(`NEW_CODE_ANALYSIS: Saved view theme to storage: ${this.currentTheme}`);
        } catch (error) {
            console.error('NEW_CODE_ANALYSIS: Error saving theme to storage:', error);
        }
    }
}
