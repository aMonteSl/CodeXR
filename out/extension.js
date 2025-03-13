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
exports.activate = activate;
exports.deactivate = deactivate;
// Importaciones necesarias para la extensión
const vscode = __importStar(require("vscode")); // API principal de VS Code
const server_1 = require("./server"); // Funciones para iniciar/detener el servidor
const treeProvider_1 = require("./treeProvider"); // Proveedor de datos para la vista
const path = __importStar(require("path")); // Importa el módulo 'path'
/**
 * Esta función se ejecuta cuando la extensión se activa
 */
function activate(context) {
    console.log('La extensión "integracionvsaframe" está activa.');
    // Registro del proveedor de datos para la vista en el panel lateral
    const treeDataProvider = new treeProvider_1.LocalServerProvider(context);
    vscode.window.registerTreeDataProvider('localServerView', treeDataProvider);
    // Registro del proveedor de datos para la vista en el panel lateral
    const treeView = vscode.window.createTreeView('localServerView', {
        treeDataProvider: treeDataProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);
    // Comando para cambiar el modo del servidor
    const changeServerModeCommand = vscode.commands.registerCommand('integracionvsaframe.changeServerMode', (mode) => {
        treeDataProvider.changeServerMode(mode);
    });
    // Comando para iniciar el servidor con la configuración actual
    const startServerWithConfigCommand = vscode.commands.registerCommand('integracionvsaframe.startServerWithConfig', async () => {
        const currentMode = context.globalState.get('serverMode') ||
            treeProvider_1.ServerMode.HTTPS_DEFAULT_CERTS;
        // Configura las opciones para el diálogo de selección de archivos HTML
        const options = {
            canSelectMany: false,
            openLabel: 'Selecciona un archivo HTML',
            filters: { 'HTML': ['html', 'htm'] }
        };
        // Muestra el diálogo para seleccionar un archivo
        const fileUri = await vscode.window.showOpenDialog(options);
        if (!fileUri || fileUri.length === 0) {
            vscode.window.showErrorMessage('No se seleccionó ningún archivo HTML.');
            return;
        }
        // Obtiene la ruta completa del archivo seleccionado
        const selectedFile = fileUri[0].fsPath;
        // Define el modo de servidor según la configuración
        const useHttps = currentMode !== treeProvider_1.ServerMode.HTTP;
        const useDefaultCerts = currentMode === treeProvider_1.ServerMode.HTTPS_DEFAULT_CERTS;
        // Inicia el servidor con la configuración seleccionada
        await (0, server_1.startServer)(selectedFile, context, useHttps, useDefaultCerts);
    });
    // Comando original para iniciar el servidor (mantiene la compatibilidad)
    const startServerCommand = vscode.commands.registerCommand('integracionvsaframe.startLocalServer', async () => {
        // Primero, pregunta al usuario si desea usar HTTPS
        const serverType = await vscode.window.showQuickPick(['HTTP', 'HTTPS (requiere certificados)'], { placeHolder: 'Selecciona el tipo de servidor' });
        if (!serverType) {
            return; // El usuario canceló la selección
        }
        const useHttps = serverType === 'HTTPS (requiere certificados)';
        // Configura las opciones para el diálogo de selección de archivos HTML
        const options = {
            canSelectMany: false,
            openLabel: 'Selecciona un archivo HTML',
            filters: { 'HTML': ['html', 'htm'] }
        };
        // Muestra el diálogo para seleccionar un archivo
        const fileUri = await vscode.window.showOpenDialog(options);
        if (!fileUri || fileUri.length === 0) {
            vscode.window.showErrorMessage('No se seleccionó ningún archivo HTML.');
            return;
        }
        const selectedFile = fileUri[0].fsPath;
        await (0, server_1.startServer)(selectedFile, context, useHttps, false);
    });
    // Comando para detener el servidor
    const stopServerCommand = vscode.commands.registerCommand('integracionvsaframe.stopLocalServer', () => {
        (0, server_1.stopServer)();
    });
    // Comando para refrescar la vista de servidores
    const refreshServerViewCommand = vscode.commands.registerCommand('integracionvsaframe.refreshServerView', () => {
        treeDataProvider.refresh();
    });
    // Comando para mostrar opciones de un servidor activo
    const serverOptionsCommand = vscode.commands.registerCommand('integracionvsaframe.serverOptions', async (serverInfo) => {
        const selection = await vscode.window.showQuickPick([
            { label: '$(globe) Abrir en Navegador', id: 'open' },
            { label: '$(stop) Detener Servidor', id: 'stop' }
        ], {
            placeHolder: `Servidor ${serverInfo.url}`,
            title: `Opciones para ${path.basename(serverInfo.filePath)}`
        });
        if (!selection) {
            return;
        }
        if (selection.id === 'open') {
            vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
        }
        else if (selection.id === 'stop') {
            (0, server_1.stopServer)(serverInfo.id);
        }
    });
    // Comando para acciones desde la barra de estado
    const serverStatusActionsCommand = vscode.commands.registerCommand('integracionvsaframe.serverStatusActions', async () => {
        const activeServers = (0, server_1.getActiveServers)();
        if (activeServers.length === 0) {
            vscode.window.showInformationMessage('No hay servidores activos');
            return;
        }
        // Si solo hay un servidor, mostrar opciones directamente
        if (activeServers.length === 1) {
            vscode.commands.executeCommand('first-vscode-extension.serverOptions', activeServers[0]);
            return;
        }
        // Si hay múltiples servidores, mostrar lista para seleccionar
        const items = activeServers.map(server => ({
            label: path.basename(server.filePath),
            description: server.url,
            server: server
        }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Selecciona un servidor',
        });
        if (selected) {
            vscode.commands.executeCommand('first-vscode-extension.serverOptions', selected.server);
        }
    });
    // Registra los comandos
    context.subscriptions.push(startServerCommand, stopServerCommand, changeServerModeCommand, startServerWithConfigCommand, refreshServerViewCommand, serverOptionsCommand, serverStatusActionsCommand);
}
function deactivate() {
    (0, server_1.stopServer)(); // Asegura que el servidor se detenga al desactivar la extensión
}
//# sourceMappingURL=extension.js.map