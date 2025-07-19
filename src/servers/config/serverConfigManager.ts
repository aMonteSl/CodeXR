import * as vscode from 'vscode';
import { ServerConfig, DEFAULT_SERVER_CONFIG } from './defaultServerConfig';

/**
 * Server Configuration Manager
 * Handles persistence and state management for server configuration
 */
export class ServerConfigManager {
    private static instance: ServerConfigManager;
    private config: ServerConfig;
    private context: vscode.ExtensionContext;
    private readonly CONFIG_KEY = 'codexr.serverConfig';

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.config = { ...DEFAULT_SERVER_CONFIG };
    }

    /**
     * Get singleton instance
     */
    public static getInstance(context?: vscode.ExtensionContext): ServerConfigManager {
        if (!ServerConfigManager.instance) {
            if (!context) {
                throw new Error('SERVER: Context required for first initialization');
            }
            ServerConfigManager.instance = new ServerConfigManager(context);
        }
        return ServerConfigManager.instance;
    }

    /**
     * Get current server configuration
     */
    public getServerConfig(): ServerConfig {
        return { ...this.config };
    }

    /**
     * Update server configuration
     */
    public updateServerConfig(updates: Partial<ServerConfig>): void {
        this.config = { ...this.config, ...updates };
        console.log('SERVER: Configuration updated', updates);
        
        // Persist to global state
        this.persistConfig();
        
        // Refresh the tree view
        vscode.commands.executeCommand('codexr.servers.refresh');
    }

    /**
     * Restore server configuration from global state
     */
    public restoreServerConfig(): void {
        console.log('SERVER: Restoring server configuration from global state');
        
        const savedConfig = this.context.globalState.get<ServerConfig>(this.CONFIG_KEY);
        
        if (savedConfig) {
            // Validate and merge with defaults
            this.config = {
                ...DEFAULT_SERVER_CONFIG,
                ...savedConfig
            };
            console.log('SERVER: Configuration restored from global state', this.config);
        } else {
            console.log('SERVER: No saved configuration found, using defaults');
            this.config = { ...DEFAULT_SERVER_CONFIG };
        }
    }

    /**
     * Persist configuration to global state
     */
    private persistConfig(): void {
        this.context.globalState.update(this.CONFIG_KEY, this.config);
        console.log('SERVER: Configuration persisted to global state');
    }

    /**
     * Reset configuration to defaults
     */
    public resetConfig(): void {
        console.log('SERVER: Resetting configuration to defaults');
        this.config = { ...DEFAULT_SERVER_CONFIG };
        this.persistConfig();
        vscode.commands.executeCommand('codexr.servers.refresh');
    }

    /**
     * Get configuration for legacy compatibility
     */
    public getLegacyConfig(): {
        httpMode: string;
        port: number;
        autoOpen: boolean;
        openMode: string;
    } {
        const httpModeDisplay = {
            'http': 'HTTP',
            'https-default': 'HTTPS (default certificates)',
            'https-custom': 'HTTPS (custom certificates)'
        };
        
        const openModeDisplay = {
            'browser': 'Browser',
            'lateral-panel': 'Lateral Panel'
        };
        
        return {
            httpMode: httpModeDisplay[this.config.httpMode],
            port: this.config.port,
            autoOpen: this.config.autoOpen,
            openMode: openModeDisplay[this.config.openMode]
        };
    }
}
