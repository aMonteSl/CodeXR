import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { sseManager } from './sse/SSEManager';
import { fileToServerMap } from '../../utils/fileToServerMap';
import { NetworkUtils } from '../utils/networkUtils';
import { ScreenBroadcastSignalingServer } from './broadcast/screenBroadcastSignalingServer';
import {
    CollaborationApplicationMessageContext,
    CollaborationMessage,
    CollaborationRoomServer,
} from './collaboration/collaborationRoomServer';
import {
    CollaborationConfiguration,
    CollaborationProfile,
    CollaborationProfileManager,
    ConnectedParticipantSummary,
    DEFAULT_COLLABORATION_PROFILE,
} from '../../collaboration';
import { RemoteSessionAuthority } from '../../remote_access';
import {
    HistoricalComparisonProgress,
    HistoricalComparisonRequest,
    HistoricalComparisonService,
    ProjectEvolutionRequest,
    ProjectEvolutionService,
    analysisUpdateEvents,
} from '../../code_analysis/historical';
import { DependencyGraphService } from '../../code_analysis/dependencies';
import {
    AnalysisSourceChangeBatch,
    AnalysisViewMode,
    analysisRefreshCoordinator,
} from '../../code_analysis/refresh';
import { SessionWatcherManager } from '../../code_analysis/engine/watchers/sessionWatcherManager';
import { UnifiedSessionRegistry } from '../../code_analysis/engine/core/sessionRegistry';
import { resolveAnalysisServerCapabilities } from './analysisServerCapabilities';
import { renderInvitationErrorPage, renderPairingPage } from './remote/pairingPage';
import {
    addCorsHeaders,
    getRemoteAddress,
    readBearerToken,
    readJsonBody,
    sendErrorResponse,
    sendJsonResponse,
} from './http/httpRespond';
import { StaticAssetServer } from './http/staticAssets';

/**
 * HTTP Server Configuration
 */
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
    private config: HttpServerConfig;
    private isRunning: boolean = false;
    private upgradeAttached = false;
    private broadcastSignalingServer: ScreenBroadcastSignalingServer | null = null;
    private collaborationRoomServer: CollaborationRoomServer | null = null;
    private collaborationProfileSubscription: vscode.Disposable | null = null;
    private readonly remoteSessionAuthority = new RemoteSessionAuthority();
    private remotePublicUrl: string | null = null;
    private historicalComparisonService: HistoricalComparisonService | null = null;
    private projectEvolutionService: ProjectEvolutionService | null = null;
    private dependencyGraphService: DependencyGraphService | null = null;
    private analysisUpdateSubscription: (() => void) | null = null;
    private historicalRefreshTimer: NodeJS.Timeout | null = null;
    private historicalRefreshQueued = false;
    private refreshCoordinatorDisposables: Array<() => void> = [];
    private analysisMode: string | undefined;

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

        if (this.config.extensionContext && this.config.analysisSessionId && this.config.staticRoot) {
            // Every analysis mode shares this launch path; a mode's declared
            // capabilities decide which optional feature services get attached.
            // XR-only services throw for non-XR sessions, so gating construction
            // here is what lets LivePanel/DOM/future modes launch successfully.
            const session = UnifiedSessionRegistry
                .getInstance(this.config.extensionContext)
                .getSession(this.config.analysisSessionId);
            this.analysisMode = session?.analysisMode;
            const capabilities = resolveAnalysisServerCapabilities(session?.analysisMode);

            if (capabilities.dependencyGraph) {
                this.dependencyGraphService = new DependencyGraphService(
                    this.config.extensionContext,
                    this.config.analysisSessionId,
                    this.config.staticRoot,
                );
                this.refreshCoordinatorDisposables.push(
                    analysisRefreshCoordinator.registerHandler(
                        this.config.analysisSessionId,
                        'dependency-graph',
                        this.refreshDependencyGraph.bind(this),
                    ),
                );

                if (this.analysisMode === 'LivePanel') {
                    // The LivePanel dependency summary (file and directory sessions —
                    // the service resolves the project root for file targets) shows
                    // every metric at once, so it must stay in lockstep with the
                    // classic re-analysis: recompute on every source change (incrementally,
                    // changed files only) and seed the initial dataset now. The result is
                    // pushed to the panel over SSE by refreshDependencyGraph().
                    const livePanelSessionId = this.config.analysisSessionId;
                    analysisRefreshCoordinator.setBackgroundRefresh(livePanelSessionId, 'dependency-graph', true);
                    this.refreshCoordinatorDisposables.push(
                        () => analysisRefreshCoordinator.setBackgroundRefresh(livePanelSessionId, 'dependency-graph', false),
                    );
                    void analysisRefreshCoordinator.forceRefreshMode(livePanelSessionId, 'dependency-graph');
                }
            }

            if (capabilities.historicalComparison) {
                this.historicalComparisonService = new HistoricalComparisonService(
                    this.config.extensionContext,
                    this.config.analysisSessionId,
                    this.config.staticRoot,
                );
                this.analysisUpdateSubscription = analysisUpdateEvents.on((event) => {
                    if (event.sessionId !== this.config.analysisSessionId) {
                        return;
                    }
                    if (this.analysisMode === 'LivePanel') {
                        // LivePanel has no XR view modes: refresh whenever an open
                        // comparison has a working-copy side (the schedule itself
                        // no-ops otherwise) and push the result over SSE.
                        this.scheduleHistoricalComparisonRefresh();
                        return;
                    }
                    const view = analysisRefreshCoordinator.getViewState(event.sessionId);
                    if (view.mode === 'historical-compare') {
                        this.scheduleHistoricalComparisonRefresh();
                    }
                });
            }

            if (capabilities.projectEvolution) {
                this.projectEvolutionService = new ProjectEvolutionService(
                    this.config.extensionContext,
                    this.config.analysisSessionId,
                    this.config.staticRoot,
                );
            }

            // Shared by every session-bound mode: publish analysis view-state
            // changes over the collaboration channel (no-op without a room).
            this.refreshCoordinatorDisposables.push(
                analysisRefreshCoordinator.onStateChanged(
                    this.config.analysisSessionId,
                    () => this.publishAnalysisViewState(),
                ),
            );
        }

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
        return this.collaborationRoomServer?.getConnectedParticipants(this.getCollaborationRoomId()) || [];
    }

    public onConnectedParticipantsChanged(
        listener: (participants: ConnectedParticipantSummary[]) => void,
    ): () => void {
        if (!this.collaborationRoomServer) {
            return () => undefined;
        }
        return this.collaborationRoomServer.onParticipantsChanged((changedRoomId, participants) => {
            if (changedRoomId === this.getCollaborationRoomId()) {
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
        this.analysisUpdateSubscription?.();
        this.analysisUpdateSubscription = null;
        if (this.historicalRefreshTimer) {
            clearTimeout(this.historicalRefreshTimer);
            this.historicalRefreshTimer = null;
        }
        for (const dispose of this.refreshCoordinatorDisposables.splice(0)) {
            dispose();
        }
        if (this.config.analysisSessionId) {
            analysisRefreshCoordinator.disposeSession(this.config.analysisSessionId);
        }
        void this.historicalComparisonService?.dispose();
        this.historicalComparisonService = null;
        void this.projectEvolutionService?.dispose();
        this.projectEvolutionService = null;
        void this.dependencyGraphService?.dispose();
        this.dependencyGraphService = null;
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

        if (!this.isRequestAuthorized(req, requestUrl)) {
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
            this.servePairingPage(res, url);
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
                sendJsonResponse(res, 200, await this.buildCollaborationSessionDescriptor(req));
                break;

            case '/collaboration/avatar-model':
                await this.serveAvatarModel(req, res);
                break;

            case '/remote/pair/request':
                await this.handlePairingRequest(req, res);
                break;

            case '/remote/identity':
                await this.handleBrowserIdentity(req, res);
                break;

            case '/remote/pair/confirm':
                await this.handlePairingConfirmation(req, res);
                break;

            case '/remote/browser':
                this.handleBrowserTokenExchange(req, res, url);
                break;

            case '/remote/profile':
                await this.handleRemoteProfileUpdate(req, res);
                break;

            case '/dependency-graph/summary':
                await this.handleDependencyGraphSummary(req, res);
                break;

            case '/historical/references':
                await this.handleHistoricalReferences(req, res);
                break;

            case '/historical/compare':
                await this.handleHistoricalCompare(req, res);
                break;

            default:
                sendErrorResponse(res, 404, 'API endpoint not found');
        }
    }

    /**
     * LivePanel REST endpoint: availability + Git references (working copy,
     * branches, tags, commits) for the historical comparison panel. Reuses the
     * same session-bound HistoricalComparisonService the XR mode uses.
     */
    private async handleHistoricalReferences(
        req: http.IncomingMessage,
        res: http.ServerResponse,
    ): Promise<void> {
        if (req.method !== 'GET') {
            sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }
        if (!this.historicalComparisonService) {
            sendErrorResponse(res, 404, 'Historical comparison is not available for this session.');
            return;
        }
        const availability = await this.historicalComparisonService.getAvailability();
        if (!availability.enabled) {
            sendJsonResponse(res, 200, { enabled: false, reason: availability.reason });
            return;
        }
        try {
            const references = await this.historicalComparisonService.getReferences();
            sendJsonResponse(res, 200, { enabled: true, reason: null, references });
        } catch (error) {
            sendErrorResponse(
                res,
                500,
                error instanceof Error ? error.message : 'Failed to list Git references.',
            );
        }
    }

    /**
     * LivePanel REST endpoint: start a historical comparison between two
     * sources. Responds 202 immediately; progress and the finished revision
     * are pushed over SSE (`historical-progress` / `historical-updated`), and
     * the client then fetches the /comparison/revision-N.json artifact.
     * A comparison with a working-copy side stays live: every incremental
     * re-analysis triggers a refresh (see the analysisUpdateEvents wiring).
     */
    private async handleHistoricalCompare(
        req: http.IncomingMessage,
        res: http.ServerResponse,
    ): Promise<void> {
        if (req.method !== 'POST') {
            sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }
        if (!this.historicalComparisonService) {
            sendErrorResponse(res, 404, 'Historical comparison is not available for this session.');
            return;
        }
        if (this.historicalComparisonService.isBusy()) {
            sendErrorResponse(res, 409, 'A historical comparison is already running.');
            return;
        }
        let request: HistoricalComparisonRequest;
        try {
            const payload = await readJsonBody(req);
            request = {
                leftSourceId: String(payload.leftSourceId || ''),
                rightSourceId: String(payload.rightSourceId || ''),
            };
        } catch {
            sendErrorResponse(res, 400, 'Invalid request body');
            return;
        }
        sendJsonResponse(res, 202, { accepted: true });
        void (async () => {
            try {
                await SessionWatcherManager.reconcileSession(this.config.analysisSessionId!);
                const result = await this.historicalComparisonService!.compare(request, (progress) => {
                    this.notifyLivePanelHistoricalProgress(progress);
                });
                this.notifyLivePanelHistoricalUpdated(result.revision);
            } catch (error) {
                this.notifyLivePanelHistoricalProgress({
                    state: 'error',
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        })();
    }

    /**
     * LivePanel-only REST endpoint: generates/refreshes the dependency graph for the
     * active directory/project session and returns the raw dataset. Rankings, cycle
     * grouping, and breakdowns are derived client-side (see directoryAnalysismain.js).
     */
    private async handleDependencyGraphSummary(
        req: http.IncomingMessage,
        res: http.ServerResponse,
    ): Promise<void> {
        if (req.method !== 'POST') {
            sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }
        if (!this.dependencyGraphService) {
            sendErrorResponse(res, 404, 'Dependency graph service is not available for this session.');
            return;
        }
        const availability = this.dependencyGraphService.getAvailability();
        if (!availability.enabled) {
            sendErrorResponse(res, 400, availability.reason || 'Dependency graph is not available.');
            return;
        }
        const scope = this.dependencyGraphService.getInitialScope();
        if (scope.kind !== 'directory') {
            sendErrorResponse(
                res,
                400,
                'Dependency graph summary is only available for directory or project LivePanel analyses.',
            );
            return;
        }
        if (this.dependencyGraphService.isBusy()) {
            sendErrorResponse(res, 409, 'A dependency analysis is already running.');
            return;
        }
        try {
            const dataset = await this.dependencyGraphService.analyze();
            sendJsonResponse(res, 200, dataset);
        } catch (error) {
            sendErrorResponse(
                res,
                500,
                error instanceof Error ? error.message : 'Dependency graph analysis failed.',
            );
        }
    }

    private async serveAvatarModel(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }

        const modelPath = CollaborationProfileManager.getInstance()?.getAvatarModelPath();
        if (!modelPath) {
            sendErrorResponse(res, 404, 'Avatar model is not installed');
            return;
        }
        const stats = await fs.promises.stat(modelPath);
        res.writeHead(200, {
            'Content-Type': 'model/gltf-binary',
            'Content-Length': stats.size,
            'Cache-Control': 'public, max-age=604800, immutable',
            'X-CodeXR-Asset-Source': 'RobotExpressive-by-Tomas-Laulhe-CC0',
        });
        if (req.method === 'HEAD') {
            res.end();
            return;
        }
        fs.createReadStream(modelPath)
            .on('error', () => sendErrorResponse(res, 500, 'Unable to read avatar model'))
            .pipe(res);
    }

    private isRequestAuthorized(req: http.IncomingMessage, requestUrl: string): boolean {
        if (!this.isRemoteRequest(req)) {
            return true;
        }
        const pathname = new URL(requestUrl, 'https://codexr.local').pathname;
        if (
            pathname === '/join'
            || pathname === '/api/remote/identity'
            || pathname === '/api/remote/pair/request'
            || pathname === '/api/remote/pair/confirm'
            || pathname === '/api/remote/browser'
            || pathname === '/api/remote/profile'
        ) {
            return true;
        }
        return !!this.remoteSessionAuthority.resolveCookie(req.headers.cookie);
    }

    private isWebSocketAuthorized(req: http.IncomingMessage): boolean {
        return !this.isRemoteRequest(req)
            || !!this.remoteSessionAuthority.resolveCookie(req.headers.cookie);
    }

    private isRemoteRequest(req: http.IncomingMessage): boolean {
        const hostname = String(req.headers.host || '').split(':')[0].toLowerCase();
        return hostname.endsWith('.trycloudflare.com')
            || typeof req.headers['cf-connecting-ip'] === 'string';
    }

    private async handlePairingRequest(
        req: http.IncomingMessage,
        res: http.ServerResponse,
    ): Promise<void> {
        if (req.method !== 'POST') {
            sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }
        try {
            const payload = await readJsonBody(req);
            const isCodeXR = payload.clientKind === 'codexr';
            const browserProfile = {
                identityMode: payload.identityMode === 'custom' ? 'custom' : 'anonymous',
                customName: String(payload.customName || ''),
                avatarId: DEFAULT_COLLABORATION_PROFILE.avatarId,
            } satisfies CollaborationProfile;
            const result = this.remoteSessionAuthority.createPairingRequest({
                invitationToken: String(payload.invitationToken || ''),
                remoteAddress: getRemoteAddress(req),
                installationId: isCodeXR
                    ? String(payload.installationId || '')
                    : `browser-${crypto.randomUUID()}`,
                profile: isCodeXR
                    ? payload.profile as CollaborationProfile
                    : browserProfile,
                clientKind: isCodeXR ? 'codexr' : 'browser',
                identityToken: isCodeXR ? undefined : String(payload.identityToken || ''),
            });
            sendJsonResponse(res, 202, result);
        } catch (error) {
            this.sendPairingError(res, error);
        }
    }

    private async handleBrowserIdentity(
        req: http.IncomingMessage,
        res: http.ServerResponse,
    ): Promise<void> {
        if (req.method !== 'POST') {
            sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }
        try {
            const payload = await readJsonBody(req);
            const result = this.remoteSessionAuthority.createBrowserIdentity({
                invitationToken: String(payload.invitationToken || ''),
                remoteAddress: getRemoteAddress(req),
            });
            sendJsonResponse(res, 200, result);
        } catch (error) {
            this.sendPairingError(res, error);
        }
    }

    private async handlePairingConfirmation(
        req: http.IncomingMessage,
        res: http.ServerResponse,
    ): Promise<void> {
        if (req.method !== 'POST') {
            sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }
        try {
            const payload = await readJsonBody(req);
            const result = this.remoteSessionAuthority.confirmPairing(
                String(payload.requestId || ''),
                String(payload.code || ''),
                getRemoteAddress(req),
            );
            const origin = this.getRequestOrigin(req);
            const browserUrl = new URL('/api/remote/browser', origin);
            browserUrl.searchParams.set('token', result.browserToken);
            sendJsonResponse(res, 200, {
                extensionToken: result.extensionToken,
                browserUrl: browserUrl.toString(),
                expiresAt: result.expiresAt,
            });
        } catch (error) {
            this.sendPairingError(res, error);
        }
    }

    private handleBrowserTokenExchange(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        requestUrl: string,
    ): void {
        if (req.method !== 'GET') {
            sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }
        const token = new URL(requestUrl, 'https://codexr.local').searchParams.get('token') || '';
        const session = this.remoteSessionAuthority.exchangeBrowserToken(token);
        if (!session) {
            sendErrorResponse(res, 404, 'Resource not found');
            return;
        }
        const secure = this.isRemoteRequest(req) ? '; Secure' : '';
        res.writeHead(303, {
            Location: '/',
            'Cache-Control': 'no-store',
            'Set-Cookie': `codexr_session=${session.sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${secure}`,
        });
        res.end();
    }

    private async handleRemoteProfileUpdate(
        req: http.IncomingMessage,
        res: http.ServerResponse,
    ): Promise<void> {
        if (req.method !== 'PUT') {
            sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }
        try {
            const token = readBearerToken(req);
            const payload = await readJsonBody(req);
            const sessions = this.remoteSessionAuthority.updateExtensionProfile(
                token,
                payload.profile as CollaborationProfile,
            );
            for (const session of sessions) {
                this.collaborationRoomServer?.updateSessionProfile(session.sessionId, session.profile);
            }
            sendJsonResponse(res, 200, { profile: sessions[0]?.profile });
        } catch {
            sendErrorResponse(res, 404, 'Resource not found');
        }
    }

    private servePairingPage(res: http.ServerResponse, requestUrl: string): void {
        const invitationToken = new URL(requestUrl, 'https://codexr.local')
            .searchParams.get('invite') || '';
        if (
            !/^[a-zA-Z0-9_-]{20,100}$/.test(invitationToken)
            || !this.remoteSessionAuthority.isInvitationValid(invitationToken)
        ) {
            // A guest clicking a stale link gets an explanation, not raw JSON.
            this.sendGuestHtml(res, 404, renderInvitationErrorPage(
                'This invitation is no longer valid',
                'Invitation links expire 30 minutes after they are created, and they only work while the host is sharing the server. Ask the host for a new link.',
            ));
            return;
        }
        this.sendGuestHtml(res, 200, renderPairingPage(invitationToken));
    }

    /**
     * Send a guest-facing HTML page. Everything the page needs is inlined, so
     * the policy stays as tight as the pairing flow requires.
     */
    private sendGuestHtml(res: http.ServerResponse, statusCode: number, html: string): void {
        res.writeHead(statusCode, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'",
        });
        res.end(html);
    }

    private getRequestOrigin(req: http.IncomingMessage): string {
        if (this.isRemoteRequest(req) && this.remotePublicUrl) {
            return this.remotePublicUrl;
        }
        const forwardedProtocol = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
        const protocol = forwardedProtocol || (this.isRemoteRequest(req) ? 'https' : 'http');
        return `${protocol}://${req.headers.host || `localhost:${this.config.port}`}`;
    }

    private sendPairingError(res: http.ServerResponse, error: unknown): void {
        const code = error instanceof Error ? error.message : '';
        if (code === 'too-many-pairing-requests') {
            sendErrorResponse(res, 429, 'Too many pending requests');
            return;
        }
        if (code === 'invalid-pairing-code') {
            sendErrorResponse(res, 401, 'Invalid pairing code. Ask the host for a new one.');
            return;
        }
        if (code === 'pairing-code-revoked') {
            sendErrorResponse(res, 401, 'This code is no longer valid. Ask the host for a new one.');
            return;
        }
        if (code === 'pairing-attempts-exceeded') {
            sendErrorResponse(res, 429, 'Pairing attempts exceeded');
            return;
        }
        if (code === 'pairing-expired') {
            sendErrorResponse(res, 410, 'Pairing request expired');
            return;
        }
        if (code === 'invalid-profile') {
            sendErrorResponse(res, 400, 'Invalid collaboration profile');
            return;
        }
        if (code === 'invalid-browser-identity') {
            sendErrorResponse(res, 401, 'Invalid browser identity');
            return;
        }
        sendErrorResponse(res, 404, 'Resource not found');
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
            authorizeUpgrade: (request) => this.isWebSocketAuthorized(request),
            resolveSession: (request) => this.remoteSessionAuthority.resolveCookie(request.headers.cookie),
            handleApplicationMessage: (messageContext, message) =>
                this.handleCollaborationMessage(messageContext, message),
        });
        if (this.config.analysisSessionId) {
            this.publishAnalysisViewState();
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
            (request) => this.isWebSocketAuthorized(request),
        );
    }

    /**
     * Dispatches collaboration room application messages to their feature
     * handler. The guard order is part of the contract: analysis-mode and
     * dependency-graph messages are always considered, while historical and
     * project-evolution messages require the historical comparison service
     * to be attached to this server.
     */
    private async handleCollaborationMessage(
        messageContext: CollaborationApplicationMessageContext,
        message: CollaborationMessage,
    ): Promise<boolean> {
        if (message.type === 'analysis-mode-selection') {
            this.setAnalysisViewMode('selection', 'visualization-menu');
            return true;
        }
        if (message.type === 'analysis-mode-activate') {
            return this.handleAnalysisModeActivateMessage(message);
        }
        if (message.type === 'dependency-graph-settings') {
            return this.handleDependencyGraphSettingsMessage(messageContext, message);
        }
        if (message.type === 'dependency-file-scope-request') {
            return this.handleDependencyFileScopeRequestMessage(messageContext, message);
        }
        if (message.type === 'dependency-graph-start') {
            console.log('[Code-XR Fix][Server] dependency-graph-start received (room:', messageContext.roomId, ')');
            return this.handleDependencyGraphStartMessage(messageContext, message);
        }
        if (!this.historicalComparisonService) {
            return false;
        }
        if (message.type === 'historical-comparison-references-request') {
            return this.handleHistoricalComparisonReferencesMessage(messageContext);
        }
        if (message.type === 'historical-comparison-start') {
            return this.handleHistoricalComparisonStartMessage(messageContext, message);
        }
        if (this.projectEvolutionService && message.type === 'project-evolution-references-request') {
            return this.handleProjectEvolutionReferencesMessage(messageContext);
        }
        if (this.projectEvolutionService && message.type === 'project-evolution-clear') {
            return this.handleProjectEvolutionClearMessage(messageContext);
        }
        if (this.projectEvolutionService && message.type === 'project-evolution-apply-frame') {
            return this.handleProjectEvolutionApplyFrameMessage(messageContext, message);
        }
        if (this.projectEvolutionService && message.type === 'project-evolution-start') {
            return this.handleProjectEvolutionStartMessage(messageContext, message);
        }
        return false;
    }

    private async handleAnalysisModeActivateMessage(message: CollaborationMessage): Promise<boolean> {
        const requestedMode = String(message.payload?.mode || '');
        if (
            requestedMode === 'single'
            || requestedMode === 'historical-compare'
            || requestedMode === 'project-evolution'
            || requestedMode === 'dependency-graph'
        ) {
            const mode = requestedMode as Exclude<AnalysisViewMode, 'selection'>;
            let controllerView: string | undefined;
            if (mode !== 'single') {
                const entityKind = mode === 'historical-compare'
                    ? 'historical-comparison'
                    : mode === 'project-evolution'
                        ? 'project-evolution'
                        : 'dependency-graph';
                const snapshot = this.collaborationRoomServer?.getServerEntity(
                    this.getCollaborationRoomId(),
                    entityKind,
                    'main',
                );
                const available = mode === 'historical-compare' || mode === 'project-evolution'
                    ? !!snapshot?.result
                    : typeof snapshot?.datasetUrl === 'string';
                analysisRefreshCoordinator.setSnapshotAvailable(
                    this.config.analysisSessionId!,
                    mode,
                    available,
                );
                const allowsEmptyShell = mode === 'historical-compare'
                    || mode === 'project-evolution';
                if (!available && !allowsEmptyShell) {
                    this.setAnalysisViewMode('selection', 'visualization-menu');
                    return true;
                }
                controllerView = mode === 'historical-compare' && available
                    ? 'historical.mapping'
                    : mode === 'historical-compare'
                        ? 'historical.selection'
                        : mode === 'dependency-graph'
                            ? 'dependency.settings'
                            : 'project-evolution';
            } else {
                controllerView = 'single.mapping';
            }
            await this.activateAnalysisViewMode(mode, controllerView);
        }
        return true;
    }

    private handleDependencyGraphSettingsMessage(
        messageContext: CollaborationApplicationMessageContext,
        message: CollaborationMessage,
    ): boolean {
        const allowedLayouts = new Set(['force-3d', 'hierarchical', 'metric-space']);
        const allowedRelations = new Set([
            'import', 'include', 'require', 'inheritance', 'implementation', 'call', 'contains',
        ]);
        const allowedMetrics = new Set([
            'degree', 'fanIn', 'fanOut', 'totalLines', 'relationCount',
            'cycleSize', 'language',
        ]);
        const allowedEdgeEncodings = new Set([
            'relation-type', 'intensity-color', 'intensity-width', 'intensity-combined',
        ]);
        // Flow-particle preferences are room-shared; ids mirror the runtime's
        // FLOW_SIZE_OPTIONS / FLOW_SPEED_OPTIONS catalogues.
        const allowedFlowSizes = new Set(['s', 'm', 'l', 'xl']);
        const allowedFlowSpeeds = new Set(['x05', 'x1', 'x2', 'x3']);
        const payload = message.payload || {};
        const requestedScope = payload.scope && typeof payload.scope === 'object'
            ? payload.scope as Record<string, unknown>
            : null;
        const requestedRelativePath = typeof requestedScope?.relativePath === 'string'
            ? requestedScope.relativePath.replace(/\\/g, '/')
            : null;
        const scope = requestedScope
            && (requestedScope.kind === 'directory' || requestedScope.kind === 'file')
            && requestedRelativePath !== null
            && requestedRelativePath.length <= 1024
            && !requestedRelativePath.startsWith('/')
            && !requestedRelativePath.split('/').includes('..')
            ? {
                kind: requestedScope.kind,
                relativePath: requestedRelativePath,
            }
            : null;
        const relationFilters = Object.fromEntries(
            Object.entries(payload.relationFilters || {})
                .filter(([key, value]) => allowedRelations.has(key) && typeof value === 'boolean'),
        );
        const mapping = Object.fromEntries(
            Object.entries(payload.mapping || {})
                .filter(([, value]) => allowedMetrics.has(String(value))),
        );
        messageContext.upsertSharedEntity({
            entityKind: 'dependency-graph',
            entityId: 'main',
            ...(allowedLayouts.has(String(payload.layout)) ? { layout: payload.layout } : {}),
            ...(typeof payload.showExternal === 'boolean' ? { showExternal: payload.showExternal } : {}),
            ...(allowedEdgeEncodings.has(String(payload.edgeEncoding))
                ? { edgeEncoding: payload.edgeEncoding }
                : {}),
            ...(allowedFlowSizes.has(String(payload.flowSize)) ? { flowSize: payload.flowSize } : {}),
            ...(allowedFlowSpeeds.has(String(payload.flowSpeed)) ? { flowSpeed: payload.flowSpeed } : {}),
            ...(Object.keys(relationFilters).length ? { relationFilters } : {}),
            ...(Object.keys(mapping).length ? { mapping } : {}),
            ...(scope ? { scope } : {}),
        });
        return true;
    }

    private async handleDependencyFileScopeRequestMessage(
        messageContext: CollaborationApplicationMessageContext,
        message: CollaborationMessage,
    ): Promise<boolean> {
        if (!this.dependencyGraphService) {
            return false;
        }
        try {
            const relativePath = String(message.payload?.relativePath || '');
            const dataset = await this.dependencyGraphService.analyzeFileScope(
                relativePath,
                (progressMessage) => messageContext.send({
                    type: 'dependency-graph-progress',
                    payload: { message: progressMessage },
                }),
            );
            messageContext.upsertSharedEntity({
                entityKind: 'dependency-graph',
                entityId: 'main',
                mode: 'dependency-graph',
                status: 'ready',
                message: 'File dependency scope ready.',
                datasetUrl: `/dependencies/dependency-scope-${dataset.revision}.json`,
                revision: dataset.revision,
                scope: {
                    kind: 'file',
                    relativePath: dataset.targetRelativePath || relativePath,
                },
            });
        } catch (error) {
            messageContext.send({
                type: 'dependency-graph-error',
                payload: { message: error instanceof Error ? error.message : String(error) },
            });
        }
        return true;
    }

    private async handleDependencyGraphStartMessage(
        messageContext: CollaborationApplicationMessageContext,
        message: CollaborationMessage,
    ): Promise<boolean> {
        if (!this.dependencyGraphService) {
            // Answer instead of silently dropping: the scene shows the reason
            // and the extension host log names the misconfiguration.
            console.warn('[Code-XR Fix][Server] dependency-graph-start received but no dependency service is attached (mode:', this.analysisMode, ')');
            messageContext.send({
                type: 'dependency-graph-error',
                payload: { message: 'Dependency analysis is not attached to this analysis server.' },
            });
            return true;
        }
        const availability = this.dependencyGraphService.getAvailability();
        if (!availability.enabled) {
            messageContext.send({
                type: 'dependency-graph-error',
                payload: { message: availability.reason },
            });
            return true;
        }
        if (this.dependencyGraphService.isBusy()) {
            messageContext.send({
                type: 'dependency-graph-error',
                payload: { message: 'A dependency analysis is already running.' },
            });
            return true;
        }
        const existingDependencyState = this.collaborationRoomServer?.getServerEntity(
            this.getCollaborationRoomId(),
            'dependency-graph',
            'main',
        );
        const hasCachedDataset = typeof existingDependencyState?.datasetUrl === 'string'
            && existingDependencyState.datasetUrl.length > 0;
        const forceFullRefresh = message.payload?.forceFull === true;
        console.log('[Code-XR Fix][Server] dependency-graph-start accepted (cached:', hasCachedDataset, ', forceFull:', forceFullRefresh, ')');
        analysisRefreshCoordinator.setSnapshotAvailable(
            this.config.analysisSessionId!,
            'dependency-graph',
            hasCachedDataset,
        );
        await this.activateAnalysisViewMode('dependency-graph', 'dependency.settings');
        messageContext.upsertSharedEntity({
            entityKind: 'dependency-graph',
            entityId: 'main',
            mode: 'dependency-graph',
            status: hasCachedDataset && !forceFullRefresh ? 'ready' : 'analyzing',
            message: hasCachedDataset && !forceFullRefresh
                ? 'Restoring dependency graph...'
                : 'Scanning project dependencies...',
            layout: existingDependencyState?.layout || 'force-3d',
            showExternal: typeof existingDependencyState?.showExternal === 'boolean'
                ? existingDependencyState.showExternal
                : false,
            edgeEncoding: existingDependencyState?.edgeEncoding || 'relation-type',
            flowSize: existingDependencyState?.flowSize || 'm',
            flowSpeed: existingDependencyState?.flowSpeed || 'x1',
            relationFilters: existingDependencyState?.relationFilters || {
                import: true,
                include: true,
                require: true,
                inheritance: true,
                implementation: true,
                call: false,
                contains: true,
            },
            mapping: existingDependencyState?.mapping || {
                size: 'degree',
                height: 'fanIn',
                color: 'language',
                x: 'fanOut',
                z: 'fanIn',
            },
            scope: existingDependencyState?.scope || {
                ...this.dependencyGraphService.getInitialScope(),
            },
        });
        if (!hasCachedDataset || forceFullRefresh) {
            console.log('[Code-XR Fix][Server] dependency-graph refresh requested for session', this.config.analysisSessionId);
            analysisRefreshCoordinator.requestRefresh(
                this.config.analysisSessionId!,
                'dependency-graph',
            );
        }
        return true;
    }

    private async handleHistoricalComparisonReferencesMessage(
        messageContext: CollaborationApplicationMessageContext,
    ): Promise<boolean> {
        if (!this.historicalComparisonService) {
            return false;
        }
        try {
            const references = await this.historicalComparisonService.getReferences();
            messageContext.send({
                type: 'historical-comparison-references',
                payload: references,
            });
        } catch (error) {
            messageContext.send({
                type: 'historical-comparison-error',
                payload: {
                    code: 'references-unavailable',
                    message: error instanceof Error ? error.message : String(error),
                },
            });
        }
        return true;
    }

    private handleHistoricalComparisonStartMessage(
        messageContext: CollaborationApplicationMessageContext,
        message: CollaborationMessage,
    ): boolean {
        if (!this.historicalComparisonService) {
            return false;
        }
        if (this.historicalComparisonService.isBusy()) {
            messageContext.send({
                type: 'historical-comparison-error',
                payload: {
                    code: 'comparison-busy',
                    message: 'Another historical comparison is already running.',
                },
            });
            return true;
        }
        const request: HistoricalComparisonRequest = {
            leftSourceId: String(message.payload?.leftSourceId || ''),
            rightSourceId: String(message.payload?.rightSourceId || ''),
        };
        analysisRefreshCoordinator.setRefreshEnabled(
            this.config.analysisSessionId!,
            'historical-compare',
            request.leftSourceId === 'working-copy' || request.rightSourceId === 'working-copy',
        );
        this.setAnalysisViewMode('historical-compare', 'historical.selection');
        void (async () => {
            try {
                await SessionWatcherManager.reconcileSession(
                    this.config.analysisSessionId!,
                );
                await analysisRefreshCoordinator.refreshMode(
                    this.config.analysisSessionId!,
                    'historical-compare',
                );
                const result = await this.historicalComparisonService!.compare(request, (progress) => {
                    messageContext.broadcast({
                        type: 'historical-comparison-progress',
                        payload: progress,
                    });
                });
                messageContext.upsertSharedEntity({
                    entityKind: 'historical-comparison',
                    entityId: 'main',
                    mode: 'historical-compare',
                    result,
                });
                analysisRefreshCoordinator.setSnapshotAvailable(
                    this.config.analysisSessionId!,
                    'historical-compare',
                    true,
                );
                this.setAnalysisViewMode('historical-compare', 'historical.mapping');
            } catch (error) {
                messageContext.broadcast({
                    type: 'historical-comparison-error',
                    payload: {
                        code: error instanceof Error ? error.message : 'comparison-failed',
                        message: error instanceof Error ? error.message : String(error),
                    },
                });
            }
        })();
        return true;
    }

    private async handleProjectEvolutionReferencesMessage(
        messageContext: CollaborationApplicationMessageContext,
    ): Promise<boolean> {
        if (!this.projectEvolutionService) {
            return false;
        }
        try {
            const references = await this.projectEvolutionService.getReferences();
            messageContext.send({
                type: 'project-evolution-references',
                payload: references,
            });
        } catch (error) {
            messageContext.send({
                type: 'project-evolution-error',
                payload: {
                    code: 'references-unavailable',
                    message: error instanceof Error ? error.message : String(error),
                },
            });
        }
        return true;
    }

    private async handleProjectEvolutionClearMessage(
        messageContext: CollaborationApplicationMessageContext,
    ): Promise<boolean> {
        if (!this.projectEvolutionService) {
            return false;
        }
        try {
            await this.projectEvolutionService.clearGeneratedMovie();
            messageContext.removeSharedEntity('project-evolution', 'main');
            if (this.config.analysisSessionId) {
                analysisRefreshCoordinator.setSnapshotAvailable(
                    this.config.analysisSessionId,
                    'project-evolution',
                    false,
                );
                this.setAnalysisViewMode('project-evolution', 'project-evolution');
            }
            messageContext.broadcast({
                type: 'project-evolution-cleared',
                payload: {
                    message: 'Project evolution movie cleared.',
                },
            });
        } catch (error) {
            messageContext.broadcast({
                type: 'project-evolution-error',
                payload: {
                    code: error instanceof Error ? error.message : 'project-evolution-clear-failed',
                    message: error instanceof Error ? error.message : String(error),
                },
            });
        }
        return true;
    }

    private async handleProjectEvolutionApplyFrameMessage(
        messageContext: CollaborationApplicationMessageContext,
        message: CollaborationMessage,
    ): Promise<boolean> {
        if (!this.projectEvolutionService) {
            return false;
        }
        try {
            const payload = message.payload || {};
            const revision = Number(payload.revision);
            const frameIndex = Number(payload.frameIndex);
            const requestId = typeof payload.requestId === 'string'
                ? payload.requestId
                : undefined;
            const result = await this.projectEvolutionService.applyFrameToBridge(revision, frameIndex);
            messageContext.broadcast({
                type: 'project-evolution-frame-applied',
                payload: {
                    ...result,
                    requestId,
                },
            });
        } catch (error) {
            messageContext.broadcast({
                type: 'project-evolution-error',
                payload: {
                    code: error instanceof Error ? error.message : 'project-evolution-apply-frame-failed',
                    message: error instanceof Error ? error.message : String(error),
                },
            });
        }
        return true;
    }

    private handleProjectEvolutionStartMessage(
        messageContext: CollaborationApplicationMessageContext,
        message: CollaborationMessage,
    ): boolean {
        if (!this.projectEvolutionService) {
            return false;
        }
        if (this.projectEvolutionService.isBusy()) {
            messageContext.send({
                type: 'project-evolution-error',
                payload: {
                    code: 'project-evolution-busy',
                    message: 'Another project evolution analysis is already running.',
                },
            });
            return true;
        }
        const payload = message.payload || {};
        const request: ProjectEvolutionRequest = {
            mode: payload.mode === 'range' || payload.mode === 'manual'
                ? payload.mode
                : 'auto',
            startSourceId: typeof payload.startSourceId === 'string'
                ? payload.startSourceId
                : undefined,
            endSourceId: typeof payload.endSourceId === 'string'
                ? payload.endSourceId
                : undefined,
            sourceIds: Array.isArray(payload.sourceIds)
                ? payload.sourceIds.map((value: unknown) => String(value)).filter(Boolean)
                : undefined,
            maxFrames: Number.isFinite(Number(payload.maxFrames))
                ? Number(payload.maxFrames)
                : undefined,
        };
        analysisRefreshCoordinator.setRefreshEnabled(
            this.config.analysisSessionId!,
            'project-evolution',
            false,
        );
        this.setAnalysisViewMode('project-evolution', 'project-evolution');
        void (async () => {
            try {
                await SessionWatcherManager.reconcileSession(
                    this.config.analysisSessionId!,
                );
                const result = await this.projectEvolutionService!.generate(request, (progress) => {
                    messageContext.broadcast({
                        type: 'project-evolution-progress',
                        payload: progress,
                    });
                });
                messageContext.upsertSharedEntity({
                    entityKind: 'project-evolution',
                    entityId: 'main',
                    mode: 'project-evolution',
                    result,
                });
                analysisRefreshCoordinator.setSnapshotAvailable(
                    this.config.analysisSessionId!,
                    'project-evolution',
                    true,
                );
                this.setAnalysisViewMode('project-evolution', 'project-evolution');
            } catch (error) {
                if (error instanceof Error && error.message === 'project-evolution-cleared') {
                    return;
                }
                messageContext.broadcast({
                    type: 'project-evolution-error',
                    payload: {
                        code: error instanceof Error ? error.message : 'project-evolution-failed',
                        message: error instanceof Error ? error.message : String(error),
                    },
                });
            }
        })();
        return true;
    }

    private async buildCollaborationSessionDescriptor(
        req: http.IncomingMessage,
    ): Promise<Record<string, unknown>> {
        const fileUri = fileToServerMap.findFileByPort(this.config.port);
        const mapping = fileUri ? fileToServerMap.getServerInfo(fileUri) : null;
        const activeServerId = mapping?.activeServerId || `port-${this.config.port}`;
        const collaborationConfiguration = CollaborationProfileManager.getInstance()?.getConfiguration()
            || this.getDefaultCollaborationConfiguration();
        const session = this.remoteSessionAuthority.resolveCookie(req.headers.cookie);
        const profile = session?.profile || DEFAULT_COLLABORATION_PROFILE;
        const historicalComparison = this.historicalComparisonService
            ? await this.historicalComparisonService.getAvailability()
            : {
                enabled: false,
                reason: 'Historical comparison is not available for this server.',
            };
        const projectEvolution = this.projectEvolutionService
            ? await this.projectEvolutionService.getAvailability()
            : {
                enabled: false,
                reason: 'Project evolution is not available for this server.',
            };
        const dependencyGraph = this.dependencyGraphService?.getAvailability() || {
            enabled: false,
            reason: 'Dependency analysis is not available for this server.',
        };

        return {
            roomId: `codexr-session:${activeServerId}`,
            activeServerId,
            fileUri: fileUri || null,
            capabilities: {
                collaboration: true,
                presence: true,
                media: true,
                historicalComparison: historicalComparison.enabled,
                historicalComparisonReason: historicalComparison.reason,
                projectEvolution: projectEvolution.enabled,
                projectEvolutionReason: projectEvolution.reason,
                dependencyGraph: dependencyGraph.enabled,
                dependencyGraphReason: dependencyGraph.reason,
            },
            roomSocketPath: '/codexr-room',
            broadcastSocketPath: '/codexr-broadcast',
            collaborationProfile: profile,
            avatarModelAvailable: collaborationConfiguration.avatarModelAvailable,
            profileRevision: collaborationConfiguration.revision,
        };
    }

    private getCollaborationRoomId(): string {
        const fileUri = fileToServerMap.findFileByPort(this.config.port);
        const mapping = fileUri ? fileToServerMap.getServerInfo(fileUri) : null;
        const activeServerId = mapping?.activeServerId || `port-${this.config.port}`;
        return `codexr-session:${activeServerId}`;
    }

    private scheduleHistoricalComparisonRefresh(): void {
        if (!this.historicalComparisonService?.hasLiveSource()) {
            return;
        }
        this.historicalRefreshQueued = true;
        if (this.historicalRefreshTimer) {
            clearTimeout(this.historicalRefreshTimer);
        }
        this.historicalRefreshTimer = setTimeout(() => {
            this.historicalRefreshTimer = null;
            void this.refreshHistoricalComparison();
        }, 350);
    }

    private async refreshDependencyGraph(batch: AnalysisSourceChangeBatch): Promise<void> {
        if (!this.dependencyGraphService) {
            return;
        }
        console.log('[Code-XR Fix][Server] dependency analysis starting (revision', batch.sourceRevision, ')');
        try {
            this.collaborationRoomServer?.upsertServerEntity(this.getCollaborationRoomId(), {
                entityKind: 'dependency-graph',
                entityId: 'main',
                status: 'analyzing',
                message: 'Refreshing changed project dependencies...',
            });
            const dataset = await this.dependencyGraphService.analyze({
                sourceRevision: batch.sourceRevision,
                changedFiles: batch.changedFiles,
                addedFiles: batch.addedFiles,
                removedFiles: batch.removedFiles,
                forceFullScan: batch.forceRefresh || !this.dependencyGraphService.hasGeneratedDataset(),
            }, (message) => {
                this.collaborationRoomServer?.broadcastServerMessage(this.getCollaborationRoomId(), {
                    type: 'dependency-graph-progress',
                    payload: { message },
                });
            });
            const currentEntity = this.collaborationRoomServer?.getServerEntity(
                this.getCollaborationRoomId(),
                'dependency-graph',
                'main',
            );
            const currentScope = currentEntity?.scope && typeof currentEntity.scope === 'object'
                ? currentEntity.scope as Record<string, unknown>
                : null;
            if (
                dataset.targetType === 'directory'
                && currentScope?.kind === 'file'
                && typeof currentScope.relativePath === 'string'
            ) {
                const fileDataset = await this.dependencyGraphService.analyzeFileScope(
                    currentScope.relativePath,
                );
                this.collaborationRoomServer?.upsertServerEntity(this.getCollaborationRoomId(), {
                    entityKind: 'dependency-graph',
                    entityId: 'main',
                    mode: 'dependency-graph',
                    status: 'ready',
                    message: 'File dependencies refreshed.',
                    datasetUrl: `/dependencies/dependency-scope-${fileDataset.revision}.json`,
                    projectDatasetUrl: `/dependencies/dependency-graph-${dataset.revision}.json`,
                    revision: fileDataset.revision,
                    sourceRevision: dataset.sourceRevision,
                    scope: {
                        kind: 'file',
                        relativePath: fileDataset.targetRelativePath || currentScope.relativePath,
                    },
                });
                return;
            }
            this.collaborationRoomServer?.upsertServerEntity(this.getCollaborationRoomId(), {
                entityKind: 'dependency-graph',
                entityId: 'main',
                mode: 'dependency-graph',
                status: 'ready',
                message: 'Dependency graph refreshed.',
                datasetUrl: `/dependencies/dependency-graph-${dataset.revision}.json`,
                revision: dataset.revision,
                sourceRevision: dataset.sourceRevision,
            });
            this.notifyLivePanelDependencyUpdated(dataset.revision);
        } catch (error) {
            console.error('[Code-XR Fix][Server] dependency analysis failed:', error);
            this.collaborationRoomServer?.upsertServerEntity(this.getCollaborationRoomId(), {
                entityKind: 'dependency-graph',
                entityId: 'main',
                status: 'error',
                message: error instanceof Error ? error.message : String(error),
            });
            this.collaborationRoomServer?.broadcastServerMessage(this.getCollaborationRoomId(), {
                type: 'dependency-graph-error',
                payload: { message: error instanceof Error ? error.message : String(error) },
            });
            throw error;
        }
    }

    private notifyLivePanelHistoricalProgress(progress: HistoricalComparisonProgress): void {
        const fileUri = this.getLivePanelSseTarget();
        if (!fileUri) {
            return;
        }
        sseManager.sendCustomMessage(fileUri, {
            type: 'historical-progress',
            sessionId: this.config.analysisSessionId,
            state: progress.state,
            message: progress.message,
            revision: progress.revision,
        });
    }

    private notifyLivePanelHistoricalUpdated(revision?: number): void {
        const fileUri = this.getLivePanelSseTarget();
        if (!fileUri) {
            return;
        }
        sseManager.sendCustomMessage(fileUri, {
            type: 'historical-updated',
            sessionId: this.config.analysisSessionId,
            revision,
        });
    }

    /**
     * LivePanel pages have no collaboration room; feature updates reach them
     * over SSE, keyed by the analysis file this server serves. Returns null
     * for every other mode so the notify helpers are safe to call anywhere.
     */
    private getLivePanelSseTarget(): string | null {
        if (this.analysisMode !== 'LivePanel') {
            return null;
        }
        return fileToServerMap.findFileByPort(this.config.port);
    }

    private notifyLivePanelDependencyUpdated(revision: number): void {
        // Delivered over SSE so the page reloads the freshly written
        // dependency-graph.json (see getLivePanelSseTarget).
        const fileUri = this.getLivePanelSseTarget();
        if (!fileUri) {
            return;
        }
        sseManager.sendCustomMessage(fileUri, {
            type: 'dependency-updated',
            sessionId: this.config.analysisSessionId,
            revision,
        });
    }

    private setAnalysisViewMode(mode: AnalysisViewMode, controllerView: string): void {
        if (!this.config.analysisSessionId) {
            return;
        }
        analysisRefreshCoordinator.setActiveMode(this.config.analysisSessionId, mode, controllerView);
    }

    private async activateAnalysisViewMode(
        mode: Exclude<AnalysisViewMode, 'selection'>,
        controllerView: string,
    ): Promise<void> {
        if (!this.config.analysisSessionId) {
            return;
        }
        analysisRefreshCoordinator.activateMode(this.config.analysisSessionId, mode, controllerView);
        // Watcher reconciliation must never gate the collaboration reply: a
        // slow or stuck reconcile left dependency-graph-start unanswered
        // (total silence in the scene) while historical — which does not
        // await it — kept working. Run it in the background and log failures.
        void SessionWatcherManager.reconcileSession(this.config.analysisSessionId).catch((error) => {
            console.warn('[Code-XR Fix][Server] Session watcher reconciliation failed:', error);
        });
    }

    private publishAnalysisViewState(): void {
        if (!this.config.analysisSessionId || !this.collaborationRoomServer) {
            return;
        }
        this.collaborationRoomServer.upsertServerEntity(
            this.getCollaborationRoomId(),
            analysisRefreshCoordinator.getViewState(this.config.analysisSessionId),
        );
    }

    private async refreshHistoricalComparison(): Promise<void> {
        if (!this.historicalComparisonService || !this.historicalRefreshQueued) {
            return;
        }
        this.historicalRefreshQueued = false;
        if (this.historicalComparisonService.isBusy()) {
            this.scheduleHistoricalComparisonRefresh();
            return;
        }
        try {
            const result = await this.historicalComparisonService.refreshActiveComparison((progress) => {
                this.collaborationRoomServer?.broadcastServerMessage(this.getCollaborationRoomId(), {
                    type: 'historical-comparison-progress',
                    payload: progress,
                });
            });
            if (result) {
                this.collaborationRoomServer?.upsertServerEntity(this.getCollaborationRoomId(), {
                    entityKind: 'historical-comparison',
                    entityId: 'main',
                    mode: 'historical-compare',
                    result,
                });
                this.notifyLivePanelHistoricalUpdated(result.revision);
            }
        } catch (error) {
            console.error('[CodeXR][HistoricalComparison] Live refresh failed:', error);
            this.scheduleHistoricalComparisonRefresh();
        }
    }

    private getDefaultCollaborationConfiguration(): CollaborationConfiguration {
        return {
            profile: {
                identityMode: 'anonymous',
                customName: '',
                avatarId: 'avatar-1',
            },
            avatarModelAvailable: false,
            revision: 0,
        };
    }
}
