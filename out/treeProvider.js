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
exports.LocalServerItem = exports.LocalServerProvider = void 0;
const vscode = __importStar(require("vscode")); // Importa la API de VS Code para acceder a sus funcionalidades
/**
 * Clase que implementa el proveedor de datos para la vista de árbol (Tree View)
 * Esta clase es responsable de proporcionar los elementos que se mostrarán
 * en el panel lateral de la extensión
 */
class LocalServerProvider {
    // EventEmitter que notifica a VS Code cuando los datos del árbol han cambiado
    // y es necesario refrescar la vista
    _onDidChangeTreeData = new vscode.EventEmitter();
    // Evento que VS Code escucha para saber cuándo actualizar la vista
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    /**
     * Devuelve el elemento de UI que se mostrará para cada item del árbol
     * @param element - El item para el que se debe generar un TreeItem
     */
    getTreeItem(element) {
        return element; // Simplemente devuelve el elemento, ya que LocalServerItem ya extiende TreeItem
    }
    /**
     * Obtiene los hijos de un elemento, o los elementos raíz si no se proporciona ningún elemento
     * @param element - Elemento padre opcional del cual obtener los hijos
     */
    getChildren(element) {
        if (!element) {
            // Si no hay elemento (estamos en la raíz), devolvemos un único elemento que funciona como botón
            return Promise.resolve([new LocalServerItem()]);
        }
        // Si se proporciona un elemento, no mostramos hijos (estructura plana)
        return Promise.resolve([]);
    }
}
exports.LocalServerProvider = LocalServerProvider;
/**
 * Clase que representa un elemento en la vista de árbol
 * En este caso, representa un botón para iniciar el servidor local
 */
class LocalServerItem extends vscode.TreeItem {
    constructor() {
        // Inicializa el elemento con el texto "Iniciar Servidor Local" y sin posibilidad de expandirse
        super('Iniciar Servidor Local', vscode.TreeItemCollapsibleState.None);
        // Establece un tooltip que aparece al pasar el ratón sobre el elemento
        this.tooltip = 'Haz clic para seleccionar un archivo index.html y arrancar el servidor';
        // Define el comando que se ejecutará al hacer clic en este elemento
        this.command = {
            command: 'first-vscode-extension.startLocalServer', // ID del comando a ejecutar
            title: 'Iniciar Servidor Local' // Título del comando
        };
        // Establece un icono de servidor del conjunto de iconos del tema de VS Code
        this.iconPath = new vscode.ThemeIcon('server');
    }
}
exports.LocalServerItem = LocalServerItem;
//# sourceMappingURL=treeProvider.js.map