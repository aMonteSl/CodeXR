import * as vscode from 'vscode';
import { ExtensionCommandRegistration } from '../../commands/shared';

/** Official CodeXR site. */
const CODEXR_WEBSITE_URL = 'https://code-xr.adrianmonteslinares.com/';
/** Personal site of the extension's author. */
const AUTHOR_WEBSITE_URL = 'https://adrianmonteslinares.com/';
const SUPPORT_URL = 'https://buymeacoffee.com/adrianadyrx';

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
            },
            {
                id: 'codeXR.openAuthorWebsite',
                module: 'LEARN_MORE',
                description: 'Open the author website',
                handler: async () => {
                    await vscode.env.openExternal(vscode.Uri.parse(AUTHOR_WEBSITE_URL));
                },
                errorMessage: 'Failed to open the author website'
            },
            {
                id: 'codeXR.supportDeveloper',
                module: 'LEARN_MORE',
                description: 'Support CodeXR development on Buy Me a Coffee',
                handler: () => {
                    LearnMoreCommands.handleSupportDeveloper();
                },
                errorMessage: 'Failed to open Buy Me a Coffee page'
            }
        ];
    }

    private static handleLearnMore(): void {
        const websiteUrl = CODEXR_WEBSITE_URL;

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

    private static handleSupportDeveloper(): void {
        const coffeeUrl = SUPPORT_URL;

        vscode.window.showInformationMessage(
            'Thank you for supporting CodeXR development! Opening Buy Me a Coffee...',
            'Open Page'
        ).then(selection => {
            if (selection === 'Open Page') {
                vscode.env.openExternal(vscode.Uri.parse(coffeeUrl));
            }
        });

        vscode.env.openExternal(vscode.Uri.parse(coffeeUrl));
    }
}
