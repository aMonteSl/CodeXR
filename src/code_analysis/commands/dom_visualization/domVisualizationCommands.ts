/**
 * DOM Visualization Commands
 * Handles commands for visualizing HTML DOM structure.
 */

import * as vscode from 'vscode';
import { AnalysisOrchestrator } from '../../engine/analysisOrchestrator';
import { LauncherVisualizeDOM } from '../../engine/launchers/launcherVisualizeDOM';
import { CommandRegistration } from '../subsections/analysis_settings/analysis_file_mode';
import { getFileSystemPathFromEditorOrInput } from '../../../utils/uriPathConverter';

export class DOMVisualizationCommands {
    constructor(private context: vscode.ExtensionContext) {}

    static getCommandRegistrations(
        context: vscode.ExtensionContext,
        _refreshCallback?: () => void,
    ): CommandRegistration[] {
        const domVisualizationInstance = new DOMVisualizationCommands(context);
        return [
            {
                commandId: 'codeXR.analysis.visualizeDOM',
                callback: (filePath?: unknown) => domVisualizationInstance.visualizeDOM(filePath),
                description: 'Visualize HTML DOM structure',
                module: 'ANALYSIS',
                errorMessage: 'Failed to visualize HTML DOM structure'
            }
        ];
    }

    async visualizeDOM(filePath?: unknown): Promise<void> {
        try {
            const fsPath = getFileSystemPathFromEditorOrInput(filePath);
            if (!fsPath) {
                vscode.window.showErrorMessage('No HTML file selected or file path could not be determined');
                return;
            }

            if (!LauncherVisualizeDOM.canVisualizeFile(fsPath)) {
                vscode.window.showWarningMessage(`File "${fsPath}" is not a supported HTML file for DOM visualization`);
                return;
            }

            await AnalysisOrchestrator.orchestrateAnalysis(fsPath, 'VisualizeDOM', 'file', this.context, false);
        } catch (error) {
            console.error('DOM_VISUALIZATION_COMMANDS: Error visualizing DOM:', error);
            vscode.window.showErrorMessage(
                `Failed to visualize DOM: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
}

