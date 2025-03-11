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
const server_1 = require("./server"); // Funciones para iniciar/detener el servidor local HTTP
const treeProvider_1 = require("./treeProvider"); // Proveedor de datos para la vista en el panel lateral
/**
 * Esta función se ejecuta cuando la extensión se activa
 * (cuando se inicia VS Code o cuando se invoca uno de los comandos de la extensión)
 * @param context - Proporciona acceso al entorno de la extensión y métodos para registrar recursos
 */
function activate(context) {
    // Log informativo que aparecerá en la consola de desarrollo de VS Code
    console.log('La extensión "first-vscode-extension" está activa.');
    // Registro del comando para iniciar el servidor local
    // Este comando se puede ejecutar desde la paleta de comandos (Ctrl+Shift+P)
    const startServerCommand = vscode.commands.registerCommand('first-vscode-extension.startLocalServer', async () => {
        // Configura las opciones para el diálogo de selección de archivos
        const options = {
            canSelectMany: false, // Solo permite seleccionar un archivo
            openLabel: 'Selecciona un archivo HTML', // Texto del botón de selección
            filters: { 'HTML': ['html', 'htm'] } // Filtro para mostrar solo archivos HTML
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
        await (0, server_1.startServer)(selectedFile, context);
    });
    // Registro del comando para detener el servidor local
    const stopServerCommand = vscode.commands.registerCommand('first-vscode-extension.stopLocalServer', () => {
        (0, server_1.stopServer)();
    });
    // Registra los comandos en el contexto para que se limpien automáticamente cuando la extensión se desactive
    context.subscriptions.push(startServerCommand, stopServerCommand);
    // Registro del proveedor de datos para la vista en el panel lateral
    // Esto permite mostrar información y controles relacionados con el servidor local
    const treeDataProvider = new treeProvider_1.LocalServerProvider();
    vscode.window.registerTreeDataProvider('localServerView', treeDataProvider);
}
/**
 * Esta función se ejecuta cuando la extensión se desactiva
 * (cuando VS Code se cierra o cuando la extensión se desactiva manualmente)
 * Es útil para limpiar recursos, cerrar conexiones, etc.
 */
function deactivate() {
    // Detener el servidor si está activo
    (0, server_1.stopServer)();
}
//# sourceMappingURL=extension.js.map