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
exports.createDirectoryAnalysisProgressCallback = createDirectoryAnalysisProgressCallback;
exports.createNotificationProgressCallback = createNotificationProgressCallback;
exports.logAnalysisStart = logAnalysisStart;
exports.logAnalysisComplete = logAnalysisComplete;
exports.isInitialAnalysis = isInitialAnalysis;
const path = __importStar(require("path"));
/**
 * Creates a standardized progress callback for directory analysis
 * Used across all directory analysis modes (Static, Deep, Project, XR)
 *
 * @param progressReporter VS Code progress reporter
 * @param options Progress display options
 * @returns Standardized progress callback function
 */
function createDirectoryAnalysisProgressCallback(progressReporter, options) {
    const { isInitialAnalysis, mode, messagePrefix } = options;
    return (current, total, currentFile) => {
        const fileName = path.basename(currentFile);
        const percentage = Math.round((current / total) * 100);
        // Different message format for initial vs incremental analysis
        let message;
        if (isInitialAnalysis) {
            // For initial analysis: show detailed progress with file count and percentage
            const prefix = messagePrefix || 'Analyzing';
            message = `${prefix}: ${fileName} [${current}/${total} files] (${percentage}%)`;
        }
        else {
            // For incremental analysis: simpler message
            message = `Re-analyzing changes: ${fileName}`;
        }
        // Log progress for debugging
        if (current === 1 || current === total || current % 10 === 0) {
            console.log(`DIRECTORY-ANALYSIS: ${mode.toUpperCase()} progress: ${current}/${total} (${percentage}%) - ${fileName}`);
        }
        progressReporter.report({
            message,
            increment: (1 / total) * 100
        });
    };
}
/**
 * Creates a progress callback for VS Code notification progress
 * Standardized format for all directory analysis types
 *
 * @param progress VS Code progress object
 * @param mode Analysis mode
 * @param isInitial Whether this is initial analysis
 * @returns Progress callback function
 */
function createNotificationProgressCallback(progress, mode, isInitial = true) {
    return createDirectoryAnalysisProgressCallback(progress, {
        isInitialAnalysis: isInitial,
        mode,
        messagePrefix: isInitial ? 'Analyzing' : 'Re-analyzing'
    });
}
/**
 * Logs analysis start with consistent formatting
 */
function logAnalysisStart(mode, directoryPath, isInitial) {
    const analysisType = isInitial ? 'Initial' : 'Incremental';
    console.log(`DIRECTORY-ANALYSIS: ${mode.toUpperCase()} ${analysisType} analysis started for: ${directoryPath}`);
}
/**
 * Logs analysis completion with consistent formatting
 */
function logAnalysisComplete(mode, directoryPath, filesAnalyzed, totalFiles, isInitial, duration) {
    const analysisType = isInitial ? 'Initial' : 'Incremental';
    const durationText = duration ? ` in ${duration}ms` : '';
    console.log(`DIRECTORY-ANALYSIS: ${mode.toUpperCase()} ${analysisType} analysis completed: ${filesAnalyzed}/${totalFiles} files${durationText} - ${directoryPath}`);
}
/**
 * Determines if this is an initial analysis based on previous result
 */
function isInitialAnalysis(previousResult) {
    return !previousResult;
}
//# sourceMappingURL=directoryAnalysisProgress.js.map