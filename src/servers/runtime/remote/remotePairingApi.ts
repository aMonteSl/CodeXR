import * as http from 'http';
import * as crypto from 'crypto';
import { CollaborationProfile, DEFAULT_COLLABORATION_PROFILE } from '../../../collaboration';
import { RemoteSessionAuthority } from '../../../remote_access';
import { CollaborationRoomServer } from '../collaboration/collaborationRoomServer';
import { renderInvitationErrorPage, renderPairingPage } from './pairingPage';
import {
    getRemoteAddress,
    readBearerToken,
    readJsonBody,
    sendErrorResponse,
    sendJsonResponse,
} from '../http/httpRespond';

/** What the pairing endpoints need from the server that hosts them. */
export interface RemotePairingApiDeps {
    authority: RemoteSessionAuthority;
    /** Origin the guest should be sent back to (tunnel URL when remote). */
    getOrigin(req: http.IncomingMessage): string;
    isRemoteRequest(req: http.IncomingMessage): boolean;
    /** The collaboration room, once the server has attached it. */
    getRoom(): CollaborationRoomServer | null;
}

/**
 * The REST surface of the remote pairing flow (`/join` and `/api/remote/*`):
 * identity reservation, pairing request/confirmation, the one-shot browser
 * token exchange that mints the session cookie, and live profile updates.
 */
export class RemotePairingApi {
    constructor(private readonly deps: RemotePairingApiDeps) {}

    public async handlePairingRequest(
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
            const result = this.deps.authority.createPairingRequest({
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

    public async handleBrowserIdentity(
        req: http.IncomingMessage,
        res: http.ServerResponse,
    ): Promise<void> {
        if (req.method !== 'POST') {
            sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }
        try {
            const payload = await readJsonBody(req);
            const result = this.deps.authority.createBrowserIdentity({
                invitationToken: String(payload.invitationToken || ''),
                remoteAddress: getRemoteAddress(req),
            });
            sendJsonResponse(res, 200, result);
        } catch (error) {
            this.sendPairingError(res, error);
        }
    }

    public async handlePairingConfirmation(
        req: http.IncomingMessage,
        res: http.ServerResponse,
    ): Promise<void> {
        if (req.method !== 'POST') {
            sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }
        try {
            const payload = await readJsonBody(req);
            const result = this.deps.authority.confirmPairing(
                String(payload.requestId || ''),
                String(payload.code || ''),
                getRemoteAddress(req),
            );
            const origin = this.deps.getOrigin(req);
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

    public handleBrowserTokenExchange(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        requestUrl: string,
    ): void {
        if (req.method !== 'GET') {
            sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }
        const token = new URL(requestUrl, 'https://codexr.local').searchParams.get('token') || '';
        const session = this.deps.authority.exchangeBrowserToken(token);
        if (!session) {
            sendErrorResponse(res, 404, 'Resource not found');
            return;
        }
        const secure = this.deps.isRemoteRequest(req) ? '; Secure' : '';
        res.writeHead(303, {
            Location: '/',
            'Cache-Control': 'no-store',
            'Set-Cookie': `codexr_session=${session.sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${secure}`,
        });
        res.end();
    }

    public async handleRemoteProfileUpdate(
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
            const sessions = this.deps.authority.updateExtensionProfile(
                token,
                payload.profile as CollaborationProfile,
            );
            for (const session of sessions) {
                this.deps.getRoom()?.updateSessionProfile(session.sessionId, session.profile);
            }
            sendJsonResponse(res, 200, { profile: sessions[0]?.profile });
        } catch {
            sendErrorResponse(res, 404, 'Resource not found');
        }
    }

    public servePairingPage(res: http.ServerResponse, requestUrl: string): void {
        const invitationToken = new URL(requestUrl, 'https://codexr.local')
            .searchParams.get('invite') || '';
        if (
            !/^[a-zA-Z0-9_-]{20,100}$/.test(invitationToken)
            || !this.deps.authority.isInvitationValid(invitationToken)
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

    /** Map authority error codes onto the HTTP statuses guests rely on. */
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
}
