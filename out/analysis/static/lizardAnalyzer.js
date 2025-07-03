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
const pathUtils_1 = require("../../pythonEnv/utils/pathUtils");
const processUtils_1 = require("../../pythonEnv/utils/processUtils");
const commands_1 = require("../../pythonEnv/commands");
const utils_1 = require("../utils");
/**
 * Lizard analyzer for extracting complexity metrics from code files
 */
/**
 * Checks if lizard is available in the Python environment
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
 */
async function analyzeLizard(filePath, outputChannel) {
    try {
        outputChannel.appendLine(`Starting Lizard analysis for: ${path.basename(filePath)}`);
        // Ensure lizard is available
        if (!(await ensureLizardAvailable(outputChannel))) {
            outputChannel.appendLine('❌ Lizard not available, skipping analysis');
            return undefined;
        }
        const venvPath = (0, pathUtils_1.getVenvPath)();
        if (!venvPath) {
            outputChannel.appendLine('❌ No virtual environment found');
            return undefined;
        }
        const pythonPath = (0, pathUtils_1.getPythonExecutable)(venvPath);
        let analyzerScriptPath = (0, utils_1.resolveAnalyzerScriptPath)('lizard_analyzer.py', outputChannel);
        // Method 2: Try to use __dirname-based path
        if (!analyzerScriptPath || !require('fs').existsSync(analyzerScriptPath)) {
            // Get directory of current file
            const currentDir = __dirname;
            // Use the known working path directly
            const analyzerRelativePath = path.join(currentDir, '..', '..', '..', 'src', 'analysis', 'python', 'lizard_analyzer.py');
            if (require('fs').existsSync(analyzerRelativePath)) {
                analyzerScriptPath = analyzerRelativePath;
            }
        }
        // Method 3: Try to resolve from the workspace folders
        if (!analyzerScriptPath || !require('fs').existsSync(analyzerScriptPath)) {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const workspacePath = path.join(workspaceFolder.uri.fsPath, 'src', 'analysis', 'python', 'lizard_analyzer.py');
                if (require('fs').existsSync(workspacePath)) {
                    analyzerScriptPath = workspacePath;
                }
            }
        }
        if (!require('fs').existsSync(analyzerScriptPath)) {
            outputChannel.appendLine(`❌ Could not find lizard_analyzer.py script`);
            outputChannel.appendLine(`Last attempted path: ${analyzerScriptPath}`);
            return undefined;
        }
        outputChannel.appendLine(`✓ Using analyzer script: ${analyzerScriptPath}`);
        outputChannel.appendLine(`✓ Using Python: ${pythonPath}`);
        const output = await (0, processUtils_1.executeCommand)(pythonPath, [analyzerScriptPath, filePath], { showOutput: false });
        outputChannel.appendLine(`Raw lizard output: ${output.substring(0, 200)}...`);
        let result;
        try {
            result = JSON.parse(output);
        }
        catch (jsonError) {
            outputChannel.appendLine(`❌ Failed to parse Lizard JSON output: ${jsonError}`);
            outputChannel.appendLine(`Raw output: ${output}`);
            return undefined;
        }
        if (result.error) {
            outputChannel.appendLine(`❌ Lizard analysis error: ${result.error}`);
            return undefined;
        }
        if (!result.functions || !Array.isArray(result.functions)) {
            outputChannel.appendLine(`⚠️ No functions found in Lizard output`);
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
        const functions = result.functions.map((func) => ({
            name: func.name || 'Unknown',
            lineStart: func.lineStart || 0,
            lineEnd: func.lineEnd || 0,
            lineCount: func.lineCount || 0,
            complexity: func.complexity || 0,
            parameters: func.parameters || 0, // Fixed: was func.parameter_count
            maxNestingDepth: func.maxNestingDepth || 0,
            cyclomaticDensity: func.cyclomaticDensity || 0 // Fixed: use value from Python script
        }));
        const metrics = result.metrics || {
            averageComplexity: 0,
            maxComplexity: 0,
            functionCount: functions.length,
            highComplexityFunctions: functions.filter(f => f.complexity > 10).length,
            criticalComplexityFunctions: functions.filter(f => f.complexity > 25).length
        };
        outputChannel.appendLine(`✅ Lizard analysis completed: ${functions.length} functions, avg complexity: ${metrics.averageComplexity}`);
        return { functions, metrics };
    }
    catch (error) {
        outputChannel.appendLine(`❌ Error during Lizard analysis: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}
//# sourceMappingURL=lizardAnalyzer.js.map