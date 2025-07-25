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

        try {
            // Determinar qué tipo de análisis ejecutar
            if (session.analysisMode === 'LivePanel' && session.targetType === 'file') {
                console.log(`EXECUTE_PYTHON: 📄 File LivePanel analysis requested`);
                return await this.executeFileAnalysis(session);
            } else if (session.analysisMode === 'LivePanel' && session.targetType === 'directory') {
                console.log(`EXECUTE_PYTHON: 📁 Directory LivePanel analysis requested`);
                return await this.executeDirectoryAnalysis(session);
            } else if (session.analysisMode === 'XR') {
                console.log(`EXECUTE_PYTHON: 🥽 XR analysis requested`);
                return await this.executeXRAnalysis(session);
            } else {
                throw new Error(`Unknown analysis combination: ${session.analysisMode} + ${session.targetType}`);
            }

        } catch (error) {
            console.error(`EXECUTE_PYTHON: ❌ Error during Python analysis:`, error);
            throw error;
        }
    }

    /**
     * Ejecuta análisis de archivo
     */
    private async executeFileAnalysis(session: UnifiedAnalysisSession): Promise<any> {
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
            const result = await this.executePythonScript('main.py', args);
            
            // Para análisis de archivos, el resultado viene directamente sin wrapper
            if (result && (result.success !== false)) {
                console.log(`EXECUTE_PYTHON: ✅ File analysis completed successfully`);
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
    private async executeDirectoryAnalysis(session: UnifiedAnalysisSession): Promise<any> {
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
                args.push('--target', session.targetPath);
                // Extraer las rutas de archivo de los FileHash
                const filePaths = session.filesToHash.map(fh => fh.filePath);
                args.push('--files', ...filePaths);
            } else {
                console.log(`EXECUTE_PYTHON: Using directory scanning mode`);
                args.push('--target', session.targetPath);
            }
            
            // Agregar flag de análisis profundo si es necesario
            if (isDeepAnalysis) {
                console.log(`EXECUTE_PYTHON: Deep analysis requested`);
                args.push('--deep');
            }
            
            console.log(`EXECUTE_PYTHON: Executing with args: ${args.join(' ')}`);
            
            // Ejecutar el script Python
            const result = await this.executePythonScript('main.py', args);
            
            // Para análisis de directorios, el resultado también viene directamente sin wrapper
            if (result && (result.success !== false)) {
                console.log(`EXECUTE_PYTHON: ✅ Directory analysis completed successfully`);
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
    private async executeXRAnalysis(session: UnifiedAnalysisSession): Promise<any> {
        console.log(`EXECUTE_PYTHON: 🥽 TODO - Implement XR analysis execution`);
        console.log(`EXECUTE_PYTHON: Will analyze for XR: ${session.targetPath}`);
        
        // TODO: Implementar análisis XR
        return {
            status: 'TODO',
            message: 'XR analysis execution not yet implemented',
            targetPath: session.targetPath,
            analysisType: 'xr'
        };
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
            const result = await this.executePythonScript('livePanels/file_reanalysis_coordinator.py', args);
            
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
     * Ejecuta un script Python específico con argumentos
     */
    private async executePythonScript(scriptName: string, args: string[]): Promise<any> {
        console.log(`EXECUTE_PYTHON: 🐍 Executing Python script: ${scriptName}`);
        console.log(`EXECUTE_PYTHON: Script arguments: ${args.join(' ')}`);

        try {
            // Get Python executable path from virtual environment
            const pythonExecutable = this.venvManager.getPythonExecutablePath();
            if (!pythonExecutable) {
                throw new Error('Python executable not found in virtual environment');
            }
            console.log(`EXECUTE_PYTHON: Using Python executable: ${pythonExecutable}`);

            // Get script path
            const extensionPath = this.context.extensionPath;
            const scriptPath = path.join(extensionPath, 'src', 'new_code_analysis', 'new_python', scriptName);
            console.log(`EXECUTE_PYTHON: Script path: ${scriptPath}`);

            // Build full command
            const fullArgs = [scriptPath, ...args];
            console.log(`EXECUTE_PYTHON: Full command: ${pythonExecutable} ${fullArgs.join(' ')}`);

            return new Promise((resolve, reject) => {
                const process = cp.spawn(pythonExecutable, fullArgs, {
                    cwd: path.dirname(scriptPath),
                    stdio: ['pipe', 'pipe', 'pipe']
                });

                let stdoutData = '';
                let stderrData = '';

                process.stdout.on('data', (data) => {
                    stdoutData += data.toString();
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
                                    console.log(`EXECUTE_PYTHON: Progress: ${parsed.progress.message} (${parsed.progress.percentage || 0}%)`);
                                } else if (parsed.debug) {
                                    console.log(`EXECUTE_PYTHON: ${parsed.debug}`);
                                }
                            } catch {
                                // Not JSON, just log as regular message
                                console.log(`EXECUTE_PYTHON: ${line.trim()}`);
                            }
                        }
                    }
                });

                process.on('close', (code) => {
                    console.log(`EXECUTE_PYTHON: Python process exited with code ${code}`);
                    
                    if (code === 0) {
                        try {
                            // Parse JSON between markers
                            const jsonStartMarker = '=== JSON_START ===';
                            const jsonEndMarker = '=== JSON_END ===';
                            
                            const startIndex = stdoutData.indexOf(jsonStartMarker);
                            const endIndex = stdoutData.indexOf(jsonEndMarker);
                            
                            if (startIndex >= 0 && endIndex >= 0) {
                                const jsonContent = stdoutData.substring(startIndex + jsonStartMarker.length, endIndex).trim();
                                const result = JSON.parse(jsonContent);
                                console.log(`EXECUTE_PYTHON: ✅ Successfully parsed Python result`);
                                resolve(result);
                            } else {
                                console.warn(`EXECUTE_PYTHON: ⚠️ JSON markers not found in output`);
                                resolve({
                                    success: false,
                                    error: 'JSON markers not found in Python output',
                                    rawOutput: stdoutData
                                });
                            }
                        } catch (parseError) {
                            console.error(`EXECUTE_PYTHON: ❌ Failed to parse Python JSON output:`, parseError);
                            resolve({
                                success: false,
                                error: `Failed to parse Python output: ${parseError}`,
                                rawOutput: stdoutData
                            });
                        }
                    } else {
                        console.error(`EXECUTE_PYTHON: ❌ Python script failed with exit code ${code}`);
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
