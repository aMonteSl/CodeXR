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
exports.register = register;
exports.getPythonEnvCommands = getPythonEnvCommands;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const pythonEnvCommands_1 = require("./commands/pythonEnvCommands");
/**
 * Entry point for the Python environment module
 */
let pythonEnvCommands;
/**
 * Register Python environment functionality
 */
function register(context) {
    console.log('PYTHON_ENV: Registering Python environment module...');
    try {
        // Initialize commands
        pythonEnvCommands = new pythonEnvCommands_1.PythonEnvCommands(context);
        pythonEnvCommands.register(context);
        // Initialize environment on startup
        pythonEnvCommands.initializeOnStartup()
            .then(() => {
            console.log('PYTHON_ENV: Module registration and initialization completed successfully');
        })
            .catch((error) => {
            console.error('PYTHON_ENV: Initialization failed during registration:', error);
        });
        console.log('PYTHON_ENV: Python environment module registered successfully');
    }
    catch (error) {
        console.error('PYTHON_ENV: Failed to register Python environment module:', error);
        vscode.window.showErrorMessage(`Failed to initialize Python environment module: ${error}`);
    }
}
/**
 * Get the PythonEnvCommands instance for external access
 */
function getPythonEnvCommands() {
    return pythonEnvCommands;
}
/**
 * Clean up resources when extension is deactivated
 */
function deactivate() {
    console.log('PYTHON_ENV: Deactivating Python environment module');
    pythonEnvCommands = undefined;
}
//# sourceMappingURL=index.js.map