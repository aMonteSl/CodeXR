"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommands = registerCommands;
const analysisCommands_1 = require("./analysisCommands");
const serverCommands_1 = require("./serverCommands");
const babiaCommands_1 = require("./babiaCommands");
const uiCommands_1 = require("./uiCommands");
/**
 * Registers all commands for the extension
 * @param context Extension context for storage
 * @param treeDataProvider The main tree data provider
 * @param analysisViewProvider The analysis view provider
 * @returns Array of disposables for all registered commands
 */
function registerCommands(context, treeDataProvider, analysisViewProvider) {
    const disposables = [];
    // Register each group of commands
    disposables.push(...(0, analysisCommands_1.registerAnalysisCommands)(context, analysisViewProvider));
    disposables.push(...(0, serverCommands_1.registerServerCommands)(context, treeDataProvider));
    disposables.push(...(0, babiaCommands_1.registerBabiaCommands)(context, treeDataProvider));
    disposables.push(...(0, uiCommands_1.registerUICommands)(treeDataProvider));
    return disposables;
}
//# sourceMappingURL=index.js.map