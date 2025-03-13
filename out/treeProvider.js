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
exports.LocalServerProvider = exports.ServerMode = void 0;
const vscode = __importStar(require("vscode")); // Importa la API de VS Code
const fs = __importStar(require("fs")); // Para verificar archivos
const path = __importStar(require("path")); // Para manejar rutas
const server_1 = require("./server");
// Enumerado para los tipos de servidor disponibles
var ServerMode;
(function (ServerMode) {
    ServerMode["HTTP"] = "HTTP";
    ServerMode["HTTPS_DEFAULT_CERTS"] = "HTTPS (certificados predeterminados)";
    ServerMode["HTTPS_CUSTOM_CERTS"] = "HTTPS (certificados personalizados)";
})(ServerMode || (exports.ServerMode = ServerMode = {}));
/**
 * Clase que implementa el proveedor de datos para la vista de árbol (Tree View)
 */
class LocalServerProvider {
    // EventEmitter para notificar cambios en los datos
    _onDidChangeTreeData = new vscode.EventEmitter();
    // Evento que VS Code escucha para actualizar la vista
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    // Contexto de la extensión para acceder al almacenamiento
    context;
    constructor(context) {
        this.context = context;
        // Inicializa con valores predeterminados si no existe configuración previa
        if (!this.context.globalState.get('serverMode')) {
            this.context.globalState.update('serverMode', ServerMode.HTTPS_DEFAULT_CERTS);
        }
    }
    /**
     * Refresca la vista del árbol
     */
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    /**
     * Devuelve el elemento de UI para un item
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Obtiene los elementos hijos de un elemento o los elementos raíz
     */
    getChildren(element) {
        if (!element) {
            // Elementos raíz
            const currentMode = this.context.globalState.get('serverMode') ||
                ServerMode.HTTPS_DEFAULT_CERTS;
            // Comprueba si existen certificados predeterminados
            const extensionPath = this.context.extensionPath;
            const keyPath = path.join(extensionPath, 'certs', 'babia_key.pem');
            const certPath = path.join(extensionPath, 'certs', 'babia_cert.pem');
            const defaultCertsExist = fs.existsSync(keyPath) && fs.existsSync(certPath);
            // Obtener los servidores activos
            const activeServers = (0, server_1.getActiveServers)();
            const rootItems = [
                new ServerConfigItem(this.context, currentMode),
                new StartServerItem(currentMode, defaultCertsExist)
            ];
            // Si hay servidores activos, añadir el contenedor de servidores
            if (activeServers.length > 0) {
                rootItems.push(new ActiveServersContainer(activeServers.length));
            }
            return Promise.resolve(rootItems);
        }
        // Si el elemento es de configuración, devuelve opciones
        if (element instanceof ServerConfigItem && element.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
            return Promise.resolve([
                new ServerModeItem(ServerMode.HTTP, this.context),
                new ServerModeItem(ServerMode.HTTPS_DEFAULT_CERTS, this.context),
                new ServerModeItem(ServerMode.HTTPS_CUSTOM_CERTS, this.context)
            ]);
        }
        // Si el elemento es el contenedor de servidores activos, devuelve la lista de servidores
        if (element instanceof ActiveServersContainer) {
            const activeServers = (0, server_1.getActiveServers)();
            return Promise.resolve(activeServers.map(server => new ActiveServerItem(server)));
        }
        return Promise.resolve([]);
    }
    /**
     * Cambia el modo de servidor
     */
    async changeServerMode(mode) {
        if (mode === ServerMode.HTTP) {
            // Advertir sobre limitaciones en dispositivos VR
            const selection = await vscode.window.showWarningMessage('El modo HTTP no es compatible con dispositivos de realidad virtual debido a restricciones de seguridad. ' +
                '¿Desea continuar?', 'Sí, entiendo', 'Cancelar');
            if (selection !== 'Sí, entiendo') {
                return;
            }
        }
        // Guardar el modo seleccionado
        await this.context.globalState.update('serverMode', mode);
        this.refresh();
    }
}
exports.LocalServerProvider = LocalServerProvider;
/**
 * Clase base para los elementos del árbol
 */
class TreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState) {
        super(label, collapsibleState);
    }
}
/**
 * Elemento para iniciar el servidor
 */
class StartServerItem extends TreeItem {
    constructor(currentMode, defaultCertsExist) {
        super('Iniciar Servidor Local', vscode.TreeItemCollapsibleState.None);
        // Determine el tipo de descripción según el modo actual
        let description;
        switch (currentMode) {
            case ServerMode.HTTP:
                description = "Modo HTTP (sin certificados)";
                break;
            case ServerMode.HTTPS_DEFAULT_CERTS:
                description = defaultCertsExist
                    ? "HTTPS con certificados predeterminados"
                    : "⚠️ Certificados predeterminados no encontrados";
                break;
            case ServerMode.HTTPS_CUSTOM_CERTS:
                description = "HTTPS con certificados personalizados";
                break;
        }
        this.description = description;
        // Establece el tooltip según el modo
        this.tooltip = 'Iniciar servidor en modo ' + currentMode +
            '\nSelecciona un archivo HTML para servir';
        // Define el comando al hacer clic
        this.command = {
            command: 'integracionvsaframe.startServerWithConfig',
            title: 'Iniciar Servidor'
        };
        // Establece el icono
        this.iconPath = new vscode.ThemeIcon('server');
        // Contexto para colorear el elemento en caso de advertencia
        this.contextValue = currentMode === ServerMode.HTTPS_DEFAULT_CERTS && !defaultCertsExist
            ? 'warning' : undefined;
    }
}
/**
 * Elemento para la configuración del servidor
 */
class ServerConfigItem extends TreeItem {
    constructor(context, currentMode) {
        super('Configuración del servidor', vscode.TreeItemCollapsibleState.Collapsed);
        this.description = currentMode;
        this.tooltip = 'Configuración para el servidor local';
        this.iconPath = new vscode.ThemeIcon('gear');
    }
}
/**
 * Elemento para cada modo de servidor disponible
 */
class ServerModeItem extends TreeItem {
    constructor(mode, context) {
        super(mode, vscode.TreeItemCollapsibleState.None);
        const currentMode = context.globalState.get('serverMode');
        // Si es el modo actual, marcarlo como seleccionado
        if (mode === currentMode) {
            this.description = '✓ Seleccionado';
        }
        // Establece tooltip explicativo según el modo
        switch (mode) {
            case ServerMode.HTTP:
                this.tooltip = 'Usar HTTP simple (sin cifrado)\n⚠️ No funciona con dispositivos VR';
                this.iconPath = new vscode.ThemeIcon('globe');
                break;
            case ServerMode.HTTPS_DEFAULT_CERTS:
                this.tooltip = 'Usar HTTPS con los certificados incluidos en la extensión';
                this.iconPath = new vscode.ThemeIcon('shield');
                break;
            case ServerMode.HTTPS_CUSTOM_CERTS:
                this.tooltip = 'Usar HTTPS con certificados personalizados (deberás seleccionarlos)';
                this.iconPath = new vscode.ThemeIcon('key');
                break;
        }
        // Define el comando al hacer clic para cambiar el modo
        this.command = {
            command: 'integracionvsaframe.changeServerMode',
            title: 'Cambiar modo de servidor',
            arguments: [mode]
        };
    }
}
// Añadir nuevas clases de elementos para los servidores activos
class ActiveServersContainer extends TreeItem {
    constructor(count) {
        super(`Servidores Activos (${count})`, vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon('server-environment');
        this.contextValue = 'serverContainer';
        this.tooltip = 'Servidores actualmente en ejecución';
    }
}
class ActiveServerItem extends TreeItem {
    serverInfo;
    constructor(serverInfo) {
        super(path.basename(serverInfo.filePath), vscode.TreeItemCollapsibleState.None);
        this.serverInfo = serverInfo;
        this.description = serverInfo.url;
        this.tooltip = `Servidor ${serverInfo.protocol.toUpperCase()} 
Ruta: ${serverInfo.filePath}
URL: ${serverInfo.url}
Haz clic para ver opciones`;
        this.iconPath = new vscode.ThemeIcon(serverInfo.useHttps ? 'shield' : 'globe');
        this.contextValue = 'activeServer';
        // Al hacer clic en el servidor, mostrará opciones
        this.command = {
            command: 'integracionvsaframe.serverOptions',
            title: 'Opciones del Servidor',
            arguments: [serverInfo]
        };
    }
}
//# sourceMappingURL=treeProvider.js.map