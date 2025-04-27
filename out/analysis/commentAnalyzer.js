"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzePythonComments = analyzePythonComments;
const pathUtils_1 = require("../pythonEnv/utils/pathUtils");
const processUtils_1 = require("../pythonEnv/utils/processUtils");
const utils_1 = require("./utils");
/**
 * Analyzes Python comments in a file
 * @param filePath Path to the Python file
 * @param outputChannel Output channel for logging
 * @returns Comment line count and docstring count or default values on error
 */
async function analyzePythonComments(filePath, outputChannel) {
    const venvPath = (0, pathUtils_1.getVenvPath)();
    if (!venvPath) {
        outputChannel.appendLine('Python environment not found');
        return { commentCount: 0, docstringCount: 0 };
    }
    const pythonPath = (0, pathUtils_1.getPythonExecutable)(venvPath);
    try {
        outputChannel.appendLine(`Analyzing Python comments...`);
        // Use the utility function to get the correct script path
        const analyzerScriptPath = (0, utils_1.resolveAnalyzerScriptPath)('python_comment_analyzer.py', outputChannel);
        outputChannel.appendLine(`Using comment analyzer script at: ${analyzerScriptPath}`);
        const output = await (0, processUtils_1.executeCommand)(pythonPath, [analyzerScriptPath, filePath], { showOutput: false });
        const result = JSON.parse(output);
        return {
            commentCount: result.commentLines || 0,
            docstringCount: result.docstringCount || 0
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Error analyzing Python comments: ${errorMessage}`);
        return { commentCount: 0, docstringCount: 0 };
    }
}
//# sourceMappingURL=commentAnalyzer.js.map