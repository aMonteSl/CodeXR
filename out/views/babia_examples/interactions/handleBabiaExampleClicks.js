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
exports.BabiaExampleClickHandler = void 0;
const vscode = __importStar(require("vscode"));
const exampleLauncher_1 = require("../../../babia_examples/runtime/exampleLauncher");
/**
 * Handler for Babia Examples section interactions
 */
class BabiaExampleClickHandler {
    context;
    exampleLauncher;
    constructor(context) {
        this.context = context;
        this.exampleLauncher = new exampleLauncher_1.ExampleLauncher(context);
    }
    /**
     * Handle clicks on Babia example items
     */
    async handleBabiaExampleClick(item) {
        console.log(`BABIA_EXAMPLES_MODULAR: Handling click on example item: ${item.label} (type: ${item.babiaItemType})`);
        switch (item.babiaItemType) {
            case 'example-item':
                await this.handleExampleItemClick(item);
                break;
            case 'no-examples':
            case 'loading':
            case 'error':
                // No action needed for informational items
                console.log(`BABIA_EXAMPLES_MODULAR: Clicked on informational item: ${item.babiaItemType}`);
                break;
            default:
                console.warn(`BABIA_EXAMPLES_MODULAR: Unknown example item type: ${item.babiaItemType}`);
        }
    }
    /**
     * Handle click on individual example item
     */
    async handleExampleItemClick(item) {
        if (!item.babiaExample) {
            console.error('BABIA_EXAMPLES_MODULAR: No example data in example item');
            return;
        }
        if (!item.babiaExample.isValid) {
            console.warn('BABIA_EXAMPLES_MODULAR: Attempted to launch invalid example');
            vscode.window.showWarningMessage(`Example "${item.babiaExample.name}" is invalid and cannot be launched.`);
            return;
        }
        console.log(`BABIA_EXAMPLES_MODULAR: Launching example: ${item.babiaExample.id}`);
        try {
            // Use the example launcher to handle the launch
            await this.exampleLauncher.launchExample(item.babiaExample);
            vscode.window.showInformationMessage(`Example "${item.babiaExample.name}" launched successfully!`);
        }
        catch (error) {
            console.error(`BABIA_EXAMPLES_MODULAR: Error launching example ${item.babiaExample.id}:`, error);
            vscode.window.showErrorMessage(`Failed to launch example "${item.babiaExample.name}": ${error}`);
        }
    }
    /**
     * Handle right-click context menu actions
     */
    async handleContextMenuAction(action, item) {
        console.log(`BABIA_EXAMPLES_MODULAR: Handling context menu action: ${action} on item: ${item.label}`);
        switch (action) {
            case 'refresh':
                console.log('BABIA_EXAMPLES_MODULAR: Refreshing examples view');
                // Refresh will be triggered by the provider
                break;
            case 'launchExample':
                if (item.babiaExample && item.babiaExample.isValid) {
                    console.log(`BABIA_EXAMPLES_MODULAR: Launching example from context menu: ${item.babiaExample.id}`);
                    await this.handleExampleItemClick(item);
                }
                break;
            case 'openInBrowser':
                if (item.babiaExample && item.babiaExample.isValid) {
                    console.log(`BABIA_EXAMPLES_MODULAR: Opening example in browser: ${item.babiaExample.id}`);
                    await this.launchExampleInBrowser(item.babiaExample);
                }
                break;
            case 'openInPanel':
                if (item.babiaExample && item.babiaExample.isValid) {
                    console.log(`BABIA_EXAMPLES_MODULAR: Opening example in panel: ${item.babiaExample.id}`);
                    await this.launchExampleInPanel(item.babiaExample);
                }
                break;
            case 'showDetails':
                if (item.babiaExample) {
                    console.log(`BABIA_EXAMPLES_MODULAR: Showing example details: ${item.babiaExample.id}`);
                    await this.showExampleDetails(item.babiaExample);
                }
                break;
            default:
                console.warn(`BABIA_EXAMPLES_MODULAR: Unknown context menu action: ${action}`);
        }
    }
    /**
     * Launch example specifically in browser
     */
    async launchExampleInBrowser(example) {
        try {
            // For now, use the default launcher - future enhancement could support launch mode selection
            await this.exampleLauncher.launchExample(example);
            vscode.window.showInformationMessage(`Example "${example.name}" launched! (Uses current user configuration for launch mode)`);
        }
        catch (error) {
            console.error(`BABIA_EXAMPLES_MODULAR: Error launching example:`, error);
            vscode.window.showErrorMessage(`Failed to launch example: ${error}`);
        }
    }
    /**
     * Launch example specifically in panel
     */
    async launchExampleInPanel(example) {
        try {
            // For now, use the default launcher - future enhancement could support launch mode selection
            await this.exampleLauncher.launchExample(example);
            vscode.window.showInformationMessage(`Example "${example.name}" launched! (Uses current user configuration for launch mode)`);
        }
        catch (error) {
            console.error(`BABIA_EXAMPLES_MODULAR: Error launching example:`, error);
            vscode.window.showErrorMessage(`Failed to launch example: ${error}`);
        }
    }
    /**
     * Show detailed information about an example
     */
    async showExampleDetails(example) {
        const details = `Example Details:
        
Name: ${example.name}
Category: ${example.category}
File: ${example.htmlFilePath}
Directory: ${example.directory}
Valid: ${example.isValid ? 'Yes' : 'No'}
${example.description ? `Description: ${example.description}` : ''}`;
        vscode.window.showInformationMessage(details, { modal: true });
    }
}
exports.BabiaExampleClickHandler = BabiaExampleClickHandler;
//# sourceMappingURL=handleBabiaExampleClicks.js.map