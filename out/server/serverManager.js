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
exports.getServerPortStatus = getServerPortStatus;
exports.stopAllServers = stopAllServers;
exports.updateServerDisplayInfo = updateServerDisplayInfo;
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
const portManager_1 = require("./portManager");
const analysisSessionManager_1 = require("../analysis/analysisSessionManager");
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
    try {
        console.log(`🚀 Starting server for: ${selectedFile}`);
        console.log(`🔧 HTTPS: ${useHttps}, Default certs: ${useDefaultCerts}`);
        // Determine mode based on parameters
        let mode;
        if (!useHttps) {
            mode = serverModel_1.ServerMode.HTTP;
        }
        else if (useDefaultCerts) {
            mode = serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS;
        }
        else {
            mode = serverModel_1.ServerMode.HTTPS_CUSTOM_CERTS;
        }
        // Use unified createServer function
        const serverInfo = await createServer(selectedFile, mode, context);
        if (serverInfo) {
            console.log(`✅ Server started successfully: ${serverInfo.url}`);
            // Show initial notification with options
            vscode.window.showInformationMessage(`${serverInfo.protocol.toUpperCase()} server running at ${serverInfo.displayUrl}`, 'Open in browser', 'Stop server').then(selection => {
                if (selection === 'Open in browser') {
                    vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
                }
                else if (selection === 'Stop server') {
                    stopServer(serverInfo.id);
                }
            });
            // Update status bar
            (0, statusBarManager_1.updateStatusBar)(serverInfo);
            // Automatically open the browser
            vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
        }
        else {
            throw new Error('Failed to create server');
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error starting server:`, error);
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
        const serverToStop = activeServer;
        console.log(`🛑 Stopping active server:`, {
            id: serverToStop.info.id,
            url: serverToStop.info.url,
            analysisFileName: serverToStop.info.analysisFileName
        });
        serverToStop.server.close(() => {
            console.log(`✅ Active server closed: ${serverToStop.info.url}`);
        });
        // ✅ Remove analysis session if this server was used for analysis
        const sessionManager = analysisSessionManager_1.AnalysisSessionManager.getInstance();
        const activeSessions = sessionManager.getAllSessions();
        const analysisSession = activeSessions.find(session => (session.analysisType === analysisSessionManager_1.AnalysisType.XR || session.analysisType === analysisSessionManager_1.AnalysisType.DOM) &&
            session.panelRef &&
            session.panelRef.id === serverToStop.info.id);
        if (analysisSession) {
            console.log(`🗑️ Removing ${analysisSession.analysisType} analysis session for: ${analysisSession.filePath}`);
            sessionManager.removeSession(analysisSession.id);
        }
        // Remove from the active servers list
        const index = activeServerList.findIndex(entry => entry.info.id === serverToStop.info.id);
        if (index !== -1) {
            activeServerList.splice(index, 1);
            console.log(`🧹 Removed server from active list: ${serverToStop.info.id}`);
        }
        // Clear active server reference
        exports.activeServer = activeServer = activeServerList.length > 0 ? activeServerList[activeServerList.length - 1] : undefined;
    }
    else if (serverId) {
        // Close specific server by ID
        const serverEntry = activeServerList.find(entry => entry.info.id === serverId);
        if (serverEntry) {
            console.log(`🛑 Stopping specific server:`, {
                id: serverEntry.info.id,
                url: serverEntry.info.url,
                analysisFileName: serverEntry.info.analysisFileName
            });
            serverEntry.server.close(() => {
                console.log(`✅ Specific server closed: ${serverEntry.info.url}`);
            });
            // ✅ Remove analysis session if this server was used for analysis
            const sessionManager = analysisSessionManager_1.AnalysisSessionManager.getInstance();
            const activeSessions = sessionManager.getAllSessions();
            const analysisSession = activeSessions.find(session => (session.analysisType === analysisSessionManager_1.AnalysisType.XR || session.analysisType === analysisSessionManager_1.AnalysisType.DOM) &&
                session.panelRef &&
                session.panelRef.id === serverId);
            if (analysisSession) {
                console.log(`🗑️ Removing ${analysisSession.analysisType} analysis session for: ${analysisSession.filePath}`);
                sessionManager.removeSession(analysisSession.id);
            }
            // Remove from list
            const index = activeServerList.findIndex(entry => entry.info.id === serverId);
            if (index !== -1) {
                activeServerList.splice(index, 1);
                console.log(`🧹 Removed server from active list: ${serverId}`);
            }
            // Update active server reference
            if (activeServer && activeServer.info.id === serverId) {
                exports.activeServer = activeServer = activeServerList.length > 0 ? activeServerList[activeServerList.length - 1] : undefined;
            }
        }
        else {
            console.warn(`⚠️ Server ${serverId} not found for stopping`);
        }
    }
    // ✅ UPDATE: Always refresh UI after stopping servers
    vscode.commands.executeCommand('codexr.refreshTreeView');
    // Update status bar
    if (activeServerList.length === 0) {
        console.log(`📊 All servers stopped, updating status bar`);
    }
    else if (activeServer) {
        console.log(`📊 ${activeServerList.length} servers remaining, active: ${activeServer.info.url}`);
    }
}
/**
 * Main unified function for creating servers
 * Creates and starts a server using the unified port manager
 */
async function createServer(rootPath, mode = serverModel_1.ServerMode.HTTP, context, preferredPort) {
    try {
        console.log(`🚀 Creating server for: ${rootPath}`);
        console.log(`🔧 Mode: ${mode}, Preferred port: ${preferredPort || 'auto'}`);
        // Determine protocol based on mode
        const useHttps = mode !== serverModel_1.ServerMode.HTTP;
        const protocol = useHttps ? 'https' : 'http';
        const useDefaultCerts = mode === serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS;
        // Find free port with port manager
        const serverPort = await portManager_1.portManager.findFreePort(preferredPort, protocol);
        console.log(`✅ Port manager assigned port: ${serverPort} for ${protocol.toUpperCase()}`);
        // Determine the file to serve
        let fileToServe = rootPath;
        const stats = fs.statSync(rootPath);
        if (stats.isDirectory()) {
            fileToServe = path.join(rootPath, 'index.html');
        }
        const fileDir = path.dirname(fileToServe);
        const requestHandler = (0, requestHandler_1.createRequestHandler)(fileDir, fileToServe);
        // Create server based on mode
        let server;
        if (useHttps) {
            const { key, cert } = await (0, certificateManager_1.getCertificates)(context, useDefaultCerts);
            server = https.createServer({ key, cert }, requestHandler);
        }
        else {
            server = http.createServer(requestHandler);
        }
        // Promise with robust port handling
        return new Promise((resolve) => {
            // Reserve port before starting server
            portManager_1.portManager.reservePort(serverPort, 'HTTP/HTTPS Server', `Serving ${path.basename(fileToServe)}`, protocol);
            server.listen(serverPort, () => {
                const serverProtocol = useHttps ? 'https' : 'http';
                const filename = path.basename(fileToServe, path.extname(fileToServe));
                const serverUrl = `${serverProtocol}://localhost:${serverPort}`;
                const displayUrl = `${serverProtocol}://${filename}:${serverPort}`;
                const serverId = `server-${Date.now()}`;
                // Create server info
                const serverInfo = {
                    id: serverId,
                    url: serverUrl,
                    displayUrl: displayUrl,
                    protocol: serverProtocol,
                    port: serverPort,
                    filePath: fileToServe,
                    useHttps,
                    startTime: Date.now()
                    // analysisFileName will be set later if needed
                };
                // Add to active servers
                const serverEntry = { server, info: serverInfo };
                activeServerList.push(serverEntry);
                // Update activeServer
                exports.activeServer = activeServer = serverEntry;
                // Set up cleanup function
                const cleanup = () => {
                    console.log(`🧹 Cleaning up server on port ${serverPort}`);
                    server.close();
                    portManager_1.portManager.releasePort(serverPort);
                    exports.activeServerList = activeServerList = activeServerList.filter(entry => entry.info.id !== serverId);
                    // Update activeServer reference
                    if (activeServer && activeServer.info.id === serverId) {
                        exports.activeServer = activeServer = activeServerList.length > 0 ?
                            activeServerList[activeServerList.length - 1] : undefined;
                    }
                };
                // Register cleanup
                context.subscriptions.push({ dispose: cleanup });
                // Set up file watchers
                // Verify files exist before setting up watchers
                // Set up file watchers ONLY if files exist
                let htmlWatcher;
                let jsonWatcher;
                // Only set up HTML watcher if file exists
                if (fs.existsSync(fileToServe)) {
                    console.log(`📁 Setting up HTML file watcher for: ${fileToServe}`);
                    try {
                        htmlWatcher = fs.watch(fileToServe, () => {
                            console.log(`📁 HTML file changed: ${fileToServe}`);
                            (0, liveReloadManager_1.notifyClients)();
                        });
                    }
                    catch (error) {
                        console.warn(`⚠️ Could not set up HTML file watcher: ${error}`);
                    }
                }
                else {
                    console.log(`⚠️ HTML file does not exist, skipping watcher: ${fileToServe}`);
                }
                // Only set up directory watcher if directory exists
                if (fs.existsSync(fileDir)) {
                    console.log(`📁 Setting up directory watcher for: ${fileDir}`);
                    try {
                        jsonWatcher = fs.watch(fileDir, (eventType, filename) => {
                            if (filename && (filename.endsWith('.json') || filename.endsWith('.csv'))) {
                                console.log(`📁 Data file changed: ${filename} (${eventType})`);
                                console.log(`📁 Full path: ${path.join(fileDir, filename)}`);
                                console.log(`📁 Event type: ${eventType}`);
                                // Skip watcher for data.json files (they are managed by FileWatchManager)
                                if (filename === 'data.json') {
                                    console.log(`📁 Skipping server watcher for data.json - managed by FileWatchManager`);
                                    return;
                                }
                                setTimeout(() => {
                                    console.log(`📡 Sending notification for ${filename}...`);
                                    (0, liveReloadManager_1.notifyClients)();
                                    // Also send specific dataRefresh event
                                    const { notifyClientsDataRefresh } = require('./liveReloadManager');
                                    notifyClientsDataRefresh();
                                    console.log(`📡 Both generic and dataRefresh events sent for ${filename}`);
                                }, 300);
                            }
                        });
                    }
                    catch (error) {
                        console.warn(`⚠️ Could not set up directory watcher: ${error}`);
                    }
                }
                else {
                    console.log(`⚠️ Directory does not exist, skipping watcher: ${fileDir}`);
                }
                // Improved cleanup
                server.on('close', () => {
                    try {
                        if (htmlWatcher) {
                            htmlWatcher.close();
                            console.log('📁 HTML file watcher closed');
                        }
                    }
                    catch (error) {
                        console.warn('Warning: Error closing HTML watcher:', error);
                    }
                    try {
                        if (jsonWatcher) {
                            jsonWatcher.close();
                            console.log('📁 Directory watcher closed');
                        }
                    }
                    catch (error) {
                        console.warn('Warning: Error closing directory watcher:', error);
                    }
                });
                console.log(`✅ Server started successfully on port ${serverPort}`);
                vscode.commands.executeCommand('codexr.refreshView');
                resolve(serverInfo);
            });
            // Enhanced error handling
            server.on('error', (err) => {
                console.error(`❌ Server error on port ${serverPort}:`, err);
                // Release port on error
                portManager_1.portManager.releasePort(serverPort);
                if (err.code === 'EADDRINUSE') {
                    vscode.window.showErrorMessage(`Port ${serverPort} is already in use. The Port Manager will try a different port on next attempt.`);
                }
                else {
                    vscode.window.showErrorMessage(`Error starting server: ${err.message}`);
                }
                resolve(undefined);
            });
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error creating server:`, error);
        vscode.window.showErrorMessage(`Error creating server: ${errorMessage}`);
        return undefined;
    }
}
/**
 * Get port status for UI display
 */
async function getServerPortStatus() {
    return await portManager_1.portManager.getPortStatus();
}
/**
 * Function to stop all servers
 */
function stopAllServers() {
    console.log(`🛑 Stopping all ${activeServerList.length} servers`);
    const serversToStop = [...activeServerList]; // Copy to avoid modifications during iteration
    serversToStop.forEach(serverEntry => {
        stopServer(serverEntry.info.id);
    });
    // Clear references
    exports.activeServerList = activeServerList = [];
    exports.activeServer = activeServer = undefined;
    console.log('✅ All servers stopped');
}
/**
 * ✅ ENHANCED: Updates server info for analysis servers with better tracking
 * @param serverId Server ID to update
 * @param updates Partial server info updates
 * @returns true if server was found and updated, false otherwise
 */
function updateServerDisplayInfo(serverId, updates) {
    const serverEntry = activeServerList.find(entry => entry.info.id === serverId);
    if (serverEntry) {
        // ✅ UPDATE: Apply all updates to server info
        Object.assign(serverEntry.info, updates);
        console.log(`✅ Updated server info for ${serverId}:`, {
            url: serverEntry.info.url,
            displayUrl: serverEntry.info.displayUrl,
            analysisFileName: serverEntry.info.analysisFileName,
            filePath: serverEntry.info.filePath
        });
        // ✅ UPDATE: Update active server reference if this is the active one
        if (activeServer && activeServer.info.id === serverId) {
            exports.activeServer = activeServer = serverEntry;
        }
        // ✅ UPDATE: Refresh tree view to show changes
        const treeDataProvider = global.treeDataProvider;
        if (treeDataProvider && typeof treeDataProvider.refresh === 'function') {
            treeDataProvider.refresh();
        }
        return true;
    }
    else {
        console.warn(`⚠️ Server ${serverId} not found for update`);
        return false;
    }
}
//# sourceMappingURL=serverManager.js.map