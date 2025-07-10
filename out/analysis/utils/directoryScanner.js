"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DirectoryDataScanner = void 0;
exports.createDirectoryAnalysisData = createDirectoryAnalysisData;
const directoryAnalysisManager_1 = require("../static/directory/directoryAnalysisManager");
const directoryAnalysisConfig_1 = require("../static/directory/common/directoryAnalysisConfig");
const directoryAnalysisDataManager_1 = require("../shared/directoryAnalysisDataManager");
/**
 * Shared directory scanner that generates analysis data for both static and XR modes
 */
class DirectoryDataScanner {
    manager;
    constructor() {
        this.manager = new directoryAnalysisManager_1.DirectoryAnalysisManager();
    }
    /**
     * Sets the progress callback for reporting scanning progress
     */
    setProgressCallback(callback) {
        this.manager.setProgressCallback(callback);
    }
    /**
     * Scans a directory and generates analysis data
     * @param directoryPath Path to directory to analyze
     * @param options Scanning options
     * @returns Directory analysis result
     */
    async scanDirectory(directoryPath, options) {
        console.log(`🔍 DirectoryDataScanner: Starting ${options.mode} scan of ${directoryPath}`);
        console.log(`📊 Scan options:`, options);
        // Load previous analysis data if available
        let previousResult;
        let dataPath;
        if (options.context) {
            try {
                const previousData = await (0, directoryAnalysisDataManager_1.loadPreviousDirectoryAnalysis)({
                    context: options.context,
                    directoryPath,
                    mode: options.mode,
                    isProject: options.isProject
                });
                previousResult = previousData.previousResult;
                dataPath = previousData.dataPath;
                if (previousResult) {
                    console.log(`📊 Using previous analysis data for incremental scanning`);
                }
            }
            catch (error) {
                console.warn(`⚠️ Could not load previous analysis data: ${error}`);
            }
        }
        // Determine filters based on options
        const filters = {
            ...directoryAnalysisConfig_1.DEFAULT_SHALLOW_FILTERS, // Always use shallow for directory XR
            ...(options.filters || {})
        };
        // Force shallow scan for XR mode or if includeSubdirectories is false
        if (options.mode === 'xr' || !options.includeSubdirectories) {
            filters.maxDepth = 1;
            console.log(`📁 Using SHALLOW scan (maxDepth=1) for ${options.mode} mode`);
        }
        console.log(`📊 Final scan filters:`, filters);
        // Perform the directory analysis using existing manager logic with previous result
        const result = await this.manager.analyzeDirectory(directoryPath, filters, previousResult);
        // Save the result to the appropriate location if we have a data path
        if (dataPath && options.context) {
            try {
                await (0, directoryAnalysisDataManager_1.saveDirectoryAnalysisResult)(result, dataPath, options.mode);
            }
            catch (error) {
                console.warn(`⚠️ Could not save analysis result: ${error}`);
            }
        }
        console.log(`✅ DirectoryDataScanner: Completed ${options.mode} scan`);
        console.log(`📈 Results: ${result.summary.totalFilesAnalyzed} files analyzed out of ${result.summary.totalFiles} total`);
        return result;
    }
    /**
     * Clears the progress callback
     */
    clearProgressCallback() {
        this.manager.clearProgressCallback();
    }
}
exports.DirectoryDataScanner = DirectoryDataScanner;
/**
 * Shared function to create directory analysis data
 * Used by both static and XR directory analysis
 */
async function createDirectoryAnalysisData(directoryPath, options, progressCallback) {
    const scanner = new DirectoryDataScanner();
    if (progressCallback) {
        scanner.setProgressCallback(progressCallback);
    }
    try {
        const result = await scanner.scanDirectory(directoryPath, options);
        return result;
    }
    finally {
        scanner.clearProgressCallback();
    }
}
//# sourceMappingURL=directoryScanner.js.map