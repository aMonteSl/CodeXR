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
exports.resolveAnalyzerScriptPath = resolveAnalyzerScriptPath;
exports.countFileLines = countFileLines;
exports.formatFileSize = formatFileSize;
exports.isSupportedExtension = isSupportedExtension;
exports.createSafeFilename = createSafeFilename;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
/**
 * Shared utility functions for analysis operations
 */
/**
 * Resolves the path to a Python analyzer script using multiple strategies
 * @param scriptName Name of the Python script (e.g., 'python_comment_analyzer.py')
 * @param outputChannel Optional output channel for logging
 * @returns Resolved path to the script
 */
function resolveAnalyzerScriptPath(scriptName, outputChannel) {
    // Use VS Code's extension context to get the correct extension path
    const extension = vscode.extensions.getExtension('aMonteSl.code-xr');
    if (!extension) {
        const errorMsg = 'Extension not found! Cannot resolve script path.';
        outputChannel?.appendLine(errorMsg);
        throw new Error(errorMsg);
    }
    const extensionPath = extension.extensionPath;
    outputChannel?.appendLine(`Extension path: ${extensionPath}`);
    outputChannel?.appendLine(`Looking for script: ${scriptName}`);
    const possiblePaths = [
        // 1. From extension installation directory (most reliable for published extension)
        path.join(extensionPath, 'src', 'analysis', 'python', scriptName),
        // 2. From development directory (for development)
        path.join(extensionPath, 'out', '..', 'src', 'analysis', 'python', scriptName),
        // 3. Alternative bundled location
        path.join(extensionPath, 'python', scriptName),
        // 4. Try workspace folders as fallback
        ...(vscode.workspace.workspaceFolders?.map(folder => path.join(folder.uri.fsPath, 'src', 'analysis', 'python', scriptName)) || [])
    ];
    // Log all paths we're searching (helpful for debugging)
    outputChannel?.appendLine(`Searching for ${scriptName} in:`);
    possiblePaths.forEach(p => outputChannel?.appendLine(` - ${p}`));
    // Check each path and return the first one that exists
    for (const scriptPath of possiblePaths) {
        try {
            if (fs.existsSync(scriptPath)) {
                outputChannel?.appendLine(`✓ Found analyzer script at: ${scriptPath}`);
                return scriptPath;
            }
        }
        catch (error) {
            outputChannel?.appendLine(`✗ Error checking path ${scriptPath}: ${error}`);
        }
    }
    // If we can't find it, return the most likely path so we can show a proper error
    const fallbackPath = path.join(extensionPath, 'src', 'analysis', 'python', scriptName);
    outputChannel?.appendLine(`⚠️ Script not found, using fallback path: ${fallbackPath}`);
    return fallbackPath;
}
/**
 * Gets comment patterns for different file types
 */
function getCommentPatterns(extension) {
    const patterns = {
        // C-style languages
        '.js': { singleLine: ['//'], blockStart: [{ start: '/*', end: '*/' }] },
        '.jsx': { singleLine: ['//'], blockStart: [{ start: '/*', end: '*/' }] },
        '.ts': { singleLine: ['//'], blockStart: [{ start: '/*', end: '*/' }] },
        '.tsx': { singleLine: ['//'], blockStart: [{ start: '/*', end: '*/' }] },
        '.c': { singleLine: ['//'], blockStart: [{ start: '/*', end: '*/' }] },
        '.cpp': { singleLine: ['//'], blockStart: [{ start: '/*', end: '*/' }] },
        '.h': { singleLine: ['//'], blockStart: [{ start: '/*', end: '*/' }] },
        '.hpp': { singleLine: ['//'], blockStart: [{ start: '/*', end: '*/' }] },
        '.java': { singleLine: ['//'], blockStart: [{ start: '/*', end: '*/' }] },
        '.cs': { singleLine: ['//'], blockStart: [{ start: '/*', end: '*/' }] },
        '.go': { singleLine: ['//'], blockStart: [{ start: '/*', end: '*/' }] },
        '.kt': { singleLine: ['//'], blockStart: [{ start: '/*', end: '*/' }] },
        '.scala': { singleLine: ['//'], blockStart: [{ start: '/*', end: '*/' }] },
        '.rs': { singleLine: ['//'], blockStart: [{ start: '/*', end: '*/' }] },
        '.swift': { singleLine: ['//'], blockStart: [{ start: '/*', end: '*/' }] },
        // Python-style
        '.py': { singleLine: ['#'], blockStart: [{ start: '"""', end: '"""' }, { start: "'''", end: "'''" }] },
        // HTML/XML-style
        '.html': { singleLine: [], blockStart: [{ start: '<!--', end: '-->' }] },
        '.vue': { singleLine: ['//'], blockStart: [{ start: '/*', end: '*/' }, { start: '<!--', end: '-->' }] },
        // Ruby
        '.rb': { singleLine: ['#'], blockStart: [{ start: '=begin', end: '=end' }] },
        // PHP
        '.php': { singleLine: ['#', '//'], blockStart: [{ start: '/*', end: '*/' }] },
        // Others
        '.lua': { singleLine: ['--'], blockStart: [{ start: '--[[', end: ']]' }] },
        '.erl': { singleLine: ['%'], blockStart: [] },
        '.pl': { singleLine: ['#'], blockStart: [{ start: '=pod', end: '=cut' }] }
    };
    return patterns[extension] || { singleLine: [], blockStart: [] };
}
/**
 * Counts code, comment, and blank lines in a file
 */
async function countFileLines(filePath) {
    try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        const extension = path.extname(filePath).toLowerCase();
        const patterns = getCommentPatterns(extension);
        let codeLines = 0;
        let commentLines = 0;
        let blankLines = 0;
        let inBlockComment = false;
        let blockCommentEnd = '';
        for (const line of lines) {
            const trimmedLine = line.trim();
            // Check for blank lines
            if (!trimmedLine) {
                blankLines++;
                continue;
            }
            // Check if we're in a block comment
            if (inBlockComment) {
                commentLines++;
                if (trimmedLine.includes(blockCommentEnd)) {
                    inBlockComment = false;
                    blockCommentEnd = '';
                }
                continue;
            }
            // Check for block comment start
            let foundBlockComment = false;
            for (const block of patterns.blockStart) {
                if (trimmedLine.includes(block.start)) {
                    inBlockComment = true;
                    blockCommentEnd = block.end;
                    commentLines++;
                    foundBlockComment = true;
                    // Check if the block comment also ends on the same line
                    if (trimmedLine.includes(block.end) && trimmedLine.indexOf(block.end) > trimmedLine.indexOf(block.start)) {
                        inBlockComment = false;
                        blockCommentEnd = '';
                    }
                    break;
                }
            }
            if (foundBlockComment) {
                continue;
            }
            // Check for single line comments
            let isSingleLineComment = false;
            for (const comment of patterns.singleLine) {
                if (trimmedLine.startsWith(comment)) {
                    commentLines++;
                    isSingleLineComment = true;
                    break;
                }
            }
            if (!isSingleLineComment) {
                codeLines++;
            }
        }
        return {
            total: lines.length,
            code: codeLines,
            comment: commentLines,
            blank: blankLines
        };
    }
    catch (error) {
        throw new Error(`Failed to count lines in file: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Gets file size in bytes and returns formatted string
 */
function formatFileSize(filePath) {
    try {
        const stats = fs.statSync(filePath);
        const bytes = stats.size;
        if (bytes === 0) {
            return '0 B';
        }
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    catch (error) {
        return 'Unknown';
    }
}
/**
 * Checks if a file extension is supported for analysis
 */
function isSupportedExtension(extension) {
    const supportedExtensions = [
        '.py', '.js', '.ts', '.jsx', '.tsx', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp',
        '.cs', '.java', '.rb', '.vue', '.m', '.mm', '.swift', '.ttcn3', '.ttcn', '.3mp',
        '.php', '.phtml', '.php3', '.php4', '.php5', '.phps', '.scala', '.sc', '.gd',
        '.go', '.lua', '.rs', '.f', '.f77', '.f90', '.f95', '.f03', '.f08', '.for',
        '.ftn', '.kt', '.kts', '.sol', '.erl', '.hrl', '.zig', '.pl', '.pm', '.pod', '.t'
    ];
    return supportedExtensions.includes(extension.toLowerCase());
}
/**
 * Creates a safe filename from a potentially unsafe string
 */
function createSafeFilename(filename) {
    return filename
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}
//# sourceMappingURL=analysisUtils.js.map