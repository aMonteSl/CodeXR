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
exports.registerServerCommands = registerServerCommands;
const vscode = __importStar(require("vscode"));
const serverCommands_1 = require("../../servers/commands/serverCommands");
/**
 * Registers all server-related commands
 */
function registerServerCommands(context) {
    console.log('SERVER: Registering server commands');
    // Set the extension context for server commands
    (0, serverCommands_1.setExtensionContext)(context);
    // Main server commands
    const configureServerCommand = vscode.commands.registerCommand('codexr.server.configure', serverCommands_1.configureServer);
    const startLocalServerCommand = vscode.commands.registerCommand('codexr.server.launch', serverCommands_1.startLocalServer);
    // Configuration option commands (UI stubs)
    const configureHttpModeCommand = vscode.commands.registerCommand('codexr.server.config.httpMode', serverCommands_1.configureHttpMode);
    const configurePortCommand = vscode.commands.registerCommand('codexr.server.config.port', serverCommands_1.configurePort);
    const toggleAutoOpenCommand = vscode.commands.registerCommand('codexr.server.config.autoOpen', serverCommands_1.toggleAutoOpen);
    const configureOpenModeCommand = vscode.commands.registerCommand('codexr.server.config.openMode', serverCommands_1.configureOpenMode);
    const resetToDefaultCommand = vscode.commands.registerCommand('codexr.server.config.resetToDefault', serverCommands_1.resetToDefault);
    context.subscriptions.push(configureServerCommand, startLocalServerCommand, configureHttpModeCommand, configurePortCommand, toggleAutoOpenCommand, configureOpenModeCommand, resetToDefaultCommand);
    console.log('SERVER: Server commands registered successfully');
}
//# sourceMappingURL=serverCommands.js.map