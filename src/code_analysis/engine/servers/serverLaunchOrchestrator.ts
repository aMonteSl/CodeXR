/**
 * Server Launch Orchestrator
 * Coordina el lanzamiento de servidores usando el sistema existente de MultiServerLauncher
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { MultiServerLauncher } from '../../../servers/runtime/multiServerLauncher';
import { ServerSettingsManager } from '../../../servers/storage/serverSettingsManager';
import { fileToServerMap } from '../../../utils/fileToServerMap';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { 
    ServerLaunchRequest, 
    ServerLaunchResult, 
    SessionServerInfo 
} from './models/sessionServerModels';

export class ServerLaunchOrchestrator {
    private multiServerLauncher: MultiServerLauncher | null = null;
    private serverSettingsManager: ServerSettingsManager;

    constructor(private context: vscode.ExtensionContext) {
        console.log('SERVER_LAUNCH_ORCHESTRATOR: Initializing orchestrator');
        this.serverSettingsManager = ServerSettingsManager.getInstance(context);
    }

    /**
     * Inicializa el MultiServerLauncher si no está creado
     */
    private async ensureMultiServerLauncher(): Promise<void> {
        if (!this.multiServerLauncher) {
            console.log('SERVER_LAUNCH_ORCHESTRATOR: Creating MultiServerLauncher instance');
            this.multiServerLauncher = new MultiServerLauncher(this.context);
        }
    }

    /**
     * Lanza un servidor para una sesión específica
     */
    async launchServerForSession(request: ServerLaunchRequest, session?: UnifiedAnalysisSession): Promise<ServerLaunchResult> {
        try {
            console.log(`SERVER_LAUNCH_ORCHESTRATOR: Launching server for session ${request.sessionId}`);
            console.log(`SERVER_LAUNCH_ORCHESTRATOR: Target file: ${request.targetPath}`);

            await this.ensureMultiServerLauncher();

            // Obtener configuración del servidor
            const serverSettings = this.serverSettingsManager.getServerSettings();
            const serverType = this.getDefaultServerType(serverSettings);

            console.log(`SERVER_LAUNCH_ORCHESTRATOR: Using server type: ${serverType}`);

            // Obtener el directorio donde están guardados los archivos
            const tempDir = session?.savedFilesPath || this.getTempDirForSession(request.sessionId, request.targetPath);
            console.log(`SERVER_LAUNCH_ORCHESTRATOR: Using saved files directory: ${tempDir}`);
            
            // Buscar el archivo HTML principal en el directorio guardado
            const htmlFilePath = this.findMainHtmlFile(tempDir);
            console.log(`SERVER_LAUNCH_ORCHESTRATOR: HTML file path: ${htmlFilePath}`);

            // Generate descriptive custom name for the server based on analysis type and target
            const customName = this.generateDescriptiveServerName(request, session);
            console.log(`SERVER_LAUNCH_ORCHESTRATOR: Generated descriptive name: "${customName}"`);

            // Lanzar servidor usando MultiServerLauncher
            const launchResult = await this.multiServerLauncher!.launchServer(
                htmlFilePath, // Pasar la ruta completa del HTML
                customName, // Use descriptive name instead of generic Analysis_{sessionId}
                { sessionId: request.sessionId } // Pass sessionId in metadata for server-session linking
            );
            
            console.log(`SERVER_LAUNCH_ORCHESTRATOR: Launch result:`, {
                success: launchResult.success,
                port: launchResult.port,
                serverUrl: launchResult.serverUrl,
                serverId: launchResult.serverId,
                error: launchResult.error
            });

            if (launchResult.success && launchResult.port && launchResult.serverUrl && launchResult.serverId) {
                // Crear información de la sesión del servidor
                const sessionServerInfo: SessionServerInfo = {
                    sessionId: request.sessionId,
                    targetPath: request.targetPath,
                    port: launchResult.port,
                    serverUrl: launchResult.serverUrl,
                    serverType: launchResult.serverType || serverType,
                    serverId: launchResult.serverId,
                    tempDir,
                    isActive: true,
                    startedAt: new Date()
                };

                // Registrar en el fileToServerMap para SSE
                fileToServerMap.registerMapping(request.targetPath, {
                    port: launchResult.port,
                    tempDir,
                    fileUri: request.targetPath,
                    serverRef: this.getServerRefById(launchResult.serverId) // TODO: implementar
                });

                console.log(`SERVER_LAUNCH_ORCHESTRATOR:  Server launched successfully on port ${launchResult.port}`);

                return {
                    success: true,
                    sessionServerInfo,
                    portChanged: launchResult.portChanged,
                    originalPort: launchResult.originalPort
                };
            } else {
                console.error(`SERVER_LAUNCH_ORCHESTRATOR:  Server launch failed:`, launchResult.error);
                return {
                    success: false,
                    error: launchResult.error || 'Unknown server launch error'
                };
            }

        } catch (error) {
            console.error(`SERVER_LAUNCH_ORCHESTRATOR:  Error launching server:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Detiene un servidor para una sesión específica
     */
    async stopServerForSession(sessionId: string, targetPath: string): Promise<boolean> {
        try {
            console.log(`SERVER_LAUNCH_ORCHESTRATOR: Stopping server for session ${sessionId}`);

            // Desregistrar del fileToServerMap
            fileToServerMap.unregisterMapping(targetPath);

            // TODO: Usar MultiServerLauncher para detener el servidor específico
            // Esto depende de la implementación del MultiServerLauncher

            console.log(`SERVER_LAUNCH_ORCHESTRATOR:  Server stopped for session ${sessionId}`);
            return true;

        } catch (error) {
            console.error(`SERVER_LAUNCH_ORCHESTRATOR:  Error stopping server:`, error);
            return false;
        }
    }

    /**
     * Obtiene el tipo de servidor por defecto basado en la configuración
     */
    private getDefaultServerType(serverSettings: any): 'http' | 'https-default' | 'https-custom' {
        // TODO: Implementar lógica basada en serverSettings
        return 'http'; // Por defecto HTTP para simplicidad
    }

    /**
     * Obtiene el directorio temporal para una sesión
     */
    private getTempDirForSession(sessionId: string, targetPath: string): string {
        // El directorio se guarda en workspaceStorage/analysis/[outputDirectory]
        // Necesitamos obtener esto de la sesión o reconstruirlo
        const workspaceStorage = this.context.storageUri?.fsPath || '';
        
        // Buscar en el directorio de análisis por sessionId
        const analysisDir = `${workspaceStorage}/analysis`;
        console.log(`SERVER_LAUNCH_ORCHESTRATOR: Looking for session ${sessionId} in: ${analysisDir}`);
        
        // Por ahora, return a path pattern. TODO: mejorar para buscar el directorio real
        return analysisDir;
    }

    /**
     * Busca el archivo HTML principal en el directorio de la sesión
     */
    private findMainHtmlFile(baseDir: string): string | undefined {
        try {
            const fs = require('fs');
            const path = require('path');
            
            console.log(`SERVER_LAUNCH_ORCHESTRATOR: Searching for HTML files in: ${baseDir}`);
            
            // Buscar recursivamente por archivos HTML
            const findHtmlFiles = (dir: string): string[] => {
                const files: string[] = [];
                try {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry.name);
                        
                        if (entry.isDirectory()) {
                            files.push(...findHtmlFiles(fullPath));
                        } else if (entry.isFile() && entry.name.endsWith('.html')) {
                            files.push(fullPath);
                            console.log(`SERVER_LAUNCH_ORCHESTRATOR: Found HTML file: ${fullPath}`);
                        }
                    }
                } catch (error) {
                    console.error(`SERVER_LAUNCH_ORCHESTRATOR: Error reading directory ${dir}:`, error);
                }
                
                return files;
            };
            
            const htmlFiles = findHtmlFiles(baseDir);
            
            // Buscar archivos con nombres preferidos
            const preferredNames = ['fileAnalysis.html', 'directoryAnalysis.html', 'main.html', 'index.html'];
            
            for (const preferredName of preferredNames) {
                const found = htmlFiles.find(file => path.basename(file) === preferredName);
                if (found) {
                    console.log(`SERVER_LAUNCH_ORCHESTRATOR: Using preferred HTML file: ${found}`);
                    return found;
                }
            }
            
            // Si no encuentra uno preferido, usar el primero
            if (htmlFiles.length > 0) {
                console.log(`SERVER_LAUNCH_ORCHESTRATOR: Using first HTML file found: ${htmlFiles[0]}`);
                return htmlFiles[0];
            }
            
            console.log(`SERVER_LAUNCH_ORCHESTRATOR: No HTML files found in: ${baseDir}`);
            return undefined;
            
        } catch (error) {
            console.error(`SERVER_LAUNCH_ORCHESTRATOR: Error finding HTML file:`, error);
            return undefined;
        }
    }

    /**
     * Obtiene la referencia del servidor por ID
     */
    private getServerRefById(serverId: string): any {
        // TODO: Implementar cuando tengamos acceso a las referencias del servidor
        return null;
    }

    /**
     * Generate descriptive custom name for the server based on analysis type and target
     */
    private generateDescriptiveServerName(request: ServerLaunchRequest, session?: UnifiedAnalysisSession): string {
        const baseName = path.basename(request.targetPath);
        const analysisMode = session?.analysisMode || 'unknown';
        const targetType = session?.targetType || 'unknown';
        
        console.log(`SERVER_LAUNCH_ORCHESTRATOR:  DEBUG - Generating name for:`, {
            baseName,
            analysisMode,
            targetType,
            targetPath: request.targetPath
        });
        
        // Create descriptive names based on analysis mode and target type
        if (analysisMode.toLowerCase().includes('xr')) {
            if (targetType === 'directory') {
                const dirName = path.basename(path.dirname(request.targetPath));
                return `XR Directory: ${dirName}`;
            } else {
                return `XR File: ${baseName}`;
            }
        } else if (analysisMode.toLowerCase().includes('dom')) {
            return `DOM Visualization: ${baseName}`;
        } else if (targetType === 'directory') {
            const dirName = path.basename(path.dirname(request.targetPath));
            return `LivePanel Directory: ${dirName}`;
        } else {
            return `LivePanel File: ${baseName}`;
        }
    }
}

export default ServerLaunchOrchestrator;
