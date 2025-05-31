"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createXRVisualization = createXRVisualization;
exports.closeExistingAnalysisServer = closeExistingAnalysisServer;
exports.getActiveAnalysisServer = getActiveAnalysisServer;
exports.cleanupXRVisualizations = cleanupXRVisualizations;
exports.getVisualizationFolder = getVisualizationFolder;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const xrDataTransformer_1 = require("./xrDataTransformer");
const xrTemplateUtils_1 = require("./xrTemplateUtils");
const serverManager_1 = require("../../server/serverManager"); // ✅ AÑADIR updateServerDisplayInfo AL IMPORT ESTÁTICO
const serverModel_1 = require("../../server/models/serverModel");
const xrDataFormatter_1 = require("./xrDataFormatter");
const fileWatchManager_1 = require("../fileWatchManager");
const certificateManager_1 = require("../../server/certificateManager");
// Track visualization paths by file
const visualizationFolders = new Map();
/**
 * Creates an XR visualization for a file analysis result
 * @param context Extension context for storage
 * @param analysisResult Result of file analysis
 * @returns Path to the created HTML visualization
 */
async function createXRVisualization(context, analysisResult) {
    try {
        const fileNameWithoutExt = path.basename(analysisResult.fileName, path.extname(analysisResult.fileName));
        // ✅ VERIFICAR SI YA HAY UNA VISUALIZACIÓN ACTIVA PARA ESTE ARCHIVO
        const existingFolder = visualizationFolders.get(fileNameWithoutExt);
        if (existingFolder) {
            console.log(`♻️ Found existing visualization folder for ${fileNameWithoutExt}: ${existingFolder}`);
            // ✅ VERIFICAR SI HAY UN SERVIDOR ACTIVO PARA ESTA CARPETA
            const activeServers = (0, serverManager_1.getActiveServers)();
            const existingServer = activeServers.find(server => {
                const serverDir = path.dirname(server.filePath);
                return serverDir === existingFolder;
            });
            if (existingServer) {
                console.log(`🔄 Found existing server for ${fileNameWithoutExt}: ${existingServer.url}`);
                console.log(`🛑 Stopping existing server to launch new analysis...`);
                // ✅ CERRAR EL SERVIDOR EXISTENTE
                (0, serverManager_1.stopServer)(existingServer.id);
                // ✅ MOSTRAR MENSAJE AL USUARIO
                vscode.window.showInformationMessage(`🔄 Relaunching analysis for ${analysisResult.fileName}...`, { modal: false });
                // ✅ PEQUEÑA PAUSA PARA ASEGURAR QUE EL PUERTO SE LIBERE
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        // ✅ CREAR NUEVA VISUALIZACIÓN (reutilizar carpeta si existe)
        const visualizationsDir = path.join(context.extensionPath, 'visualizations');
        try {
            await fs.mkdir(visualizationsDir, { recursive: true });
        }
        catch (e) {
            // Directory exists
        }
        let visualizationDir;
        if (existingFolder) {
            // ✅ REUTILIZAR CARPETA EXISTENTE
            visualizationDir = existingFolder;
            console.log(`♻️ Reusing existing visualization folder: ${visualizationDir}`);
        }
        else {
            // ✅ CREAR NUEVA CARPETA
            const folderName = `analysis_${fileNameWithoutExt}_${Date.now()}`;
            visualizationDir = path.join(visualizationsDir, folderName);
            try {
                await fs.mkdir(visualizationDir, { recursive: true });
            }
            catch (e) {
                // Directory exists
            }
            // Guardar para reutilización futura
            visualizationFolders.set(fileNameWithoutExt, visualizationDir);
            console.log(`📁 Created new visualization folder: ${visualizationDir}`);
        }
        // ✅ SIEMPRE REGENERAR DATOS Y HTML (para reflejar cambios en el código)
        console.log(`🔄 Regenerating analysis data for ${analysisResult.fileName}...`);
        // Transformar y guardar datos actualizados
        const transformedData = (0, xrDataTransformer_1.transformAnalysisDataForXR)(analysisResult);
        const babiaCompatibleData = (0, xrDataFormatter_1.formatXRDataForBabia)(transformedData);
        const dataFilePath = path.join(visualizationDir, 'data.json');
        await fs.writeFile(dataFilePath, JSON.stringify(babiaCompatibleData, null, 2));
        console.log(`💾 Updated data file: ${dataFilePath}`);
        // Regenerar HTML siempre (para asegurar actualizaciones)
        const htmlFilePath = path.join(visualizationDir, 'index.html');
        const htmlContent = await (0, xrTemplateUtils_1.generateXRAnalysisHTML)(analysisResult, './data.json', context);
        await fs.writeFile(htmlFilePath, htmlContent);
        console.log(`📄 Updated HTML file: ${htmlFilePath}`);
        // Actualizar FileWatchManager
        const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
        if (fileWatchManager) {
            fileWatchManager.setXRHtmlPath(analysisResult.filePath, htmlFilePath);
        }
        // ✅ DETERMINAR MODO DE SERVIDOR BASADO EN CONFIGURACIÓN
        const userServerMode = context.globalState.get('serverMode') || serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS;
        let analysisServerMode;
        let protocolForPort;
        switch (userServerMode) {
            case serverModel_1.ServerMode.HTTP:
                analysisServerMode = serverModel_1.ServerMode.HTTP;
                protocolForPort = 'http';
                break;
            case serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS:
                if ((0, certificateManager_1.defaultCertificatesExist)(context)) {
                    analysisServerMode = serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS;
                    protocolForPort = 'https';
                }
                else {
                    analysisServerMode = serverModel_1.ServerMode.HTTP;
                    protocolForPort = 'http';
                    vscode.window.showWarningMessage('Default HTTPS certificates not found. Analysis server will use HTTP instead.');
                }
                break;
            case serverModel_1.ServerMode.HTTPS_CUSTOM_CERTS:
                const customKeyPath = context.globalState.get('customKeyPath');
                const customCertPath = context.globalState.get('customCertPath');
                if (customKeyPath && customCertPath) {
                    analysisServerMode = serverModel_1.ServerMode.HTTPS_CUSTOM_CERTS;
                    protocolForPort = 'https';
                }
                else {
                    analysisServerMode = serverModel_1.ServerMode.HTTP;
                    protocolForPort = 'http';
                    vscode.window.showWarningMessage('Custom HTTPS certificates not configured. Analysis server will use HTTP instead.');
                }
                break;
            default:
                analysisServerMode = serverModel_1.ServerMode.HTTP;
                protocolForPort = 'http';
        }
        // ✅ CREAR NUEVO SERVIDOR (puede usar el mismo puerto si se liberó)
        console.log(`🚀 Creating new server for updated analysis...`);
        const serverInfo = await (0, serverManager_1.createServer)(visualizationDir, analysisServerMode, context);
        if (serverInfo) {
            // ✅ USAR EL IMPORT ESTÁTICO EN LUGAR DEL DINÁMICO
            const customDisplayName = `${analysisResult.fileName}: ${serverInfo.port}`;
            (0, serverManager_1.updateServerDisplayInfo)(serverInfo.id, {
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
            vscode.window.showInformationMessage(`XR Analysis visualization opened at ${serverInfo.displayUrl}${isRelaunch}\n${protocolMessage}`);
            // ✅ REFRESH TREE VIEW PARA MOSTRAR EL NOMBRE ACTUALIZADO
            vscode.commands.executeCommand('codexr.refreshView');
            return htmlFilePath;
        }
        else {
            vscode.window.showErrorMessage('Failed to start XR analysis server');
            return undefined;
        }
    }
    catch (error) {
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
function closeExistingAnalysisServer(fileName) {
    const fileNameWithoutExt = path.basename(fileName, path.extname(fileName));
    const existingFolder = visualizationFolders.get(fileNameWithoutExt);
    if (existingFolder) {
        const activeServers = (0, serverManager_1.getActiveServers)();
        const existingServer = activeServers.find(server => {
            const serverDir = path.dirname(server.filePath);
            return serverDir === existingFolder;
        });
        if (existingServer) {
            console.log(`🛑 Closing existing analysis server for ${fileName}: ${existingServer.url}`);
            (0, serverManager_1.stopServer)(existingServer.id);
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
function getActiveAnalysisServer(fileName) {
    const fileNameWithoutExt = path.basename(fileName, path.extname(fileName));
    const existingFolder = visualizationFolders.get(fileNameWithoutExt);
    if (existingFolder) {
        const activeServers = (0, serverManager_1.getActiveServers)();
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
function cleanupXRVisualizations() {
    visualizationFolders.clear();
}
/**
 * Get visualization folder for a specific file name
 * @param fileName File name without extension
 * @returns Visualization directory path or undefined if not found
 */
function getVisualizationFolder(fileName) {
    return visualizationFolders.get(fileName);
}
//# sourceMappingURL=xrAnalysisManager.js.map