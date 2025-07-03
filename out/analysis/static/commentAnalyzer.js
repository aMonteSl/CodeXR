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
exports.analyzeComments = analyzeComments;
const path = __importStar(require("path"));
const pathUtils_1 = require("../../pythonEnv/utils/pathUtils");
const processUtils_1 = require("../../pythonEnv/utils/processUtils");
const analysisUtils_1 = require("../utils/analysisUtils");
/**
 * Comment analyzer for extracting comment statistics from code files
 */
/**
 * Analyzes comments in a file using the appropriate analyzer
 */
async function analyzeComments(filePath, outputChannel) {
    try {
        const ext = path.extname(filePath).toLowerCase();
        if (!(0, analysisUtils_1.isSupportedExtension)(ext)) {
            outputChannel.appendLine(`Skipping comment analysis for unsupported file type: ${ext}`);
            return 0;
        }
        outputChannel.appendLine(`[DEBUG] Starting comment analysis for ${filePath} with extension ${ext}`);
        // Verify that virtual environment and Python exist
        const venvPath = (0, pathUtils_1.getVenvPath)();
        if (!venvPath) {
            outputChannel.appendLine('[ERROR] No virtual environment found');
            return 0;
        }
        const pythonPath = (0, pathUtils_1.getPythonExecutable)(venvPath);
        outputChannel.appendLine(`[DEBUG] Using Python executable: ${pythonPath}`);
        const scriptPath = (0, analysisUtils_1.resolveAnalyzerScriptPath)('python_comment_analyzer.py', outputChannel);
        outputChannel.appendLine(`[DEBUG] Using analyzer script: ${scriptPath}`);
        // Log file content preview for debugging
        try {
            const fs = require('fs');
            const fileContent = await fs.promises.readFile(filePath, 'utf8');
            const preview = fileContent.split('\n').slice(0, 3).join('\n');
            outputChannel.appendLine(`[DEBUG] File preview (first 3 lines): ${preview}`);
        }
        catch (e) {
            outputChannel.appendLine(`[DEBUG] Could not read file for preview: ${e}`);
        }
        // Execute the Python analyzer
        const output = await (0, processUtils_1.executeCommand)(pythonPath, [scriptPath, filePath], { showOutput: false });
        outputChannel.appendLine(`[DEBUG] Raw output from Python script: ${output}`);
        let result;
        try {
            result = JSON.parse(output);
            outputChannel.appendLine(`[DEBUG] Parsed result: ${JSON.stringify(result)}`);
        }
        catch (jsonError) {
            outputChannel.appendLine(`[ERROR] Failed to parse JSON output: ${jsonError}`);
            outputChannel.appendLine(`[ERROR] Raw output: ${output}`);
            return 0;
        }
        if (result.error) {
            outputChannel.appendLine(`Warning: ${result.error}`);
            return 0;
        }
        outputChannel.appendLine(`Found ${result.commentLines} comment lines in ${path.basename(filePath)} (${ext})`);
        return result.commentLines;
    }
    catch (error) {
        outputChannel.appendLine(`[ERROR] Error analyzing comments: ${error instanceof Error ? error.message : String(error)}`);
        outputChannel.appendLine(`[ERROR] Stack trace: ${error instanceof Error ? error.stack : 'No stack trace available'}`);
        return 0;
    }
}
//# sourceMappingURL=commentAnalyzer.js.map