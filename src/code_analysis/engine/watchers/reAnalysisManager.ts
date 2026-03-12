/**
 * Re-Analysis Manager
 * Maneja la regeneración SOLO del data.json cuando un archivo cambia
 * Reutiliza el pipeline existente pero solo actualiza el data.json
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { ExecutePython } from '../utils/executePython';
import { SSEManager } from '../../../servers/runtime/sse/SSEManager';

export class ReAnalysisManager {
    private executePython: ExecutePython;
    private sseManager: SSEManager;

    constructor(private context: vscode.ExtensionContext) {
        console.log('RE_ANALYSIS_MANAGER: Initializing Re-Analysis Manager');
        this.executePython = new ExecutePython(context);
        this.sseManager = SSEManager.getInstance();
    }

    /**
     * Ejecuta regeneración SOLO del data.json para una sesión
     * NO regenera archivos .html, .js, .css - solo data.json
     */
    async executeDataJsonRegeneration(session: UnifiedAnalysisSession): Promise<boolean> {
        try {
            console.log(`RE_ANALYSIS_MANAGER:  Starting data.json regeneration for session ${session.id}`);
            console.log(`RE_ANALYSIS_MANAGER: Target: ${session.targetPath}`);
            console.log(`RE_ANALYSIS_MANAGER: Saved files path: ${session.savedFilesPath}`);

            // Verificar que la sesión tenga path de archivos guardados
            if (!session.savedFilesPath) {
                throw new Error(`Session ${session.id} does not have saved files path`);
            }

            // Verificar que el archivo objetivo existe
            if (!(await this.fileExists(session.targetPath))) {
                throw new Error(`Target file does not exist: ${session.targetPath}`);
            }

            // PASO 1: Ejecutar análisis Python para obtener nuevos datos
            console.log(`RE_ANALYSIS_MANAGER:  Step 1 - Executing Python analysis...`);
            const analysisData = await this.executePython.executeAnalysis(session);
            
            console.log(`RE_ANALYSIS_MANAGER:  Python analysis completed successfully`);
            console.log(`RE_ANALYSIS_MANAGER:  Analysis type: ${session.analysisMode}`);
            console.log(`RE_ANALYSIS_MANAGER:  New analysis data received:`, {
                dataType: typeof analysisData,
                isArray: Array.isArray(analysisData),
                length: Array.isArray(analysisData) ? analysisData.length : 'N/A',
                hasSuccessProperty: analysisData && typeof analysisData === 'object' && 'success' in analysisData,
                success: analysisData?.success,
                target: analysisData?.target
            });

            // PASO 2: Determinar qué datos guardar según el tipo de análisis
            let dataToSave;
            if (session.analysisMode === 'XR') {
                // Para XR: Los datos del análisis SON directamente el array de funciones
                console.log(`RE_ANALYSIS_MANAGER:  XR Analysis - Using analysis data directly as function array`);
                dataToSave = analysisData;
                
                if (Array.isArray(analysisData)) {
                    console.log(`RE_ANALYSIS_MANAGER:  XR Data validation: Array with ${analysisData.length} functions`);
                    if (analysisData.length > 0) {
                        console.log(`RE_ANALYSIS_MANAGER:  Sample function:`, {
                            functionName: analysisData[0].functionName,
                            complexity: analysisData[0].complexity,
                            fileName: analysisData[0].fileName
                        });
                    }
                } else {
                    console.warn(`RE_ANALYSIS_MANAGER:  XR Analysis did not return array. Type: ${typeof analysisData}`);
                }
            } else {
                // Para LivePanel: Los datos del análisis son el objeto completo para data.json
                console.log(`RE_ANALYSIS_MANAGER:  LivePanel Analysis - Using complete analysis object`);
                dataToSave = analysisData;
                
                if (analysisData && typeof analysisData === 'object') {
                    console.log(`RE_ANALYSIS_MANAGER:  LivePanel Data keys:`, Object.keys(analysisData));
                }
            }

            // PASO 3: Convertir a JSON string
            const newDataJsonContent = JSON.stringify(dataToSave, null, 2);
            console.log(`RE_ANALYSIS_MANAGER:  Generated new data.json content (${newDataJsonContent.length} characters)`);
            console.log(`RE_ANALYSIS_MANAGER:  Content preview: ${newDataJsonContent.substring(0, 200)}${newDataJsonContent.length > 200 ? '...' : ''}`);

            // PASO 4: Guardar SOLO el data.json actualizado
            const dataJsonPath = path.join(session.savedFilesPath, 'data.json');
            console.log(`RE_ANALYSIS_MANAGER:  Step 4 - Updating data.json file: ${dataJsonPath}`);
            
            await fs.writeFile(dataJsonPath, newDataJsonContent, 'utf-8');
            
            console.log(`RE_ANALYSIS_MANAGER:  data.json updated successfully`);

            // PASO 5: Actualizar en memoria de la sesión (para compatibilidad)
            session.requiredFiles.set('data.json', newDataJsonContent);
            console.log(`RE_ANALYSIS_MANAGER:  Updated data.json in session memory`);

            // PASO 6: Enviar notificación SSE para actualizar la vista
            console.log(`RE_ANALYSIS_MANAGER:  Step 6 - Sending SSE notification...`);
            
            // Enviar el evento SSE correcto según el tipo de análisis
            if (session.analysisMode === 'XR') {
                // Para análisis XR, enviamos el evento dataRefresh específico
                console.log(`RE_ANALYSIS_MANAGER:  Sending dataRefresh event for XR analysis`);
                this.sseManager.sendDataRefresh(session.targetPath);
                console.log(`RE_ANALYSIS_MANAGER:  dataRefresh event sent for XR analysis: ${session.targetPath}`);
            } else {
                // Para LivePanel u otros análisis, mantener el comportamiento anterior
                console.log(`RE_ANALYSIS_MANAGER:  Sending standard update for LivePanel analysis`);
                this.sseManager.sendUpdate(session.targetPath);
                console.log(`RE_ANALYSIS_MANAGER:  Standard SSE notification sent for LivePanel: ${session.targetPath}`);
            }

            // PASO 7: Log de resumen
            console.log(`RE_ANALYSIS_MANAGER:  Data.json regeneration completed successfully`);
            console.log(`RE_ANALYSIS_MANAGER:  Summary:`);
            console.log(`RE_ANALYSIS_MANAGER:   - Session: ${session.id}`);
            console.log(`RE_ANALYSIS_MANAGER:   - Analysis Mode: ${session.analysisMode}`);
            console.log(`RE_ANALYSIS_MANAGER:   - Target: ${path.basename(session.targetPath)}`);
            console.log(`RE_ANALYSIS_MANAGER:   - Data size: ${newDataJsonContent.length} chars`);
            console.log(`RE_ANALYSIS_MANAGER:   - Updated file: ${dataJsonPath}`);
            console.log(`RE_ANALYSIS_MANAGER:   - Data type: ${session.analysisMode === 'XR' ? 'Function array' : 'Complete object'}`);
            console.log(`RE_ANALYSIS_MANAGER:   - SSE notification sent: `);

            return true;

        } catch (error) {
            console.error(`RE_ANALYSIS_MANAGER:  Error in data.json regeneration:`, error);
            console.error(`RE_ANALYSIS_MANAGER: Session: ${session.id}, Target: ${session.targetPath}`);
            return false;
        }
    }

    /**
     * Verifica si un archivo existe de forma asíncrona
     */
    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Verifica si un directorio existe de forma asíncrona
     */
    private async directoryExists(dirPath: string): Promise<boolean> {
        try {
            const stat = await fs.stat(dirPath);
            return stat.isDirectory();
        } catch {
            return false;
        }
    }

    /**
     * Obtiene información de la sesión para logging
     */
    private getSessionInfo(session: UnifiedAnalysisSession): string {
        return `${session.analysisMode}/${session.targetType} - ${path.basename(session.targetPath)}`;
    }
}
