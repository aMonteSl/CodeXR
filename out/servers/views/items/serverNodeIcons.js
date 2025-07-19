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
exports.ServerNodeIcons = void 0;
const vscode = __importStar(require("vscode"));
/**
 * VS Code icon references for server tree items
 */
exports.ServerNodeIcons = {
    // Main groups
    servers: new vscode.ThemeIcon('server-environment'),
    configuration: new vscode.ThemeIcon('gear'),
    startServer: new vscode.ThemeIcon('play'),
    // Configuration options
    httpMode: new vscode.ThemeIcon('globe'),
    httpModeSecure: new vscode.ThemeIcon('lock'),
    httpModeUnsecure: new vscode.ThemeIcon('unlock'),
    defaultPort: new vscode.ThemeIcon('plug'),
    autoOpen: new vscode.ThemeIcon('eye'),
    openMode: new vscode.ThemeIcon('layout'),
    reset: new vscode.ThemeIcon('discard'),
    // Active servers actions
    stopAll: new vscode.ThemeIcon('stop-circle')
};
//# sourceMappingURL=serverNodeIcons.js.map