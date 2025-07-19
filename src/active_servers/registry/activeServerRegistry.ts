import * as vscode from 'vscode';
import * as path from 'path';
import { ActiveServer, RegistryEvent, RegistryEventType, LaunchMode, CertMode } from '../model/activeServerModel';

/**
 * Active Server Registry
 * Centralized tracking and management of all active servers
 */
export class ActiveServerRegistry {
    private static instance: ActiveServerRegistry | null = null;
    private servers: Map<string, ActiveServer> = new Map();
    private eventEmitter: vscode.EventEmitter<RegistryEvent> = new vscode.EventEmitter<RegistryEvent>();
    
    /** Event fired when registry changes */
    public readonly onRegistryChange: vscode.Event<RegistryEvent> = this.eventEmitter.event;

    private constructor() {
        console.log('ACTIVE_SERVERS: Registry initialized');
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): ActiveServerRegistry {
        if (!ActiveServerRegistry.instance) {
            ActiveServerRegistry.instance = new ActiveServerRegistry();
        }
        return ActiveServerRegistry.instance;
    }

    /**
     * Register a new active server
     */
    public registerServer(config: {
        port: number;
        url: string;
        launchMode: LaunchMode;
        certMode: CertMode;
        timestamp: number;
        htmlFile?: string;
        customName?: string;
        serverInstance?: any;
        metadata?: any;
    }): ActiveServer {
        console.log('SERVER: registerServer called with config:', {
            port: config.port,
            htmlFile: config.htmlFile,
            customName: config.customName,
            url: config.url
        });
        
        const serverId = this.generateServerId(config.port, config.timestamp);
        
        const server: ActiveServer = {
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
        } else {
            const fallbackName = `localhost:${config.port}`;
            console.log(`ACTIVE_SERVERS: No custom name provided. Using default name: ${fallbackName}`);
        }
        
        this.emitEvent('serverAdded', serverId, server);
        
        return server;
    }

    /**
     * Remove a server from the registry
     */
    public unregisterServer(serverId: string): boolean {
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
    public updateServerStatus(serverId: string, status: 'running' | 'stopped' | 'error'): boolean {
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
    public getServer(serverId: string): ActiveServer | undefined {
        return this.servers.get(serverId);
    }

    /**
     * Get all active servers
     */
    public getAllServers(): ActiveServer[] {
        return Array.from(this.servers.values());
    }

    /**
     * Get servers by status
     */
    public getServersByStatus(status: 'running' | 'stopped' | 'error'): ActiveServer[] {
        return this.getAllServers().filter(server => server.status === status);
    }

    /**
     * Get servers by port
     */
    public getServerByPort(port: number): ActiveServer | undefined {
        return this.getAllServers().find(server => server.port === port);
    }

    /**
     * Check if a server is registered
     */
    public hasServer(serverId: string): boolean {
        return this.servers.has(serverId);
    }

    /**
     * Get count of active servers
     */
    public getServerCount(): number {
        return this.servers.size;
    }

    /**
     * Get count of running servers
     */
    public getRunningServerCount(): number {
        return this.getServersByStatus('running').length;
    }

    /**
     * Clear all servers from registry
     */
    public clearAll(): void {
        const count = this.servers.size;
        this.servers.clear();
        
        console.log(`ACTIVE_SERVERS: Cleared all servers (${count} removed)`);
        
        this.emitEvent('registryCleared');
    }

    /**
     * Cleanup stopped/error servers
     */
    public cleanupInactiveServers(): number {
        const inactiveServers = this.getAllServers().filter(server => 
            server.status === 'stopped' || server.status === 'error'
        );

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
    public getStats(): {
        total: number;
        running: number;
        stopped: number;
        error: number;
        byMode: { [mode: string]: number };
        byCertMode: { [mode: string]: number };
    } {
        const servers = this.getAllServers();
        
        const stats = {
            total: servers.length,
            running: 0,
            stopped: 0,
            error: 0,
            byMode: {} as { [mode: string]: number },
            byCertMode: {} as { [mode: string]: number }
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
    public dispose(): void {
        this.eventEmitter.dispose();
        this.clearAll();
        console.log('ACTIVE_SERVERS: Registry disposed');
    }

    /**
     * Generate unique server ID
     * @private
     */
    private generateServerId(port: number, timestamp: number): string {
        return `server-${port}-${timestamp}`;
    }

    /**
     * Emit registry event
     * @private
     */
    private emitEvent(type: RegistryEventType, serverId?: string, server?: ActiveServer): void {
        const event: RegistryEvent = {
            type,
            serverId,
            server,
            timestamp: Date.now()
        };
        
        this.eventEmitter.fire(event);
    }
}

/**
 * Convenience function to get the registry instance
 */
export function getActiveServerRegistry(): ActiveServerRegistry {
    return ActiveServerRegistry.getInstance();
}

/**
 * Convenience function to register a server
 */
export function registerActiveServer(config: {
    port: number;
    url: string;
    launchMode: LaunchMode;
    certMode: CertMode;
    timestamp: number;
    htmlFile?: string;
    customName?: string;
    serverInstance?: any;
    metadata?: any;
}): ActiveServer {
    return getActiveServerRegistry().registerServer(config);
}
