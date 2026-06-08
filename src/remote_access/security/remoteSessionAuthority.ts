import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import {
    CollaborationProfile,
    DEFAULT_COLLABORATION_PROFILE,
    sanitizeCollaborationName,
    VALID_AVATAR_IDS,
    normalizeCollaborationProfile,
} from '../../collaboration/model/collaborationProfile';
import { buildStarWarsDisplayName } from '../../collaboration/model/anonymousName';
import {
    AuthenticatedCollaborationSession,
    CollaborationClientKind,
} from '../model/remoteAccessModel';

interface InvitationRecord {
    hash: string;
    expiresAt: number;
}

interface PairingRequest {
    id: string;
    invitationHash: string;
    codeHash: string;
    codeSalt: string;
    remoteAddress: string;
    installationId: string;
    profile: CollaborationProfile;
    clientKind: CollaborationClientKind;
    anonymousAlias?: string;
    attempts: number;
    expiresAt: number;
}

interface BrowserIdentityRecord {
    hash: string;
    invitationHash: string;
    remoteAddress: string;
    anonymousAlias: string;
    expiresAt: number;
}

interface OneTimeBrowserToken {
    hash: string;
    sessionId: string;
    expiresAt: number;
}

export interface PairingRequestCreatedEvent {
    requestId: string;
    code: string;
    installationId: string;
    displayName: string;
    expiresAt: number;
}

export interface PairingResult {
    extensionToken: string;
    browserToken: string;
    expiresAt: number;
}

const INVITATION_TTL_MS = 30 * 60 * 1000;
const PAIRING_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const BROWSER_TOKEN_TTL_MS = 2 * 60 * 1000;
const BROWSER_IDENTITY_TTL_MS = 5 * 60 * 1000;
const MAX_PAIRING_ATTEMPTS = 5;
const MAX_PENDING_PER_ADDRESS = 3;
const MAX_PENDING_REQUESTS = 50;
const MAX_IDENTITIES_PER_ADDRESS = 3;
const MAX_BROWSER_IDENTITIES = 50;

export class RemoteSessionAuthority {
    private readonly events = new EventEmitter();
    private readonly invitations = new Map<string, InvitationRecord>();
    private readonly pairingRequests = new Map<string, PairingRequest>();
    private readonly sessions = new Map<string, AuthenticatedCollaborationSession>();
    private readonly extensionTokens = new Map<string, string>();
    private readonly browserTokens = new Map<string, OneTimeBrowserToken>();
    private readonly browserIdentities = new Map<string, BrowserIdentityRecord>();
    private nextAnonymousNameIndex = 0;

    public onPairingRequest(listener: (event: PairingRequestCreatedEvent) => void): () => void {
        this.events.on('pairing-request', listener);
        return () => this.events.off('pairing-request', listener);
    }

    public onPendingRequestsChanged(listener: (count: number) => void): () => void {
        this.events.on('pending-changed', listener);
        return () => this.events.off('pending-changed', listener);
    }

    public createInvitation(): string {
        this.cleanup();
        const token = this.randomToken(32);
        const hash = this.hash(token);
        this.invitations.set(hash, {
            hash,
            expiresAt: Date.now() + INVITATION_TTL_MS,
        });
        return token;
    }

    public isInvitationValid(invitationToken: string): boolean {
        this.cleanup();
        const invitation = this.invitations.get(this.hash(invitationToken));
        return !!invitation && invitation.expiresAt > Date.now();
    }

    public createLocalBrowserToken(
        installationId: string,
        profile: CollaborationProfile,
    ): string {
        const session = this.createSession(installationId, profile, false, 'codexr');
        return this.createBrowserToken(session.sessionId);
    }

    public createBrowserIdentity(input: {
        invitationToken: string;
        remoteAddress: string;
    }): { identityToken: string; anonymousAlias: string; expiresAt: number } {
        this.cleanup();
        const invitationHash = this.requireInvitation(input.invitationToken);
        if (this.browserIdentities.size >= MAX_BROWSER_IDENTITIES) {
            throw new Error('too-many-pairing-requests');
        }
        const identitiesForAddress = Array.from(this.browserIdentities.values()).filter(
            (identity) => identity.remoteAddress === input.remoteAddress,
        ).length;
        if (identitiesForAddress >= MAX_IDENTITIES_PER_ADDRESS) {
            throw new Error('too-many-pairing-requests');
        }
        const anonymousAlias = this.createAnonymousAlias();
        const identityToken = this.randomToken(24);
        const hash = this.hash(identityToken);
        const expiresAt = Date.now() + BROWSER_IDENTITY_TTL_MS;
        this.browserIdentities.set(hash, {
            hash,
            invitationHash,
            remoteAddress: input.remoteAddress,
            anonymousAlias,
            expiresAt,
        });
        return { identityToken, anonymousAlias, expiresAt };
    }

    public createPairingRequest(input: {
        invitationToken: string;
        remoteAddress: string;
        installationId: string;
        profile: CollaborationProfile;
        clientKind?: CollaborationClientKind;
        identityToken?: string;
    }): { requestId: string; expiresAt: number } {
        this.cleanup();
        const invitationHash = this.requireInvitation(input.invitationToken);
        if (this.pairingRequests.size >= MAX_PENDING_REQUESTS) {
            throw new Error('too-many-pairing-requests');
        }

        const pendingForAddress = Array.from(this.pairingRequests.values()).filter(
            (request) => request.remoteAddress === input.remoteAddress && request.expiresAt > Date.now(),
        ).length;
        if (pendingForAddress >= MAX_PENDING_PER_ADDRESS) {
            throw new Error('too-many-pairing-requests');
        }

        const clientKind = input.clientKind === 'browser' ? 'browser' : 'codexr';
        let profile = this.validateProfile(input.profile);
        let anonymousAlias: string | undefined;
        if (clientKind === 'browser') {
            profile = input.profile.identityMode === 'custom'
                ? profile
                : { ...DEFAULT_COLLABORATION_PROFILE };
            const identity = this.consumeBrowserIdentity(
                input.identityToken || '',
                invitationHash,
                input.remoteAddress,
            );
            anonymousAlias = identity.anonymousAlias;
        }

        const requestId = this.randomToken(18);
        const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
        const codeSalt = this.randomToken(16);
        const expiresAt = Date.now() + PAIRING_TTL_MS;
        const request: PairingRequest = {
            id: requestId,
            invitationHash,
            codeHash: this.hash(`${codeSalt}:${code}`),
            codeSalt,
            remoteAddress: input.remoteAddress,
            installationId: this.normalizeInstallationId(input.installationId),
            profile,
            clientKind,
            anonymousAlias,
            attempts: 0,
            expiresAt,
        };
        this.pairingRequests.set(requestId, request);
        this.emitPendingCount();
        this.events.emit('pairing-request', {
            requestId,
            code,
            installationId: request.installationId,
            displayName: request.profile.identityMode === 'custom'
                ? request.profile.customName
                : request.anonymousAlias || 'Usuario anonimo de CodeXR',
            expiresAt,
        } satisfies PairingRequestCreatedEvent);
        return { requestId, expiresAt };
    }

    public confirmPairing(requestId: string, code: string, remoteAddress?: string): PairingResult {
        this.cleanup();
        const request = this.pairingRequests.get(requestId);
        if (!request || request.expiresAt <= Date.now()) {
            throw new Error('pairing-expired');
        }
        if (remoteAddress && request.remoteAddress !== remoteAddress) {
            throw new Error('invalid-pairing-code');
        }
        request.attempts += 1;
        if (request.attempts > MAX_PAIRING_ATTEMPTS) {
            this.pairingRequests.delete(requestId);
            this.emitPendingCount();
            throw new Error('pairing-attempts-exceeded');
        }

        const candidate = this.hash(`${request.codeSalt}:${String(code || '').trim()}`);
        if (!this.constantTimeEqual(candidate, request.codeHash)) {
            if (request.attempts >= MAX_PAIRING_ATTEMPTS) {
                this.pairingRequests.delete(requestId);
                this.emitPendingCount();
                throw new Error('pairing-attempts-exceeded');
            }
            throw new Error('invalid-pairing-code');
        }

        const invitation = this.invitations.get(request.invitationHash);
        if (!invitation || invitation.expiresAt <= Date.now()) {
            throw new Error('invalid-invitation');
        }
        this.pairingRequests.delete(requestId);
        this.emitPendingCount();

        const session = this.createSession(
            request.installationId,
            request.profile,
            true,
            request.clientKind,
            request.anonymousAlias,
        );
        const extensionToken = this.randomToken(32);
        this.extensionTokens.set(this.hash(extensionToken), session.sessionId);
        return {
            extensionToken,
            browserToken: this.createBrowserToken(session.sessionId),
            expiresAt: session.expiresAt,
        };
    }

    public exchangeBrowserToken(token: string): AuthenticatedCollaborationSession | null {
        this.cleanup();
        const tokenHash = this.hash(token);
        const record = this.browserTokens.get(tokenHash);
        if (!record || record.expiresAt <= Date.now()) {
            return null;
        }
        this.browserTokens.delete(tokenHash);
        return this.sessions.get(record.sessionId) || null;
    }

    public resolveCookie(cookieHeader: string | undefined): AuthenticatedCollaborationSession | null {
        this.cleanup();
        const sessionId = this.readCookie(cookieHeader, 'codexr_session');
        return sessionId ? this.sessions.get(sessionId) || null : null;
    }

    public resolveExtensionToken(token: string): AuthenticatedCollaborationSession | null {
        this.cleanup();
        const sessionId = this.extensionTokens.get(this.hash(token));
        return sessionId ? this.sessions.get(sessionId) || null : null;
    }

    public updateExtensionProfile(
        token: string,
        profile: CollaborationProfile,
    ): AuthenticatedCollaborationSession[] {
        const session = this.resolveExtensionToken(token);
        if (!session) {
            throw new Error('invalid-session');
        }
        const normalizedProfile = this.validateProfile(profile);
        const updated: AuthenticatedCollaborationSession[] = [];
        for (const candidate of this.sessions.values()) {
            if (candidate.installationId !== session.installationId) {
                continue;
            }
            candidate.profile = { ...normalizedProfile };
            updated.push({ ...candidate, profile: { ...candidate.profile } });
        }
        return updated;
    }

    public updateInstallationProfile(
        installationId: string,
        profile: CollaborationProfile,
    ): AuthenticatedCollaborationSession[] {
        const normalizedProfile = this.validateProfile(profile);
        const scopedInstallationId = this.scopeInstallationId(installationId, false);
        const updated: AuthenticatedCollaborationSession[] = [];
        for (const session of this.sessions.values()) {
            if (session.installationId !== scopedInstallationId) {
                continue;
            }
            session.profile = { ...normalizedProfile };
            updated.push({ ...session, profile: { ...session.profile } });
        }
        return updated;
    }

    public getPendingRequestCount(): number {
        this.cleanup();
        return this.pairingRequests.size;
    }

    public revokeAll(): void {
        this.invitations.clear();
        this.pairingRequests.clear();
        this.sessions.clear();
        this.extensionTokens.clear();
        this.browserTokens.clear();
        this.browserIdentities.clear();
        this.emitPendingCount();
    }

    private createSession(
        installationId: string,
        profile: CollaborationProfile,
        remote: boolean,
        clientKind: CollaborationClientKind,
        anonymousAlias?: string,
    ): AuthenticatedCollaborationSession {
        const sessionId = this.randomToken(24);
        const session: AuthenticatedCollaborationSession = {
            sessionId,
            installationId: this.scopeInstallationId(installationId, remote),
            profile: this.validateProfile(profile),
            clientKind,
            anonymousAlias,
            remote,
            expiresAt: Date.now() + SESSION_TTL_MS,
        };
        this.sessions.set(sessionId, session);
        return session;
    }

    private createBrowserToken(sessionId: string): string {
        const token = this.randomToken(32);
        const hash = this.hash(token);
        this.browserTokens.set(hash, {
            hash,
            sessionId,
            expiresAt: Date.now() + BROWSER_TOKEN_TTL_MS,
        });
        return token;
    }

    private cleanup(): void {
        const now = Date.now();
        let pendingChanged = false;
        for (const [key, invitation] of this.invitations) {
            if (invitation.expiresAt <= now) {
                this.invitations.delete(key);
            }
        }
        for (const [key, request] of this.pairingRequests) {
            if (request.expiresAt <= now) {
                this.pairingRequests.delete(key);
                pendingChanged = true;
            }
        }
        for (const [key, session] of this.sessions) {
            if (session.expiresAt <= now) {
                this.sessions.delete(key);
            }
        }
        for (const [key, record] of this.browserTokens) {
            if (record.expiresAt <= now || !this.sessions.has(record.sessionId)) {
                this.browserTokens.delete(key);
            }
        }
        for (const [key, identity] of this.browserIdentities) {
            if (identity.expiresAt <= now) {
                this.browserIdentities.delete(key);
            }
        }
        for (const [key, sessionId] of this.extensionTokens) {
            if (!this.sessions.has(sessionId)) {
                this.extensionTokens.delete(key);
            }
        }
        if (pendingChanged) {
            this.emitPendingCount();
        }
    }

    private emitPendingCount(): void {
        this.events.emit('pending-changed', this.pairingRequests.size);
    }

    private readCookie(header: string | undefined, name: string): string {
        const prefix = `${name}=`;
        return String(header || '')
            .split(';')
            .map((value) => value.trim())
            .find((value) => value.startsWith(prefix))
            ?.slice(prefix.length) || '';
    }

    private normalizeInstallationId(value: string): string {
        const normalized = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
        return normalized.slice(0, 80) || `installation-${this.randomToken(8)}`;
    }

    private scopeInstallationId(value: string, remote: boolean): string {
        return `${remote ? 'remote' : 'local'}:${this.normalizeInstallationId(value)}`;
    }

    private validateProfile(value: CollaborationProfile): CollaborationProfile {
        if (!value || typeof value !== 'object') {
            throw new Error('invalid-profile');
        }
        if (value.identityMode !== 'anonymous' && value.identityMode !== 'custom') {
            throw new Error('invalid-profile');
        }
        if (!VALID_AVATAR_IDS.has(value.avatarId)) {
            throw new Error('invalid-profile');
        }
        if (value.identityMode === 'custom' && !sanitizeCollaborationName(value.customName)) {
            throw new Error('invalid-profile');
        }
        return normalizeCollaborationProfile(value);
    }

    private requireInvitation(invitationToken: string): string {
        const invitationHash = this.hash(invitationToken);
        const invitation = this.invitations.get(invitationHash);
        if (!invitation || invitation.expiresAt <= Date.now()) {
            throw new Error('invalid-invitation');
        }
        return invitationHash;
    }

    private consumeBrowserIdentity(
        identityToken: string,
        invitationHash: string,
        remoteAddress: string,
    ): BrowserIdentityRecord {
        const hash = this.hash(identityToken);
        const identity = this.browserIdentities.get(hash);
        if (
            !identity
            || identity.expiresAt <= Date.now()
            || identity.invitationHash !== invitationHash
            || identity.remoteAddress !== remoteAddress
        ) {
            throw new Error('invalid-browser-identity');
        }
        this.browserIdentities.delete(hash);
        return identity;
    }

    private createAnonymousAlias(): string {
        const reservedNames = new Set(
            [
                ...Array.from(this.browserIdentities.values()).map((identity) => identity.anonymousAlias),
                ...Array.from(this.pairingRequests.values())
                    .map((request) => request.anonymousAlias)
                    .filter((value): value is string => !!value),
                ...Array.from(this.sessions.values())
                    .map((session) => session.anonymousAlias)
                    .filter((value): value is string => !!value),
            ].map((value) => value.toLocaleLowerCase()),
        );
        let candidate = '';
        do {
            candidate = buildStarWarsDisplayName(this.nextAnonymousNameIndex);
            this.nextAnonymousNameIndex += 1;
        } while (reservedNames.has(candidate.toLocaleLowerCase()));
        return candidate;
    }

    private randomToken(bytes: number): string {
        return crypto.randomBytes(bytes).toString('base64url');
    }

    private hash(value: string): string {
        return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
    }

    private constantTimeEqual(left: string, right: string): boolean {
        const leftBuffer = Buffer.from(left, 'hex');
        const rightBuffer = Buffer.from(right, 'hex');
        return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
    }
}
