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
            console.log(`RE_ANALYSIS_MANAGER: 🔬 Starting data.json regeneration for session ${session.id}`);
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
            console.log(`RE_ANALYSIS_MANAGER: 🐍 Step 1 - Executing Python analysis...`);
            const analysisData = await this.executePython.executeAnalysis(session);
            
            console.log(`RE_ANALYSIS_MANAGER: ✅ Python analysis completed successfully`);
            console.log(`RE_ANALYSIS_MANAGER: 📊 New analysis data received:`, {
                success: analysisData.success,
                target: analysisData.target,
                dataKeys: analysisData.data ? Object.keys(analysisData.data) : []
            });

            // PASO 2: Convertir a JSON string
            const newDataJsonContent = JSON.stringify(analysisData, null, 2);
            console.log(`RE_ANALYSIS_MANAGER: 📝 Generated new data.json content (${newDataJsonContent.length} characters)`);

            // PASO 3: Guardar SOLO el data.json actualizado
            const dataJsonPath = path.join(session.savedFilesPath, 'data.json');
            console.log(`RE_ANALYSIS_MANAGER: 💾 Step 3 - Updating data.json file: ${dataJsonPath}`);
            
            await fs.writeFile(dataJsonPath, newDataJsonContent, 'utf-8');
            
            console.log(`RE_ANALYSIS_MANAGER: ✅ data.json updated successfully`);

            // PASO 4: Actualizar en memoria de la sesión (para compatibilidad)
            session.requiredFiles.set('data.json', newDataJsonContent);
            console.log(`RE_ANALYSIS_MANAGER: 📦 Updated data.json in session memory`);

            // PASO 5: Enviar notificación SSE para actualizar la vista
            console.log(`RE_ANALYSIS_MANAGER: 📡 Step 5 - Sending SSE notification...`);
            this.sseManager.sendUpdate(session.targetPath);
            console.log(`RE_ANALYSIS_MANAGER: ✅ SSE notification sent for file: ${session.targetPath}`);

            // PASO 6: Log de resumen
            console.log(`RE_ANALYSIS_MANAGER: 🎉 Data.json regeneration completed successfully`);
            console.log(`RE_ANALYSIS_MANAGER: 📊 Summary:`);
            console.log(`RE_ANALYSIS_MANAGER:   - Session: ${session.id}`);
            console.log(`RE_ANALYSIS_MANAGER:   - Target: ${path.basename(session.targetPath)}`);
            console.log(`RE_ANALYSIS_MANAGER:   - Data size: ${newDataJsonContent.length} chars`);
            console.log(`RE_ANALYSIS_MANAGER:   - Updated file: ${dataJsonPath}`);
            console.log(`RE_ANALYSIS_MANAGER:   - SSE notification sent: ✅`);

            return true;

        } catch (error) {
            console.error(`RE_ANALYSIS_MANAGER: ❌ Error in data.json regeneration:`, error);
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
