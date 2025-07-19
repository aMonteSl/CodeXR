import * as net from 'net';

/**
 * Port availability checker and manager
 * Provides utilities to find available ports starting from a given port number
 */
export class PortManager {
    private static readonly DEFAULT_START_PORT = 3000;
    private static readonly DEFAULT_END_PORT = 8080;
    private static readonly MAX_RETRIES = 50;

    /**
     * Check if a specific port is available
     * @param port - The port number to check
     * @returns Promise<boolean> - True if port is available, false otherwise
     */
    public static async isPortAvailable(port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const server = net.createServer();
            
            server.listen(port, () => {
                server.close(() => {
                    console.log(`SERVER: Port ${port} is available`);
                    resolve(true);
                });
            });
            
            server.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'EADDRINUSE') {
                    console.log(`SERVER: Port ${port} is already in use`);
                    resolve(false);
                } else {
                    console.error(`SERVER: Error checking port ${port}:`, err);
                    resolve(false);
                }
            });
        });
    }

    /**
     * Find the next available port starting from the specified port using get-port library
     * @param startPort - The port to start searching from
     * @param endPort - The maximum port to check (optional, defaults to 8080)
     * @returns Promise<number> - The first available port found
     * @throws Error if no available port is found within the range
     */
    public static async findAvailablePort(
        startPort: number = PortManager.DEFAULT_START_PORT,
        endPort: number = PortManager.DEFAULT_END_PORT
    ): Promise<number> {
        console.log(`SERVER: Searching for available port starting from ${startPort}`);
        
        // Validate inputs
        if (startPort < 1 || startPort > 65535) {
            throw new Error(`SERVER: Invalid start port ${startPort}. Must be between 1 and 65535`);
        }
        
        if (endPort < startPort || endPort > 65535) {
            throw new Error(`SERVER: Invalid end port ${endPort}. Must be between ${startPort} and 65535`);
        }

        try {
            // Use get-port for more reliable port detection
            const getPort = (await import('get-port')).default;
            
            // Create a range array for get-port - limit to reasonable range for performance
            const maxRange = Math.min(endPort - startPort + 1, 50); // Limit to 50 ports max
            const ports: number[] = [];
            for (let i = 0; i < maxRange; i++) {
                const port = startPort + i;
                if (port <= endPort) {
                    ports.push(port);
                }
            }
            
            console.log(`SERVER: Searching through ${ports.length} ports starting from ${startPort}`);
            
            const availablePort = await getPort({
                port: ports,
                host: 'localhost'
            });

            console.log(`SERVER: get-port found available port: ${availablePort}`);
            return availablePort;
        } catch (error) {
            console.error(`SERVER: get-port failed, falling back to manual detection:`, error);
            
            // Fallback to the original manual implementation
            console.log(`SERVER: Using fallback manual port detection from ${startPort} to ${endPort}`);
            let currentPort = startPort;
            let attempts = 0;
            const maxAttempts = Math.min(endPort - startPort + 1, PortManager.MAX_RETRIES);

            while (attempts < maxAttempts) {
                if (currentPort > endPort) {
                    break;
                }

                console.log(`SERVER: Checking port ${currentPort}...`);
                if (await PortManager.isPortAvailable(currentPort)) {
                    console.log(`SERVER: Found available port (fallback): ${currentPort}`);
                    return currentPort;
                }

                currentPort++;
                attempts++;
            }

            throw new Error(
                `SERVER: No available port found in range ${startPort}-${endPort} after ${attempts} attempts`
            );
        }
    }

    /**
     * Find multiple available ports
     * @param count - Number of ports needed
     * @param startPort - The port to start searching from
     * @param endPort - The maximum port to check
     * @returns Promise<number[]> - Array of available ports
     */
    public static async findMultipleAvailablePorts(
        count: number,
        startPort: number = PortManager.DEFAULT_START_PORT,
        endPort: number = PortManager.DEFAULT_END_PORT
    ): Promise<number[]> {
        if (count <= 0) {
            throw new Error('SERVER: Port count must be greater than 0');
        }

        console.log(`SERVER: Searching for ${count} available ports starting from ${startPort}`);
        
        const availablePorts: number[] = [];
        let currentPort = startPort;

        while (availablePorts.length < count && currentPort <= endPort) {
            if (await PortManager.isPortAvailable(currentPort)) {
                availablePorts.push(currentPort);
                console.log(`SERVER: Found port ${currentPort} (${availablePorts.length}/${count})`);
            }
            currentPort++;
        }

        if (availablePorts.length < count) {
            throw new Error(
                `SERVER: Only found ${availablePorts.length} available ports, needed ${count}`
            );
        }

        return availablePorts;
    }

    /**
     * Validate port number
     * @param port - Port number to validate
     * @returns boolean - True if port is valid
     */
    public static isValidPort(port: number): boolean {
        return Number.isInteger(port) && port >= 1 && port <= 65535;
    }

    /**
     * Get a random port within a range
     * @param min - Minimum port number
     * @param max - Maximum port number
     * @returns number - Random port number
     */
    public static getRandomPort(min: number = 3000, max: number = 8080): number {
        if (!PortManager.isValidPort(min) || !PortManager.isValidPort(max) || min > max) {
            throw new Error(`SERVER: Invalid port range ${min}-${max}`);
        }
        
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Check if port is in privileged range (1-1023)
     * @param port - Port number to check
     * @returns boolean - True if port is privileged
     */
    public static isPrivilegedPort(port: number): boolean {
        return port >= 1 && port <= 1023;
    }

    /**
     * Get suggested ports based on service type
     * @param serviceType - Type of service ('http', 'https', 'dev')
     * @returns number[] - Array of suggested ports
     */
    public static getSuggestedPorts(serviceType: 'http' | 'https' | 'dev'): number[] {
        switch (serviceType) {
            case 'http':
                return [3000, 8000, 8080, 8008, 3001];
            case 'https':
                return [3443, 8443, 3001, 4443, 5443];
            case 'dev':
                return [3000, 3001, 3002, 8000, 8080, 8888];
            default:
                return [3000, 3001, 8000, 8080];
        }
    }
}
