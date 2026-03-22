import * as http from 'http';

/**
 * Information about a server associated with an analysis file
 */
export interface ServerInfo {
    port: number;
    tempDir: string;
    fileUri: string;
    serverRef: http.Server;
    activeServerId?: string;
}

/**
 * Central mapping between analysis files and their corresponding servers
 * This enables efficient lookup for SSE notifications and cleanup operations
 */
class FileToServerMapping {
    private static instance: FileToServerMapping | null = null;
    private fileToServer: Map<string, ServerInfo> = new Map();

    private constructor() {
        console.log('[FILE_TO_SERVER_MAP] Initializing file-to-server mapping registry');
    }

    /**
     * Get the singleton instance
     */
    static getInstance(): FileToServerMapping {
        if (!FileToServerMapping.instance) {
            FileToServerMapping.instance = new FileToServerMapping();
        }
        return FileToServerMapping.instance;
    }

    /**
     * Register a mapping between a file and its analysis server
     * @param fileUri - URI of the analyzed file
     * @param serverInfo - Information about the server serving this analysis
     */
    registerMapping(fileUri: string, serverInfo: ServerInfo): void {
        console.log(`REQUEST_UPDATE: Registering file-to-server mapping`);
        console.log(`REQUEST_UPDATE: File URI: ${fileUri}`);
        console.log(`REQUEST_UPDATE: Server port: ${serverInfo.port}`);
        console.log(`REQUEST_UPDATE: Temp dir: ${serverInfo.tempDir}`);
        console.log(`[FILE_TO_SERVER_MAP] Registering mapping: ${fileUri} -> port ${serverInfo.port}`);
        this.fileToServer.set(fileUri, serverInfo);
        console.log(`REQUEST_UPDATE: Total mappings after registration: ${this.fileToServer.size}`);
    }

    /**
     * Unregister a mapping for a file
     * @param fileUri - URI of the analyzed file
     */
    unregisterMapping(fileUri: string): void {
        console.log(`[FILE_TO_SERVER_MAP] Unregistering mapping for: ${fileUri}`);
        this.fileToServer.delete(fileUri);
    }

    /**
     * Get server information for a file
     * @param fileUri - URI of the analyzed file
     * @returns ServerInfo or null if not found
     */
    getServerInfo(fileUri: string): ServerInfo | null {
        return this.fileToServer.get(fileUri) || null;
    }

    /**
     * Find file URI by server port
     * @param port - Server port number
     * @returns File URI or null if not found
     */
    findFileByPort(port: number): string | null {
        console.log(`REQUEST_UPDATE: Looking up file for port ${port}`);
        console.log(`REQUEST_UPDATE: Available ports: ${Array.from(this.fileToServer.values()).map(info => info.port).join(', ')}`);
        
        for (const [fileUri, serverInfo] of this.fileToServer.entries()) {
            if (serverInfo.port === port) {
                console.log(`REQUEST_UPDATE: Found file ${fileUri} for port ${port}`);
                return fileUri;
            }
        }
        
        console.log(`REQUEST_UPDATE: No file found for port ${port}`);
        return null;
    }

    /**
     * Find file URI by server reference
     * @param serverRef - HTTP server reference
     * @returns File URI or null if not found
     */
    findFileByServerRef(serverRef: http.Server): string | null {
        for (const [fileUri, serverInfo] of this.fileToServer.entries()) {
            if (serverInfo.serverRef === serverRef) {
                return fileUri;
            }
        }
        return null;
    }

    /**
     * Find file URI by temp directory path
     * @param tempDir - Temporary directory path
     * @returns File URI or null if not found
     */
    findFileByTempDir(tempDir: string): string | null {
        for (const [fileUri, serverInfo] of this.fileToServer.entries()) {
            if (serverInfo.tempDir === tempDir) {
                return fileUri;
            }
        }
        return null;
    }

    /**
     * Get all registered mappings
     * @returns Array of [fileUri, ServerInfo] entries
     */
    getAllMappings(): [string, ServerInfo][] {
        return Array.from(this.fileToServer.entries());
    }

    /**
     * Get all file URIs that have servers
     * @returns Array of file URIs
     */
    getAllFileUris(): string[] {
        return Array.from(this.fileToServer.keys());
    }

    /**
     * Check if a file has a registered server
     * @param fileUri - URI of the analyzed file
     * @returns True if mapping exists
     */
    hasMapping(fileUri: string): boolean {
        return this.fileToServer.has(fileUri);
    }

    /**
     * Clear all mappings (useful for cleanup)
     */
    clearAll(): void {
        console.log(`[FILE_TO_SERVER_MAP] Clearing all ${this.fileToServer.size} mappings`);
        this.fileToServer.clear();
    }

    /**
     * Get the number of registered mappings
     */
    size(): number {
        return this.fileToServer.size;
    }
}

// Export singleton instance
export const fileToServerMap = FileToServerMapping.getInstance();
