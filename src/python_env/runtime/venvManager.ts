import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import { PythonEnvStorage, PythonEnvMetadata } from '../storage/pythonEnvStorage';
import { PythonEnvUtils } from '../utils/pythonEnvUtils';

/**
 * Core virtual environment management functionality
 */
export class VenvManager {
    private storage: PythonEnvStorage;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.storage = new PythonEnvStorage(context);
        
        console.log('PYTHON_ENV: VenvManager initialized');
    }

    /**
     * Initialize the Python environment on extension startup
     */
    public async initializeEnvironment(): Promise<void> {
        console.log('PYTHON_ENV: Initializing Python environment...');

        try {
            // Check if environment already exists and is valid
            const metadata = this.storage.loadMetadata();
            const venvExists = this.storage.isVenvValid();

            if (metadata && venvExists) {
                console.log('PYTHON_ENV: Existing valid environment found');
                await this.activateEnvironment();
                
                // Check if lizard is available and install if missing
                await this.ensureLizardAvailable();
                
                await this.storage.updateValidation();
                return;
            }

            // Environment doesn't exist or is invalid - create new one
            console.log('PYTHON_ENV: No valid environment found, creating new one...');
            await this.createEnvironment();

        } catch (error: any) {
            const errorMsg = error?.message || String(error);
            const isPermissionError = errorMsg.includes('Permission denied') || 
                                      errorMsg.includes('EACCES') || 
                                      errorMsg.includes('Errno 13');
            
            if (isPermissionError && os.platform() === 'win32') {
                console.error('PYTHON_ENV: Windows permission error during initialization:', error);
                vscode.window.showErrorMessage(
                    `Python environment initialization failed due to Windows file permissions. ` +
                    `Try closing all VS Code windows, deleting the venv folder, and restarting. ` +
                    `If an antivirus is active, add VS Code's globalStorage to exclusions.`,
                    'Show Details'
                ).then(choice => {
                    if (choice === 'Show Details') {
                        const venvPath = this.storage.getVenvPath();
                        vscode.window.showInformationMessage(
                            `Venv path: ${venvPath}\n\nDelete this folder manually, then restart VS Code.`
                        );
                    }
                });
            } else {
                console.error('PYTHON_ENV: Failed to initialize environment:', error);
                vscode.window.showErrorMessage(`Failed to initialize Python environment: ${error}`);
            }
        }
    }

    /**
     * Create a new virtual environment
     * Handles Windows permission issues with retry logic and --clear flag
     */
    public async createEnvironment(): Promise<void> {
        console.log('PYTHON_ENV: Creating new virtual environment...');

        try {
            // Show progress to user
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Creating Python Virtual Environment",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: "Checking Python installation..." });

                // Verify Python is available
                const pythonCommand = PythonEnvUtils.getPythonCommand();
                const pythonVersion = await this.checkPythonVersion(pythonCommand);
                
                if (!pythonVersion) {
                    throw new Error(`Python not found. Please install Python 3.7+ and ensure '${pythonCommand}' is in your PATH.`);
                }

                progress.report({ increment: 20, message: `Found Python ${pythonVersion}, creating environment...` });

                // Create virtual environment with Windows-aware retry logic
                const venvPath = this.storage.getVenvPath();
                await this.createVenvWithRetry(pythonCommand, venvPath, progress);

                progress.report({ increment: 80, message: "Installing base packages..." });

                // Install basic packages
                await this.installBasePackages();

                progress.report({ increment: 90, message: "Saving environment metadata..." });

                // Save metadata
                const metadata = this.storage.createInitialMetadata(pythonVersion);
                await this.storage.saveMetadata(metadata);

                progress.report({ increment: 100, message: "Environment created successfully!" });
            });

            console.log('PYTHON_ENV: Virtual environment created successfully');
            vscode.window.showInformationMessage('Python virtual environment created successfully!');

        } catch (error) {
            console.error('PYTHON_ENV: Failed to create environment:', error);
            throw error;
        }
    }

    /**
     * Create venv with retry logic for Windows permission issues.
     * 
     * On Windows, `python -m venv` can fail with EACCES/Permission denied when:
     * - An existing venv has python.exe locked by antivirus or another process
     * - Windows file locking prevents overwriting executables in Scripts/
     * 
     * Strategy:
     * 1. If venv dir exists → try `python -m venv --clear` (clears and recreates in-place)
     * 2. If --clear fails → manually delete the directory, wait for file locks to release, then create fresh
     * 3. If fresh creation also fails → provide clear error message with remediation steps
     */
    private async createVenvWithRetry(
        pythonCommand: string,
        venvPath: string,
        progress: vscode.Progress<{ increment?: number; message?: string }>
    ): Promise<void> {
        const venvExists = fs.existsSync(venvPath);

        // Attempt 1: Standard creation (or --clear if venv already exists)
        try {
            if (venvExists) {
                console.log('PYTHON_ENV: Existing venv found, using --clear flag to recreate');
                progress.report({ message: "Clearing existing environment..." });
                await this.executeCommand(`${pythonCommand} -m venv --clear "${venvPath}"`);
            } else {
                await this.executeCommand(`${pythonCommand} -m venv "${venvPath}"`);
            }
            console.log('PYTHON_ENV: Venv created successfully (attempt 1)');
            return;
        } catch (firstError: any) {
            const errorMsg = firstError?.message || String(firstError);
            const isPermissionError = errorMsg.includes('Permission denied') || 
                                      errorMsg.includes('EACCES') || 
                                      errorMsg.includes('Errno 13');
            
            if (!isPermissionError) {
                // Not a permission error — don't retry, throw immediately
                throw firstError;
            }
            
            console.warn('PYTHON_ENV: Permission denied on venv creation (attempt 1), trying manual cleanup...');
        }

        // Attempt 2: Manual cleanup then fresh creation (Windows-specific)
        try {
            progress.report({ message: "Resolving permission issue, cleaning up..." });
            console.log('PYTHON_ENV: Attempting manual directory removal before retry');

            // Delete the existing venv directory
            if (fs.existsSync(venvPath)) {
                try {
                    fs.rmSync(venvPath, { recursive: true, force: true });
                    console.log('PYTHON_ENV: Existing venv directory removed successfully');
                } catch (rmError: any) {
                    console.warn('PYTHON_ENV: Could not remove venv directory:', rmError.message);
                    // On Windows, if rmSync also fails, the files are truly locked
                    // Fall through to attempt creation anyway — it might work on a partial cleanup
                }
            }

            // Small delay to allow Windows file system to release locks
            if (os.platform() === 'win32') {
                console.log('PYTHON_ENV: Waiting for Windows file lock release...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Fresh creation
            progress.report({ message: "Recreating environment..." });
            await this.executeCommand(`${pythonCommand} -m venv "${venvPath}"`);
            console.log('PYTHON_ENV: Venv created successfully (attempt 2 - after manual cleanup)');
            return;
        } catch (secondError: any) {
            console.error('PYTHON_ENV: Venv creation failed after manual cleanup (attempt 2):', secondError.message);
        }

        // Both attempts failed — provide actionable error message
        const isWindows = os.platform() === 'win32';
        const remediation = isWindows
            ? `\n\nTo fix this on Windows:\n` +
              `1. Close all VS Code windows\n` +
              `2. Check if antivirus is blocking: add VS Code's globalStorage to exclusions\n` +
              `3. Manually delete the folder: ${venvPath}\n` +
              `4. Restart VS Code and try again\n` +
              `5. If the problem persists, try running VS Code as Administrator`
            : `\n\nTry manually deleting: ${venvPath}\nThen restart VS Code.`;

        throw new Error(
            `Permission denied when creating Python virtual environment at "${venvPath}".` +
            ` The venv directory may be locked by another process or antivirus software.` +
            remediation
        );
    }

    /**
     * Activate the virtual environment
     */
    public async activateEnvironment(): Promise<void> {
        try {
            const venvPath = this.storage.getVenvPath();
            
            if (!PythonEnvUtils.isValidVenv(venvPath)) {
                throw new Error('Virtual environment is not valid');
            }

            console.log(`PYTHON_ENV: Activating environment at ${venvPath}`);
            
            // Update metadata to mark as active
            const metadata = this.storage.loadMetadata();
            if (metadata) {
                metadata.isActive = true;
                await this.storage.saveMetadata(metadata);
            }

            console.log('PYTHON_ENV: Environment activated successfully');

        } catch (error) {
            console.error('PYTHON_ENV: Failed to activate environment:', error);
            throw error;
        }
    }

    /**
     * Delete the virtual environment
     */
    public async deleteEnvironment(): Promise<void> {
        console.log('PYTHON_ENV: Deleting virtual environment...');

        try {
            const result = await vscode.window.showWarningMessage(
                'Are you sure you want to delete the Python virtual environment? This action cannot be undone.',
                { modal: true },
                'Delete Environment'
            );

            if (result !== 'Delete Environment') {
                console.log('PYTHON_ENV: Environment deletion cancelled by user');
                return;
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Deleting Python Virtual Environment",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 50, message: "Removing environment files..." });
                await this.storage.deleteEnvironment();
                progress.report({ increment: 100, message: "Environment deleted successfully!" });
            });

            console.log('PYTHON_ENV: Environment deleted successfully');
            vscode.window.showInformationMessage('Python virtual environment deleted successfully!');

        } catch (error) {
            console.error('PYTHON_ENV: Failed to delete environment:', error);
            vscode.window.showErrorMessage(`Failed to delete environment: ${error}`);
        }
    }

    /**
     * Install a package in the virtual environment
     */
    public async installPackage(packageName: string): Promise<void> {
        console.log(`PYTHON_ENV: Installing package: ${packageName}`);

        try {
            const venvPath = this.storage.getVenvPath();
            const pipPath = PythonEnvUtils.getVenvPipPath(venvPath);

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Installing ${packageName}`,
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: "Installing package..." });
                
                await this.executeCommand(`"${pipPath}" install ${packageName}`);
                
                progress.report({ increment: 80, message: "Updating dependencies list..." });
                
                // Update dependencies in metadata
                await this.updateDependenciesList();
                
                progress.report({ increment: 100, message: "Package installed successfully!" });
            });

            console.log(`PYTHON_ENV: Package ${packageName} installed successfully`);
            vscode.window.showInformationMessage(`Package ${packageName} installed successfully!`);

        } catch (error) {
            console.error(`PYTHON_ENV: Failed to install package ${packageName}:`, error);
            vscode.window.showErrorMessage(`Failed to install package ${packageName}: ${error}`);
        }
    }

    /**
     * Get environment status information
     */
    public getEnvironmentStatus(): { 
        exists: boolean; 
        isValid: boolean; 
        metadata: PythonEnvMetadata | null;
        stats: any;
    } {
        const metadata = this.storage.loadMetadata();
        const isValid = this.storage.isVenvValid();
        const stats = this.storage.getStorageStats();

        return {
            exists: metadata !== null,
            isValid: isValid,
            metadata: metadata,
            stats: stats
        };
    }

    /**
     * Get the Python executable path for external use
     */
    public getPythonExecutablePath(): string | null {
        const venvPath = this.storage.getVenvPath();
        
        if (!PythonEnvUtils.isValidVenv(venvPath)) {
            return null;
        }

        return PythonEnvUtils.getVenvPythonPath(venvPath);
    }

    /**
     * Get the lizard executable command for external use
     */
    public getLizardCommand(): string | null {
        const pythonPath = this.getPythonExecutablePath();
        if (!pythonPath) {
            return null;
        }

        // Return the command to run lizard using the virtual environment's Python
        return `"${pythonPath}" -m lizard`;
    }

    /**
     * Verify that lizard is working correctly in the environment
     */
    public async verifyLizardInstallation(): Promise<boolean> {
        try {
            const pythonPath = this.getPythonExecutablePath();
            if (!pythonPath) {
                return false;
            }

            // Test lizard by running it with --version flag
            await this.executeCommand(`"${pythonPath}" -m lizard --version`);
            return true;
        } catch (error) {
            console.log('PYTHON_ENV: Lizard verification failed:', error);
            return false;
        }
    }

    /**
     * Execute a command and return the result
     */
    private async executeCommand(command: string, cwd?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            console.log(`PYTHON_ENV: Executing command: ${command}`);
            
            const options: cp.ExecOptions = {
                cwd: cwd || process.cwd(),
                timeout: 60000, // 60 second timeout
                maxBuffer: 1024 * 1024 // 1MB buffer
            };

            cp.exec(command, options, (error, stdout, stderr) => {
                if (error) {
                    console.error(`PYTHON_ENV: Command failed: ${command}`, error);
                    console.error(`PYTHON_ENV: stderr: ${stderr}`);
                    reject(new Error(`Command failed: ${error.message}`));
                    return;
                }

                console.log(`PYTHON_ENV: Command completed successfully: ${command}`);
                if (stdout) {
                    console.log(`PYTHON_ENV: stdout: ${stdout.trim()}`);
                }
                
                resolve(stdout.trim());
            });
        });
    }

    /**
     * Check Python version
     */
    private async checkPythonVersion(pythonCommand: string): Promise<string | null> {
        try {
            const output = await this.executeCommand(`${pythonCommand} --version`);
            const versionMatch = output.match(/Python\s+(\d+\.\d+\.\d+)/);
            return versionMatch ? versionMatch[1] : null;
        } catch (error) {
            console.log(`PYTHON_ENV: Could not get Python version with '${pythonCommand}':`, error);
            return null;
        }
    }

    /**
     * Install base packages in the virtual environment
     */
    private async installBasePackages(): Promise<void> {
        try {
            const venvPath = this.storage.getVenvPath();
            const pipPath = PythonEnvUtils.getVenvPipPath(venvPath);

            // Upgrade pip first
            console.log('PYTHON_ENV: Upgrading pip...');
            await this.executeCommand(`"${pipPath}" install --upgrade pip`);

            // Install essential packages
            const basePackages = [
                'setuptools',
                'wheel',
                'requests'  // Common package for HTTP requests
            ];

            for (const pkg of basePackages) {
                console.log(`PYTHON_ENV: Installing ${pkg}...`);
                await this.executeCommand(`"${pipPath}" install ${pkg}`);
            }

            // Install lizard for code complexity analysis
            await this.installLizardPackage();

            // Update dependencies list
            await this.updateDependenciesList();

            console.log('PYTHON_ENV: Base packages installed successfully');

        } catch (error) {
            console.error('PYTHON_ENV: Failed to install base packages:', error);
            throw error;
        }
    }

    /**
     * Ensure lizard package is available in the environment
     */
    private async ensureLizardAvailable(): Promise<void> {
        try {
            console.log('PYTHON_ENV: Checking lizard availability in existing environment...');
            
            const isInstalled = await this.isPackageInstalled('lizard');
            if (!isInstalled) {
                console.log('PYTHON_ENV: Lizard not found in existing environment, installing...');
                await this.installLizardPackage();
                await this.updateDependenciesList();
            } else {
                console.log('PYTHON_ENV: Lizard is already installed in the environment');
            }
        } catch (error) {
            console.warn('PYTHON_ENV: Failed to ensure lizard availability:', error);
            // Don't throw - this shouldn't break the environment initialization
        }
    }

    /**
     * Install lizard package for code complexity analysis
     */
    private async installLizardPackage(): Promise<void> {
        try {
            console.log('PYTHON_ENV: Installing lizard package for code complexity analysis...');
            
            const venvPath = this.storage.getVenvPath();
            const pythonPath = PythonEnvUtils.getVenvPythonPath(venvPath);

            // Check if lizard is already installed
            const isInstalled = await this.isPackageInstalled('lizard');
            if (isInstalled) {
                console.log('PYTHON_ENV: Lizard is already installed - skipping installation');
                return;
            }

            // Install lizard using the virtual environment's Python interpreter
            console.log('PYTHON_ENV: Installing lizard via pip...');
            await this.executeCommand(`"${pythonPath}" -m pip install lizard`);
            
            console.log('PYTHON_ENV: Lizard has been installed successfully');

            // Verify installation by testing lizard import
            try {
                const output = await this.executeCommand(`"${pythonPath}" -c "import lizard; print('Lizard version:', lizard.__version__)"`);
                console.log('PYTHON_ENV: Lizard installation verified successfully -', output.trim());
            } catch (verifyError) {
                console.warn('PYTHON_ENV: Lizard installation succeeded but verification failed:', verifyError);
            }

        } catch (error) {
            console.error('PYTHON_ENV: Failed to install lizard package:', error);
            // Don't throw the error - lizard installation failure shouldn't break the entire environment setup
            console.warn('PYTHON_ENV: Continuing environment setup despite lizard installation failure');
        }
    }

    /**
     * Check if a package is installed in the virtual environment
     */
    private async isPackageInstalled(packageName: string): Promise<boolean> {
        try {
            const venvPath = this.storage.getVenvPath();
            const pythonPath = PythonEnvUtils.getVenvPythonPath(venvPath);
            
            // Try to import the package to check if it's installed
            await this.executeCommand(`"${pythonPath}" -c "import ${packageName}"`);
            return true;
        } catch (error) {
            // If import fails, package is not installed
            return false;
        }
    }

    /**
     * Update the dependencies list in metadata
     */
    private async updateDependenciesList(): Promise<void> {
        try {
            const venvPath = this.storage.getVenvPath();
            const pipPath = PythonEnvUtils.getVenvPipPath(venvPath);

            // Get list of installed packages
            const output = await this.executeCommand(`"${pipPath}" list --format=freeze`);
            const dependencies = output.split('\n')
                .filter(line => line.trim() && !line.startsWith('#'))
                .map(line => line.trim());

            await this.storage.updateDependencies(dependencies);
            console.log(`PYTHON_ENV: Dependencies list updated (${dependencies.length} packages)`);

        } catch (error) {
            console.error('PYTHON_ENV: Failed to update dependencies list:', error);
        }
    }
}
