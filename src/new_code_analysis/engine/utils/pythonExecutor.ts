/**
 * Python Executor for New Code Analysis
 * Executes Python analysis scripts and returns results
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import { getPythonEnvCommands } from '../../../commands/python_env/pythonEnvCommands';

export type AnalysisType = 'FileLivePanel' | 'DOMVisualization' | 'FileXRAnalysis';

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

            // Get the main Python dispatcher script
            const mainScriptPath = PythonExecutor.getMainScriptPath(context);
            
            console.log(`PYTHON_EXECUTOR: Using main dispatcher: ${mainScriptPath}`);

            // Execute the Python analysis using the main dispatcher
            const result = await PythonExecutor.runPythonMainDispatcher(pythonExecutable, mainScriptPath, analysisType, filePath);
            
            if (result.success && result.stdout) {
                try {
                    // Extract JSON from stdout (ignore debug messages)
                    const cleanedOutput = PythonExecutor.extractJsonFromOutput(result.stdout);
                    const analysisData = JSON.parse(cleanedOutput);
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
     * Get the main Python dispatcher script path
     */
    private static getMainScriptPath(context: vscode.ExtensionContext): string {
        const pythonDir = path.join(context.extensionPath, 'src', 'new_code_analysis', 'python');
        return path.join(pythonDir, 'main.py');
    }

    /**
     * Run Python main dispatcher with analysis type and file path
     */
    private static async runPythonMainDispatcher(pythonExecutable: string, mainScriptPath: string, analysisType: AnalysisType, filePath: string): Promise<PythonExecutionResult> {
        return new Promise((resolve) => {
            // Build arguments array for main dispatcher
            const args = [mainScriptPath, analysisType, filePath, '--debug'];
            
            console.log(`PYTHON_EXECUTOR: Executing main dispatcher: "${pythonExecutable}" ${args.map(arg => `"${arg}"`).join(' ')}`);

            const pythonProcess = spawn(pythonExecutable, args, {
                cwd: path.dirname(mainScriptPath)
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
                console.log(`PYTHON_EXECUTOR: Python main dispatcher exited with code: ${code}`);
                
                if (code === 0) {
                    resolve({
                        success: true,
                        stdout: stdout.trim(),
                        stderr: stderr.trim()
                    });
                } else {
                    resolve({
                        success: false,
                        error: `Python main dispatcher exited with code ${code}`,
                        stdout: stdout.trim(),
                        stderr: stderr.trim()
                    });
                }
            });

            pythonProcess.on('error', (error) => {
                console.error(`PYTHON_EXECUTOR: Failed to start Python main dispatcher:`, error);
                resolve({
                    success: false,
                    error: `Failed to start Python main dispatcher: ${error.message}`
                });
            });
        });
    }

    /**
     * Extract JSON from output that may contain debug messages
     */
    private static extractJsonFromOutput(output: string): string {
        console.log(`PYTHON_EXECUTOR: Raw output length: ${output.length}`);
        
        // Split output into lines
        const lines = output.split('\n');
        let jsonStart = -1;
        let jsonEnd = -1;
        
        // Find the first line that starts with { or [
        for (let i = 0; i < lines.length; i++) {
            const trimmedLine = lines[i].trim();
            if (trimmedLine.startsWith('{') || trimmedLine.startsWith('[')) {
                jsonStart = i;
                break;
            }
        }
        
        if (jsonStart === -1) {
            console.log(`PYTHON_EXECUTOR: No JSON found in output`);
            return '{}';
        }
        
        // Find the last line that ends with } or ]
        for (let i = lines.length - 1; i >= jsonStart; i--) {
            const trimmedLine = lines[i].trim();
            if (trimmedLine.endsWith('}') || trimmedLine.endsWith(']')) {
                jsonEnd = i;
                break;
            }
        }
        
        if (jsonEnd === -1) {
            console.log(`PYTHON_EXECUTOR: JSON not properly closed`);
            return '{}';
        }
        
        // Extract JSON lines
        const jsonLines = lines.slice(jsonStart, jsonEnd + 1);
        const result = jsonLines.join('\n');
        
        console.log(`PYTHON_EXECUTOR: Extracted JSON (${result.length} chars), lines ${jsonStart}-${jsonEnd}`);
        
        return result;
    }
}
