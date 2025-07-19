"use strict";
/**
 * Server Runtime Module
 *
 * This module provides the complete server runtime infrastructure for the CodeXR extension.
 * It includes HTTP/HTTPS servers, port management, and a unified launcher system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiServerLauncher = exports.PortManager = exports.HttpsCustomServer = exports.HttpsDefaultServer = exports.HttpServer = void 0;
exports.createServerLauncher = createServerLauncher;
exports.launchServerWithFile = launchServerWithFile;
exports.isPortAvailable = isPortAvailable;
exports.findAvailablePort = findAvailablePort;
exports.getSuggestedPorts = getSuggestedPorts;
// Core server implementations
var httpServer_1 = require("./httpServer");
Object.defineProperty(exports, "HttpServer", { enumerable: true, get: function () { return httpServer_1.HttpServer; } });
var httpsDefaultServer_1 = require("./httpsDefaultServer");
Object.defineProperty(exports, "HttpsDefaultServer", { enumerable: true, get: function () { return httpsDefaultServer_1.HttpsDefaultServer; } });
var httpsCustomServer_1 = require("./httpsCustomServer");
Object.defineProperty(exports, "HttpsCustomServer", { enumerable: true, get: function () { return httpsCustomServer_1.HttpsCustomServer; } });
// Utility classes
var portManager_1 = require("./portManager");
Object.defineProperty(exports, "PortManager", { enumerable: true, get: function () { return portManager_1.PortManager; } });
// Main launcher and types
var multiServerLauncher_1 = require("./multiServerLauncher");
Object.defineProperty(exports, "MultiServerLauncher", { enumerable: true, get: function () { return multiServerLauncher_1.MultiServerLauncher; } });
// Import for use in utility functions
const multiServerLauncher_2 = require("./multiServerLauncher");
const portManager_2 = require("./portManager");
/**
 * Create a new multi-server launcher instance
 * @param context - VS Code extension context
 * @returns MultiServerLauncher instance
 */
function createServerLauncher(context) {
    return new multiServerLauncher_2.MultiServerLauncher(context);
}
/**
 * Launch server with a specific HTML file
 * @param context - VS Code extension context
 * @param htmlFilePath - Path to HTML file to serve
 * @param customName - Optional custom display name for the server
 * @returns Promise<MultiServerLaunchResult>
 */
async function launchServerWithFile(context, htmlFilePath, customName) {
    const launcher = new multiServerLauncher_2.MultiServerLauncher(context);
    return launcher.launchServer(htmlFilePath, customName);
}
/**
 * Utility function to check if a port is available
 * @param port - Port number to check
 * @returns Promise<boolean> - True if port is available
 */
async function isPortAvailable(port) {
    return portManager_2.PortManager.isPortAvailable(port);
}
/**
 * Utility function to find an available port
 * @param startPort - Port to start searching from
 * @param endPort - Maximum port to check (optional)
 * @returns Promise<number> - First available port found
 */
async function findAvailablePort(startPort, endPort) {
    return portManager_2.PortManager.findAvailablePort(startPort, endPort);
}
/**
 * Get suggested ports for a service type
 * @param serviceType - Type of service ('http', 'https', 'dev')
 * @returns number[] - Array of suggested ports
 */
function getSuggestedPorts(serviceType) {
    return portManager_2.PortManager.getSuggestedPorts(serviceType);
}
//# sourceMappingURL=index.js.map