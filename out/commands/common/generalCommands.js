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
exports.registerGeneralCommands = registerGeneralCommands;
const vscode = __importStar(require("vscode"));
const commonCommands_1 = require("../../utils/commonCommands");
/**
 * Register general/common commands used throughout the extension
 */
function registerGeneralCommands(context) {
    console.log('GENERAL_COMMANDS: Registering general commands');
    // Register the main tree refresh command (replaces codexr.servers.refresh)
    const refreshTreeCommand = vscode.commands.registerCommand('codexr.tree.refresh', () => {
        console.log('GENERAL_COMMANDS: Tree refresh command executed');
        commonCommands_1.CommonCommands.refreshTreeView();
    });
    // Register legacy command for backward compatibility
    const legacyRefreshCommand = vscode.commands.registerCommand('codexr.servers.refresh', () => {
        console.log('GENERAL_COMMANDS: Legacy servers refresh command executed, delegating to tree refresh');
        commonCommands_1.CommonCommands.refreshTreeView();
    });
    // Register a general modular tree refresh command
    const modularTreeRefreshCommand = vscode.commands.registerCommand('codeXR.modularTree.refresh', () => {
        console.log('GENERAL_COMMANDS: Modular tree refresh command executed');
        commonCommands_1.CommonCommands.refreshTreeView();
    });
    // Add commands to subscriptions
    context.subscriptions.push(refreshTreeCommand, legacyRefreshCommand, modularTreeRefreshCommand);
    console.log('GENERAL_COMMANDS: Registered 3 general commands (tree refresh, legacy refresh, modular refresh)');
}
//# sourceMappingURL=generalCommands.js.map