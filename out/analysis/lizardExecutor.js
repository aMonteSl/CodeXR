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
exports.isLizardAvailable = isLizardAvailable;
exports.ensureLizardAvailable = ensureLizardAvailable;
exports.analyzeLizard = analyzeLizard;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const pathUtils_1 = require("../pythonEnv/utils/pathUtils");
const processUtils_1 = require("../pythonEnv/utils/processUtils");
const commands_1 = require("../pythonEnv/commands");
/**
 * Checks if lizard is available in the Python environment
 * @returns True if lizard is available
 */
async function isLizardAvailable() {
    if (!(0, pathUtils_1.venvExists)()) {
        return false;
    }
    const venvPath = (0, pathUtils_1.getVenvPath)();
    if (!venvPath) {
        return false;
    }
    const pythonPath = (0, pathUtils_1.getPythonExecutable)(venvPath);
    try {
        // Simple version check
        await (0, processUtils_1.executeCommand)(pythonPath, ['-m', 'lizard', '--version']);
        return true;
    }
    catch (error) {
        console.error('Error checking lizard availability:', error);
        return false;
    }
}
/**
 * Ensures lizard is available, setting up if needed
 * @param outputChannel Output channel for logs
 * @returns Whether lizard is available
 */
async function ensureLizardAvailable(outputChannel) {
    if (await isLizardAvailable()) {
        return true;
    }
    outputChannel.appendLine('Lizard not found. Setting up Python environment...');
    try {
        await (0, commands_1.setupPythonEnvironment)(true);
        // Check again after setup
        return await isLizardAvailable();
    }
    catch (error) {
        outputChannel.appendLine(`Error setting up lizard: ${error}`);
        return false;
    }
}
/**
 * Runs lizard analysis on a file using our custom Python script
 * @param filePath Path to the file to analyze
 * @param outputChannel Output channel for logs
 * @returns Object containing functions and metrics, or undefined on error
 */
async function analyzeLizard(filePath, outputChannel) {
    // Ensure lizard is available
    const available = await ensureLizardAvailable(outputChannel);
    if (!available) {
        outputChannel.appendLine('Lizard is not available. Cannot perform advanced analysis.');
        return undefined;
    }
    const venvPath = (0, pathUtils_1.getVenvPath)();
    if (!venvPath) {
        outputChannel.appendLine('Python environment not found');
        return undefined;
    }
    const pythonPath = (0, pathUtils_1.getPythonExecutable)(venvPath);
    try {
        outputChannel.appendLine(`Running lizard analysis on ${path.basename(filePath)}...`);
        // FIXED: Use correct path resolution that doesn't depend on extension path
        // First try extension path, then fall back to direct path if needed
        let analyzerScriptPath = '';
        // Method 1: Try to get from extension
        try {
            const extPath = vscode.extensions.getExtension('codexr')?.extensionPath;
            if (extPath) {
                analyzerScriptPath = path.join(extPath, 'src', 'analysis', 'python', 'lizard_analyzer.py');
                // Verify file exists
                if (!require('fs').existsSync(analyzerScriptPath)) {
                    analyzerScriptPath = ''; // Reset if not found
                }
            }
        }
        catch (e) {
            outputChannel.appendLine(`Extension path resolution failed: ${e}`);
        }
        // Method 2: Try to use __dirname-based path
        if (!analyzerScriptPath || !require('fs').existsSync(analyzerScriptPath)) {
            // Get directory of current file
            const currentDir = __dirname;
            // Use the known working path directly
            const analyzerRelativePath = path.join(currentDir, '..', '..', 'src', 'analysis', 'python', 'lizard_analyzer.py');
            if (require('fs').existsSync(analyzerRelativePath)) {
                analyzerScriptPath = analyzerRelativePath;
            }
        }
        // Method 3: Try to resolve from the workspace folders
        if (!analyzerScriptPath || !require('fs').existsSync(analyzerScriptPath)) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                for (const folder of workspaceFolders) {
                    const possiblePath = path.join(folder.uri.fsPath, 'src', 'analysis', 'python', 'lizard_analyzer.py');
                    if (require('fs').existsSync(possiblePath)) {
                        analyzerScriptPath = possiblePath;
                        break;
                    }
                }
            }
        }
        // Final check and error if not found
        if (!analyzerScriptPath || !require('fs').existsSync(analyzerScriptPath)) {
            throw new Error('Could not locate the lizard_analyzer.py script. Please check the extension installation.');
        }
        outputChannel.appendLine(`Using analyzer script at: ${analyzerScriptPath}`);
        // Execute the Python script
        const output = await (0, processUtils_1.executeCommand)(pythonPath, [analyzerScriptPath, filePath], { showOutput: false });
        // Parse the JSON output
        const result = JSON.parse(output);
        if (result.status === 'error') {
            throw new Error(result.error || 'Unknown error running lizard analysis');
        }
        // Extract functions and metrics from the result
        const functions = result.functions || [];
        const metrics = result.metrics || {
            averageComplexity: 0,
            maxComplexity: 0,
            functionCount: 0,
            highComplexityFunctions: 0,
            criticalComplexityFunctions: 0
        };
        // Log some results
        outputChannel.appendLine(`Found ${functions.length} functions/methods`);
        // Apply the same fix to other analyzer calls
        return { functions, metrics };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Error executing lizard analysis: ${errorMessage}`);
        // Return empty data structure rather than undefined
        return {
            functions: [],
            metrics: {
                averageComplexity: 0,
                maxComplexity: 0,
                functionCount: 0,
                highComplexityFunctions: 0,
                criticalComplexityFunctions: 0
            }
        };
    }
}
//# sourceMappingURL=lizardExecutor.js.map