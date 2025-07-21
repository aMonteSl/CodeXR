import * as http from 'http';

/**
 * SSE Client Registry
 * Maintains active Server-Sent Events connections for analysis updates
 */
export class SSEClientRegistry {
    private static instance: SSEClientRegistry | null = null;
    private clients: Map<string, http.ServerResponse[]> = new Map();

    private constructor() {
        console.log('[SSE_CLIENT_REGISTRY] Initializing SSE client registry');
    }

    /**
     * Get the singleton instance
     */
    static getInstance(): SSEClientRegistry {
        if (!SSEClientRegistry.instance) {
            SSEClientRegistry.instance = new SSEClientRegistry();
        }
        return SSEClientRegistry.instance;
    }

    /**
     * Register a new SSE client for a specific file
     * @param fileUri - URI of the analyzed file
     * @param res - HTTP response object for SSE
     */
    registerClient(fileUri: string, res: http.ServerResponse): void {
        console.log(`[SSE_CLIENT_REGISTRY] Registering SSE client for: ${fileUri}`);
        
        if (!this.clients.has(fileUri)) {
            this.clients.set(fileUri, []);
        }
        
        const clientList = this.clients.get(fileUri)!;
        clientList.push(res);
        
        console.log(`[SSE_CLIENT_REGISTRY] Client registered. Total clients for ${fileUri}: ${clientList.length}`);
        
        // Set up cleanup when client disconnects
        res.on('close', () => {
            this.unregisterClient(fileUri, res);
        });
        
        res.on('error', (error) => {
            console.error(`[SSE_CLIENT_REGISTRY] Client error for ${fileUri}:`, error);
            this.unregisterClient(fileUri, res);
        });
    }

    /**
     * Unregister an SSE client
     * @param fileUri - URI of the analyzed file
     * @param res - HTTP response object for SSE
     */
    unregisterClient(fileUri: string, res: http.ServerResponse): void {
        console.log(`[SSE_CLIENT_REGISTRY] Unregistering SSE client for: ${fileUri}`);
        
        const clientList = this.clients.get(fileUri);
        if (!clientList) {
            return;
        }
        
        const index = clientList.indexOf(res);
        if (index > -1) {
            clientList.splice(index, 1);
            console.log(`[SSE_CLIENT_REGISTRY] Client unregistered. Remaining clients for ${fileUri}: ${clientList.length}`);
            
            // Clean up empty arrays
            if (clientList.length === 0) {
                this.clients.delete(fileUri);
                console.log(`[SSE_CLIENT_REGISTRY] Removed empty client list for: ${fileUri}`);
            }
        }
    }

    /**
     * Get all active clients for a file
     * @param fileUri - URI of the analyzed file
     * @returns Array of response objects
     */
    getClients(fileUri: string): http.ServerResponse[] {
        return this.clients.get(fileUri) || [];
    }

    /**
     * Send a message to all clients for a specific file
     * @param fileUri - URI of the analyzed file
     * @param message - Message to send
     */
    sendToClients(fileUri: string, message: string): void {
        const clientList = this.clients.get(fileUri);
        console.log(`REQUEST_UPDATE: SSE Registry lookup for file: ${fileUri}`);
        console.log(`REQUEST_UPDATE: Found ${clientList ? clientList.length : 0} client(s) for file: ${fileUri}`);
        
        if (!clientList || clientList.length === 0) {
            console.log(`REQUEST_UPDATE: No SSE clients registered for: ${fileUri}`);
            console.log(`REQUEST_UPDATE: Available files in registry: ${Array.from(this.clients.keys()).join(', ')}`);
            return;
        }
        
        console.log(`[SSE_CLIENT_REGISTRY] Sending message to ${clientList.length} client(s) for: ${fileUri}`);
        console.log(`REQUEST_UPDATE: About to send message to ${clientList.length} client(s)`);
        
        // Send to all active clients, removing any that error out
        const activeClients = [];
        for (const client of clientList) {
            try {
                if (!client.headersSent) {
                    // Headers not sent yet, this shouldn't happen in SSE
                    console.warn(`[SSE_CLIENT_REGISTRY] Skipping client with unsent headers for: ${fileUri}`);
                    continue;
                }
                
                client.write(`data: ${message}\n\n`);
                activeClients.push(client);
                console.log(`REQUEST_UPDATE: Message sent to client successfully`);
            } catch (error) {
                console.error(`[SSE_CLIENT_REGISTRY] Error sending to client for ${fileUri}:`, error);
                console.error(`REQUEST_UPDATE: Failed to send to client: ${error}`);
                // Client will be removed via error event handler
            }
        }
        
        // Update the client list to only include active clients
        if (activeClients.length !== clientList.length) {
            if (activeClients.length === 0) {
                this.clients.delete(fileUri);
                console.log(`[SSE_CLIENT_REGISTRY] All clients disconnected for: ${fileUri}`);
            } else {
                this.clients.set(fileUri, activeClients);
                console.log(`[SSE_CLIENT_REGISTRY] Updated active clients for ${fileUri}: ${activeClients.length}`);
            }
        }
    }

    /**
     * Send a specific SSE event to all clients for a specific file
     * @param fileUri - URI of the analyzed file
     * @param eventType - Type of SSE event (e.g., 'analysisUpdated')
     * @param data - Data to send with the event
     */
    sendEventToClients(fileUri: string, eventType: string, data: string): void {
        const clientList = this.clients.get(fileUri);
        console.log(`[SSE_CLIENT_REGISTRY] Sending SSE event '${eventType}' to clients for: ${fileUri}`);
        console.log(`[SSE_CLIENT_REGISTRY] Found ${clientList ? clientList.length : 0} client(s) for file: ${fileUri}`);
        
        if (!clientList || clientList.length === 0) {
            console.log(`[SSE_CLIENT_REGISTRY] No SSE clients registered for: ${fileUri}`);
            console.log(`[SSE_CLIENT_REGISTRY] Available files in registry: ${Array.from(this.clients.keys()).join(', ')}`);
            return;
        }
        
        console.log(`[SSE_CLIENT_REGISTRY] Sending SSE event '${eventType}' to ${clientList.length} client(s)`);
        
        // Send to all active clients, removing any that error out
        const activeClients = [];
        for (const client of clientList) {
            try {
                if (!client.headersSent) {
                    // Headers not sent yet, this shouldn't happen in SSE
                    console.warn(`[SSE_CLIENT_REGISTRY] Skipping client with unsent headers for: ${fileUri}`);
                    continue;
                }
                
                // Send as specific SSE event: event: eventType\ndata: data\n\n
                client.write(`event: ${eventType}\ndata: ${data}\n\n`);
                activeClients.push(client);
                console.log(`[SSE_CLIENT_REGISTRY] SSE event '${eventType}' sent to client successfully`);
            } catch (error) {
                console.error(`[SSE_CLIENT_REGISTRY] Error sending SSE event '${eventType}' to client for ${fileUri}:`, error);
                // Client will be removed via error event handler
            }
        }
        
        // Update the client list to only include active clients
        if (activeClients.length !== clientList.length) {
            if (activeClients.length === 0) {
                this.clients.delete(fileUri);
                console.log(`[SSE_CLIENT_REGISTRY] All clients disconnected for: ${fileUri}`);
            } else {
                this.clients.set(fileUri, activeClients);
                console.log(`[SSE_CLIENT_REGISTRY] Updated active clients for ${fileUri}: ${activeClients.length}`);
            }
        }
    }

    /**
     * Get all file URIs with active clients
     * @returns Array of file URIs
     */
    getActiveFiles(): string[] {
        return Array.from(this.clients.keys());
    }

    /**
     * Get total number of active clients across all files
     * @returns Total client count
     */
    getTotalClientCount(): number {
        let total = 0;
        for (const clientList of this.clients.values()) {
            total += clientList.length;
        }
        return total;
    }

    /**
     * Remove all clients for a specific file
     * @param fileUri - URI of the analyzed file
     */
    removeAllClients(fileUri: string): void {
        const clientList = this.clients.get(fileUri);
        if (!clientList) {
            return;
        }
        
        console.log(`[SSE_CLIENT_REGISTRY] Removing all ${clientList.length} client(s) for: ${fileUri}`);
        
        // Close all connections
        for (const client of clientList) {
            try {
                client.end();
            } catch (error) {
                console.error(`[SSE_CLIENT_REGISTRY] Error closing client for ${fileUri}:`, error);
            }
        }
        
        this.clients.delete(fileUri);
    }

    /**
     * Clear all clients (useful for cleanup)
     */
    clearAll(): void {
        console.log(`[SSE_CLIENT_REGISTRY] Clearing all clients for ${this.clients.size} file(s)`);
        
        for (const [fileUri, clientList] of this.clients.entries()) {
            console.log(`[SSE_CLIENT_REGISTRY] Closing ${clientList.length} client(s) for: ${fileUri}`);
            for (const client of clientList) {
                try {
                    client.end();
                } catch (error) {
                    console.error(`[SSE_CLIENT_REGISTRY] Error closing client:`, error);
                }
            }
        }
        
        this.clients.clear();
    }

    /**
     * Get statistics about the registry
     * @returns Registry statistics
     */
    getStats(): { fileCount: number; totalClients: number; clientsPerFile: { [fileUri: string]: number } } {
        const clientsPerFile: { [fileUri: string]: number } = {};
        
        for (const [fileUri, clientList] of this.clients.entries()) {
            clientsPerFile[fileUri] = clientList.length;
        }
        
        return {
            fileCount: this.clients.size,
            totalClients: this.getTotalClientCount(),
            clientsPerFile
        };
    }
}
