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
exports.getLanguageName = getLanguageName;
exports.countFileLines = countFileLines;
exports.getFileSize = getFileSize;
exports.formatFileSize = formatFileSize;
exports.classifyComplexity = classifyComplexity;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Resolves the path to a Python analyzer script using multiple strategies
 * @param scriptName Name of the Python script (e.g., 'python_comment_analyzer.py')
 * @param outputChannel Optional output channel for logging
 * @returns Resolved path to the script
 */
function resolveAnalyzerScriptPath(scriptName, outputChannel) {
    // Get the extension path if possible (most reliable method)
    const extensionPath = vscode.extensions.getExtension('codexr')?.extensionPath;
    // The most reliable path is the one relative to the project root 
    const projectRootPath = path.resolve(__dirname, '..', '..');
    const possiblePaths = [
        // 1. Project root based path - most reliable in development
        path.join(projectRootPath, 'src', 'analysis', 'python', scriptName),
        // 2. Try using extension path 
        ...(extensionPath ? [path.join(extensionPath, 'src', 'analysis', 'python', scriptName)] : []),
        // 3. Try relative to the current module's directory
        path.join(__dirname, 'python', scriptName),
        // 4. Try parent directory
        path.join(__dirname, '..', 'analysis', 'python', scriptName),
        // 5. Try two levels up (from out/ to src/)
        path.join(__dirname, '..', '..', 'src', 'analysis', 'python', scriptName),
        // 6. Try workspace folders
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
        catch (e) {
            // Ignore errors during path checking
        }
    }
    // Log the issue if we couldn't find the script
    const errorMsg = `Could not find Python analyzer script: ${scriptName}. Please ensure scripts are installed correctly.`;
    outputChannel?.appendLine(`❌ ${errorMsg}`);
    // Return a path relative to the project root as a last resort
    return path.join(projectRootPath, 'src', 'analysis', 'python', scriptName);
}
/**
 * Gets the language name based on file extension
 */
function getLanguageName(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.js':
            return 'JavaScript';
        case '.ts':
            return 'TypeScript';
        case '.jsx':
            return 'JavaScript (JSX)';
        case '.tsx':
            return 'TypeScript (TSX)';
        case '.py':
            return 'Python';
        case '.c':
            return 'C';
        case '.h':
            return 'C Header';
        // ✅ FIX: Ensure C++ extensions return exact "C++" language name
        case '.cpp':
        case '.cc':
        case '.cxx':
        case '.c++':
            return 'C++';
        case '.hpp':
        case '.hxx':
        case '.h++':
            return 'C++ Header';
        // ✅ FIX: Ensure C# extension returns exact "C#" language name
        case '.cs':
            return 'C#';
        case '.vue':
            return 'Vue';
        case '.rb':
            return 'Ruby';
        default:
            return 'Unknown';
    }
}
/**
 * Counts code, comment, and blank lines
 * @param filePath Path to file
 * @returns Line count information
 */
async function countFileLines(filePath) {
    try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const lines = content.split(/\r?\n/);
        let codeLines = 0;
        let commentLines = 0;
        let blankLines = 0;
        // Track multi-line comment state
        let inMultilineComment = false;
        for (const line of lines) {
            const trimmedLine = line.trim();
            // Blank line check
            if (trimmedLine === '') {
                blankLines++;
                continue;
            }
            // Language-specific comment detection
            const ext = path.extname(filePath).toLowerCase();
            // Handle multi-line comments
            if (inMultilineComment) {
                commentLines++;
                if ((ext === '.js' || ext === '.ts' || ext === '.c' || ext === '.h') &&
                    trimmedLine.includes('*/')) {
                    inMultilineComment = false;
                }
                continue;
            }
            // Single line comments
            if ((ext === '.js' || ext === '.ts') && trimmedLine.startsWith('//')) {
                commentLines++;
            }
            else if (ext === '.py' && trimmedLine.startsWith('#')) {
                commentLines++;
            }
            else if ((ext === '.c' || ext === '.h') && trimmedLine.startsWith('//')) {
                commentLines++;
            }
            // Multi-line comment start
            else if ((ext === '.js' || ext === '.ts' || ext === '.c' || ext === '.h') &&
                trimmedLine.startsWith('/*')) {
                commentLines++;
                if (!trimmedLine.includes('*/')) {
                    inMultilineComment = true;
                }
            }
            // Code line
            else {
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
        console.error(`Error counting lines in ${filePath}:`, error);
        return {
            total: 0,
            code: 0,
            comment: 0,
            blank: 0
        };
    }
}
/**
 * Gets file size in bytes
 * @param filePath Path to file
 * @returns File size in bytes
 */
async function getFileSize(filePath) {
    try {
        const stats = await fs.promises.stat(filePath);
        return stats.size;
    }
    catch (error) {
        console.error(`Error getting file size for ${filePath}:`, error);
        return 0;
    }
}
/**
 * Formats a file size for display
 * @param bytes Size in bytes
 * @returns Human-readable size string
 */
function formatFileSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} bytes`;
    }
    else if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    else {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
}
/**
 * Determines if a function's complexity is concerning
 * @param complexity Cyclomatic complexity value
 * @returns Classification of complexity
 */
function classifyComplexity(complexity) {
    if (complexity <= 5) {
        return 'low';
    }
    else if (complexity <= 10) {
        return 'medium';
    }
    else if (complexity <= 25) {
        return 'high';
    }
    else {
        return 'critical';
    }
}
//# sourceMappingURL=utils.js.map