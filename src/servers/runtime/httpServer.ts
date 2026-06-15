import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { parse as parseUrl } from 'url';
import { sseManager } from './sse/SSEManager';
import { fileToServerMap } from '../../utils/fileToServerMap';
import { NetworkUtils } from '../utils/networkUtils';
import { ScreenBroadcastSignalingServer } from './broadcast/screenBroadcastSignalingServer';
import { CollaborationRoomServer } from './collaboration/collaborationRoomServer';
import {
    CollaborationConfiguration,
    CollaborationProfile,
    CollaborationProfileManager,
    ConnectedParticipantSummary,
    DEFAULT_COLLABORATION_PROFILE,
} from '../../collaboration';
import { RemoteSessionAuthority } from '../../remote_access';
import {
    HistoricalComparisonRequest,
    HistoricalComparisonService,
    analysisUpdateEvents,
} from '../../code_analysis/historical';
import { DependencyGraphService } from '../../code_analysis/dependencies';
import {
    AnalysisSourceChangeBatch,
    AnalysisViewMode,
    analysisRefreshCoordinator,
} from '../../code_analysis/refresh';
import { SessionWatcherManager } from '../../code_analysis/engine/watchers/sessionWatcherManager';

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
    private config: HttpServerConfig;
    private isRunning: boolean = false;
    private upgradeAttached = false;
    private broadcastSignalingServer: ScreenBroadcastSignalingServer | null = null;
    private collaborationRoomServer: CollaborationRoomServer | null = null;
    private collaborationProfileSubscription: vscode.Disposable | null = null;
    private readonly remoteSessionAuthority = new RemoteSessionAuthority();
    private remotePublicUrl: string | null = null;
    private historicalComparisonService: HistoricalComparisonService | null = null;
    private dependencyGraphService: DependencyGraphService | null = null;
    private analysisUpdateSubscription: (() => void) | null = null;
    private historicalRefreshTimer: NodeJS.Timeout | null = null;
    private historicalRefreshQueued = false;
    private refreshCoordinatorDisposables: Array<() => void> = [];

    constructor(config: HttpServerConfig) {
        // Ensure port is a number and create clean config
        const cleanConfig: HttpServerConfig = {
            ...config,
            port: Number(config.port)
        };
        
        this.config = {
            host: '0.0.0.0',  // ✅ Listen on all network interfaces for VR/mobile access
            staticRoot: path.join(__dirname, '../../../templates'),
            enableCors: true,
            allowedOrigins: ['*'],
            ...cleanConfig
        };

        if (this.config.extensionContext && this.config.analysisSessionId && this.config.staticRoot) {
            this.historicalComparisonService = new HistoricalComparisonService(
                this.config.extensionContext,
                this.config.analysisSessionId,
                this.config.staticRoot,
            );
            this.dependencyGraphService = new DependencyGraphService(
                this.config.extensionContext,
                this.config.analysisSessionId,
                this.config.staticRoot,
            );
            this.analysisUpdateSubscription = analysisUpdateEvents.on((event) => {
                if (event.sessionId === this.config.analysisSessionId) {
                    const view = analysisRefreshCoordinator.getViewState(event.sessionId);
                    if (view.mode === 'historical-compare') {
                        this.scheduleHistoricalComparisonRefresh();
                    }
                }
            });
            this.refreshCoordinatorDisposables.push(
                analysisRefreshCoordinator.registerHandler(
                    this.config.analysisSessionId,
                    'dependency-graph',
                    this.refreshDependencyGraph.bind(this),
                ),
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

        return new Promise((resolve, reject) => {
            this.server!.close((error) => {
                if (error) {
                    console.error('SERVER: Error stopping HTTP server:', error);
                    reject(error);
                } else {
                    this.disposeRuntimeFeatures();
                    console.log('SERVER: HTTP server stopped successfully');
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
            this.sendErrorResponse(res, 404, 'Resource not found');
            return;
        }

        // Add CORS headers if enabled
        if (this.config.enableCors) {
            this.addCorsHeaders(res);
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
                this.sendErrorResponse(res, 500, 'Internal Server Error');
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
            await this.serveMainPage(res);
            return;
        }

        if (url.startsWith('/join')) {
            this.servePairingPage(res, url);
            return;
        }

        // Health check endpoint
        if (url === '/health') {
            this.sendJsonResponse(res, 200, {
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
        await this.serveStaticFile(req, res, url);
    }

    /**
     * Serve the main CodeXR page
     * @param res - HTTP response
     */
    private async serveMainPage(res: http.ServerResponse): Promise<void> {
        let mainPagePath: string;
        
        if (this.config.mainFile) {
            // If a specific main file is configured, use it
            if (path.isAbsolute(this.config.mainFile)) {
                mainPagePath = this.config.mainFile;
            } else {
                mainPagePath = path.join(this.config.staticRoot!, this.config.mainFile);
            }
            console.log(`SERVER: Attempting to serve configured main file: ${mainPagePath}`);
            console.log(`SERVER: Static root: ${this.config.staticRoot}`);
            console.log(`SERVER: Main file: ${this.config.mainFile}`);
        } else {
            // Default to xr-visualization.html
            mainPagePath = path.join(this.config.staticRoot!, 'xr', 'xr-visualization.html');
            console.log(`SERVER: Serving default main file: ${mainPagePath}`);
        }
        
        // Check if file exists and serve it
        if (fs.existsSync(mainPagePath)) {
            console.log(`SERVER: Successfully found main file, serving: ${mainPagePath}`);
            await this.serveFile(res, mainPagePath, 'text/html');
        } else {
            console.error(`SERVER: Main file not found: ${mainPagePath}`);
            console.error(`SERVER: Current working directory: ${process.cwd()}`);
            console.error(`SERVER: Static root exists: ${fs.existsSync(this.config.staticRoot!)}`);
            if (this.config.staticRoot) {
                try {
                    const files = fs.readdirSync(this.config.staticRoot);
                    console.error(`SERVER: Files in static root: ${files.join(', ')}`);
                } catch (e) {
                    console.error(`SERVER: Cannot read static root directory: ${e}`);
                }
            }
            
            // Fallback to a basic HTML page
            console.warn(`SERVER: Serving fallback HTML instead of selected file`);
            const fallbackHtml = this.generateFallbackHtml();
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(fallbackHtml);
        }
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
                this.sendJsonResponse(res, 200, {
                    server: 'CodeXR HTTP Server',
                    mode: 'HTTP',
                    port: this.config.port,
                    uptime: process.uptime(),
                    timestamp: new Date().toISOString()
                });
                break;

            case '/config':
                this.sendJsonResponse(res, 200, {
                    mode: 'HTTP',
                    host: this.config.host,
                    port: this.config.port,
                    cors: this.config.enableCors
                });
                break;

            case '/collaboration/session':
                this.sendJsonResponse(res, 200, await this.buildCollaborationSessionDescriptor(req));
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

            default:
                this.sendErrorResponse(res, 404, 'API endpoint not found');
        }
    }

    private async serveAvatarModel(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            this.sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }

        const modelPath = CollaborationProfileManager.getInstance()?.getAvatarModelPath();
        if (!modelPath) {
            this.sendErrorResponse(res, 404, 'Avatar model is not installed');
            return;
        }
        const stats = await fs.promises.stat(modelPath);
        res.writeHead(200, {
            'Content-Type': 'model/gltf-binary',
            'Content-Length': stats.size,
            'Cache-Control': 'public, max-age=604800, immutable',
            'X-CodeXR-Asset-Source': 'Quaternius-via-Poly-Pizza',
        });
        if (req.method === 'HEAD') {
            res.end();
            return;
        }
        fs.createReadStream(modelPath)
            .on('error', () => this.sendErrorResponse(res, 500, 'Unable to read avatar model'))
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
            this.sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }
        try {
            const payload = await this.readJsonBody(req);
            const isCodeXR = payload.clientKind === 'codexr';
            const browserProfile = {
                identityMode: payload.identityMode === 'custom' ? 'custom' : 'anonymous',
                customName: String(payload.customName || ''),
                avatarId: DEFAULT_COLLABORATION_PROFILE.avatarId,
            } satisfies CollaborationProfile;
            const result = this.remoteSessionAuthority.createPairingRequest({
                invitationToken: String(payload.invitationToken || ''),
                remoteAddress: this.getRemoteAddress(req),
                installationId: isCodeXR
                    ? String(payload.installationId || '')
                    : `browser-${crypto.randomUUID()}`,
                profile: isCodeXR
                    ? payload.profile as CollaborationProfile
                    : browserProfile,
                clientKind: isCodeXR ? 'codexr' : 'browser',
                identityToken: isCodeXR ? undefined : String(payload.identityToken || ''),
            });
            this.sendJsonResponse(res, 202, result);
        } catch (error) {
            this.sendPairingError(res, error);
        }
    }

    private async handleBrowserIdentity(
        req: http.IncomingMessage,
        res: http.ServerResponse,
    ): Promise<void> {
        if (req.method !== 'POST') {
            this.sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }
        try {
            const payload = await this.readJsonBody(req);
            const result = this.remoteSessionAuthority.createBrowserIdentity({
                invitationToken: String(payload.invitationToken || ''),
                remoteAddress: this.getRemoteAddress(req),
            });
            this.sendJsonResponse(res, 200, result);
        } catch (error) {
            this.sendPairingError(res, error);
        }
    }

    private async handlePairingConfirmation(
        req: http.IncomingMessage,
        res: http.ServerResponse,
    ): Promise<void> {
        if (req.method !== 'POST') {
            this.sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }
        try {
            const payload = await this.readJsonBody(req);
            const result = this.remoteSessionAuthority.confirmPairing(
                String(payload.requestId || ''),
                String(payload.code || ''),
                this.getRemoteAddress(req),
            );
            const origin = this.getRequestOrigin(req);
            const browserUrl = new URL('/api/remote/browser', origin);
            browserUrl.searchParams.set('token', result.browserToken);
            this.sendJsonResponse(res, 200, {
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
            this.sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }
        const token = new URL(requestUrl, 'https://codexr.local').searchParams.get('token') || '';
        const session = this.remoteSessionAuthority.exchangeBrowserToken(token);
        if (!session) {
            this.sendErrorResponse(res, 404, 'Resource not found');
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
            this.sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }
        try {
            const token = this.readBearerToken(req);
            const payload = await this.readJsonBody(req);
            const sessions = this.remoteSessionAuthority.updateExtensionProfile(
                token,
                payload.profile as CollaborationProfile,
            );
            for (const session of sessions) {
                this.collaborationRoomServer?.updateSessionProfile(session.sessionId, session.profile);
            }
            this.sendJsonResponse(res, 200, { profile: sessions[0]?.profile });
        } catch {
            this.sendErrorResponse(res, 404, 'Resource not found');
        }
    }

    private servePairingPage(res: http.ServerResponse, requestUrl: string): void {
        const invitationToken = new URL(requestUrl, 'https://codexr.local')
            .searchParams.get('invite') || '';
        if (
            !/^[a-zA-Z0-9_-]{20,100}$/.test(invitationToken)
            || !this.remoteSessionAuthority.isInvitationValid(invitationToken)
        ) {
            this.sendErrorResponse(res, 404, 'Resource not found');
            return;
        }
        const tokenLiteral = JSON.stringify(invitationToken);
        const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unirse a CodeXR</title>
<style>
body{font-family:system-ui,sans-serif;background:#111827;color:#f9fafb;display:grid;place-items:center;min-height:100vh;margin:0}
main{width:min(440px,calc(100% - 40px));background:#1f2937;border-radius:12px;padding:24px}
input,button{box-sizing:border-box;width:100%;padding:12px;margin-top:12px;border-radius:7px;border:1px solid #4b5563}
button{background:#2563eb;color:white;font-weight:600;cursor:pointer}.error{color:#fca5a5}
fieldset{border:0;padding:0;margin:16px 0}.choice{display:flex;gap:8px;align-items:center;margin-top:10px}.choice input{width:auto;margin:0}
.hint{color:#cbd5e1;font-size:.92rem}#code,#confirm{display:none}
</style>
</head>
<body><main>
<h1>Conectar con CodeXR</h1>
<section id="identity-step">
<p>Elige como quieres aparecer antes de solicitar acceso.</p>
<fieldset>
<label class="choice"><input type="radio" name="identity" value="anonymous" checked> Continuar como anonimo</label>
<label class="choice"><input type="radio" name="identity" value="custom"> Usar un nombre personalizado</label>
</fieldset>
<label for="name">Nombre visible</label>
<input id="name" maxlength="32" disabled>
<p id="identity-hint" class="hint">CodeXR te ha reservado este alias anonimo.</p>
</section>
<p>Solicita acceso y pide al anfitrión el código temporal de seis cifras.</p>
<button id="request">Solicitar acceso</button>
<input id="code" inputmode="numeric" maxlength="6" placeholder="Código de 6 cifras" disabled>
<button id="confirm" disabled>Conectar</button>
<p id="status" aria-live="polite"></p>
</main>
<script>
const invitationToken=${tokenLiteral};let requestId='',identityToken='',anonymousAlias='';
const status=document.querySelector('#status'),code=document.querySelector('#code'),confirmButton=document.querySelector('#confirm'),nameInput=document.querySelector('#name'),requestButton=document.querySelector('#request');
function selectedMode(){return document.querySelector('input[name="identity"]:checked').value}
function updateIdentityMode(){const custom=selectedMode()==='custom';nameInput.disabled=!custom;nameInput.value=custom?'':anonymousAlias;document.querySelector('#identity-hint').textContent=custom?'Escribe entre 2 y 32 caracteres.':'CodeXR te ha reservado este alias anonimo.'}
document.querySelectorAll('input[name="identity"]').forEach(input=>input.onchange=updateIdentityMode);
async function prepareIdentity(){requestButton.disabled=true;status.textContent='Preparando identidad...';try{const response=await fetch('/api/remote/identity',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({invitationToken})});if(!response.ok)throw new Error();const data=await response.json();identityToken=data.identityToken;anonymousAlias=data.anonymousAlias;nameInput.value=anonymousAlias;requestButton.disabled=false;status.textContent='';}catch{status.className='error';status.textContent='La invitacion no es valida o ya no esta disponible.'}}
document.querySelector('#request').onclick=async()=>{status.textContent='Solicitando acceso...';try{
const mode=selectedMode(),customName=mode==='custom'?nameInput.value:'';
const response=await fetch('/api/remote/pair/request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({invitationToken,clientKind:'browser',identityToken,identityMode:mode,customName})});
if(!response.ok)throw new Error();const data=await response.json();requestId=data.requestId;code.disabled=false;confirmButton.disabled=false;status.textContent='Solicitud enviada.';
}catch{status.className='error';status.textContent='Revisa el nombre o solicita una invitacion nueva.'}};
const submitIdentity=requestButton.onclick;requestButton.onclick=async()=>{await submitIdentity();if(requestId){document.querySelector('#identity-step').style.display='none';requestButton.style.display='none';code.style.display='block';confirmButton.style.display='block';status.className='';status.textContent='Solicitud enviada. Introduce el codigo que te facilite el anfitrion.';}else{status.className='error';status.textContent='Revisa el nombre o solicita una invitacion nueva.'}};
confirmButton.onclick=async()=>{status.className='';status.textContent='Verificando...';try{
const response=await fetch('/api/remote/pair/confirm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestId,code:code.value})});
if(!response.ok)throw new Error();const data=await response.json();location.replace(data.browserUrl);
}catch{status.className='error';status.textContent='Codigo incorrecto, caducado o sin intentos disponibles.'}};
prepareIdentity();
</script></body></html>`;
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'",
        });
        res.end(html);
    }

    private readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            let size = 0;
            req.on('data', (chunk: Buffer) => {
                size += chunk.length;
                if (size > 16 * 1024) {
                    reject(new Error('request-too-large'));
                    req.destroy();
                    return;
                }
                chunks.push(chunk);
            });
            req.on('end', () => {
                try {
                    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
                    resolve(parsed && typeof parsed === 'object' ? parsed : {});
                } catch {
                    reject(new Error('invalid-json'));
                }
            });
            req.on('error', reject);
        });
    }

    private getRequestOrigin(req: http.IncomingMessage): string {
        if (this.isRemoteRequest(req) && this.remotePublicUrl) {
            return this.remotePublicUrl;
        }
        const forwardedProtocol = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
        const protocol = forwardedProtocol || (this.isRemoteRequest(req) ? 'https' : 'http');
        return `${protocol}://${req.headers.host || `localhost:${this.config.port}`}`;
    }

    private getRemoteAddress(req: http.IncomingMessage): string {
        return String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || 'unknown').slice(0, 120);
    }

    private readBearerToken(req: http.IncomingMessage): string {
        const authorization = String(req.headers.authorization || '');
        return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    }

    private sendPairingError(res: http.ServerResponse, error: unknown): void {
        const code = error instanceof Error ? error.message : '';
        if (code === 'too-many-pairing-requests') {
            this.sendErrorResponse(res, 429, 'Too many pending requests');
            return;
        }
        if (code === 'invalid-pairing-code') {
            this.sendErrorResponse(res, 401, 'Invalid pairing code');
            return;
        }
        if (code === 'pairing-attempts-exceeded') {
            this.sendErrorResponse(res, 429, 'Pairing attempts exceeded');
            return;
        }
        if (code === 'pairing-expired') {
            this.sendErrorResponse(res, 410, 'Pairing request expired');
            return;
        }
        if (code === 'invalid-profile') {
            this.sendErrorResponse(res, 400, 'Invalid collaboration profile');
            return;
        }
        if (code === 'invalid-browser-identity') {
            this.sendErrorResponse(res, 401, 'Invalid browser identity');
            return;
        }
        this.sendErrorResponse(res, 404, 'Resource not found');
    }

    /**
     * Serve static files
     * @param req - HTTP request
     * @param res - HTTP response
     * @param url - Request URL
     */
    private async serveStaticFile(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        url: string
    ): Promise<void> {
        // Parse URL to extract pathname without query string
        const parsedUrl = parseUrl(url, true);
        const pathname = parsedUrl.pathname || '/';
        
        const filePath = path.join(this.config.staticRoot!, pathname);
        const normalizedPath = path.normalize(filePath);

        console.log(`SERVER_DEBUG: Request for static file: ${url}`);
        console.log(`SERVER_DEBUG: Parsed pathname: ${pathname}`);
        console.log(`SERVER_DEBUG: Query string removed: ${url} -> ${pathname}`);
        console.log(`SERVER_DEBUG: Static root: ${this.config.staticRoot}`);
        console.log(`SERVER_DEBUG: Full file path: ${normalizedPath}`);
        console.log(`SERVER_DEBUG: File exists: ${fs.existsSync(normalizedPath)}`);

        // Security check: ensure the file is within the static root
        if (!normalizedPath.startsWith(path.normalize(this.config.staticRoot!))) {
            console.log(`SERVER_DEBUG: Access denied - path outside static root`);
            this.sendErrorResponse(res, 403, 'Access denied');
            return;
        }

        if (fs.existsSync(normalizedPath) && fs.statSync(normalizedPath).isFile()) {
            console.log(`SERVER_DEBUG: Serving file: ${normalizedPath}`);
            await this.serveFile(res, normalizedPath);
        } else {
            console.log(`SERVER_DEBUG: File not found: ${normalizedPath}`);
            // List directory contents for debugging
            try {
                const dirPath = path.dirname(normalizedPath);
                const dirContents = fs.readdirSync(dirPath);
                console.log(`SERVER_DEBUG: Directory contents of ${dirPath}:`, dirContents);
            } catch (dirError) {
                console.log(`SERVER_DEBUG: Could not read directory: ${dirError}`);
            }
            this.sendErrorResponse(res, 404, 'File not found');
        }
    }

    /**
     * Serve a file
     * @param res - HTTP response
     * @param filePath - Path to the file
     * @param contentType - Content type (optional, will be detected)
     */
    private async serveFile(
        res: http.ServerResponse,
        filePath: string,
        contentType?: string
    ): Promise<void> {
        try {
            const content = await fs.promises.readFile(filePath);
            const detectedContentType = contentType || this.getContentType(filePath);
            
            res.writeHead(200, { 'Content-Type': detectedContentType });
            res.end(content);
        } catch (error) {
            console.error('SERVER: Error serving file:', error);
            this.sendErrorResponse(res, 500, 'Error reading file');
        }
    }

    /**
     * Add CORS headers to response
     * @param res - HTTP response
     */
    private addCorsHeaders(res: http.ServerResponse): void {
        const allowedOrigins = this.config.allowedOrigins?.join(', ') || '*';
        
        res.setHeader('Access-Control-Allow-Origin', allowedOrigins);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    }

    /**
     * Send JSON response
     * @param res - HTTP response
     * @param statusCode - HTTP status code
     * @param data - Data to send
     */
    private sendJsonResponse(res: http.ServerResponse, statusCode: number, data: any): void {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data, null, 2));
    }

    /**
     * Send error response
     * @param res - HTTP response
     * @param statusCode - HTTP status code
     * @param message - Error message
     */
    private sendErrorResponse(res: http.ServerResponse, statusCode: number, message: string): void {
        const errorData = {
            error: true,
            status: statusCode,
            message: message,
            timestamp: new Date().toISOString()
        };
        
        this.sendJsonResponse(res, statusCode, errorData);
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

    /**
     * Get content type based on file extension
     * @param filePath - Path to the file
     * @returns string - Content type
     */
    private getContentType(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        
        const contentTypes: Record<string, string> = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.txt': 'text/plain'
        };
        
        return contentTypes[ext] || 'application/octet-stream';
    }

    /**
     * Generate fallback HTML page
     * @returns string - HTML content
     */
    /**
     * Generate fallback HTML when main file is not found
     * @returns string - HTML content
     */
    private generateFallbackHtml(): string {
        return `<!DOCTYPE html>
<html>
<head>
    <title>CodeXR Server - File Not Found</title>
    <style>
        body { font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
        .error { background: #dc2626; color: white; padding: 15px; margin: 20px 0; }
        .info { background: #374151; padding: 15px; margin: 10px 0; }
    </style>
</head>
<body>
    <h1>CodeXR Server - File Not Found</h1>
    <div class="error">
        <h3>Selected HTML File Not Found</h3>
        <p>The HTML file you selected could not be located.</p>
        <p><strong>Attempted File:</strong> ${this.config.mainFile || 'Not specified'}</p>
        <p><strong>Static Root:</strong> ${this.config.staticRoot}</p>
    </div>
    <div class="info">
        <h3>Server Information</h3>
        <p><strong>Port:</strong> ${this.config.port}</p>
        <p><strong>Host:</strong> ${this.config.host}</p>
    </div>
    <div class="info">
        <h3>Troubleshooting</h3>
        <p>1. Check that the file still exists</p>
        <p>2. Verify file permissions</p>
        <p>3. Try restarting the server</p>
    </div>
</body>
</html>`;
    }

    public attachToNodeServer(server: http.Server): void {
        if (this.upgradeAttached) {
            return;
        }
        this.upgradeAttached = true;
        this.collaborationRoomServer = new CollaborationRoomServer(server, '/codexr-room', {
            authorizeUpgrade: (request) => this.isWebSocketAuthorized(request),
            resolveSession: (request) => this.remoteSessionAuthority.resolveCookie(request.headers.cookie),
            handleApplicationMessage: async (messageContext, message) => {
                if (message.type === 'analysis-mode-selection') {
                    this.setAnalysisViewMode('selection');
                    return true;
                }
                if (message.type === 'analysis-mode-activate') {
                    const requestedMode = String(message.payload?.mode || '');
                    if (
                        requestedMode === 'single'
                        || requestedMode === 'historical-compare'
                        || requestedMode === 'dependency-graph'
                    ) {
                        const mode = requestedMode as Exclude<AnalysisViewMode, 'selection'>;
                        if (mode !== 'single') {
                            const entityKind = mode === 'historical-compare'
                                ? 'historical-comparison'
                                : 'dependency-graph';
                            const snapshot = this.collaborationRoomServer?.getServerEntity(
                                this.getCollaborationRoomId(),
                                entityKind,
                                'main',
                            );
                            const available = mode === 'historical-compare'
                                ? !!snapshot?.result
                                : typeof snapshot?.datasetUrl === 'string';
                            analysisRefreshCoordinator.setSnapshotAvailable(
                                this.config.analysisSessionId!,
                                mode,
                                available,
                            );
                            if (!available) {
                                this.setAnalysisViewMode('selection');
                                return true;
                            }
                        }
                        await this.activateAnalysisViewMode(mode);
                    }
                    return true;
                }
                if (message.type === 'dependency-graph-settings') {
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
                        ...(Object.keys(relationFilters).length ? { relationFilters } : {}),
                        ...(Object.keys(mapping).length ? { mapping } : {}),
                        ...(scope ? { scope } : {}),
                    });
                    return true;
                }
                if (message.type === 'dependency-file-scope-request') {
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
                if (message.type === 'dependency-graph-start') {
                    if (!this.dependencyGraphService) {
                        return false;
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
                    analysisRefreshCoordinator.setSnapshotAvailable(
                        this.config.analysisSessionId!,
                        'dependency-graph',
                        hasCachedDataset,
                    );
                    await this.activateAnalysisViewMode('dependency-graph');
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
                        analysisRefreshCoordinator.requestRefresh(
                            this.config.analysisSessionId!,
                            'dependency-graph',
                        );
                    }
                    return true;
                }
                if (!this.historicalComparisonService) {
                    return false;
                }
                if (message.type === 'historical-comparison-references-request') {
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
                if (message.type === 'historical-comparison-start') {
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
                    this.setAnalysisViewMode('selection');
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
                            this.setAnalysisViewMode('historical-compare');
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
                return false;
            },
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
                &&
                currentScope?.kind === 'file'
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
        } catch (error) {
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

    private setAnalysisViewMode(mode: AnalysisViewMode): void {
        if (!this.config.analysisSessionId) {
            return;
        }
        analysisRefreshCoordinator.setActiveMode(this.config.analysisSessionId, mode);
    }

    private async activateAnalysisViewMode(
        mode: Exclude<AnalysisViewMode, 'selection'>,
    ): Promise<void> {
        if (!this.config.analysisSessionId) {
            return;
        }
        analysisRefreshCoordinator.activateMode(this.config.analysisSessionId, mode);
        await SessionWatcherManager.reconcileSession(this.config.analysisSessionId);
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
