/**
 import * as vscode from 'vscode';
import { NewCodeAnalysisTreeItem } from '../../items/newCodeAnalysisItems';
import { AnalysisFileSetting } from './analysis_file_mode/analysisFileMode';
import { ViewThemeSetting } from './view_theme';
import { AutoAnalysisDelaySetting } from './auto_analysis_delay';lysis Settings Subsection Provider
 * Manages the Analysis Settings subsection of New Code Analysis
 */

import * as vscode from 'vscode';
import { NewCodeAnalysisTreeItem } from '../../items/newCodeAnalysisItems';
import { AnalysisFileSetting } from './analysis_file_mode';
import { ViewThemeSetting } from './view_theme';
import { AutoAnalysisDelaySetting } from './auto_analysis_delay';

export class AnalysisSettingsSubsectionProvider {
    private analysisFileSetting: AnalysisFileSetting;
    private viewThemeSetting: ViewThemeSetting;
    private autoAnalysisDelaySetting: AutoAnalysisDelaySetting;
    
    constructor(private context: vscode.ExtensionContext) {
        console.log('NEW_CODE_ANALYSIS: Initializing Analysis Settings subsection provider');
        
        // Initialize setting components
        this.analysisFileSetting = new AnalysisFileSetting(context);
        this.viewThemeSetting = new ViewThemeSetting(context);
        this.autoAnalysisDelaySetting = new AutoAnalysisDelaySetting(context);
    }

    /**
     * Get the subsection header item
     */
    getSubsectionItem(): NewCodeAnalysisTreeItem {
        return new NewCodeAnalysisTreeItem(
            'Analysis Settings',
            vscode.TreeItemCollapsibleState.Collapsed,
            'subsection',
            undefined,
            new vscode.ThemeIcon('settings-gear'),
            'Configuration settings for analysis processes - File mode, theme, and timing',
            undefined,
            'analysisSettingsSubsection'
        );
    }

    /**
     * Get children for this subsection
     */
    async getChildren(): Promise<NewCodeAnalysisTreeItem[]> {
        return [
            // Analysis File Mode setting
            await this.analysisFileSetting.getSettingItem(),
            
            // View Theme setting  
            await this.viewThemeSetting.getSettingItem(),
            
            // Auto-Analysis Delay setting
            await this.autoAnalysisDelaySetting.getSettingItem()
        ];
    }

    /**
     * Get the analysis file setting instance (for command registration)
     */
    getAnalysisFileSetting(): AnalysisFileSetting {
        return this.analysisFileSetting;
    }

    /**
     * Get the view theme setting instance (for command registration)
     */
    getViewThemeSetting(): ViewThemeSetting {
        return this.viewThemeSetting;
    }

    /**
     * Get the auto-analysis delay setting instance (for command registration)
     */
    getAutoAnalysisDelaySetting(): AutoAnalysisDelaySetting {
        return this.autoAnalysisDelaySetting;
    }

    /**
     * Handle refresh for this subsection
     */
    refresh(): void {
        console.log('NEW_CODE_ANALYSIS: Refreshing Analysis Settings subsection');
        // Settings will be refreshed when tree view refreshes
    }
}
