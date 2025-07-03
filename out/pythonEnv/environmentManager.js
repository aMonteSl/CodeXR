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
exports.getSystemPythonPath = getSystemPythonPath;
exports.checkEnvironment = checkEnvironment;
exports.createEnvironment = createEnvironment;
const vscode = __importStar(require("vscode"));
const processUtils_1 = require("./utils/processUtils");
const pathUtils_1 = require("./utils/pathUtils");
const environmentModel_1 = require("./models/environmentModel");
/**
 * Gets the path to the system Python executable
 * @returns Path to the system Python executable
 */
async function getSystemPythonPath() {
    // First try to get from settings
    const config = vscode.workspace.getConfiguration('codexr.analysis');
    const configuredPath = config.get('pythonPath');
    if (configuredPath && configuredPath.trim() !== '') {
        return configuredPath;
    }
    // Fallback to python3 or python
    try {
        await (0, processUtils_1.executeCommand)('python3', ['--version']);
        return 'python3';
    }
    catch (error) {
        try {
            await (0, processUtils_1.executeCommand)('python', ['--version']);
            return 'python';
        }
        catch (error) {
            throw new Error('No Python installation found. Please install Python or configure the path in settings.');
        }
    }
}
/**
 * Checks the status of the Python environment
 * @returns Environment information
 */
async function checkEnvironment() {
    const venvPath = (0, pathUtils_1.getVenvPath)();
    if (!venvPath) {
        return {
            path: '',
            status: environmentModel_1.PythonEnvironmentStatus.ERROR,
            error: 'No workspace folder open'
        };
    }
    if (!(0, pathUtils_1.venvExists)()) {
        return {
            path: venvPath,
            status: environmentModel_1.PythonEnvironmentStatus.NOT_FOUND
        };
    }
    const pythonExecutable = (0, pathUtils_1.getPythonExecutable)(venvPath);
    const pipExecutable = (0, pathUtils_1.getPipExecutable)(venvPath);
    if (!(0, pathUtils_1.executableExists)(pythonExecutable) || !(0, pathUtils_1.executableExists)(pipExecutable)) {
        return {
            path: venvPath,
            status: environmentModel_1.PythonEnvironmentStatus.ERROR,
            error: 'Virtual environment exists but executables are missing'
        };
    }
    return {
        path: venvPath,
        status: environmentModel_1.PythonEnvironmentStatus.FOUND,
        pythonExecutable,
        pipExecutable
    };
}
/**
 * Creates a Python virtual environment
 * @param outputChannel Output channel to show progress
 * @returns Environment information
 */
async function createEnvironment(outputChannel) {
    try {
        // Check if environment already exists
        const envInfo = await checkEnvironment();
        if (envInfo.status === environmentModel_1.PythonEnvironmentStatus.FOUND) {
            return envInfo;
        }
        if (envInfo.status === environmentModel_1.PythonEnvironmentStatus.ERROR && envInfo.error !== 'No workspace folder open') {
            throw new Error(envInfo.error);
        }
        const venvPath = (0, pathUtils_1.getVenvPath)();
        if (!venvPath) {
            throw new Error('No workspace folder open');
        }
        // Get system Python path
        const pythonPath = await getSystemPythonPath();
        // Create the virtual environment
        outputChannel.appendLine(`Creating Python virtual environment at ${venvPath}...`);
        outputChannel.show();
        await (0, processUtils_1.executeCommand)(pythonPath, ['-m', 'venv', venvPath], { showOutput: true, outputChannel });
        // Verify the environment was created
        const newEnvInfo = await checkEnvironment();
        if (newEnvInfo.status !== environmentModel_1.PythonEnvironmentStatus.FOUND) {
            throw new Error('Failed to create virtual environment');
        }
        // Return the created environment info
        return {
            ...newEnvInfo,
            status: environmentModel_1.PythonEnvironmentStatus.CREATED
        };
    }
    catch (error) {
        // Handle errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Error creating Python environment: ${errorMessage}`);
        return {
            path: (0, pathUtils_1.getVenvPath)() || '',
            status: environmentModel_1.PythonEnvironmentStatus.ERROR,
            error: errorMessage
        };
    }
}
//# sourceMappingURL=environmentManager.js.map