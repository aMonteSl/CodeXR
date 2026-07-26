import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { sseManager } from './sse/SSEManager';
import { fileToServerMap } from '../../utils/fileToServerMap';
import { NetworkUtils } from '../utils/networkUtils';
import { ScreenBroadcastSignalingServer } from './broadcast/screenBroadcastSignalingServer';
import { CollaborationRoomServer } from './collaboration/collaborationRoomServer';
import { CollaborationProfileManager, ConnectedParticipantSummary } from '../../collaboration';
import { RemoteSessionAuthority } from '../../remote_access';
import { addCorsHeaders, sendErrorResponse, sendJsonResponse } from './http/httpRespond';
import { StaticAssetServer } from './http/staticAssets';
import { RemoteAccessPolicy } from './remote/remoteAccessPolicy';
import { RemotePairingApi } from './remote/remotePairingApi';
import { CollaborationSessionApi } from './collaboration/collaborationSessionApi';
import { AnalysisFeatureHost } from './analysis/analysisFeatureHost';
import { AnalysisMessageRouter } from './analysis/analysisMessageRouter';
import { DependencyGraphBridge } from './analysis/dependencyGraphBridge';
import { HistoricalComparisonBridge } from './analysis/historicalComparisonBridge';
import { ProjectEvolutionBridge } from './analysis/projectEvolutionBridge';

/**
 * HTTP Server Configuration
 */
/** What the host learns after removing a participant from the session. */
export interface ParticipantRemovalOutcome {
    removed: boolean;
    /** True when the guest also lost their remote session (re-pairing needed). */
    sessionRevoked: boolean;
}

export interface HttpServerConfig {
    port: number;
    host?: string;
    staticRoot?: string;
    enableCors?: boolean;
    allowedOrigins?: string[];
    mainFile?: string; // Optional main file to serve at root
    extensionContext?: vscode.ExtensionContext;
    analysisSessionId?: string;
}

/**
 * HTTP Server instance
 * Provides basic HTTP server functionality for CodeXR
 */
export class HttpServer {
    private server: http.Server | null = null;
    private readonly staticAssets: StaticAssetServer;
    private readonly policy: RemoteAccessPolicy;
    private readonly pairingApi: RemotePairingApi;
    private readonly sessionApi: CollaborationSessionApi;
    private config: HttpServerConfig;
    private isRunning: boolean = false;
    private upgradeAttached = false;
    private broadcastSignalingServer: ScreenBroadcastSignalingServer | null = null;
    private collaborationRoomServer: CollaborationRoomServer | null = null;
    private collaborationProfileSubscription: vscode.Disposable | null = null;
    private readonly remoteSessionAuthority = new RemoteSessionAuthority();
    private remotePublicUrl: string | null = null;
    private readonly analysisHost: AnalysisFeatureHost;
    private readonly dependencyBridge: DependencyGraphBridge;
    private readonly historicalBridge: HistoricalComparisonBridge;
    private readonly analysisRouter: AnalysisMessageRouter;

    constructor(config: HttpServerConfig) {
        // Ensure port is a number and create clean config
        const cleanConfig: HttpServerConfig = {
            ...config,
            port: Number(config.port)
        };
        
        this.config = {
            host: '0.0.0.0',  //  Listen on all network interfaces for VR/mobile access
            staticRoot: path.join(__dirname, '../../../templates'),
            enableCors: true,
            allowedOrigins: ['*'],
            ...cleanConfig
        };

        this.staticAssets = new StaticAssetServer({
            staticRoot: this.config.staticRoot!,
            mainFile: this.config.mainFile,
            port: this.config.port,
            host: this.config.host,
        });
        this.policy = new RemoteAccessPolicy(this.remoteSessionAuthority);
        this.pairingApi = new RemotePairingApi({
            authority: this.remoteSessionAuthority,
            getOrigin: (req) => this.getRequestOrigin(req),
            isRemoteRequest: (req) => this.policy.isRemoteRequest(req),
            getRoom: () => this.collaborationRoomServer,
        });
        this.sessionApi = new CollaborationSessionApi({
            port: this.config.port,
            authority: this.remoteSessionAuthority,
            getAnalysisAvailability: () => this.analysisHost.getAnalysisAvailability(),
        });

        // The analysis features: service ownership and lifecycle on the host,
        // room-message and REST handling on the bridges, dispatch on the router.
        const roomHooks = {
            getRoom: () => this.collaborationRoomServer,
            getRoomId: () => this.sessionApi.getCollaborationRoomId(),
        };
        this.analysisHost = new AnalysisFeatureHost(
            {
                extensionContext: this.config.extensionContext,
                analysisSessionId: this.config.analysisSessionId,
                staticRoot: this.config.staticRoot,
                port: this.config.port,
            },
            roomHooks,
        );
        this.dependencyBridge = new DependencyGraphBridge(this.analysisHost, roomHooks);
        this.historicalBridge = new HistoricalComparisonBridge(this.analysisHost);
        this.analysisRouter = new AnalysisMessageRouter(
            this.analysisHost,
            this.dependencyBridge,
            this.historicalBridge,
            new ProjectEvolutionBridge(this.analysisHost),
            roomHooks,
        );

        console.log('SERVER: HTTP server initialized with config:', this.config);
    }

    /**
     * Start the HTTP server
     * @returns Promise<string> - Server URL
     */
    public async start(): Promise<string> {
        if (this.isRunning) {
            throw new Error('SERVER: HTTP server is already running');
        }

        return new Promise((resolve, reject) => {
            try {
                this.server = http.createServer(this.handleRequest.bind(this));
                this.attachToNodeServer(this.server);

                this.server.on('error', (error: NodeJS.ErrnoException) => {
                    console.error('SERVER: HTTP server error:', error);
                    this.isRunning = false;
                    
                    if (error.code === 'EADDRINUSE') {
                        reject(new Error(`SERVER: Port ${this.config.port} is already in use`));
                    } else {
                        reject(new Error(`SERVER: Failed to start HTTP server: ${error.message}`));
                    }
                });

                this.server.on('listening', () => {
                    const address = this.server?.address();
                    const portNumber = Number(this.config.port);
                    
                    console.log(`SERVER: HTTP server listening on http://${this.config.host}:${this.config.port}`);
                    console.log('SERVER: Server address info:', address);
                    
                    // Display network information for external access
                    NetworkUtils.displayNetworkInfo(portNumber, 'http');
                    
                    this.isRunning = true;
                    
                    // Return the localhost URL for browser/panel access
                    const localhostUrl = NetworkUtils.getLocalhostUrl(portNumber, 'http');
                    resolve(localhostUrl);
                });

                // Add graceful shutdown handling
                this.server.on('close', () => {
                    console.log('SERVER: HTTP server closed');
                    this.isRunning = false;
                });

                this.server.listen(this.config.port, this.config.host);
                
            } catch (error) {
                console.error('SERVER: Error starting HTTP server:', error);
                reject(error);
            }
        });
    }

    /**
     * Stop the HTTP server
     * @returns Promise<void>
     */
    public async stop(): Promise<void> {
        if (!this.server || !this.isRunning) {
            console.log('SERVER: HTTP server is not running');
            return;
        }

        // Release the long-lived connections FIRST: server.close() waits for
        // every socket to drain, and the sockets that never drain on their own
        // are exactly the ones these features own (collaboration/broadcast
        // WebSockets and open SSE responses). Disposing inside the close
        // callback deadlocks the shutdown.
        this.disposeRuntimeFeatures();
        this.server.closeAllConnections();

        return new Promise((resolve, reject) => {
            this.server!.close((error) => {
                if (error) {
                    console.error('SERVER: Error stopping HTTP server:', error);
                    reject(error);
                } else {
                    console.log('SERVER: HTTP server stopped successfully');
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
        this.disposeRuntimeFeatures();
        this.server?.closeAllConnections();
        this.isRunning = false;
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
     * @returns HttpServerConfig
     */
    public getConfig(): HttpServerConfig {
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
        return `http://${this.config.host}:${this.config.port}`;
    }

    public getRemoteSessionAuthority(): RemoteSessionAuthority {
        return this.remoteSessionAuthority;
    }

    public getConnectedParticipants(): ConnectedParticipantSummary[] {
        return this.collaborationRoomServer?.getConnectedParticipants(this.sessionApi.getCollaborationRoomId()) || [];
    }

    /**
     * Disconnect one participant on the host's behalf. A remote guest also
     * loses their session, so the removal cannot be undone by reloading the
     * invitation link; local-network guests keep no session to revoke.
     */
    public removeParticipant(peerId: string): ParticipantRemovalOutcome {
        if (!this.collaborationRoomServer) {
            return { removed: false, sessionRevoked: false };
        }

        const result = this.collaborationRoomServer.removeParticipant(
            this.sessionApi.getCollaborationRoomId(),
            peerId,
        );
        const sessionRevoked = result.removed && result.remote && !!result.sessionId
            ? this.remoteSessionAuthority.revokeSession(result.sessionId)
            : false;

        return { removed: result.removed, sessionRevoked };
    }

    public onConnectedParticipantsChanged(
        listener: (participants: ConnectedParticipantSummary[]) => void,
    ): () => void {
        if (!this.collaborationRoomServer) {
            return () => undefined;
        }
        return this.collaborationRoomServer.onParticipantsChanged((changedRoomId, participants) => {
            if (changedRoomId === this.sessionApi.getCollaborationRoomId()) {
                listener(participants);
            }
        });
    }

    public createInvitation(): string {
        return this.remoteSessionAuthority.createInvitation();
    }

    public setRemotePublicUrl(publicUrl: string | null): void {
        this.remotePublicUrl = publicUrl;
    }

    public createAuthenticatedBrowserUrl(baseUrl: string): string {
        const profileManager = CollaborationProfileManager.getInstance();
        if (!profileManager) {
            return baseUrl;
        }
        const token = this.remoteSessionAuthority.createLocalBrowserToken(
            profileManager.getInstallationId(),
            profileManager.getConfiguration().profile,
        );
        const target = new URL('/api/remote/browser', baseUrl);
        target.searchParams.set('token', token);
        return target.toString();
    }

    public disposeRuntimeFeatures(): void {
        this.collaborationProfileSubscription?.dispose();
        this.collaborationProfileSubscription = null;
        this.collaborationRoomServer?.dispose();
        this.collaborationRoomServer = null;
        this.broadcastSignalingServer?.dispose();
        this.broadcastSignalingServer = null;
        this.remoteSessionAuthority.revokeAll();
        this.analysisHost.dispose();
    }

    /**
     * Handle incoming HTTP requests
     * @param req - HTTP request
     * @param res - HTTP response
     */
    public handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
        const startTime = Date.now();
        const requestUrl = req.url || '/';
        const safeRequestUrl = new URL(requestUrl, 'http://codexr.local').pathname;
        const method = req.method || 'GET';
        
        console.log(`SERVER: ${method} ${safeRequestUrl} - Processing request`);

        if (!this.policy.isRequestAuthorized(req, requestUrl)) {
            sendErrorResponse(res, 404, 'Resource not found');
            return;
        }

        // Add CORS headers if enabled
        if (this.config.enableCors) {
            addCorsHeaders(res, this.config.allowedOrigins);
        }

        // Handle preflight requests
        if (method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // Route the request
        this.routeRequest(req, res, requestUrl)
            .then(() => {
                const duration = Date.now() - startTime;
                console.log(`SERVER: ${method} ${safeRequestUrl} - Completed in ${duration}ms`);
            })
            .catch((error) => {
                console.error(`SERVER: ${method} ${safeRequestUrl} - Error:`, error);
                sendErrorResponse(res, 500, 'Internal Server Error');
            });
    }

    /**
     * Route incoming requests
     * @param req - HTTP request
     * @param res - HTTP response
     * @param url - Request URL
     */
    private async routeRequest(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        url: string
    ): Promise<void> {
        // Root path - serve main page
        if (url === '/' || url === '/index.html') {
            await this.staticAssets.serveMainPage(res);
            return;
        }

        if (url.startsWith('/join')) {
            this.pairingApi.servePairingPage(res, url);
            return;
        }

        // Health check endpoint
        if (url === '/health') {
            sendJsonResponse(res, 200, {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                server: 'CodeXR HTTP Server'
            });
            return;
        }

        // Server-Sent Events endpoint for analysis updates
        if (url === '/events') {
            await this.handleSSERequest(req, res);
            return;
        }

        // API endpoints
        if (url.startsWith('/api/')) {
            await this.handleApiRequest(req, res, url);
            return;
        }

        // Static files
        await this.staticAssets.serveStaticFile(req, res, url);
    }

    /**
     * Handle API requests
     * @param req - HTTP request
     * @param res - HTTP response
     * @param url - Request URL
     */
    private async handleApiRequest(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        url: string
    ): Promise<void> {
        const apiPath = new URL(url, 'http://codexr.local').pathname.replace('/api', '');

        switch (apiPath) {
            case '/status':
                sendJsonResponse(res, 200, {
                    server: 'CodeXR HTTP Server',
                    mode: 'HTTP',
                    port: this.config.port,
                    uptime: process.uptime(),
                    timestamp: new Date().toISOString()
                });
                break;

            case '/config':
                sendJsonResponse(res, 200, {
                    mode: 'HTTP',
                    host: this.config.host,
                    port: this.config.port,
                    cors: this.config.enableCors
                });
                break;

            case '/collaboration/session':
                await this.sessionApi.handleSessionDescriptor(req, res);
                break;

            case '/collaboration/avatar-model':
                await this.sessionApi.serveAvatarModel(req, res);
                break;

            case '/remote/pair/request':
                await this.pairingApi.handlePairingRequest(req, res);
                break;

            case '/remote/identity':
                await this.pairingApi.handleBrowserIdentity(req, res);
                break;

            case '/remote/pair/confirm':
                await this.pairingApi.handlePairingConfirmation(req, res);
                break;

            case '/remote/browser':
                this.pairingApi.handleBrowserTokenExchange(req, res, url);
                break;

            case '/remote/profile':
                await this.pairingApi.handleRemoteProfileUpdate(req, res);
                break;

            case '/dependency-graph/summary':
                await this.dependencyBridge.handleDependencyGraphSummary(req, res);
                break;

            case '/historical/references':
                await this.historicalBridge.handleHistoricalReferences(req, res);
                break;

            case '/historical/compare':
                await this.historicalBridge.handleHistoricalCompare(req, res);
                break;

            default:
                sendErrorResponse(res, 404, 'API endpoint not found');
        }
    }

    private getRequestOrigin(req: http.IncomingMessage): string {
        if (this.policy.isRemoteRequest(req) && this.remotePublicUrl) {
            return this.remotePublicUrl;
        }
        const forwardedProtocol = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
        const protocol = forwardedProtocol || (this.policy.isRemoteRequest(req) ? 'https' : 'http');
        return `${protocol}://${req.headers.host || `localhost:${this.config.port}`}`;
    }

    /**
     * Handle Server-Sent Events request for analysis updates
     * @param req - HTTP request
     * @param res - HTTP response
     */
    private async handleSSERequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        console.log('REQUEST_UPDATE: SSE connection request received on server');
        console.log(`REQUEST_UPDATE: Server port: ${this.config.port}`);
        
        // Find which analysis file this server is serving
        const serverPort = this.config.port;
        const fileUri = fileToServerMap.findFileByPort(serverPort);
        
        console.log(`REQUEST_UPDATE: Looking up file for port ${serverPort}`);
        console.log(`REQUEST_UPDATE: Found file mapping: ${fileUri || 'NOT FOUND'}`);
        
        if (!fileUri) {
            console.warn(`REQUEST_UPDATE: No file mapping found for server on port ${serverPort}`);
            console.warn(`REQUEST_UPDATE: Available mappings: ${fileToServerMap.getAllFileUris().join(', ')}`);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('No analysis file associated with this server');
            return;
        }
        
        console.log(`REQUEST_UPDATE: Setting up SSE for analysis file: ${fileUri}`);
        
        // Register the SSE client with the manager
        sseManager.registerClient(fileUri, res);
        
        console.log(`REQUEST_UPDATE: SSE client registration completed for ${fileUri}`);
    }

    public attachToNodeServer(server: http.Server): void {
        if (this.upgradeAttached) {
            return;
        }
        this.upgradeAttached = true;
        this.collaborationRoomServer = new CollaborationRoomServer(server, '/codexr-room', {
            authorizeUpgrade: (request) => this.policy.isWebSocketAuthorized(request),
            resolveSession: (request) => this.remoteSessionAuthority.resolveCookie(request.headers.cookie),
            handleApplicationMessage: (messageContext, message) =>
                this.analysisRouter.handleCollaborationMessage(messageContext, message),
        });
        if (this.config.analysisSessionId) {
            this.analysisHost.publishAnalysisViewState();
        }
        const profileManager = CollaborationProfileManager.getInstance();
        this.collaborationProfileSubscription = profileManager?.onDidChange((configuration) => {
            const sessions = this.remoteSessionAuthority.updateInstallationProfile(
                profileManager.getInstallationId(),
                configuration.profile,
            );
            for (const session of sessions) {
                this.collaborationRoomServer?.updateSessionProfile(session.sessionId, session.profile);
            }
        }) || null;
        this.broadcastSignalingServer = new ScreenBroadcastSignalingServer(
            server,
            '/codexr-broadcast',
            (request) => this.policy.isWebSocketAuthorized(request),
        );
    }

}
