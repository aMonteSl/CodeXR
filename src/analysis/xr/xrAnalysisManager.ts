import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { FileAnalysisResult } from '../model';
import { transformAnalysisDataForXR } from './xrDataTransformer';
import { generateXRAnalysisHTML } from './xrTemplateUtils';
import { createServer, getActiveServers, stopServer, updateServerDisplayInfo } from '../../server/serverManager'; // ✅ AÑADIR updateServerDisplayInfo AL IMPORT ESTÁTICO
import { ServerInfo, ServerMode } from '../../server/models/serverModel';
import { formatXRDataForBabia } from './xrDataFormatter';
import { FileWatchManager } from '../fileWatchManager';
import { portManager } from '../../server/portManager';
import { defaultCertificatesExist } from '../../server/certificateManager';

// Track visualization paths by file
const visualizationFolders: Map<string, string> = new Map();

/**
 * Creates an XR visualization for a file analysis result
 * @param context Extension context for storage
 * @param analysisResult Result of file analysis
 * @returns Path to the created HTML visualization
 */
export async function createXRVisualization(
  context: vscode.ExtensionContext,
  analysisResult: FileAnalysisResult
): Promise<string | undefined> {
  try {
    const fileNameWithoutExt = path.basename(analysisResult.fileName, path.extname(analysisResult.fileName));
    
    // ✅ VERIFICAR SI YA HAY UNA VISUALIZACIÓN ACTIVA PARA ESTE ARCHIVO
    const existingFolder = visualizationFolders.get(fileNameWithoutExt);
    
    if (existingFolder) {
      console.log(`♻️ Found existing visualization folder for ${fileNameWithoutExt}: ${existingFolder}`);
      
      // ✅ VERIFICAR SI HAY UN SERVIDOR ACTIVO PARA ESTA CARPETA
      const activeServers = getActiveServers();
      const existingServer = activeServers.find(server => {
        const serverDir = path.dirname(server.filePath);
        return serverDir === existingFolder;
      });
      
      if (existingServer) {
        console.log(`🔄 Found existing server for ${fileNameWithoutExt}: ${existingServer.url}`);
        console.log(`🛑 Stopping existing server to launch new analysis...`);
        
        // ✅ CERRAR EL SERVIDOR EXISTENTE
        stopServer(existingServer.id);
        
        // ✅ MOSTRAR MENSAJE AL USUARIO
        vscode.window.showInformationMessage(
          `🔄 Relaunching analysis for ${analysisResult.fileName}...`,
          { modal: false }
        );
        
        // ✅ PEQUEÑA PAUSA PARA ASEGURAR QUE EL PUERTO SE LIBERE
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // ✅ CREAR NUEVA VISUALIZACIÓN (reutilizar carpeta si existe)
    const visualizationsDir = path.join(context.extensionPath, 'visualizations');
    
    try {
      await fs.mkdir(visualizationsDir, { recursive: true });
    } catch (e) {
      // Directory exists
    }
    
    let visualizationDir: string;
    
    if (existingFolder) {
      // ✅ REUTILIZAR CARPETA EXISTENTE
      visualizationDir = existingFolder;
      console.log(`♻️ Reusing existing visualization folder: ${visualizationDir}`);
    } else {
      // ✅ CREAR NUEVA CARPETA
      const folderName = `analysis_${fileNameWithoutExt}_${Date.now()}`;
      visualizationDir = path.join(visualizationsDir, folderName);
      
      try {
        await fs.mkdir(visualizationDir, { recursive: true });
      } catch (e) {
        // Directory exists
      }
      
      // Guardar para reutilización futura
      visualizationFolders.set(fileNameWithoutExt, visualizationDir);
      console.log(`📁 Created new visualization folder: ${visualizationDir}`);
    }
    
    // ✅ SIEMPRE REGENERAR DATOS Y HTML (para reflejar cambios en el código)
    console.log(`🔄 Regenerating analysis data for ${analysisResult.fileName}...`);
    
    // Transformar y guardar datos actualizados
    const transformedData = transformAnalysisDataForXR(analysisResult);
    const babiaCompatibleData = formatXRDataForBabia(transformedData);
    const dataFilePath = path.join(visualizationDir, 'data.json');
    await fs.writeFile(dataFilePath, JSON.stringify(babiaCompatibleData, null, 2));
    console.log(`💾 Updated data file: ${dataFilePath}`);
    
    // Regenerar HTML siempre (para asegurar actualizaciones)
    const htmlFilePath = path.join(visualizationDir, 'index.html');
    const htmlContent = await generateXRAnalysisHTML(analysisResult, './data.json', context);
    await fs.writeFile(htmlFilePath, htmlContent);
    console.log(`📄 Updated HTML file: ${htmlFilePath}`);
    
    // Actualizar FileWatchManager
    const fileWatchManager = FileWatchManager.getInstance();
    if (fileWatchManager) {
      fileWatchManager.setXRHtmlPath(analysisResult.filePath, htmlFilePath);
    }
    
    // ✅ DETERMINAR MODO DE SERVIDOR BASADO EN CONFIGURACIÓN
    const userServerMode = context.globalState.get<ServerMode>('serverMode') || ServerMode.HTTPS_DEFAULT_CERTS;
    let analysisServerMode: ServerMode;
    let protocolForPort: 'http' | 'https';
    
    switch (userServerMode) {
      case ServerMode.HTTP:
        analysisServerMode = ServerMode.HTTP;
        protocolForPort = 'http';
        break;
        
      case ServerMode.HTTPS_DEFAULT_CERTS:
        if (defaultCertificatesExist(context)) {
          analysisServerMode = ServerMode.HTTPS_DEFAULT_CERTS;
          protocolForPort = 'https';
        } else {
          analysisServerMode = ServerMode.HTTP;
          protocolForPort = 'http';
          vscode.window.showWarningMessage(
            'Default HTTPS certificates not found. Analysis server will use HTTP instead.'
          );
        }
        break;
        
      case ServerMode.HTTPS_CUSTOM_CERTS:
        const customKeyPath = context.globalState.get<string>('customKeyPath');
        const customCertPath = context.globalState.get<string>('customCertPath');
        
        if (customKeyPath && customCertPath) {
          analysisServerMode = ServerMode.HTTPS_CUSTOM_CERTS;
          protocolForPort = 'https';
        } else {
          analysisServerMode = ServerMode.HTTP;
          protocolForPort = 'http';
          vscode.window.showWarningMessage(
            'Custom HTTPS certificates not configured. Analysis server will use HTTP instead.'
          );
        }
        break;
        
      default:
        analysisServerMode = ServerMode.HTTP;
        protocolForPort = 'http';
    }
    
    // ✅ CREAR NUEVO SERVIDOR (puede usar el mismo puerto si se liberó)
    console.log(`🚀 Creating new server for updated analysis...`);
    const serverInfo = await createServer(visualizationDir, analysisServerMode, context);
    
    if (serverInfo) {
      // ✅ USAR EL IMPORT ESTÁTICO EN LUGAR DEL DINÁMICO
      const customDisplayName = `${analysisResult.fileName}: ${serverInfo.port}`;
      
      updateServerDisplayInfo(serverInfo.id, {
        displayUrl: customDisplayName,
        analysisFileName: analysisResult.fileName
      });
      
      console.log(`✅ New analysis server started: ${serverInfo.url}`);
      console.log(`🏷️ Display name set to: ${customDisplayName}`);
      
      // Abrir en navegador
      vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
      
      const protocolMessage = protocolForPort === 'https' 
        ? '🔒 Secure HTTPS server (VR compatible)' 
        : '🌐 HTTP server (not VR compatible)';
      
      const isRelaunch = existingFolder ? ' (relaunched)' : '';
      
      vscode.window.showInformationMessage(
        `XR Analysis visualization opened at ${serverInfo.displayUrl}${isRelaunch}\n${protocolMessage}`
      );
      
      // ✅ REFRESH TREE VIEW PARA MOSTRAR EL NOMBRE ACTUALIZADO
      vscode.commands.executeCommand('codexr.refreshView');
      
      return htmlFilePath;
    } else {
      vscode.window.showErrorMessage('Failed to start XR analysis server');
      return undefined;
    }
  } catch (error) {
    console.error('Error creating XR visualization:', error);
    vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

/**
 * ✅ NUEVA FUNCIÓN PARA CERRAR SERVIDOR ESPECÍFICO DE UN ARCHIVO
 * Close any existing server for a specific file analysis
 * @param fileName File name without extension
 */
export function closeExistingAnalysisServer(fileName: string): boolean {
  const fileNameWithoutExt = path.basename(fileName, path.extname(fileName));
  const existingFolder = visualizationFolders.get(fileNameWithoutExt);
  
  if (existingFolder) {
    const activeServers = getActiveServers();
    const existingServer = activeServers.find(server => {
      const serverDir = path.dirname(server.filePath);
      return serverDir === existingFolder;
    });
    
    if (existingServer) {
      console.log(`🛑 Closing existing analysis server for ${fileName}: ${existingServer.url}`);
      stopServer(existingServer.id);
      return true;
    }
  }
  
  return false;
}

/**
 * ✅ NUEVA FUNCIÓN PARA VERIFICAR SI HAY SERVIDOR ACTIVO PARA UN ARCHIVO
 * Check if there's an active server for a specific file
 * @param fileName File name without extension
 * @returns ServerInfo if found, undefined otherwise
 */
export function getActiveAnalysisServer(fileName: string): ServerInfo | undefined {
  const fileNameWithoutExt = path.basename(fileName, path.extname(fileName));
  const existingFolder = visualizationFolders.get(fileNameWithoutExt);
  
  if (existingFolder) {
    const activeServers = getActiveServers();
    return activeServers.find(server => {
      const serverDir = path.dirname(server.filePath);
      return serverDir === existingFolder;
    });
  }
  
  return undefined;
}

/**
 * Cleanup visualization servers and tracked folders
 */
export function cleanupXRVisualizations(): void {
  visualizationFolders.clear();
}

/**
 * Get visualization folder for a specific file name
 * @param fileName File name without extension
 * @returns Visualization directory path or undefined if not found
 */
export function getVisualizationFolder(fileName: string): string | undefined {
  return visualizationFolders.get(fileName);
}