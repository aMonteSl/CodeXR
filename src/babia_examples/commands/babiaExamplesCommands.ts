import * as vscode from 'vscode';
import { BabiaExample } from '../model/babiaExampleModel';
import { ExampleClickHandler } from '../views/interactions/handleExampleClicks';
import { BabiaExamplesTreeDataProvider } from '../views/babiaExamplesTreeView';
import { ExtensionCommandRegistration } from '../../commands/shared';

/**
 * Babia Examples command declarations.
 */
export class BabiaExamplesCommands {
    public static getCommandRegistrations(
        context: vscode.ExtensionContext,
        treeDataProvider?: BabiaExamplesTreeDataProvider,
    ): ExtensionCommandRegistration[] {
        const clickHandler = new ExampleClickHandler(context);
        context.subscriptions.push({
            dispose: () => clickHandler.cleanup(),
        });

        return [
            {
                id: 'codeXR.babiaExamples.launchExample',
                module: 'EXAMPLES',
                description: 'Launch Babia example',
                handler: async (example: BabiaExample) => {
                    console.log(`EXAMPLES: Launch command triggered for "${example.name}"`);
                    await clickHandler.handleExampleClick(example);
                },
                errorMessage: 'Failed to launch Babia example'
            },
            {
                id: 'codeXR.babiaExamples.refresh',
                module: 'EXAMPLES',
                description: 'Refresh Babia examples',
                handler: async () => {
                    if (!treeDataProvider) {
                        vscode.window.showInformationMessage('Babia examples view is not ready yet.');
                        return;
                    }

                    console.log('EXAMPLES: Refresh command triggered');
                    await treeDataProvider.rescan();
                    vscode.window.showInformationMessage('Babia examples refreshed');
                },
                errorMessage: 'Failed to refresh Babia examples'
            },
            {
                id: 'codeXR.babiaExamples.openFolder',
                module: 'EXAMPLES',
                description: 'Open Babia examples folder',
                handler: async () => {
                    const workspaceRoots = vscode.workspace.workspaceFolders;
                    if (!workspaceRoots || workspaceRoots.length === 0) {
                        vscode.window.showWarningMessage('No workspace folder is open');
                        return;
                    }

                    const examplesPath = vscode.Uri.joinPath(workspaceRoots[0].uri, 'examples', 'charts');
                    await vscode.commands.executeCommand('vscode.openFolder', examplesPath, { forceNewWindow: false });
                },
                errorMessage: 'Failed to open Babia examples folder'
            },
            {
                id: 'codeXR.babiaExamples.showDetails',
                module: 'EXAMPLES',
                description: 'Show Babia example details',
                handler: async (example: BabiaExample) => {
                    const details = [
                        `# Babia Example: ${example.name}`,
                        '',
                        `**Category:** ${example.category}`,
                        `**Valid:** ${example.isValid ? 'Yes' : 'No'}`,
                        `**Directory:** ${example.directory}`,
                        `**HTML File:** ${example.htmlFilePath || 'Not found'}`,
                        ''
                    ];

                    if (example.description) {
                        details.push(`**Description:** ${example.description}`);
                        details.push('');
                    }

                    if (example.lastModified) {
                        const lastModified = new Date(example.lastModified).toLocaleString();
                        details.push(`**Last Modified:** ${lastModified}`);
                        details.push('');
                    }

                    if (!example.isValid) {
                        details.push('## Issues');
                        details.push('- No valid HTML file found in the example directory');
                        details.push('');
                    }

                    details.push('## Actions');
                    details.push(example.isValid
                        ? '- Click the example in the tree to launch it'
                        : '- Fix the HTML file issue to make this example launchable');

                    const doc = await vscode.workspace.openTextDocument({
                        content: details.join('\n'),
                        language: 'markdown'
                    });

                    await vscode.window.showTextDocument(doc);
                },
                errorMessage: 'Failed to show Babia example details'
            },
            {
                id: 'codeXR.babiaExamples.openView',
                module: 'EXAMPLES',
                description: 'Open Babia examples view',
                handler: async () => {
                    try {
                        await vscode.commands.executeCommand('codeXR.babiaExamplesView.focus');
                    } catch (error) {
                        console.error('EXAMPLES: Error in open view command:', error);
                    }
                },
                silentErrors: true,
            }
        ];
    }
}
