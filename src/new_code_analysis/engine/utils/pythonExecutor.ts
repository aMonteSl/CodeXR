/**
 * Python Executor for New Code Analysis
 * Executes Python analysis scripts and returns results
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import { getPythonEnvCommands } from '../../../commands/python_env/pythonEnvCommands';

export type AnalysisType = 'FileLivePanel';

export interface PythonExecutionResult {
    success: boolean;
    data?: any;
    error?: string;
    stdout?: string;
    stderr?: string;
}

export class PythonExecutor {

    /**
     * Execute Python analysis script based on analysis type
     */
    static async executeAnalysis(
        analysisType: AnalysisType,
        filePath: string,
        context: vscode.ExtensionContext
    ): Promise<PythonExecutionResult> {
        try {
            console.log(`PYTHON_EXECUTOR: Starting ${analysisType} analysis for: ${filePath}`);

            // Get the global PythonEnvCommands instance
            const pythonEnvCommands = getPythonEnvCommands();
            if (!pythonEnvCommands) {
                return {
                    success: false,
                    error: 'Python environment system is not initialized. Please restart VS Code.'
                };
            }

            // Get VenvManager from the global instance
            const venvManager = pythonEnvCommands.getVenvManager();
            
            // Check if environment is available
            const status = venvManager.getEnvironmentStatus();
            if (!status.exists || !status.isValid) {
                return {
                    success: false,
                    error: `Python virtual environment is not available. Status: exists=${status.exists}, valid=${status.isValid}. Please create a Python environment first using "CodeXR: Create Python Environment" command.`
                };
            }

            // Get the Python executable from virtual environment
            const pythonExecutable = venvManager.getPythonExecutablePath();
            if (!pythonExecutable) {
                return {
                    success: false,
                    error: 'Could not get Python executable from virtual environment'
                };
            }

            console.log(`PYTHON_EXECUTOR: Using Python executable: ${pythonExecutable}`);

            // Get the appropriate Python script based on analysis type
            const scriptPath = PythonExecutor.getScriptPath(analysisType, context);
            
            if (!scriptPath) {
                return {
                    success: false,
                    error: `No Python script found for analysis type: ${analysisType}`
                };
            }

            console.log(`PYTHON_EXECUTOR: Using script: ${scriptPath}`);

            // Execute the Python script using the virtual environment
            const result = await PythonExecutor.runPythonScript(pythonExecutable, scriptPath, filePath);
            
            if (result.success && result.stdout) {
                try {
                    // Try to parse the stdout as JSON (data.json content)
                    const analysisData = JSON.parse(result.stdout);
                    console.log(`PYTHON_EXECUTOR: Analysis completed successfully for ${analysisType}`);
                    console.log(`PYTHON_EXECUTOR: Analysis data logged to console`);
                    
                    return {
                        success: true,
                        data: analysisData,
                        stdout: result.stdout,
                        stderr: result.stderr
                    };
                } catch (parseError) {
                    console.error(`PYTHON_EXECUTOR: Failed to parse analysis result as JSON:`, parseError);
                    console.log(`PYTHON_EXECUTOR: Raw stdout:`, result.stdout);
                    return {
                        success: false,
                        error: `Failed to parse analysis result: ${parseError}`,
                        stdout: result.stdout,
                        stderr: result.stderr
                    };
                }
            }

            return result;

        } catch (error) {
            console.error(`PYTHON_EXECUTOR: Error executing ${analysisType} analysis:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Get the appropriate Python script path based on analysis type
     */
    private static getScriptPath(analysisType: AnalysisType, context: vscode.ExtensionContext): string | null {
        const pythonDir = path.join(context.extensionPath, 'src', 'new_code_analysis', 'python');
        
        if (analysisType === 'FileLivePanel') {
            return path.join(pythonDir, 'livePanel_file_analysis_coordinator.py');
        }
        
        console.error(`PYTHON_EXECUTOR: Unknown analysis type: ${analysisType}`);
        return null;
    }

    /**
     * Run Python script with file path as argument using virtual environment
     */
    private static async runPythonScript(pythonExecutable: string, scriptPath: string, filePath: string): Promise<PythonExecutionResult> {
        return new Promise((resolve) => {
            console.log(`PYTHON_EXECUTOR: Executing: "${pythonExecutable}" "${scriptPath}" "${filePath}"`);

            const pythonProcess = spawn(pythonExecutable, [scriptPath, filePath], {
                cwd: path.dirname(scriptPath)
            });

            let stdout = '';
            let stderr = '';

            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pythonProcess.on('close', (code) => {
                console.log(`PYTHON_EXECUTOR: Python process exited with code: ${code}`);
                
                if (code === 0) {
                    resolve({
                        success: true,
                        stdout: stdout.trim(),
                        stderr: stderr.trim()
                    });
                } else {
                    resolve({
                        success: false,
                        error: `Python script exited with code ${code}`,
                        stdout: stdout.trim(),
                        stderr: stderr.trim()
                    });
                }
            });

            pythonProcess.on('error', (error) => {
                console.error(`PYTHON_EXECUTOR: Failed to start Python process:`, error);
                resolve({
                    success: false,
                    error: `Failed to start Python process: ${error.message}`
                });
            });
        });
    }
}
