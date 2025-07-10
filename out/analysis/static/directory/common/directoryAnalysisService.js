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
exports.directoryAnalysisService = exports.DirectoryAnalysisService = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const directoryAnalysisManager_1 = require("../directoryAnalysisManager");
const directoryAnalysisConfig_1 = require("./directoryAnalysisConfig");
const directoryVisualizationManager_1 = require("../directoryVisualizationManager");
const directoryWatchManager_1 = require("../../../watchers/directoryWatchManager");
const directoryAnalysisDataManager_1 = require("../../../shared/directoryAnalysisDataManager");
const directoryAnalysisProgress_1 = require("../../../shared/directoryAnalysisProgress");
/**
 * Shared service for directory analysis operations
 * Handles both shallow and deep directory analysis
 */
class DirectoryAnalysisService {
    static instance;
    constructor() { }
    static getInstance() {
        if (!DirectoryAnalysisService.instance) {
            DirectoryAnalysisService.instance = new DirectoryAnalysisService();
        }
        return DirectoryAnalysisService.instance;
    }
    /**
     * Performs directory analysis based on the specified options
     */
    async analyzeDirectory(context, directoryPath, options, isProject = false) {
        try {
            const mode = options.recursive ? 'deep' : 'shallow';
            const filters = this.getFiltersForMode(mode, options.filters);
            console.log(`🔍 Starting ${mode} directory analysis: ${directoryPath}`);
            console.log(`📊 Analysis options:`, options);
            console.log(`📊 Analysis filters:`, filters);
            // Start progress indicator
            const progressOptions = {
                location: vscode.ProgressLocation.Notification,
                title: `CodeXR: Analyzing ${mode === 'deep' ? 'directory (deep)' : 'directory'}`,
                cancellable: false
            };
            return await vscode.window.withProgress(progressOptions, async (progress) => {
                const startTime = Date.now();
                progress.report({ message: `Scanning ${directoryPath}...` });
                // Load previous analysis data if available
                let previousResult;
                let dataPath;
                try {
                    const previousData = await (0, directoryAnalysisDataManager_1.loadPreviousDirectoryAnalysis)({
                        context,
                        directoryPath,
                        mode: mode === 'deep' ? 'deep' : 'static',
                        isProject
                    });
                    previousResult = previousData.previousResult;
                    dataPath = previousData.dataPath;
                    if (previousResult) {
                        console.log(`DIRECTORY-ANALYSIS: ${mode.toUpperCase()} Using previous analysis data for incremental scanning`);
                    }
                }
                catch (error) {
                    console.warn(`DIRECTORY-ANALYSIS: ${mode.toUpperCase()} Could not load previous analysis data: ${error}`);
                }
                // Determine if this is initial analysis
                const isInitial = (0, directoryAnalysisProgress_1.isInitialAnalysis)(previousResult);
                // Log analysis start
                (0, directoryAnalysisProgress_1.logAnalysisStart)(mode, directoryPath, isInitial);
                // Perform the analysis with progress reporting
                const manager = new directoryAnalysisManager_1.DirectoryAnalysisManager();
                // Set up standardized progress callback
                const progressCallback = (0, directoryAnalysisProgress_1.createNotificationProgressCallback)(progress, mode === 'deep' ? 'deep' : 'static', isInitial);
                manager.setProgressCallback(progressCallback);
                const result = await manager.analyzeDirectory(directoryPath, filters, previousResult);
                // Clear the progress callback
                manager.clearProgressCallback();
                // Log analysis completion
                const duration = Date.now() - startTime;
                const filesAnalyzed = result.metadata.filesAnalyzedThisSession || result.summary.totalFilesAnalyzed;
                const totalFiles = result.metadata.totalFilesConsidered || result.summary.totalFiles;
                (0, directoryAnalysisProgress_1.logAnalysisComplete)(mode, directoryPath, filesAnalyzed, totalFiles, isInitial, duration);
                // Save the analysis result if we have a data path
                if (dataPath) {
                    try {
                        const saveMode = mode === 'deep' ? 'deep' : 'static';
                        await (0, directoryAnalysisDataManager_1.saveDirectoryAnalysisResult)(result, dataPath, saveMode);
                    }
                    catch (error) {
                        console.warn(`⚠️ Could not save analysis result: ${error}`);
                    }
                }
                progress.report({ message: 'Creating visualization...' });
                // Create visualization
                const visualizationDir = await (0, directoryVisualizationManager_1.createDirectoryVisualization)(context, directoryPath, result, isProject, mode);
                if (visualizationDir) {
                    // Start watching for changes
                    await this.setupDirectoryWatcher(directoryPath, mode, isProject, result);
                    const fileCount = result.summary.totalFilesAnalyzed;
                    const modeLabel = mode === 'deep' ? 'deep' : 'shallow';
                    console.log(`✅ ${modeLabel} directory analysis completed: ${fileCount} files analyzed`);
                    // Show completion message
                    vscode.window.showInformationMessage(`CodeXR: Directory analysis completed (${fileCount} files analyzed)`);
                }
                return result;
            });
        }
        catch (error) {
            console.error(`Error during ${options.recursive ? 'deep' : 'shallow'} directory analysis:`, error);
            vscode.window.showErrorMessage(`Directory analysis failed: ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    }
    /**
     * Updates an existing directory analysis
     */
    async updateDirectoryAnalysis(directoryPath, mode, previousResult) {
        try {
            const filters = this.getFiltersForMode(mode);
            console.log(`🔄 Updating ${mode} directory analysis: ${directoryPath}`);
            const manager = new directoryAnalysisManager_1.DirectoryAnalysisManager();
            // Set up progress callback for updates too
            manager.setProgressCallback((current, total, currentFile) => {
                // For updates, we'll use the output channel instead of a progress bar
                // to avoid interrupting the user's workflow
                const fileName = path.basename(currentFile);
                console.log(`🔄 Re-analyzing: ${fileName} [${current}/${total}]`);
            });
            const result = await manager.analyzeDirectory(directoryPath, filters, previousResult);
            // Clear the progress callback
            manager.clearProgressCallback();
            // Update the visualization
            await (0, directoryVisualizationManager_1.updateDirectoryVisualization)(directoryPath, result);
            console.log(`✅ ${mode} directory analysis updated: ${result.summary.totalFilesAnalyzed} files`);
            return result;
        }
        catch (error) {
            console.error(`Error updating ${mode} directory analysis:`, error);
            return undefined;
        }
    }
    /**
     * Sets up directory watcher for the specified mode
     */
    async setupDirectoryWatcher(directoryPath, mode, isProject, result) {
        try {
            // Stop any existing watcher for this directory
            if (directoryWatchManager_1.directoryWatchManager.isWatching(directoryPath)) {
                directoryWatchManager_1.directoryWatchManager.stopWatching(directoryPath);
            }
            // Start new watcher with the analysis result
            directoryWatchManager_1.directoryWatchManager.startWatching(directoryPath, result, isProject, mode);
            // Store the analysis mode for this directory
            this.setAnalysisModeForDirectory(directoryPath, mode);
            console.log(`👁️ Started ${mode} directory watcher: ${directoryPath}`);
        }
        catch (error) {
            console.error('Error setting up directory watcher:', error);
        }
    }
    /**
     * Gets the appropriate filters for the analysis mode
     */
    getFiltersForMode(mode, customFilters) {
        const baseFilters = mode === 'deep' ? directoryAnalysisConfig_1.DEFAULT_DEEP_FILTERS : directoryAnalysisConfig_1.DEFAULT_SHALLOW_FILTERS;
        // Convert DirectoryAnalysisFilters to AnalysisFilters
        const mergedFilters = customFilters ? { ...baseFilters, ...customFilters } : baseFilters;
        const result = {
            maxDepth: mergedFilters.maxDepth,
            excludePatterns: mergedFilters.excludePatterns,
            maxFileSize: mergedFilters.maxFileSize
        };
        console.log(`🔧 Converting filters for ${mode} mode:`, result);
        return result;
    }
    /**
     * Stores the analysis mode for a directory (for watcher use)
     */
    setAnalysisModeForDirectory(directoryPath, mode) {
        // Store in a simple map for now - this could be enhanced with persistence later
        if (!this.directoryModes) {
            this.directoryModes = new Map();
        }
        this.directoryModes.set(directoryPath, mode);
    }
    /**
     * Gets the analysis mode for a directory
     */
    getAnalysisModeForDirectory(directoryPath) {
        return this.directoryModes?.get(directoryPath) || 'shallow';
    }
    directoryModes;
}
exports.DirectoryAnalysisService = DirectoryAnalysisService;
exports.directoryAnalysisService = DirectoryAnalysisService.getInstance();
//# sourceMappingURL=directoryAnalysisService.js.map