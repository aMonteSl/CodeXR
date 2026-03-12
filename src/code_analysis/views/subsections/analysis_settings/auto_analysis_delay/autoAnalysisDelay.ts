/**
 * Debounce Time Setting Item
 * Manages the debounce time configuration with predefined and custom values
 */

import * as vscode from 'vscode';
import { CodeAnalysisTreeItem } from '../../../items/analysisItems';
import { AnalysisConfigurationStorage, AutoAnalysisDelayConfig, AutoAnalysisDelay } from '../../../../configuration';

export { AutoAnalysisDelayConfig, AutoAnalysisDelay } from '../../../../configuration';

export class AutoAnalysisDelaySetting {
    private currentDelayConfig: AutoAnalysisDelayConfig = { type: 'RealTime', autoAnalysisEnabled: true };
    private storage: AnalysisConfigurationStorage;

    // Predefined delay options with their millisecond values
    private readonly PREDEFINED_DELAYS = {
        'RealTime': 0,
        '1s': 1000,
        '3s': 3000,
        '5s': 5000,
        '10s': 10000
    };

    constructor(private context: vscode.ExtensionContext) {
        this.storage = AnalysisConfigurationStorage.getInstance(context);
        this.loadSavedDelay();
    }

    /**
     * Get the tree item for this setting
     */
    async getSettingItem(): Promise<CodeAnalysisTreeItem> {
        // Always get the current value from storage to ensure it's up to date
        const currentDelay = await this.storage.getAutoAnalysisDelay();
        const delayDisplayText = this.getDelayDisplayText(currentDelay);
        
        const delayText = `Debounce Time: ${delayDisplayText}`;
        const iconPath = this.getDelayIcon(currentDelay);

        return new CodeAnalysisTreeItem(
            delayText,
            vscode.TreeItemCollapsibleState.None,
            'analysis-result',
            {
                command: 'codeXR.analysis.selectAutoAnalysisDelay',
                title: 'Select Debounce Time',
                arguments: []
            },
            iconPath,
            `Click to select delay between code changes and analysis trigger. Current: ${delayDisplayText}`,
            delayDisplayText,
            'autoAnalysisDelaySetting'
        );
    }

    /**
     * Get display text for current delay
     */
    private getDelayDisplayText(delayConfig?: AutoAnalysisDelayConfig): string {
        const configToUse = delayConfig || this.currentDelayConfig;
        if (configToUse.type === 'Custom') {
            const ms = configToUse.customMs || 0;
            return `Custom: ${ms}ms`;
        }
        return configToUse.type;
    }

    /**
     * Get appropriate icon for current delay
     */
    private getDelayIcon(delayConfig?: AutoAnalysisDelayConfig): vscode.ThemeIcon {
        const configToUse = delayConfig || this.currentDelayConfig;
        if (configToUse.type === 'RealTime') {
            return new vscode.ThemeIcon('zap', new vscode.ThemeColor('charts.green'));
        } else if (configToUse.type === 'Custom') {
            return new vscode.ThemeIcon('settings', new vscode.ThemeColor('charts.purple'));
        } else {
            return new vscode.ThemeIcon('clock', new vscode.ThemeColor('charts.blue'));
        }
    }

    /**
     * Cycle through predefined delay options
     */
    async cycleDelay(): Promise<AutoAnalysisDelayConfig> {
        const predefinedOptions: AutoAnalysisDelay[] = ['RealTime', '1s', '3s', '5s', '10s'];
        const currentIndex = predefinedOptions.indexOf(this.currentDelayConfig.type);
        
        let nextIndex: number;
        if (currentIndex === -1 || currentIndex === predefinedOptions.length - 1) {
            nextIndex = 0; // If custom or last option, go to first
        } else {
            nextIndex = currentIndex + 1;
        }
        
        this.currentDelayConfig = {
            type: predefinedOptions[nextIndex],
            customMs: undefined,
            autoAnalysisEnabled: this.currentDelayConfig.autoAnalysisEnabled
        };
        
        console.log(`ANALYSIS: Auto-analysis delay cycled to ${this.currentDelayConfig.type}`);
        
        await this.saveDelayToSettings();
        
        return this.currentDelayConfig;
    }

    /**
     * Set custom delay in milliseconds
     */
    async setCustomDelay(milliseconds: number): Promise<AutoAnalysisDelayConfig> {
        // Validate range (0-20000ms)
        const clampedMs = Math.max(0, Math.min(20000, milliseconds));
        
        this.currentDelayConfig = {
            type: 'Custom',
            customMs: clampedMs,
            autoAnalysisEnabled: this.currentDelayConfig.autoAnalysisEnabled
        };
        
        console.log(`ANALYSIS: Auto-analysis delay set to custom ${clampedMs}ms`);
        
        await this.saveDelayToSettings();
        
        return this.currentDelayConfig;
    }

    /**
     * Get current delay configuration
     */
    getCurrentDelayConfig(): AutoAnalysisDelayConfig {
        return this.currentDelayConfig;
    }

    /**
     * Get current delay in milliseconds
     */
    getCurrentDelayMs(): number {
        if (this.currentDelayConfig.type === 'Custom') {
            return this.currentDelayConfig.customMs || 0;
        }
        return this.PREDEFINED_DELAYS[this.currentDelayConfig.type] || 0;
    }

    /**
     * Set specific predefined delay
     */
    async setDelay(delayType: AutoAnalysisDelay): Promise<void> {
        this.currentDelayConfig = {
            type: delayType,
            customMs: delayType === 'Custom' ? this.currentDelayConfig.customMs : undefined,
            autoAnalysisEnabled: this.currentDelayConfig.autoAnalysisEnabled
        };
        await this.saveDelayToSettings();
    }

    /**
     * Load saved delay from globalStorage
     */
    private async loadSavedDelay(): Promise<void> {
        try {
            const savedDelay = await this.storage.getAutoAnalysisDelay();
            this.currentDelayConfig = savedDelay;
            console.log(`ANALYSIS: Loaded auto-analysis delay from storage:`, savedDelay);
        } catch (error) {
            console.error('ANALYSIS: Error loading saved delay, using default:', error);
            this.currentDelayConfig = { type: 'RealTime', autoAnalysisEnabled: true }; // Fallback to default
        }
    }

    /**
     * Save delay to globalStorage
     */
    private async saveDelayToSettings(): Promise<void> {
        try {
            await this.storage.setAutoAnalysisDelay(this.currentDelayConfig);
            console.log(`ANALYSIS: Saved auto-analysis delay to storage:`, this.currentDelayConfig);
        } catch (error) {
            console.error('ANALYSIS: Error saving delay to storage:', error);
        }
    }
}

