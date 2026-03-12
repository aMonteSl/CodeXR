import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { HttpServer, HttpServerConfig } from './httpServer';
import { NetworkUtils } from '../utils/networkUtils';
import { PortManager } from './portManager';

/**
 * HTTPS Server Configuration with default certificates
 */
export interface HttpsDefaultServerConfig extends Omit<HttpServerConfig, 'port'> {
    port: number;
    certPath?: string;
    keyPath?: string;
    extensionContext?: vscode.ExtensionContext; // Optional extension context for resolving default paths
}

/**
 * HTTPS Server with default certificates
 * Extends HTTP server functionality with SSL/TLS support using default certificates
 */
export class HttpsDefaultServer {
    private server: https.Server | null = null;
    private config: HttpsDefaultServerConfig;
    private isRunning: boolean = false;
    private httpHandler: HttpServer;

    /**
     * Get default certificate paths based on extension context
     * @private
     */
    private getDefaultCertificatePaths(extensionContext?: vscode.ExtensionContext): {
        certPath: string;
        keyPath: string;
    } {
        if (extensionContext) {
            // Use extension context to resolve absolute paths
            const certPath = path.join(extensionContext.extensionPath, 'certs', 'babia_cert.pem');
            const keyPath = path.join(extensionContext.extensionPath, 'certs', 'babia_key.pem');
            
            console.log('SERVER: Using extension context for default certificates');
            console.log('SERVER: Extension path:', extensionContext.extensionPath);
            
            return { certPath, keyPath };
        } else {
            // Fallback to relative paths
            console.log('SERVER: Using fallback relative paths for default certificates');
            return {
                certPath: path.join(__dirname, '../../../certs/babia_cert.pem'),
                keyPath: path.join(__dirname, '../../../certs/babia_key.pem')
            };
        }
    }

    constructor(config: HttpsDefaultServerConfig) {
        // Get default certificate paths based on extension context
        const defaultCertPaths = this.getDefaultCertificatePaths(config.extensionContext);
        
        this.config = {
            host: '0.0.0.0',  // ✅ Listen on all network interfaces for VR/mobile access
            staticRoot: path.join(__dirname, '../../../templates'),
            enableCors: true,
            allowedOrigins: ['*'],
            certPath: defaultCertPaths.certPath,
            keyPath: defaultCertPaths.keyPath,
            ...config
        };

        // Create HTTP handler instance for request processing with ALL configuration
        this.httpHandler = new HttpServer({
            port: this.config.port,
            host: this.config.host,
            staticRoot: this.config.staticRoot,
            enableCors: this.config.enableCors,
            allowedOrigins: this.config.allowedOrigins,
            mainFile: this.config.mainFile  // ← FIX: Pass mainFile to HTTP handler
        });
        
        console.log('SERVER: HTTPS server (default certs) initialized with config:', {
            ...this.config,
            certPath: '***REDACTED***',
            keyPath: '***REDACTED***'
        });
        console.log('SERVER: Using default certificates from:', this.config.certPath);
    }

    /**
     * Start the HTTPS server with default certificates
     * @returns Promise<string> - Server URL
     */
    public async start(): Promise<string> {
        if (this.isRunning) {
            throw new Error('SERVER: HTTPS server is already running');
        }

        // Validate certificate files
        await this.validateCertificates();

        // Find an available port starting from the configured port
        console.log(`SERVER:  Looking for available port starting from ${this.config.port} on host ${this.config.host}...`);
        const availablePort = await PortManager.findAvailablePort(this.config.port, this.config.port + 100, this.config.host);
        
        if (availablePort !== this.config.port) {
            console.log(`SERVER:   Port ${this.config.port} was busy, using ${availablePort} instead on host ${this.config.host}`);
            this.config.port = availablePort;
        } else {
            console.log(`SERVER:  Port ${this.config.port} is available on host ${this.config.host}`);
        }

        return new Promise((resolve, reject) => {
            try {
                // Load SSL certificates
                const sslOptions = this.loadSslOptions();
                
                // Create HTTPS server using the HTTP handler's request processing
                this.server = https.createServer(sslOptions, (req, res) => {
                    // Use the HTTP handler's request processing logic
                    (this.httpHandler as any).handleRequest(req, res);
                });

                this.server.on('error', (error: NodeJS.ErrnoException) => {
                    console.error('SERVER: HTTPS server error:', error);
                    this.isRunning = false;
                    
                    if (error.code === 'EADDRINUSE') {
                        reject(new Error(`SERVER: Port ${this.config.port} is already in use`));
                    } else if (error.code === 'EACCES') {
                        reject(new Error(`SERVER: Permission denied. May need to run as administrator for port ${this.config.port}`));
                    } else {
                        reject(new Error(`SERVER: Failed to start HTTPS server: ${error.message}`));
                    }
                });

                this.server.on('listening', () => {
                    const address = this.server?.address();
                    const port = this.config.port;
                    
                    console.log(`SERVER:  HTTPS server successfully listening!`);
                    console.log(`SERVER:  Address object:`, address);
                    console.log(`SERVER:  Config host: "${this.config.host}"`);
                    console.log(`SERVER:  Config port: ${this.config.port}`);
                    console.log(`SERVER:  Actual binding: ${typeof address === 'object' && address ? `${address.family || 'unknown'} ${address.address || 'unknown'}:${address.port || 'unknown'}` : 'unknown'}`);
                    
                    // Generate proper URLs for external access
                    const urls = NetworkUtils.generateServerUrls(port, 'https');
                    const primaryExternalUrl = NetworkUtils.getPrimaryExternalUrl(port, 'https');
                    
                    console.log(`SERVER: HTTPS server listening on port ${port}`);
                    console.log('SERVER: Using default certificates from:', this.config.certPath);
                    console.log('SERVER:   NOTE: Using self-signed certificate - browsers may show security warnings');
                    
                    // Display comprehensive network information
                    NetworkUtils.displayNetworkInfo(port, 'https');
                    
                    console.log('SERVER: Server address info:', address);
                    
                    // Show VR-friendly instructions with the correct external URL
                    this.showVRCertificateInstructions(primaryExternalUrl, urls.localhost);
                    
                    this.isRunning = true;
                    
                    // Return the localhost URL for browser/panel access
                    const localhostUrl = NetworkUtils.getLocalhostUrl(port, 'https');
                    resolve(localhostUrl);
                });

                this.server.on('close', () => {
                    console.log('SERVER: HTTPS server closed');
                    this.isRunning = false;
                });

                // Handle TLS errors gracefully (common with self-signed certificates)
                this.server.on('tlsClientError', (err, tlsSocket) => {
                    // Only log specific errors to avoid spam, and provide helpful guidance
                    if (err.message.includes('SSLV3_ALERT_CERTIFICATE_UNKNOWN') || 
                        err.message.includes('certificate unknown') ||
                        err.message.includes('SSL alert number 46')) {
                        console.warn('SERVER:   Client rejected self-signed certificate - this is expected behavior');
                        console.warn('SERVER:  VR Solution: Access the server URL in browser first and accept certificate');
                        console.warn(`SERVER:  Navigate to: https://${this.config.host}:${this.config.port} and click "Advanced" -> "Proceed to localhost"`);
                    } else {
                        console.warn('SERVER: TLS client error (non-critical):', err.message);
                    }
                    
                    // Don't terminate the connection, just log the warning
                    // This allows the client to potentially retry or handle the error
                });

                console.log(`SERVER:  About to call server.listen with:`);
                console.log(`SERVER:    port: ${this.config.port} (type: ${typeof this.config.port})`);
                console.log(`SERVER:    host: "${this.config.host}" (type: ${typeof this.config.host})`);
                
                // Use callback version of listen for better error handling and debugging
                this.server.listen(this.config.port, this.config.host, () => {
                    console.log(`SERVER:  Listen callback executed successfully`);
                });
                
            } catch (error) {
                console.error('SERVER: Error starting HTTPS server:', error);
                reject(error);
            }
        });
    }

    /**
     * Stop the HTTPS server
     * @returns Promise<void>
     */
    public async stop(): Promise<void> {
        if (!this.server || !this.isRunning) {
            console.log('SERVER: HTTPS server is not running');
            return;
        }

        return new Promise((resolve, reject) => {
            this.server!.close((error) => {
                if (error) {
                    console.error('SERVER: Error stopping HTTPS server:', error);
                    reject(error);
                } else {
                    console.log('SERVER: HTTPS server stopped successfully');
                    this.isRunning = false;
                    this.server = null;
                    resolve();
                }
            });
        });
    }

    /**
     * Check if server is running
     * @returns boolean
     */
    public getIsRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Get server configuration
     * @returns HttpsDefaultServerConfig
     */
    public getConfig(): HttpsDefaultServerConfig {
        return { ...this.config };
    }

    /**
     * Get server URL
     * @returns string | null
     */
    public getServerUrl(): string | null {
        if (!this.isRunning) {
            return null;
        }
        return `https://${this.config.host}:${this.config.port}`;
    }

    /**
     * Get certificate information
     * @returns object with certificate details
     */
    public getCertificateInfo(): {
        certPath: string;
        keyPath: string;
        certExists: boolean;
        keyExists: boolean;
        isValid: boolean;
    } {
        const certExists = fs.existsSync(this.config.certPath!);
        const keyExists = fs.existsSync(this.config.keyPath!);
        
        return {
            certPath: this.config.certPath!,
            keyPath: this.config.keyPath!,
            certExists,
            keyExists,
            isValid: certExists && keyExists
        };
    }

    /**
     * Validate that certificate files exist and are readable
     * @private
     */
    private async validateCertificates(): Promise<void> {
        const certPath = this.config.certPath!;
        const keyPath = this.config.keyPath!;

        console.log('SERVER: Validating default certificates...');
        console.log('SERVER: Certificate path:', certPath);
        console.log('SERVER: Key path:', keyPath);

        // Check if certificate file exists
        if (!fs.existsSync(certPath)) {
            throw new Error(`SERVER: Certificate file not found: ${certPath}`);
        }

        // Check if key file exists
        if (!fs.existsSync(keyPath)) {
            throw new Error(`SERVER: Private key file not found: ${keyPath}`);
        }

        try {
            // Test reading the files
            await fs.promises.access(certPath, fs.constants.R_OK);
            await fs.promises.access(keyPath, fs.constants.R_OK);
            
            console.log('SERVER: Default certificates validated successfully');
        } catch (error) {
            throw new Error(`SERVER: Cannot read certificate files: ${error}`);
        }
    }

    /**
     * Load SSL options for HTTPS server
     * @private
     * @returns https.ServerOptions
     */
    private loadSslOptions(): https.ServerOptions {
        try {
            const cert = fs.readFileSync(this.config.certPath!, 'utf8');
            const key = fs.readFileSync(this.config.keyPath!, 'utf8');

            console.log('SERVER: SSL certificates loaded successfully');
            console.log('SERVER:  Configuring SSL options for self-signed certificate compatibility');
            
            return {
                cert: cert,
                key: key,
                // Self-signed certificate friendly options
                rejectUnauthorized: false,  // Allow self-signed certificates
                requestCert: false,         // Don't require client certificates
                
                // Security protocols - more permissive for VR compatibility
                secureProtocol: 'TLS_method',  // Allow wider range of TLS versions
                
                // Cipher suites compatible with VR browsers - let client choose
                honorCipherOrder: false,  // Let client choose preferred cipher
                ciphers: [
                    'ECDHE-RSA-AES128-GCM-SHA256',
                    'ECDHE-RSA-AES256-GCM-SHA384',
                    'ECDHE-RSA-AES128-SHA256',
                    'ECDHE-RSA-AES256-SHA384',
                    'DHE-RSA-AES128-GCM-SHA256',  // Added for wider compatibility
                    'DHE-RSA-AES256-GCM-SHA384',
                    'AES128-GCM-SHA256',          // Fallback for older clients
                    'AES256-GCM-SHA384'
                ].join(':'),
                
                // Additional options for VR headset compatibility
                secureOptions: 0,         // Allow all SSL/TLS versions
                
                // SNI (Server Name Indication) callback for flexibility
                SNICallback: (servername: string, callback: (err: Error | null, ctx?: any) => void) => {
                    console.log(`SERVER:  SNI request for: ${servername}`);
                    callback(null); // Accept any servername
                }
            };
        } catch (error) {
            throw new Error(`SERVER: Failed to load SSL certificates: ${error}`);
        }
    }

    /**
     * Get server status including certificate information
     * @returns object with detailed server status
     */
    public getDetailedStatus(): {
        isRunning: boolean;
        url: string | null;
        config: HttpsDefaultServerConfig;
        certificates: {
            certPath: string;
            keyPath: string;
            certExists: boolean;
            keyExists: boolean;
            isValid: boolean;
        };
        uptime?: number;
    } {
        return {
            isRunning: this.isRunning,
            url: this.getServerUrl(),
            config: this.getConfig(),
            certificates: this.getCertificateInfo(),
            uptime: this.isRunning ? process.uptime() : undefined
        };
    }

    /**
     * Test certificate validity without starting the server
     * @returns Promise<boolean>
     */
    public async testCertificates(): Promise<boolean> {
        try {
            await this.validateCertificates();
            
            // Try to create SSL options to validate certificate format
            this.loadSslOptions();
            
            console.log('SERVER: Certificate test passed');
            return true;
        } catch (error) {
            console.error('SERVER: Certificate test failed:', error);
            return false;
        }
    }

    /**
     * Get certificate expiration information (if available)
     * @returns Promise<object | null>
     */
    public async getCertificateExpiration(): Promise<{ 
        notBefore?: Date; 
        notAfter?: Date; 
        isExpired?: boolean;
        daysUntilExpiry?: number;
    } | null> {
        try {
            // This is a basic implementation
            // For more detailed certificate parsing, we could use a library like 'node-forge'
            const cert = fs.readFileSync(this.config.certPath!, 'utf8');
            
            // Extract dates from certificate (basic regex parsing)
            const notBeforeMatch = cert.match(/Not Before: (.+)/);
            const notAfterMatch = cert.match(/Not After : (.+)/);
            
            if (notBeforeMatch && notAfterMatch) {
                const notBefore = new Date(notBeforeMatch[1]);
                const notAfter = new Date(notAfterMatch[1]);
                const now = new Date();
                const isExpired = now > notAfter;
                const daysUntilExpiry = Math.ceil((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                
                return {
                    notBefore,
                    notAfter,
                    isExpired,
                    daysUntilExpiry
                };
            }
            
            return null;
        } catch (error) {
            console.error('SERVER: Error parsing certificate expiration:', error);
            return null;
        }
    }

    /**
     * Show VR-friendly certificate acceptance instructions
     * @private
     */
    private showVRCertificateInstructions(externalUrl: string, localhostUrl?: string): void {
        const primaryUrl = externalUrl;
        const fallbackUrl = localhostUrl || externalUrl;
        
        const message = `🥽 VR/HTTPS Server ready! For VR headsets to work:\n\n` +
                       `1️⃣ Primary URL (VR/Mobile): ${primaryUrl}\n` +
                       `2️⃣ Local URL (Testing): ${fallbackUrl}\n\n` +
                       `📱 For VR/Mobile devices:\n` +
                       `   • Open browser and go to: ${primaryUrl}\n` +
                       `   • Click "Advanced" → "Proceed to [IP] (unsafe)"\n` +
                       `   • Now your VR headset can access securely!\n\n` +
                       `🔐 This accepts the self-signed certificate for your session.`;

        console.log('SERVER:  VR Certificate Instructions:');
        console.log('SERVER: =====================================');
        console.log(`SERVER:  VR/Mobile URL: ${primaryUrl}`);
        console.log(`SERVER:  Local URL: ${fallbackUrl}`);
        console.log('SERVER: 1. Navigate to the VR/Mobile URL from your device');
        console.log('SERVER: 2. Accept certificate warning in browser');
        console.log('SERVER: 3. Then use VR headset to access the same URL');
        console.log('SERVER: =====================================');

        // Show information message to user (non-blocking)
        if (vscode && vscode.window) {
            vscode.window.showInformationMessage(
                `🥽 HTTPS Server ready! VR/Mobile: ${primaryUrl}`,
                'Copy VR URL',
                'Copy Local URL', 
                'Show Instructions'
            ).then(selection => {
                if (selection === 'Copy VR URL') {
                    vscode.env.clipboard.writeText(primaryUrl);
                    vscode.window.showInformationMessage('✅ VR/Mobile URL copied to clipboard!');
                } else if (selection === 'Copy Local URL') {
                    vscode.env.clipboard.writeText(fallbackUrl);
                    vscode.window.showInformationMessage('✅ Local URL copied to clipboard!');
                } else if (selection === 'Show Instructions') {
                    vscode.window.showInformationMessage(message, { modal: true });
                }
            });
        }
    }
}
