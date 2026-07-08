import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { VenvManager } from '../../../python_env/runtime/venvManager';

/**
 * Utility para ejecutar análisis Python
 * 
 * Esta clase:
 * - Recibe el tipo de análisis y sesión
 * - Determina qué script Python ejecutar  
 * - Ejecuta el análisis y retorna los datos JSON
 */

export class ExecutePython {
    private venvManager: VenvManager;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        console.log('EXECUTE_PYTHON: Initializing ExecutePython utility...');
        this.context = context;
        this.venvManager = new VenvManager(context);
    }

    public async executeXRFieldSchema(targetType: 'file' | 'directory'): Promise<any> {
        console.log('EXECUTE_PYTHON: Loading XR field schema for ' + targetType);
        return await this.executePythonScript('main.py', [
            '--mode', 'schema',
            '--type', targetType,
        ]);
    }

      public async executeDependencyAnalysis(
          targetPath: string,
          targetType: 'file' | 'directory',
          deep: boolean,
          cachePath?: string,
          refreshRequestPath?: string,
          projectRoot?: string,
      ): Promise<any> {
        const args = [
            '--mode', 'dependencies',
            '--type', targetType,
            '--target', targetPath,
        ];
        if (deep) {
            args.push('--deep');
        }
          if (cachePath) {
              args.push('--cache', cachePath);
          }
          if (refreshRequestPath) {
              args.push('--dependency-refresh', refreshRequestPath);
          }
          if (projectRoot) {
              args.push('--project-root', projectRoot);
          }
          return this.executePythonScript('main.py', args);
      }

    /**
     * Ejecuta análisis Python según el tipo de análisis
     * 
     * @param session - Sesión de análisis unificada
     * @returns Promise con los datos JSON del análisis
     */
    public async executeAnalysis(
        session: UnifiedAnalysisSession,
        options: { silent: boolean } = {},
    ): Promise<any> {
        console.log(`EXECUTE_PYTHON:  Starting Python analysis execution...`);
        console.log(`EXECUTE_PYTHON: Analysis mode: ${session.analysisMode}`);
        console.log(`EXECUTE_PYTHON: Target type: ${session.targetType}`);
        console.log(`EXECUTE_PYTHON: Target path: ${session.targetPath}`);

        const runAnalysis = async (progress: vscode.Progress<{message: string; increment: number}>): Promise<any> => {
            progress.report({
                increment: 0,
                message: `Starting ${session.analysisMode} analysis...`,
            });

            try {
                if (session.analysisMode === 'LivePanel' && session.targetType === 'file') {
                    console.log('EXECUTE_PYTHON:  File LivePanel analysis requested');
                    return await this.executeFileAnalysis(session, progress);
                } else if (session.analysisMode === 'LivePanel' && session.targetType === 'directory') {
                    console.log('EXECUTE_PYTHON:  Directory LivePanel analysis requested');
                    return await this.executeDirectoryAnalysis(session, progress);
                } else if (session.analysisMode === 'VisualizeDOM' && session.targetType === 'file') {
                    console.log('EXECUTE_PYTHON:  HTML DOM analysis requested');
                    return await this.executeHTMLDOMAnalysis(session, progress);
                } else if (session.analysisMode === 'XR') {
                    console.log('EXECUTE_PYTHON:  XR analysis requested');
                    return await this.executeXRAnalysis(session, progress);
                }

                throw new Error(`Unknown analysis combination: ${session.analysisMode} + ${session.targetType}`);
            } catch (error) {
                console.error('EXECUTE_PYTHON:  Error during Python analysis:', error);
                progress.report({ message: 'Analysis failed' });
                throw error;
            }
        };

        if (options.silent) {
            return await runAnalysis();
        }

        return await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'CodeXR Analysis',
                cancellable: false,
            },
            runAnalysis,
        );
    }

    private async executeFileAnalysis(
        session: UnifiedAnalysisSession,
        progress?: vscode.Progress<{message?: string; increment?: number}>,
    ): Promise<any> {
        console.log(`EXECUTE_PYTHON:  Executing file analysis for: ${session.targetPath}`);

        try {
            const args = [
                '--mode', 'livePanel',
                '--type', 'file',
                '--target', session.targetPath,
            ];

            console.log(`EXECUTE_PYTHON: Executing file analysis with args: ${args.join(' ')}`);
            const result = await this.executePythonScript('main.py', args, progress);

            if (result && result?.success !== false) {
                console.log('EXECUTE_PYTHON:  File analysis completed successfully');
                progress?.report({ message: 'File analysis completed!' });
                return result;
            }

            console.error('EXECUTE_PYTHON:  File analysis failed:', result);
            throw new Error(`File analysis failed: ${result?.error || 'Unknown error'}`);
        } catch (error) {
            console.error('EXECUTE_PYTHON:  Error during file analysis:', error);
            throw error;
        }
    }

    private async executeDirectoryAnalysis(
        session: UnifiedAnalysisSession,
        progress?: vscode.Progress<{message?: string; increment?: number}>,
    ): Promise<any> {
        console.log('EXECUTE_PYTHON:  Executing directory analysis...');
        console.log(`EXECUTE_PYTHON: Will analyze directory: ${session.targetPath}`);
        console.log(`EXECUTE_PYTHON: Analysis mode: ${session.analysisMode}`);

        try {
            const isDeepAnalysis = session.isDeep;
            const args = [
                '--mode', 'livePanel',
                '--type', 'directory',
                '--target', session.targetPath,
            ];

            console.log('EXECUTE_PYTHON: Python coordinator will scan and filter directory contents internally');
            progress?.report({ message: 'Preparing directory analysis...' });

            if (isDeepAnalysis) {
                console.log('EXECUTE_PYTHON: Deep analysis requested');
                args.push('--deep');
            }

            console.log(`EXECUTE_PYTHON: Executing with args: ${args.join(' ')}`);

            const result = await this.executePythonScript('main.py', args, progress);

            if (result && result.success !== false) {
                console.log('EXECUTE_PYTHON:  Directory analysis completed successfully');
                progress?.report({ message: 'Directory analysis completed!' });
                return result;
            }

            console.error('EXECUTE_PYTHON:  Directory analysis failed:', result);
            throw new Error(`Directory analysis failed: ${result?.error || 'Unknown error'}`);
        } catch (error) {
            console.error('EXECUTE_PYTHON:  Error during directory analysis:', error);
            throw error;
        }
    }

    private async executeXRAnalysis(
        session: UnifiedAnalysisSession,
        progress?: vscode.Progress<{message?: string; increment?: number}>,
    ): Promise<any> {
        console.log(`EXECUTE_PYTHON:  Executing XR analysis for: ${session.targetPath}`);
        console.log(`EXECUTE_PYTHON: Target type: ${session.targetType}`);

        try {
            const args = [
                '--mode', 'xr',
                '--type', session.targetType,
                '--target', session.targetPath,
            ];

            if (session.targetType === 'directory') {
                console.log('EXECUTE_PYTHON: XR_ANALYSIS: Python coordinator will scan and filter directory contents internally');
                progress.report({ message: session.isDeep ? 'Preparing deep XR analysis...' : 'Preparing XR directory analysis...' });
            }

            if (session.targetType === 'directory' && session.isDeep) {
                console.log('EXECUTE_PYTHON: XR_ANALYSIS: Adding --deep flag for deep directory analysis');
                args.push('--deep');
            }

            console.log('EXECUTE_PYTHON: XR_ANALYSIS:  Starting XR analysis with main.py');
            console.log(`EXECUTE_PYTHON: XR_ANALYSIS: Args: ${args.join(' ')}`);
            progress?.report({ message: 'Starting XR analysis...' });

            const result = await this.executePythonScript('main.py', args, progress);

            console.log('EXECUTE_PYTHON: XR_ANALYSIS:  Raw Python result received:', {
                resultType: typeof result,
                isArray: Array.isArray(result),
                isObject: typeof result === 'object',
                hasSuccessProperty: result && typeof result === 'object' && 'success' in result,
                hasErrorProperty: result && typeof result === 'object' && 'error' in result,
                success: result?.success,
                error: result?.error,
                rawOutputLength: result?.rawOutput?.length || 0,
            });

            if (result?.success === false && result?.rawOutput && result?.error?.includes('JSON markers not found')) {
                console.log('EXECUTE_PYTHON: XR_ANALYSIS:  JSON markers missing, attempting to parse rawOutput directly...');
                console.log(`EXECUTE_PYTHON: XR_ANALYSIS:  Raw output preview: ${result.rawOutput.substring(0, 200)}${result.rawOutput.length > 200 ? '...' : ''}`);

                try {
                    const parsedData = JSON.parse(result.rawOutput);
                    console.log('EXECUTE_PYTHON: XR_ANALYSIS:  Successfully parsed rawOutput as direct JSON!');
                    console.log('EXECUTE_PYTHON: XR_ANALYSIS:  Parsed data type:', typeof parsedData);
                    console.log('EXECUTE_PYTHON: XR_ANALYSIS:  Is array:', Array.isArray(parsedData));

                    if (Array.isArray(parsedData)) {
                        console.log(`EXECUTE_PYTHON: XR_ANALYSIS:  Generated ${parsedData.length} XR function records`);
                        if (parsedData.length > 0) {
                            console.log('EXECUTE_PYTHON: XR_ANALYSIS:  Sample function data:', {
                                functionName: parsedData[0].functionName,
                                complexity: parsedData[0].complexity,
                                parameters: parsedData[0].parameters,
                                lineCount: parsedData[0].lineCount,
                                fileName: parsedData[0].fileName,
                            });
                        }
                        console.log(`EXECUTE_PYTHON: XR_ANALYSIS:  Successfully completed analysis for ${session.targetPath}`);
                    }

                    progress?.report({ message: 'XR analysis completed!' });
                    return parsedData;
                } catch (parseError) {
                    console.error('EXECUTE_PYTHON: XR_ANALYSIS:  Failed to parse rawOutput as JSON:', parseError);
                    console.error('EXECUTE_PYTHON: XR_ANALYSIS:  Raw output content:', result.rawOutput);
                    throw new Error(`XR analysis failed: Unable to parse result - ${result.error}`);
                }
            }

            if (result && result.success !== false) {
                console.log('EXECUTE_PYTHON: XR_ANALYSIS:  Direct result received (no error wrapper)');
                console.log('EXECUTE_PYTHON: XR_ANALYSIS:  Analysis result details:', {
                    functionsCount: Array.isArray(result) ? result.length : 0,
                    isArray: Array.isArray(result),
                    resultType: typeof result,
                });

                if (Array.isArray(result)) {
                    console.log(`EXECUTE_PYTHON: XR_ANALYSIS:  Generated ${result.length} XR function records`);
                    console.log(`EXECUTE_PYTHON: XR_ANALYSIS:  Successfully completed analysis for ${session.targetPath}`);

                    if (result.length > 0) {
                        console.log('EXECUTE_PYTHON: XR_ANALYSIS:  Sample function:', {
                            functionName: result[0].functionName,
                            complexity: result[0].complexity,
                            parameters: result[0].parameters,
                            lineCount: result[0].lineCount,
                            fileName: result[0].fileName,
                        });
                    }
                } else {
                    console.log(`EXECUTE_PYTHON: XR_ANALYSIS:  Result is not an array, type: ${typeof result}`);
                }

                progress?.report({ message: 'XR analysis completed!' });
                return result;
            }

            console.error('EXECUTE_PYTHON: XR_ANALYSIS:  XR analysis failed with error:', result);
            throw new Error(`XR analysis failed: ${result?.error || 'Unknown error'}`);
        } catch (error) {
            console.error('EXECUTE_PYTHON: XR_ANALYSIS:  Error during XR analysis:', error);
            throw error;
        }
    }

    private async executeHTMLDOMAnalysis(
        session: UnifiedAnalysisSession,
        progress?: vscode.Progress<{message?: string; increment?: number}>,
    ): Promise<any> {
        console.log(`EXECUTE_PYTHON:  Executing HTML DOM analysis for: ${session.targetPath}`);

        try {
            const args = [session.targetPath];

            console.log(`EXECUTE_PYTHON: Executing HTML DOM analysis with args: ${args.join(' ')}`);
            progress?.report({ message: 'Parsing HTML DOM...' });

            const result = await this.executePythonScript('html/html_dom_parser.py', args, progress);

            if (result && !result.error) {
                console.log('EXECUTE_PYTHON:  HTML DOM analysis completed successfully');
                console.log(`EXECUTE_PYTHON:  Processed HTML content length: ${result.htmlContent?.length || 0} chars`);
                console.log('EXECUTE_PYTHON:  Analysis result:', {
                    originalFile: result.originalFile,
                    preparedForVisualization: result.preparedForVisualization,
                    htmlContentLength: result.htmlContent?.length || 0,
                });
                progress?.report({ message: 'HTML DOM analysis completed!' });
                return result;
            }

            console.error('EXECUTE_PYTHON:  HTML DOM analysis failed:', result);
            throw new Error(`HTML DOM analysis failed: ${result?.error || 'Unknown error'}`);
        } catch (error) {
            console.error('EXECUTE_PYTHON:  Error during HTML DOM analysis:', error);
            throw error;
        }
    }

    public async executeFileReanalysis(filePaths: string[]): Promise<any> {
        console.log(`EXECUTE_PYTHON:  Starting file re-analysis for ${filePaths.length} files`);

        try {
            const args = [
                ...filePaths,
            ];

            console.log(`EXECUTE_PYTHON: Executing file re-analysis with args: ${args.join(' ')}`);
            const result = await this.executePythonScript('sumaryFiles/file_reanalysis_coordinator.py', args);

            if (result && Array.isArray(result)) {
                console.log(`EXECUTE_PYTHON:  File re-analysis completed successfully for ${result.length} files`);
                return result;
            } else if (result && result.success !== false) {
                console.log('EXECUTE_PYTHON:  File re-analysis completed successfully for single file');
                return [result];
            }

            console.error('EXECUTE_PYTHON:  File re-analysis failed:', result);
            throw new Error(`File re-analysis failed: ${result?.error || 'Unknown error'}`);
        } catch (error) {
            console.error('EXECUTE_PYTHON:  Error during file re-analysis:', error);
            throw error;
        }
    }

    private async executePythonScript(
        scriptName: string,
        args: string[],
        progress?: vscode.Progress<{message?: string; increment?: number}>,
    ): Promise<any> {
        console.log(`EXECUTE_PYTHON:  Executing Python script: ${scriptName}`);
        console.log(`EXECUTE_PYTHON: Script arguments: ${args.join(' ')}`);

        console.log('EXECUTE_PYTHON: ');
        console.log('EXECUTE_PYTHON:  STARTING ANALYSIS');
        console.log(`EXECUTE_PYTHON:  Script: ${scriptName}`);
        console.log(`EXECUTE_PYTHON:  Target: ${args.includes('--target') ? args[args.indexOf('--target') + 1] : 'Multiple targets'}`);
        console.log(`EXECUTE_PYTHON:  Mode: ${args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'Unknown'}`);
        console.log(`EXECUTE_PYTHON:  Type: ${args.includes('--type') ? args[args.indexOf('--type') + 1] : 'Unknown'}`);
        console.log('EXECUTE_PYTHON: ');

        try {
            const pythonExecutable = this.venvManager.getPythonExecutablePath();
            if (!pythonExecutable) {
                throw new Error('Python executable not found in virtual environment');
            }
            console.log(`EXECUTE_PYTHON: Using Python executable: ${pythonExecutable}`);

            if (!require('fs').existsSync(pythonExecutable)) {
                throw new Error(`Python executable does not exist: ${pythonExecutable}`);
            }

            console.log('EXECUTE_PYTHON:  Python executable verified to exist');

            const extensionPath = this.context.extensionPath;
            let scriptPath = path.join(extensionPath, 'dist', 'code_analysis', 'python', scriptName);

            if (!require('fs').existsSync(scriptPath)) {
                scriptPath = path.join(extensionPath, 'src', 'code_analysis', 'python', scriptName);
                console.log('EXECUTE_PYTHON: Script not found in dist, trying src directory');
            }

            console.log(`EXECUTE_PYTHON: Script path: ${scriptPath}`);

            if (!require('fs').existsSync(scriptPath)) {
                const distPath = path.join(extensionPath, 'dist', 'code_analysis', 'python', scriptName);
                const srcPath = path.join(extensionPath, 'src', 'code_analysis', 'python', scriptName);

                console.error('EXECUTE_PYTHON:  Python script not found in either location:');
                console.error(`EXECUTE_PYTHON:  Dist path: ${distPath} (exists: ${require('fs').existsSync(distPath)})`);
                console.error(`EXECUTE_PYTHON:  Src path: ${srcPath} (exists: ${require('fs').existsSync(srcPath)})`);
                console.error(`EXECUTE_PYTHON:  Extension path: ${extensionPath}`);

                try {
                    const distCodeAnalysisPath = path.join(extensionPath, 'dist', 'code_analysis');
                    if (require('fs').existsSync(distCodeAnalysisPath)) {
                        const distContents = require('fs').readdirSync(distCodeAnalysisPath);
                        console.error(`EXECUTE_PYTHON:  dist/code_analysis contents: ${distContents.join(', ')}`);
                    }

                    const distPythonPath = path.join(extensionPath, 'dist', 'code_analysis', 'python');
                    if (require('fs').existsSync(distPythonPath)) {
                        const distPythonContents = require('fs').readdirSync(distPythonPath);
                        console.error(`EXECUTE_PYTHON:  dist/code_analysis/python contents: ${distPythonContents.join(', ')}`);
                    }
                } catch (listError) {
                    console.error('EXECUTE_PYTHON: Failed to list directory contents:', listError);
                }

                throw new Error(`Python script does not exist: ${scriptPath}`);
            }

            console.log('EXECUTE_PYTHON:  Python script verified to exist');

            const fullArgs = [scriptPath, ...args];
            console.log(`EXECUTE_PYTHON: Full command: ${pythonExecutable} ${fullArgs.join(' ')}`);
            console.log('EXECUTE_PYTHON:  About to spawn Python process...');

            return new Promise((resolve) => {
                console.log('EXECUTE_PYTHON: Creating child process with spawn...');
                console.log(`EXECUTE_PYTHON: Executable: "${pythonExecutable}"`);
                console.log(`EXECUTE_PYTHON: Arguments: [${fullArgs.map(arg => `"${arg}"`).join(', ')}]`);
                console.log(`EXECUTE_PYTHON: Working directory: ${path.dirname(scriptPath)}`);

                const childProcess = cp.spawn(pythonExecutable, fullArgs, {
                    cwd: path.dirname(scriptPath),
                    env: process.env,
                    stdio: ['pipe', 'pipe', 'pipe'],
                });

                console.log(`EXECUTE_PYTHON:  Process spawned with PID: ${childProcess.pid}`);

                childProcess.on('error', (error) => {
                    console.error('EXECUTE_PYTHON:  Failed to start Python process:', error);
                    console.error('EXECUTE_PYTHON: Error details:', {
                        code: (error as any).code,
                        errno: (error as any).errno,
                        syscall: (error as any).syscall,
                        path: (error as any).path,
                    });
                    resolve({
                        success: false,
                        error: `Failed to start Python process: ${error}`,
                        rawOutput: '',
                    });
                });

                let stdoutData = '';
                let stderrData = '';

                childProcess.stdout.on('data', (data) => {
                    stdoutData += data.toString();
                    console.log(`EXECUTE_PYTHON:  stdout chunk received (${data.toString().length} chars)`);
                });

                childProcess.stderr.on('data', (data) => {
                    const stderrLine = data.toString();
                    stderrData += stderrLine;

                    const lines = stderrLine.split('\n');
                    for (const line of lines) {
                        if (!line.trim()) {
                            continue;
                        }

                        try {
                            const parsed = JSON.parse(line.trim());
                            if (parsed.progress) {
                                const current = parsed.progress.current || 0;
                                const total = parsed.progress.total || 0;
                                const percentage = parsed.progress.percentage || 0;
                                const fileName = parsed.progress.fileName || parsed.progress.file || parsed.progress.current_file || 'Processing file...';
                                const message = parsed.progress.message || 'Processing';

                                console.log(`EXECUTE_PYTHON:  PROGRESS [${current}/${total}] (${percentage}%) - ${message}`);
                                console.log(`EXECUTE_PYTHON:  Current file: ${fileName}`);

                                if (progress && total > 0) {
                                    const increment = percentage > 0 ? 100 / total : 0;
                                    const displayFileName = fileName.includes('/') ? fileName.split('/').pop() : fileName;
                                    progress.report({
                                        message: `${current}/${total} (${percentage}%) - ${displayFileName}`,
                                        increment,
                                    });
                                }

                                if (parsed.progress.operation) {
                                    console.log(`EXECUTE_PYTHON:   Operation: ${parsed.progress.operation}`);
                                }
                                if (parsed.progress.estimatedTime) {
                                    console.log(`EXECUTE_PYTHON:   Estimated time remaining: ${parsed.progress.estimatedTime}`);
                                }
                            } else if (parsed.debug) {
                                console.log(`EXECUTE_PYTHON:  DEBUG: ${parsed.debug}`);
                            } else if (parsed.info) {
                                console.log(`EXECUTE_PYTHON:   INFO: ${parsed.info}`);
                                if (progress) {
                                    progress.report({ message: parsed.info });
                                }
                            } else if (parsed.warning) {
                                console.log(`EXECUTE_PYTHON:   WARNING: ${parsed.warning}`);
                            } else if (parsed.error) {
                                console.log(`EXECUTE_PYTHON:  ERROR: ${parsed.error}`);
                            }
                        } catch {
                            const cleanLine = line.trim();
                            if (!cleanLine) {
                                continue;
                            }

                            if (cleanLine.includes('Analyzing') || cleanLine.includes('Processing')) {
                                console.log(`EXECUTE_PYTHON:  ${cleanLine}`);
                                if (progress) {
                                    progress.report({ message: cleanLine });
                                }
                            } else if (cleanLine.includes('Progress:') || cleanLine.includes('%')) {
                                console.log(`EXECUTE_PYTHON:  ${cleanLine}`);
                                if (progress) {
                                    progress.report({ message: cleanLine });
                                }
                            } else if (cleanLine.includes('ERROR') || cleanLine.includes('Error')) {
                                console.log(`EXECUTE_PYTHON:  ${cleanLine}`);
                            } else if (cleanLine.includes('WARNING') || cleanLine.includes('Warning')) {
                                console.log(`EXECUTE_PYTHON:   ${cleanLine}`);
                            } else {
                                console.log(`EXECUTE_PYTHON:  ${cleanLine}`);
                            }
                        }
                    }
                });

                childProcess.on('close', (code) => {
                    console.log('EXECUTE_PYTHON: ');
                    console.log('EXECUTE_PYTHON:  ANALYSIS COMPLETED');
                    console.log(`EXECUTE_PYTHON:  Script: ${scriptName}`);
                    console.log(`EXECUTE_PYTHON:  Exit code: ${code}`);
                    console.log(`EXECUTE_PYTHON:  Output size: ${stdoutData.length} chars`);
                    console.log(`EXECUTE_PYTHON:  Error output size: ${stderrData.length} chars`);

                    if (code === 0) {
                        console.log('EXECUTE_PYTHON:  SUCCESS - Processing results...');

                        try {
                            const parsedResult = this.parsePythonOutput(stdoutData);
                            console.log('EXECUTE_PYTHON:  Successfully parsed Python result');
                            if (Array.isArray(parsedResult)) {
                                console.log(`EXECUTE_PYTHON:  Result type: Array with ${parsedResult.length} items`);
                            } else if (typeof parsedResult === 'object' && parsedResult !== null) {
                                console.log('EXECUTE_PYTHON:  Result type: Object');
                                if ((parsedResult as any).files && Array.isArray((parsedResult as any).files)) {
                                    console.log(`EXECUTE_PYTHON:  Files analyzed: ${(parsedResult as any).files.length}`);
                                }
                                if ((parsedResult as any).summary) {
                                    console.log('EXECUTE_PYTHON:  Summary available: Yes');
                                }
                            }
                            console.log('EXECUTE_PYTHON: ');
                            resolve(parsedResult);
                        } catch (parseError) {
                            console.warn('EXECUTE_PYTHON:  JSON markers not found or parse failed');
                            console.log('EXECUTE_PYTHON: ');
                            resolve({
                                success: false,
                                error: parseError instanceof Error ? parseError.message : String(parseError),
                                rawOutput: stdoutData,
                            });
                        }
                    } else {
                        console.error(`EXECUTE_PYTHON:  FAILED - Python script failed with exit code ${code}`);
                        if (stderrData.trim()) {
                            console.error(`EXECUTE_PYTHON:  Error output preview: ${stderrData.substring(0, 200)}${stderrData.length > 200 ? '...' : ''}`);
                        }
                        console.log('EXECUTE_PYTHON: ');
                        resolve({
                            success: false,
                            error: `Python script failed with exit code ${code}`,
                            stderr: stderrData,
                            stdout: stdoutData,
                        });
                    }
                });
            });
        } catch (error) {
            console.error('EXECUTE_PYTHON:  Error executing Python script:', error);
            throw error;
        }
    }

    private parsePythonOutput(stdoutData: string): any {
        const jsonStartMarker = '=== JSON_START ===';
        const jsonEndMarker = '=== JSON_END ===';
        const startIndex = stdoutData.indexOf(jsonStartMarker);
        const endIndex = stdoutData.indexOf(jsonEndMarker);

        if (startIndex >= 0 && endIndex >= 0) {
            const jsonContent = stdoutData.substring(startIndex + jsonStartMarker.length, endIndex).trim();
            return JSON.parse(jsonContent);
        }

        const trimmedOutput = stdoutData.trim();
        if (!trimmedOutput) {
            throw new Error('JSON markers not found in Python output');
        }

        try {
            return JSON.parse(trimmedOutput);
        } catch {
            throw new Error('JSON markers not found in Python output');
        }
    }
}
