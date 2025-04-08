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
exports.ServerTreeProvider = void 0;
const vscode = __importStar(require("vscode"));
const serverManager_1 = require("../serverManager");
const serverModel_1 = require("../models/serverModel");
const certificateManager_1 = require("../certificateManager");
const baseItems_1 = require("../../ui/treeItems/baseItems");
const treeProvider_1 = require("../../ui/treeProvider");
const serverItems_1 = require("../../ui/treeItems/serverItems");
/**
 * Provider for server-related tree items
 */
class ServerTreeProvider {
    context;
    /**
     * Constructor for the Server Tree Provider
     * @param context Extension context for storage
     */
    constructor(context) {
        this.context = context;
    }
    /**
     * Gets child elements of the servers section
     * @returns Tree items for servers section
     */
    getServersChildren() {
        const currentMode = this.context.globalState.get('serverMode') ||
            serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS;
        const defaultCertsExist = (0, certificateManager_1.defaultCertificatesExist)(this.context);
        const activeServers = (0, serverManager_1.getActiveServers)();
        const children = [
            new serverItems_1.ServerConfigItem(this.context, currentMode),
            new serverItems_1.StartServerItem(currentMode, defaultCertsExist)
        ];
        if (activeServers.length > 0) {
            children.push(new serverItems_1.ActiveServersContainer(activeServers.length));
        }
        return Promise.resolve(children);
    }
    /**
     * Gets server configuration options
     * @returns Tree items for server configuration
     */
    getServerConfigChildren() {
        const currentMode = this.context.globalState.get('serverMode');
        return Promise.resolve([
            new serverItems_1.ServerModeItem(serverModel_1.ServerMode.HTTP, this.context),
            new serverItems_1.ServerModeItem(serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS, this.context),
            new serverItems_1.ServerModeItem(serverModel_1.ServerMode.HTTPS_CUSTOM_CERTS, this.context)
        ]);
    }
    /**
     * Gets the list of active servers
     * @returns Tree items for active servers
     */
    getActiveServersChildren() {
        const activeServers = (0, serverManager_1.getActiveServers)();
        return Promise.resolve(activeServers.map(server => new serverItems_1.ActiveServerItem(server)));
    }
    /**
     * Creates a section item for servers
     * @returns Section tree item for servers
     */
    getServersSectionItem() {
        return new baseItems_1.TreeItem("Servers", "Local server management", treeProvider_1.TreeItemType.SERVERS_SECTION, vscode.TreeItemCollapsibleState.Expanded, undefined, new vscode.ThemeIcon('server-environment'));
    }
    /**
     * Changes the server mode
     * @param mode New server mode to set
     * @returns Promise that resolves when mode is changed
     */
    async changeServerMode(mode) {
        console.log('Changing server mode to:', mode);
        if (mode === serverModel_1.ServerMode.HTTP) {
            const selection = await vscode.window.showWarningMessage('HTTP mode is not compatible with virtual reality devices due to security restrictions. ' +
                'Do you want to continue?', 'Yes, I understand', 'Cancel');
            if (selection !== 'Yes, I understand') {
                return;
            }
        }
        // Si el usuario selecciona el modo de certificados personalizados,
        // pedir inmediatamente que seleccione los archivos
        if (mode === serverModel_1.ServerMode.HTTPS_CUSTOM_CERTS) {
            try {
                // Diálogo para seleccionar el archivo de clave privada
                const keyOptions = {
                    canSelectMany: false,
                    openLabel: 'Select private key file (.key or .pem)',
                    filters: { 'Certificates': ['key', 'pem'] }
                };
                console.log('Showing key file picker dialog...');
                const keyUri = await vscode.window.showOpenDialog(keyOptions);
                console.log('Key file picker result:', keyUri);
                if (!keyUri || keyUri.length === 0) {
                    vscode.window.showWarningMessage('No private key file was selected. Mode change cancelled.');
                    return;
                }
                // Diálogo para seleccionar el archivo de certificado
                const certOptions = {
                    canSelectMany: false,
                    openLabel: 'Select certificate file (.cert or .pem)',
                    filters: { 'Certificates': ['cert', 'pem', 'crt'] }
                };
                console.log('Showing certificate file picker dialog...');
                const certUri = await vscode.window.showOpenDialog(certOptions);
                console.log('Certificate file picker result:', certUri);
                if (!certUri || certUri.length === 0) {
                    vscode.window.showWarningMessage('No certificate file was selected. Mode change cancelled.');
                    return;
                }
                // Guardar las rutas de los archivos seleccionados en el contexto
                await this.context.globalState.update('customKeyPath', keyUri[0].fsPath);
                await this.context.globalState.update('customCertPath', certUri[0].fsPath);
                vscode.window.showInformationMessage('Custom certificates have been configured. The server will use these certificates when started.');
            }
            catch (error) {
                console.error('Error selecting certificates:', error);
                vscode.window.showErrorMessage(`Error selecting certificates: ${error instanceof Error ? error.message : String(error)}`);
                return;
            }
        }
        // Actualizar el modo en el contexto global
        await this.context.globalState.update('serverMode', mode);
        console.log('Server mode updated to:', mode);
    }
}
exports.ServerTreeProvider = ServerTreeProvider;
//# sourceMappingURL=serverTreeProvider.js.map