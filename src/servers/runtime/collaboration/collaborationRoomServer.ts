import * as http from 'http';
import * as net from 'net';
import { RawData, WebSocket, WebSocketServer } from 'ws';

interface Vector3Like {
    x: number;
    y: number;
    z: number;
}

interface TransformState {
    position?: Vector3Like | null;
    rotation?: Vector3Like | null;
}

export interface SharedEntityState extends Record<string, unknown> {
    entityKind: string;
    entityId: string;
    gestureOwnerPeerId?: string | null;
    transform?: TransformState | null;
    updatedAt?: string;
}

export interface SharedPresenceState extends Record<string, unknown> {
    peerId: string;
    head?: unknown;
    leftHand?: unknown;
    rightHand?: unknown;
    cursor?: unknown;
    viewport?: unknown;
    lastSeenAt?: string;
}

interface CollaborationPeer {
    id: string;
    socket: WebSocket;
    joinedRoom: boolean;
    roomId: string | null;
}

interface CollaborationRoomState {
    id: string;
    revision: number;
    entities: Map<string, SharedEntityState>;
    presence: Map<string, SharedPresenceState>;
}

interface CollaborationMessage {
    type: string;
    roomId?: string;
    peerId?: string;
    entityKind?: string;
    entityId?: string;
    payload?: Record<string, unknown>;
}

const DEFAULT_ROOM_ID = 'codexr-session:default';

export class CollaborationRoomServer {
    private readonly path: string;
    private readonly socketServer: WebSocketServer;
    private readonly peers = new Map<string, CollaborationPeer>();
    private readonly rooms = new Map<string, CollaborationRoomState>();
    private readonly upgradeHandler: (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => void;
    private disposed = false;

    constructor(
        private readonly server: http.Server,
        path = '/codexr-room',
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

        for (const peer of this.peers.values()) {
            try {
                peer.socket.close();
            } catch {
                // Best-effort cleanup.
            }
        }

        this.peers.clear();
        this.rooms.clear();
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
        const peerId = this.createId('peer');
        const peer: CollaborationPeer = {
            id: peerId,
            socket,
            joinedRoom: false,
            roomId: null,
        };

        this.peers.set(peerId, peer);

        socket.on('message', (raw: RawData) => {
            this.handleMessage(peer, raw);
        });
        socket.on('close', () => {
            this.handleDisconnect(peer);
        });
        socket.on('error', () => {
            this.handleDisconnect(peer);
        });
    }

    private handleMessage(peer: CollaborationPeer, raw: RawData): void {
        const message = this.parseMessage(raw);
        if (!message) {
            this.send(peer, {
                type: 'error',
                payload: { message: 'Invalid collaboration payload.' },
            });
            return;
        }

        switch (message.type) {
            case 'register':
            case 'room-join':
                this.joinRoom(peer, message);
                return;
            case 'presence-update':
                this.updatePresence(peer, message.payload || {});
                return;
            case 'entity-added':
                this.upsertEntity(peer, message, 'entity-added');
                return;
            case 'entity-updated':
                this.upsertEntity(peer, message, 'entity-updated');
                return;
            case 'entity-transform':
                this.updateEntityTransform(peer, message);
                return;
            case 'entity-removed':
                this.removeEntity(peer, message);
                return;
            case 'entity-lock':
                this.updateEntityLock(peer, message, true);
                return;
            case 'entity-unlock':
                this.updateEntityLock(peer, message, false);
                return;
            default:
                this.send(peer, {
                    type: 'error',
                    payload: { message: `Unsupported collaboration message type: ${message.type}` },
                });
        }
    }

    private joinRoom(peer: CollaborationPeer, message: CollaborationMessage): void {
        const nextRoomId = this.resolveRoomId(message.roomId, peer.roomId);
        if (peer.joinedRoom && peer.roomId && peer.roomId !== nextRoomId) {
            this.leaveRoom(peer);
        }

        peer.joinedRoom = true;
        peer.roomId = nextRoomId;

        const room = this.ensureRoom(nextRoomId);

        this.send(peer, {
            type: 'room-joined',
            peerId: peer.id,
            roomId: room.id,
            revision: room.revision,
        });

        this.send(peer, {
            type: 'room-snapshot',
            peerId: peer.id,
            roomId: room.id,
            revision: room.revision,
            payload: {
                entities: Array.from(room.entities.values()),
                presence: Array.from(room.presence.values()),
            },
        });
    }

    private updatePresence(peer: CollaborationPeer, payload: Record<string, unknown>): void {
        const room = this.getRoomForPeer(peer);
        if (!room) {
            return;
        }

        const previous = room.presence.get(peer.id) || null;
        const nextPresence: SharedPresenceState = {
            ...(previous || {}),
            ...payload,
            peerId: peer.id,
            lastSeenAt: new Date().toISOString(),
        };

        room.presence.set(peer.id, nextPresence);
        room.revision += 1;

        this.broadcast(room, {
            type: previous ? 'presence-updated' : 'presence-joined',
            peerId: peer.id,
            roomId: room.id,
            revision: room.revision,
            payload: nextPresence,
        }, peer.id);
    }

    private upsertEntity(
        peer: CollaborationPeer,
        message: CollaborationMessage,
        eventType: 'entity-added' | 'entity-updated',
    ): void {
        const room = this.getRoomForPeer(peer);
        if (!room) {
            return;
        }

        const entity = this.normalizeEntityState(message.payload || message);
        if (!entity) {
            this.send(peer, {
                type: 'error',
                roomId: room.id,
                payload: { message: 'Entity updates require entityKind and entityId.' },
            });
            return;
        }

        const key = this.getEntityKey(entity.entityKind, entity.entityId);
        const previous = room.entities.get(key) || null;
        const nextEntity: SharedEntityState = {
            ...(previous || {}),
            ...entity,
            entityKind: entity.entityKind,
            entityId: entity.entityId,
            updatedAt: new Date().toISOString(),
        };

        room.entities.set(key, nextEntity);
        room.revision += 1;

        this.broadcast(room, {
            type: eventType,
            peerId: peer.id,
            roomId: room.id,
            revision: room.revision,
            payload: nextEntity,
        }, peer.id);
    }

    private updateEntityTransform(peer: CollaborationPeer, message: CollaborationMessage): void {
        const room = this.getRoomForPeer(peer);
        if (!room) {
            return;
        }

        const entityKind = this.normalizeId(message.entityKind || message.payload?.entityKind);
        const entityId = this.normalizeId(message.entityId || message.payload?.entityId);
        if (!entityKind || !entityId) {
            return;
        }

        const key = this.getEntityKey(entityKind, entityId);
        const previous = room.entities.get(key) || {
            entityKind,
            entityId,
        };
        const payload = message.payload || {};
        const nextEntity: SharedEntityState = {
            ...previous,
            entityKind,
            entityId,
            transform: this.normalizeTransform(payload.transform),
            updatedAt: new Date().toISOString(),
        };

        room.entities.set(key, nextEntity);
        room.revision += 1;

        this.broadcast(room, {
            type: 'entity-transform',
            peerId: peer.id,
            roomId: room.id,
            revision: room.revision,
            payload: nextEntity,
        }, peer.id);
    }

    private removeEntity(peer: CollaborationPeer, message: CollaborationMessage): void {
        const room = this.getRoomForPeer(peer);
        if (!room) {
            return;
        }

        const entityKind = this.normalizeId(message.entityKind || message.payload?.entityKind);
        const entityId = this.normalizeId(message.entityId || message.payload?.entityId);
        if (!entityKind || !entityId) {
            return;
        }

        const key = this.getEntityKey(entityKind, entityId);
        if (!room.entities.delete(key)) {
            return;
        }

        room.revision += 1;
        this.broadcast(room, {
            type: 'entity-removed',
            peerId: peer.id,
            roomId: room.id,
            revision: room.revision,
            payload: { entityKind, entityId },
        }, peer.id);
    }

    private updateEntityLock(peer: CollaborationPeer, message: CollaborationMessage, isLock: boolean): void {
        const room = this.getRoomForPeer(peer);
        if (!room) {
            return;
        }

        const entityKind = this.normalizeId(message.entityKind || message.payload?.entityKind);
        const entityId = this.normalizeId(message.entityId || message.payload?.entityId);
        if (!entityKind || !entityId) {
            return;
        }

        const key = this.getEntityKey(entityKind, entityId);
        const entity = room.entities.get(key);
        if (!entity) {
            return;
        }

        const currentOwner = this.normalizeId(entity.gestureOwnerPeerId);
        if (isLock) {
            if (currentOwner && currentOwner !== peer.id) {
                this.send(peer, {
                    type: 'entity-lock-denied',
                    peerId: peer.id,
                    roomId: room.id,
                    revision: room.revision,
                    payload: {
                        entityKind,
                        entityId,
                        gestureOwnerPeerId: currentOwner,
                    },
                });
                return;
            }
            entity.gestureOwnerPeerId = peer.id;
        } else {
            if (!currentOwner || currentOwner === peer.id) {
                entity.gestureOwnerPeerId = null;
            }
        }

        entity.updatedAt = new Date().toISOString();
        room.revision += 1;

        this.broadcast(room, {
            type: isLock ? 'entity-lock' : 'entity-unlock',
            peerId: peer.id,
            roomId: room.id,
            revision: room.revision,
            payload: entity,
        }, peer.id);
    }

    private handleDisconnect(peer: CollaborationPeer): void {
        const room = this.getRoomForPeer(peer);
        if (room) {
            if (room.presence.delete(peer.id)) {
                room.revision += 1;
                this.broadcast(room, {
                    type: 'presence-left',
                    peerId: peer.id,
                    roomId: room.id,
                    revision: room.revision,
                    payload: { peerId: peer.id },
                }, peer.id);
            }

            for (const entity of room.entities.values()) {
                if (entity.gestureOwnerPeerId !== peer.id) {
                    continue;
                }
                entity.gestureOwnerPeerId = null;
                entity.updatedAt = new Date().toISOString();
                room.revision += 1;
                this.broadcast(room, {
                    type: 'entity-unlock',
                    peerId: peer.id,
                    roomId: room.id,
                    revision: room.revision,
                    payload: entity,
                }, peer.id);
            }
        }

        peer.joinedRoom = false;
        peer.roomId = null;
        this.peers.delete(peer.id);
    }

    private leaveRoom(peer: CollaborationPeer): void {
        const room = this.getRoomForPeer(peer);
        if (!room) {
            peer.joinedRoom = false;
            peer.roomId = null;
            return;
        }

        if (room.presence.delete(peer.id)) {
            room.revision += 1;
            this.broadcast(room, {
                type: 'presence-left',
                peerId: peer.id,
                roomId: room.id,
                revision: room.revision,
                payload: { peerId: peer.id },
            }, peer.id);
        }

        peer.joinedRoom = false;
        peer.roomId = null;
    }

    private parseMessage(raw: RawData): CollaborationMessage | null {
        try {
            const decoded = raw.toString('utf8');
            const parsed = JSON.parse(decoded);
            if (!parsed || typeof parsed !== 'object') {
                return null;
            }
            return parsed as CollaborationMessage;
        } catch {
            return null;
        }
    }

    private send(peer: CollaborationPeer, payload: Record<string, unknown>): void {
        if (peer.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        peer.socket.send(JSON.stringify(payload));
    }

    private broadcast(room: CollaborationRoomState, payload: Record<string, unknown>, excludedPeerId?: string): void {
        for (const peer of this.peers.values()) {
            if (!peer.joinedRoom || peer.roomId !== room.id || peer.id === excludedPeerId) {
                continue;
            }
            this.send(peer, payload);
        }
    }

    private ensureRoom(roomId: string): CollaborationRoomState {
        const normalizedRoomId = this.resolveRoomId(roomId, null);
        const existing = this.rooms.get(normalizedRoomId);
        if (existing) {
            return existing;
        }

        const created: CollaborationRoomState = {
            id: normalizedRoomId,
            revision: 0,
            entities: new Map<string, SharedEntityState>(),
            presence: new Map<string, SharedPresenceState>(),
        };
        this.rooms.set(normalizedRoomId, created);
        return created;
    }

    private getRoomForPeer(peer: CollaborationPeer): CollaborationRoomState | null {
        if (!peer.joinedRoom || !peer.roomId) {
            return null;
        }
        return this.rooms.get(peer.roomId) || null;
    }

    private normalizeEntityState(value: unknown): SharedEntityState | null {
        if (!value || typeof value !== 'object') {
            return null;
        }
        const entityKind = this.normalizeId((value as SharedEntityState).entityKind);
        const entityId = this.normalizeId((value as SharedEntityState).entityId);
        if (!entityKind || !entityId) {
            return null;
        }

        const normalized: SharedEntityState = {
            ...(value as SharedEntityState),
            entityKind,
            entityId,
            gestureOwnerPeerId: this.normalizeOptionalId((value as SharedEntityState).gestureOwnerPeerId),
            transform: this.normalizeTransform((value as SharedEntityState).transform),
            updatedAt: new Date().toISOString(),
        };
        return normalized;
    }

    private normalizeTransform(value: unknown): TransformState | null {
        if (!value || typeof value !== 'object') {
            return null;
        }
        const record = value as TransformState;
        return {
            position: this.normalizeVector(record.position),
            rotation: this.normalizeVector(record.rotation),
        };
    }

    private normalizeVector(value: unknown): Vector3Like | null {
        if (!value || typeof value !== 'object') {
            return null;
        }
        const vector = value as Vector3Like;
        return {
            x: Number.isFinite(vector.x) ? vector.x : 0,
            y: Number.isFinite(vector.y) ? vector.y : 0,
            z: Number.isFinite(vector.z) ? vector.z : 0,
        };
    }

    private resolveRoomId(preferred: unknown, fallback: string | null): string {
        const normalizedPreferred = this.normalizeId(preferred);
        if (normalizedPreferred) {
            return normalizedPreferred;
        }
        const normalizedFallback = this.normalizeId(fallback);
        return normalizedFallback || DEFAULT_ROOM_ID;
    }

    private normalizeId(value: unknown): string {
        return typeof value === 'string' ? value.trim() : '';
    }

    private normalizeOptionalId(value: unknown): string | null {
        const normalized = this.normalizeId(value);
        return normalized || null;
    }

    private getEntityKey(entityKind: string, entityId: string): string {
        return `${entityKind}:${entityId}`;
    }

    private createId(prefix: string): string {
        return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
    }
}
