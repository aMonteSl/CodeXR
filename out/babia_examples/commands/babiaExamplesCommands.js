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
exports.BabiaExamplesCommands = void 0;
const vscode = __importStar(require("vscode"));
const handleExampleClicks_1 = require("../views/interactions/handleExampleClicks");
/**
 * Babia Examples Commands
 * VS Code command definitions for Babia examples functionality
 */
class BabiaExamplesCommands {
    /**
     * Register all Babia examples commands
     */
    static registerCommands(context, treeDataProvider) {
        console.log('EXAMPLES: Registering Babia examples commands...');
        // Initialize the click handler
        const clickHandler = new handleExampleClicks_1.ExampleClickHandler(context);
        // Command: Launch example
        const launchExampleCmd = vscode.commands.registerCommand('codeXR.babiaExamples.launchExample', async (example) => {
            try {
                console.log(`EXAMPLES: Launch command triggered for "${example.name}"`);
                await clickHandler.handleExampleClick(example);
            }
            catch (error) {
                console.error('EXAMPLES: Error in launch command:', error);
                vscode.window.showErrorMessage(`Failed to launch example: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Command: Refresh examples (only register if tree data provider is available)
        if (treeDataProvider) {
            const refreshExamplesCmd = vscode.commands.registerCommand('codeXR.babiaExamples.refresh', async () => {
                try {
                    console.log('EXAMPLES: Refresh command triggered');
                    await treeDataProvider.rescan();
                    vscode.window.showInformationMessage('Babia examples refreshed');
                }
                catch (error) {
                    console.error('EXAMPLES: Error in refresh command:', error);
                    vscode.window.showErrorMessage(`Failed to refresh examples: ${error instanceof Error ? error.message : String(error)}`);
                }
            });
            context.subscriptions.push(refreshExamplesCmd);
        }
        // Command: Open examples folder
        const openExamplesFolderCmd = vscode.commands.registerCommand('codeXR.babiaExamples.openFolder', async () => {
            try {
                console.log('EXAMPLES: Open folder command triggered');
                const workspaceRoots = vscode.workspace.workspaceFolders;
                if (!workspaceRoots || workspaceRoots.length === 0) {
                    vscode.window.showWarningMessage('No workspace folder is open');
                    return;
                }
                const examplesPath = vscode.Uri.joinPath(workspaceRoots[0].uri, 'examples', 'charts');
                await vscode.commands.executeCommand('vscode.openFolder', examplesPath, { forceNewWindow: false });
            }
            catch (error) {
                console.error('EXAMPLES: Error in open folder command:', error);
                vscode.window.showErrorMessage(`Failed to open examples folder: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Command: Show example details
        const showExampleDetailsCmd = vscode.commands.registerCommand('codeXR.babiaExamples.showDetails', async (example) => {
            try {
                console.log(`EXAMPLES: Show details command triggered for "${example.name}"`);
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
                if (example.isValid) {
                    details.push('- Click the example in the tree to launch it');
                }
                else {
                    details.push('- Fix the HTML file issue to make this example launchable');
                }
                const content = details.join('\\n');
                // Create and show a new untitled document with the details
                const doc = await vscode.workspace.openTextDocument({
                    content: content,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc);
            }
            catch (error) {
                console.error('EXAMPLES: Error in show details command:', error);
                vscode.window.showErrorMessage(`Failed to show example details: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Command: Open examples view
        const openExamplesViewCmd = vscode.commands.registerCommand('codeXR.babiaExamples.openView', async () => {
            try {
                console.log('EXAMPLES: Open view command triggered');
                await vscode.commands.executeCommand('codeXR.babiaExamplesView.focus');
            }
            catch (error) {
                console.error('EXAMPLES: Error in open view command:', error);
                // Don't show error message for this, it's likely the view isn't registered yet
            }
        });
        // Register commands that don't require tree data provider
        const commandsToRegister = [
            launchExampleCmd,
            openExamplesFolderCmd,
            showExampleDetailsCmd,
            openExamplesViewCmd
        ];
        // Register all commands with the extension context
        context.subscriptions.push(...commandsToRegister);
        // Store click handler for cleanup
        context.subscriptions.push({
            dispose: () => clickHandler.cleanup()
        });
        console.log(`EXAMPLES: Registered ${commandsToRegister.length} Babia examples commands`);
    }
}
exports.BabiaExamplesCommands = BabiaExamplesCommands;
//# sourceMappingURL=babiaExamplesCommands.js.map