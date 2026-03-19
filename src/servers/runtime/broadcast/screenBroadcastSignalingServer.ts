import * as http from 'http';
import * as net from 'net';
import { WebSocketServer, WebSocket, RawData } from 'ws';

type BroadcastRole = 'none' | 'sender' | 'viewer';

interface BroadcastClient {
    id: string;
    socket: WebSocket;
    screenId: string | null;
    role: BroadcastRole;
    hasAudio: boolean;
}

interface BroadcastScreenState {
    screenId: string;
    broadcasterId: string | null;
    hasAudio: boolean;
    viewers: Set<string>;
}

interface BroadcastMessage {
    type: string;
    clientId?: string;
    screenId?: string;
    hasAudio?: boolean;
    targetId?: string;
    viewerId?: string;
    broadcasterId?: string;
    reason?: string;
    description?: unknown;
    candidate?: unknown;
}

export class ScreenBroadcastSignalingServer {
    private readonly path: string;
    private readonly socketServer: WebSocketServer;
    private readonly clients = new Map<string, BroadcastClient>();
    private readonly screens = new Map<string, BroadcastScreenState>();
    private readonly upgradeHandler: (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => void;
    private disposed = false;

    constructor(
        private readonly server: http.Server,
        path = '/codexr-broadcast',
    ) {
        this.path = path.startsWith('/') ? path : `/${path}`;
        this.socketServer = new WebSocketServer({ noServer: true });
        this.upgradeHandler = this.handleUpgrade.bind(this);

        this.server.on('upgrade', this.upgradeHandler);
        this.socketServer.on('connection', (socket: WebSocket) => {
            this.handleConnection(socket);
        });
    }

    public dispose(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;

        this.server.off('upgrade', this.upgradeHandler);

        for (const client of this.clients.values()) {
            try {
                client.socket.close();
            } catch {
                // Best-effort cleanup.
            }
        }
        this.clients.clear();
        this.screens.clear();
        this.socketServer.close();
    }

    private handleUpgrade(req: http.IncomingMessage, socket: net.Socket, head: Buffer): void {
        const pathname = new URL(req.url || '/', 'http://codexr.local').pathname;
        if (pathname !== this.path) {
            return;
        }

        this.socketServer.handleUpgrade(req, socket, head, (ws: WebSocket) => {
            this.socketServer.emit('connection', ws, req);
        });
    }

    private handleConnection(socket: WebSocket): void {
        const clientId = this.createId('client');
        const client: BroadcastClient = {
            id: clientId,
            socket,
            screenId: null,
            role: 'none',
            hasAudio: false,
        };

        this.clients.set(clientId, client);

        socket.on('message', (raw: RawData) => {
            this.handleMessage(client, raw);
        });

        socket.on('close', () => {
            this.handleDisconnect(client);
        });

        socket.on('error', () => {
            this.handleDisconnect(client);
        });
    }

    private handleMessage(client: BroadcastClient, raw: RawData): void {
        const message = this.parseMessage(raw);
        if (!message) {
            this.send(client, {
                type: 'error',
                message: 'Invalid broadcast signaling payload.',
            });
            return;
        }

        switch (message.type) {
            case 'register':
                this.registerClient(client, message);
                return;
            case 'broadcast-start':
                this.startBroadcast(client, message);
                return;
            case 'broadcast-stop':
                this.stopBroadcast(client, message.reason || 'sender-stopped');
                return;
            case 'viewer-join':
                this.registerViewer(client);
                return;
            case 'viewer-leave':
                this.removeViewer(client);
                return;
            case 'signal-offer':
            case 'signal-answer':
            case 'signal-ice':
                this.forwardSignal(client, message);
                return;
            default:
                this.send(client, {
                    type: 'error',
                    message: `Unsupported broadcast message type: ${message.type}`,
                });
        }
    }

    private registerClient(client: BroadcastClient, message: BroadcastMessage): void {
        const requestedId = this.normalizeId(message.clientId);
        if (requestedId && requestedId !== client.id && !this.clients.has(requestedId)) {
            this.clients.delete(client.id);
            client.id = requestedId;
            this.clients.set(client.id, client);
        }

        client.screenId = this.normalizeScreenId(message.screenId);
        client.role = 'none';
        client.hasAudio = false;

        this.send(client, {
            type: 'registered',
            clientId: client.id,
            screenId: client.screenId,
        });

        const screen = this.getScreenState(client.screenId);
        if (screen?.broadcasterId && screen.broadcasterId !== client.id) {
            this.send(client, {
                type: 'broadcast-available',
                screenId: screen.screenId,
                broadcasterId: screen.broadcasterId,
                hasAudio: screen.hasAudio,
            });
        }
    }

    private startBroadcast(client: BroadcastClient, message: BroadcastMessage): void {
        const screenId = this.requireScreenId(client, message);
        if (!screenId) {
            return;
        }

        const screen = this.ensureScreenState(screenId);
        const previousBroadcasterId = screen.broadcasterId;

        if (previousBroadcasterId && previousBroadcasterId !== client.id) {
            const previousBroadcaster = this.clients.get(previousBroadcasterId);
            if (previousBroadcaster) {
                previousBroadcaster.role = 'none';
                previousBroadcaster.hasAudio = false;
                this.send(previousBroadcaster, {
                    type: 'broadcast-replaced',
                    screenId,
                });
            }
            for (const viewerId of screen.viewers) {
                const viewer = this.clients.get(viewerId);
                if (viewer) {
                    viewer.role = 'none';
                }
            }
            screen.viewers.clear();
        }

        client.role = 'sender';
        client.hasAudio = !!message.hasAudio;
        screen.broadcasterId = client.id;
        screen.hasAudio = client.hasAudio;

        this.send(client, {
            type: 'broadcast-live',
            screenId,
            hasAudio: client.hasAudio,
        });

        for (const candidate of this.clients.values()) {
            if (candidate.id === client.id || candidate.screenId !== screenId) {
                continue;
            }
            this.send(candidate, {
                type: 'broadcast-available',
                screenId,
                broadcasterId: client.id,
                hasAudio: client.hasAudio,
            });
        }
    }

    private stopBroadcast(client: BroadcastClient, reason: string): void {
        const screenId = client.screenId;
        if (!screenId) {
            return;
        }

        const screen = this.getScreenState(screenId);
        if (!screen || screen.broadcasterId !== client.id) {
            return;
        }

        for (const viewerId of screen.viewers) {
            const viewer = this.clients.get(viewerId);
            if (viewer) {
                viewer.role = 'none';
                this.send(viewer, {
                    type: 'broadcast-stopped',
                    screenId,
                    reason,
                });
            }
        }

        client.role = 'none';
        client.hasAudio = false;
        screen.broadcasterId = null;
        screen.hasAudio = false;
        screen.viewers.clear();
        this.pruneScreen(screenId);
    }

    private registerViewer(client: BroadcastClient): void {
        const screenId = client.screenId;
        if (!screenId) {
            this.send(client, {
                type: 'error',
                message: 'Viewer cannot join without a screenId.',
            });
            return;
        }

        const screen = this.getScreenState(screenId);
        if (!screen?.broadcasterId) {
            this.send(client, {
                type: 'broadcast-stopped',
                screenId,
                reason: 'no-signal',
            });
            return;
        }

        client.role = 'viewer';
        screen.viewers.add(client.id);

        const broadcaster = this.clients.get(screen.broadcasterId);
        if (broadcaster) {
            this.send(broadcaster, {
                type: 'viewer-join',
                screenId,
                viewerId: client.id,
            });
        }
    }

    private removeViewer(client: BroadcastClient): void {
        const screenId = client.screenId;
        if (!screenId) {
            return;
        }

        const screen = this.getScreenState(screenId);
        if (!screen) {
            client.role = 'none';
            return;
        }

        if (screen.viewers.delete(client.id) && screen.broadcasterId) {
            const broadcaster = this.clients.get(screen.broadcasterId);
            if (broadcaster) {
                this.send(broadcaster, {
                    type: 'viewer-left',
                    screenId,
                    viewerId: client.id,
                });
            }
        }

        client.role = 'none';
        this.pruneScreen(screenId);
    }

    private forwardSignal(client: BroadcastClient, message: BroadcastMessage): void {
        const screenId = client.screenId;
        const targetId = this.normalizeId(message.targetId);
        if (!screenId || !targetId) {
            return;
        }

        const target = this.clients.get(targetId);
        if (!target || target.screenId !== screenId) {
            return;
        }

        this.send(target, {
            type: message.type,
            screenId,
            clientId: client.id,
            description: message.description,
            candidate: message.candidate,
        });
    }

    private handleDisconnect(client: BroadcastClient): void {
        if (!this.clients.has(client.id)) {
            return;
        }

        if (client.role === 'sender') {
            this.stopBroadcast(client, 'sender-disconnected');
        } else if (client.role === 'viewer') {
            this.removeViewer(client);
        }

        this.clients.delete(client.id);
    }

    private send(client: BroadcastClient, payload: Record<string, unknown>): void {
        if (client.socket.readyState !== WebSocket.OPEN) {
            return;
        }

        client.socket.send(JSON.stringify(payload));
    }

    private parseMessage(raw: RawData): BroadcastMessage | null {
        try {
            const text = typeof raw === 'string'
                ? raw
                : Array.isArray(raw)
                    ? Buffer.concat(raw).toString('utf8')
                : raw instanceof Buffer
                    ? raw.toString('utf8')
                    : Buffer.from(raw as ArrayBufferLike).toString('utf8');
            const parsed = JSON.parse(text);
            return parsed && typeof parsed === 'object' ? parsed as BroadcastMessage : null;
        } catch {
            return null;
        }
    }

    private createId(prefix: string): string {
        return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
    }

    private normalizeId(value: unknown): string {
        return typeof value === 'string' ? value.trim() : '';
    }

    private normalizeScreenId(value: unknown): string {
        const normalized = typeof value === 'string' ? value.trim() : '';
        return normalized || 'default';
    }

    private requireScreenId(client: BroadcastClient, message: BroadcastMessage): string | null {
        const screenId = this.normalizeScreenId(message.screenId || client.screenId);
        if (!screenId) {
            this.send(client, {
                type: 'error',
                message: 'Broadcast signaling requires a screenId.',
            });
            return null;
        }

        client.screenId = screenId;
        return screenId;
    }

    private ensureScreenState(screenId: string): BroadcastScreenState {
        const existing = this.screens.get(screenId);
        if (existing) {
            return existing;
        }

        const created: BroadcastScreenState = {
            screenId,
            broadcasterId: null,
            hasAudio: false,
            viewers: new Set<string>(),
        };
        this.screens.set(screenId, created);
        return created;
    }

    private getScreenState(screenId: string | null): BroadcastScreenState | null {
        if (!screenId) {
            return null;
        }
        return this.screens.get(screenId) || null;
    }

    private pruneScreen(screenId: string): void {
        const screen = this.screens.get(screenId);
        if (!screen) {
            return;
        }

        if (!screen.broadcasterId && screen.viewers.size === 0) {
            this.screens.delete(screenId);
        }
    }
}
