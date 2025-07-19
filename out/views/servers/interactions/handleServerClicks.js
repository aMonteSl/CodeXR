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
exports.ServerClickHandler = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Handle server-related click interactions
 */
class ServerClickHandler {
    /**
     * Handle configuration group expansion
     */
    static async handleConfigGroupClick(item) {
        console.log('SERVERS: Configuration group clicked, expanding...');
        // Configuration groups are handled automatically by tree expansion
        // Additional logic can be added here if needed
    }
    /**
     * Handle server launch option click
     */
    static async handleLaunchServerClick() {
        console.log('SERVERS: Start Local Server clicked');
        try {
            // Execute the server launch command
            await vscode.commands.executeCommand('codexr.server.launch');
            console.log('SERVERS: Server launch command executed successfully');
        }
        catch (error) {
            console.error('SERVERS: Error launching server:', error);
            vscode.window.showErrorMessage(`Failed to launch server: ${error}`);
        }
    }
    /**
     * Handle configuration option clicks
     */
    static async handleConfigOptionClick(optionType) {
        console.log(`SERVERS: Configuration option clicked: ${optionType}`);
        switch (optionType) {
            case 'http':
            case 'httpMode':
                await vscode.commands.executeCommand('codexr.server.config.httpMode');
                break;
            case 'port':
                await vscode.commands.executeCommand('codexr.server.config.port');
                break;
            case 'autoOpen':
                await vscode.commands.executeCommand('codexr.server.config.autoOpen');
                break;
            case 'openMode':
                await vscode.commands.executeCommand('codexr.server.config.openMode');
                break;
            case 'reset':
                await vscode.commands.executeCommand('codexr.server.config.resetToDefault');
                break;
            default:
                console.warn(`SERVERS: Unknown configuration option: ${optionType}`);
        }
    }
}
exports.ServerClickHandler = ServerClickHandler;
//# sourceMappingURL=handleServerClicks.js.map