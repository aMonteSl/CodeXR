import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ExecutableCommand {
    executable: string;
    args: string[];
}

/**
 * Platform-specific utilities for Python environment management.
 */
export class PythonEnvUtils {
    public static readonly REQUIRED_BASE_PACKAGES = ['setuptools', 'wheel'] as const;

    /**
     * Get the preferred Python executable command for the current platform.
     */
    public static getPythonCommand(platform: NodeJS.Platform = os.platform()): string {
        return this.getSystemPythonCandidates(platform)[0].executable;
    }

    /**
     * Return the ordered list of system Python launchers to try.
     */
    public static getSystemPythonCandidates(
        platform: NodeJS.Platform = os.platform(),
    ): ExecutableCommand[] {
        if (platform === 'win32') {
            return [
                { executable: 'py', args: ['-3'] },
                { executable: 'python', args: [] },
                { executable: 'python3', args: [] },
            ];
        }

        return [
            { executable: 'python3', args: [] },
            { executable: 'python', args: [] },
        ];
    }

    /**
     * Get the virtual environment activation command for the current platform.
     */
    public static getActivationCommand(
        venvPath: string,
        platform: NodeJS.Platform = os.platform(),
    ): string {
        if (platform === 'win32') {
            return path.join(venvPath, 'Scripts', 'activate.bat');
        }

        return `source ${path.join(venvPath, 'bin', 'activate')}`;
    }

    /**
     * Get the Python executable path within a virtual environment.
     */
    public static getVenvPythonPath(
        venvPath: string,
        platform: NodeJS.Platform = os.platform(),
    ): string {
        if (platform === 'win32') {
            return path.join(venvPath, 'Scripts', 'python.exe');
        }

        return path.join(venvPath, 'bin', 'python');
    }

    /**
     * Get the pip executable path within a virtual environment.
     * Kept for validation/compatibility, but package operations should prefer `python -m pip`.
     */
    public static getVenvPipPath(
        venvPath: string,
        platform: NodeJS.Platform = os.platform(),
    ): string {
        if (platform === 'win32') {
            return path.join(venvPath, 'Scripts', 'pip.exe');
        }

        return path.join(venvPath, 'bin', 'pip');
    }

    /**
     * Build a command that runs arbitrary Python arguments using the venv interpreter.
     */
    public static getVenvPythonCommand(
        venvPath: string,
        args: string[] = [],
        platform: NodeJS.Platform = os.platform(),
    ): ExecutableCommand {
        return {
            executable: this.getVenvPythonPath(venvPath, platform),
            args,
        };
    }

    /**
     * Build a command that runs a Python module using the venv interpreter.
     */
    public static getVenvModuleCommand(
        venvPath: string,
        moduleName: string,
        moduleArgs: string[] = [],
        platform: NodeJS.Platform = os.platform(),
    ): ExecutableCommand {
        return this.getVenvPythonCommand(
            venvPath,
            ['-m', moduleName, ...moduleArgs],
            platform,
        );
    }

    /**
     * Build a pip command that always runs through the venv Python interpreter.
     */
    public static getVenvPipCommand(
        venvPath: string,
        pipArgs: string[] = [],
        platform: NodeJS.Platform = os.platform(),
    ): ExecutableCommand {
        return this.getVenvModuleCommand(venvPath, 'pip', pipArgs, platform);
    }

    /**
     * Build the command used to bootstrap pip inside the virtual environment.
     */
    public static getEnsurePipCommand(
        venvPath: string,
        platform: NodeJS.Platform = os.platform(),
    ): ExecutableCommand {
        return this.getVenvModuleCommand(venvPath, 'ensurepip', ['--upgrade'], platform);
    }

    /**
     * Build a command by appending arguments to a base command.
     */
    public static appendArgs(command: ExecutableCommand, args: string[]): ExecutableCommand {
        return {
            executable: command.executable,
            args: [...command.args, ...args],
        };
    }

    /**
     * Format a command for logs and diagnostics.
     */
    public static formatCommand(command: ExecutableCommand): string {
        return [command.executable, ...command.args]
            .map((part) => {
                if (part.length === 0) {
                    return '""';
                }

                return /\s|"/.test(part)
                    ? `"${part.replace(/"/g, '\\"')}"`
                    : part;
            })
            .join(' ');
    }

    /**
     * Check if a path points to a valid virtual environment.
     */
    public static isValidVenv(
        venvPath: string,
        platform: NodeJS.Platform = os.platform(),
    ): boolean {
        try {
            if (!fs.existsSync(venvPath)) {
                return false;
            }

            const pythonPath = this.getVenvPythonPath(venvPath, platform);
            if (!fs.existsSync(pythonPath)) {
                return false;
            }

            const pipPath = this.getVenvPipPath(venvPath, platform);
            if (!fs.existsSync(pipPath)) {
                return false;
            }

            const configPath = path.join(venvPath, 'pyvenv.cfg');
            if (!fs.existsSync(configPath)) {
                return false;
            }

            return true;
        } catch (error) {
            console.log(`PYTHON_ENV: Error validating venv at ${venvPath}:`, error);
            return false;
        }
    }

    /**
     * Validate a path is safe for virtual environment creation.
     */
    public static isValidPath(targetPath: string): boolean {
        try {
            const parentDir = path.dirname(targetPath);

            if (!fs.existsSync(parentDir)) {
                return false;
            }

            if (fs.existsSync(targetPath)) {
                const stats = fs.statSync(targetPath);
                if (stats.isDirectory()) {
                    const contents = fs.readdirSync(targetPath);
                    return contents.length === 0;
                }
                return false;
            }

            return true;
        } catch (error) {
            console.log(`PYTHON_ENV: Error validating path ${targetPath}:`, error);
            return false;
        }
    }

    /**
     * Extract Python version from a pyvenv.cfg file.
     */
    public static extractPythonVersion(venvPath: string): string | null {
        try {
            const configPath = path.join(venvPath, 'pyvenv.cfg');

            if (!fs.existsSync(configPath)) {
                return null;
            }

            const configContent = fs.readFileSync(configPath, 'utf-8');
            const versionMatch = configContent.match(/version\s*=\s*([^\s\n]+)/);

            return versionMatch ? versionMatch[1] : null;
        } catch (error) {
            console.log(`PYTHON_ENV: Error extracting version from ${venvPath}:`, error);
            return null;
        }
    }

    /**
     * Get platform-specific environment separator.
     */
    public static getPathSeparator(): string {
        return os.platform() === 'win32' ? ';' : ':';
    }

    /**
     * Ensure directory exists, creating it if necessary.
     */
    public static ensureDirectoryExists(dirPath: string): boolean {
        try {
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
            return true;
        } catch (error) {
            console.error(`PYTHON_ENV: Failed to create directory ${dirPath}:`, error);
            return false;
        }
    }
}
