import * as http from 'http';
import * as net from 'net';
import { WebSocketServer, WebSocket, RawData } from 'ws';

type BroadcastRole = 'none' | 'sender' | 'viewer';

/**
 * Where a client reached this server from. Peer-to-peer WebRTC only survives
 * inside one network: across the tunnel the two browsers sit behind different
 * NATs and, with no TURN server, ICE never connects. Remote viewers therefore
 * take their media through this server, which they can always reach.
 */
export type BroadcastClientScope = 'local' | 'remote';

interface BroadcastClient {
    id: string;
    roomId: string | null;
    socket: WebSocket;
    screenId: string | null;
    role: BroadcastRole;
    hasAudio: boolean;
    scope: BroadcastClientScope;
}

interface BroadcastScreenState {
    roomId: string;
    screenId: string;
    broadcasterId: string | null;
    hasAudio: boolean;
    /** Viewers served by direct WebRTC. */
    viewers: Set<string>;
    /** Viewers served by media relayed through this server. */
    relayViewers: Set<string>;
}

interface BroadcastMessage {
    type: string;
    roomId?: string;
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

const DEFAULT_ROOM_ID = 'codexr-session:default';

/** Media frame wire format, mirrored by the runtime relay transport. */
const FRAME_HEADER_BYTES = 12;
const FRAME_MAGIC_0 = 0x43; // 'C'
const FRAME_MAGIC_1 = 0x58; // 'X'
const FRAME_KIND_OFFSET = 3;
/** Delta video frames are droppable; keyframes and audio never are. */
const FRAME_KIND_VIDEO_DELTA = 2;
/** A single frame larger than this is a bug or an attack, not a screen. */
const MAX_FRAME_BYTES = 4 * 1024 * 1024;
/**
 * Every relay viewer costs the host one upstream copy through the tunnel, so
 * the fan-out is capped instead of quietly degrading the whole session.
 */
const MAX_RELAY_VIEWERS = 4;
/** Above this backlog the socket is losing; drop deltas until it catches up. */
const RELAY_BACKPRESSURE_BYTES = 2 * 1024 * 1024;

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
        private readonly authorizeUpgrade: (request: http.IncomingMessage) => boolean = () => true,
        private readonly resolveScope: (request: http.IncomingMessage) => BroadcastClientScope = () => 'local',
    ) {
        this.path = path.startsWith('/') ? path : `/${path}`;
        this.socketServer = new WebSocketServer({ noServer: true });
        this.upgradeHandler = this.handleUpgrade.bind(this);

        this.server.on('upgrade', this.upgradeHandler);
        this.socketServer.on('connection', (socket: WebSocket, request: http.IncomingMessage) => {
            this.handleConnection(socket, this.resolveScope(request));
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
        if (!this.authorizeUpgrade(req)) {
            socket.destroy();
            return;
        }

        this.socketServer.handleUpgrade(req, socket, head, (ws: WebSocket) => {
            this.socketServer.emit('connection', ws, req);
        });
    }

    private handleConnection(socket: WebSocket, scope: BroadcastClientScope): void {
        const clientId = this.createId('client');
        const client: BroadcastClient = {
            id: clientId,
            roomId: null,
            socket,
            screenId: null,
            role: 'none',
            hasAudio: false,
            scope,
        };

        this.clients.set(clientId, client);

        socket.on('message', (raw: RawData, isBinary: boolean) => {
            if (isBinary) {
                this.forwardMediaFrame(client, raw);
                return;
            }
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
            case 'relay-request':
                // A viewer whose direct connection never delivered media asks
                // to be served through the relay instead.
                this.promoteViewerToRelay(client);
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
        client.roomId = this.normalizeRoomId(message.roomId);
        client.role = 'none';
        client.hasAudio = false;

        this.send(client, {
            type: 'registered',
            clientId: client.id,
            roomId: client.roomId,
            screenId: client.screenId,
        });

        const screen = this.getScreenState(client.roomId, client.screenId);
        if (screen?.broadcasterId && screen.broadcasterId !== client.id) {
            this.send(client, {
                type: 'broadcast-available',
                roomId: screen.roomId,
                screenId: screen.screenId,
                broadcasterId: screen.broadcasterId,
                hasAudio: screen.hasAudio,
            });
        }
    }

    private startBroadcast(client: BroadcastClient, message: BroadcastMessage): void {
        const roomId = this.requireRoomId(client, message);
        if (!roomId) {
            return;
        }
        const screenId = this.requireScreenId(client, message);
        if (!screenId) {
            return;
        }

        const screen = this.ensureScreenState(roomId, screenId);
        const previousBroadcasterId = screen.broadcasterId;

        if (previousBroadcasterId && previousBroadcasterId !== client.id) {
            const previousBroadcaster = this.clients.get(previousBroadcasterId);
            if (previousBroadcaster) {
                previousBroadcaster.role = 'none';
                previousBroadcaster.hasAudio = false;
                this.send(previousBroadcaster, {
                    type: 'broadcast-replaced',
                    roomId,
                    screenId,
                });
            }
            for (const viewerId of [...screen.viewers, ...screen.relayViewers]) {
                const viewer = this.clients.get(viewerId);
                if (viewer) {
                    viewer.role = 'none';
                }
            }
            screen.viewers.clear();
            screen.relayViewers.clear();
        }

        client.role = 'sender';
        client.hasAudio = !!message.hasAudio;
        screen.broadcasterId = client.id;
        screen.hasAudio = client.hasAudio;

        this.send(client, {
            type: 'broadcast-live',
            roomId,
            screenId,
            hasAudio: client.hasAudio,
        });

        // Remote viewers that were already waiting need the encoder now: they
        // asked to join before this broadcast existed.
        if (screen.relayViewers.size > 0) {
            this.send(client, {
                type: 'relay-start',
                roomId,
                screenId,
                relayViewerCount: screen.relayViewers.size,
            });
        }

        for (const candidate of this.clients.values()) {
            if (
                candidate.id === client.id
                || candidate.roomId !== roomId
                || candidate.screenId !== screenId
            ) {
                continue;
            }
            this.send(candidate, {
                type: 'broadcast-available',
                roomId,
                screenId,
                broadcasterId: client.id,
                hasAudio: client.hasAudio,
            });
        }
    }

    private stopBroadcast(client: BroadcastClient, reason: string): void {
        const roomId = client.roomId;
        const screenId = client.screenId;
        if (!roomId || !screenId) {
            return;
        }

        const screen = this.getScreenState(roomId, screenId);
        if (!screen || screen.broadcasterId !== client.id) {
            return;
        }

        for (const viewerId of [...screen.viewers, ...screen.relayViewers]) {
            const viewer = this.clients.get(viewerId);
            if (viewer) {
                viewer.role = 'none';
                this.send(viewer, {
                    type: 'broadcast-stopped',
                    roomId,
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
        screen.relayViewers.clear();
        this.pruneScreen(roomId, screenId);
    }

    private registerViewer(client: BroadcastClient): void {
        const roomId = client.roomId;
        const screenId = client.screenId;
        if (!roomId || !screenId) {
            this.send(client, {
                type: 'error',
                message: 'Viewer cannot join without a screenId.',
            });
            return;
        }

        const screen = this.getScreenState(roomId, screenId);
        if (!screen?.broadcasterId) {
            this.send(client, {
                type: 'broadcast-stopped',
                roomId,
                screenId,
                reason: 'no-signal',
            });
            return;
        }

        client.role = 'viewer';
        const broadcaster = this.clients.get(screen.broadcasterId);

        // Viewers on this network get direct WebRTC; the ones arriving through
        // the tunnel get the media relayed, because peer-to-peer cannot reach
        // them and they would otherwise sit on a black screen.
        if (client.scope === 'remote') {
            if (screen.relayViewers.size >= MAX_RELAY_VIEWERS) {
                this.send(client, {
                    type: 'broadcast-stopped',
                    roomId,
                    screenId,
                    reason: 'relay-capacity',
                });
                client.role = 'none';
                return;
            }

            const wasIdle = screen.relayViewers.size === 0;
            screen.relayViewers.add(client.id);
            this.send(client, {
                type: 'relay-ready',
                roomId,
                screenId,
                broadcasterId: screen.broadcasterId,
                hasAudio: screen.hasAudio,
            });
            if (broadcaster) {
                this.send(broadcaster, {
                    // Starting the encoder is the expensive part, so it only
                    // happens for the first relay viewer; later ones just need
                    // a keyframe to be able to decode mid-stream.
                    type: wasIdle ? 'relay-start' : 'relay-keyframe',
                    roomId,
                    screenId,
                    viewerId: client.id,
                    relayViewerCount: screen.relayViewers.size,
                });
            }
            return;
        }

        screen.viewers.add(client.id);
        if (broadcaster) {
            this.send(broadcaster, {
                type: 'viewer-join',
                roomId,
                screenId,
                viewerId: client.id,
            });
        }
    }

    /** Move a viewer off the direct path and onto the relay. */
    private promoteViewerToRelay(client: BroadcastClient): void {
        const screen = this.getScreenState(client.roomId, client.screenId);
        if (!screen?.broadcasterId || screen.relayViewers.has(client.id)) {
            return;
        }
        if (screen.relayViewers.size >= MAX_RELAY_VIEWERS) {
            this.send(client, {
                type: 'broadcast-stopped',
                roomId: screen.roomId,
                screenId: screen.screenId,
                reason: 'relay-capacity',
            });
            return;
        }

        const wasIdle = screen.relayViewers.size === 0;
        screen.viewers.delete(client.id);
        screen.relayViewers.add(client.id);
        client.role = 'viewer';

        this.send(client, {
            type: 'relay-ready',
            roomId: screen.roomId,
            screenId: screen.screenId,
            broadcasterId: screen.broadcasterId,
            hasAudio: screen.hasAudio,
        });

        const broadcaster = this.clients.get(screen.broadcasterId);
        if (broadcaster) {
            this.send(broadcaster, {
                type: wasIdle ? 'relay-start' : 'relay-keyframe',
                roomId: screen.roomId,
                screenId: screen.screenId,
                viewerId: client.id,
                relayViewerCount: screen.relayViewers.size,
            });
        }
    }

    /**
     * Relay one encoded media frame from the broadcaster to the viewers that
     * cannot be reached peer-to-peer. The payload is never inspected beyond
     * its header: this server is a pipe, not a transcoder.
     */
    private forwardMediaFrame(client: BroadcastClient, raw: RawData): void {
        const frame = this.toFrameBuffer(raw);
        if (!frame) {
            return;
        }

        const screen = this.getScreenState(client.roomId, client.screenId);
        if (!screen || screen.broadcasterId !== client.id || screen.relayViewers.size === 0) {
            return;
        }

        const droppable = frame[FRAME_KIND_OFFSET] === FRAME_KIND_VIDEO_DELTA;
        for (const viewerId of screen.relayViewers) {
            const viewer = this.clients.get(viewerId);
            if (!viewer || viewer.socket.readyState !== WebSocket.OPEN) {
                continue;
            }
            // A saturated viewer loses deltas rather than the whole session;
            // keyframes and audio always go through so it can recover.
            if (droppable && viewer.socket.bufferedAmount > RELAY_BACKPRESSURE_BYTES) {
                continue;
            }
            viewer.socket.send(frame, { binary: true });
        }
    }

    private toFrameBuffer(raw: RawData): Buffer | null {
        const frame = Array.isArray(raw)
            ? Buffer.concat(raw)
            : Buffer.isBuffer(raw)
                ? raw
                : Buffer.from(raw as ArrayBufferLike);

        if (frame.length < FRAME_HEADER_BYTES || frame.length > MAX_FRAME_BYTES) {
            return null;
        }
        if (frame[0] !== FRAME_MAGIC_0 || frame[1] !== FRAME_MAGIC_1) {
            return null;
        }
        return frame;
    }

    private removeRelayViewer(screen: BroadcastScreenState, clientId: string): void {
        if (!screen.relayViewers.delete(clientId) || screen.relayViewers.size > 0) {
            return;
        }
        // Nobody left to relay to: tell the broadcaster to shut the encoder
        // down instead of encoding into the void.
        const broadcaster = screen.broadcasterId ? this.clients.get(screen.broadcasterId) : null;
        if (broadcaster) {
            this.send(broadcaster, {
                type: 'relay-stop',
                roomId: screen.roomId,
                screenId: screen.screenId,
            });
        }
    }

    private removeViewer(client: BroadcastClient): void {
        const roomId = client.roomId;
        const screenId = client.screenId;
        if (!roomId || !screenId) {
            return;
        }

        const screen = this.getScreenState(roomId, screenId);
        if (!screen) {
            client.role = 'none';
            return;
        }

        if (screen.viewers.delete(client.id) && screen.broadcasterId) {
            const broadcaster = this.clients.get(screen.broadcasterId);
            if (broadcaster) {
                this.send(broadcaster, {
                    type: 'viewer-left',
                    roomId,
                    screenId,
                    viewerId: client.id,
                });
            }
        }
        this.removeRelayViewer(screen, client.id);

        client.role = 'none';
        this.pruneScreen(roomId, screenId);
    }

    private forwardSignal(client: BroadcastClient, message: BroadcastMessage): void {
        const roomId = client.roomId;
        const screenId = client.screenId;
        const targetId = this.normalizeId(message.targetId);
        if (!roomId || !screenId || !targetId) {
            return;
        }

        const target = this.clients.get(targetId);
        if (!target || target.roomId !== roomId || target.screenId !== screenId) {
            return;
        }

        this.send(target, {
            type: message.type,
            roomId,
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

    private normalizeRoomId(value: unknown): string {
        const normalized = typeof value === 'string' ? value.trim() : '';
        return normalized || DEFAULT_ROOM_ID;
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

    private requireRoomId(client: BroadcastClient, message: BroadcastMessage): string | null {
        const roomId = this.normalizeRoomId(message.roomId || client.roomId);
        if (!roomId) {
            this.send(client, {
                type: 'error',
                message: 'Broadcast signaling requires a roomId.',
            });
            return null;
        }
        client.roomId = roomId;
        return roomId;
    }

    private getScreenKey(roomId: string, screenId: string): string {
        return `${roomId}::${screenId}`;
    }

    private ensureScreenState(roomId: string, screenId: string): BroadcastScreenState {
        const key = this.getScreenKey(roomId, screenId);
        const existing = this.screens.get(key);
        if (existing) {
            return existing;
        }

        const created: BroadcastScreenState = {
            roomId,
            screenId,
            broadcasterId: null,
            hasAudio: false,
            viewers: new Set<string>(),
            relayViewers: new Set<string>(),
        };
        this.screens.set(key, created);
        return created;
    }

    private getScreenState(roomId: string | null, screenId: string | null): BroadcastScreenState | null {
        if (!roomId || !screenId) {
            return null;
        }
        return this.screens.get(this.getScreenKey(roomId, screenId)) || null;
    }

    private pruneScreen(roomId: string, screenId: string): void {
        const key = this.getScreenKey(roomId, screenId);
        const screen = this.screens.get(key);
        if (!screen) {
            return;
        }

        if (!screen.broadcasterId && screen.viewers.size === 0 && screen.relayViewers.size === 0) {
            this.screens.delete(key);
        }
    }
}
