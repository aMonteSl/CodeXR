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
exports.setupPythonEnvironment = setupPythonEnvironment;
exports.checkAndSetupPythonEnvironment = checkAndSetupPythonEnvironment;
exports.registerPythonEnvCommands = registerPythonEnvCommands;
const vscode = __importStar(require("vscode"));
const environmentManager_1 = require("./environmentManager");
const packageManager_1 = require("./packageManager");
const environmentModel_1 = require("./models/environmentModel");
const pathUtils_1 = require("./utils/pathUtils");
// Output channel for Python environment operations
let pythonEnvOutputChannel;
/**
 * Sets up the Python environment and installs required packages
 * @param silent Whether to suppress info messages (used for automatic setup)
 */
async function setupPythonEnvironment(silent = false) {
    // Create output channel if it doesn't exist
    if (!pythonEnvOutputChannel) {
        pythonEnvOutputChannel = vscode.window.createOutputChannel('CodeXR Python Environment');
    }
    pythonEnvOutputChannel.clear();
    pythonEnvOutputChannel.show();
    pythonEnvOutputChannel.appendLine('Setting up Python environment...');
    // Show an information message that the process is starting (unless in silent mode)
    if (!silent) {
        vscode.window.showInformationMessage('[CodeXR] Setting up Python environment. This may take a few moments...', { modal: false });
    }
    try {
        // Create virtual environment
        const envInfo = await (0, environmentManager_1.createEnvironment)(pythonEnvOutputChannel);
        if (envInfo.status === environmentModel_1.PythonEnvironmentStatus.ERROR) {
            throw new Error(envInfo.error);
        }
        // Install lizard package
        pythonEnvOutputChannel.appendLine('Installing required package: lizard...');
        const lizardInfo = await (0, packageManager_1.installPackage)('lizard', envInfo, pythonEnvOutputChannel);
        if (lizardInfo.status === environmentModel_1.PackageStatus.ERROR) {
            throw new Error(`Failed to install lizard: ${lizardInfo.error}`);
        }
        // Show success message
        const message = envInfo.status === environmentModel_1.PythonEnvironmentStatus.CREATED
            ? '[CodeXR] Python environment successfully created and lizard installed.'
            : '[CodeXR] Python environment verified and lizard is installed.';
        if (!silent || envInfo.status === environmentModel_1.PythonEnvironmentStatus.CREATED) {
            vscode.window.showInformationMessage(message);
        }
        pythonEnvOutputChannel.appendLine(message);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`[CodeXR] Failed to set up Python environment: ${errorMessage}`);
        pythonEnvOutputChannel.appendLine(`Error: ${errorMessage}`);
    }
}
/**
 * Check if .venv exists; if not, automatically set it up
 */
async function checkAndSetupPythonEnvironment() {
    // If no workspace is open, we can't set up the environment
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return;
    }
    // Check if user has disabled automatic setup
    const config = vscode.workspace.getConfiguration('codexr.analysis');
    const autoSetup = config.get('autoSetupPython', true);
    if (!autoSetup) {
        return;
    }
    // Check if .venv exists
    if (!(0, pathUtils_1.venvExists)()) {
        // Run setup in silent mode to avoid too many popups
        await setupPythonEnvironment(true);
    }
}
/**
 * Registers all Python environment commands
 * @param context Extension context
 * @returns Array of disposables
 */
function registerPythonEnvCommands(context) {
    const disposables = [];
    // Create output channel
    pythonEnvOutputChannel = vscode.window.createOutputChannel('CodeXR Python Environment');
    context.subscriptions.push(pythonEnvOutputChannel);
    // Register command to setup Python environment
    disposables.push(vscode.commands.registerCommand('codexr.setupPythonEnvironment', () => setupPythonEnvironment(false)));
    // Register a workspace listener to automatically check for Python environment
    const workspaceListener = vscode.workspace.onDidChangeWorkspaceFolders(() => {
        checkAndSetupPythonEnvironment();
    });
    disposables.push(workspaceListener);
    context.subscriptions.push(workspaceListener);
    return disposables;
}
//# sourceMappingURL=commands.js.map