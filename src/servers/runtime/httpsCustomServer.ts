import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { X509Certificate } from 'crypto';
import * as vscode from 'vscode';
import { HttpServer, HttpServerConfig, ParticipantRemovalOutcome } from './httpServer';
import { ConnectedParticipantSummary } from '../../collaboration';
import { NetworkUtils } from '../utils/networkUtils';
import { PortManager } from './portManager';
import { GeneratedHttpsCertificateManager } from './generatedHttpsCertificateManager';
import { RemoteSessionAuthority } from '../../remote_access';

export interface HttpsCustomServerConfig extends Omit<HttpServerConfig, 'port'> {
    port: number;
    certPath: string;
    keyPath: string;
    extensionContext?: vscode.ExtensionContext;
}

export class HttpsCustomServer {
    private server: https.Server | null = null;
    private config: HttpsCustomServerConfig;
    private isRunning = false;
    private httpHandler: HttpServer;
    private usingFallbackCerts = false;
    private readonly certificateManager: GeneratedHttpsCertificateManager;

    constructor(config: HttpsCustomServerConfig) {
        if (!config.certPath || !config.keyPath) {
            throw new Error('SERVER: Certificate path and key path are required for custom HTTPS server');
        }

        if (!config.extensionContext) {
            throw new Error('SERVER: Extension context is required for HTTPS certificate fallback.');
        }

        this.certificateManager = new GeneratedHttpsCertificateManager(config.extensionContext);
        this.config = {
            host: '0.0.0.0',
            staticRoot: path.join(__dirname, '../../../templates'),
            enableCors: true,
            allowedOrigins: ['*'],
            ...config,
        };

        this.httpHandler = new HttpServer({
            port: this.config.port,
            host: this.config.host,
            staticRoot: this.config.staticRoot,
            enableCors: this.config.enableCors,
            allowedOrigins: this.config.allowedOrigins,
            mainFile: this.config.mainFile,
            extensionContext: this.config.extensionContext,
            analysisSessionId: this.config.analysisSessionId,
        });

        console.log('SERVER: HTTPS server (custom certificates) initialized with config:', {
            ...this.config,
            certPath: '***REDACTED***',
            keyPath: '***REDACTED***',
        });
    }

    public async start(): Promise<string> {
        if (this.isRunning) {
            throw new Error('SERVER: HTTPS server is already running');
        }

        await this.resolveCertificatePaths();
        await this.validateCertificates();

        console.log(`SERVER: Looking for available port starting from ${this.config.port} on host ${this.config.host}...`);
        const availablePort = await PortManager.findAvailablePort(this.config.port, this.config.port + 100, this.config.host);

        if (availablePort !== this.config.port) {
            console.log(`SERVER: Port ${this.config.port} was busy, using ${availablePort} instead on host ${this.config.host}`);
            this.config.port = availablePort;
        } else {
            console.log(`SERVER: Port ${this.config.port} is available on host ${this.config.host}`);
        }

        return new Promise((resolve, reject) => {
            try {
                const sslOptions = this.loadSslOptions();

                this.server = https.createServer(sslOptions, (req, res) => {
                    this.httpHandler.handleRequest(req, res);
                });
                this.httpHandler.attachToNodeServer(this.server);

                this.server.on('error', (error: NodeJS.ErrnoException) => {
                    console.error('SERVER: HTTPS server error:', error);
                    this.isRunning = false;

                    if (error.code === 'EADDRINUSE') {
                        reject(new Error(`SERVER: Port ${this.config.port} is already in use`));
                    } else if (error.code === 'EACCES') {
                        reject(new Error(`SERVER: Permission denied. May need to run as administrator for port ${this.config.port}`));
                    } else if (error.code === 'ENOENT') {
                        reject(new Error('SERVER: Certificate file not found. Please check your certificate paths.'));
                    } else {
                        reject(new Error(`SERVER: Failed to start HTTPS server: ${error.message}`));
                    }
                });

                this.server.on('listening', () => {
                    const port = this.config.port;
                    NetworkUtils.generateServerUrls(port, 'https');
                    const primaryExternalUrl = NetworkUtils.getPrimaryExternalUrl(port, 'https');

                    console.log(`SERVER: HTTPS server listening on port ${port}`);
                    if (this.usingFallbackCerts) {
                        console.warn('SERVER: Using generated local certificates instead of custom certificates');
                        void vscode.window.showWarningMessage(
                            'HTTPS server started with generated local certificates because the custom certificate pair was missing or invalid.',
                            'Configure Certificates',
                        ).then((action) => {
                            if (action === 'Configure Certificates') {
                                void vscode.commands.executeCommand('codexr.server.configure');
                            }
                        });
                    } else {
                        console.log('SERVER: Using custom certificates');
                    }

                    NetworkUtils.displayNetworkInfo(port, 'https');
                    console.log(`SERVER: Primary external URL: ${primaryExternalUrl}`);

                    this.isRunning = true;
                    resolve(NetworkUtils.getLocalhostUrl(port, 'https'));
                });

                this.server.on('close', () => {
                    console.log('SERVER: HTTPS server closed');
                    this.isRunning = false;
                });

                this.server.on('tlsClientError', (err) => {
                    if (
                        err.message.includes('SSLV3_ALERT_CERTIFICATE_UNKNOWN') ||
                        err.message.includes('certificate unknown') ||
                        err.message.includes('SSL alert number 46')
                    ) {
                        console.warn('SERVER: Client rejected the certificate - this may be expected');
                        console.warn('SERVER: Open the server URL in a browser first and accept the certificate');
                        console.warn(`SERVER: Navigate to https://${this.config.host}:${this.config.port} and proceed manually`);
                    } else if (err.message.includes('certificate')) {
                        console.warn('SERVER: Certificate-related TLS error:', err.message);
                    } else {
                        console.warn('SERVER: TLS client error (non-critical):', err.message);
                    }
                });

                this.server.listen(this.config.port, this.config.host);
            } catch (error) {
                console.error('SERVER: Error starting HTTPS server:', error);
                reject(error);
            }
        });
    }

    public async stop(): Promise<void> {
        if (!this.server || !this.isRunning) {
            console.log('SERVER: HTTPS server is not running');
            return;
        }

        // See HTTPServer.stop(): the runtime features own the sockets that
        // would otherwise keep close() pending forever.
        this.httpHandler.disposeRuntimeFeatures();
        this.server.closeAllConnections();

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
     * Drop every open socket without waiting for a graceful close.
     */
    public forceStop(): void {
        this.httpHandler.disposeRuntimeFeatures();
        this.server?.closeAllConnections();
        this.isRunning = false;
    }

    public getIsRunning(): boolean {
        return this.isRunning;
    }

    public getConfig(): HttpsCustomServerConfig {
        return {
            ...this.config,
            certPath: '***REDACTED***',
            keyPath: '***REDACTED***',
        };
    }

    public getFullConfig(): HttpsCustomServerConfig {
        return { ...this.config };
    }

    public getServerUrl(): string | null {
        if (!this.isRunning) {
            return null;
        }
        return `https://${this.config.host}:${this.config.port}`;
    }

    public createAuthenticatedBrowserUrl(baseUrl: string): string {
        return this.httpHandler.createAuthenticatedBrowserUrl(baseUrl);
    }

    public createInvitation(): string {
        return this.httpHandler.createInvitation();
    }

    public setRemotePublicUrl(publicUrl: string | null): void {
        this.httpHandler.setRemotePublicUrl(publicUrl);
    }

    public getRemoteSessionAuthority(): RemoteSessionAuthority {
        return this.httpHandler.getRemoteSessionAuthority();
    }

    public getConnectedParticipants(): ConnectedParticipantSummary[] {
        return this.httpHandler.getConnectedParticipants();
    }

    public removeParticipant(peerId: string): ParticipantRemovalOutcome {
        return this.httpHandler.removeParticipant(peerId);
    }

    public onConnectedParticipantsChanged(
        listener: (participants: ConnectedParticipantSummary[]) => void,
    ): () => void {
        return this.httpHandler.onConnectedParticipantsChanged(listener);
    }

    public getCertificateInfo(): {
        certPath: string;
        keyPath: string;
        certExists: boolean;
        keyExists: boolean;
        isValid: boolean;
        certSize?: number;
        keySize?: number;
    } {
        const certExists = fs.existsSync(this.config.certPath);
        const keyExists = fs.existsSync(this.config.keyPath);

        let certSize: number | undefined;
        let keySize: number | undefined;

        try {
            if (certExists) {
                certSize = fs.statSync(this.config.certPath).size;
            }
            if (keyExists) {
                keySize = fs.statSync(this.config.keyPath).size;
            }
        } catch (error) {
            console.warn('SERVER: Could not get certificate file sizes:', error);
        }

        return {
            certPath: this.config.certPath,
            keyPath: this.config.keyPath,
            certExists,
            keyExists,
            isValid: certExists && keyExists,
            certSize,
            keySize,
        };
    }

    private async resolveCertificatePaths(): Promise<void> {
        const customResult = await this.tryUseCustomCertificates();
        if (customResult) {
            this.usingFallbackCerts = false;
            return;
        }

        console.warn('SERVER: Falling back to generated local certificates because the custom pair is missing or invalid');
        const generatedPaths = await this.certificateManager.ensureDefaultCertificatePair();
        this.config.certPath = generatedPaths.certPath;
        this.config.keyPath = generatedPaths.keyPath;
        this.usingFallbackCerts = true;
    }

    private async tryUseCustomCertificates(): Promise<boolean> {
        const certExists = fs.existsSync(this.config.certPath);
        const keyExists = fs.existsSync(this.config.keyPath);

        if (!certExists || !keyExists) {
            if (!certExists) {
                console.warn(`SERVER: Custom certificate file not found: ${this.config.certPath}`);
            }
            if (!keyExists) {
                console.warn(`SERVER: Custom key file not found: ${this.config.keyPath}`);
            }
            return false;
        }

        try {
            await this.validateCertificatePair(this.config.certPath, this.config.keyPath);
            return true;
        } catch (error) {
            console.warn('SERVER: Custom certificate pair failed validation and will use generated fallback:', error);
            return false;
        }
    }

    private async validateCertificates(): Promise<void> {
        await this.validateCertificatePair(this.config.certPath, this.config.keyPath);
    }

    private async validateCertificatePair(certPath: string, keyPath: string): Promise<void> {
        if (!fs.existsSync(certPath)) {
            throw new Error(`SERVER: Certificate file not found: ${certPath}`);
        }

        if (!fs.existsSync(keyPath)) {
            throw new Error(`SERVER: Private key file not found: ${keyPath}`);
        }

        await fs.promises.access(certPath, fs.constants.R_OK);
        await fs.promises.access(keyPath, fs.constants.R_OK);

        const certContent = await fs.promises.readFile(certPath, 'utf8');
        const keyContent = await fs.promises.readFile(keyPath, 'utf8');

        if (!certContent.includes('BEGIN CERTIFICATE')) {
            throw new Error('SERVER: Certificate file does not appear to be a valid certificate');
        }

        if (
            !keyContent.includes('BEGIN PRIVATE KEY') &&
            !keyContent.includes('BEGIN RSA PRIVATE KEY') &&
            !keyContent.includes('BEGIN EC PRIVATE KEY')
        ) {
            throw new Error('SERVER: Key file does not appear to be a valid private key');
        }
    }

    private loadSslOptions(): https.ServerOptions {
        try {
            const cert = fs.readFileSync(this.config.certPath, 'utf8');
            const key = fs.readFileSync(this.config.keyPath, 'utf8');

            console.log('SERVER: Custom SSL certificates loaded successfully');

            return {
                cert,
                key,
                rejectUnauthorized: false,
                requestCert: false,
                secureProtocol: 'TLS_method',
                honorCipherOrder: false,
                ciphers: [
                    'ECDHE-RSA-AES128-GCM-SHA256',
                    'ECDHE-RSA-AES256-GCM-SHA384',
                    'ECDHE-RSA-AES128-SHA256',
                    'ECDHE-RSA-AES256-SHA384',
                    'DHE-RSA-AES128-GCM-SHA256',
                    'DHE-RSA-AES256-GCM-SHA384',
                    'AES128-GCM-SHA256',
                    'AES256-GCM-SHA384',
                ].join(':'),
                secureOptions: 0,
                SNICallback: (_servername: string, callback: (err: Error | null, ctx?: any) => void) => {
                    callback(null);
                },
            };
        } catch (error) {
            throw new Error(`SERVER: Failed to load custom SSL certificates: ${error}`);
        }
    }

    public getDetailedStatus(): {
        isRunning: boolean;
        url: string | null;
        config: HttpsCustomServerConfig;
        certificates: {
            certPath: string;
            keyPath: string;
            certExists: boolean;
            keyExists: boolean;
            isValid: boolean;
            certSize?: number;
            keySize?: number;
        };
        uptime?: number;
    } {
        return {
            isRunning: this.isRunning,
            url: this.getServerUrl(),
            config: this.getConfig(),
            certificates: this.getCertificateInfo(),
            uptime: this.isRunning ? process.uptime() : undefined,
        };
    }

    public async testCertificates(): Promise<boolean> {
        try {
            await this.resolveCertificatePaths();
            await this.validateCertificates();
            this.loadSslOptions();
            console.log('SERVER: Custom certificate test passed');
            return true;
        } catch (error) {
            console.error('SERVER: Custom certificate test failed:', error);
            return false;
        }
    }

    public async updateCertificates(certPath: string, keyPath: string): Promise<boolean> {
        if (this.isRunning) {
            throw new Error('SERVER: Cannot update certificates while server is running. Stop the server first.');
        }

        const oldCertPath = this.config.certPath;
        const oldKeyPath = this.config.keyPath;

        try {
            this.config.certPath = certPath;
            this.config.keyPath = keyPath;
            this.usingFallbackCerts = false;

            await this.validateCertificatePair(certPath, keyPath);
            console.log('SERVER: Certificate paths updated successfully');
            return true;
        } catch (error) {
            this.config.certPath = oldCertPath;
            this.config.keyPath = oldKeyPath;
            console.error('SERVER: Failed to update certificates:', error);
            return false;
        }
    }

    public async getCertificateExpiration(): Promise<{
        notBefore?: Date;
        notAfter?: Date;
        isExpired?: boolean;
        daysUntilExpiry?: number;
    } | null> {
        try {
            const cert = fs.readFileSync(this.config.certPath, 'utf8');
            const certificate = new X509Certificate(cert);
            const notBefore = new Date(certificate.validFrom);
            const notAfter = new Date(certificate.validTo);
            const now = new Date();
            const isExpired = now > notAfter;
            const daysUntilExpiry = Math.ceil((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            return {
                notBefore,
                notAfter,
                isExpired,
                daysUntilExpiry,
            };
        } catch (error) {
            console.error('SERVER: Error parsing certificate expiration:', error);
            return null;
        }
    }

    public static async validateCertificateFiles(certPath: string, keyPath: string): Promise<{
        isValid: boolean;
        errors: string[];
    }> {
        const errors: string[] = [];

        try {
            if (!fs.existsSync(certPath)) {
                errors.push(`Certificate file not found: ${certPath}`);
            }
            if (!fs.existsSync(keyPath)) {
                errors.push(`Private key file not found: ${keyPath}`);
            }

            if (errors.length > 0) {
                return { isValid: false, errors };
            }

            try {
                await fs.promises.access(certPath, fs.constants.R_OK);
            } catch {
                errors.push(`Cannot read certificate file: ${certPath}`);
            }

            try {
                await fs.promises.access(keyPath, fs.constants.R_OK);
            } catch {
                errors.push(`Cannot read private key file: ${keyPath}`);
            }

            if (errors.length > 0) {
                return { isValid: false, errors };
            }

            const certContent = await fs.promises.readFile(certPath, 'utf8');
            const keyContent = await fs.promises.readFile(keyPath, 'utf8');

            if (!certContent.includes('BEGIN CERTIFICATE')) {
                errors.push('Certificate file does not appear to be a valid certificate');
            }

            if (
                !keyContent.includes('BEGIN PRIVATE KEY') &&
                !keyContent.includes('BEGIN RSA PRIVATE KEY') &&
                !keyContent.includes('BEGIN EC PRIVATE KEY')
            ) {
                errors.push('Key file does not appear to be a valid private key');
            }

            return { isValid: errors.length === 0, errors };
        } catch (error) {
            errors.push(`Error validating certificates: ${error}`);
            return { isValid: false, errors };
        }
    }
}
