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
exports.registerRefreshTreeViewCommand = registerRefreshTreeViewCommand;
exports.registerCommands = registerCommands;
const vscode = __importStar(require("vscode"));
// Fix the import path
const serverCommands_1 = require("./serverCommands");
const uiCommands_1 = require("./uiCommands"); // Fixed casing here
/**
 * Refreshes the tree view
 */
function registerRefreshTreeViewCommand(treeDataProvider) {
    return vscode.commands.registerCommand('codexr.refreshTreeView', () => {
        if (treeDataProvider && typeof treeDataProvider.refresh === 'function') {
            treeDataProvider.refresh();
        }
    });
}
/**
 * Registers all commands for the extension
 * @param context Extension context for storage
 * @param treeDataProvider The main tree data provider
 * @returns Array of disposables for all registered commands
 */
function registerCommands(context, treeDataProvider) {
    const disposables = [];
    // Register each group of commands
    disposables.push(...(0, serverCommands_1.registerServerCommands)(context, treeDataProvider));
    // DISABLED: Legacy babia commands that use old template system
    // disposables.push(...registerBabiaCommands(context, treeDataProvider));
    disposables.push(...(0, uiCommands_1.registerUiCommands)(context, treeDataProvider)); // Fixed casing and added context parameter
    // Eliminar esta línea que registra el comando duplicado
    // disposables.push(registerSetAnalysisChartTypeCommand()); // Nuevo comando añadido
    // We no longer register analysis commands here since they are registered in extension.ts
    // Add the refresh command
    disposables.push(registerRefreshTreeViewCommand(treeDataProvider));
    return disposables;
}
//# sourceMappingURL=index.js.map