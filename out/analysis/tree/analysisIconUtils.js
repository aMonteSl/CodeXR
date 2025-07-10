"use strict";
/**
 * Shared utilities for analysis tree item icons and formatting
 * Centralizes the logic for determining icons and display formatting for analyses
 */
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
exports.ServerDisplayUtils = void 0;
exports.getAnalysisIcon = getAnalysisIcon;
exports.getAnalysisDescription = getAnalysisDescription;
exports.isXRAnalysis = isXRAnalysis;
const vscode = __importStar(require("vscode"));
const analysisSessionManager_1 = require("../analysisSessionManager");
/**
 * Get the appropriate icon for an analysis session
 * @param session Analysis session
 * @returns VS Code theme icon with appropriate color
 */
function getAnalysisIcon(session) {
    switch (session.analysisType) {
        case analysisSessionManager_1.AnalysisType.XR:
            // 📄 Purple file icon for XR File analysis
            return new vscode.ThemeIcon('file-code', new vscode.ThemeColor('charts.purple'));
        case analysisSessionManager_1.AnalysisType.STATIC:
            // 📄 Green file icon for Static File analysis
            return new vscode.ThemeIcon('file-code', new vscode.ThemeColor('charts.green'));
        case analysisSessionManager_1.AnalysisType.DOM:
            return new vscode.ThemeIcon('browser', new vscode.ThemeColor('charts.orange'));
        case analysisSessionManager_1.AnalysisType.DIRECTORY:
            // Determine if this is XR or Static directory analysis based on metadata
            const isXRDirectory = session.metadata?.visualizationType === 'xr';
            if (isXRDirectory) {
                // 📁 Purple folder icon for XR Directory analysis
                return new vscode.ThemeIcon('folder', new vscode.ThemeColor('charts.purple'));
            }
            else {
                // 📁 Green folder icon for Static Directory analysis
                return new vscode.ThemeIcon('folder', new vscode.ThemeColor('charts.green'));
            }
        default:
            return new vscode.ThemeIcon('file-code');
    }
}
/**
 * Get description text for an analysis session
 * @param session Analysis session
 * @returns Description string
 */
function getAnalysisDescription(session) {
    let description = `${session.analysisType} Analysis`;
    if (session.analysisType === analysisSessionManager_1.AnalysisType.DIRECTORY && session.metadata?.mode === 'deep') {
        description = `${session.analysisType} Analysis (deep)`;
    }
    return description;
}
/**
 * Determine if an analysis session is XR-based
 * @param session Analysis session
 * @returns true if XR analysis, false otherwise
 */
function isXRAnalysis(session) {
    return session.analysisType === analysisSessionManager_1.AnalysisType.XR ||
        (session.analysisType === analysisSessionManager_1.AnalysisType.DIRECTORY && session.metadata?.visualizationType === 'xr');
}
/**
 * Server display formatting utilities
 */
var ServerDisplayUtils;
(function (ServerDisplayUtils) {
    /**
     * Format server display name for XR analysis servers
     * @param analysisFileName Analysis file name (may have DIR: prefix for directories)
     * @param port Server port
     * @returns Formatted display name
     */
    function formatXRServerDisplayName(analysisFileName, port) {
        if (analysisFileName.startsWith('DIR:')) {
            // Directory XR analysis: show directoryName: port (no extra emoji or parentheses)
            const dirName = analysisFileName.substring(4); // Remove 'DIR:' prefix
            return `${dirName}: ${port}`;
        }
        else {
            // File XR analysis: show filename: port (existing format)
            return `${analysisFileName}: ${port}`;
        }
    }
    ServerDisplayUtils.formatXRServerDisplayName = formatXRServerDisplayName;
    /**
     * Check if server is XR analysis server
     * @param analysisFileName Analysis file name from server info
     * @returns true if XR analysis server
     */
    function isXRAnalysisServer(analysisFileName) {
        return analysisFileName !== undefined;
    }
    ServerDisplayUtils.isXRAnalysisServer = isXRAnalysisServer;
})(ServerDisplayUtils || (exports.ServerDisplayUtils = ServerDisplayUtils = {}));
//# sourceMappingURL=analysisIconUtils.js.map