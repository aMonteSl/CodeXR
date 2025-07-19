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
exports.PythonEnvUtils = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
/**
 * Platform-specific utilities for Python environment management
 */
class PythonEnvUtils {
    /**
     * Get the Python executable command for the current platform
     */
    static getPythonCommand() {
        const platform = os.platform();
        // On Windows, try python first, then python3
        if (platform === 'win32') {
            return 'python';
        }
        // On Unix-like systems (Linux, macOS), prefer python3
        return 'python3';
    }
    /**
     * Get the virtual environment activation command for the current platform
     */
    static getActivationCommand(venvPath) {
        const platform = os.platform();
        if (platform === 'win32') {
            return path.join(venvPath, 'Scripts', 'activate.bat');
        }
        else {
            return `source ${path.join(venvPath, 'bin', 'activate')}`;
        }
    }
    /**
     * Get the Python executable path within a virtual environment
     */
    static getVenvPythonPath(venvPath) {
        const platform = os.platform();
        if (platform === 'win32') {
            return path.join(venvPath, 'Scripts', 'python.exe');
        }
        else {
            return path.join(venvPath, 'bin', 'python');
        }
    }
    /**
     * Get the pip executable path within a virtual environment
     */
    static getVenvPipPath(venvPath) {
        const platform = os.platform();
        if (platform === 'win32') {
            return path.join(venvPath, 'Scripts', 'pip.exe');
        }
        else {
            return path.join(venvPath, 'bin', 'pip');
        }
    }
    /**
     * Check if a path points to a valid virtual environment
     */
    static isValidVenv(venvPath) {
        try {
            // Check if directory exists
            if (!fs.existsSync(venvPath)) {
                return false;
            }
            // Check for Python executable
            const pythonPath = this.getVenvPythonPath(venvPath);
            if (!fs.existsSync(pythonPath)) {
                return false;
            }
            // Check for pip executable
            const pipPath = this.getVenvPipPath(venvPath);
            if (!fs.existsSync(pipPath)) {
                return false;
            }
            // Check for pyvenv.cfg (standard virtual environment marker)
            const configPath = path.join(venvPath, 'pyvenv.cfg');
            if (!fs.existsSync(configPath)) {
                return false;
            }
            return true;
        }
        catch (error) {
            console.log(`PYTHON_ENV: Error validating venv at ${venvPath}:`, error);
            return false;
        }
    }
    /**
     * Validate a path is safe for virtual environment creation
     */
    static isValidPath(targetPath) {
        try {
            // Check if parent directory exists and is writable
            const parentDir = path.dirname(targetPath);
            if (!fs.existsSync(parentDir)) {
                return false;
            }
            // Check if target path already exists and is not empty
            if (fs.existsSync(targetPath)) {
                const stats = fs.statSync(targetPath);
                if (stats.isDirectory()) {
                    const contents = fs.readdirSync(targetPath);
                    return contents.length === 0; // Only valid if empty
                }
                return false; // File exists at target path
            }
            return true;
        }
        catch (error) {
            console.log(`PYTHON_ENV: Error validating path ${targetPath}:`, error);
            return false;
        }
    }
    /**
     * Extract Python version from a pyvenv.cfg file
     */
    static extractPythonVersion(venvPath) {
        try {
            const configPath = path.join(venvPath, 'pyvenv.cfg');
            if (!fs.existsSync(configPath)) {
                return null;
            }
            const configContent = fs.readFileSync(configPath, 'utf-8');
            const versionMatch = configContent.match(/version\s*=\s*([^\s\n]+)/);
            return versionMatch ? versionMatch[1] : null;
        }
        catch (error) {
            console.log(`PYTHON_ENV: Error extracting version from ${venvPath}:`, error);
            return null;
        }
    }
    /**
     * Get platform-specific environment separator
     */
    static getPathSeparator() {
        return os.platform() === 'win32' ? ';' : ':';
    }
    /**
     * Ensure directory exists, creating it if necessary
     */
    static ensureDirectoryExists(dirPath) {
        try {
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
            return true;
        }
        catch (error) {
            console.error(`PYTHON_ENV: Failed to create directory ${dirPath}:`, error);
            return false;
        }
    }
}
exports.PythonEnvUtils = PythonEnvUtils;
//# sourceMappingURL=pythonEnvUtils.js.map