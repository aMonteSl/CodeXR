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
exports.getVenvPath = getVenvPath;
exports.getPythonExecutable = getPythonExecutable;
exports.getPipExecutable = getPipExecutable;
exports.venvExists = venvExists;
exports.executableExists = executableExists;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const vscode = __importStar(require("vscode"));
/**
 * Gets the path to the .venv directory in the workspace
 * @returns Path to the .venv directory or undefined if no workspace is open
 */
function getVenvPath() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }
    return path.join(workspaceFolders[0].uri.fsPath, '.venv');
}
/**
 * Gets the path to the Python executable in the .venv
 * @param venvPath Path to the .venv directory
 * @returns Path to the Python executable
 */
function getPythonExecutable(venvPath) {
    // Different paths based on platform
    if (process.platform === 'win32') {
        return path.join(venvPath, 'Scripts', 'python.exe');
    }
    else {
        return path.join(venvPath, 'bin', 'python');
    }
}
/**
 * Gets the path to the pip executable in the .venv
 * @param venvPath Path to the .venv directory
 * @returns Path to the pip executable
 */
function getPipExecutable(venvPath) {
    // Different paths based on platform
    if (process.platform === 'win32') {
        return path.join(venvPath, 'Scripts', 'pip.exe');
    }
    else {
        return path.join(venvPath, 'bin', 'pip');
    }
}
/**
 * Checks if the .venv directory exists
 * @returns Boolean indicating if .venv exists
 */
function venvExists() {
    const venvPath = getVenvPath();
    if (!venvPath) {
        return false;
    }
    return fs.existsSync(venvPath);
}
/**
 * Checks if an executable exists in the .venv
 * @param executablePath Path to the executable
 * @returns Boolean indicating if the executable exists
 */
function executableExists(executablePath) {
    return fs.existsSync(executablePath);
}
//# sourceMappingURL=pathUtils.js.map