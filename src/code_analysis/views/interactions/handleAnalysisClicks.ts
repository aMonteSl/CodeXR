import * as vscode from 'vscode';
import { CodeAnalysisTreeItemType } from '../items/analysisTreeItems';
import { AnalysisSettingsStorage, AutoAnalysisDelay, AUTO_ANALYSIS_DELAYS } from '../../../utils/analysisSettingsStorage';

/**
 * Handle clicks and interactions for Code Analysis tree items
 */
export class CodeAnalysisInteractionHandler {
    
    /**
     * Handle main section clicks
     */
    static handleSectionClick(sectionType: CodeAnalysisTreeItemType, context?: vscode.ExtensionContext): void {
        console.log(`[CODE_ANALYSIS] User clicked on ${sectionType}`);
        
        switch (sectionType) {
            case 'active-analyses':
                console.log('[CODE_ANALYSIS] User clicked on Active Analyses');
                vscode.window.showInformationMessage('TODO: Implement Active Analyses view logic');
                break;
                
            case 'analysis-settings':
                console.log('[CODE_ANALYSIS] User clicked on Analysis Settings');
                if (context) {
                    this.showAnalysisSettingsMenu(context);
                } else {
                    vscode.window.showErrorMessage('Extension context not available for settings');
                }
                break;
                
            case 'files-by-language':
                console.log('[CODE_ANALYSIS] User clicked on Files by Language');
                // This will trigger the file scan when the section is expanded
                // No need for a placeholder message anymore
                break;
                
            default:
                console.log(`[CODE_ANALYSIS] Unknown section type: ${sectionType}`);
                vscode.window.showWarningMessage(`Unknown analysis section: ${sectionType}`);
        }
    }
    
    /**
     * Handle placeholder item clicks
     */
    static handlePlaceholderClick(placeholderType: string): void {
        console.log(`[CODE_ANALYSIS] User clicked on placeholder: ${placeholderType}`);
        
        switch (placeholderType) {
            case 'activeAnalyses':
                vscode.window.showInformationMessage('TODO: Implement Active Analyses functionality');
                break;
                
            case 'analysisSettings':
                vscode.window.showInformationMessage('TODO: Implement Analysis Settings functionality');
                break;
                
            case 'filesByLanguage':
                vscode.window.showInformationMessage('TODO: Implement Files by Language functionality');
                break;
                
            default:
                vscode.window.showInformationMessage(`TODO: Implement ${placeholderType} functionality`);
        }
    }

    /**
     * Handle file click - analyzes based on current mode
     */
    static async handleFileClick(filePath: string, context: vscode.ExtensionContext): Promise<void> {
        console.log(`ANALYSIS: File clicked: ${filePath}`);
        
        try {
            // Get current analysis mode
            const currentMode = await AnalysisSettingsStorage.getCurrentAnalysisMode(context);
            console.log(`[CODE_ANALYSIS] Using analysis mode: ${currentMode}`);
            
            // Create URI from file path
            const fileUri = vscode.Uri.file(filePath);
            
            // Execute the appropriate analysis command based on current mode
            if (currentMode === 'XR') {
                await vscode.commands.executeCommand('codexr.analysis.fileXR', fileUri);
            } else {
                await vscode.commands.executeCommand('codexr.analysis.fileStatic', fileUri);
            }
        } catch (error) {
            console.error('[CODE_ANALYSIS] Error handling file click:', error);
            vscode.window.showErrorMessage('Failed to analyze file');
        }
    }

    /**
     * Show analysis settings menu with all options
     */
    static async showAnalysisSettingsMenu(context: vscode.ExtensionContext): Promise<void> {
        const items = [
            {
                label: '$(file) Analysis Mode',
                description: 'Switch between XR and Static analysis modes',
                action: 'analysisMode'
            },
            {
                label: '$(color-mode) Theme',
                description: 'Switch between light and dark themes',
                action: 'theme'
            },
            {
                label: '$(clock) Auto-Analysis Delay',
                description: 'Set delay before re-analyzing changed files',
                action: 'autoAnalysisDelay'
            }
        ];

        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select analysis setting to configure'
        });

        if (selection) {
            switch (selection.action) {
                case 'analysisMode':
                    await this.handleAnalysisModeSelection(context);
                    break;
                case 'theme':
                    await this.handleThemeSelection(context);
                    break;
                case 'autoAnalysisDelay':
                    await this.handleAutoAnalysisDelaySelection(context);
                    break;
            }
        }
    }

    /**
     * Handle analysis mode selection
     */
    static async handleAnalysisModeSelection(context: vscode.ExtensionContext): Promise<void> {
        const items = [
            { label: 'XR Analysis Mode', value: 'XR' as const },
            { label: 'Static Analysis Mode', value: 'Static' as const }
        ];

        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select analysis mode'
        });

        if (selection) {
            await AnalysisSettingsStorage.setAnalysisMode(context, selection.value);
        }
    }

    /**
     * Handle theme selection
     */
    static async handleThemeSelection(context: vscode.ExtensionContext): Promise<void> {
        const items = [
            { label: 'Light Theme', value: 'light' as const },
            { label: 'Dark Theme', value: 'dark' as const }
        ];

        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select theme'
        });

        if (selection) {
            await AnalysisSettingsStorage.setTheme(context, selection.value);
        }
    }

    /**
     * Handle auto-analysis delay selection
     */
    static async handleAutoAnalysisDelaySelection(context: vscode.ExtensionContext): Promise<void> {
        const options = AnalysisSettingsStorage.getAutoAnalysisDelayOptions();
        
        const selection = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select auto-analysis delay'
        });

        if (selection) {
            if (selection.value === -1) {
                // Custom input
                const customInput = await vscode.window.showInputBox({
                    prompt: 'Enter custom delay in milliseconds',
                    placeHolder: 'e.g., 2500',
                    validateInput: (value) => {
                        const num = parseInt(value);
                        if (isNaN(num) || num < 0) {
                            return 'Please enter a valid number (0 or greater)';
                        }
                        return null;
                    }
                });

                if (customInput) {
                    const customDelay = parseInt(customInput);
                    await AnalysisSettingsStorage.setAutoAnalysisDelay(context, customDelay);
                }
            } else {
                await AnalysisSettingsStorage.setAutoAnalysisDelay(context, selection.value);
            }
        }
    }
}
