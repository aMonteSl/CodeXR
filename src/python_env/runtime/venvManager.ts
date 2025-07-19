import * as vscode from 'vscode';
import * as cp from 'child_process';
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

        } catch (error) {
            console.error('PYTHON_ENV: Failed to initialize environment:', error);
            vscode.window.showErrorMessage(`Failed to initialize Python environment: ${error}`);
        }
    }

    /**
     * Create a new virtual environment
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

                progress.report({ increment: 30, message: `Found Python ${pythonVersion}, creating environment...` });

                // Create virtual environment
                const venvPath = this.storage.getVenvPath();
                await this.executeCommand(`${pythonCommand} -m venv "${venvPath}"`);

                progress.report({ increment: 60, message: "Installing base packages..." });

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
