import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PythonEnvUtils } from '../utils/pythonEnvUtils';

/**
 * Interface for Python environment metadata
 */
export interface PythonEnvMetadata {
    venvPath: string;
    createdAt: string;
    pythonVersion: string | null;
    isActive: boolean;
    lastValidated: string;
    dependencies: string[];
}

/**
 * Manages persistent storage of Python environment metadata
 */
export class PythonEnvStorage {
    private static readonly PYTHON_ENV_DIR = 'python-env';
    private static readonly STATE_FILE = 'state.json';
    private static readonly VENV_DIR = 'venv';

    private context: vscode.ExtensionContext;
    private pythonEnvPath: string;
    private stateFilePath: string;
    private venvPath: string;

    constructor(context: vscode.ExtensionContext) {
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
    public getVenvPath(): string {
        return this.venvPath;
    }

    /**
     * Get the Python environment storage path
     */
    public getPythonEnvPath(): string {
        return this.pythonEnvPath;
    }

    /**
     * Save environment metadata to state.json
     */
    public async saveMetadata(metadata: PythonEnvMetadata): Promise<void> {
        try {
            const jsonData = JSON.stringify(metadata, null, 2);
            fs.writeFileSync(this.stateFilePath, jsonData, 'utf-8');
            
            console.log('PYTHON_ENV: Metadata saved to state file', metadata);
        } catch (error) {
            console.error('PYTHON_ENV: Failed to save metadata:', error);
            throw new Error(`Failed to save Python environment metadata: ${error}`);
        }
    }

    /**
     * Load environment metadata from state.json
     */
    public loadMetadata(): PythonEnvMetadata | null {
        try {
            if (!fs.existsSync(this.stateFilePath)) {
                console.log('PYTHON_ENV: No state file found, returning null');
                return null;
            }

            const jsonData = fs.readFileSync(this.stateFilePath, 'utf-8');
            const metadata = JSON.parse(jsonData) as PythonEnvMetadata;
            
            console.log('PYTHON_ENV: Metadata loaded from state file', metadata);
            return metadata;
        } catch (error) {
            console.error('PYTHON_ENV: Failed to load metadata:', error);
            return null;
        }
    }

    /**
     * Check if virtual environment exists and is valid
     */
    public isVenvValid(): boolean {
        const isValid = PythonEnvUtils.isValidVenv(this.venvPath);
        console.log(`PYTHON_ENV: Virtual environment validation result: ${isValid}`);
        return isValid;
    }

    /**
     * Delete the virtual environment and metadata
     */
    public async deleteEnvironment(): Promise<void> {
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
        } catch (error) {
            console.error('PYTHON_ENV: Failed to delete environment:', error);
            throw new Error(`Failed to delete Python environment: ${error}`);
        }
    }

    /**
     * Update metadata with new validation timestamp
     */
    public async updateValidation(): Promise<void> {
        try {
            const metadata = this.loadMetadata();
            if (metadata) {
                metadata.lastValidated = new Date().toISOString();
                await this.saveMetadata(metadata);
                console.log('PYTHON_ENV: Validation timestamp updated');
            }
        } catch (error) {
            console.error('PYTHON_ENV: Failed to update validation:', error);
        }
    }

    /**
     * Update dependencies list in metadata
     */
    public async updateDependencies(dependencies: string[]): Promise<void> {
        try {
            const metadata = this.loadMetadata();
            if (metadata) {
                metadata.dependencies = dependencies;
                await this.saveMetadata(metadata);
                console.log(`PYTHON_ENV: Dependencies updated (${dependencies.length} packages)`);
            }
        } catch (error) {
            console.error('PYTHON_ENV: Failed to update dependencies:', error);
        }
    }

    /**
     * Create initial metadata for a new environment
     */
    public createInitialMetadata(pythonVersion: string | null): PythonEnvMetadata {
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
    private ensurePythonEnvDirectory(): void {
        try {
            if (!PythonEnvUtils.ensureDirectoryExists(this.pythonEnvPath)) {
                throw new Error(`Failed to create python-env directory at ${this.pythonEnvPath}`);
            }
        } catch (error) {
            console.error('PYTHON_ENV: Failed to ensure directory exists:', error);
            throw error;
        }
    }

    /**
     * Get storage statistics
     */
    public getStorageStats(): { envExists: boolean; stateExists: boolean; venvSize?: number } {
        const stats = {
            envExists: fs.existsSync(this.pythonEnvPath),
            stateExists: fs.existsSync(this.stateFilePath),
            venvSize: undefined as number | undefined
        };

        if (fs.existsSync(this.venvPath)) {
            try {
                // Calculate approximate venv size (simplified)
                const getDirectorySize = (dirPath: string): number => {
                    let size = 0;
                    const items = fs.readdirSync(dirPath);
                    for (const item of items) {
                        const itemPath = path.join(dirPath, item);
                        const stat = fs.statSync(itemPath);
                        if (stat.isDirectory()) {
                            size += getDirectorySize(itemPath);
                        } else {
                            size += stat.size;
                        }
                    }
                    return size;
                };
                
                stats.venvSize = Math.round(getDirectorySize(this.venvPath) / (1024 * 1024)); // MB
            } catch (error) {
                console.log('PYTHON_ENV: Could not calculate venv size:', error);
            }
        }

        return stats;
    }
}
