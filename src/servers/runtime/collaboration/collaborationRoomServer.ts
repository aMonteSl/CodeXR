import * as http from 'http';
import * as net from 'net';
import { EventEmitter } from 'events';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import { buildStarWarsDisplayName } from '../../../collaboration/model/anonymousName';
import { CollaborationProfile } from '../../../collaboration/model/collaborationProfile';
import { ConnectedParticipantSummary } from '../../../collaboration/model/connectedParticipant';
import {
    AuthenticatedCollaborationSession,
} from '../../../remote_access';

interface Vector3Like {
    x: number;
    y: number;
    z: number;
}

interface TransformState {
    position?: Vector3Like | null;
    rotation?: Vector3Like | null;
}

export type CollaborationRole = 'host' | 'guest';
export type IdentityMode = 'anonymous' | 'custom';

export interface ParticipantState {
    peerId: string;
    displayName: string;
    identityMode: IdentityMode;
    avatarId: string;
    role: CollaborationRole;
    isPresenter: boolean;
    connectedAt: string;
}

export interface SharedEntityState extends Record<string, unknown> {
    entityKind?: string;
    entityId?: string;
    gestureOwnerPeerId?: string | null;
    transform?: TransformState | null;
    updatedAt?: string;
}

export interface SharedPresenceState extends Record<string, unknown> {
    peerId: string;
    displayName: string;
    identityMode: IdentityMode;
    avatarId: string;
    role: CollaborationRole;
    isPresenter: boolean;
    head?: unknown;
    body?: unknown;
    leftHand?: unknown;
    rightHand?: unknown;
    ray?: unknown;
    cursor?: unknown;
    viewport?: unknown;
    lastSeenAt?: string;
}

interface CollaborationPeer {
    id: string;
    socket: WebSocket;
    session: AuthenticatedCollaborationSession | null;
    joinedRoom: boolean;
    roomId: string | null;
    anonymousDisplayName: string;
}

interface CollaborationRoomState {
    id: string;
    revision: number;
    entities: Map<string, SharedEntityState>;
    presence: Map<string, SharedPresenceState>;
    participants: Map<string, ParticipantState>;
    presenterPeerId: string | null;
    nextDisplayNameIndex: number;
}

export interface CollaborationMessage {
    type: string;
    roomId?: string;
    peerId: string;
    entityKind: string;
    entityId: string;
    payload?: Record<string, unknown>;
}

export interface CollaborationRoomServerOptions {
    authorizeUpgrade?: (request: http.IncomingMessage) => boolean;
    resolveSession?: (request: http.IncomingMessage) => AuthenticatedCollaborationSession | null;
    handleApplicationMessage?: (
        context: CollaborationApplicationMessageContext,
        message: CollaborationMessage,
    ) => Promise<boolean> | boolean;
}

export interface CollaborationApplicationMessageContext {
    peerId: string;
    roomId: string;
    send: (payload: Record<string, unknown>) => void;
    broadcast: (payload: Record<string, unknown>) => void;
    upsertSharedEntity: (entity: SharedEntityState) => void;
    removeSharedEntity: (entityKind: string, entityId: string) => void;
}

const DEFAULT_ROOM_ID = 'codexr-session:default';
const DEFAULT_AVATAR_ID = 'avatar-1';
export const CODEXR_AVATAR_IDS = [
    'avatar-1',
    'avatar-2',
    'avatar-3',
    'avatar-4',
    'avatar-5',
    'avatar-6',
] as const;
const VALID_AVATAR_IDS = new Set<string>(CODEXR_AVATAR_IDS);
export class CollaborationRoomServer {
    private readonly path: string;
    private readonly socketServer: WebSocketServer;
    private readonly peers = new Map<string, CollaborationPeer>();
    private readonly rooms = new Map<string, CollaborationRoomState>();
    private readonly events = new EventEmitter();
    private readonly upgradeHandler: (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => void;
    private disposed = false;

    constructor(
        private readonly server: http.Server,
        path = '/codexr-room',
        private readonly options: CollaborationRoomServerOptions = {},
    ) {
        this.path = path.startsWith('/') ? path : `/${path}`;
        this.socketServer = new WebSocketServer({ noServer: true });
        this.upgradeHandler = this.handleUpgrade.bind(this);

        this.server.on('upgrade', this.upgradeHandler);
        this.socketServer.on('connection', (socket: WebSocket, request: http.IncomingMessage) => {
            this.handleConnection(socket, request);
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
        this.events.removeAllListeners();
    }

    public onParticipantsChanged(
        listener: (roomId: string, participants: ConnectedParticipantSummary[]) => void,
    ): () => void {
        this.events.on('participants-changed', listener);
        return () => this.events.off('participants-changed', listener);
    }

    public getConnectedParticipants(roomId: string): ConnectedParticipantSummary[] {
        const room = this.rooms.get(this.resolveRoomId(roomId, null));
        if (!room) {
            return [];
        }
        return Array.from(room.participants.values())
            .map((participant) => this.toConnectedParticipantSummary(participant))
            .sort((left, right) => left.connectedAt.localeCompare(right.connectedAt));
    }

    public upsertServerEntity(roomId: string, entity: SharedEntityState): void {
        const room = this.ensureRoom(roomId);
        this.upsertAuthoritativeEntity(room, entity, 'server');
    }

    public getServerEntity(
        roomId: string,
        entityKind: string,
        entityId: string,
    ): SharedEntityState | null {
        const room = this.rooms.get(this.resolveRoomId(roomId, null));
        const entity = room?.entities.get(this.getEntityKey(entityKind, entityId));
        return entity ? { ...entity } : null;
    }

    public broadcastServerMessage(roomId: string, payload: Record<string, unknown>): void {
        const room = this.ensureRoom(roomId);
        this.broadcast(room, {
            ...payload,
            roomId: room.id,
            revision: room.revision,
        });
    }

    public updateSessionProfile(sessionId: string, profile: CollaborationProfile): void {
        for (const peer of this.peers.values()) {
            if (peer.session?.sessionId !== sessionId) {
                continue;
            }
            peer.session.profile = { ...profile };
            const room = this.getRoomForPeer(peer);
            const participant = room?.participants.get(peer.id);
            if (!room || !participant) {
                continue;
            }
            this.applyProfileToParticipant(room, peer, participant, profile);
            this.broadcastParticipantUpdate(room, participant);
            this.emitParticipantsChanged(room);
        }
    }

    private handleUpgrade(req: http.IncomingMessage, socket: net.Socket, head: Buffer): void {
        const pathname = new URL(req.url || '/', 'http://codexr.local').pathname;
        if (pathname !== this.path) {
            return;
        }
        if (this.options.authorizeUpgrade && !this.options.authorizeUpgrade(req)) {
            socket.destroy();
            return;
        }

        this.socketServer.handleUpgrade(req, socket, head, (ws: WebSocket) => {
            this.socketServer.emit('connection', ws, req);
        });
    }

    private handleConnection(socket: WebSocket, request: http.IncomingMessage): void {
        const peerId = this.createId('peer');
        const peer: CollaborationPeer = {
            id: peerId,
            socket,
            session: this.options.resolveSession?.(request) || null,
            joinedRoom: false,
            roomId: null,
            anonymousDisplayName: '',
        };
        if (peer.session?.anonymousAlias) {
            peer.anonymousDisplayName = peer.session.anonymousAlias;
        }

        this.peers.set(peerId, peer);
        socket.on('message', (raw: RawData) => this.handleMessage(peer, raw));
        socket.on('close', () => this.handleDisconnect(peer));
        socket.on('error', () => this.handleDisconnect(peer));
    }

    private handleMessage(peer: CollaborationPeer, raw: RawData): void {
        const message = this.parseMessage(raw);
        if (!message) {
            this.sendError(peer, 'invalid-payload', 'Invalid collaboration payload.');
            return;
        }

        switch (message.type) {
            case 'register':
            case 'room-join':
                this.joinRoom(peer, message);
                return;
            case 'host-transfer':
                this.transferHost(peer, message.payload || {});
                return;
            case 'participant-kick':
                this.kickParticipant(peer, message.payload || {});
                return;
            case 'presenter-started':
                this.startPresenter(peer);
                return;
            case 'presenter-stopped':
                this.stopPresenter(peer, message.payload || {});
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
                console.log('[CodeXR][Room] application message received:', message.type, '(peer:', peer.id, ')');
                void this.handleApplicationMessage(peer, message);
        }
    }

    private async handleApplicationMessage(
        peer: CollaborationPeer,
        message: CollaborationMessage,
    ): Promise<void> {
        const room = this.getRoomForPeer(peer);
        if (!room || !this.options.handleApplicationMessage) {
            this.sendError(
                peer,
                'unsupported-message',
                `Unsupported collaboration message type: ${message.type}`,
            );
            return;
        }

        try {
            const handled = await this.options.handleApplicationMessage({
                peerId: peer.id,
                roomId: room.id,
                send: (payload) => this.send(peer, {
                    ...payload,
                    roomId: room.id,
                }),
                broadcast: (payload) => this.broadcast(room, {
                    ...payload,
                    roomId: room.id,
                }),
                upsertSharedEntity: (entity) => this.upsertAuthoritativeEntity(room, entity, peer.id),
                removeSharedEntity: (entityKind, entityId) => this.removeAuthoritativeEntity(room, entityKind, entityId, peer.id),
            }, message);
            if (!handled) {
                this.sendError(
                    peer,
                    'unsupported-message',
                    `Unsupported collaboration message type: ${message.type}`,
                );
            }
        } catch (error) {
            this.sendError(
                peer,
                'application-message-failed',
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    private upsertAuthoritativeEntity(
        room: CollaborationRoomState,
        entity: SharedEntityState,
        peerId: string,
    ): void {
        const normalized = this.normalizeEntityState(entity);
        if (!normalized) {
            throw new Error('invalid-authoritative-entity');
        }
        const key = this.getEntityKey(normalized.entityKind, normalized.entityId);
        const nextEntity = {
            ...(room.entities.get(key) || {}),
            ...normalized,
            updatedAt: new Date().toISOString(),
        };
        room.entities.set(key, nextEntity);
        room.revision += 1;
        this.broadcast(room, {
            type: 'entity-updated',
            peerId,
            roomId: room.id,
            revision: room.revision,
            payload: nextEntity,
        });
    }

    private joinRoom(peer: CollaborationPeer, message: CollaborationMessage): void {
        const nextRoomId = this.resolveRoomId(message.roomId, peer.roomId);
        if (peer.joinedRoom && peer.roomId && peer.roomId !== nextRoomId) {
            this.leaveRoom(peer);
        }

        const room = this.ensureRoom(nextRoomId);
        const existingParticipant = room.participants.get(peer.id);
        if (!existingParticipant) {
            peer.anonymousDisplayName = peer.anonymousDisplayName || this.createAnonymousName(room);
        }

        const role: CollaborationRole = room.participants.size === 0 ? 'host' : 'guest';
        const participant = existingParticipant || {
            peerId: peer.id,
            displayName: peer.anonymousDisplayName,
            identityMode: 'anonymous' as IdentityMode,
            avatarId: DEFAULT_AVATAR_ID,
            role,
            isPresenter: false,
            connectedAt: new Date().toISOString(),
        };

        this.applyProfileToParticipant(
            room,
            peer,
            participant,
            peer.session?.profile || {
                identityMode: 'anonymous',
                customName: '',
                avatarId: DEFAULT_AVATAR_ID,
            },
        );

        peer.joinedRoom = true;
        peer.roomId = nextRoomId;
        room.participants.set(peer.id, participant);
        this.emitParticipantsChanged(room);

        this.send(peer, {
            type: 'room-joined',
            peerId: peer.id,
            displayName: participant.displayName,
            roomId: room.id,
            revision: room.revision,
            payload: { participant },
        });
        this.send(peer, {
            type: 'room-snapshot',
            peerId: peer.id,
            roomId: room.id,
            revision: room.revision,
            payload: {
                entities: Array.from(room.entities.values()),
                presence: Array.from(room.presence.values()),
                participants: Array.from(room.participants.values()),
                presenterPeerId: room.presenterPeerId,
            },
        });

        room.revision += 1;
        this.broadcast(room, {
            type: 'participant-updated',
            peerId: peer.id,
            roomId: room.id,
            revision: room.revision,
            payload: participant,
        }, peer.id);
    }

    private transferHost(peer: CollaborationPeer, payload: Record<string, unknown>): void {
        const room = this.getRoomForPeer(peer);
        const actor = room?.participants.get(peer.id);
        if (!room || !actor || actor.role !== 'host') {
            this.sendError(peer, 'forbidden', 'Only the host can transfer the host role.');
            return;
        }

        const targetPeerId = this.normalizeId(payload.peerId || payload.targetPeerId);
        const target = room.participants.get(targetPeerId);
        if (!target || target.peerId === actor.peerId) {
            this.sendError(peer, 'invalid-participant', 'Select a connected guest to transfer the host role.');
            return;
        }

        actor.role = 'guest';
        target.role = 'host';
        room.revision += 1;
        this.broadcastRoleUpdate(room, actor);
        this.broadcastRoleUpdate(room, target);
    }

    private kickParticipant(peer: CollaborationPeer, payload: Record<string, unknown>): void {
        const room = this.getRoomForPeer(peer);
        const actor = room?.participants.get(peer.id);
        if (!room || !actor || actor.role !== 'host') {
            this.sendError(peer, 'forbidden', 'Only the host can remove a participant.');
            return;
        }

        const targetPeerId = this.normalizeId(payload.peerId || payload.targetPeerId);
        const targetPeer = this.peers.get(targetPeerId);
        const targetParticipant = room.participants.get(targetPeerId);
        if (!targetPeer || !targetParticipant || targetPeerId === peer.id) {
            this.sendError(peer, 'invalid-participant', 'The selected participant cannot be removed.');
            return;
        }

        this.send(targetPeer, {
            type: 'participant-kick',
            peerId: peer.id,
            roomId: room.id,
            payload: { peerId: targetPeerId },
        });
        targetPeer.socket.close(4001, 'Removed by room host');
    }

    private startPresenter(peer: CollaborationPeer): void {
        const room = this.getRoomForPeer(peer);
        const participant = room?.participants.get(peer.id);
        if (!room || !participant) {
            return;
        }
        if (room.presenterPeerId === peer.id) {
            return;
        }

        if (room.presenterPeerId) {
            const previous = room.participants.get(room.presenterPeerId);
            if (previous) {
                previous.isPresenter = false;
                room.revision += 1;
                this.broadcastPresenterEvent(room, 'presenter-stopped', previous);
            }
        }

        participant.isPresenter = true;
        room.presenterPeerId = peer.id;
        room.revision += 1;
        this.broadcastPresenterEvent(room, 'presenter-started', participant);
    }

    private stopPresenter(peer: CollaborationPeer, payload: Record<string, unknown>): void {
        const room = this.getRoomForPeer(peer);
        const actor = room?.participants.get(peer.id);
        if (!room || !actor || !room.presenterPeerId) {
            return;
        }

        const requestedPeerId = this.normalizeId(payload.peerId || payload.targetPeerId);
        const targetPeerId = requestedPeerId || peer.id;
        if (targetPeerId !== room.presenterPeerId) {
            return;
        }
        if (targetPeerId !== peer.id && actor.role !== 'host') {
            this.sendError(peer, 'forbidden', 'Only the host can stop another participant presentation.');
            return;
        }

        const presenter = room.participants.get(room.presenterPeerId);
        room.presenterPeerId = null;
        if (presenter) {
            presenter.isPresenter = false;
            room.revision += 1;
            this.broadcastPresenterEvent(room, 'presenter-stopped', presenter);
        }
    }

    private updatePresence(peer: CollaborationPeer, payload: Record<string, unknown>): void {
        const room = this.getRoomForPeer(peer);
        const participant = room?.participants.get(peer.id);
        if (!room || !participant) {
            return;
        }

        const previous = room.presence.get(peer.id) || null;
        const nextPresence: SharedPresenceState = {
            ...(previous || {}),
            ...payload,
            ...this.getParticipantPresence(participant),
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
            this.sendError(peer, 'invalid-entity', 'Entity updates require entityKind and entityId.');
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
        const previous = room.entities.get(key) || { entityKind, entityId };
        const nextEntity: SharedEntityState = {
            ...previous,
            entityKind,
            entityId,
            transform: this.normalizeTransform(message.payload?.transform),
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

        this.removeAuthoritativeEntity(
            room,
            String(message.entityKind || message.payload?.entityKind || ''),
            String(message.entityId || message.payload?.entityId || ''),
            peer.id,
        );
    }

    private removeAuthoritativeEntity(
        room: CollaborationRoomState,
        rawEntityKind: string,
        rawEntityId: string,
        peerId: string,
    ): void {
        const entityKind = this.normalizeId(rawEntityKind);
        const entityId = this.normalizeId(rawEntityId);
        if (!entityKind || !entityId || !room.entities.delete(this.getEntityKey(entityKind, entityId))) {
            return;
        }

        room.revision += 1;
        this.broadcast(room, {
            type: 'entity-removed',
            peerId,
            roomId: room.id,
            revision: room.revision,
            payload: { entityKind, entityId },
        }, peerId);
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

        const entity = room.entities.get(this.getEntityKey(entityKind, entityId));
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
                    payload: { entityKind, entityId, gestureOwnerPeerId: currentOwner },
                });
                return;
            }
            entity.gestureOwnerPeerId = peer.id;
        } else if (!currentOwner || currentOwner === peer.id) {
            entity.gestureOwnerPeerId = null;
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
        if (!this.peers.has(peer.id)) {
            return;
        }
        this.leaveRoom(peer);
        this.peers.delete(peer.id);
    }

    private leaveRoom(peer: CollaborationPeer): void {
        const room = this.getRoomForPeer(peer);
        if (!room) {
            peer.joinedRoom = false;
            peer.roomId = null;
            return;
        }

        const participant = room.participants.get(peer.id);
        if (room.presenterPeerId === peer.id) {
            room.presenterPeerId = null;
            if (participant) {
                participant.isPresenter = false;
                room.revision += 1;
                this.broadcastPresenterEvent(room, 'presenter-stopped', participant);
            }
        }

        room.presence.delete(peer.id);
        room.participants.delete(peer.id);
        this.emitParticipantsChanged(room);

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

        room.revision += 1;
        this.broadcast(room, {
            type: 'presence-left',
            peerId: peer.id,
            roomId: room.id,
            revision: room.revision,
            payload: { peerId: peer.id },
        }, peer.id);

        if (participant?.role === 'host') {
            this.promoteOldestGuest(room);
        }

        peer.joinedRoom = false;
        peer.roomId = null;
        if (room.participants.size === 0 && room.entities.size === 0) {
            this.rooms.delete(room.id);
        }
    }

    private promoteOldestGuest(room: CollaborationRoomState): void {
        const nextHost = Array.from(room.participants.values())
            .sort((left, right) => left.connectedAt.localeCompare(right.connectedAt))[0];
        if (!nextHost) {
            return;
        }
        nextHost.role = 'host';
        room.revision += 1;
        this.broadcastRoleUpdate(room, nextHost);
    }

    private broadcastRoleUpdate(room: CollaborationRoomState, participant: ParticipantState): void {
        const presence = room.presence.get(participant.peerId);
        if (presence) {
            presence.role = participant.role;
        }
        this.broadcast(room, {
            type: 'role-updated',
            peerId: participant.peerId,
            roomId: room.id,
            revision: room.revision,
            payload: participant,
        });
    }

    private broadcastPresenterEvent(
        room: CollaborationRoomState,
        type: 'presenter-started' | 'presenter-stopped',
        participant: ParticipantState,
    ): void {
        const presence = room.presence.get(participant.peerId);
        if (presence) {
            presence.isPresenter = participant.isPresenter;
        }
        this.broadcast(room, {
            type,
            peerId: participant.peerId,
            roomId: room.id,
            revision: room.revision,
            payload: participant,
        });
    }

    private getParticipantPresence(participant: ParticipantState): Pick<
        SharedPresenceState,
        'displayName' | 'identityMode' | 'avatarId' | 'role' | 'isPresenter'
    > {
        return {
            displayName: participant.displayName,
            identityMode: participant.identityMode,
            avatarId: participant.avatarId,
            role: participant.role,
            isPresenter: participant.isPresenter,
        };
    }

    private sanitizeDisplayName(value: unknown): string {
        if (typeof value !== 'string') {
            return '';
        }
        const sanitized = value
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        const characterCount = Array.from(sanitized).length;
        return characterCount >= 2 && characterCount <= 32 ? sanitized : '';
    }

    private createUniqueDisplayName(room: CollaborationRoomState, requestedName: string, peerId: string): string {
        const existingNames = new Set(
            Array.from(room.participants.values())
                .filter((participant) => participant.peerId !== peerId)
                .map((participant) => participant.displayName.toLocaleLowerCase()),
        );
        if (!existingNames.has(requestedName.toLocaleLowerCase())) {
            return requestedName;
        }

        for (let suffix = 2; suffix < 10_000; suffix += 1) {
            const suffixText = ` ${suffix}`;
            const maxBaseLength = 32 - suffixText.length;
            const base = Array.from(requestedName).slice(0, maxBaseLength).join('').trimEnd();
            const candidate = `${base}${suffixText}`;
            if (!existingNames.has(candidate.toLocaleLowerCase())) {
                return candidate;
            }
        }
        return `${Array.from(requestedName).slice(0, 23).join('')} ${peerId.slice(-6)}`;
    }

    private applyProfileToParticipant(
        room: CollaborationRoomState,
        peer: CollaborationPeer,
        participant: ParticipantState,
        profile: CollaborationProfile,
    ): void {
        const avatarId = this.normalizeAvatarId(profile.avatarId) || DEFAULT_AVATAR_ID;
        const customName = profile.identityMode === 'custom'
            ? this.sanitizeDisplayName(profile.customName)
            : '';
        if (customName) {
            participant.identityMode = 'custom';
            participant.displayName = this.createUniqueDisplayName(room, customName, peer.id);
        } else {
            participant.identityMode = 'anonymous';
            const anonymousName = peer.anonymousDisplayName || this.createAnonymousName(room);
            participant.displayName = this.createUniqueDisplayName(room, anonymousName, peer.id);
            peer.anonymousDisplayName = participant.displayName;
        }
        participant.avatarId = avatarId;
    }

    private broadcastParticipantUpdate(room: CollaborationRoomState, participant: ParticipantState): void {
        const presence = room.presence.get(participant.peerId);
        if (presence) {
            Object.assign(presence, this.getParticipantPresence(participant));
        }
        room.revision += 1;
        this.broadcast(room, {
            type: 'participant-updated',
            peerId: participant.peerId,
            roomId: room.id,
            revision: room.revision,
            payload: participant,
        });
    }

    private createAnonymousName(room: CollaborationRoomState): string {
        let candidate = '';
        do {
            candidate = buildStarWarsDisplayName(room.nextDisplayNameIndex);
            room.nextDisplayNameIndex += 1;
        } while (
            Array.from(room.participants.values())
                .some((participant) => participant.displayName.toLocaleLowerCase() === candidate.toLocaleLowerCase())
        );
        return candidate;
    }

    private normalizeAvatarId(value: unknown): string {
        const avatarId = this.normalizeId(value);
        return VALID_AVATAR_IDS.has(avatarId) ? avatarId : '';
    }

    private parseMessage(raw: RawData): CollaborationMessage | null {
        try {
            const parsed = JSON.parse(raw.toString('utf8'));
            return parsed && typeof parsed === 'object' ? parsed as CollaborationMessage : null;
        } catch {
            return null;
        }
    }

    private send(peer: CollaborationPeer, payload: Record<string, unknown>): void {
        if (peer.socket.readyState === WebSocket.OPEN) {
            peer.socket.send(JSON.stringify(payload));
        }
    }

    private sendError(peer: CollaborationPeer, code: string, message: string): void {
        this.send(peer, {
            type: 'error',
            roomId: peer.roomId || undefined,
            payload: { code, message },
        });
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
            participants: new Map<string, ParticipantState>(),
            presenterPeerId: null,
            nextDisplayNameIndex: 0,
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

    private normalizeEntityState(value: unknown): (SharedEntityState & { entityKind: string; entityId: string }) | null {
        if (!value || typeof value !== 'object') {
            return null;
        }
        const entityKind = this.normalizeId((value as SharedEntityState).entityKind);
        const entityId = this.normalizeId((value as SharedEntityState).entityId);
        if (!entityKind || !entityId) {
            return null;
        }
        return {
            ...(value as SharedEntityState),
            entityKind,
            entityId,
            gestureOwnerPeerId: this.normalizeOptionalId((value as SharedEntityState).gestureOwnerPeerId),
            transform: this.normalizeTransform((value as SharedEntityState).transform),
            updatedAt: new Date().toISOString(),
        };
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
        return this.normalizeId(preferred) || this.normalizeId(fallback) || DEFAULT_ROOM_ID;
    }

    private normalizeId(value: unknown): string {
        return typeof value === 'string' ? value.trim() : '';
    }

    private normalizeOptionalId(value: unknown): string | null {
        return this.normalizeId(value) || null;
    }

    private getEntityKey(entityKind: string, entityId: string): string {
        return `${entityKind}:${entityId}`;
    }

    private emitParticipantsChanged(room: CollaborationRoomState): void {
        this.events.emit(
            'participants-changed',
            room.id,
            this.getConnectedParticipants(room.id),
        );
    }

    private toConnectedParticipantSummary(participant: ParticipantState): ConnectedParticipantSummary {
        const peer = this.peers.get(participant.peerId);
        return {
            peerId: participant.peerId,
            displayName: participant.displayName,
            avatarId: participant.avatarId,
            clientKind: peer?.session?.clientKind || 'browser',
            connectionScope: peer?.session?.remote ? 'remote' : 'local',
            connectedAt: participant.connectedAt,
        };
    }

    private createId(prefix: string): string {
        return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
    }
}
