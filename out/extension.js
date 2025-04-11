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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const commands_1 = require("./commands");
const statusBar_1 = require("./ui/statusBar");
const analysisViewProvider_1 = require("./analysis/providers/analysisViewProvider");
const treeProvider_1 = require("./ui/treeProvider");
const serverManager_1 = require("./server/serverManager");
/**
 * This function is executed when the extension is activated
 */
function activate(context) {
    console.log('Extension "CodeXR" is now active.');
    // Initialize status bar
    const jsMetricsStatusBar = (0, statusBar_1.initializeStatusBar)(context);
    context.subscriptions.push(jsMetricsStatusBar);
    // Register tree data provider for the unified view
    const treeDataProvider = new treeProvider_1.LocalServerProvider(context);
    // Register tree view
    const treeView = vscode.window.createTreeView('codexr.serverTreeView', {
        treeDataProvider: treeDataProvider
    });
    context.subscriptions.push(treeView);
    // Register the Analysis View Provider
    const analysisViewProvider = new analysisViewProvider_1.AnalysisViewProvider(context.extensionUri);
    console.log('AnalysisViewProvider instance created');
    // Register the provider
    const analysisViewRegistration = vscode.window.registerWebviewViewProvider('codexr.analysisView', analysisViewProvider, {
        webviewOptions: {
            retainContextWhenHidden: true
        }
    });
    console.log('AnalysisViewProvider registered');
    context.subscriptions.push(analysisViewRegistration);
    // Register all commands
    const commandDisposables = (0, commands_1.registerCommands)(context, treeDataProvider, analysisViewProvider);
    context.subscriptions.push(...commandDisposables);
}
/**
 * This function is executed when the extension is deactivated
 */
function deactivate() {
    (0, serverManager_1.stopServer)(); // Ensure all servers are stopped when extension is deactivated
}
//# sourceMappingURL=extension.js.map