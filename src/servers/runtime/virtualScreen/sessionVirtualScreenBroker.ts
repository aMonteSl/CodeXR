import * as http from 'http';
import { randomBytes } from 'crypto';
import { parse as parseUrl } from 'url';

const { WebSocketServer } = require('ws');

export interface VirtualScreenHostRequestEvent {
    sessionId: string;
    viewerCount: number;
    hostBroadcasterUrl?: string;
}

export interface SessionVirtualScreenServerConfig {
    sessionId: string;
    signalPath: string;
    hostPath: string;
    hostBroadcasterToken: string;
    displayName?: string;
    getHostBroadcasterUrl?: () => string | undefined;
    onHostBroadcastRequested?: (event: VirtualScreenHostRequestEvent) => void;
}

type BrokerRole = 'viewer' | 'host' | 'unknown';

interface BrokerSocketState {
    role: BrokerRole;
    viewerId?: string;
}

interface SignalMessage {
    type?: string;
    viewerId?: string;
    token?: string;
    sdp?: any;
    candidate?: any;
    sessionId?: string;
}

function createViewerId(): string {
    return `viewer_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

function createJsonResponse(res: http.ServerResponse, statusCode: number, payload: string): void {
    res.writeHead(statusCode, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
    });
    res.end(payload);
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderHostBroadcasterPage(config: SessionVirtualScreenServerConfig): string {
    const pageConfig = JSON.stringify({
        sessionId: config.sessionId,
        signalPath: config.signalPath,
        token: config.hostBroadcasterToken,
        displayName: config.displayName || config.sessionId,
    }).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>CodeXR Host Broadcaster</title>
    <style>
        :root {
            color-scheme: dark;
            --bg: #020617;
            --panel: #0f172a;
            --muted: #94a3b8;
            --text: #f8fafc;
            --accent: #38bdf8;
            --warn: #f59e0b;
            --danger: #ef4444;
            --success: #22c55e;
            --border: rgba(148, 163, 184, 0.2);
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            font-family: "Segoe UI", sans-serif;
            background: radial-gradient(circle at top, #0f172a 0%, var(--bg) 60%);
            color: var(--text);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }
        .shell {
            width: min(960px, 100%);
            display: grid;
            gap: 18px;
        }
        .panel {
            background: rgba(15, 23, 42, 0.9);
            border: 1px solid var(--border);
            border-radius: 18px;
            padding: 20px;
            backdrop-filter: blur(16px);
            box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
        }
        h1, h2, p { margin: 0; }
        .meta {
            display: grid;
            gap: 10px;
        }
        .meta small {
            color: var(--muted);
            text-transform: uppercase;
            letter-spacing: 0.12em;
        }
        .actions {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }
        button {
            appearance: none;
            border: none;
            border-radius: 999px;
            padding: 12px 18px;
            font: inherit;
            font-weight: 600;
            cursor: pointer;
            transition: transform 120ms ease, opacity 120ms ease;
        }
        button:hover { transform: translateY(-1px); }
        button:disabled { opacity: 0.5; cursor: default; transform: none; }
        .primary { background: var(--accent); color: #082f49; }
        .secondary { background: rgba(148, 163, 184, 0.12); color: var(--text); }
        .danger { background: rgba(239, 68, 68, 0.15); color: #fecaca; }
        .status {
            display: grid;
            gap: 6px;
            color: var(--muted);
        }
        .status strong { color: var(--text); }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            width: fit-content;
            padding: 6px 10px;
            border-radius: 999px;
            background: rgba(56, 189, 248, 0.08);
            color: #bae6fd;
            border: 1px solid rgba(56, 189, 248, 0.24);
        }
        .preview {
            width: 100%;
            aspect-ratio: 16 / 9;
            border-radius: 14px;
            border: 1px solid var(--border);
            background: rgba(15, 23, 42, 0.85);
            overflow: hidden;
        }
        video {
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: #000;
        }
        .hint {
            color: var(--muted);
            line-height: 1.55;
        }
    </style>
</head>
<body>
    <main class="shell">
        <section class="panel meta">
            <small>CodeXR Host Broadcast</small>
            <h1>Share this host computer into XR/DOM viewers</h1>
            <p class="hint">Use the native picker to share a screen, window, or tab from the machine that launched the analysis. Every viewer connected to this session will receive the stream inside the virtual screen.</p>
            <span id="broadcastBadge" class="badge">Waiting for capture</span>
        </section>
        <section class="panel">
            <div class="actions">
                <button id="startShare" class="primary">Start host sharing</button>
                <button id="stopShare" class="danger" disabled>Stop sharing</button>
                <button id="reconnectSignal" class="secondary">Reconnect signal</button>
            </div>
        </section>
        <section class="panel status">
            <strong id="sessionLabel">${escapeHtml(config.displayName || config.sessionId)}</strong>
            <div id="statusLine">Connecting to signaling server...</div>
            <div id="viewerCount">0 viewers waiting</div>
        </section>
        <section class="panel">
            <div class="preview">
                <video id="hostPreview" autoplay muted playsinline></video>
            </div>
        </section>
    </main>
    <script>
        window.__CODEXR_HOST_BROADCAST_CONFIG__ = ${pageConfig};
    </script>
    <script>
        (function () {
            const config = window.__CODEXR_HOST_BROADCAST_CONFIG__;
            const startButton = document.getElementById('startShare');
            const stopButton = document.getElementById('stopShare');
            const reconnectButton = document.getElementById('reconnectSignal');
            const statusLine = document.getElementById('statusLine');
            const viewerCount = document.getElementById('viewerCount');
            const badge = document.getElementById('broadcastBadge');
            const preview = document.getElementById('hostPreview');

            const peers = new Map();
            const knownViewers = new Set();
            let socket = null;
            let localStream = null;

            function setStatus(message) {
                statusLine.textContent = message;
            }

            function setViewerCount() {
                viewerCount.textContent = knownViewers.size === 1
                    ? '1 viewer connected'
                    : knownViewers.size + ' viewers waiting';
            }

            function setBadge(message, tone) {
                badge.textContent = message;
                if (tone === 'live') {
                    badge.style.background = 'rgba(34, 197, 94, 0.14)';
                    badge.style.borderColor = 'rgba(34, 197, 94, 0.28)';
                    badge.style.color = '#bbf7d0';
                    return;
                }
                if (tone === 'warn') {
                    badge.style.background = 'rgba(245, 158, 11, 0.12)';
                    badge.style.borderColor = 'rgba(245, 158, 11, 0.26)';
                    badge.style.color = '#fde68a';
                    return;
                }
                badge.style.background = 'rgba(56, 189, 248, 0.08)';
                badge.style.borderColor = 'rgba(56, 189, 248, 0.24)';
                badge.style.color = '#bae6fd';
            }

            function buildSocketUrl() {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                return protocol + '//' + window.location.host + config.signalPath;
            }

            function send(message) {
                if (!socket || socket.readyState !== WebSocket.OPEN) {
                    return;
                }
                socket.send(JSON.stringify(message));
            }

            function closePeer(viewerId) {
                const peer = peers.get(viewerId);
                if (!peer) {
                    return;
                }
                peers.delete(viewerId);
                try {
                    peer.close();
                } catch (error) {
                    console.warn('CODEXR_HOST_BROADCAST: peer close failed', error);
                }
            }

            function closeAllPeers() {
                Array.from(peers.keys()).forEach(closePeer);
            }

            async function ensurePeer(viewerId) {
                if (!localStream || peers.has(viewerId)) {
                    return peers.get(viewerId) || null;
                }

                const peer = new RTCPeerConnection({ iceServers: [] });
                peers.set(viewerId, peer);

                localStream.getTracks().forEach(function (track) {
                    peer.addTrack(track, localStream);
                });

                peer.onicecandidate = function (event) {
                    if (!event.candidate) {
                        return;
                    }
                    send({
                        type: 'ice-candidate',
                        viewerId,
                        candidate: event.candidate,
                    });
                };

                const offer = await peer.createOffer();
                await peer.setLocalDescription(offer);
                send({
                    type: 'offer',
                    viewerId,
                    sdp: offer,
                });

                return peer;
            }

            async function startShare() {
                try {
                    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                        throw new Error('Screen Capture API is not available in this browser.');
                    }
                    setStatus('Waiting for the native picker on the host computer...');
                    const stream = await navigator.mediaDevices.getDisplayMedia({
                        video: {
                            cursor: 'always',
                            frameRate: { ideal: 30, max: 30 },
                        },
                        audio: false,
                        surfaceSwitching: 'include',
                        selfBrowserSurface: 'exclude',
                    });
                    localStream = stream;
                    preview.srcObject = stream;
                    startButton.disabled = true;
                    stopButton.disabled = false;
                    setStatus('Host sharing is live.');
                    setBadge('Broadcast live', 'live');

                    const tracks = typeof stream.getVideoTracks === 'function' ? stream.getVideoTracks() : [];
                    const track = tracks[0];
                    if (track) {
                        track.addEventListener('ended', function () {
                            stopShare(true);
                        }, { once: true });
                    }

                    for (const viewerId of Array.from(knownViewers)) {
                        await ensurePeer(viewerId);
                    }
                } catch (error) {
                    const message = error && error.message ? error.message : 'Unable to start host sharing.';
                    setStatus(message);
                    setBadge('Capture unavailable', 'warn');
                }
            }

            function stopShare(notifyServer) {
                if (localStream && typeof localStream.getTracks === 'function') {
                    localStream.getTracks().forEach(function (track) { track.stop(); });
                }
                localStream = null;
                preview.srcObject = null;
                closeAllPeers();
                startButton.disabled = false;
                stopButton.disabled = true;
                setBadge('Waiting for capture');
                setStatus('Host sharing stopped.');
                if (notifyServer) {
                    send({ type: 'host-stopped' });
                }
            }

            function connectSocket() {
                if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
                    return;
                }

                socket = new WebSocket(buildSocketUrl());

                socket.addEventListener('open', function () {
                    setStatus('Signaling connected. Ready to broadcast the host computer.');
                    send({
                        type: 'host-register',
                        sessionId: config.sessionId,
                        token: config.token,
                    });
                });

                socket.addEventListener('message', async function (event) {
                    let message = null;
                    try {
                        message = JSON.parse(event.data);
                    } catch (error) {
                        console.warn('CODEXR_HOST_BROADCAST: invalid message', error);
                        return;
                    }

                    switch (message.type) {
                        case 'host-status':
                            knownViewers.clear();
                            (message.viewerIds || []).forEach(function (viewerId) {
                                knownViewers.add(viewerId);
                            });
                            setViewerCount();
                            if (message.active === false) {
                                setBadge('Waiting for capture');
                            }
                            break;
                        case 'viewer-join':
                            if (message.viewerId) {
                                knownViewers.add(message.viewerId);
                                setViewerCount();
                                await ensurePeer(message.viewerId);
                            }
                            break;
                        case 'viewer-leave':
                            if (message.viewerId) {
                                knownViewers.delete(message.viewerId);
                                closePeer(message.viewerId);
                                setViewerCount();
                            }
                            break;
                        case 'answer':
                            if (message.viewerId && peers.has(message.viewerId) && message.sdp) {
                                await peers.get(message.viewerId).setRemoteDescription(new RTCSessionDescription(message.sdp));
                            }
                            break;
                        case 'ice-candidate':
                            if (message.viewerId && peers.has(message.viewerId) && message.candidate) {
                                await peers.get(message.viewerId).addIceCandidate(new RTCIceCandidate(message.candidate));
                            }
                            break;
                        case 'error':
                            setStatus(message.message || 'Host broadcaster signaling failed.');
                            setBadge('Broadcast error', 'warn');
                            break;
                        default:
                            break;
                    }
                });

                socket.addEventListener('close', function () {
                    setStatus('Signaling disconnected. Reconnect to continue hosting.');
                    setBadge('Signal disconnected', 'warn');
                });

                socket.addEventListener('error', function () {
                    setStatus('The signaling connection failed.');
                    setBadge('Signal error', 'warn');
                });
            }

            startButton.addEventListener('click', function () {
                void startShare();
            });
            stopButton.addEventListener('click', function () {
                stopShare(true);
            });
            reconnectButton.addEventListener('click', function () {
                if (socket) {
                    try { socket.close(); } catch (error) {}
                }
                connectSocket();
            });
            window.addEventListener('beforeunload', function () {
                stopShare(true);
                if (socket && socket.readyState === WebSocket.OPEN) {
                    try { socket.close(); } catch (error) {}
                }
            });

            connectSocket();
        })();
    </script>
</body>
</html>`;
}

export class SessionVirtualScreenBroker {
    private readonly wsServer: any;
    private broadcasterSocket: any | null = null;
    private readonly viewers = new Map<string, any>();
    private readonly socketState = new Map<any, BrokerSocketState>();
    private hostRequestPending = false;

    constructor(private readonly config: SessionVirtualScreenServerConfig) {
        this.wsServer = new WebSocketServer({ noServer: true });
        this.wsServer.on('connection', (socket: any) => {
            this.handleSocketConnection(socket);
        });
    }

    public handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): boolean {
        const parsedUrl = parseUrl(req.url || '/', true);
        if (parsedUrl.pathname !== this.config.hostPath) {
            return false;
        }

        const token = typeof parsedUrl.query.token === 'string' ? parsedUrl.query.token : '';
        if (token !== this.config.hostBroadcasterToken) {
            createJsonResponse(res, 403, '<h1>Forbidden</h1><p>The host broadcaster token is invalid or expired.</p>');
            return true;
        }

        createJsonResponse(res, 200, renderHostBroadcasterPage(this.config));
        return true;
    }

    public handleUpgrade(req: http.IncomingMessage, socket: any, head: Buffer): boolean {
        const parsedUrl = parseUrl(req.url || '/', true);
        if (parsedUrl.pathname !== this.config.signalPath) {
            return false;
        }

        this.wsServer.handleUpgrade(req, socket, head, (ws: any) => {
            this.wsServer.emit('connection', ws, req);
        });
        return true;
    }

    public dispose(): void {
        try {
            this.wsServer.close();
        } catch {
            // Ignore cleanup issues during server shutdown.
        }
        this.viewers.forEach((socket) => {
            try {
                socket.close();
            } catch {
                // Ignore.
            }
        });
        if (this.broadcasterSocket) {
            try {
                this.broadcasterSocket.close();
            } catch {
                // Ignore.
            }
        }
        this.viewers.clear();
        this.socketState.clear();
        this.broadcasterSocket = null;
        this.hostRequestPending = false;
    }

    private handleSocketConnection(socket: any): void {
        this.socketState.set(socket, { role: 'unknown' });

        socket.on('message', (raw: Buffer | string) => {
            this.handleSocketMessage(socket, raw);
        });

        socket.on('close', () => {
            this.handleSocketClose(socket);
        });

        socket.on('error', () => {
            this.handleSocketClose(socket);
        });
    }

    private handleSocketMessage(socket: any, raw: Buffer | string): void {
        let payload: SignalMessage;
        try {
            payload = JSON.parse(raw.toString());
        } catch {
            this.send(socket, { type: 'error', message: 'Invalid signaling payload.' });
            return;
        }

        switch (payload.type) {
            case 'viewer-join':
                this.registerViewer(socket, payload);
                return;
            case 'request-host-start':
                this.requestHostStart();
                return;
            case 'host-register':
                this.registerBroadcaster(socket, payload);
                return;
            case 'host-stopped':
                if (this.broadcasterSocket === socket) {
                    this.clearBroadcaster('The host broadcaster stopped sharing.');
                }
                return;
            case 'offer':
                this.routeToViewer(socket, payload, 'offer');
                return;
            case 'answer':
                this.routeToBroadcaster(socket, payload, 'answer');
                return;
            case 'ice-candidate':
                this.routeIceCandidate(socket, payload);
                return;
            case 'viewer-leave':
                this.unregisterViewerBySocket(socket);
                return;
            default:
                this.send(socket, { type: 'error', message: `Unsupported signaling message "${payload.type}".` });
        }
    }

    private registerViewer(socket: any, payload: SignalMessage): void {
        const existing = this.socketState.get(socket);
        const viewerId = existing?.viewerId || payload.viewerId || createViewerId();
        this.socketState.set(socket, { role: 'viewer', viewerId });
        this.viewers.set(viewerId, socket);

        this.send(socket, {
            type: 'viewer-registered',
            sessionId: this.config.sessionId,
            viewerId,
            hostActive: !!this.broadcasterSocket,
        });

        if (this.broadcasterSocket) {
            this.send(this.broadcasterSocket, { type: 'viewer-join', viewerId });
            this.broadcastHostStatus(true);
            return;
        }

        this.send(socket, {
            type: 'host-status',
            sessionId: this.config.sessionId,
            active: false,
            pending: true,
            viewerIds: Array.from(this.viewers.keys()),
        });
        this.requestHostStart();
    }

    private registerBroadcaster(socket: any, payload: SignalMessage): void {
        if (payload.token !== this.config.hostBroadcasterToken) {
            this.send(socket, { type: 'error', message: 'Invalid host broadcaster token.' });
            socket.close();
            return;
        }

        if (this.broadcasterSocket && this.broadcasterSocket !== socket) {
            this.send(socket, { type: 'error', message: 'A host broadcaster is already active for this session.' });
            socket.close();
            return;
        }

        this.broadcasterSocket = socket;
        this.socketState.set(socket, { role: 'host' });
        this.hostRequestPending = false;
        this.broadcastHostStatus(true);
        this.viewers.forEach((_viewerSocket, viewerId) => {
            this.send(socket, { type: 'viewer-join', viewerId });
        });
    }

    private routeToViewer(socket: any, payload: SignalMessage, type: 'offer'): void {
        if (this.broadcasterSocket !== socket || !payload.viewerId || !this.viewers.has(payload.viewerId)) {
            return;
        }
        this.send(this.viewers.get(payload.viewerId), {
            type,
            viewerId: payload.viewerId,
            sdp: payload.sdp,
        });
    }

    private routeToBroadcaster(socket: any, payload: SignalMessage, type: 'answer'): void {
        const state = this.socketState.get(socket);
        if (!this.broadcasterSocket || state?.role !== 'viewer' || !state.viewerId) {
            return;
        }
        this.send(this.broadcasterSocket, {
            type,
            viewerId: state.viewerId,
            sdp: payload.sdp,
        });
    }

    private routeIceCandidate(socket: any, payload: SignalMessage): void {
        const state = this.socketState.get(socket);
        if (socket === this.broadcasterSocket && payload.viewerId && this.viewers.has(payload.viewerId)) {
            this.send(this.viewers.get(payload.viewerId), {
                type: 'ice-candidate',
                viewerId: payload.viewerId,
                candidate: payload.candidate,
            });
            return;
        }
        if (state?.role === 'viewer' && state.viewerId && this.broadcasterSocket) {
            this.send(this.broadcasterSocket, {
                type: 'ice-candidate',
                viewerId: state.viewerId,
                candidate: payload.candidate,
            });
        }
    }

    private handleSocketClose(socket: any): void {
        const state = this.socketState.get(socket);
        this.socketState.delete(socket);

        if (state?.role === 'viewer' && state.viewerId) {
            this.viewers.delete(state.viewerId);
            if (this.broadcasterSocket) {
                this.send(this.broadcasterSocket, { type: 'viewer-leave', viewerId: state.viewerId });
            }
            this.broadcastHostStatus(!!this.broadcasterSocket);
            return;
        }

        if (state?.role === 'host' && this.broadcasterSocket === socket) {
            this.clearBroadcaster('The host broadcaster disconnected.');
        }
    }

    private unregisterViewerBySocket(socket: any): void {
        const state = this.socketState.get(socket);
        if (state?.role !== 'viewer' || !state.viewerId) {
            return;
        }
        this.viewers.delete(state.viewerId);
        this.socketState.delete(socket);
        if (this.broadcasterSocket) {
            this.send(this.broadcasterSocket, { type: 'viewer-leave', viewerId: state.viewerId });
        }
        this.broadcastHostStatus(!!this.broadcasterSocket);
    }

    private clearBroadcaster(message: string): void {
        this.broadcasterSocket = null;
        this.broadcastHostStatus(false);
        this.viewers.forEach((viewerSocket) => {
            this.send(viewerSocket, { type: 'host-stopped', message });
        });
        if (this.viewers.size > 0) {
            this.requestHostStart();
        }
    }

    private requestHostStart(): void {
        if (this.hostRequestPending) {
            return;
        }
        this.hostRequestPending = true;
        this.config.onHostBroadcastRequested?.({
            sessionId: this.config.sessionId,
            viewerCount: this.viewers.size,
            hostBroadcasterUrl: this.config.getHostBroadcasterUrl?.(),
        });
    }

    private broadcastHostStatus(active: boolean): void {
        const message = {
            type: 'host-status',
            sessionId: this.config.sessionId,
            active,
            pending: !active && this.viewers.size > 0,
            viewerIds: Array.from(this.viewers.keys()),
        };

        if (this.broadcasterSocket) {
            this.send(this.broadcasterSocket, message);
        }

        this.viewers.forEach((viewerSocket) => {
            this.send(viewerSocket, message);
        });
    }

    private send(socket: any, payload: Record<string, unknown>): void {
        if (!socket || socket.readyState !== 1) {
            return;
        }
        socket.send(JSON.stringify(payload));
    }
}
