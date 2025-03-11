// Importaciones necesarias para la extensión
import * as vscode from 'vscode';           // API principal de VS Code
import { startServer, stopServer } from './server';     // Funciones para iniciar/detener el servidor local HTTP
import { LocalServerProvider } from './treeProvider'; // Proveedor de datos para la vista en el panel lateral

/**
 * Esta función se ejecuta cuando la extensión se activa
 * (cuando se inicia VS Code o cuando se invoca uno de los comandos de la extensión)
 * @param context - Proporciona acceso al entorno de la extensión y métodos para registrar recursos
 */
export function activate(context: vscode.ExtensionContext) {
  // Log informativo que aparecerá en la consola de desarrollo de VS Code
  console.log('La extensión "first-vscode-extension" está activa.');

  // Registro del comando para iniciar el servidor local
  // Este comando se puede ejecutar desde la paleta de comandos (Ctrl+Shift+P)
  const startServerCommand = vscode.commands.registerCommand('first-vscode-extension.startLocalServer', async () => {
    // Configura las opciones para el diálogo de selección de archivos
    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,         // Solo permite seleccionar un archivo
      openLabel: 'Selecciona un archivo HTML', // Texto del botón de selección
      filters: { 'HTML': ['html', 'htm'] }    // Filtro para mostrar solo archivos HTML
    };

    // Muestra el diálogo para seleccionar un archivo
    const fileUri = await vscode.window.showOpenDialog(options);
    // Verifica si se seleccionó algún archivo
    if (!fileUri || fileUri.length === 0) {
      vscode.window.showErrorMessage('No se seleccionó ningún archivo HTML.');
      return;
    }

    // Obtiene la ruta completa del archivo seleccionado
    const selectedFile = fileUri[0].fsPath;
    // Inicia el servidor HTTP pasando el archivo seleccionado y el contexto de la extensión
    // Esto creará un servidor que sirve el archivo HTML con capacidad de recarga en vivo
    await startServer(selectedFile, context);
  });
  
  // Registro del comando para detener el servidor local
  const stopServerCommand = vscode.commands.registerCommand('first-vscode-extension.stopLocalServer', () => {
    stopServer();
  });
  
  // Registra los comandos en el contexto para que se limpien automáticamente cuando la extensión se desactive
  context.subscriptions.push(startServerCommand, stopServerCommand);

  // Registro del proveedor de datos para la vista en el panel lateral
  // Esto permite mostrar información y controles relacionados con el servidor local
  const treeDataProvider = new LocalServerProvider();
  vscode.window.registerTreeDataProvider('localServerView', treeDataProvider);
}

/**
 * Esta función se ejecuta cuando la extensión se desactiva
 * (cuando VS Code se cierra o cuando la extensión se desactiva manualmente)
 * Es útil para limpiar recursos, cerrar conexiones, etc.
 */
export function deactivate() {
  // Detener el servidor si está activo
  stopServer();
}
