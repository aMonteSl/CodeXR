import * as http from 'http';

/**
 * Stateless HTTP response and request-parsing helpers shared by the server
 * façade and its route handlers.
 */

/** Send a JSON payload with the given status code. */
export function sendJsonResponse(res: http.ServerResponse, statusCode: number, data: any): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
}

/** Send the standard `{error, status, message, timestamp}` error body. */
export function sendErrorResponse(res: http.ServerResponse, statusCode: number, message: string): void {
    const errorData = {
        error: true,
        status: statusCode,
        message: message,
        timestamp: new Date().toISOString()
    };

    sendJsonResponse(res, statusCode, errorData);
}

/** Add the CORS headers the server has always sent. */
export function addCorsHeaders(res: http.ServerResponse, allowedOrigins?: string[]): void {
    const origins = allowedOrigins?.join(', ') || '*';

    res.setHeader('Access-Control-Allow-Origin', origins);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
}

/**
 * Read a JSON request body, capped at 16 KiB. Rejects with
 * `request-too-large` / `invalid-json` error codes.
 */
export function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
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

/** Extract a `Bearer` token from the Authorization header, or ''. */
export function readBearerToken(req: http.IncomingMessage): string {
    const authorization = String(req.headers.authorization || '');
    return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

/**
 * Best client address for a request: `cf-connecting-ip` carries the real
 * address for tunneled requests, where the socket only sees local cloudflared.
 */
export function getRemoteAddress(req: http.IncomingMessage): string {
    return String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || 'unknown').slice(0, 120);
}
