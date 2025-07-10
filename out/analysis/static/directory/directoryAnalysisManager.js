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
exports.DirectoryAnalysisManager = void 0;
const vscode = __importStar(require("vscode"));
const scanUtils_1 = require("../utils/scanUtils");
const incrementalAnalysisEngine_1 = require("../../shared/incrementalAnalysisEngine");
/**
 * Directory analysis manager
 */
class DirectoryAnalysisManager {
    outputChannel;
    progressCallback;
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('CodeXR Directory Analysis');
    }
    /**
     * Sets the progress callback for reporting analysis progress
     */
    setProgressCallback(callback) {
        this.progressCallback = callback;
    }
    /**
     * Clears the progress callback
     */
    clearProgressCallback() {
        this.progressCallback = undefined;
    }
    /**
     * Analyzes a directory and returns comprehensive metrics
     * @param directoryPath Path to directory to analyze
     * @param filters Analysis filters
     * @param previousResult Previous analysis result for change detection
     * @returns Directory analysis result
     */
    async analyzeDirectory(directoryPath, filters = scanUtils_1.DEFAULT_FILTERS, previousResult) {
        const startTime = Date.now();
        this.outputChannel.appendLine(`Starting directory analysis: ${directoryPath}`);
        try {
            // Create incremental analysis engine
            const engine = new incrementalAnalysisEngine_1.IncrementalAnalysisEngine();
            // Configure analysis
            const config = {
                directoryPath,
                filters: {
                    maxDepth: filters.maxDepth || 50,
                    excludePatterns: filters.excludePatterns || [],
                    maxFileSize: filters.maxFileSize || 1024 * 1024
                },
                previousResult,
                progressCallback: this.progressCallback,
                outputChannel: this.outputChannel
            };
            // Perform incremental analysis
            const incrementalResult = await engine.performIncrementalAnalysis(config);
            // Transform to full DirectoryAnalysisResult
            const result = (0, incrementalAnalysisEngine_1.transformToDirectoryAnalysisResult)(incrementalResult, directoryPath, config.filters, startTime);
            this.outputChannel.appendLine(`Directory analysis completed in ${Date.now() - startTime}ms`);
            return result;
        }
        catch (error) {
            this.outputChannel.appendLine(`Error during directory analysis: ${error}`);
            throw error;
        }
    }
    /**
     * Analyzes the workspace root as a project
     * @param filters Analysis filters
     * @param previousResult Previous analysis result for change detection
     * @returns Directory analysis result
     */
    async analyzeProject(filters = scanUtils_1.DEFAULT_FILTERS, previousResult) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder open');
        }
        const result = await this.analyzeDirectory(workspaceFolder.uri.fsPath, filters, previousResult);
        // Update metadata to indicate project analysis
        result.metadata.mode = 'project';
        return result;
    }
}
exports.DirectoryAnalysisManager = DirectoryAnalysisManager;
//# sourceMappingURL=directoryAnalysisManager.js.map