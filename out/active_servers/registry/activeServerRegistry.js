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
exports.ActiveServerRegistry = void 0;
exports.getActiveServerRegistry = getActiveServerRegistry;
exports.registerActiveServer = registerActiveServer;
const vscode = __importStar(require("vscode"));
/**
 * Active Server Registry
 * Centralized tracking and management of all active servers
 */
class ActiveServerRegistry {
    static instance = null;
    servers = new Map();
    eventEmitter = new vscode.EventEmitter();
    /** Event fired when registry changes */
    onRegistryChange = this.eventEmitter.event;
    constructor() {
        console.log('ACTIVE_SERVERS: Registry initialized');
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!ActiveServerRegistry.instance) {
            ActiveServerRegistry.instance = new ActiveServerRegistry();
        }
        return ActiveServerRegistry.instance;
    }
    /**
     * Register a new active server
     */
    registerServer(config) {
        console.log('SERVER: registerServer called with config:', {
            port: config.port,
            htmlFile: config.htmlFile,
            customName: config.customName,
            url: config.url
        });
        const serverId = this.generateServerId(config.port, config.timestamp);
        const server = {
            id: serverId,
            port: config.port,
            url: config.url,
            launchMode: config.launchMode,
            certMode: config.certMode,
            timestamp: config.timestamp,
            status: 'running',
            htmlFile: config.htmlFile,
            customName: config.customName,
            serverInstance: config.serverInstance,
            metadata: config.metadata
        };
        this.servers.set(serverId, server);
        // Enhanced logging for custom names
        console.log(`ACTIVE_SERVERS: Registered server ${serverId} at ${config.url} (${config.certMode}/${config.launchMode})`);
        if (config.customName && config.customName.trim().length > 0) {
            console.log(`ACTIVE_SERVERS: Received custom name from launcher: ${config.customName}`);
            console.log(`ACTIVE_SERVERS: Registering server with name: ${config.customName}`);
        }
        else {
            const fallbackName = `localhost:${config.port}`;
            console.log(`ACTIVE_SERVERS: No custom name provided. Using default name: ${fallbackName}`);
        }
        this.emitEvent('serverAdded', serverId, server);
        return server;
    }
    /**
     * Remove a server from the registry
     */
    unregisterServer(serverId) {
        const server = this.servers.get(serverId);
        if (!server) {
            console.warn(`ACTIVE_SERVERS: Attempted to unregister non-existent server: ${serverId}`);
            return false;
        }
        this.servers.delete(serverId);
        console.log(`ACTIVE_SERVERS: Unregistered server ${serverId} (${server.url})`);
        this.emitEvent('serverRemoved', serverId, server);
        return true;
    }
    /**
     * Update server status
     */
    updateServerStatus(serverId, status) {
        const server = this.servers.get(serverId);
        if (!server) {
            console.warn(`ACTIVE_SERVERS: Attempted to update status of non-existent server: ${serverId}`);
            return false;
        }
        server.status = status;
        console.log(`ACTIVE_SERVERS: Updated server ${serverId} status to ${status}`);
        this.emitEvent('serverUpdated', serverId, server);
        return true;
    }
    /**
     * Get server by ID
     */
    getServer(serverId) {
        return this.servers.get(serverId);
    }
    /**
     * Get all active servers
     */
    getAllServers() {
        return Array.from(this.servers.values());
    }
    /**
     * Get servers by status
     */
    getServersByStatus(status) {
        return this.getAllServers().filter(server => server.status === status);
    }
    /**
     * Get servers by port
     */
    getServerByPort(port) {
        return this.getAllServers().find(server => server.port === port);
    }
    /**
     * Check if a server is registered
     */
    hasServer(serverId) {
        return this.servers.has(serverId);
    }
    /**
     * Get count of active servers
     */
    getServerCount() {
        return this.servers.size;
    }
    /**
     * Get count of running servers
     */
    getRunningServerCount() {
        return this.getServersByStatus('running').length;
    }
    /**
     * Clear all servers from registry
     */
    clearAll() {
        const count = this.servers.size;
        this.servers.clear();
        console.log(`ACTIVE_SERVERS: Cleared all servers (${count} removed)`);
        this.emitEvent('registryCleared');
    }
    /**
     * Cleanup stopped/error servers
     */
    cleanupInactiveServers() {
        const inactiveServers = this.getAllServers().filter(server => server.status === 'stopped' || server.status === 'error');
        let removedCount = 0;
        for (const server of inactiveServers) {
            if (this.unregisterServer(server.id)) {
                removedCount++;
            }
        }
        if (removedCount > 0) {
            console.log(`ACTIVE_SERVERS: Cleaned up ${removedCount} inactive servers`);
        }
        return removedCount;
    }
    /**
     * Get registry statistics
     */
    getStats() {
        const servers = this.getAllServers();
        const stats = {
            total: servers.length,
            running: 0,
            stopped: 0,
            error: 0,
            byMode: {},
            byCertMode: {}
        };
        for (const server of servers) {
            // Count by status
            stats[server.status]++;
            // Count by launch mode
            stats.byMode[server.launchMode] = (stats.byMode[server.launchMode] || 0) + 1;
            // Count by cert mode
            stats.byCertMode[server.certMode] = (stats.byCertMode[server.certMode] || 0) + 1;
        }
        return stats;
    }
    /**
     * Dispose of the registry
     */
    dispose() {
        this.eventEmitter.dispose();
        this.clearAll();
        console.log('ACTIVE_SERVERS: Registry disposed');
    }
    /**
     * Generate unique server ID
     * @private
     */
    generateServerId(port, timestamp) {
        return `server-${port}-${timestamp}`;
    }
    /**
     * Emit registry event
     * @private
     */
    emitEvent(type, serverId, server) {
        const event = {
            type,
            serverId,
            server,
            timestamp: Date.now()
        };
        this.eventEmitter.fire(event);
    }
}
exports.ActiveServerRegistry = ActiveServerRegistry;
/**
 * Convenience function to get the registry instance
 */
function getActiveServerRegistry() {
    return ActiveServerRegistry.getInstance();
}
/**
 * Convenience function to register a server
 */
function registerActiveServer(config) {
    return getActiveServerRegistry().registerServer(config);
}
//# sourceMappingURL=activeServerRegistry.js.map