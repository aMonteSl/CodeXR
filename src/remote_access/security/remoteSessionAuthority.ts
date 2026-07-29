import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import {
    CollaborationProfile,
    DEFAULT_COLLABORATION_PROFILE,
    sanitizeCollaborationName,
    ASSIGNABLE_AVATAR_IDS,
    normalizeCollaborationProfile,
} from '../../collaboration/model/collaborationProfile';
import { buildStarWarsDisplayName } from '../../collaboration/model/anonymousName';
import {
    AuthenticatedCollaborationSession,
    CollaborationClientKind,
} from '../model/remoteAccessModel';

/**
 * An invitation lives for as long as the host keeps sharing: it is minted once
 * per share and dies only through revocation (`revokeSession`/`revokeAll` when
 * sharing stops). It used to carry a 30-minute TTL, which silently outlived
 * the sidebar's copy of the link: the tunnel stayed up, the sidebar kept
 * showing the address, and guests got a 404. The real gate against a leaked
 * link is the six-digit pairing code (5 attempts, burnt on the first wrong
 * try), not the invitation's age.
 */
interface InvitationRecord {
    hash: string;
}

interface PairingRequest {
    id: string;
    invitationHash: string;
    codeHash: string;
    codeSalt: string;
    codeValid: boolean;
    displayName: string;
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
    /** True when the code replaces a previous one for the same request. */
    regenerated?: boolean;
}

export interface PairingFailureEvent {
    requestId: string;
    displayName: string;
    remoteAddress: string;
    reason: 'invalid-code' | 'attempts-exceeded';
}

export interface PairingRequestSummary {
    requestId: string;
    displayName: string;
    remoteAddress: string;
    clientKind: CollaborationClientKind;
    codeValid: boolean;
    expiresAt: number;
}

export interface PairingResult {
    extensionToken: string;
    browserToken: string;
    expiresAt: number;
}

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

    public onPairingFailed(listener: (event: PairingFailureEvent) => void): () => void {
        this.events.on('pairing-failed', listener);
        return () => this.events.off('pairing-failed', listener);
    }

    public createInvitation(): string {
        this.cleanup();
        const token = this.randomToken(32);
        const hash = this.hash(token);
        this.invitations.set(hash, { hash });
        return token;
    }

    public isInvitationValid(invitationToken: string): boolean {
        this.cleanup();
        return this.invitations.has(this.hash(invitationToken));
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
        const code = this.createPairingCode();
        const codeSalt = this.randomToken(16);
        const expiresAt = Date.now() + PAIRING_TTL_MS;
        const request: PairingRequest = {
            id: requestId,
            invitationHash,
            codeHash: this.hash(`${codeSalt}:${code}`),
            codeSalt,
            codeValid: true,
            displayName: profile.identityMode === 'custom'
                ? profile.customName
                : anonymousAlias || 'Usuario anonimo de CodeXR',
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
            displayName: request.displayName,
            expiresAt,
        } satisfies PairingRequestCreatedEvent);
        return { requestId, expiresAt };
    }

    /**
     * Issue a fresh code for a pending request, invalidating the previous one.
     * Used after a failed attempt burns a code, or when the host lost the
     * notification that carried it.
     */
    public regeneratePairingCode(requestId: string): { code: string; expiresAt: number } {
        this.cleanup();
        const request = this.pairingRequests.get(requestId);
        if (!request || request.expiresAt <= Date.now()) {
            throw new Error('pairing-expired');
        }

        const code = this.createPairingCode();
        request.codeSalt = this.randomToken(16);
        request.codeHash = this.hash(`${request.codeSalt}:${code}`);
        request.codeValid = true;
        request.attempts = 0;
        request.expiresAt = Date.now() + PAIRING_TTL_MS;

        this.events.emit('pairing-request', {
            requestId,
            code,
            installationId: request.installationId,
            displayName: request.displayName,
            expiresAt: request.expiresAt,
            regenerated: true,
        } satisfies PairingRequestCreatedEvent);
        return { code, expiresAt: request.expiresAt };
    }

    /**
     * Snapshot of the pending pairing requests, for host-side pickers.
     */
    public listPendingPairingRequests(): PairingRequestSummary[] {
        this.cleanup();
        return Array.from(this.pairingRequests.values()).map((request) => ({
            requestId: request.id,
            displayName: request.displayName,
            remoteAddress: request.remoteAddress,
            clientKind: request.clientKind,
            codeValid: request.codeValid,
            expiresAt: request.expiresAt,
        }));
    }

    private createPairingCode(): string {
        return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
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
        // A burnt code stays dead even if the right digits arrive later: the
        // host must issue a new one.
        if (!request.codeValid) {
            throw new Error('pairing-code-revoked');
        }
        request.attempts += 1;
        if (request.attempts > MAX_PAIRING_ATTEMPTS) {
            this.pairingRequests.delete(requestId);
            this.emitPendingCount();
            this.emitPairingFailure(request, 'attempts-exceeded');
            throw new Error('pairing-attempts-exceeded');
        }

        const candidate = this.hash(`${request.codeSalt}:${String(code || '').trim()}`);
        if (!this.constantTimeEqual(candidate, request.codeHash)) {
            // One wrong guess burns the code; the request itself survives so
            // the host can hand over a fresh one.
            request.codeValid = false;
            if (request.attempts >= MAX_PAIRING_ATTEMPTS) {
                this.pairingRequests.delete(requestId);
                this.emitPendingCount();
                this.emitPairingFailure(request, 'attempts-exceeded');
                throw new Error('pairing-attempts-exceeded');
            }
            this.emitPairingFailure(request, 'invalid-code');
            throw new Error('invalid-pairing-code');
        }

        const invitation = this.invitations.get(request.invitationHash);
        if (!invitation) {
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

    /**
     * Revoke one session and every credential that resolves to it, so a guest
     * removed from the room cannot walk back in with the link they already
     * have. Pending browser identities are not tied to a session, so they stay.
     */
    public revokeSession(sessionId: string): boolean {
        const existed = this.sessions.delete(sessionId);

        for (const [tokenHash, mappedSessionId] of this.extensionTokens) {
            if (mappedSessionId === sessionId) {
                this.extensionTokens.delete(tokenHash);
            }
        }
        for (const [tokenHash, token] of this.browserTokens) {
            if (token.sessionId === sessionId) {
                this.browserTokens.delete(tokenHash);
            }
        }

        return existed;
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
        // Invitations are not time-boxed: they die through revocation when
        // sharing stops, never through this sweep.
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

    private emitPairingFailure(
        request: PairingRequest,
        reason: PairingFailureEvent['reason'],
    ): void {
        this.events.emit('pairing-failed', {
            requestId: request.id,
            displayName: request.displayName,
            remoteAddress: request.remoteAddress,
            reason,
        } satisfies PairingFailureEvent);
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
        // `auto` is legitimate: the room resolves it to a free colour on join.
        if (!ASSIGNABLE_AVATAR_IDS.has(value.avatarId)) {
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
        if (!invitation) {
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
