"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeAnalysisInteractionHandler = void 0;
const vscode = __importStar(require("vscode"));
const analysisSettingsStorage_1 = require("../../../utils/analysisSettingsStorage");
/**
 * Handle clicks and interactions for Code Analysis tree items
 */
class CodeAnalysisInteractionHandler {
    /**
     * Handle main section clicks
     */
    static handleSectionClick(sectionType, context) {
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
                }
                else {
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
    static handlePlaceholderClick(placeholderType) {
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
    static async handleFileClick(filePath, context) {
        console.log(`ANALYSIS: File clicked: ${filePath}`);
        try {
            // Get current analysis mode
            const currentMode = await analysisSettingsStorage_1.AnalysisSettingsStorage.getCurrentAnalysisMode(context);
            console.log(`[CODE_ANALYSIS] Using analysis mode: ${currentMode}`);
            // Create URI from file path
            const fileUri = vscode.Uri.file(filePath);
            // Execute the appropriate analysis command based on current mode
            if (currentMode === 'XR') {
                await vscode.commands.executeCommand('codexr.analysis.fileXR', fileUri);
            }
            else {
                await vscode.commands.executeCommand('codexr.analysis.fileStatic', fileUri);
            }
        }
        catch (error) {
            console.error('[CODE_ANALYSIS] Error handling file click:', error);
            vscode.window.showErrorMessage('Failed to analyze file');
        }
    }
    /**
     * Show analysis settings menu with all options
     */
    static async showAnalysisSettingsMenu(context) {
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
    static async handleAnalysisModeSelection(context) {
        const items = [
            { label: 'XR Analysis Mode', value: 'XR' },
            { label: 'Static Analysis Mode', value: 'Static' }
        ];
        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select analysis mode'
        });
        if (selection) {
            await analysisSettingsStorage_1.AnalysisSettingsStorage.setAnalysisMode(context, selection.value);
        }
    }
    /**
     * Handle theme selection
     */
    static async handleThemeSelection(context) {
        const items = [
            { label: 'Light Theme', value: 'light' },
            { label: 'Dark Theme', value: 'dark' }
        ];
        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select theme'
        });
        if (selection) {
            await analysisSettingsStorage_1.AnalysisSettingsStorage.setTheme(context, selection.value);
        }
    }
    /**
     * Handle auto-analysis delay selection
     */
    static async handleAutoAnalysisDelaySelection(context) {
        const options = analysisSettingsStorage_1.AnalysisSettingsStorage.getAutoAnalysisDelayOptions();
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
                    await analysisSettingsStorage_1.AnalysisSettingsStorage.setAutoAnalysisDelay(context, customDelay);
                }
            }
            else {
                await analysisSettingsStorage_1.AnalysisSettingsStorage.setAutoAnalysisDelay(context, selection.value);
            }
        }
    }
}
exports.CodeAnalysisInteractionHandler = CodeAnalysisInteractionHandler;
//# sourceMappingURL=handleAnalysisClicks.js.map