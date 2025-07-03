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
exports.registerTreeDisplayCommands = registerTreeDisplayCommands;
const vscode = __importStar(require("vscode"));
const treeDisplayConfig_1 = require("../../analysis/tree/treeDisplayConfig");
const commandHelpers_1 = require("../shared/commandHelpers");
/**
 * Commands for tree display configuration (sorting, filtering, limits)
 */
/**
 * Registers tree display related commands
 * @param context Extension context
 * @returns Array of disposables for the registered commands
 */
function registerTreeDisplayCommands(context) {
    const disposables = [];
    // Main tree display configuration command
    disposables.push(registerConfigureTreeDisplayCommand(context));
    // Individual configuration commands (can be called independently)
    disposables.push(registerConfigureLanguageSortCommand(context));
    disposables.push(registerConfigureFileSortCommand(context));
    disposables.push(registerConfigureFileLimitCommand(context));
    disposables.push(registerResetTreeDisplaySettingsCommand(context));
    return disposables;
}
/**
 * Registers the main tree display configuration command
 * @param context Extension context
 * @returns Command disposable
 */
function registerConfigureTreeDisplayCommand(context) {
    return vscode.commands.registerCommand('codexr.configureTreeDisplay', async () => {
        try {
            const config = (0, treeDisplayConfig_1.getTreeDisplayConfig)(context);
            // Main configuration menu
            const mainOptions = [
                {
                    label: '📂 Language Sorting',
                    description: `Current: ${(0, treeDisplayConfig_1.getSortMethodDisplayText)(config.languageSortMethod, config.languageSortDirection)}`,
                    action: 'languageSort'
                },
                {
                    label: '📄 File Sorting',
                    description: `Current: ${(0, treeDisplayConfig_1.getSortMethodDisplayText)(config.fileSortMethod, config.fileSortDirection)}`,
                    action: 'fileSort'
                },
                {
                    label: '🔢 File Limit per Language',
                    description: `Current: ${config.maxFilesPerLanguage === 0 ? 'Unlimited' : `${config.maxFilesPerLanguage} files`}`,
                    action: 'fileLimit'
                },
                {
                    label: '🔄 Reset to Defaults',
                    description: 'Reset all tree display settings to default values',
                    action: 'reset'
                }
            ];
            const mainSelection = await vscode.window.showQuickPick(mainOptions, {
                placeHolder: 'Select what to configure',
                title: 'Tree Display Settings'
            });
            if (!mainSelection) {
                return;
            }
            switch (mainSelection.action) {
                case 'languageSort':
                    await configureLanguageSort(context);
                    break;
                case 'fileSort':
                    await configureFileSort(context);
                    break;
                case 'fileLimit':
                    await configureFileLimit(context);
                    break;
                case 'reset':
                    await resetTreeDisplaySettings(context);
                    break;
            }
            // Refresh the tree after any changes
            (0, commandHelpers_1.refreshTreeProvider)();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error configuring tree display: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Registers the language sort configuration command
 * @param context Extension context
 * @returns Command disposable
 */
function registerConfigureLanguageSortCommand(context) {
    return vscode.commands.registerCommand('codexr.configureLanguageSort', async () => {
        await configureLanguageSort(context);
        (0, commandHelpers_1.refreshTreeProvider)();
    });
}
/**
 * Registers the file sort configuration command
 * @param context Extension context
 * @returns Command disposable
 */
function registerConfigureFileSortCommand(context) {
    return vscode.commands.registerCommand('codexr.configureFileSort', async () => {
        await configureFileSort(context);
        (0, commandHelpers_1.refreshTreeProvider)();
    });
}
/**
 * Registers the file limit configuration command
 * @param context Extension context
 * @returns Command disposable
 */
function registerConfigureFileLimitCommand(context) {
    return vscode.commands.registerCommand('codexr.configureFileLimit', async () => {
        await configureFileLimit(context);
        (0, commandHelpers_1.refreshTreeProvider)();
    });
}
/**
 * Registers the reset tree display settings command
 * @param context Extension context
 * @returns Command disposable
 */
function registerResetTreeDisplaySettingsCommand(context) {
    return vscode.commands.registerCommand('codexr.resetTreeDisplaySettings', async () => {
        await resetTreeDisplaySettings(context);
        (0, commandHelpers_1.refreshTreeProvider)();
    });
}
/**
 * Configure language sorting method and direction
 * @param context Extension context
 */
async function configureLanguageSort(context) {
    try {
        const options = (0, treeDisplayConfig_1.getLanguageSortOptions)();
        const currentConfig = (0, treeDisplayConfig_1.getTreeDisplayConfig)(context);
        // Mark current selection
        const enhancedOptions = options.map(option => ({
            ...option,
            label: option.method === currentConfig.languageSortMethod &&
                option.direction === currentConfig.languageSortDirection
                ? `$(check) ${option.label}`
                : option.label,
            description: option.method === currentConfig.languageSortMethod &&
                option.direction === currentConfig.languageSortDirection
                ? 'Currently selected'
                : undefined
        }));
        const selection = await vscode.window.showQuickPick(enhancedOptions, {
            placeHolder: 'Select how to sort languages',
            title: 'Language Sorting Method'
        });
        if (selection) {
            await (0, treeDisplayConfig_1.updateTreeDisplayConfig)(context, {
                languageSortMethod: selection.method,
                languageSortDirection: selection.direction
            });
            vscode.window.showInformationMessage(`Language sorting updated to: ${selection.label.replace('$(check) ', '')}`);
        }
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error configuring language sort: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Configure file sorting method and direction
 * @param context Extension context
 */
async function configureFileSort(context) {
    try {
        const options = (0, treeDisplayConfig_1.getFileSortOptions)();
        const currentConfig = (0, treeDisplayConfig_1.getTreeDisplayConfig)(context);
        // Mark current selection
        const enhancedOptions = options.map(option => ({
            ...option,
            label: option.method === currentConfig.fileSortMethod &&
                option.direction === currentConfig.fileSortDirection
                ? `$(check) ${option.label}`
                : option.label,
            description: option.method === currentConfig.fileSortMethod &&
                option.direction === currentConfig.fileSortDirection
                ? 'Currently selected'
                : undefined
        }));
        const selection = await vscode.window.showQuickPick(enhancedOptions, {
            placeHolder: 'Select how to sort files within each language',
            title: 'File Sorting Method'
        });
        if (selection) {
            await (0, treeDisplayConfig_1.updateTreeDisplayConfig)(context, {
                fileSortMethod: selection.method,
                fileSortDirection: selection.direction
            });
            vscode.window.showInformationMessage(`File sorting updated to: ${selection.label.replace('$(check) ', '')}`);
        }
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error configuring file sort: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Configure maximum files per language
 * @param context Extension context
 */
async function configureFileLimit(context) {
    try {
        const currentConfig = (0, treeDisplayConfig_1.getTreeDisplayConfig)(context);
        const currentValue = currentConfig.maxFilesPerLanguage;
        const presetOptions = [
            { label: 'Unlimited', description: 'Show all files (no limit)', value: 0 },
            { label: '5 files', description: 'Limit to 5 files per language', value: 5 },
            { label: '10 files', description: 'Limit to 10 files per language', value: 10 },
            { label: '15 files', description: 'Limit to 15 files per language', value: 15 },
            { label: '20 files', description: 'Limit to 20 files per language', value: 20 },
            { label: '25 files', description: 'Limit to 25 files per language', value: 25 },
            { label: '50 files', description: 'Limit to 50 files per language', value: 50 },
            { label: '$(edit) Custom...', description: 'Enter a custom number', value: -1 }
        ];
        // Mark current selection
        const enhancedOptions = presetOptions.map(option => ({
            ...option,
            label: option.value === currentValue ? `$(check) ${option.label}` : option.label,
            description: option.value === currentValue
                ? `${option.description} (current)`
                : option.description
        }));
        const selection = await vscode.window.showQuickPick(enhancedOptions, {
            placeHolder: 'Select maximum files to show per language',
            title: 'File Limit per Language'
        });
        if (!selection) {
            return;
        }
        let newLimit;
        if (selection.value === -1) {
            // Custom value
            const input = await vscode.window.showInputBox({
                prompt: 'Enter maximum number of files per language (0 for unlimited)',
                placeHolder: '0',
                value: currentValue.toString(),
                validateInput: (value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num < 0) {
                        return 'Please enter a valid number (0 or greater)';
                    }
                    if (num > 200) {
                        return 'For performance reasons, please enter a number 200 or less';
                    }
                    return undefined;
                }
            });
            if (!input) {
                return;
            }
            newLimit = parseInt(input);
        }
        else {
            newLimit = selection.value;
        }
        await (0, treeDisplayConfig_1.updateTreeDisplayConfig)(context, {
            maxFilesPerLanguage: newLimit
        });
        const limitText = newLimit === 0 ? 'unlimited' : `${newLimit} files`;
        vscode.window.showInformationMessage(`File limit updated to: ${limitText} per language`);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error configuring file limit: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Reset all tree display settings to defaults
 * @param context Extension context
 */
async function resetTreeDisplaySettings(context) {
    try {
        const confirm = await vscode.window.showWarningMessage('Reset all tree display settings to default values?', {
            modal: true,
            detail: 'This will reset language sorting, file sorting, and file limits to their default values.'
        }, 'Reset Settings', 'Cancel');
        if (confirm === 'Reset Settings') {
            const vsConfig = vscode.workspace.getConfiguration('codexr.analysis');
            // Reset all tree display settings
            await vsConfig.update('tree.maxFilesPerLanguage', undefined, vscode.ConfigurationTarget.Global);
            await vsConfig.update('tree.languageSortMethod', undefined, vscode.ConfigurationTarget.Global);
            await vsConfig.update('tree.languageSortDirection', undefined, vscode.ConfigurationTarget.Global);
            await vsConfig.update('tree.fileSortMethod', undefined, vscode.ConfigurationTarget.Global);
            await vsConfig.update('tree.fileSortDirection', undefined, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage('Tree display settings reset to defaults');
        }
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error resetting tree display settings: ${error instanceof Error ? error.message : String(error)}`);
    }
}
//# sourceMappingURL=treeDisplayCommands.js.map