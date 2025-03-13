// Importaciones necesarias para la extensión
import * as vscode from 'vscode';           // API principal de VS Code
import { startServer, stopServer, getActiveServers } from './server';     // Funciones para iniciar/detener el servidor
import { LocalServerProvider, ServerMode } from './treeProvider'; // Proveedor de datos para la vista
import { ServerInfo } from './server'; // Añadir después de las importaciones existentes
import * as path from 'path'; // Importa el módulo 'path'

/**
 * Esta función se ejecuta cuando la extensión se activa
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('La extensión "integracionvsaframe" está activa.');

  // Registro del proveedor de datos para la vista en el panel lateral
  const treeDataProvider = new LocalServerProvider(context);
  vscode.window.registerTreeDataProvider('localServerView', treeDataProvider);

  // Registro del proveedor de datos para la vista en el panel lateral
  const treeView = vscode.window.createTreeView('localServerView', {
    treeDataProvider: treeDataProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);

  // Comando para cambiar el modo del servidor
  const changeServerModeCommand = vscode.commands.registerCommand(
    'integracionvsaframe.changeServerMode', 
    (mode: ServerMode) => {
      treeDataProvider.changeServerMode(mode);
    }
  );

  // Comando para iniciar el servidor con la configuración actual
  const startServerWithConfigCommand = vscode.commands.registerCommand(
    'integracionvsaframe.startServerWithConfig', 
    async () => {
      const currentMode = context.globalState.get<ServerMode>('serverMode') || 
        ServerMode.HTTPS_DEFAULT_CERTS;
      
      // Configura las opciones para el diálogo de selección de archivos HTML
      const options: vscode.OpenDialogOptions = {
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
      const useHttps = currentMode !== ServerMode.HTTP;
      const useDefaultCerts = currentMode === ServerMode.HTTPS_DEFAULT_CERTS;
      
      // Inicia el servidor con la configuración seleccionada
      await startServer(selectedFile, context, useHttps, useDefaultCerts);
    }
  );

  // Comando original para iniciar el servidor (mantiene la compatibilidad)
  const startServerCommand = vscode.commands.registerCommand(
    'integracionvsaframe.startLocalServer', 
    async () => {
      // Primero, pregunta al usuario si desea usar HTTPS
      const serverType = await vscode.window.showQuickPick(
        ['HTTP', 'HTTPS (requiere certificados)'],
        { placeHolder: 'Selecciona el tipo de servidor' }
      );
      
      if (!serverType) {
        return; // El usuario canceló la selección
      }

      const useHttps = serverType === 'HTTPS (requiere certificados)';
      
      // Configura las opciones para el diálogo de selección de archivos HTML
      const options: vscode.OpenDialogOptions = {
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
      await startServer(selectedFile, context, useHttps, false);
    }
  );

  // Comando para detener el servidor
  const stopServerCommand = vscode.commands.registerCommand(
    'integracionvsaframe.stopLocalServer', 
    () => {
      stopServer();
    }
  );

  // Comando para refrescar la vista de servidores
  const refreshServerViewCommand = vscode.commands.registerCommand(
    'integracionvsaframe.refreshServerView',
    () => {
      treeDataProvider.refresh();
    }
  );
  
  // Comando para mostrar opciones de un servidor activo
  const serverOptionsCommand = vscode.commands.registerCommand(
    'integracionvsaframe.serverOptions',
    async (serverInfo: ServerInfo) => {
      const selection = await vscode.window.showQuickPick(
        [
          { label: '$(globe) Abrir en Navegador', id: 'open' },
          { label: '$(stop) Detener Servidor', id: 'stop' }
        ],
        {
          placeHolder: `Servidor ${serverInfo.url}`,
          title: `Opciones para ${path.basename(serverInfo.filePath)}`
        }
      );
      
      if (!selection) {
        return;
      }
      
      if (selection.id === 'open') {
        vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
      } else if (selection.id === 'stop') {
        stopServer(serverInfo.id);
      }
    }
  );
  
  // Comando para acciones desde la barra de estado
  const serverStatusActionsCommand = vscode.commands.registerCommand(
    'integracionvsaframe.serverStatusActions',
    async () => {
      const activeServers = getActiveServers();
      
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
    }
  );

  // Registra los comandos
  context.subscriptions.push(
    startServerCommand,
    stopServerCommand,
    changeServerModeCommand,
    startServerWithConfigCommand,
    refreshServerViewCommand,
    serverOptionsCommand,
    serverStatusActionsCommand
  );
}

export function deactivate() {
  stopServer(); // Asegura que el servidor se detenga al desactivar la extensión
}
