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

    /**
     * Ejecuta análisis Python según el tipo de análisis
     * 
     * @param session - Sesión de análisis unificada
     * @returns Promise con los datos JSON del análisis
     */
    public async executeAnalysis(session: UnifiedAnalysisSession): Promise<any> {
        console.log(`EXECUTE_PYTHON: 🐍 Starting Python analysis execution...`);
        console.log(`EXECUTE_PYTHON: Analysis mode: ${session.analysisMode}`);
        console.log(`EXECUTE_PYTHON: Target type: ${session.targetType}`);
        console.log(`EXECUTE_PYTHON: Target path: ${session.targetPath}`);

        // 📊 SHOW PROGRESS IN VS CODE UI
        return await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: "CodeXR Analysis",
                cancellable: false
            },
            async (progress, token) => {
                // Mostrar progreso inicial
                progress.report({ 
                    increment: 0, 
                    message: `Starting ${session.analysisMode} analysis...` 
                });

                try {
                    // Determinar qué tipo de análisis ejecutar
                    if (session.analysisMode === 'LivePanel' && session.targetType === 'file') {
                        console.log(`EXECUTE_PYTHON: 📄 File LivePanel analysis requested`);
                        return await this.executeFileAnalysis(session, progress);
                    } else if (session.analysisMode === 'LivePanel' && session.targetType === 'directory') {
                        console.log(`EXECUTE_PYTHON: 📁 Directory LivePanel analysis requested`);
                        return await this.executeDirectoryAnalysis(session, progress);
                    } else if (session.analysisMode === 'VisualizeDOM' && session.targetType === 'file') {
                        console.log(`EXECUTE_PYTHON: 🌐 HTML DOM analysis requested`);
                        return await this.executeHTMLDOMAnalysis(session, progress);
                    } else if (session.analysisMode === 'XR') {
                        console.log(`EXECUTE_PYTHON: 🥽 XR analysis requested`);
                        return await this.executeXRAnalysis(session, progress);
                    } else {
                        throw new Error(`Unknown analysis combination: ${session.analysisMode} + ${session.targetType}`);
                    }

                } catch (error) {
                    console.error(`EXECUTE_PYTHON: ❌ Error during Python analysis:`, error);
                    progress.report({ message: "Analysis failed" });
                    throw error;
                }
            }
        );
    }

    /**
     * Ejecuta análisis de archivo
     */
    private async executeFileAnalysis(session: UnifiedAnalysisSession, progress?: vscode.Progress<{message?: string; increment?: number}>): Promise<any> {
        console.log(`EXECUTE_PYTHON: 📄 Executing file analysis for: ${session.targetPath}`);
        
        try {
            // Preparar argumentos para análisis de archivo
            const args = [
                '--mode', 'livePanel',
                '--type', 'file',
                '--target', session.targetPath
            ];
            
            console.log(`EXECUTE_PYTHON: Executing file analysis with args: ${args.join(' ')}`);
            
            // Ejecutar el script Python
            const result = await this.executePythonScript('main.py', args, progress);
            
            // Para análisis de archivos, el resultado viene directamente sin wrapper
            if (result && (result.success !== false)) {
                console.log(`EXECUTE_PYTHON: ✅ File analysis completed successfully`);
                progress?.report({ message: "File analysis completed!" });
                return result;
            } else {
                console.error(`EXECUTE_PYTHON: ❌ File analysis failed:`, result);
                throw new Error(`File analysis failed: ${result?.error || 'Unknown error'}`);
            }
            
        } catch (error) {
            console.error(`EXECUTE_PYTHON: ❌ Error during file analysis:`, error);
            throw error;
        }
    }

    /**
     * Ejecuta análisis de directorio usando script Python unificado
     */
    private async executeDirectoryAnalysis(session: UnifiedAnalysisSession, progress?: vscode.Progress<{message?: string; increment?: number}>): Promise<any> {
        console.log(`EXECUTE_PYTHON: 📁 Executing directory analysis...`);
        console.log(`EXECUTE_PYTHON: Will analyze directory: ${session.targetPath}`);
        console.log(`EXECUTE_PYTHON: Analysis mode: ${session.analysisMode}`);
        
        try {
            // Determinar si es análisis profundo basado en modo
            const isDeepAnalysis = session.analysisMode.includes('Deep');
            
            // Preparar argumentos para el script Python
            let args = [
                '--mode', 'livePanel',
                '--type', 'directory'
            ];
            
            // Usar archivos específicos si están disponibles
            if (session.filesToHash && session.filesToHash.length > 0) {
                console.log(`EXECUTE_PYTHON: Using specific file list (${session.filesToHash.length} files)`);
                progress?.report({ message: `Preparing to analyze ${session.filesToHash.length} files...` });
                args.push('--target', session.targetPath);
                // Extraer las rutas de archivo de los FileHash
                const filePaths = session.filesToHash.map(fh => fh.filePath);
                args.push('--files', ...filePaths);
            } else {
                console.log(`EXECUTE_PYTHON: Using directory scanning mode`);
                progress?.report({ message: `Scanning directory for files...` });
                args.push('--target', session.targetPath);
            }
            
            // Agregar flag de análisis profundo si es necesario
            if (isDeepAnalysis) {
                console.log(`EXECUTE_PYTHON: Deep analysis requested`);
                args.push('--deep');
            }
            
            console.log(`EXECUTE_PYTHON: Executing with args: ${args.join(' ')}`);
            
            // Ejecutar el script Python
            const result = await this.executePythonScript('main.py', args, progress);
            
            // Para análisis de directorios, el resultado también viene directamente sin wrapper
            if (result && (result.success !== false)) {
                console.log(`EXECUTE_PYTHON: ✅ Directory analysis completed successfully`);
                progress?.report({ message: "Directory analysis completed!" });
                return result;
            } else {
                console.error(`EXECUTE_PYTHON: ❌ Directory analysis failed:`, result);
                throw new Error(`Directory analysis failed: ${result?.error || 'Unknown error'}`);
            }
            
        } catch (error) {
            console.error(`EXECUTE_PYTHON: ❌ Error during directory analysis:`, error);
            throw error;
        }
    }

    /**
     * Ejecuta análisis XR
     */
    private async executeXRAnalysis(session: UnifiedAnalysisSession, progress?: vscode.Progress<{message?: string; increment?: number}>): Promise<any> {
        console.log(`EXECUTE_PYTHON: 🥽 Executing XR analysis for: ${session.targetPath}`);
        console.log(`EXECUTE_PYTHON: Target type: ${session.targetType}`);
        
        try {
            // Preparar argumentos para el análisis XR usando main.py
            const args = [
                '--mode', 'xr',
                '--type', session.targetType,
                '--target', session.targetPath
            ];
            
            // Para análisis de directorio, usar archivos filtrados si están disponibles
            if (session.targetType === 'directory' && session.filesToHash && session.filesToHash.length > 0) {
                console.log(`EXECUTE_PYTHON: XR_ANALYSIS: Using filtered file list (${session.filesToHash.length} files)`);
                progress?.report({ message: `Preparing to analyze ${session.filesToHash.length} filtered files...` });
                
                // Extraer las rutas de archivo de los FileHash (archivos ya filtrados)
                const filePaths = session.filesToHash.map(fh => fh.filePath);
                args.push('--files', ...filePaths);
                
                console.log(`EXECUTE_PYTHON: XR_ANALYSIS: 🎯 Using ${filePaths.length} filtered files instead of scanning entire directory`);
                console.log(`EXECUTE_PYTHON: XR_ANALYSIS: 📁 Sample files:`, filePaths.slice(0, 3).map(fp => path.basename(fp)));
            } else if (session.targetType === 'directory') {
                console.log(`EXECUTE_PYTHON: XR_ANALYSIS: ⚠️ No filtered files available, will scan directory (less efficient)`);
                progress?.report({ message: `Scanning directory for files...` });
            }
            
            // Add --deep flag for deep directory analysis
            if (session.targetType === 'directory' && session.isDeep) {
                console.log(`EXECUTE_PYTHON: XR_ANALYSIS: Adding --deep flag for deep directory analysis`);
                args.push('--deep');
            }
            
            console.log(`EXECUTE_PYTHON: XR_ANALYSIS: 🚀 Starting XR analysis with main.py`);
            console.log(`EXECUTE_PYTHON: XR_ANALYSIS: Args: ${args.join(' ')}`);
            progress?.report({ message: "Starting XR analysis..." });
            
            // Ejecutar usando main.py (punto de entrada unificado)
            console.log(`EXECUTE_PYTHON: XR_ANALYSIS: 🐍 Executing main.py with XR parameters`);
            const result = await this.executePythonScript('main.py', args, progress);
            
            console.log(`EXECUTE_PYTHON: XR_ANALYSIS: 📦 Raw Python result received:`, {
                resultType: typeof result,
                isArray: Array.isArray(result),
                isObject: typeof result === 'object',
                hasSuccessProperty: result && typeof result === 'object' && 'success' in result,
                hasErrorProperty: result && typeof result === 'object' && 'error' in result,
                success: result?.success,
                error: result?.error,
                rawOutputLength: result?.rawOutput?.length || 0
            });
            
            // Verificar si es un error con rawOutput JSON válido (caso de marcadores faltantes)
            if (result?.success === false && result?.rawOutput && result?.error?.includes('JSON markers not found')) {
                console.log(`EXECUTE_PYTHON: XR_ANALYSIS: 🔄 JSON markers missing, attempting to parse rawOutput directly...`);
                console.log(`EXECUTE_PYTHON: XR_ANALYSIS: 📄 Raw output preview: ${result.rawOutput.substring(0, 200)}${result.rawOutput.length > 200 ? '...' : ''}`);
                
                try {
                    const parsedData = JSON.parse(result.rawOutput);
                    console.log(`EXECUTE_PYTHON: XR_ANALYSIS: ✅ Successfully parsed rawOutput as direct JSON!`);
                    console.log(`EXECUTE_PYTHON: XR_ANALYSIS: 📊 Parsed data type:`, typeof parsedData);
                    console.log(`EXECUTE_PYTHON: XR_ANALYSIS: 📊 Is array:`, Array.isArray(parsedData));
                    
                    if (Array.isArray(parsedData)) {
                        console.log(`EXECUTE_PYTHON: XR_ANALYSIS: 🎯 Generated ${parsedData.length} XR function records`);
                        if (parsedData.length > 0) {
                            console.log(`EXECUTE_PYTHON: XR_ANALYSIS: 📋 Sample function data:`, {
                                functionName: parsedData[0].functionName,
                                complexity: parsedData[0].complexity,
                                parameters: parsedData[0].parameters,
                                lineCount: parsedData[0].lineCount,
                                fileName: parsedData[0].fileName
                            });
                        }
                        console.log(`EXECUTE_PYTHON: XR_ANALYSIS: ✅ Successfully completed analysis for ${session.targetPath}`);
                    }
                    
                    progress?.report({ message: "XR analysis completed!" });
                    return parsedData;
                } catch (parseError) {
                    console.error(`EXECUTE_PYTHON: XR_ANALYSIS: ❌ Failed to parse rawOutput as JSON:`, parseError);
                    console.error(`EXECUTE_PYTHON: XR_ANALYSIS: 📄 Raw output content:`, result.rawOutput);
                    throw new Error(`XR analysis failed: Unable to parse result - ${result.error}`);
                }
            }
            
            // Verificar el resultado directo (sin error wrapper)
            if (result && result?.success !== false) {
                console.log(`EXECUTE_PYTHON: XR_ANALYSIS: ✅ Direct result received (no error wrapper)`);
                console.log(`EXECUTE_PYTHON: XR_ANALYSIS: 📊 Analysis result details:`, {
                    functionsCount: Array.isArray(result) ? result.length : 0,
                    isArray: Array.isArray(result),
                    resultType: typeof result
                });
                
                // Para XR file analysis, el resultado debería ser un array de funciones
                if (Array.isArray(result)) {
                    console.log(`EXECUTE_PYTHON: XR_ANALYSIS: 🎯 Generated ${result.length} XR function records`);
                    console.log(`EXECUTE_PYTHON: XR_ANALYSIS: ✅ Successfully completed analysis for ${session.targetPath}`);
                    
                    if (result.length > 0) {
                        console.log(`EXECUTE_PYTHON: XR_ANALYSIS: 📋 Sample function:`, {
                            functionName: result[0].functionName,
                            complexity: result[0].complexity,
                            parameters: result[0].parameters,
                            lineCount: result[0].lineCount,
                            fileName: result[0].fileName
                        });
                    }
                } else {
                    console.log(`EXECUTE_PYTHON: XR_ANALYSIS: ⚠️ Result is not an array, type: ${typeof result}`);
                }
                
                progress?.report({ message: "XR analysis completed!" });
                return result;
            } else {
                console.error(`EXECUTE_PYTHON: XR_ANALYSIS: ❌ XR analysis failed with error:`, result);
                throw new Error(`XR analysis failed: ${result?.error || 'Unknown error'}`);
            }
            
        } catch (error) {
            console.error(`EXECUTE_PYTHON: XR_ANALYSIS: ❌ Error during XR analysis:`, error);
            throw error;
        }
    }

    /**
     * Ejecuta análisis HTML DOM usando html_dom_parser.py
     */
    private async executeHTMLDOMAnalysis(session: UnifiedAnalysisSession, progress?: vscode.Progress<{message?: string; increment?: number}>): Promise<any> {
        console.log(`EXECUTE_PYTHON: 🌐 Executing HTML DOM analysis for: ${session.targetPath}`);
        
        try {
            // Preparar argumentos para el análisis HTML DOM
            const args = [session.targetPath];
            
            console.log(`EXECUTE_PYTHON: Executing HTML DOM analysis with args: ${args.join(' ')}`);
            progress?.report({ message: "Parsing HTML DOM..." });
            
            // Ejecutar el script Python específico para HTML DOM
            const result = await this.executePythonScript('html/html_dom_parser.py', args, progress);
            
            // Verificar el resultado
            if (result && !result.error) {
                console.log(`EXECUTE_PYTHON: ✅ HTML DOM analysis completed successfully`);
                console.log(`EXECUTE_PYTHON: 📄 Processed HTML content length: ${result.htmlContent?.length || 0} chars`);
                console.log(`EXECUTE_PYTHON: 📋 Analysis result:`, {
                    originalFile: result.originalFile,
                    preparedForVisualization: result.preparedForVisualization,
                    htmlContentLength: result.htmlContent?.length || 0
                });
                progress?.report({ message: "HTML DOM analysis completed!" });
                return result;
            } else {
                console.error(`EXECUTE_PYTHON: ❌ HTML DOM analysis failed:`, result);
                throw new Error(`HTML DOM analysis failed: ${result?.error || 'Unknown error'}`);
            }
            
        } catch (error) {
            console.error(`EXECUTE_PYTHON: ❌ Error during HTML DOM analysis:`, error);
            throw error;
        }
    }

    /**
     * Ejecuta re-análisis de archivos específicos usando file_reanalysis_coordinator.py
     */
    public async executeFileReanalysis(filePaths: string[]): Promise<any> {
        console.log(`EXECUTE_PYTHON: 🔄 Starting file re-analysis for ${filePaths.length} files`);
        
        try {
            // Preparar argumentos para el script de re-análisis
            const args = [
                ...filePaths // Pasar directamente las rutas de archivos
            ];
            
            console.log(`EXECUTE_PYTHON: Executing file re-analysis with args: ${args.join(' ')}`);
            
            // Ejecutar el script Python
            const result = await this.executePythonScript('sumaryFiles/file_reanalysis_coordinator.py', args);
            
            // Para re-análisis, el resultado viene directamente como array
            if (result && Array.isArray(result)) {
                console.log(`EXECUTE_PYTHON: ✅ File re-analysis completed successfully for ${result.length} files`);
                return result;
            } else if (result && (result.success !== false)) {
                // Si viene un solo archivo, convertir a array
                console.log(`EXECUTE_PYTHON: ✅ File re-analysis completed successfully for single file`);
                return [result];
            } else {
                console.error(`EXECUTE_PYTHON: ❌ File re-analysis failed:`, result);
                throw new Error(`File re-analysis failed: ${result?.error || 'Unknown error'}`);
            }
            
        } catch (error) {
            console.error(`EXECUTE_PYTHON: ❌ Error during file re-analysis:`, error);
            throw error;
        }
    }

    /**
     * Ejecuta un script Python específico con argumentos y reporte de progreso
     */
    private async executePythonScript(
        scriptName: string, 
        args: string[], 
        progress?: vscode.Progress<{message?: string; increment?: number}>
    ): Promise<any> {
        console.log(`EXECUTE_PYTHON: 🐍 Executing Python script: ${scriptName}`);
        console.log(`EXECUTE_PYTHON: Script arguments: ${args.join(' ')}`);
        
        // 📊 ENHANCED ANALYSIS START LOGGING
        console.log(`EXECUTE_PYTHON: ═══════════════════════════════════════════════════════════`);
        console.log(`EXECUTE_PYTHON: 🚀 STARTING ANALYSIS`);
        console.log(`EXECUTE_PYTHON: 📄 Script: ${scriptName}`);
        console.log(`EXECUTE_PYTHON: 🎯 Target: ${args.includes('--target') ? args[args.indexOf('--target') + 1] : 'Multiple targets'}`);
        console.log(`EXECUTE_PYTHON: 🔧 Mode: ${args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'Unknown'}`);
        console.log(`EXECUTE_PYTHON: 📂 Type: ${args.includes('--type') ? args[args.indexOf('--type') + 1] : 'Unknown'}`);
        console.log(`EXECUTE_PYTHON: ═══════════════════════════════════════════════════════════`);

        try {
            // Get Python executable path from virtual environment
            const pythonExecutable = this.venvManager.getPythonExecutablePath();
            if (!pythonExecutable) {
                throw new Error('Python executable not found in virtual environment');
            }
            console.log(`EXECUTE_PYTHON: Using Python executable: ${pythonExecutable}`);
            
            // Verify the Python executable exists and is accessible
            if (!require('fs').existsSync(pythonExecutable)) {
                throw new Error(`Python executable does not exist: ${pythonExecutable}`);
            }
            
            console.log(`EXECUTE_PYTHON: ✅ Python executable verified to exist`);

            // Get script path
            const extensionPath = this.context.extensionPath;
            const scriptPath = path.join(extensionPath, 'src', 'new_code_analysis', 'new_python', scriptName);
            console.log(`EXECUTE_PYTHON: Script path: ${scriptPath}`);
            
            // Verify the script exists
            if (!require('fs').existsSync(scriptPath)) {
                throw new Error(`Python script does not exist: ${scriptPath}`);
            }
            
            console.log(`EXECUTE_PYTHON: ✅ Python script verified to exist`);

            // Build full command
            const fullArgs = [scriptPath, ...args];
            console.log(`EXECUTE_PYTHON: Full command: ${pythonExecutable} ${fullArgs.join(' ')}`);
            console.log(`EXECUTE_PYTHON: 🚀 About to spawn Python process...`);

            return new Promise((resolve, reject) => {
                console.log(`EXECUTE_PYTHON: Creating child process with spawn...`);
                console.log(`EXECUTE_PYTHON: Executable: "${pythonExecutable}"`);
                console.log(`EXECUTE_PYTHON: Arguments: [${fullArgs.map(arg => `"${arg}"`).join(', ')}]`);
                console.log(`EXECUTE_PYTHON: Working directory: ${path.dirname(scriptPath)}`);
                
                const process = cp.spawn(pythonExecutable, fullArgs, {
                    cwd: path.dirname(scriptPath),
                    stdio: ['pipe', 'pipe', 'pipe']
                });

                console.log(`EXECUTE_PYTHON: ✅ Process spawned with PID: ${process.pid}`);

                // Handle process creation errors
                process.on('error', (error) => {
                    console.error(`EXECUTE_PYTHON: ❌ Failed to start Python process:`, error);
                    console.error(`EXECUTE_PYTHON: Error details:`, {
                        code: (error as any).code,
                        errno: (error as any).errno,
                        syscall: (error as any).syscall,
                        path: (error as any).path
                    });
                    resolve({
                        success: false,
                        error: `Failed to start Python process: ${error}`,
                        rawOutput: ''
                    });
                });

                let stdoutData = '';
                let stderrData = '';

                process.stdout.on('data', (data) => {
                    stdoutData += data.toString();
                    console.log(`EXECUTE_PYTHON: 📤 stdout chunk received (${data.toString().length} chars)`);
                });

                process.stderr.on('data', (data) => {
                    const stderrLine = data.toString();
                    stderrData += stderrLine;
                    
                    // Log Python progress and debug messages
                    const lines = stderrLine.split('\n');
                    for (const line of lines) {
                        if (line.trim()) {
                            try {
                                const parsed = JSON.parse(line.trim());
                                if (parsed.progress) {
                                    // 📊 ENHANCED PROGRESS DISPLAY
                                    const current = parsed.progress.current || 0;
                                    const total = parsed.progress.total || 0;
                                    const percentage = parsed.progress.percentage || 0;
                                    const fileName = parsed.progress.fileName || parsed.progress.file || parsed.progress.current_file || 'Processing file...';
                                    const message = parsed.progress.message || 'Processing';
                                    
                                    console.log(`EXECUTE_PYTHON: 🔄 PROGRESS [${current}/${total}] (${percentage}%) - ${message}`);
                                    console.log(`EXECUTE_PYTHON: 📄 Current file: ${fileName}`);
                                    
                                    // 🎯 UPDATE VS CODE UI PROGRESS
                                    if (progress && total > 0) {
                                        const increment = percentage > 0 ? 100 / total : 0;
                                        // Mostrar solo el nombre del archivo sin la ruta completa para mejor UX
                                        const displayFileName = fileName.includes('/') ? fileName.split('/').pop() : fileName;
                                        progress.report({ 
                                            message: `${current}/${total} (${percentage}%) - ${displayFileName}`,
                                            increment: increment
                                        });
                                    }
                                    
                                    // Additional context if available
                                    if (parsed.progress.operation) {
                                        console.log(`EXECUTE_PYTHON: ⚙️  Operation: ${parsed.progress.operation}`);
                                    }
                                    if (parsed.progress.estimatedTime) {
                                        console.log(`EXECUTE_PYTHON: ⏱️  Estimated time remaining: ${parsed.progress.estimatedTime}`);
                                    }
                                } else if (parsed.debug) {
                                    console.log(`EXECUTE_PYTHON: 🐛 DEBUG: ${parsed.debug}`);
                                } else if (parsed.info) {
                                    console.log(`EXECUTE_PYTHON: ℹ️  INFO: ${parsed.info}`);
                                    // Update UI with info messages
                                    if (progress) {
                                        progress.report({ message: parsed.info });
                                    }
                                } else if (parsed.warning) {
                                    console.log(`EXECUTE_PYTHON: ⚠️  WARNING: ${parsed.warning}`);
                                } else if (parsed.error) {
                                    console.log(`EXECUTE_PYTHON: ❌ ERROR: ${parsed.error}`);
                                }
                            } catch {
                                // Not JSON, check for common progress patterns
                                const cleanLine = line.trim();
                                if (cleanLine) {
                                    // Look for common progress patterns
                                    if (cleanLine.includes('Analyzing') || cleanLine.includes('Processing')) {
                                        console.log(`EXECUTE_PYTHON: 🔍 ${cleanLine}`);
                                        if (progress) {
                                            progress.report({ message: cleanLine });
                                        }
                                    } else if (cleanLine.includes('Progress:') || cleanLine.includes('%')) {
                                        console.log(`EXECUTE_PYTHON: 📊 ${cleanLine}`);
                                        if (progress) {
                                            progress.report({ message: cleanLine });
                                        }
                                    } else if (cleanLine.includes('ERROR') || cleanLine.includes('Error')) {
                                        console.log(`EXECUTE_PYTHON: ❌ ${cleanLine}`);
                                    } else if (cleanLine.includes('WARNING') || cleanLine.includes('Warning')) {
                                        console.log(`EXECUTE_PYTHON: ⚠️  ${cleanLine}`);
                                    } else {
                                        console.log(`EXECUTE_PYTHON: 📝 ${cleanLine}`);
                                    }
                                }
                            }
                        }
                    }
                });

                process.on('close', (code) => {
                    // 📊 ENHANCED ANALYSIS COMPLETION LOGGING
                    console.log(`EXECUTE_PYTHON: ═══════════════════════════════════════════════════════════`);
                    console.log(`EXECUTE_PYTHON: 🏁 ANALYSIS COMPLETED`);
                    console.log(`EXECUTE_PYTHON: 📄 Script: ${scriptName}`);
                    console.log(`EXECUTE_PYTHON: 🔢 Exit code: ${code}`);
                    console.log(`EXECUTE_PYTHON: 📤 Output size: ${stdoutData.length} chars`);
                    console.log(`EXECUTE_PYTHON: 📥 Error output size: ${stderrData.length} chars`);
                    
                    if (code === 0) {
                        console.log(`EXECUTE_PYTHON: ✅ SUCCESS - Processing results...`);
                        
                        try {
                            // Parse JSON between markers
                            const jsonStartMarker = '=== JSON_START ===';
                            const jsonEndMarker = '=== JSON_END ===';
                            
                            const startIndex = stdoutData.indexOf(jsonStartMarker);
                            const endIndex = stdoutData.indexOf(jsonEndMarker);
                            
                            if (startIndex >= 0 && endIndex >= 0) {
                                const jsonContent = stdoutData.substring(startIndex + jsonStartMarker.length, endIndex).trim();
                                const result = JSON.parse(jsonContent);
                                
                                // 📊 ENHANCED SUCCESS LOGGING
                                console.log(`EXECUTE_PYTHON: ✅ Successfully parsed Python result`);
                                if (Array.isArray(result)) {
                                    console.log(`EXECUTE_PYTHON: 📊 Result type: Array with ${result.length} items`);
                                } else if (typeof result === 'object' && result !== null) {
                                    console.log(`EXECUTE_PYTHON: 📊 Result type: Object`);
                                    if (result.files && Array.isArray(result.files)) {
                                        console.log(`EXECUTE_PYTHON: 📁 Files analyzed: ${result.files.length}`);
                                    }
                                    if (result.summary) {
                                        console.log(`EXECUTE_PYTHON: 📈 Summary available: Yes`);
                                    }
                                }
                                console.log(`EXECUTE_PYTHON: ═══════════════════════════════════════════════════════════`);
                                
                                resolve(result);
                            } else {
                                console.warn(`EXECUTE_PYTHON: ⚠️ JSON markers not found in output`);
                                console.log(`EXECUTE_PYTHON: ═══════════════════════════════════════════════════════════`);
                                resolve({
                                    success: false,
                                    error: 'JSON markers not found in Python output',
                                    rawOutput: stdoutData
                                });
                            }
                        } catch (parseError) {
                            console.error(`EXECUTE_PYTHON: ❌ Failed to parse Python JSON output:`, parseError);
                            console.log(`EXECUTE_PYTHON: ═══════════════════════════════════════════════════════════`);
                            resolve({
                                success: false,
                                error: `Failed to parse Python output: ${parseError}`,
                                rawOutput: stdoutData
                            });
                        }
                    } else {
                        console.error(`EXECUTE_PYTHON: ❌ FAILED - Python script failed with exit code ${code}`);
                        if (stderrData.trim()) {
                            console.error(`EXECUTE_PYTHON: 📥 Error output preview: ${stderrData.substring(0, 200)}${stderrData.length > 200 ? '...' : ''}`);
                        }
                        console.log(`EXECUTE_PYTHON: ═══════════════════════════════════════════════════════════`);
                        resolve({
                            success: false,
                            error: `Python script failed with exit code ${code}`,
                            stderr: stderrData,
                            stdout: stdoutData
                        });
                    }
                });

                process.on('error', (error) => {
                    console.error(`EXECUTE_PYTHON: ❌ Failed to start Python process:`, error);
                    reject(new Error(`Failed to start Python process: ${error.message}`));
                });
            });

        } catch (error) {
            console.error(`EXECUTE_PYTHON: ❌ Error executing Python script:`, error);
            throw error;
        }
    }
}
