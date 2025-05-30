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
exports.activeServer = exports.activeServerList = void 0;
exports.getActiveServers = getActiveServers;
exports.startServer = startServer;
exports.stopServer = stopServer;
exports.createServer = createServer;
const vscode = __importStar(require("vscode"));
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const serverModel_1 = require("./models/serverModel");
// Fix 1: Use relative path from src root to avoid module resolution issues
const certificateManager_1 = require("../server/certificateManager");
const requestHandler_1 = require("../server/requestHandler");
const liveReloadManager_1 = require("../server/liveReloadManager");
const statusBarManager_1 = require("../ui/statusBarManager");
// List to store all server instances
let activeServerList = [];
exports.activeServerList = activeServerList;
// Variable to track the most recent server
let activeServer;
/**
 * Gets all active servers
 * @returns Array of active servers
 */
function getActiveServers() {
    return activeServerList.map(entry => entry.info);
}
/**
 * Starts an HTTP or HTTPS local server that serves an HTML file
 * with live reload capability
 *
 * @param selectedFile - Full path to the main HTML file to serve
 * @param context - Extension context to register resources that need cleanup
 * @param useHttps - If true, will use HTTPS instead of HTTP
 * @param useDefaultCerts - If true, will use default certificates instead of custom ones
 */
async function startServer(selectedFile, context, useHttps = false, useDefaultCerts = true) {
    // Get the directory where the selected HTML file is located
    const fileDir = path.dirname(selectedFile);
    // Dynamic import of get-port (ESM module)
    const getPortModule = await import('get-port');
    const getPort = getPortModule.default;
    // Find a free port in the range 3000-3100 for the server
    const port = await getPort({ port: [...Array(101).keys()].map(i => i + 3000) });
    // Create request handler (common for HTTP and HTTPS)
    const requestHandler = (0, requestHandler_1.createRequestHandler)(fileDir, selectedFile);
    // Create HTTP or HTTPS server based on the chosen option
    let server;
    try {
        if (useHttps) {
            const { key, cert } = await (0, certificateManager_1.getCertificates)(context, useDefaultCerts);
            // Create HTTPS server with certificates
            server = https.createServer({ key, cert }, requestHandler);
        }
        else {
            server = http.createServer(requestHandler);
        }
        // Watch for changes in the HTML file to notify SSE clients
        const htmlWatcher = fs.watch(selectedFile, (eventType, filename) => {
            (0, liveReloadManager_1.notifyClients)();
        });
        // Watch for changes in JSON files in the same directory
        const jsonWatcher = fs.watch(fileDir, (eventType, filename) => {
            // Check if the modified file is a JSON
            if (filename && (filename.endsWith('.json') || filename.endsWith('.csv'))) {
                // Wait a brief moment to ensure the file write is complete
                setTimeout(() => {
                    (0, liveReloadManager_1.notifyClients)();
                }, 300);
            }
        });
        // Register both watchers for cleanup
        context.subscriptions.push({
            dispose: () => {
                htmlWatcher.close();
                jsonWatcher.close();
            }
        });
        // Start the server on the selected port
        server.listen(port, () => {
            const protocol = useHttps ? 'https' : 'http';
            // Extract the filename without extension for use in the URL display
            const filename = path.basename(selectedFile, path.extname(selectedFile));
            // The actual URL will still use localhost, but the display will include the filename
            const serverUrl = `${protocol}://localhost:${port}`;
            const displayUrl = `${protocol}://${filename}:${port}`;
            // Create a unique ID for this server
            const serverId = `server-${Date.now()}`;
            // Server information
            const serverInfo = {
                id: serverId,
                url: serverUrl,
                displayUrl: displayUrl, // Add a new field for display purposes
                protocol,
                port,
                filePath: selectedFile,
                useHttps,
                startTime: Date.now()
            };
            // Create an entry for the new server
            const serverEntry = {
                server,
                info: serverInfo
            };
            // Save as active server and add to the list
            exports.activeServer = activeServer = serverEntry;
            activeServerList.push(serverEntry);
            // Notify that there's a new server to update the UI
            vscode.commands.executeCommand('codexr.refreshView');
            // Show initial notification with options
            vscode.window.showInformationMessage(`${protocol.toUpperCase()} server running at ${displayUrl}`, 'Open in browser', 'Stop server').then(selection => {
                if (selection === 'Open in browser') {
                    vscode.env.openExternal(vscode.Uri.parse(serverUrl));
                }
                else if (selection === 'Stop server') {
                    // Fixed: pass the specific ID of the current server
                    stopServer(serverId);
                }
            });
            // Update status bar using the new module with the display URL
            (0, statusBarManager_1.updateStatusBar)(serverInfo);
            // Automatically open the browser with the actual server URL
            vscode.env.openExternal(vscode.Uri.parse(serverUrl));
        });
        // Register a disposable to close the server when the extension is deactivated
        context.subscriptions.push({
            dispose: () => {
                stopServer();
            }
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Error starting server: ${errorMessage}`);
    }
}
/**
 * Stops the active server and cleans up associated resources
 * @param serverId Optional ID of the specific server to stop
 */
function stopServer(serverId) {
    if (!serverId && activeServer) {
        // Close the active server
        activeServer.server.close(() => {
            vscode.window.showInformationMessage('Server stopped successfully');
        });
        // Remove from the active servers list
        exports.activeServerList = activeServerList = activeServerList.filter(entry => entry.info.id !== activeServer?.info.id);
        // Update the active server reference (if any)
        exports.activeServer = activeServer = activeServerList.length > 0 ?
            activeServerList[activeServerList.length - 1] : undefined;
    }
    else if (serverId) {
        // Find server by ID
        const serverEntryIndex = activeServerList.findIndex(entry => entry.info.id === serverId);
        if (serverEntryIndex >= 0) {
            const serverEntry = activeServerList[serverEntryIndex];
            // Close the server to free the port
            serverEntry.server.close(() => {
                vscode.window.showInformationMessage(`Server ${serverEntry.info.url} stopped successfully`);
            });
            // Update active server reference if needed
            if (activeServer && activeServer.info.id === serverId) {
                exports.activeServer = activeServer = undefined;
            }
            // Remove from the list
            activeServerList.splice(serverEntryIndex, 1);
            // If servers remain, set the last one as active
            if (activeServerList.length > 0 && !activeServer) {
                exports.activeServer = activeServer = activeServerList[activeServerList.length - 1];
            }
        }
    }
    // Update UI
    vscode.commands.executeCommand('codexr.refreshView');
    // Update status bar using the new module
    if (activeServerList.length === 0) {
        (0, statusBarManager_1.disposeStatusBar)();
    }
    else {
        (0, statusBarManager_1.updateStatusBar)(activeServerList[activeServerList.length - 1].info);
    }
}
/**
 * Creates and starts a server
 * @param rootPath Root path of files to serve
 * @param mode Server mode
 * @param context Extension context
 * @param port Optional port to use (if not specified, a free port will be found)
 * @returns Server info or undefined on error
 */
async function createServer(rootPath, mode = serverModel_1.ServerMode.HTTP, context, port) {
    try {
        // Use provided port or find a free one
        const serverPort = port || await findFreePort();
        // Determine the file to serve (use index.html if rootPath is a directory)
        let fileToServe = rootPath;
        const stats = fs.statSync(rootPath);
        if (stats.isDirectory()) {
            fileToServe = path.join(rootPath, 'index.html');
        }
        // Get the directory where the file is located
        const fileDir = path.dirname(fileToServe);
        // Create request handler
        const requestHandler = (0, requestHandler_1.createRequestHandler)(fileDir, fileToServe);
        // Create HTTP or HTTPS server based on the mode
        let server;
        // Choose protocol based on mode
        const useHttps = mode !== serverModel_1.ServerMode.HTTP;
        const useDefaultCerts = mode === serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS;
        if (useHttps) {
            const { key, cert } = await (0, certificateManager_1.getCertificates)(context, useDefaultCerts);
            server = https.createServer({ key, cert }, requestHandler);
        }
        else {
            server = http.createServer(requestHandler);
        }
        // Create a promise to handle server startup
        return new Promise((resolve) => {
            server.listen(serverPort, () => {
                const protocol = useHttps ? 'https' : 'http';
                // Extract filename without extension for display
                const filename = path.basename(fileToServe, path.extname(fileToServe));
                // Create server URLs
                const serverUrl = `${protocol}://localhost:${serverPort}`;
                const displayUrl = `${protocol}://${filename}:${serverPort}`;
                // Create server ID
                const serverId = `server-${Date.now()}`;
                // Create server info
                const serverInfo = {
                    id: serverId,
                    url: serverUrl,
                    displayUrl: displayUrl,
                    protocol,
                    port: serverPort,
                    filePath: fileToServe,
                    useHttps,
                    startTime: Date.now()
                };
                // Create server entry and add to active servers
                const serverEntry = {
                    server,
                    info: serverInfo
                };
                activeServerList.push(serverEntry);
                // Set up file watchers
                const htmlWatcher = fs.watch(fileToServe, () => (0, liveReloadManager_1.notifyClients)());
                const jsonWatcher = fs.watch(fileDir, (eventType, filename) => {
                    if (filename && (filename.endsWith('.json') || filename.endsWith('.csv'))) {
                        setTimeout(() => (0, liveReloadManager_1.notifyClients)(), 300);
                    }
                });
                // Register watchers for cleanup
                context.subscriptions.push({
                    dispose: () => {
                        htmlWatcher.close();
                        jsonWatcher.close();
                    }
                });
                // Register server for cleanup
                context.subscriptions.push({
                    dispose: () => {
                        server.close();
                        exports.activeServerList = activeServerList = activeServerList.filter(entry => entry.info.id !== serverId);
                    }
                });
                // Refresh the UI
                vscode.commands.executeCommand('codexr.refreshView');
                // Resolve with the server info
                resolve(serverInfo);
            });
            // Handle potential server setup errors
            server.on('error', (err) => {
                vscode.window.showErrorMessage(`Error starting server: ${err.message}`);
                resolve(undefined);
            });
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Error creating server: ${errorMessage}`);
        return undefined;
    }
}
/**
 * Finds a free port in the range 3000-3100
 * @returns A free port number
 */
async function findFreePort() {
    try {
        // Dynamic import of get-port (ESM module)
        const getPortModule = await import('get-port');
        const getPort = getPortModule.default;
        // Find a free port in the range 3000-3100 for the server
        return await getPort({ port: [...Array(101).keys()].map(i => i + 3000) });
    }
    catch (error) {
        console.error('Error finding free port:', error);
        // Return a fallback port if get-port fails
        return 3000;
    }
}
//# sourceMappingURL=serverManager.js.map