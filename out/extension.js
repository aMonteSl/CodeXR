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
const vscode = __importStar(require("vscode"));
const server_1 = require("./server");
const treeProvider_1 = require("./treeProvider");
function activate(context) {
    console.log('La extensión "first-vscode-extension" está activa.');
    // Registro del comando para iniciar el servidor local
    const startServerCommand = vscode.commands.registerCommand('first-vscode-extension.startLocalServer', async () => {
        const options = {
            canSelectMany: false,
            openLabel: 'Selecciona un archivo HTML',
            filters: { 'HTML': ['html', 'htm'] }
        };
        const fileUri = await vscode.window.showOpenDialog(options);
        if (!fileUri || fileUri.length === 0) {
            vscode.window.showErrorMessage('No se seleccionó ningún archivo HTML.');
            return;
        }
        const selectedFile = fileUri[0].fsPath;
        // Inicia el servidor pasando el archivo seleccionado y el contexto
        await (0, server_1.startServer)(selectedFile, context);
    });
    context.subscriptions.push(startServerCommand);
    // Registro del TreeDataProvider para la vista lateral
    const treeDataProvider = new treeProvider_1.LocalServerProvider();
    vscode.window.registerTreeDataProvider('localServerView', treeDataProvider);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map