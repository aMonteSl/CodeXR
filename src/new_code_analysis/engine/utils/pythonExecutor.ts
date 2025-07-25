/**
 * Python Executor for New Code Analysis
 * Executes Python analysis scripts and returns results
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import { getPythonEnvCommands } from '../../../commands/python_env/pythonEnvCommands';
import { DirectoryAnalysisProgressService, AnalysisProgressInfo } from '../services/directoryAnalysisProgressService';

export type AnalysisType = 'FileLivePanel' | 'DOMVisualization' | 'FileXRAnalysis' | 'DirectoryLivePanel' | 'DirectoryLivePanelDeep' | 'DirectoryXR' | 'DirectoryXRDeep' | 'FileReanalysis';

export interface PythonProgressCallback {
    (current: number, total: number, percentage: number, message: string): void;
}

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
        context: vscode.ExtensionContext,
        progressCallback?: PythonProgressCallback,
        sessionId?: string
    ): Promise<PythonExecutionResult> {
        return this.executeAnalysisInternal(analysisType, filePath, context, progressCallback, undefined, sessionId);
    }

    /**
     * Execute Python analysis script with specific file list (for filtered directory analysis)
     */
    static async executeAnalysisWithFileList(
        analysisType: AnalysisType,
        rootPath: string,
        filesList: Map<string, string>,
        context: vscode.ExtensionContext,
        progressCallback?: PythonProgressCallback,
        sessionId?: string
    ): Promise<PythonExecutionResult> {
        return this.executeAnalysisInternal(analysisType, rootPath, context, progressCallback, filesList, sessionId);
    }

    /**
     * Internal method for executing Python analysis
     */
    private static async executeAnalysisInternal(
        analysisType: AnalysisType,
        filePath: string,
        context: vscode.ExtensionContext,
        progressCallback?: PythonProgressCallback,
        filesList?: Map<string, string>,
        sessionId?: string
    ): Promise<PythonExecutionResult> {
        try {
            console.log(`PYTHON_EXECUTOR: Starting ${analysisType} analysis for: ${filePath}`);

            // Start progress tracking if sessionId is provided and it's a directory analysis
            const progressService = DirectoryAnalysisProgressService.getInstance();
            const isDirectoryAnalysis = analysisType.includes('Directory');
            const totalFiles = filesList ? filesList.size : 0;
            
            if (sessionId && isDirectoryAnalysis && totalFiles > 0) {
                console.log(`PYTHON_EXECUTOR: Starting progress tracking for session ${sessionId} with ${totalFiles} files`);
                // Start progress tracking in background (don't await)
                progressService.startProgress(sessionId, analysisType, totalFiles).catch(error => {
                    console.error(`PYTHON_EXECUTOR: Error starting progress tracking:`, error);
                });
            }

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
            const result = await PythonExecutor.runPythonMainDispatcher(pythonExecutable, mainScriptPath, analysisType, filePath, progressCallback, filesList, sessionId);
            
            // Complete or fail progress tracking
            if (sessionId && isDirectoryAnalysis) {
                if (result.success) {
                    progressService.completeProgress(sessionId, "Analysis completed successfully!");
                } else {
                    progressService.failProgress(sessionId, result.error || "Analysis failed");
                }
            }
            
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
    private static async runPythonMainDispatcher(
        pythonExecutable: string, 
        mainScriptPath: string, 
        analysisType: AnalysisType, 
        filePath: string, 
        progressCallback?: PythonProgressCallback,
        filesList?: Map<string, string>,
        sessionId?: string
    ): Promise<PythonExecutionResult> {
        return new Promise((resolve) => {
            // Build arguments array for main dispatcher
            const args = [mainScriptPath, analysisType, filePath, '--debug'];
            
            // Add file list flag if we have a custom file list
            if (filesList && filesList.size > 0) {
                args.push('--file-list-stdin');
                console.log(`PYTHON_EXECUTOR: Using filtered file list with ${filesList.size} files`);
            }
            
            console.log(`PYTHON_EXECUTOR: Executing main dispatcher: "${pythonExecutable}" ${args.map(arg => `"${arg}"`).join(' ')}`);

            const pythonProcess = spawn(pythonExecutable, args, {
                cwd: path.dirname(mainScriptPath)
            });

            // Send file list to stdin if provided
            if (filesList && filesList.size > 0) {
                const fileListArray = Array.from(filesList.values());
                const fileListJson = JSON.stringify(fileListArray);
                console.log(`PYTHON_EXECUTOR: Sending ${fileListArray.length} filtered files to Python via stdin`);
                pythonProcess.stdin.write(fileListJson);
                pythonProcess.stdin.end();
            }

            let stdout = '';
            let stderr = '';
            const progressService = DirectoryAnalysisProgressService.getInstance();
            let processedFiles = 0;
            let lastProgressUpdate = Date.now();
            const processedFileNames = new Set<string>(); // Track unique processed files

            console.log(`PYTHON_EXECUTOR[${sessionId}]: Starting analysis with ${filesList?.size || 0} files`);

            // Set up artificial progress updates if Python doesn't send enough progress messages
            let progressInterval: NodeJS.Timeout | null = null;
            if (sessionId && filesList && filesList.size > 0) {
                progressInterval = setInterval(() => {
                    const timeSinceLastUpdate = Date.now() - lastProgressUpdate;
                    // If no progress update in 3 seconds, create artificial progress
                    if (timeSinceLastUpdate > 3000 && processedFiles < filesList.size) {
                        processedFiles = Math.min(processedFiles + 1, filesList.size - 1);
                        const totalFiles = filesList.size;
                        const percentage = Math.round((processedFiles / totalFiles) * 100);
                        
                        console.log(`PYTHON_EXECUTOR[${sessionId}]: Artificial progress update - ${percentage}% (${processedFiles}/${totalFiles})`);
                        
                        const progressInfo: AnalysisProgressInfo = {
                            sessionId,
                            totalFiles,
                            processedFiles,
                            currentFile: `Processing... (${processedFiles}/${totalFiles})`,
                            analysisType,
                            percentage
                        };
                        
                        progressService.updateProgress(progressInfo);
                        lastProgressUpdate = Date.now();
                    }
                }, 2000); // Check every 2 seconds
            }

            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                const stderrChunk = data.toString();
                stderr += stderrChunk;
                
                // Parse progress events from stderr and update both callbacks
                const lines = stderrChunk.split('\n');
                for (const line of lines) {
                    if (line.trim()) {
                        // Log all stderr lines for debugging
                        if (sessionId) {
                            console.log(`PYTHON_EXECUTOR[${sessionId}]: STDERR - ${line.trim()}`);
                        }
                        
                        try {
                            const parsed = JSON.parse(line.trim());
                            
                            // Handle different types of debug messages for progress tracking
                            if (parsed.debug && sessionId && filesList) {
                                const message = parsed.debug;
                                
                                // Enhanced file analysis patterns - look for various Python debug messages
                                const filePatterns = [
                                    /analyzing file[:\s]+(.+)/i,
                                    /analyzing[:\s]+(.+)/i,
                                    /processing file[:\s]+(.+)/i,
                                    /processing[:\s]+(.+)/i,
                                    /file analysis[:\s]+(.+)/i,
                                    /starting analysis.*?([\/\\][^\/\\]+\.[a-zA-Z0-9]+)/i,
                                    /\bfile[:\s]*([\/\\].*?\.[a-zA-Z0-9]+)/i
                                ];
                                
                                let foundFile = false;
                                for (const pattern of filePatterns) {
                                    const match = message.match(pattern);
                                    if (match) {
                                        // Extract file name from match
                                        let currentFile = match[1].trim();
                                        
                                        // Normalize file path for comparison
                                        let normalizedFile = currentFile;
                                        if (currentFile.includes('/') || currentFile.includes('\\')) {
                                            normalizedFile = currentFile.split(/[\/\\]/).pop() || currentFile;
                                        }
                                        
                                        // Only increment if this is a new unique file
                                        if (!processedFileNames.has(normalizedFile)) {
                                            processedFileNames.add(normalizedFile);
                                            processedFiles = processedFileNames.size; // Use Set size for accuracy
                                            const totalFiles = filesList.size;
                                            
                                            // Cap percentage at 100%
                                            const percentage = Math.min(100, Math.round((processedFiles / totalFiles) * 100));
                                            
                                            console.log(`PYTHON_EXECUTOR[${sessionId}]: Progress update - ${percentage}% - File: ${normalizedFile} (${processedFiles}/${totalFiles})`);
                                            
                                            // Update progress using new service
                                            const progressInfo: AnalysisProgressInfo = {
                                                sessionId,
                                                totalFiles,
                                                processedFiles,
                                                currentFile: normalizedFile,
                                                analysisType,
                                                percentage
                                            };
                                            
                                            progressService.updateProgress(progressInfo);
                                            lastProgressUpdate = Date.now();
                                        } else {
                                            console.log(`PYTHON_EXECUTOR[${sessionId}]: Skipping duplicate file: ${normalizedFile}`);
                                        }
                                        foundFile = true;
                                        break;
                                    }
                                }
                                
                                // If no specific pattern matched, but message contains "file" or analysis keywords
                                if (!foundFile && (message.toLowerCase().includes('file') || 
                                                  message.toLowerCase().includes('analysis') ||
                                                  message.toLowerCase().includes('processing'))) {
                                    // Extract potential filename from generic messages
                                    const words = message.split(/\s+/);
                                    let potentialFile = '';
                                    for (const word of words) {
                                        if (word.includes('.') && /\.[a-zA-Z0-9]+$/.test(word)) {
                                            potentialFile = word;
                                            break;
                                        }
                                    }
                                    
                                    if (potentialFile && !processedFileNames.has(potentialFile)) {
                                        processedFileNames.add(potentialFile);
                                        processedFiles = processedFileNames.size;
                                        const totalFiles = filesList.size;
                                        const percentage = Math.min(100, Math.round((processedFiles / totalFiles) * 100));
                                        
                                        console.log(`PYTHON_EXECUTOR[${sessionId}]: Generic progress update - ${percentage}% - ${potentialFile} (${processedFiles}/${totalFiles})`);
                                        
                                        const progressInfo: AnalysisProgressInfo = {
                                            sessionId,
                                            totalFiles,
                                            processedFiles,
                                            currentFile: potentialFile,
                                            analysisType,
                                            percentage
                                        };
                                        
                                        progressService.updateProgress(progressInfo);
                                        lastProgressUpdate = Date.now();
                                    }
                                }
                            }
                            
                            // Keep legacy progress callback for backward compatibility
                            if (parsed.progress && progressCallback) {
                                const { current, total, percentage, message } = parsed.progress;
                                progressCallback(current || 0, total || 0, percentage || 0, message || '');
                            }
                        } catch (e) {
                            // Not a JSON progress line, check for simple file processing patterns in raw text
                            if (sessionId && filesList) {
                                const rawLine = line.trim();
                                
                                // Look for file patterns in raw text
                                const rawFilePatterns = [
                                    /analyzing\s+(.+\.[a-zA-Z0-9]+)/i,
                                    /processing\s+(.+\.[a-zA-Z0-9]+)/i,
                                    /file:\s*(.+\.[a-zA-Z0-9]+)/i,
                                    /\b([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+)\b/
                                ];
                                
                                for (const pattern of rawFilePatterns) {
                                    const match = rawLine.match(pattern);
                                    if (match) {
                                        let currentFile = match[1].trim();
                                        
                                        // Only count unique files
                                        if (!processedFileNames.has(currentFile)) {
                                            processedFileNames.add(currentFile);
                                            processedFiles = processedFileNames.size;
                                            const totalFiles = filesList.size;
                                            const percentage = Math.min(100, Math.round((processedFiles / totalFiles) * 100));
                                            
                                            console.log(`PYTHON_EXECUTOR[${sessionId}]: Raw text progress - ${percentage}% - File: ${currentFile} (${processedFiles}/${totalFiles})`);
                                            
                                            const progressInfo: AnalysisProgressInfo = {
                                                sessionId,
                                                totalFiles,
                                                processedFiles,
                                                currentFile,
                                                analysisType,
                                                percentage
                                            };
                                            
                                            progressService.updateProgress(progressInfo);
                                            lastProgressUpdate = Date.now();
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            });

            pythonProcess.on('close', (code) => {
                console.log(`PYTHON_EXECUTOR: Python main dispatcher exited with code: ${code}`);
                
                // Clear progress interval
                if (progressInterval) {
                    clearInterval(progressInterval);
                    progressInterval = null;
                }
                
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
                
                // Clear progress interval
                if (progressInterval) {
                    clearInterval(progressInterval);
                    progressInterval = null;
                }
                
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

    /**
     * Execute Python analysis script for file resume (for watcher updates)
     */
    static async executeFileResumeAnalysis(
        filePath: string,
        context: vscode.ExtensionContext
    ): Promise<PythonExecutionResult> {
        try {
            console.log(`PYTHON_EXECUTOR: Starting file resume analysis for: ${filePath}`);

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
                    error: 'Python virtual environment is not available or invalid. Please check Python environment settings.'
                };
            }

            // Get Python executable path
            const pythonExecutable = venvManager.getPythonExecutablePath();
            if (!pythonExecutable) {
                return {
                    success: false,
                    error: 'Failed to get Python executable path'
                };
            }
            console.log(`PYTHON_EXECUTOR: Using Python executable: ${pythonExecutable}`);

            // Get path to the file analysis coordinator script
            const scriptPath = path.join(context.extensionPath, 'src', 'new_code_analysis', 'python', 'livePanel_file_analysis_coordinator.py');
            console.log(`PYTHON_EXECUTOR: Using file analysis script: ${scriptPath}`);

            // Execute Python script with --resume flag
            const result = await PythonExecutor.runPythonFileResumeAnalysis(pythonExecutable, scriptPath, filePath);
            
            if (result.success && result.stdout) {
                try {
                    const jsonOutput = PythonExecutor.extractJsonFromOutput(result.stdout);
                    const analysisData = JSON.parse(jsonOutput);
                    
                    console.log(`PYTHON_EXECUTOR: File resume analysis completed successfully`);
                    console.log(`PYTHON_EXECUTOR: Resume data for ${analysisData.fileName}:`, {
                        totalLines: analysisData.totalLines,
                        functionCount: analysisData.functionCount,
                        cyclomaticComplexityNumber: analysisData.cyclomaticComplexityNumber
                    });
                    
                    return {
                        success: true,
                        data: analysisData,
                        stdout: result.stdout,
                        stderr: result.stderr
                    };
                } catch (parseError) {
                    console.error(`PYTHON_EXECUTOR: Failed to parse resume analysis result as JSON:`, parseError);
                    console.log(`PYTHON_EXECUTOR: Raw stdout:`, result.stdout);
                    return {
                        success: false,
                        error: `Failed to parse resume analysis result: ${parseError}`,
                        stdout: result.stdout,
                        stderr: result.stderr
                    };
                }
            }

            return result;

        } catch (error) {
            console.error(`PYTHON_EXECUTOR: Error during file resume analysis:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Run Python file analysis coordinator with --resume flag
     */
    private static async runPythonFileResumeAnalysis(pythonExecutable: string, scriptPath: string, filePath: string): Promise<PythonExecutionResult> {
        console.log(`PYTHON_EXECUTOR: Executing file resume analysis: "${pythonExecutable}" "${scriptPath}" --resume "${filePath}"`);
        
        return new Promise((resolve) => {
            const args = [scriptPath, '--resume', filePath];
            const childProcess = spawn(pythonExecutable, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env },
                shell: false
            });

            let stdout = '';
            let stderr = '';

            childProcess.stdout?.on('data', (data: any) => {
                stdout += data.toString();
            });

            childProcess.stderr?.on('data', (data: any) => {
                stderr += data.toString();
            });

            childProcess.on('close', (code: number | null) => {
                console.log(`PYTHON_EXECUTOR: Python file resume analysis exited with code: ${code}`);
                
                if (code === 0) {
                    resolve({
                        success: true,
                        stdout: stdout,
                        stderr: stderr
                    });
                } else {
                    console.error(`PYTHON_EXECUTOR: Python file resume analysis failed with code ${code}`);
                    console.error(`PYTHON_EXECUTOR: stderr: ${stderr}`);
                    resolve({
                        success: false,
                        error: `Python file resume analysis exited with code ${code}`,
                        stdout: stdout,
                        stderr: stderr
                    });
                }
            });

            childProcess.on('error', (error: Error) => {
                console.error(`PYTHON_EXECUTOR: Error running Python file resume analysis:`, error);
                resolve({
                    success: false,
                    error: `Error running Python file resume analysis: ${error.message}`,
                    stdout: stdout,
                    stderr: stderr
                });
            });
        });
    }
}
