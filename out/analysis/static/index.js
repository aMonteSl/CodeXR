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
exports.analyzeClassCount = exports.analyzeComments = exports.analyzeLizard = exports.getOpenPanelFiles = exports.closePanelForFile = exports.getOpenPanel = exports.cleanupStaticVisualizations = exports.getStaticVisualizationFolder = exports.createStaticVisualization = void 0;
exports.analyzeFileStatic = analyzeFileStatic;
exports.analyzeFile = analyzeFileStatic;
const vscode = __importStar(require("vscode"));
const lizardAnalyzer_1 = require("./lizardAnalyzer");
Object.defineProperty(exports, "analyzeLizard", { enumerable: true, get: function () { return lizardAnalyzer_1.analyzeLizard; } });
const commentAnalyzer_1 = require("./commentAnalyzer");
Object.defineProperty(exports, "analyzeComments", { enumerable: true, get: function () { return commentAnalyzer_1.analyzeComments; } });
const classAnalyzer_1 = require("./classAnalyzer");
Object.defineProperty(exports, "analyzeClassCount", { enumerable: true, get: function () { return classAnalyzer_1.analyzeClassCount; } });
const generalUtils_1 = require("../utils/generalUtils");
/**
 * Main static analysis manager that orchestrates all static analysis operations
 */
// Output channel for analysis operations
let staticAnalysisOutputChannel;
/**
 * Gets or creates the static analysis output channel
 */
function getOutputChannel() {
    if (!staticAnalysisOutputChannel) {
        staticAnalysisOutputChannel = vscode.window.createOutputChannel('CodeXR Static Analysis');
    }
    return staticAnalysisOutputChannel;
}
/**
 * Performs comprehensive static analysis on a file
 */
async function analyzeFileStatic(filePath, _context) {
    const outputChannel = getOutputChannel();
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
        const { getVenvPath } = require('../../pythonEnv/utils/pathUtils');
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
 * Re-export the new static visualization manager
 */
var staticVisualizationManager_1 = require("./staticVisualizationManager");
Object.defineProperty(exports, "createStaticVisualization", { enumerable: true, get: function () { return staticVisualizationManager_1.createStaticVisualization; } });
Object.defineProperty(exports, "getStaticVisualizationFolder", { enumerable: true, get: function () { return staticVisualizationManager_1.getStaticVisualizationFolder; } });
Object.defineProperty(exports, "cleanupStaticVisualizations", { enumerable: true, get: function () { return staticVisualizationManager_1.cleanupStaticVisualizations; } });
Object.defineProperty(exports, "getOpenPanel", { enumerable: true, get: function () { return staticVisualizationManager_1.getOpenPanel; } });
Object.defineProperty(exports, "closePanelForFile", { enumerable: true, get: function () { return staticVisualizationManager_1.closePanelForFile; } });
Object.defineProperty(exports, "getOpenPanelFiles", { enumerable: true, get: function () { return staticVisualizationManager_1.getOpenPanelFiles; } });
//# sourceMappingURL=index.js.map