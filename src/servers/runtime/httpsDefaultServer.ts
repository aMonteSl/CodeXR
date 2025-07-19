import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { HttpServer, HttpServerConfig } from './httpServer';

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
            host: 'localhost',
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
                    const serverUrl = `https://${this.config.host}:${this.config.port}`;
                    
                    console.log(`SERVER: HTTPS server listening on ${serverUrl}`);
                    console.log('SERVER: Using default certificates from:', this.config.certPath);
                    console.log('SERVER: Server address info:', address);
                    
                    this.isRunning = true;
                    resolve(serverUrl);
                });

                this.server.on('close', () => {
                    console.log('SERVER: HTTPS server closed');
                    this.isRunning = false;
                });

                // Handle TLS errors
                this.server.on('tlsClientError', (err, tlsSocket) => {
                    console.error('SERVER: TLS client error:', err.message);
                });

                this.server.listen(this.config.port, this.config.host);
                
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
            
            return {
                cert: cert,
                key: key,
                // Additional security options
                secureProtocol: 'TLSv1_2_method',
                honorCipherOrder: true,
                ciphers: [
                    'ECDHE-RSA-AES128-GCM-SHA256',
                    'ECDHE-RSA-AES256-GCM-SHA384',
                    'ECDHE-RSA-AES128-SHA256',
                    'ECDHE-RSA-AES256-SHA384'
                ].join(':'),
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
}
