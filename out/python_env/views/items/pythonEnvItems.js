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
exports.PythonEnvItems = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Tree item factory for Python environment UI elements
 * Currently placeholder for future UI integration
 */
class PythonEnvItems {
    /**
     * Create tree items for Python environment status (future UI feature)
     */
    static createEnvironmentStatusItems() {
        // Placeholder for future tree view items
        console.log('PYTHON_ENV: PythonEnvItems placeholder - no UI implemented yet');
        return [];
    }
    /**
     * Create icons for Python environment status
     */
    static getEnvironmentIcon(isValid) {
        return isValid
            ? new vscode.ThemeIcon('check', new vscode.ThemeColor('terminal.ansiGreen'))
            : new vscode.ThemeIcon('error', new vscode.ThemeColor('terminal.ansiRed'));
    }
    /**
     * Get appropriate context value for environment status
     */
    static getEnvironmentContextValue(exists, isValid) {
        if (!exists) {
            return 'pythonEnv.notExists';
        }
        return isValid ? 'pythonEnv.valid' : 'pythonEnv.invalid';
    }
}
exports.PythonEnvItems = PythonEnvItems;
//# sourceMappingURL=pythonEnvItems.js.map