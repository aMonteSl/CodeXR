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
exports.analyzeFileStatic = analyzeFileStatic;
exports.analyzeFilesBatch = analyzeFilesBatch;
const vscode = __importStar(require("vscode"));
const lizardAnalyzer_1 = require("../lizardAnalyzer");
const commentAnalyzer_1 = require("../commentAnalyzer");
const classAnalyzer_1 = require("../classAnalyzer");
const generalUtils_1 = require("../../utils/generalUtils");
/**
 * File-based static analysis manager
 * Handles comprehensive static analysis of individual files
 */
// Output channel for file analysis operations
let fileAnalysisOutputChannel;
/**
 * Creates a dummy output channel that doesn't output anything
 */
class SilentOutputChannel {
    name = 'Silent';
    append() {
        // Do nothing
    }
    appendLine() {
        // Do nothing
    }
    replace() {
        // Do nothing
    }
    clear() {
        // Do nothing
    }
    show() {
        // Do nothing
    }
    hide() {
        // Do nothing
    }
    dispose() {
        // Do nothing
    }
}
/**
 * Gets or creates the file analysis output channel
 */
function getOutputChannel() {
    if (!fileAnalysisOutputChannel) {
        fileAnalysisOutputChannel = vscode.window.createOutputChannel('CodeXR File Analysis');
    }
    return fileAnalysisOutputChannel;
}
/**
 * Performs comprehensive static analysis on a single file
 * @param filePath Path to the file to analyze
 * @param context VS Code extension context
 * @param silent Whether to suppress output channel logging (useful for batch operations)
 * @returns FileAnalysisResult or undefined if analysis fails
 */
async function analyzeFileStatic(filePath, _context, silent = false) {
    const outputChannel = silent ? new SilentOutputChannel() : getOutputChannel();
    try {
        outputChannel.appendLine(`\n🔍 Starting static analysis for: ${filePath}`);
        // Extract basic file information
        const fileName = require('path').basename(filePath);
        const language = (0, generalUtils_1.getLanguageName)(filePath);
        const fileSize = (0, generalUtils_1.formatFileSize)(filePath);
        outputChannel.appendLine(`📁 File: ${fileName}`);
        outputChannel.appendLine(`🏷️ Language: ${language}`);
        outputChannel.appendLine(`📊 Size: ${fileSize}`);
        // Analyze file lines
        outputChannel.appendLine(`📏 Analyzing file structure...`);
        const lineInfo = await (0, generalUtils_1.countFileLines)(filePath);
        outputChannel.appendLine(`   Total lines: ${lineInfo.total}`);
        outputChannel.appendLine(`   Code lines: ${lineInfo.code}`);
        outputChannel.appendLine(`   Comment lines: ${lineInfo.comment}`);
        outputChannel.appendLine(`   Blank lines: ${lineInfo.blank}`);
        // Initialize default values
        let functions = [];
        let complexity = {
            averageComplexity: 0,
            maxComplexity: 0,
            functionCount: 0,
            highComplexityFunctions: 0,
            criticalComplexityFunctions: 0
        };
        // Try Lizard analysis (with better error handling)
        const fs = require('fs');
        const { getVenvPath } = require('../../../pythonEnv/utils/pathUtils');
        const venvPath = getVenvPath();
        if (venvPath && fs.existsSync(venvPath)) {
            try {
                outputChannel.appendLine('🐍 Python environment found, running Lizard analysis...');
                const lizardResult = await (0, lizardAnalyzer_1.analyzeLizard)(filePath, outputChannel);
                if (lizardResult && lizardResult.functions.length > 0) {
                    functions = lizardResult.functions;
                    complexity = lizardResult.metrics;
                    outputChannel.appendLine(`✅ Lizard analysis completed: ${functions.length} functions found`);
                }
                else {
                    outputChannel.appendLine('⚠️ Lizard analysis returned no functions');
                }
            }
            catch (error) {
                outputChannel.appendLine(`⚠️ Lizard analysis failed: ${error instanceof Error ? error.message : String(error)}`);
                outputChannel.appendLine('📊 Continuing with basic analysis...');
                // Fallback to basic analysis without Lizard
                functions = [];
                complexity = {
                    averageComplexity: 0,
                    maxComplexity: 0,
                    functionCount: 0,
                    highComplexityFunctions: 0,
                    criticalComplexityFunctions: 0
                };
            }
        }
        else {
            outputChannel.appendLine('⚠️ No Python virtual environment found. Skipping Lizard analysis...');
        }
        // Analyze comments (with better error handling)
        let commentLines = 0;
        try {
            commentLines = await (0, commentAnalyzer_1.analyzeComments)(filePath, outputChannel);
            outputChannel.appendLine(`💬 Comments: ${commentLines} lines`);
        }
        catch (error) {
            outputChannel.appendLine(`⚠️ Comment analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        // Analyze classes (with better error handling)
        let classCount = 0;
        try {
            classCount = await (0, classAnalyzer_1.analyzeClassCount)(filePath, outputChannel);
            outputChannel.appendLine(`🏛️ Classes: ${classCount}`);
        }
        catch (error) {
            outputChannel.appendLine(`⚠️ Class analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        // Build final result
        const result = {
            fileName,
            filePath,
            language,
            fileSize,
            totalLines: lineInfo.total,
            codeLines: lineInfo.code,
            commentLines: Math.max(commentLines, lineInfo.comment),
            blankLines: lineInfo.blank,
            functions,
            functionCount: functions.length,
            classCount,
            complexity,
            timestamp: (0, generalUtils_1.getCurrentTimestamp)()
        };
        outputChannel.appendLine(`✅ Static analysis completed for ${fileName}`);
        outputChannel.appendLine(`📊 Summary: ${result.functionCount} functions, ${result.classCount} classes, complexity avg: ${result.complexity.averageComplexity}`);
        return result;
    }
    catch (error) {
        const errorMessage = (0, generalUtils_1.createAnalysisError)('Static analysis', error instanceof Error ? error : new Error(String(error)));
        outputChannel.appendLine(`❌ ${errorMessage}`);
        return {
            fileName: require('path').basename(filePath),
            filePath,
            language: (0, generalUtils_1.getLanguageName)(filePath),
            fileSize: (0, generalUtils_1.formatFileSize)(filePath),
            totalLines: 0,
            codeLines: 0,
            commentLines: 0,
            blankLines: 0,
            functions: [],
            functionCount: 0,
            classCount: 0,
            complexity: {
                averageComplexity: 0,
                maxComplexity: 0,
                functionCount: 0,
                highComplexityFunctions: 0,
                criticalComplexityFunctions: 0
            },
            timestamp: (0, generalUtils_1.getCurrentTimestamp)(),
            error: errorMessage
        };
    }
}
/**
 * Analyzes multiple files in batch with progress reporting
 * @param filePaths Array of file paths to analyze
 * @param context VS Code extension context
 * @param progressCallback Optional callback to report progress
 * @returns Array of FileAnalysisResult
 */
async function analyzeFilesBatch(filePaths, context, progressCallback) {
    const results = [];
    for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i];
        if (progressCallback) {
            progressCallback(i + 1, filePaths.length, filePath);
        }
        try {
            const result = await analyzeFileStatic(filePath, context, true); // Silent mode for batch
            if (result) {
                results.push(result);
            }
        }
        catch (error) {
            // Continue with other files even if one fails
            console.error(`Failed to analyze ${filePath}:`, error);
        }
    }
    return results;
}
//# sourceMappingURL=fileAnalysisManager.js.map