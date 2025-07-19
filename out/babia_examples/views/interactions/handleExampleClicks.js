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
exports.ExampleClickHandler = void 0;
const vscode = __importStar(require("vscode"));
const exampleLauncher_1 = require("../../runtime/exampleLauncher");
/**
 * Handle Example Clicks
 * Manages user interactions with Babia examples in the tree view
 */
class ExampleClickHandler {
    exampleLauncher;
    constructor(context) {
        this.exampleLauncher = new exampleLauncher_1.ExampleLauncher(context);
        console.log('EXAMPLES: Example click handler initialized');
    }
    /**
     * Handle click on an example to launch it
     * @param example The example to launch
     */
    async handleExampleClick(example) {
        console.log(`EXAMPLES: User clicked on example "${example.name}"`);
        try {
            if (!example.isValid) {
                await this.handleInvalidExample(example);
                return;
            }
            // Show launching message
            const launchingMessage = vscode.window.setStatusBarMessage(`$(loading~spin) Launching Babia example "${example.name}"...`);
            try {
                const result = await this.exampleLauncher.launchExample(example);
                if (result.success) {
                    console.log(`EXAMPLES: Successfully launched "${example.name}" on port ${result.port}`);
                }
                else {
                    console.error(`EXAMPLES: Failed to launch "${example.name}":`, result.error);
                }
            }
            finally {
                launchingMessage.dispose();
            }
        }
        catch (error) {
            const errorMsg = `Failed to handle example click: ${error instanceof Error ? error.message : String(error)}`;
            console.error('EXAMPLES:', errorMsg);
            vscode.window.showErrorMessage(errorMsg);
        }
    }
    /**
     * Handle click on invalid example
     * @private
     */
    async handleInvalidExample(example) {
        console.log(`EXAMPLES: User clicked on invalid example "${example.name}"`);
        const action = await vscode.window.showWarningMessage(`Example "${example.name}" is not valid and cannot be launched.`, 'Show Details', 'Rescan Examples');
        switch (action) {
            case 'Show Details':
                await this.showExampleDetails(example);
                break;
            case 'Rescan Examples':
                await this.rescanExamples();
                break;
        }
    }
    /**
     * Show example details
     * @private
     */
    async showExampleDetails(example) {
        const details = [
            `Example: ${example.name}`,
            `Category: ${example.category}`,
            `Directory: ${example.directory}`,
            `HTML File: ${example.htmlFilePath || 'Not found'}`,
            `Valid: ${example.isValid ? 'Yes' : 'No'}`,
            ''
        ];
        if (example.description) {
            details.push(`Description: ${example.description}`);
        }
        if (!example.isValid) {
            details.push('Issues:');
            details.push('- No valid HTML file found in the example directory');
        }
        const content = details.join('\\n');
        // Create and show a new untitled document with the details
        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'plaintext'
        });
        await vscode.window.showTextDocument(doc);
    }
    /**
     * Rescan examples
     * @private
     */
    async rescanExamples() {
        console.log('EXAMPLES: User requested example rescan');
        const scanning = vscode.window.setStatusBarMessage('$(loading~spin) Scanning Babia examples...');
        try {
            const result = await this.exampleLauncher.scanExamples();
            console.log(`EXAMPLES: Rescan complete. Found ${result.validCount} valid, ${result.invalidCount} invalid examples`);
            // Refresh the tree view
            vscode.commands.executeCommand('codeXR.babiaExamples.refresh');
            // Show result message
            if (result.errors.length > 0) {
                vscode.window.showWarningMessage(`Rescan complete: ${result.validCount} valid, ${result.invalidCount} invalid examples. ${result.errors.length} errors occurred.`);
            }
            else {
                vscode.window.showInformationMessage(`Rescan complete: Found ${result.validCount} valid and ${result.invalidCount} invalid examples.`);
            }
        }
        catch (error) {
            console.error('EXAMPLES: Error during rescan:', error);
            vscode.window.showErrorMessage(`Failed to rescan examples: ${error instanceof Error ? error.message : String(error)}`);
        }
        finally {
            scanning.dispose();
        }
    }
    /**
     * Get the example launcher instance
     */
    getExampleLauncher() {
        return this.exampleLauncher;
    }
    /**
     * Cleanup method
     */
    async cleanup() {
        console.log('EXAMPLES: Cleaning up example click handler...');
        await this.exampleLauncher.cleanup();
    }
}
exports.ExampleClickHandler = ExampleClickHandler;
//# sourceMappingURL=handleExampleClicks.js.map