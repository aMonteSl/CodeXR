import * as http from 'http';
import { RemoteSessionAuthority } from '../../../remote_access';

/**
 * The only paths a remote guest may reach without a session cookie: the
 * pairing flow itself. Everything else requires a cookie minted by pairing.
 */
const COOKIE_FREE_REMOTE_PATHS = new Set([
    '/join',
    '/api/remote/identity',
    '/api/remote/pair/request',
    '/api/remote/pair/confirm',
    '/api/remote/browser',
    '/api/remote/profile',
]);

/**
 * Authorization policy for requests arriving through the public tunnel.
 * Local requests are always allowed; remote ones need a server-issued session.
 */
export class RemoteAccessPolicy {
    constructor(private readonly authority: RemoteSessionAuthority) {}

    public isRequestAuthorized(req: http.IncomingMessage, requestUrl: string): boolean {
        if (!this.isRemoteRequest(req)) {
            return true;
        }
        const pathname = new URL(requestUrl, 'https://codexr.local').pathname;
        if (COOKIE_FREE_REMOTE_PATHS.has(pathname)) {
            return true;
        }
        return !!this.authority.resolveCookie(req.headers.cookie);
    }

    public isWebSocketAuthorized(req: http.IncomingMessage): boolean {
        return !this.isRemoteRequest(req)
            || !!this.authority.resolveCookie(req.headers.cookie);
    }

    public isRemoteRequest(req: http.IncomingMessage): boolean {
        const hostname = String(req.headers.host || '').split(':')[0].toLowerCase();
        return hostname.endsWith('.trycloudflare.com')
            || typeof req.headers['cf-connecting-ip'] === 'string';
    }
}
