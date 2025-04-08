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
exports.initializeStatusBar = initializeStatusBar;
exports.updateJSMetricsStatusBar = updateJSMetricsStatusBar;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const codeAnalyzer_1 = require("../analysis/codeAnalyzer");
// Variable for debouncing updates
let statusBarUpdateTimer;
/**
 * Creates and initializes the status bar
 */
function initializeStatusBar(context) {
    // Create status bar item
    const jsMetricsStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    jsMetricsStatusBar.command = 'integracionvsaframe.showJSMetricsDetails';
    // Set up event handlers for updating
    setupStatusBarEvents(jsMetricsStatusBar, context);
    // Initialize if a JS file is already open
    if (vscode.window.activeTextEditor &&
        (vscode.window.activeTextEditor.document.languageId === 'javascript' ||
            vscode.window.activeTextEditor.document.languageId === 'javascriptreact')) {
        updateJSMetricsStatusBar(vscode.window.activeTextEditor.document, jsMetricsStatusBar, context);
    }
    return jsMetricsStatusBar;
}
/**
 * Set up event handlers for status bar updates
 */
function setupStatusBarEvents(statusBar, context) {
    // Update status bar when active editor changes
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        if (editor && (editor.document.languageId === 'javascript' || editor.document.languageId === 'javascriptreact')) {
            updateJSMetricsStatusBar(editor.document, statusBar, context);
        }
        else {
            statusBar.hide();
        }
    });
    // Also update on document change
    vscode.workspace.onDidChangeTextDocument(event => {
        if (vscode.window.activeTextEditor &&
            event.document === vscode.window.activeTextEditor.document &&
            (event.document.languageId === 'javascript' || event.document.languageId === 'javascriptreact')) {
            // Use debouncing to avoid too frequent updates
            clearTimeout(statusBarUpdateTimer);
            statusBarUpdateTimer = setTimeout(() => {
                updateJSMetricsStatusBar(event.document, statusBar, context);
            }, 1000);
        }
    });
}
/**
 * Updates the status bar with JS metrics
 */
async function updateJSMetricsStatusBar(document, statusBar, context) {
    try {
        // Get cached analysis or run a new one
        let fileAnalysis = context.globalState.get(`jsAnalysis:${document.uri.fsPath}`);
        if (!fileAnalysis) {
            fileAnalysis = await (0, codeAnalyzer_1.analyzeFile)(document.uri.fsPath);
            context.globalState.update(`jsAnalysis:${document.uri.fsPath}`, fileAnalysis);
        }
        const metrics = fileAnalysis.metrics;
        // Update status bar text
        statusBar.text = `$(code) JS Metrics: ${metrics.totalLines}L ${metrics.functionCount}F`;
        statusBar.tooltip = `JavaScript Metrics for ${path.basename(document.uri.fsPath)}
Lines: ${metrics.totalLines}
Code: ${metrics.codeLines}
Comments: ${metrics.commentLines}
Functions: ${metrics.functionCount}
Classes: ${metrics.classCount}
Click for details`;
        statusBar.show();
    }
    catch (error) {
        console.error('Error updating JS metrics status bar:', error);
        statusBar.text = '$(warning) JS Metrics: Error';
        statusBar.show();
    }
}
//# sourceMappingURL=statusBar.js.map