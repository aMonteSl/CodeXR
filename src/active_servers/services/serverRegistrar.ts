import { ActiveServer, LaunchMode, CertMode } from '../model/activeServerModel';
import { registerActiveServer } from '../registry/activeServerRegistry';

/**
 * Server registration configuration interface
 */
export interface ServerRegistrationConfig {
    port: number;
    url: string;
    launchMode: LaunchMode;
    certMode: CertMode;
    timestamp: number;
    htmlFile?: string;
    customName?: string;
    serverInstance?: any;
    metadata?: any;
}

/**
 * Server Registrar Service
 * Centralized service for registering servers with the active servers registry
 * This layer provides validation, logging, and abstraction between server launchers and the registry
 */
export class ServerRegistrar {
    private static instance: ServerRegistrar | null = null;

    private constructor() {
        console.log('SERVER_REGISTRAR: Service initialized');
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): ServerRegistrar {
        if (!ServerRegistrar.instance) {
            ServerRegistrar.instance = new ServerRegistrar();
        }
        return ServerRegistrar.instance;
    }

    /**
     * Register a server with the active servers registry
     * @param config - Server registration configuration
     * @returns Registered ActiveServer
     */
    public registerServer(config: ServerRegistrationConfig): ActiveServer {
        console.log('SERVER_REGISTRAR: Registering server with config:', {
            port: config.port,
            customName: config.customName,
            url: config.url,
            launchMode: config.launchMode,
            certMode: config.certMode
        });

        // Input validation
        this.validateConfig(config);

        try {
            // Register with the registry
            const activeServer = registerActiveServer(config);
            
            console.log(`SERVER_REGISTRAR: Successfully registered server ${activeServer.id}`);
            
            return activeServer;

        } catch (error) {
            console.error('SERVER_REGISTRAR: Failed to register server:', error);
            throw new Error(`Server registration failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Validate server registration configuration
     * @private
     */
    private validateConfig(config: ServerRegistrationConfig): void {
        // Validate required fields
        if (!config.port || config.port <= 0 || config.port > 65535) {
            throw new Error(`Invalid port number: ${config.port}`);
        }

        if (!config.url || typeof config.url !== 'string') {
            throw new Error(`Invalid URL: ${config.url}`);
        }

        if (!config.launchMode || !['browser', 'lateralPanel'].includes(config.launchMode)) {
            throw new Error(`Invalid launch mode: ${config.launchMode}`);
        }

        if (!config.certMode || !['http', 'https-default', 'https-custom'].includes(config.certMode)) {
            throw new Error(`Invalid cert mode: ${config.certMode}`);
        }

        if (!config.timestamp || config.timestamp <= 0) {
            throw new Error(`Invalid timestamp: ${config.timestamp}`);
        }

        // Validate optional fields
        if (config.customName !== undefined && typeof config.customName !== 'string') {
            throw new Error(`Custom name must be a string: ${typeof config.customName}`);
        }

        if (config.htmlFile !== undefined && typeof config.htmlFile !== 'string') {
            throw new Error(`HTML file path must be a string: ${typeof config.htmlFile}`);
        }
    }
}

/**
 * Convenience function to get the registrar instance
 */
export function getServerRegistrar(): ServerRegistrar {
    return ServerRegistrar.getInstance();
}
