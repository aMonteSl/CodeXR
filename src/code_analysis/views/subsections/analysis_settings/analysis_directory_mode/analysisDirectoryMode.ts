/**
 * Analysis Directory Setting Item
 * Manages the analysis directory mode (XR/LivePanel) configuration
 */

import * as vscode from 'vscode';
import { CodeAnalysisTreeItem } from '../../../items/analysisItems';
import { AnalysisConfigurationStorage, AnalysisDirectoryMode } from '../../../../configuration';

export { AnalysisDirectoryMode } from '../../../../configuration';

export class AnalysisDirectorySetting {
    private currentMode: AnalysisDirectoryMode = 'XR'; // Default mode (will be loaded from storage)
    private storage: AnalysisConfigurationStorage;

    constructor(private context: vscode.ExtensionContext) {
        console.log('ANALYSIS: Initializing Analysis Directory setting');
        this.storage = AnalysisConfigurationStorage.getInstance(context);
        this.loadSavedMode();
    }

    /**
     * Get the tree item for this setting
     */
    async getSettingItem(): Promise<CodeAnalysisTreeItem> {
        // Always get the current value from storage to ensure it's up to date
        const currentMode = await this.storage.getAnalysisDirectoryMode();
        
        const modeText = this.getModeDisplayText(currentMode);
        const iconPath = this.getModeIcon(currentMode);

        return new CodeAnalysisTreeItem(
            modeText,
            vscode.TreeItemCollapsibleState.None,
            'analysis-result',
            {
                command: 'codeXR.analysis.selectAnalysisDirectoryMode',
                title: 'Select Analysis Directory Mode',
                arguments: []
            },
            iconPath,
            `Click to select directory analysis mode. Current: ${this.getModeDescription(currentMode)}`,
            currentMode,
            'analysisDirectoryModeSetting'
        );
    }

    /**
     * Get mode display text
     */
    private getModeDisplayText(mode: AnalysisDirectoryMode): string {
        switch (mode) {
            case 'XR':
                return 'Analysis Directory with Immersive VR/AR';
            case 'XRDeep':
                return 'Analysis Directory with Deep Immersive VR/AR';
            case 'LivePanel':
                return 'Analysis Directory with Standard Experience';
            case 'LivePanelDeep':
                return 'Analysis Directory with Deep Standard Experience';
            default:
                return 'Analysis Directory with Unknown Mode';
        }
    }

    /**
     * Get mode icon
     */
    private getModeIcon(mode: AnalysisDirectoryMode): vscode.ThemeIcon {
        if (mode.startsWith('LivePanel')) {
            return new vscode.ThemeIcon('folder', new vscode.ThemeColor('charts.green'));
        } else {
            return new vscode.ThemeIcon('vr', new vscode.ThemeColor('charts.purple'));
        }
    }

    /**
     * Get mode description
     */
    private getModeDescription(mode: AnalysisDirectoryMode): string {
        switch (mode) {
            case 'XR':
                return 'Immersive VR/AR experience for directory analysis';
            case 'XRDeep':
                return 'Deep immersive VR/AR experience with recursive directory analysis';
            case 'LivePanel':
                return 'Standard panel for quick directory review';
            case 'LivePanelDeep':
                return 'Deep standard panel with recursive directory analysis';
            default:
                return 'Unknown analysis mode';
        }
    }

    /**
     * Show mode selection picker
     */
    async selectMode(): Promise<AnalysisDirectoryMode | undefined> {
        const options: Array<{ label: string; description: string; mode: AnalysisDirectoryMode; detail: string }> = [
            {
                label: ' LivePanel',
                description: 'Standard Experience',
                mode: 'LivePanel',
                detail: 'Quick directory analysis with standard UI panel'
            },
            {
                label: ' LivePanel Deep',
                description: 'Standard Experience (Recursive)',
                mode: 'LivePanelDeep',
                detail: 'Deep recursive directory analysis with standard UI panel'
            },
            {
                label: ' XR',
                description: 'Immersive VR/AR',
                mode: 'XR',
                detail: 'Immersive VR/AR experience for directory analysis'
            },
            {
                label: ' XR Deep',
                description: 'Immersive VR/AR (Recursive)',
                mode: 'XRDeep',
                detail: 'Deep recursive directory analysis with immersive VR/AR experience'
            }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            title: 'Select Directory Analysis Mode',
            placeHolder: 'Choose how to analyze directories...',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            await this.setMode(selected.mode);
            return selected.mode;
        }

        return undefined;
    }

    /**
     * Get current mode
     */
    async getCurrentMode(): Promise<AnalysisDirectoryMode> {
        return await this.storage.getAnalysisDirectoryMode();
    }

    /**
     * Set mode programmatically
     */
    async setMode(mode: AnalysisDirectoryMode): Promise<void> {
        this.currentMode = mode;
        await this.saveModeToSettings();
        console.log(`ANALYSIS: Analysis directory mode set to ${mode}`);
    }

    /**
     * Load the saved mode from VS Code settings
     */
    private async loadSavedMode(): Promise<void> {
        try {
            this.currentMode = await this.storage.getAnalysisDirectoryMode();
            console.log(`ANALYSIS: Loaded analysis directory mode: ${this.currentMode}`);
        } catch (error) {
            console.error('ANALYSIS: Error loading analysis directory mode:', error);
            // Keep default mode
        }
    }

    /**
     * Save the current mode to VS Code settings
     */
    private async saveModeToSettings(): Promise<void> {
        try {
            await this.storage.setAnalysisDirectoryMode(this.currentMode);
            console.log(`ANALYSIS: Saved analysis directory mode: ${this.currentMode}`);
        } catch (error) {
            console.error('ANALYSIS: Error saving analysis directory mode:', error);
        }
    }
}

/**
 * Command registration interface for the nested dolls pattern
 */
export interface CommandRegistration {
    commandId: string;
    callback: (...args: any[]) => any;
    description?: string;
}

