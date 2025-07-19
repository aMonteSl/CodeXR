"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sseManager = exports.SSEManager = void 0;
const sseClientRegistry_1 = require("./sseClientRegistry");
const fileToServerMap_1 = require("../../../utils/fileToServerMap");
/**
 * SSE Manager
 * Central module for managing Server-Sent Events for analysis updates
 */
class SSEManager {
    static instance = null;
    clientRegistry;
    constructor() {
        console.log('[SSE_MANAGER] Initializing SSE manager');
        this.clientRegistry = sseClientRegistry_1.SSEClientRegistry.getInstance();
    }
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!SSEManager.instance) {
            SSEManager.instance = new SSEManager();
        }
        return SSEManager.instance;
    }
    /**
     * Register a new SSE client for a specific analysis file
     * Sets up the SSE connection with proper headers and keep-alive
     *
     * @param fileUri - URI of the analyzed file
     * @param res - HTTP response object
     */
    registerClient(fileUri, res) {
        console.log(`[SSE_MANAGER] Setting up SSE connection for: ${fileUri}`);
        // Set SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        });
        // Send initial connection message
        res.write(`data: ${JSON.stringify({
            type: 'connected',
            fileUri: fileUri,
            timestamp: new Date().toISOString(),
            message: 'SSE connection established for analysis updates'
        })}\n\n`);
        // Register the client
        this.clientRegistry.registerClient(fileUri, res);
        console.log(`[SSE_MANAGER] SSE client registered for: ${fileUri}`);
    }
    /**
     * Unregister an SSE client
     *
     * @param fileUri - URI of the analyzed file
     * @param res - HTTP response object
     */
    unregisterClient(fileUri, res) {
        console.log(`[SSE_MANAGER] Unregistering SSE client for: ${fileUri}`);
        this.clientRegistry.unregisterClient(fileUri, res);
    }
    /**
     * Send an update notification to all clients of a specific analysis file
     * This is called when the data.json file is regenerated
     *
     * @param fileUri - URI of the analyzed file that was updated
     */
    sendUpdate(fileUri) {
        console.log(`REQUEST_UPDATE: Server received update request for file: ${fileUri}`);
        console.log(`[SSE_MANAGER] Sending analysis update for: ${fileUri}`);
        // Debug: Check file-to-server mapping
        const mapping = fileToServerMap_1.fileToServerMap.getServerInfo(fileUri);
        if (mapping) {
            console.log(`REQUEST_UPDATE: Found mapping - Port: ${mapping.port}, TempDir: ${mapping.tempDir}`);
            // Verify data.json exists in the temp directory
            const dataJsonPath = require('path').join(mapping.tempDir, 'data.json');
            const fs = require('fs');
            try {
                const exists = fs.existsSync(dataJsonPath);
                console.log(`REQUEST_UPDATE: data.json exists at ${dataJsonPath}: ${exists}`);
                if (exists) {
                    const stats = fs.statSync(dataJsonPath);
                    console.log(`REQUEST_UPDATE: data.json size: ${stats.size} bytes, modified: ${stats.mtime}`);
                }
            }
            catch (fileError) {
                console.error(`REQUEST_UPDATE: Error checking data.json:`, fileError);
            }
        }
        else {
            console.log(`REQUEST_UPDATE: No mapping found for file: ${fileUri}`);
        }
        const updateMessage = JSON.stringify({
            type: 'analysis-updated',
            fileUri: fileUri,
            timestamp: new Date().toISOString(),
            message: 'Analysis data has been updated, please refresh',
            action: 'reload-data'
        });
        this.clientRegistry.sendToClients(fileUri, updateMessage);
        console.log(`[SSE_MANAGER] Update notification sent for: ${fileUri}`);
        console.log(`REQUEST_UPDATE: Update message dispatched to clients for: ${fileUri}`);
    }
    /**
     * Send a custom message to all clients of a specific analysis file
     *
     * @param fileUri - URI of the analyzed file
     * @param message - Custom message object
     */
    sendCustomMessage(fileUri, message) {
        console.log(`[SSE_MANAGER] Sending custom message for: ${fileUri}`);
        const customMessage = JSON.stringify({
            ...message,
            timestamp: new Date().toISOString()
        });
        this.clientRegistry.sendToClients(fileUri, customMessage);
    }
    /**
     * Send a heartbeat/keep-alive message to all clients of a specific file
     *
     * @param fileUri - URI of the analyzed file
     */
    sendHeartbeat(fileUri) {
        const heartbeatMessage = JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
        });
        this.clientRegistry.sendToClients(fileUri, heartbeatMessage);
    }
    /**
     * Send heartbeat to all active files
     * Useful for maintaining connections
     */
    sendHeartbeatToAll() {
        const activeFiles = this.clientRegistry.getActiveFiles();
        if (activeFiles.length > 0) {
            console.log(`[SSE_MANAGER] Sending heartbeat to ${activeFiles.length} active file(s)`);
            for (const fileUri of activeFiles) {
                this.sendHeartbeat(fileUri);
            }
        }
    }
    /**
     * Get the number of active clients for a specific file
     *
     * @param fileUri - URI of the analyzed file
     * @returns Number of active clients
     */
    getClientCount(fileUri) {
        return this.clientRegistry.getClients(fileUri).length;
    }
    /**
     * Get all file URIs that have active SSE clients
     *
     * @returns Array of file URIs with active clients
     */
    getActiveFiles() {
        return this.clientRegistry.getActiveFiles();
    }
    /**
     * Remove all clients for a specific file
     * Useful when an analysis is stopped or file is deleted
     *
     * @param fileUri - URI of the analyzed file
     */
    removeAllClients(fileUri) {
        console.log(`[SSE_MANAGER] Removing all SSE clients for: ${fileUri}`);
        this.clientRegistry.removeAllClients(fileUri);
    }
    /**
     * Get statistics about active SSE connections
     *
     * @returns Statistics object
     */
    getStats() {
        return this.clientRegistry.getStats();
    }
    /**
     * Clean up all SSE connections
     * Should be called during extension deactivation
     */
    dispose() {
        console.log('[SSE_MANAGER] Disposing SSE manager');
        this.clientRegistry.clearAll();
    }
}
exports.SSEManager = SSEManager;
// Export singleton instance for easy access
exports.sseManager = SSEManager.getInstance();
//# sourceMappingURL=SSEManager.js.map