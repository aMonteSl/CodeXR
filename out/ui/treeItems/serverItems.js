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
exports.StopAllServersItem = exports.ActiveServerItem = exports.ActiveServersContainer = exports.ServerModeItem = exports.ServerConfigItem = exports.StartServerItem = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const baseItems_1 = require("./baseItems");
const treeProvider_1 = require("../treeProvider");
const serverModel_1 = require("../../server/models/serverModel");
/**
 * Item to start the server
 */
class StartServerItem extends baseItems_1.TreeItem {
    constructor(currentMode, defaultCertsExist) {
        // Determine description type based on current mode
        let description;
        switch (currentMode) {
            case serverModel_1.ServerMode.HTTP:
                description = "HTTP mode (no certificates)";
                break;
            case serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS:
                description = defaultCertsExist
                    ? "HTTPS with default certificates"
                    : "⚠️ Default certificates not found";
                break;
            case serverModel_1.ServerMode.HTTPS_CUSTOM_CERTS:
                description = "HTTPS with custom certificates";
                break;
        }
        // ✅ USAR SOLO TreeItemType.START_SERVER
        super('Start Local Server', 'Start server in ' + currentMode + ' mode\nSelect an HTML file to serve', treeProvider_1.TreeItemType.START_SERVER, // ✅ Usar siempre el mismo tipo
        vscode.TreeItemCollapsibleState.None, {
            command: 'codexr.startServerWithConfig',
            title: 'Start Server'
        }, new vscode.ThemeIcon('play'));
        this.description = description;
        // ✅ MANEJAR EL WARNING A TRAVÉS DE PROPIEDADES
        if (currentMode === serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS && !defaultCertsExist) {
            this.iconPath = new vscode.ThemeIcon('warning');
            this.description = "⚠️ " + description;
        }
    }
}
exports.StartServerItem = StartServerItem;
/**
 * Item for server configuration
 */
class ServerConfigItem extends baseItems_1.TreeItem {
    constructor(context, currentMode) {
        super('Server Configuration', 'Configuration for the local server', treeProvider_1.TreeItemType.SERVER_CONFIG, vscode.TreeItemCollapsibleState.Collapsed, undefined, new vscode.ThemeIcon('gear'));
        this.description = currentMode;
    }
}
exports.ServerConfigItem = ServerConfigItem;
/**
 * Item for each available server mode
 */
class ServerModeItem extends baseItems_1.TreeItem {
    constructor(mode, context) {
        const currentMode = context.globalState.get('serverMode');
        let tooltip;
        let iconPath;
        // Set explanatory tooltip based on mode
        switch (mode) {
            case serverModel_1.ServerMode.HTTP:
                tooltip = 'Use simple HTTP (no encryption)\n⚠️ Does not work with VR devices';
                iconPath = new vscode.ThemeIcon('globe');
                break;
            case serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS:
                tooltip = 'Use HTTPS with certificates included in the extension';
                iconPath = new vscode.ThemeIcon('shield');
                break;
            case serverModel_1.ServerMode.HTTPS_CUSTOM_CERTS:
                tooltip = 'Use HTTPS with custom certificates (you will need to select them)';
                iconPath = new vscode.ThemeIcon('key');
                break;
        }
        super(mode, tooltip, treeProvider_1.TreeItemType.SERVER_MODE, vscode.TreeItemCollapsibleState.None, {
            command: 'codexr.changeServerMode',
            title: 'Change server mode',
            arguments: [mode]
        }, iconPath);
        // If it's the current mode, mark as selected
        if (mode === currentMode) {
            this.description = '✓ Selected';
        }
    }
}
exports.ServerModeItem = ServerModeItem;
/**
 * Item for the active servers container
 */
class ActiveServersContainer extends baseItems_1.TreeItem {
    constructor(count) {
        super(`Active Servers (${count})`, 'Currently running servers', treeProvider_1.TreeItemType.SERVERS_CONTAINER, // Usar la constante en lugar de la cadena literal
        vscode.TreeItemCollapsibleState.Expanded, undefined, new vscode.ThemeIcon('server-environment'));
    }
}
exports.ActiveServersContainer = ActiveServersContainer;
/**
 * Item for an active server
 */
class ActiveServerItem extends baseItems_1.TreeItem {
    constructor(serverInfo) {
        // ✅ USAR NOMBRE PERSONALIZADO SI ES UN ANÁLISIS XR
        const displayName = serverInfo.analysisFileName
            ? `${serverInfo.analysisFileName}: ${serverInfo.port}`
            : path.basename(serverInfo.filePath);
        // ✅ DESCRIPCIÓN PERSONALIZADA PARA ANÁLISIS XR
        const description = serverInfo.analysisFileName
            ? `XR Analysis - ${serverInfo.protocol.toUpperCase()}`
            : serverInfo.url;
        const tooltip = serverInfo.analysisFileName
            ? `XR Analysis Server
File: ${serverInfo.analysisFileName}
Path: ${serverInfo.filePath}
URL: ${serverInfo.url}
Click to see options`
            : `${serverInfo.protocol.toUpperCase()} Server
Path: ${serverInfo.filePath}
URL: ${serverInfo.url}
Click to see options`;
        super(displayName, // ✅ USAR EL NOMBRE PERSONALIZADO
        tooltip, treeProvider_1.TreeItemType.ACTIVE_SERVER, vscode.TreeItemCollapsibleState.None, {
            command: 'codexr.serverOptions',
            title: 'Server Options',
            arguments: [serverInfo]
        }, 
        // ✅ ICONO DIFERENTE PARA ANÁLISIS XR
        serverInfo.analysisFileName
            ? new vscode.ThemeIcon('beaker', new vscode.ThemeColor('charts.purple')) // Icono de análisis
            : new vscode.ThemeIcon(serverInfo.useHttps ? 'shield' : 'globe'));
        this.description = description;
        // ✅ CONTEXT VALUE DIFERENTE PARA ANÁLISIS XR
        this.contextValue = serverInfo.analysisFileName ? 'activeXRAnalysisServer' : 'activeServer';
    }
}
exports.ActiveServerItem = ActiveServerItem;
/**
 * Item to stop all servers when multiple servers are active
 */
class StopAllServersItem extends baseItems_1.TreeItem {
    constructor(serverCount) {
        super(`Stop All Servers (${serverCount})`, `Stop all ${serverCount} running servers at once`, treeProvider_1.TreeItemType.STOP_ALL_SERVERS, vscode.TreeItemCollapsibleState.None, {
            command: 'codexr.stopAllServersFromTree',
            title: 'Stop All Servers',
            arguments: [serverCount]
        }, new vscode.ThemeIcon('debug-stop', new vscode.ThemeColor('list.errorForeground')));
        // Mostrar descripción con el número de servidores
        this.description = `${serverCount} active`;
    }
}
exports.StopAllServersItem = StopAllServersItem;
//# sourceMappingURL=serverItems.js.map