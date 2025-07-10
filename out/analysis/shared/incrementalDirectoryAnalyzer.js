"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncrementalDirectoryAnalyzer = void 0;
const hashBasedChangeDetector_1 = require("./hashBasedChangeDetector");
const static_1 = require("../static");
const scanUtils_1 = require("../static/utils/scanUtils");
/**
 * Shared incremental directory analysis utility
 * Used by both static and XR directory analysis modes for efficient hash-based re-analysis
 */
class IncrementalDirectoryAnalyzer {
    /**
     * Performs incremental analysis on a directory using hash-based change detection
     * @param directoryPath Directory to analyze
     * @param includeSubdirectories Whether to include subdirectories
     * @param previousResult Previous analysis result (for comparison)
     * @param progressCallback Progress reporting callback
     * @returns Updated analysis result with only changed files re-analyzed
     */
    static async performIncrementalAnalysis(directoryPath, includeSubdirectories, previousResult, progressCallback) {
        console.log(`DIRECTORY-ANALYSIS: Starting incremental analysis for: ${directoryPath}`);
        // Step 1: Scan current directory for all files with hashes
        const scanResult = await (0, scanUtils_1.scanDirectoryWithCounts)(directoryPath, {
            ...scanUtils_1.DEFAULT_FILTERS,
            maxDepth: includeSubdirectories ? 10 : 1
        });
        const currentFiles = scanResult.analyzableFiles;
        console.log(`DIRECTORY-ANALYSIS: Scanned ${currentFiles.length} current files`);
        // Step 2: If no previous result, analyze all files (initial analysis)
        if (!previousResult) {
            console.log(`DIRECTORY-ANALYSIS: No previous result, analyzing all ${currentFiles.length} files`);
            return await this.analyzeAllFiles(directoryPath, currentFiles, progressCallback);
        }
        // Step 3: Detect changes using hash comparison
        const changes = this.detectFileChanges(currentFiles, previousResult);
        const addedFiles = changes.filter(c => c.changeType === 'added').length;
        const modifiedFiles = changes.filter(c => c.changeType === 'modified').length;
        const deletedFiles = changes.filter(c => c.changeType === 'deleted').length;
        const unchangedFiles = changes.filter(c => c.changeType === 'unchanged').length;
        console.log(`DIRECTORY-ANALYSIS: Change detection results:`);
        console.log(`  ➕ Added: ${addedFiles} files`);
        console.log(`  📝 Modified: ${modifiedFiles} files`);
        console.log(`  ➖ Deleted: ${deletedFiles} files`);
        console.log(`  ✅ Unchanged: ${unchangedFiles} files`);
        // Step 4: If no changes, return previous result
        const hasChanges = addedFiles > 0 || modifiedFiles > 0 || deletedFiles > 0;
        if (!hasChanges) {
            console.log(`DIRECTORY-ANALYSIS: No changes detected, returning previous result`);
            return previousResult;
        }
        // Step 5: Get files that need analysis (only added/modified)
        const filesToAnalyze = this.getFilesToAnalyze(currentFiles, changes);
        console.log(`DIRECTORY-ANALYSIS: Analyzing ${filesToAnalyze.length} changed files (skipping ${unchangedFiles} unchanged)`);
        // Step 6: Analyze only changed files
        const { fileMetrics: newFileMetrics, functions: newFunctions } = await this.analyzeFiles(filesToAnalyze, directoryPath, progressCallback);
        // Step 7: Merge with unchanged files from previous result
        const mergedFileMetrics = this.mergeFileMetrics(newFileMetrics, currentFiles, previousResult);
        const mergedFunctions = this.mergeFunctionData(newFunctions, previousResult, filesToAnalyze.map(f => f.filePath));
        // Step 8: Build final result
        const result = this.buildAnalysisResult(directoryPath, mergedFileMetrics, mergedFunctions, includeSubdirectories);
        console.log(`DIRECTORY-ANALYSIS: Incremental analysis complete - ${result.summary.totalFilesAnalyzed} files total`);
        return result;
    }
    /**
     * Detects file changes using hash comparison
     */
    static detectFileChanges(currentFiles, previousResult) {
        // Convert FileInfo to FileWithHash format
        const currentFilesWithHash = currentFiles.map(file => ({
            relativePath: file.relativePath,
            filePath: file.filePath,
            fileHash: file.hash
        }));
        // Convert previous result to FileWithHash format
        const previousFilesWithHash = hashBasedChangeDetector_1.HashBasedChangeDetector.convertFromFileMetrics(previousResult.files);
        // Use shared hash-based change detection
        return hashBasedChangeDetector_1.HashBasedChangeDetector.generateChangeInfo(previousResult.summary.directoryPath, currentFilesWithHash, previousFilesWithHash);
    }
    /**
     * Gets files that need to be analyzed (added/modified only)
     */
    static getFilesToAnalyze(scannedFiles, changes) {
        const changedFilePaths = changes
            .filter(c => c.changeType === 'added' || c.changeType === 'modified')
            .map(c => c.filePath);
        return scannedFiles.filter(f => changedFilePaths.includes(f.filePath));
    }
    /**
     * Analyzes all files (for initial analysis)
     */
    static async analyzeAllFiles(directoryPath, files, progressCallback) {
        const { fileMetrics, functions } = await this.analyzeFiles(files, directoryPath, progressCallback);
        return this.buildAnalysisResult(directoryPath, fileMetrics, functions, false);
    }
    /**
     * Analyzes individual files
     */
    static async analyzeFiles(files, directoryPath, progressCallback) {
        const fileMetrics = [];
        const functions = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileStartTime = Date.now();
            // Report progress if callback is set
            if (progressCallback) {
                progressCallback(i + 1, files.length, file.filePath);
            }
            try {
                // Use existing file analysis logic
                const analysisResult = await (0, static_1.analyzeFileStatic)(file.filePath, {});
                if (analysisResult) {
                    const metrics = {
                        fileName: file.fileName,
                        filePath: file.filePath,
                        relativePath: file.relativePath,
                        extension: file.extension,
                        language: file.language,
                        fileHash: file.hash,
                        fileSizeBytes: file.sizeBytes,
                        totalLines: analysisResult.totalLines,
                        commentLines: analysisResult.commentLines,
                        functionCount: analysisResult.functions.length,
                        classCount: analysisResult.classCount || 0,
                        meanComplexity: this.calculateMeanComplexity(analysisResult.functions),
                        meanDensity: this.calculateMeanDensity(analysisResult.functions),
                        meanParameters: this.calculateMeanParameters(analysisResult.functions),
                        analyzedAt: new Date().toISOString(),
                        analysisDuration: Date.now() - fileStartTime
                    };
                    fileMetrics.push(metrics);
                    // Collect function data from this file
                    if (analysisResult.functions && analysisResult.functions.length > 0) {
                        for (const func of analysisResult.functions) {
                            const functionMetric = {
                                name: func.name || 'unnamed',
                                filePath: file.filePath,
                                relativeFilePath: file.relativePath,
                                startLine: func.lineStart || 0,
                                endLine: func.lineEnd || 0,
                                length: func.lineCount || 0,
                                parameters: func.parameters || 0,
                                complexity: func.complexity || 0,
                                cyclomaticDensity: func.cyclomaticDensity || 0,
                                language: file.language
                            };
                            functions.push(functionMetric);
                        }
                    }
                }
            }
            catch (error) {
                console.warn(`DIRECTORY-ANALYSIS: Error analyzing file ${file.filePath}:`, error);
            }
        }
        return { fileMetrics, functions };
    }
    /**
     * Merges new file metrics with unchanged files from previous result
     */
    static mergeFileMetrics(analyzedFiles, allScannedFiles, previousResult) {
        const analyzedMap = new Map(analyzedFiles.map(f => [f.filePath, f]));
        const previousMap = new Map(previousResult.files.map(f => [f.filePath, f]));
        const mergedFiles = [];
        for (const scannedFile of allScannedFiles) {
            const analyzed = analyzedMap.get(scannedFile.filePath);
            if (analyzed) {
                // Use newly analyzed file
                mergedFiles.push(analyzed);
            }
            else {
                // Use previous analysis result (unchanged file)
                const previous = previousMap.get(scannedFile.filePath);
                if (previous) {
                    mergedFiles.push(previous);
                }
            }
        }
        return mergedFiles;
    }
    /**
     * Merges function data with previous results
     */
    static mergeFunctionData(newFunctions, previousResult, reanalyzedFilePaths) {
        const reanalyzedFileSet = new Set(reanalyzedFilePaths);
        const allFunctions = [];
        // Add functions from previous result for files that weren't re-analyzed
        for (const func of previousResult.functions || []) {
            if (!reanalyzedFileSet.has(func.filePath)) {
                allFunctions.push(func);
            }
        }
        // Add all new functions from re-analyzed files
        allFunctions.push(...newFunctions);
        return allFunctions;
    }
    /**
     * Builds the final analysis result
     */
    static buildAnalysisResult(directoryPath, fileMetrics, functions, includeSubdirectories) {
        const totalFiles = fileMetrics.length;
        const totalFilesAnalyzed = fileMetrics.filter(f => f.analyzedAt).length;
        const totalFunctions = functions.length;
        const totalClasses = fileMetrics.reduce((sum, f) => sum + f.classCount, 0);
        // Calculate averages
        const averageComplexity = this.calculateMeanComplexity(functions);
        const averageDensity = this.calculateMeanDensity(functions);
        const averageParameters = this.calculateMeanParameters(functions);
        // Calculate language distribution
        const languageDistribution = {};
        fileMetrics.forEach(file => {
            languageDistribution[file.language] = (languageDistribution[file.language] || 0) + 1;
        });
        // Calculate file size distribution
        const fileSizeDistribution = {
            small: fileMetrics.filter(f => f.fileSizeBytes < 1024).length,
            medium: fileMetrics.filter(f => f.fileSizeBytes >= 1024 && f.fileSizeBytes < 10240).length,
            large: fileMetrics.filter(f => f.fileSizeBytes >= 10240 && f.fileSizeBytes < 102400).length,
            huge: fileMetrics.filter(f => f.fileSizeBytes >= 102400).length
        };
        // Calculate complexity distribution
        const complexityDistribution = {
            low: functions.filter(f => f.complexity <= 5).length,
            medium: functions.filter(f => f.complexity > 5 && f.complexity <= 10).length,
            high: functions.filter(f => f.complexity > 10 && f.complexity <= 20).length,
            critical: functions.filter(f => f.complexity > 20).length
        };
        return {
            summary: {
                directoryPath,
                totalFiles,
                totalFilesAnalyzed,
                totalFilesNotAnalyzed: totalFiles - totalFilesAnalyzed,
                totalLines: fileMetrics.reduce((sum, f) => sum + f.totalLines, 0),
                totalCommentLines: fileMetrics.reduce((sum, f) => sum + f.commentLines, 0),
                totalFunctions,
                totalClasses,
                averageComplexity,
                averageDensity,
                averageParameters,
                languageDistribution,
                fileSizeDistribution,
                complexityDistribution,
                analyzedAt: new Date().toISOString(),
                totalDuration: 0 // Will be calculated by caller
            },
            files: fileMetrics,
            functions,
            metadata: {
                version: '1.0.0',
                mode: 'directory'
            }
        };
    }
    /**
     * Helper methods for complexity calculations
     */
    static calculateMeanComplexity(functions) {
        if (functions.length === 0) {
            return 0;
        }
        const total = functions.reduce((sum, f) => sum + (f.complexity || 0), 0);
        return Number((total / functions.length).toFixed(2));
    }
    static calculateMeanDensity(functions) {
        if (functions.length === 0) {
            return 0;
        }
        const total = functions.reduce((sum, f) => sum + (f.cyclomaticDensity || 0), 0);
        return Number((total / functions.length).toFixed(2));
    }
    static calculateMeanParameters(functions) {
        if (functions.length === 0) {
            return 0;
        }
        const total = functions.reduce((sum, f) => sum + (f.parameters || 0), 0);
        return Number((total / functions.length).toFixed(2));
    }
}
exports.IncrementalDirectoryAnalyzer = IncrementalDirectoryAnalyzer;
//# sourceMappingURL=incrementalDirectoryAnalyzer.js.map