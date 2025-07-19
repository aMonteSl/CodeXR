"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpsDefaultServer = void 0;
const https = __importStar(require("https"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const httpServer_1 = require("./httpServer");
/**
 * HTTPS Server with default certificates
 * Extends HTTP server functionality with SSL/TLS support using default certificates
 */
class HttpsDefaultServer {
    server = null;
    config;
    isRunning = false;
    httpHandler;
    /**
     * Get default certificate paths based on extension context
     * @private
     */
    getDefaultCertificatePaths(extensionContext) {
        if (extensionContext) {
            // Use extension context to resolve absolute paths
            const certPath = path.join(extensionContext.extensionPath, 'certs', 'babia_cert.pem');
            const keyPath = path.join(extensionContext.extensionPath, 'certs', 'babia_key.pem');
            console.log('SERVER: Using extension context for default certificates');
            console.log('SERVER: Extension path:', extensionContext.extensionPath);
            return { certPath, keyPath };
        }
        else {
            // Fallback to relative paths
            console.log('SERVER: Using fallback relative paths for default certificates');
            return {
                certPath: path.join(__dirname, '../../../certs/babia_cert.pem'),
                keyPath: path.join(__dirname, '../../../certs/babia_key.pem')
            };
        }
    }
    constructor(config) {
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
        this.httpHandler = new httpServer_1.HttpServer({
            port: this.config.port,
            host: this.config.host,
            staticRoot: this.config.staticRoot,
            enableCors: this.config.enableCors,
            allowedOrigins: this.config.allowedOrigins,
            mainFile: this.config.mainFile // ← FIX: Pass mainFile to HTTP handler
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
    async start() {
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
                    this.httpHandler.handleRequest(req, res);
                });
                this.server.on('error', (error) => {
                    console.error('SERVER: HTTPS server error:', error);
                    this.isRunning = false;
                    if (error.code === 'EADDRINUSE') {
                        reject(new Error(`SERVER: Port ${this.config.port} is already in use`));
                    }
                    else if (error.code === 'EACCES') {
                        reject(new Error(`SERVER: Permission denied. May need to run as administrator for port ${this.config.port}`));
                    }
                    else {
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
            }
            catch (error) {
                console.error('SERVER: Error starting HTTPS server:', error);
                reject(error);
            }
        });
    }
    /**
     * Stop the HTTPS server
     * @returns Promise<void>
     */
    async stop() {
        if (!this.server || !this.isRunning) {
            console.log('SERVER: HTTPS server is not running');
            return;
        }
        return new Promise((resolve, reject) => {
            this.server.close((error) => {
                if (error) {
                    console.error('SERVER: Error stopping HTTPS server:', error);
                    reject(error);
                }
                else {
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
    getIsRunning() {
        return this.isRunning;
    }
    /**
     * Get server configuration
     * @returns HttpsDefaultServerConfig
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Get server URL
     * @returns string | null
     */
    getServerUrl() {
        if (!this.isRunning) {
            return null;
        }
        return `https://${this.config.host}:${this.config.port}`;
    }
    /**
     * Get certificate information
     * @returns object with certificate details
     */
    getCertificateInfo() {
        const certExists = fs.existsSync(this.config.certPath);
        const keyExists = fs.existsSync(this.config.keyPath);
        return {
            certPath: this.config.certPath,
            keyPath: this.config.keyPath,
            certExists,
            keyExists,
            isValid: certExists && keyExists
        };
    }
    /**
     * Validate that certificate files exist and are readable
     * @private
     */
    async validateCertificates() {
        const certPath = this.config.certPath;
        const keyPath = this.config.keyPath;
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
        }
        catch (error) {
            throw new Error(`SERVER: Cannot read certificate files: ${error}`);
        }
    }
    /**
     * Load SSL options for HTTPS server
     * @private
     * @returns https.ServerOptions
     */
    loadSslOptions() {
        try {
            const cert = fs.readFileSync(this.config.certPath, 'utf8');
            const key = fs.readFileSync(this.config.keyPath, 'utf8');
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
        }
        catch (error) {
            throw new Error(`SERVER: Failed to load SSL certificates: ${error}`);
        }
    }
    /**
     * Get server status including certificate information
     * @returns object with detailed server status
     */
    getDetailedStatus() {
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
    async testCertificates() {
        try {
            await this.validateCertificates();
            // Try to create SSL options to validate certificate format
            this.loadSslOptions();
            console.log('SERVER: Certificate test passed');
            return true;
        }
        catch (error) {
            console.error('SERVER: Certificate test failed:', error);
            return false;
        }
    }
    /**
     * Get certificate expiration information (if available)
     * @returns Promise<object | null>
     */
    async getCertificateExpiration() {
        try {
            // This is a basic implementation
            // For more detailed certificate parsing, we could use a library like 'node-forge'
            const cert = fs.readFileSync(this.config.certPath, 'utf8');
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
        }
        catch (error) {
            console.error('SERVER: Error parsing certificate expiration:', error);
            return null;
        }
    }
}
exports.HttpsDefaultServer = HttpsDefaultServer;
//# sourceMappingURL=httpsDefaultServer.js.map