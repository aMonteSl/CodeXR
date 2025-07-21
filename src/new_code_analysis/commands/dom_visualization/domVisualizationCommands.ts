/**
 * DOM Visualization Commands
 * Handles commands for visualizing HTML DOM structure
 */

import * as vscode from 'vscode';
import { LaunchVisualizeDOMPanel } from '../../engine';
import { CommandRegistration } from '../subsections/analysis_settings/analysis_file_mode';
import { getFileSystemPathFromEditorOrInput } from '../../../utils/uriPathConverter';

export class DOMVisualizationCommands {
    
    constructor(private context: vscode.ExtensionContext) {
        console.log('DOM_VISUALIZATION_COMMANDS: DOM Visualization commands initialized');
    }

    /**
     * Get command registrations for DOM visualization (nested dolls pattern)
     */
    static getCommandRegistrations(
        context: vscode.ExtensionContext,
        refreshCallback?: () => void
    ): CommandRegistration[] {
        console.log('DOM_VISUALIZATION_COMMANDS: Collecting DOM visualization command registrations');

        const domVisualizationInstance = new DOMVisualizationCommands(context);

        const commandRegistrations: CommandRegistration[] = [
            {
                commandId: 'newCodeAnalysis.visualizeDOM',
                callback: (filePath?: any) => domVisualizationInstance.visualizeDOM(filePath),
                description: 'Visualize HTML DOM structure'
            }
        ];

        console.log(`DOM_VISUALIZATION_COMMANDS: Collected ${commandRegistrations.length} command registrations`);
        return commandRegistrations;
    }

    /**
     * Handle DOM visualization command for HTML files
     */
    async visualizeDOM(filePath?: any): Promise<void> {
        try {
            console.log('DOM_VISUALIZATION_COMMANDS: DOM visualization requested');
            console.log('DOM_VISUALIZATION_COMMANDS: Input type:', typeof filePath, 'Input value:', filePath);
            
            // Convert input to file system path using utility
            const fsPath = getFileSystemPathFromEditorOrInput(filePath);
            
            if (!fsPath) {
                vscode.window.showErrorMessage('No HTML file selected or file path could not be determined');
                return;
            }

            console.log(`DOM_VISUALIZATION_COMMANDS: File system path: ${fsPath}`);

            // Validate file is HTML
            if (!LaunchVisualizeDOMPanel.canVisualizeFile(fsPath)) {
                vscode.window.showWarningMessage(
                    `File "${fsPath}" is not a supported HTML file for DOM visualization`
                );
                return;
            }

            console.log(`DOM_VISUALIZATION_COMMANDS: Starting DOM visualization for: ${fsPath}`);

            // Launch DOM visualization
            await LaunchVisualizeDOMPanel.visualizeDOM(fsPath, this.context);

        } catch (error) {
            console.error('DOM_VISUALIZATION_COMMANDS: Error visualizing DOM:', error);
            vscode.window.showErrorMessage(
                `Failed to visualize DOM: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Show available DOM visualization options
     */
    async showDOMVisualizationOptions(): Promise<void> {
        const options = [
            {
                label: '$(browser) DOM Structure Tree',
                description: 'Visualize HTML DOM as an interactive tree structure',
                command: 'tree'
            },
            {
                label: '$(graph) DOM Hierarchy Graph',
                description: 'Show DOM elements and their relationships as a graph',
                command: 'graph'
            },
            {
                label: '$(pie-chart) DOM Element Statistics',
                description: 'Analyze DOM element distribution and usage',
                command: 'stats'
            }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select DOM visualization type',
            canPickMany: false
        });

        if (selected) {
            console.log(`DOM_VISUALIZATION_COMMANDS: Selected visualization type: ${selected.command}`);
            // TODO: Implement different visualization types
            vscode.window.showInformationMessage(`DOM ${selected.command} visualization will be implemented soon!`);
        }
    }
}
