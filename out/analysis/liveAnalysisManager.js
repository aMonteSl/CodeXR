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
exports.startLiveAnalysisSystem = startLiveAnalysisSystem;
const vscode = __importStar(require("vscode"));
const analysisManager_1 = require("./analysisManager");
const analysisDataManager_1 = require("./analysisDataManager");
const analysisPanel_1 = require("../ui/panels/analysisPanel");
// Track timer for debouncing
let analysisTimeout;
// Default debounce delay (milliseconds)
const DEFAULT_DELAY = 1500;
/**
 * Starts a system that watches for document changes and automatically analyzes them
 * @param context Extension context
 */
function startLiveAnalysisSystem(context) {
    console.log('Starting live analysis system');
    // Register event for document changes
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(async (event) => {
        // Only process if we have an active analysis panel
        if (!analysisDataManager_1.analysisDataManager.getActiveFileAnalysisPanel()) {
            return;
        }
        const document = event.document;
        // Only analyze supported file types
        if (!isSupportedFileType(document.fileName)) {
            return;
        }
        // Get config for debounce delay
        const config = vscode.workspace.getConfiguration('codexr');
        const delay = config.get('liveAnalysisDelay', DEFAULT_DELAY);
        // Clear existing timeout
        if (analysisTimeout) {
            clearTimeout(analysisTimeout);
        }
        // Set new timeout to debounce the analysis
        analysisTimeout = setTimeout(async () => {
            console.log(`Live analyzing ${document.fileName}`);
            await performLiveAnalysis(document.fileName, context);
        }, delay);
    }));
    // Also watch for active editor changes to set up initial analysis
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        if (!editor || !analysisDataManager_1.analysisDataManager.getActiveFileAnalysisPanel()) {
            return;
        }
        const document = editor.document;
        if (isSupportedFileType(document.fileName)) {
            // When switching to a supported file, analyze it immediately
            await performLiveAnalysis(document.fileName, context);
        }
    }));
}
/**
 * Performs live analysis of a file and updates the UI
 */
async function performLiveAnalysis(filePath, context) {
    try {
        // Run the analysis
        const result = await (0, analysisManager_1.analyzeFile)(filePath, context);
        if (result) {
            // Store the result
            analysisDataManager_1.analysisDataManager.setAnalysisResult(result);
            // Update the panel using our standard update mechanism
            console.log('Triggering panel update with new analysis data');
            analysisPanel_1.AnalysisPanel.update(result);
        }
    }
    catch (error) {
        console.error('Error during live analysis:', error);
    }
}
/**
 * Determines if a file should be analyzed in real-time
 */
function isSupportedFileType(filePath) {
    const supportedExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp'];
    const fileExt = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    return supportedExtensions.includes(fileExt);
}
//# sourceMappingURL=liveAnalysisManager.js.map