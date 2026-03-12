import * as vscode from 'vscode';
import { ExtensionCommandRegistration } from '../../commands/shared';

export class LearnMoreCommands {
    static getCommandRegistrations(): ExtensionCommandRegistration[] {
        return [
            {
                id: 'codeXR.learnMore',
                module: 'LEARN_MORE',
                description: 'Open CodeXR documentation',
                handler: () => {
                    LearnMoreCommands.handleLearnMore();
                },
                errorMessage: 'Failed to open CodeXR documentation'
            }
        ];
    }

    private static handleLearnMore(): void {
        const websiteUrl = 'https://amontesl.github.io/code-xr-docs/';

        vscode.window.showInformationMessage(
            'Opening CodeXR Documentation Website...',
            'Open Website'
        ).then(selection => {
            if (selection === 'Open Website') {
                vscode.env.openExternal(vscode.Uri.parse(websiteUrl));
            }
        });

        vscode.env.openExternal(vscode.Uri.parse(websiteUrl));
    }
}
