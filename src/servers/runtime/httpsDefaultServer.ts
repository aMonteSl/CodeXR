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

export interface HttpsDefaultServerConfig extends Omit<HttpServerConfig, 'port'> {
    port: number;
    certPath?: string;
    keyPath?: string;
    extensionContext?: vscode.ExtensionContext;
}

export class HttpsDefaultServer {
    private server: https.Server | null = null;
    private config: HttpsDefaultServerConfig;
    private isRunning = false;
    private httpHandler: HttpServer;
    private readonly certificateManager: GeneratedHttpsCertificateManager;

    constructor(config: HttpsDefaultServerConfig) {
        if (!config.extensionContext) {
            throw new Error('SERVER: Extension context is required for generated HTTPS certificates.');
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

        console.log('SERVER: HTTPS server (generated local certificates) initialized with config:', {
            ...this.config,
            certPath: this.config.certPath ? '***REDACTED***' : undefined,
            keyPath: this.config.keyPath ? '***REDACTED***' : undefined,
        });
    }

    public async start(): Promise<string> {
        if (this.isRunning) {
            throw new Error('SERVER: HTTPS server is already running');
        }

        await this.ensureGeneratedCertificates();
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
                    } else {
                        reject(new Error(`SERVER: Failed to start HTTPS server: ${error.message}`));
                    }
                });

                this.server.on('listening', () => {
                    const address = this.server?.address();
                    const port = this.config.port;
                    const urls = NetworkUtils.generateServerUrls(port, 'https');
                    const primaryExternalUrl = NetworkUtils.getPrimaryExternalUrl(port, 'https');

                    console.log('SERVER: HTTPS server successfully listening.');
                    console.log('SERVER: Address object:', address);
                    console.log(`SERVER: Config host: "${this.config.host}"`);
                    console.log(`SERVER: Config port: ${this.config.port}`);
                    console.log(`SERVER: Generated local certificates loaded from ${this.config.certPath}`);
                    console.log('SERVER: NOTE: Using self-signed certificate - browsers may show security warnings');

                    NetworkUtils.displayNetworkInfo(port, 'https');
                    this.showVRCertificateInstructions(primaryExternalUrl, urls.localhost);

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
                        console.warn('SERVER: Client rejected self-signed certificate - this is expected behavior');
                        console.warn('SERVER: VR solution: open the server URL in a browser first and accept the certificate');
                        console.warn(`SERVER: Navigate to https://${this.config.host}:${this.config.port} and proceed manually`);
                    } else {
                        console.warn('SERVER: TLS client error (non-critical):', err.message);
                    }
                });

                console.log(`SERVER: About to call server.listen with ${this.config.host}:${this.config.port}`);
                this.server.listen(this.config.port, this.config.host, () => {
                    console.log('SERVER: Listen callback executed successfully');
                });
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

    public getConfig(): HttpsDefaultServerConfig {
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
    } {
        const certPath = this.config.certPath ?? '';
        const keyPath = this.config.keyPath ?? '';
        const certExists = certPath ? fs.existsSync(certPath) : false;
        const keyExists = keyPath ? fs.existsSync(keyPath) : false;

        return {
            certPath,
            keyPath,
            certExists,
            keyExists,
            isValid: certExists && keyExists,
        };
    }

    private async ensureGeneratedCertificates(): Promise<void> {
        const paths = await this.certificateManager.ensureDefaultCertificatePair();
        this.config.certPath = paths.certPath;
        this.config.keyPath = paths.keyPath;
    }

    private async validateCertificates(): Promise<void> {
        const certPath = this.config.certPath;
        const keyPath = this.config.keyPath;

        if (!certPath || !keyPath) {
            throw new Error('SERVER: Generated local certificate paths are not available.');
        }

        console.log('SERVER: Validating generated local certificates...');
        console.log('SERVER: Certificate path:', certPath);
        console.log('SERVER: Key path:', keyPath);

        if (!fs.existsSync(certPath)) {
            throw new Error(`SERVER: Certificate file not found: ${certPath}`);
        }

        if (!fs.existsSync(keyPath)) {
            throw new Error(`SERVER: Private key file not found: ${keyPath}`);
        }

        await fs.promises.access(certPath, fs.constants.R_OK);
        await fs.promises.access(keyPath, fs.constants.R_OK);
    }

    private loadSslOptions(): https.ServerOptions {
        try {
            const cert = fs.readFileSync(this.config.certPath!, 'utf8');
            const key = fs.readFileSync(this.config.keyPath!, 'utf8');

            console.log('SERVER: SSL certificates loaded successfully');

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
            throw new Error(`SERVER: Failed to load SSL certificates: ${error}`);
        }
    }

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
            uptime: this.isRunning ? process.uptime() : undefined,
        };
    }

    public async testCertificates(): Promise<boolean> {
        try {
            await this.ensureGeneratedCertificates();
            await this.validateCertificates();
            this.loadSslOptions();
            console.log('SERVER: Certificate test passed');
            return true;
        } catch (error) {
            console.error('SERVER: Certificate test failed:', error);
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
            await this.ensureGeneratedCertificates();
            const cert = fs.readFileSync(this.config.certPath!, 'utf8');
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

    private showVRCertificateInstructions(externalUrl: string, localhostUrl?: string): void {
        const primaryUrl = externalUrl;
        const fallbackUrl = localhostUrl || externalUrl;

        const message = `VR/HTTPS server ready! For VR headsets to work:\n\n` +
            `1. Primary URL (VR/Mobile): ${primaryUrl}\n` +
            `2. Local URL (Testing): ${fallbackUrl}\n\n` +
            `For VR/Mobile devices:\n` +
            `   - Open browser and go to: ${primaryUrl}\n` +
            `   - Click "Advanced" and proceed manually\n` +
            `   - Now your VR headset can access securely\n\n` +
            `This accepts the self-signed certificate for your session.`;

        console.log('SERVER: VR certificate instructions:');
        console.log('SERVER: =====================================');
        console.log(`SERVER: VR/Mobile URL: ${primaryUrl}`);
        console.log(`SERVER: Local URL: ${fallbackUrl}`);
        console.log('SERVER: 1. Navigate to the VR/Mobile URL from your device');
        console.log('SERVER: 2. Accept certificate warning in browser');
        console.log('SERVER: 3. Then use VR headset to access the same URL');
        console.log('SERVER: =====================================');

        vscode.window.showInformationMessage(
            `HTTPS server ready. VR/Mobile: ${primaryUrl}`,
            'Copy VR URL',
            'Copy Local URL',
            'Show Instructions',
        ).then((selection) => {
            if (selection === 'Copy VR URL') {
                void vscode.env.clipboard.writeText(primaryUrl);
                void vscode.window.showInformationMessage('VR/Mobile URL copied to clipboard.');
            } else if (selection === 'Copy Local URL') {
                void vscode.env.clipboard.writeText(fallbackUrl);
                void vscode.window.showInformationMessage('Local URL copied to clipboard.');
            } else if (selection === 'Show Instructions') {
                void vscode.window.showInformationMessage(message, { modal: true });
            }
        });
    }
}
