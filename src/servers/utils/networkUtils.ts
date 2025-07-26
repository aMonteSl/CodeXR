/**
 * Network Utilities for Server Configuration
 * Provides network-related helper functions for server setup
 */

import * as os from 'os';

export class NetworkUtils {
    
    /**
     * Get the local IP address for external device access
     * @returns string - Local IP address or fallback to localhost
     */
    static getLocalIPAddress(): string {
        const interfaces = os.networkInterfaces();
        
        // Look for non-internal IPv4 addresses
        for (const name of Object.keys(interfaces)) {
            if (interfaces[name]) {
                for (const iface of interfaces[name]!) {
                    // Skip internal (localhost) and IPv6 addresses
                    if (iface.family === 'IPv4' && !iface.internal) {
                        console.log(`SERVER: Found local IP address: ${iface.address} (${name})`);
                        return iface.address;
                    }
                }
            }
        }
        
        console.warn('SERVER: Could not find local IP address, falling back to localhost');
        return 'localhost';
    }
    
    /**
     * Generate server URLs for different access methods
     * @param port - Server port
     * @param protocol - 'http' or 'https'
     * @returns Object with different URL options
     */
    static generateServerUrls(port: number, protocol: 'http' | 'https' = 'https'): {
        localhost: string;
        localIP: string;
        allInterfaces: string[];
    } {
        const localIP = this.getLocalIPAddress();
        
        return {
            localhost: `${protocol}://localhost:${port}`,
            localIP: `${protocol}://${localIP}:${port}`,
            allInterfaces: [
                `${protocol}://localhost:${port}`,
                `${protocol}://${localIP}:${port}`,
                `${protocol}://0.0.0.0:${port}`
            ]
        };
    }
    
    /**
     * Get the primary external URL for client connections
     * @param port - Server port
     * @param protocol - 'http' or 'https'
     * @returns string - Primary external URL
     */
    static getPrimaryExternalUrl(port: number, protocol: 'http' | 'https' = 'https'): string {
        const localIP = this.getLocalIPAddress();
        return `${protocol}://${localIP}:${port}`;
    }
    
    /**
     * Get the localhost URL for browser/panel access
     * @param port - Server port
     * @param protocol - 'http' or 'https'
     * @returns string - Localhost URL for local access
     */
    static getLocalhostUrl(port: number, protocol: 'http' | 'https' = 'https'): string {
        return `${protocol}://localhost:${port}`;
    }
    
    /**
     * Display network configuration information
     * @param port - Server port
     * @param protocol - 'http' or 'https'
     */
    static displayNetworkInfo(port: number, protocol: 'http' | 'https' = 'https'): void {
        const urls = this.generateServerUrls(port, protocol);
        
        console.log('\n=== SERVER NETWORK CONFIGURATION ===');
        console.log('====================================');
        console.log(`Primary External URL: ${urls.localIP}`);
        console.log(`Localhost URL: ${urls.localhost}`);
        console.log('');
        console.log('For VR/Mobile devices use: ' + urls.localIP);
        console.log('For local testing use: ' + urls.localhost);
        console.log('');
        console.log('Network Diagnostics:');
        console.log(`  - Server listening on: 0.0.0.0:${port}`);
        console.log(`  - Local IP detected: ${this.getLocalIPAddress()}`);
        console.log(`  - Protocol: ${protocol.toUpperCase()}`);
        console.log('====================================\n');
        
        // Additional diagnostic info
        this.performNetworkDiagnostics(port);
    }
    
    /**
     * Perform network diagnostics
     * @param port - Server port to diagnose
     */
    static performNetworkDiagnostics(port: number): void {
        console.log('=== NETWORK DIAGNOSTICS ===');
        
        // Check all network interfaces
        const interfaces = os.networkInterfaces();
        console.log('Available network interfaces:');
        
        for (const [name, details] of Object.entries(interfaces)) {
            if (details) {
                for (const detail of details) {
                    if (detail.family === 'IPv4') {
                        const status = detail.internal ? '(internal)' : '(external)';
                        console.log(`  ${name}: ${detail.address} ${status}`);
                    }
                }
            }
        }
        
        console.log(`\nServer should be accessible at:`);
        console.log(`  - Local: http://127.0.0.1:${port}`);
        console.log(`  - Network: http://${this.getLocalIPAddress()}:${port}`);
        console.log('===========================\n');
    }
}
