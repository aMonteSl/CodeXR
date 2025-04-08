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
exports.analyzeFile = analyzeFile;
exports.analyzeDirectory = analyzeDirectory;
const ts = __importStar(require("typescript"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const locMetrics_1 = require("./metrics/locMetrics");
const commentMetrics_1 = require("./metrics/commentMetrics");
const functionMetrics_1 = require("./metrics/functionMetrics");
/**
 * Analyzes JavaScript/TypeScript code using the TypeScript Compiler API
 * @param filePath Path to the file to analyze
 * @returns Analysis results for the file
 */
async function analyzeFile(filePath) {
    try {
        // Read file content
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        // Parse the file using TypeScript Compiler API
        const sourceFile = ts.createSourceFile(path.basename(filePath), fileContent, ts.ScriptTarget.Latest, true);
        // Calculate metrics
        const metrics = calculateFileMetrics(sourceFile, fileContent);
        // Return analysis result
        return {
            filePath,
            fileName: path.basename(filePath),
            metrics,
            analyzedAt: new Date()
        };
    }
    catch (error) {
        console.error(`Error analyzing file ${filePath}:`, error);
        throw error;
    }
}
/**
 * Analyzes a directory of JavaScript/TypeScript files
 * @param dirPath Path to the directory to analyze
 * @param fileExtensions Array of file extensions to include
 * @returns Analysis results for the directory
 */
async function analyzeDirectory(dirPath, fileExtensions = ['.js', '.jsx', '.ts', '.tsx']) {
    try {
        // Find all matching files in the directory
        const files = findFilesRecursively(dirPath, fileExtensions);
        // Analyze each file
        const fileAnalyses = [];
        for (const file of files) {
            try {
                const analysis = await analyzeFile(file);
                fileAnalyses.push(analysis);
            }
            catch (error) {
                console.error(`Skipping file ${file} due to error:`, error);
            }
        }
        // Calculate aggregate metrics
        const summary = calculateProjectMetrics(fileAnalyses);
        return {
            files: fileAnalyses,
            summary,
            analyzedAt: new Date()
        };
    }
    catch (error) {
        console.error(`Error analyzing directory ${dirPath}:`, error);
        throw error;
    }
}
/**
 * Finds all files in a directory that match the given extensions
 * @param dirPath Directory to search
 * @param extensions File extensions to include
 * @returns Array of file paths
 */
function findFilesRecursively(dirPath, extensions) {
    let results = [];
    // Read all items in the directory
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);
        if (stats.isDirectory()) {
            // Recursively search subdirectories (skip node_modules and .git)
            if (item !== 'node_modules' && item !== '.git') {
                results = results.concat(findFilesRecursively(itemPath, extensions));
            }
        }
        else if (stats.isFile()) {
            // Check if the file has one of the specified extensions
            const ext = path.extname(itemPath).toLowerCase();
            if (extensions.includes(ext)) {
                results.push(itemPath);
            }
        }
    }
    return results;
}
/**
 * Calculates code metrics for a single file
 * @param sourceFile TypeScript source file
 * @param fileContent File content as string
 * @returns Code metrics
 */
function calculateFileMetrics(sourceFile, fileContent) {
    // Get line metrics
    const lineMetrics = (0, locMetrics_1.countLines)(fileContent);
    const totalLines = lineMetrics.total;
    const blankLines = lineMetrics.blank;
    // Get function and class metrics
    const functionMetrics = (0, functionMetrics_1.countFunctionsAndClasses)(sourceFile);
    const functionCount = functionMetrics.functionCount;
    const classCount = functionMetrics.classCount;
    // Get comment metrics
    const comments = (0, commentMetrics_1.getAllComments)(sourceFile, fileContent);
    let commentLines = (0, commentMetrics_1.calculateCommentLines)(comments, fileContent);
    // Ensure commentLines doesn't exceed the possible maximum
    commentLines = Math.min(commentLines, totalLines - blankLines);
    // Calculate code lines (non-blank, non-comment)
    // Ensure codeLines never goes negative
    const codeLines = Math.max(0, totalLines - blankLines - commentLines);
    return {
        totalLines,
        codeLines,
        blankLines,
        commentLines,
        functionCount,
        classCount
    };
}
/**
 * Calculates aggregate metrics for a project
 * @param fileAnalyses Array of file analyses
 * @returns Aggregated code metrics
 */
function calculateProjectMetrics(fileAnalyses) {
    const summary = {
        totalLines: 0,
        codeLines: 0,
        blankLines: 0,
        commentLines: 0,
        functionCount: 0,
        classCount: 0
    };
    for (const analysis of fileAnalyses) {
        summary.totalLines += analysis.metrics.totalLines;
        summary.codeLines += analysis.metrics.codeLines;
        summary.blankLines += analysis.metrics.blankLines;
        summary.commentLines += analysis.metrics.commentLines;
        summary.functionCount += analysis.metrics.functionCount;
        summary.classCount += analysis.metrics.classCount;
    }
    // Sanity check: ensure all values are non-negative
    Object.keys(summary).forEach(key => {
        const metricKey = key;
        if (typeof summary[metricKey] === 'number' && summary[metricKey] < 0) {
            console.warn(`Correcting negative value for ${metricKey}: ${summary[metricKey]}`);
            summary[metricKey] = 0;
        }
    });
    return summary;
}
//# sourceMappingURL=codeAnalyzer.js.map