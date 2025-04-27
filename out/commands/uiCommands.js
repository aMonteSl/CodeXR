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
exports.registerUiCommands = registerUiCommands;
const vscode = __importStar(require("vscode"));
const analysisPanel_1 = require("../ui/panels/analysisPanel");
/**
 * Registers UI-related commands
 * @param treeDataProvider The main tree data provider
 * @returns Array of disposables for registered commands
 */
function registerUiCommands(context, treeDataProvider) {
    const disposables = [];
    // Command to refresh the view
    disposables.push(vscode.commands.registerCommand('codexr.refreshView', () => {
        treeDataProvider.refresh();
    }));
    // Command for refreshing the server view (alias for backwards compatibility)
    disposables.push(vscode.commands.registerCommand('codexr.refreshServerView', () => {
        treeDataProvider.refresh();
    }));
    // Make sure this command is properly registered and calls the panel update
    disposables.push(vscode.commands.registerCommand('codexr.updateAnalysisPanel', (analysisResult) => {
        // Ensure we're calling the proper update method
        analysisPanel_1.AnalysisPanel.update(analysisResult);
        // Add debug logging to verify data flow
        console.log('Analysis panel update triggered with latest data');
    }));
    // Return the disposables
    return disposables;
}
//# sourceMappingURL=uiCommands.js.map