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
exports.handleHttpModeClick = handleHttpModeClick;
exports.handlePortClick = handlePortClick;
exports.handleAutoOpenClick = handleAutoOpenClick;
exports.handleOpenModeClick = handleOpenModeClick;
const vscode = __importStar(require("vscode"));
const configurationItems_1 = require("../items/configurationItems");
/**
 * Handle HTTP Mode configuration click
 */
async function handleHttpModeClick() {
    console.log('SERVER: HTTP Mode configuration clicked');
    const options = [
        'HTTP',
        'HTTPS (default certificates)',
        'HTTPS (custom certificates)'
    ];
    const selected = await vscode.window.showQuickPick(options, {
        placeHolder: 'Select HTTP mode',
        canPickMany: false
    });
    if (selected) {
        // Handle HTTP mode selection with confirmation dialog
        if (selected === 'HTTP') {
            const confirmed = await vscode.window.showWarningMessage('HTTP is not secure and XR features like VR will not work. Are you sure you want to proceed?', { modal: true }, 'Yes', 'No');
            if (confirmed !== 'Yes') {
                console.log('SERVER: HTTP mode selection cancelled by user');
                return;
            }
            console.log('SERVER: HTTP mode confirmed by user');
        }
        // Handle HTTPS with custom certificates
        if (selected === 'HTTPS (custom certificates)') {
            console.log('SERVER: HTTPS custom certificates selected, opening file pickers');
            // First: Select certificate file (cert.pem)
            const certFileUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'Certificate files': ['pem', 'crt', 'cert']
                },
                openLabel: 'Select Certificate File (cert.pem)'
            });
            if (!certFileUri || certFileUri.length === 0) {
                console.log('SERVER: Certificate file selection cancelled');
                return;
            }
            const certPath = certFileUri[0].fsPath;
            console.log(`SERVER: Certificate file selected: ${certPath}`);
            // Second: Select private key file (key.pem)
            const keyFileUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'Key files': ['pem', 'key']
                },
                openLabel: 'Select Private Key File (key.pem)'
            });
            if (!keyFileUri || keyFileUri.length === 0) {
                console.log('SERVER: Private key file selection cancelled');
                return;
            }
            const keyPath = keyFileUri[0].fsPath;
            console.log(`SERVER: Private key file selected: ${keyPath}`);
            console.log(`SERVER: Custom certificate configuration - Cert: ${certPath}, Key: ${keyPath}`);
            // Store the custom certificate configuration in a single update
            await (0, configurationItems_1.updateServerConfig)({
                httpMode: selected,
                customCertPath: certPath,
                customKeyPath: keyPath
            });
            console.log(`SERVER: HTTP mode changed to ${selected} with custom certificates`);
            vscode.window.showInformationMessage(`SERVER: HTTPS mode updated with custom certificates`);
        }
        else {
            // Handle HTTP and HTTPS with default certificates
            await (0, configurationItems_1.updateServerConfig)({ httpMode: selected });
            console.log(`SERVER: HTTP mode changed to ${selected}`);
            vscode.window.showInformationMessage(`SERVER: HTTP mode updated to ${selected}`);
        }
    }
}
/**
 * Handle Default Port configuration click
 */
async function handlePortClick() {
    console.log('SERVER: Port configuration clicked');
    const input = await vscode.window.showInputBox({
        prompt: 'Enter port number (3000-8080)',
        placeHolder: '3000',
        validateInput: (value) => {
            const num = parseInt(value);
            if (isNaN(num)) {
                return 'Please enter a valid number';
            }
            if (num < 3000 || num > 8080) {
                return 'Port must be between 3000 and 8080';
            }
            return null;
        }
    });
    if (input) {
        const port = parseInt(input);
        await (0, configurationItems_1.updateServerConfig)({ port });
        console.log(`SERVER: Port changed to ${port}`);
        vscode.window.showInformationMessage(`SERVER: Port updated to ${port}`);
    }
}
/**
 * Handle Auto-Open toggle click
 */
async function handleAutoOpenClick() {
    console.log('SERVER: Auto-Open toggle clicked');
    const currentConfig = (0, configurationItems_1.getServerConfig)();
    const newValue = !currentConfig.autoOpen;
    await (0, configurationItems_1.updateServerConfig)({ autoOpen: newValue });
    console.log(`SERVER: Auto-Open toggled to ${newValue ? 'Yes' : 'No'}`);
    const message = newValue ? 'Auto-Open enabled' : 'Auto-Open disabled';
    vscode.window.showInformationMessage(`SERVER: ${message}`);
}
/**
 * Handle Open Mode configuration click
 */
async function handleOpenModeClick() {
    console.log('SERVER: Open Mode configuration clicked');
    const currentConfig = (0, configurationItems_1.getServerConfig)();
    const newMode = currentConfig.openMode === 'Browser' ? 'Lateral Panel' : 'Browser';
    await (0, configurationItems_1.updateServerConfig)({ openMode: newMode });
    console.log(`SERVER: Open Mode changed to ${newMode}`);
    vscode.window.showInformationMessage(`SERVER: Open Mode set to ${newMode}`);
}
//# sourceMappingURL=handleConfigurationClicks.js.map