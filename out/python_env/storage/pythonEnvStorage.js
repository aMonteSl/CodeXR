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
exports.PythonEnvStorage = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const pythonEnvUtils_1 = require("../utils/pythonEnvUtils");
/**
 * Manages persistent storage of Python environment metadata
 */
class PythonEnvStorage {
    static PYTHON_ENV_DIR = 'python-env';
    static STATE_FILE = 'state.json';
    static VENV_DIR = 'venv';
    context;
    pythonEnvPath;
    stateFilePath;
    venvPath;
    constructor(context) {
        this.context = context;
        // Initialize paths using global storage
        const globalStorageUri = this.context.globalStorageUri;
        this.pythonEnvPath = path.join(globalStorageUri.fsPath, PythonEnvStorage.PYTHON_ENV_DIR);
        this.stateFilePath = path.join(this.pythonEnvPath, PythonEnvStorage.STATE_FILE);
        this.venvPath = path.join(this.pythonEnvPath, PythonEnvStorage.VENV_DIR);
        console.log(`PYTHON_ENV: Storage initialized at ${this.pythonEnvPath}`);
        console.log(`PYTHON_ENV: Virtual environment path: ${this.venvPath}`);
        console.log(`PYTHON_ENV: State file path: ${this.stateFilePath}`);
        // Ensure the python-env directory exists
        this.ensurePythonEnvDirectory();
    }
    /**
     * Get the virtual environment path
     */
    getVenvPath() {
        return this.venvPath;
    }
    /**
     * Get the Python environment storage path
     */
    getPythonEnvPath() {
        return this.pythonEnvPath;
    }
    /**
     * Save environment metadata to state.json
     */
    async saveMetadata(metadata) {
        try {
            const jsonData = JSON.stringify(metadata, null, 2);
            fs.writeFileSync(this.stateFilePath, jsonData, 'utf-8');
            console.log('PYTHON_ENV: Metadata saved to state file', metadata);
        }
        catch (error) {
            console.error('PYTHON_ENV: Failed to save metadata:', error);
            throw new Error(`Failed to save Python environment metadata: ${error}`);
        }
    }
    /**
     * Load environment metadata from state.json
     */
    loadMetadata() {
        try {
            if (!fs.existsSync(this.stateFilePath)) {
                console.log('PYTHON_ENV: No state file found, returning null');
                return null;
            }
            const jsonData = fs.readFileSync(this.stateFilePath, 'utf-8');
            const metadata = JSON.parse(jsonData);
            console.log('PYTHON_ENV: Metadata loaded from state file', metadata);
            return metadata;
        }
        catch (error) {
            console.error('PYTHON_ENV: Failed to load metadata:', error);
            return null;
        }
    }
    /**
     * Check if virtual environment exists and is valid
     */
    isVenvValid() {
        const isValid = pythonEnvUtils_1.PythonEnvUtils.isValidVenv(this.venvPath);
        console.log(`PYTHON_ENV: Virtual environment validation result: ${isValid}`);
        return isValid;
    }
    /**
     * Delete the virtual environment and metadata
     */
    async deleteEnvironment() {
        try {
            // Remove virtual environment directory
            if (fs.existsSync(this.venvPath)) {
                fs.rmSync(this.venvPath, { recursive: true, force: true });
                console.log('PYTHON_ENV: Virtual environment directory deleted');
            }
            // Remove state file
            if (fs.existsSync(this.stateFilePath)) {
                fs.unlinkSync(this.stateFilePath);
                console.log('PYTHON_ENV: State file deleted');
            }
            console.log('PYTHON_ENV: Environment successfully deleted');
        }
        catch (error) {
            console.error('PYTHON_ENV: Failed to delete environment:', error);
            throw new Error(`Failed to delete Python environment: ${error}`);
        }
    }
    /**
     * Update metadata with new validation timestamp
     */
    async updateValidation() {
        try {
            const metadata = this.loadMetadata();
            if (metadata) {
                metadata.lastValidated = new Date().toISOString();
                await this.saveMetadata(metadata);
                console.log('PYTHON_ENV: Validation timestamp updated');
            }
        }
        catch (error) {
            console.error('PYTHON_ENV: Failed to update validation:', error);
        }
    }
    /**
     * Update dependencies list in metadata
     */
    async updateDependencies(dependencies) {
        try {
            const metadata = this.loadMetadata();
            if (metadata) {
                metadata.dependencies = dependencies;
                await this.saveMetadata(metadata);
                console.log(`PYTHON_ENV: Dependencies updated (${dependencies.length} packages)`);
            }
        }
        catch (error) {
            console.error('PYTHON_ENV: Failed to update dependencies:', error);
        }
    }
    /**
     * Create initial metadata for a new environment
     */
    createInitialMetadata(pythonVersion) {
        const now = new Date().toISOString();
        return {
            venvPath: this.venvPath,
            createdAt: now,
            pythonVersion: pythonVersion,
            isActive: true,
            lastValidated: now,
            dependencies: []
        };
    }
    /**
     * Ensure the python-env directory exists
     */
    ensurePythonEnvDirectory() {
        try {
            if (!pythonEnvUtils_1.PythonEnvUtils.ensureDirectoryExists(this.pythonEnvPath)) {
                throw new Error(`Failed to create python-env directory at ${this.pythonEnvPath}`);
            }
        }
        catch (error) {
            console.error('PYTHON_ENV: Failed to ensure directory exists:', error);
            throw error;
        }
    }
    /**
     * Get storage statistics
     */
    getStorageStats() {
        const stats = {
            envExists: fs.existsSync(this.pythonEnvPath),
            stateExists: fs.existsSync(this.stateFilePath),
            venvSize: undefined
        };
        if (fs.existsSync(this.venvPath)) {
            try {
                // Calculate approximate venv size (simplified)
                const getDirectorySize = (dirPath) => {
                    let size = 0;
                    const items = fs.readdirSync(dirPath);
                    for (const item of items) {
                        const itemPath = path.join(dirPath, item);
                        const stat = fs.statSync(itemPath);
                        if (stat.isDirectory()) {
                            size += getDirectorySize(itemPath);
                        }
                        else {
                            size += stat.size;
                        }
                    }
                    return size;
                };
                stats.venvSize = Math.round(getDirectorySize(this.venvPath) / (1024 * 1024)); // MB
            }
            catch (error) {
                console.log('PYTHON_ENV: Could not calculate venv size:', error);
            }
        }
        return stats;
    }
}
exports.PythonEnvStorage = PythonEnvStorage;
//# sourceMappingURL=pythonEnvStorage.js.map