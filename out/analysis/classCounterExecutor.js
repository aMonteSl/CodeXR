"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeClassCount = analyzeClassCount;
const pathUtils_1 = require("../pythonEnv/utils/pathUtils");
const processUtils_1 = require("../pythonEnv/utils/processUtils");
const utils_1 = require("./utils");
/**
 * Analyzes class count in a file
 * @param filePath Path to the file
 * @param outputChannel Output channel for logging
 * @returns Number of classes found
 */
async function analyzeClassCount(filePath, outputChannel) {
    const venvPath = (0, pathUtils_1.getVenvPath)();
    if (!venvPath) {
        outputChannel.appendLine('Python environment not found');
        return 0;
    }
    const pythonPath = (0, pathUtils_1.getPythonExecutable)(venvPath);
    try {
        outputChannel.appendLine(`Analyzing class declarations...`);
        // Use the utility function to get the correct script path
        const analyzerScriptPath = (0, utils_1.resolveAnalyzerScriptPath)('class_counter_analyzer.py', outputChannel);
        outputChannel.appendLine(`Using class analyzer script at: ${analyzerScriptPath}`);
        const output = await (0, processUtils_1.executeCommand)(pythonPath, [analyzerScriptPath, filePath], { showOutput: false });
        const result = JSON.parse(output);
        return result.classCount || 0;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Error analyzing class declarations: ${errorMessage}`);
        return 0;
    }
}
//# sourceMappingURL=classCounterExecutor.js.map