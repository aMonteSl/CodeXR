import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import { sendErrorResponse } from './httpRespond';

/** The slice of the server configuration static serving depends on. */
export interface StaticAssetOptions {
    staticRoot: string;
    mainFile?: string;
    port: number;
    host?: string;
}

/**
 * Serves the main page and static files from the configured static root, with
 * the traversal guard and the cache policy the server has always applied.
 */
export class StaticAssetServer {
    constructor(private readonly options: StaticAssetOptions) {}

    /**
     * Serve the main CodeXR page
     * @param res - HTTP response
     */
    public async serveMainPage(res: http.ServerResponse): Promise<void> {
        let mainPagePath: string;

        if (this.options.mainFile) {
            // If a specific main file is configured, use it
            if (path.isAbsolute(this.options.mainFile)) {
                mainPagePath = this.options.mainFile;
            } else {
                mainPagePath = path.join(this.options.staticRoot, this.options.mainFile);
            }
            console.log(`SERVER: Attempting to serve configured main file: ${mainPagePath}`);
            console.log(`SERVER: Static root: ${this.options.staticRoot}`);
            console.log(`SERVER: Main file: ${this.options.mainFile}`);
        } else {
            // Default to xr-visualization.html
            mainPagePath = path.join(this.options.staticRoot, 'xr', 'xr-visualization.html');
            console.log(`SERVER: Serving default main file: ${mainPagePath}`);
        }

        // Check if file exists and serve it
        if (fs.existsSync(mainPagePath)) {
            console.log(`SERVER: Successfully found main file, serving: ${mainPagePath}`);
            await this.serveFile(res, mainPagePath, 'text/html');
        } else {
            console.error(`SERVER: Main file not found: ${mainPagePath}`);
            console.error(`SERVER: Current working directory: ${process.cwd()}`);
            console.error(`SERVER: Static root exists: ${fs.existsSync(this.options.staticRoot)}`);
            try {
                const files = fs.readdirSync(this.options.staticRoot);
                console.error(`SERVER: Files in static root: ${files.join(', ')}`);
            } catch (e) {
                console.error(`SERVER: Cannot read static root directory: ${e}`);
            }

            // Fallback to a basic HTML page
            console.warn(`SERVER: Serving fallback HTML instead of selected file`);
            const fallbackHtml = this.generateFallbackHtml();
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(fallbackHtml);
        }
    }

    /**
     * Serve static files
     * @param req - HTTP request
     * @param res - HTTP response
     * @param url - Request URL
     */
    public async serveStaticFile(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        url: string
    ): Promise<void> {
        // Parse URL to extract pathname without query string (WHATWG parser:
        // the legacy url.parse() emits DEP0169 in the extension host).
        const pathname = decodeURIComponent(new URL(url, 'http://codexr.local').pathname) || '/';

        const filePath = path.join(this.options.staticRoot, pathname);
        const normalizedPath = path.normalize(filePath);

        console.log(`SERVER_DEBUG: Request for static file: ${url}`);
        console.log(`SERVER_DEBUG: Parsed pathname: ${pathname}`);
        console.log(`SERVER_DEBUG: Static root: ${this.options.staticRoot}`);
        console.log(`SERVER_DEBUG: Full file path: ${normalizedPath}`);

        // Security check: ensure the file is within the static root
        if (!normalizedPath.startsWith(path.normalize(this.options.staticRoot))) {
            console.log(`SERVER_DEBUG: Access denied - path outside static root`);
            sendErrorResponse(res, 403, 'Access denied');
            return;
        }

        if (fs.existsSync(normalizedPath) && fs.statSync(normalizedPath).isFile()) {
            console.log(`SERVER_DEBUG: Serving file: ${normalizedPath}`);
            await this.serveFile(res, normalizedPath);
        } else {
            console.log(`SERVER_DEBUG: File not found: ${normalizedPath}`);
            sendErrorResponse(res, 404, 'File not found');
        }
    }

    /**
     * Serve a file
     * @param res - HTTP response
     * @param filePath - Path to the file
     * @param contentType - Content type (optional, will be detected)
     */
    public async serveFile(
        res: http.ServerResponse,
        filePath: string,
        contentType?: string
    ): Promise<void> {
        try {
            const content = await fs.promises.readFile(filePath);
            const detectedContentType = contentType || this.getContentType(filePath);
            const headers: Record<string, string> = { 'Content-Type': detectedContentType };
            if (/\.(:html|js|mjs|json|map)$/i.test(filePath)) {
                headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
                headers.Pragma = 'no-cache';
                headers.Expires = '0';
            }

            res.writeHead(200, headers);
            res.end(content);
        } catch (error) {
            console.error('SERVER: Error serving file:', error);
            sendErrorResponse(res, 500, 'Error reading file');
        }
    }

    /**
     * Get content type based on file extension
     * @param filePath - Path to the file
     * @returns string - Content type
     */
    private getContentType(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();

        const contentTypes: Record<string, string> = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.txt': 'text/plain'
        };

        return contentTypes[ext] || 'application/octet-stream';
    }

    /**
     * Generate fallback HTML when main file is not found
     * @returns string - HTML content
     */
    private generateFallbackHtml(): string {
        return `<!DOCTYPE html>
<html>
<head>
    <title>CodeXR Server - File Not Found</title>
    <style>
        body { font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
        .error { background: #dc2626; color: white; padding: 15px; margin: 20px 0; }
        .info { background: #374151; padding: 15px; margin: 10px 0; }
    </style>
</head>
<body>
    <h1>CodeXR Server - File Not Found</h1>
    <div class="error">
        <h3>Selected HTML File Not Found</h3>
        <p>The HTML file you selected could not be located.</p>
        <p><strong>Attempted File:</strong> ${this.options.mainFile || 'Not specified'}</p>
        <p><strong>Static Root:</strong> ${this.options.staticRoot}</p>
    </div>
    <div class="info">
        <h3>Server Information</h3>
        <p><strong>Port:</strong> ${this.options.port}</p>
        <p><strong>Host:</strong> ${this.options.host}</p>
    </div>
    <div class="info">
        <h3>Troubleshooting</h3>
        <p>1. Check that the file still exists</p>
        <p>2. Verify file permissions</p>
        <p>3. Try restarting the server</p>
    </div>
</body>
</html>`;
    }
}
