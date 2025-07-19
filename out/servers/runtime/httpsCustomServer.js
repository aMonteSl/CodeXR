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
exports.HttpsCustomServer = void 0;
const https = __importStar(require("https"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const httpServer_1 = require("./httpServer");
/**
 * HTTPS Server with custom user-selected certificates
 * Extends HTTP server functionality with SSL/TLS support using user-provided certificates
 */
class HttpsCustomServer {
    server = null;
    config;
    isRunning = false;
    httpHandler;
    usingFallbackCerts = false;
    /**
     * Validate custom certificates and provide fallback to default certificates
     * @private
     */
    validateAndFallbackCertificates(config) {
        // Check if custom certificates exist
        const customCertExists = fs.existsSync(config.certPath);
        const customKeyExists = fs.existsSync(config.keyPath);
        if (customCertExists && customKeyExists) {
            console.log('SERVER: Custom certificates found and will be used');
            return {
                certPath: config.certPath,
                keyPath: config.keyPath,
                usingFallback: false
            };
        }
        // Log the issues with custom certificates
        if (!customCertExists) {
            console.warn(`SERVER: Custom certificate file not found: ${config.certPath}`);
        }
        if (!customKeyExists) {
            console.warn(`SERVER: Custom key file not found: ${config.keyPath}`);
        }
        // Fallback to default certificates
        console.warn('SERVER: Falling back to default certificates due to missing custom certificates');
        if (config.extensionContext) {
            const certPath = path.join(config.extensionContext.extensionPath, 'certs', 'babia_cert.pem');
            const keyPath = path.join(config.extensionContext.extensionPath, 'certs', 'babia_key.pem');
            // Verify default certificates exist
            if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
                console.log('SERVER: Using default certificates as fallback');
                return { certPath, keyPath, usingFallback: true };
            }
        }
        // Last resort: try relative path to default certificates
        const fallbackCertPath = path.join(__dirname, '../../../certs/babia_cert.pem');
        const fallbackKeyPath = path.join(__dirname, '../../../certs/babia_key.pem');
        if (fs.existsSync(fallbackCertPath) && fs.existsSync(fallbackKeyPath)) {
            console.log('SERVER: Using relative path default certificates as last resort');
            return {
                certPath: fallbackCertPath,
                keyPath: fallbackKeyPath,
                usingFallback: true
            };
        }
        // If we get here, no certificates are available
        throw new Error('SERVER: No valid certificates found - neither custom nor default certificates are available');
    }
    constructor(config) {
        // Validate required certificate paths
        if (!config.certPath || !config.keyPath) {
            throw new Error('SERVER: Certificate path and key path are required for custom HTTPS server');
        }
        // Validate certificates and setup fallback if needed
        const certInfo = this.validateAndFallbackCertificates(config);
        this.usingFallbackCerts = certInfo.usingFallback;
        this.config = {
            host: 'localhost',
            staticRoot: path.join(__dirname, '../../../templates'),
            enableCors: true,
            allowedOrigins: ['*'],
            ...config,
            certPath: certInfo.certPath, // Use validated/fallback certificate path
            keyPath: certInfo.keyPath // Use validated/fallback key path
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
        console.log('SERVER: HTTPS server (custom certs) initialized with config:', {
            ...this.config,
            // Don't log actual certificate paths for security
            certPath: '***REDACTED***',
            keyPath: '***REDACTED***'
        });
    }
    /**
     * Start the HTTPS server with custom certificates
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
                    else if (error.code === 'ENOENT') {
                        reject(new Error(`SERVER: Certificate file not found. Please check your certificate paths.`));
                    }
                    else {
                        reject(new Error(`SERVER: Failed to start HTTPS server: ${error.message}`));
                    }
                });
                this.server.on('listening', () => {
                    const address = this.server?.address();
                    const serverUrl = `https://${this.config.host}:${this.config.port}`;
                    console.log(`SERVER: HTTPS server listening on ${serverUrl}`);
                    if (this.usingFallbackCerts) {
                        console.warn('SERVER: WARNING - Using default certificates instead of custom certificates');
                        // Show user warning
                        vscode.window.showWarningMessage('HTTPS server started with default certificates. Custom certificates were not found or invalid.', 'Configure Certificates').then(action => {
                            if (action === 'Configure Certificates') {
                                vscode.commands.executeCommand('codexr.server.configure');
                            }
                        });
                    }
                    else {
                        console.log('SERVER: Using custom certificates');
                    }
                    console.log('SERVER: Server address info:', address);
                    this.isRunning = true;
                    resolve(serverUrl);
                });
                this.server.on('close', () => {
                    console.log('SERVER: HTTPS server closed');
                    this.isRunning = false;
                });
                // Handle TLS errors with more specific error messages
                this.server.on('tlsClientError', (err, tlsSocket) => {
                    console.error('SERVER: TLS client error:', err.message);
                    if (err.message.includes('certificate')) {
                        console.error('SERVER: This may indicate an issue with the custom certificates');
                    }
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
     * Get server configuration (with redacted certificate paths)
     * @returns HttpsCustomServerConfig
     */
    getConfig() {
        return {
            ...this.config,
            certPath: '***REDACTED***',
            keyPath: '***REDACTED***'
        };
    }
    /**
     * Get server configuration with actual paths (for internal use)
     * @returns HttpsCustomServerConfig
     */
    getFullConfig() {
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
        let certSize;
        let keySize;
        try {
            if (certExists) {
                certSize = fs.statSync(this.config.certPath).size;
            }
            if (keyExists) {
                keySize = fs.statSync(this.config.keyPath).size;
            }
        }
        catch (error) {
            console.warn('SERVER: Could not get certificate file sizes:', error);
        }
        return {
            certPath: this.config.certPath,
            keyPath: this.config.keyPath,
            certExists,
            keyExists,
            isValid: certExists && keyExists,
            certSize,
            keySize
        };
    }
    /**
     * Validate that certificate files exist and are readable
     * @private
     */
    async validateCertificates() {
        const certPath = this.config.certPath;
        const keyPath = this.config.keyPath;
        console.log('SERVER: Validating custom certificates...');
        console.log('SERVER: Certificate path provided:', !!certPath);
        console.log('SERVER: Key path provided:', !!keyPath);
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
            // Basic validation of file content
            const certContent = await fs.promises.readFile(certPath, 'utf8');
            const keyContent = await fs.promises.readFile(keyPath, 'utf8');
            if (!certContent.includes('BEGIN CERTIFICATE')) {
                throw new Error('SERVER: Certificate file does not appear to be a valid certificate');
            }
            if (!keyContent.includes('BEGIN PRIVATE KEY') && !keyContent.includes('BEGIN RSA PRIVATE KEY')) {
                throw new Error('SERVER: Key file does not appear to be a valid private key');
            }
            console.log('SERVER: Custom certificates validated successfully');
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('SERVER:')) {
                throw error;
            }
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
            console.log('SERVER: Custom SSL certificates loaded successfully');
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
                // Reject unauthorized connections for custom certificates
                requestCert: false,
                rejectUnauthorized: false
            };
        }
        catch (error) {
            throw new Error(`SERVER: Failed to load custom SSL certificates: ${error}`);
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
            console.log('SERVER: Custom certificate test passed');
            return true;
        }
        catch (error) {
            console.error('SERVER: Custom certificate test failed:', error);
            return false;
        }
    }
    /**
     * Update certificate paths
     * @param certPath - Path to certificate file
     * @param keyPath - Path to private key file
     * @returns Promise<boolean> - True if certificates are valid
     */
    async updateCertificates(certPath, keyPath) {
        if (this.isRunning) {
            throw new Error('SERVER: Cannot update certificates while server is running. Stop the server first.');
        }
        const oldCertPath = this.config.certPath;
        const oldKeyPath = this.config.keyPath;
        try {
            // Temporarily update paths for validation
            this.config.certPath = certPath;
            this.config.keyPath = keyPath;
            // Test the new certificates
            const isValid = await this.testCertificates();
            if (!isValid) {
                // Restore old paths if validation failed
                this.config.certPath = oldCertPath;
                this.config.keyPath = oldKeyPath;
                return false;
            }
            console.log('SERVER: Certificate paths updated successfully');
            return true;
        }
        catch (error) {
            // Restore old paths if error occurred
            this.config.certPath = oldCertPath;
            this.config.keyPath = oldKeyPath;
            console.error('SERVER: Failed to update certificates:', error);
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
    /**
     * Validate certificate file format and content
     * @param certPath - Path to certificate file
     * @param keyPath - Path to private key file
     * @returns Promise<{isValid: boolean, errors: string[]}>
     */
    static async validateCertificateFiles(certPath, keyPath) {
        const errors = [];
        try {
            // Check if files exist
            if (!fs.existsSync(certPath)) {
                errors.push(`Certificate file not found: ${certPath}`);
            }
            if (!fs.existsSync(keyPath)) {
                errors.push(`Private key file not found: ${keyPath}`);
            }
            if (errors.length > 0) {
                return { isValid: false, errors };
            }
            // Check file permissions
            try {
                await fs.promises.access(certPath, fs.constants.R_OK);
            }
            catch {
                errors.push(`Cannot read certificate file: ${certPath}`);
            }
            try {
                await fs.promises.access(keyPath, fs.constants.R_OK);
            }
            catch {
                errors.push(`Cannot read private key file: ${keyPath}`);
            }
            if (errors.length > 0) {
                return { isValid: false, errors };
            }
            // Validate file content
            const certContent = await fs.promises.readFile(certPath, 'utf8');
            const keyContent = await fs.promises.readFile(keyPath, 'utf8');
            if (!certContent.includes('BEGIN CERTIFICATE')) {
                errors.push('Certificate file does not appear to be a valid certificate');
            }
            if (!keyContent.includes('BEGIN PRIVATE KEY') && !keyContent.includes('BEGIN RSA PRIVATE KEY')) {
                errors.push('Key file does not appear to be a valid private key');
            }
            return { isValid: errors.length === 0, errors };
        }
        catch (error) {
            errors.push(`Error validating certificates: ${error}`);
            return { isValid: false, errors };
        }
    }
}
exports.HttpsCustomServer = HttpsCustomServer;
//# sourceMappingURL=httpsCustomServer.js.map