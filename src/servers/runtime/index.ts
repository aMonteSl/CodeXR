/**
 * Server Runtime Module
 * 
 * This module provides the complete server runtime infrastructure for the CodeXR extension.
 * It includes HTTP/HTTPS servers, port management, and a unified launcher system.
 */

// Core server implementations
export { HttpServer, HttpServerConfig } from './httpServer';
export { HttpsDefaultServer, HttpsDefaultServerConfig } from './httpsDefaultServer';
export { HttpsCustomServer, HttpsCustomServerConfig } from './httpsCustomServer';

// Utility classes
export { PortManager } from './portManager';
export { ScreenBroadcastSignalingServer } from './broadcast/screenBroadcastSignalingServer';

// Main launcher and types
export { 
    MultiServerLauncher,
    MultiServerLaunchResult,
    LaunchResult, // Now exported from multiServerLauncher.ts
    ServerType, 
    ServerInstance
} from './multiServerLauncher';

// Import for use in utility functions
import { MultiServerLauncher, MultiServerLaunchResult } from './multiServerLauncher';
import { PortManager } from './portManager';

/**
 * Create a new multi-server launcher instance
 * @param context - VS Code extension context
 * @returns MultiServerLauncher instance
 */
export function createServerLauncher(context: any): MultiServerLauncher {
    return new MultiServerLauncher(context);
}

/**
 * Launch server with a specific HTML file
 * @param context - VS Code extension context
 * @param htmlFilePath - Path to HTML file to serve
 * @param customName - Optional custom display name for the server
 * @param sessionId - Optional analysis session ID to link server to analysis
 * @returns Promise<MultiServerLaunchResult>
 */
export async function launchServerWithFile(context: any, htmlFilePath: string, customName?: string, sessionId?: string): Promise<MultiServerLaunchResult> {
    const launcher = new MultiServerLauncher(context);
    const additionalMetadata = sessionId ? { sessionId } : undefined;
    return launcher.launchServer(htmlFilePath, customName, additionalMetadata);
}

/**
 * Utility function to check if a port is available
 * @param port - Port number to check
 * @returns Promise<boolean> - True if port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
    return PortManager.isPortAvailable(port);
}

/**
 * Utility function to find an available port
 * @param startPort - Port to start searching from
 * @param endPort - Maximum port to check (optional)
 * @returns Promise<number> - First available port found
 */
export async function findAvailablePort(startPort: number, endPort?: number): Promise<number> {
    return PortManager.findAvailablePort(startPort, endPort);
}

/**
 * Get suggested ports for a service type
 * @param serviceType - Type of service ('http', 'https', 'dev')
 * @returns number[] - Array of suggested ports
 */
export function getSuggestedPorts(serviceType: 'http' | 'https' | 'dev'): number[] {
    return PortManager.getSuggestedPorts(serviceType);
}
