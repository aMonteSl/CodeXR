import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { parse as parseUrl } from 'url';
import { sseManager } from './sse/SSEManager';
import { fileToServerMap } from '../../utils/fileToServerMap';

/**
 * HTTP Server Configuration
 */
export interface HttpServerConfig {
    port: number;
    host?: string;
    staticRoot?: string;
    enableCors?: boolean;
    allowedOrigins?: string[];
    mainFile?: string; // Optional main file to serve at root
}

/**
 * HTTP Server instance
 * Provides basic HTTP server functionality for CodeXR
 */
export class HttpServer {
    private server: http.Server | null = null;
    private config: HttpServerConfig;
    private isRunning: boolean = false;

    constructor(config: HttpServerConfig) {
        this.config = {
            host: 'localhost',
            staticRoot: path.join(__dirname, '../../../templates'),
            enableCors: true,
            allowedOrigins: ['*'],
            ...config
        };
        
        console.log('SERVER: HTTP server initialized with config:', this.config);
    }

    /**
     * Start the HTTP server
     * @returns Promise<string> - Server URL
     */
    public async start(): Promise<string> {
        if (this.isRunning) {
            throw new Error('SERVER: HTTP server is already running');
        }

        return new Promise((resolve, reject) => {
            try {
                this.server = http.createServer(this.handleRequest.bind(this));

                this.server.on('error', (error: NodeJS.ErrnoException) => {
                    console.error('SERVER: HTTP server error:', error);
                    this.isRunning = false;
                    
                    if (error.code === 'EADDRINUSE') {
                        reject(new Error(`SERVER: Port ${this.config.port} is already in use`));
                    } else {
                        reject(new Error(`SERVER: Failed to start HTTP server: ${error.message}`));
                    }
                });

                this.server.on('listening', () => {
                    const address = this.server?.address();
                    const serverUrl = `http://${this.config.host}:${this.config.port}`;
                    
                    console.log(`SERVER: HTTP server listening on ${serverUrl}`);
                    console.log('SERVER: Server address info:', address);
                    
                    this.isRunning = true;
                    resolve(serverUrl);
                });

                // Add graceful shutdown handling
                this.server.on('close', () => {
                    console.log('SERVER: HTTP server closed');
                    this.isRunning = false;
                });

                this.server.listen(this.config.port, this.config.host);
                
            } catch (error) {
                console.error('SERVER: Error starting HTTP server:', error);
                reject(error);
            }
        });
    }

    /**
     * Stop the HTTP server
     * @returns Promise<void>
     */
    public async stop(): Promise<void> {
        if (!this.server || !this.isRunning) {
            console.log('SERVER: HTTP server is not running');
            return;
        }

        return new Promise((resolve, reject) => {
            this.server!.close((error) => {
                if (error) {
                    console.error('SERVER: Error stopping HTTP server:', error);
                    reject(error);
                } else {
                    console.log('SERVER: HTTP server stopped successfully');
                    this.isRunning = false;
                    this.server = null;
                    resolve();
                }
            });
        });
    }

    /**
     * Check if server is running
     * @returns boolean
     */
    public getIsRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Get server configuration
     * @returns HttpServerConfig
     */
    public getConfig(): HttpServerConfig {
        return { ...this.config };
    }

    /**
     * Get server URL
     * @returns string | null
     */
    public getServerUrl(): string | null {
        if (!this.isRunning) {
            return null;
        }
        return `http://${this.config.host}:${this.config.port}`;
    }

    /**
     * Handle incoming HTTP requests
     * @param req - HTTP request
     * @param res - HTTP response
     */
    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
        const startTime = Date.now();
        const requestUrl = req.url || '/';
        const method = req.method || 'GET';
        
        console.log(`SERVER: ${method} ${requestUrl} - Processing request`);

        // Add CORS headers if enabled
        if (this.config.enableCors) {
            this.addCorsHeaders(res);
        }

        // Handle preflight requests
        if (method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // Route the request
        this.routeRequest(req, res, requestUrl)
            .then(() => {
                const duration = Date.now() - startTime;
                console.log(`SERVER: ${method} ${requestUrl} - Completed in ${duration}ms`);
            })
            .catch((error) => {
                console.error(`SERVER: ${method} ${requestUrl} - Error:`, error);
                this.sendErrorResponse(res, 500, 'Internal Server Error');
            });
    }

    /**
     * Route incoming requests
     * @param req - HTTP request
     * @param res - HTTP response
     * @param url - Request URL
     */
    private async routeRequest(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        url: string
    ): Promise<void> {
        // Root path - serve main page
        if (url === '/' || url === '/index.html') {
            await this.serveMainPage(res);
            return;
        }

        // Health check endpoint
        if (url === '/health') {
            this.sendJsonResponse(res, 200, {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                server: 'CodeXR HTTP Server'
            });
            return;
        }

        // Server-Sent Events endpoint for analysis updates
        if (url === '/events') {
            await this.handleSSERequest(req, res);
            return;
        }

        // API endpoints
        if (url.startsWith('/api/')) {
            await this.handleApiRequest(req, res, url);
            return;
        }

        // Static files
        await this.serveStaticFile(req, res, url);
    }

    /**
     * Serve the main CodeXR page
     * @param res - HTTP response
     */
    private async serveMainPage(res: http.ServerResponse): Promise<void> {
        let mainPagePath: string;
        
        if (this.config.mainFile) {
            // If a specific main file is configured, use it
            if (path.isAbsolute(this.config.mainFile)) {
                mainPagePath = this.config.mainFile;
            } else {
                mainPagePath = path.join(this.config.staticRoot!, this.config.mainFile);
            }
            console.log(`SERVER: Attempting to serve configured main file: ${mainPagePath}`);
            console.log(`SERVER: Static root: ${this.config.staticRoot}`);
            console.log(`SERVER: Main file: ${this.config.mainFile}`);
        } else {
            // Default to xr-visualization.html
            mainPagePath = path.join(this.config.staticRoot!, 'xr', 'xr-visualization.html');
            console.log(`SERVER: Serving default main file: ${mainPagePath}`);
        }
        
        // Check if file exists and serve it
        if (fs.existsSync(mainPagePath)) {
            console.log(`SERVER: Successfully found main file, serving: ${mainPagePath}`);
            await this.serveFile(res, mainPagePath, 'text/html');
        } else {
            console.error(`SERVER: Main file not found: ${mainPagePath}`);
            console.error(`SERVER: Current working directory: ${process.cwd()}`);
            console.error(`SERVER: Static root exists: ${fs.existsSync(this.config.staticRoot!)}`);
            if (this.config.staticRoot) {
                try {
                    const files = fs.readdirSync(this.config.staticRoot);
                    console.error(`SERVER: Files in static root: ${files.join(', ')}`);
                } catch (e) {
                    console.error(`SERVER: Cannot read static root directory: ${e}`);
                }
            }
            
            // Fallback to a basic HTML page
            console.warn(`SERVER: Serving fallback HTML instead of selected file`);
            const fallbackHtml = this.generateFallbackHtml();
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(fallbackHtml);
        }
    }

    /**
     * Handle API requests
     * @param req - HTTP request
     * @param res - HTTP response
     * @param url - Request URL
     */
    private async handleApiRequest(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        url: string
    ): Promise<void> {
        const apiPath = url.replace('/api', '');

        switch (apiPath) {
            case '/status':
                this.sendJsonResponse(res, 200, {
                    server: 'CodeXR HTTP Server',
                    mode: 'HTTP',
                    port: this.config.port,
                    uptime: process.uptime(),
                    timestamp: new Date().toISOString()
                });
                break;

            case '/config':
                this.sendJsonResponse(res, 200, {
                    mode: 'HTTP',
                    host: this.config.host,
                    port: this.config.port,
                    cors: this.config.enableCors
                });
                break;

            default:
                this.sendErrorResponse(res, 404, 'API endpoint not found');
        }
    }

    /**
     * Serve static files
     * @param req - HTTP request
     * @param res - HTTP response
     * @param url - Request URL
     */
    private async serveStaticFile(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        url: string
    ): Promise<void> {
        // Parse URL to extract pathname without query string
        const parsedUrl = parseUrl(url, true);
        const pathname = parsedUrl.pathname || '/';
        
        const filePath = path.join(this.config.staticRoot!, pathname);
        const normalizedPath = path.normalize(filePath);

        console.log(`SERVER_DEBUG: Request for static file: ${url}`);
        console.log(`SERVER_DEBUG: Parsed pathname: ${pathname}`);
        console.log(`SERVER_DEBUG: Query string removed: ${url} -> ${pathname}`);
        console.log(`SERVER_DEBUG: Static root: ${this.config.staticRoot}`);
        console.log(`SERVER_DEBUG: Full file path: ${normalizedPath}`);
        console.log(`SERVER_DEBUG: File exists: ${fs.existsSync(normalizedPath)}`);

        // Security check: ensure the file is within the static root
        if (!normalizedPath.startsWith(path.normalize(this.config.staticRoot!))) {
            console.log(`SERVER_DEBUG: Access denied - path outside static root`);
            this.sendErrorResponse(res, 403, 'Access denied');
            return;
        }

        if (fs.existsSync(normalizedPath) && fs.statSync(normalizedPath).isFile()) {
            console.log(`SERVER_DEBUG: Serving file: ${normalizedPath}`);
            await this.serveFile(res, normalizedPath);
        } else {
            console.log(`SERVER_DEBUG: File not found: ${normalizedPath}`);
            // List directory contents for debugging
            try {
                const dirPath = path.dirname(normalizedPath);
                const dirContents = fs.readdirSync(dirPath);
                console.log(`SERVER_DEBUG: Directory contents of ${dirPath}:`, dirContents);
            } catch (dirError) {
                console.log(`SERVER_DEBUG: Could not read directory: ${dirError}`);
            }
            this.sendErrorResponse(res, 404, 'File not found');
        }
    }

    /**
     * Serve a file
     * @param res - HTTP response
     * @param filePath - Path to the file
     * @param contentType - Content type (optional, will be detected)
     */
    private async serveFile(
        res: http.ServerResponse,
        filePath: string,
        contentType?: string
    ): Promise<void> {
        try {
            const content = await fs.promises.readFile(filePath);
            const detectedContentType = contentType || this.getContentType(filePath);
            
            res.writeHead(200, { 'Content-Type': detectedContentType });
            res.end(content);
        } catch (error) {
            console.error('SERVER: Error serving file:', error);
            this.sendErrorResponse(res, 500, 'Error reading file');
        }
    }

    /**
     * Add CORS headers to response
     * @param res - HTTP response
     */
    private addCorsHeaders(res: http.ServerResponse): void {
        const allowedOrigins = this.config.allowedOrigins?.join(', ') || '*';
        
        res.setHeader('Access-Control-Allow-Origin', allowedOrigins);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    }

    /**
     * Send JSON response
     * @param res - HTTP response
     * @param statusCode - HTTP status code
     * @param data - Data to send
     */
    private sendJsonResponse(res: http.ServerResponse, statusCode: number, data: any): void {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data, null, 2));
    }

    /**
     * Send error response
     * @param res - HTTP response
     * @param statusCode - HTTP status code
     * @param message - Error message
     */
    private sendErrorResponse(res: http.ServerResponse, statusCode: number, message: string): void {
        const errorData = {
            error: true,
            status: statusCode,
            message: message,
            timestamp: new Date().toISOString()
        };
        
        this.sendJsonResponse(res, statusCode, errorData);
    }

    /**
     * Handle Server-Sent Events request for analysis updates
     * @param req - HTTP request
     * @param res - HTTP response
     */
    private async handleSSERequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        console.log('REQUEST_UPDATE: SSE connection request received on server');
        console.log(`REQUEST_UPDATE: Server port: ${this.config.port}`);
        
        // Find which analysis file this server is serving
        const serverPort = this.config.port;
        const fileUri = fileToServerMap.findFileByPort(serverPort);
        
        console.log(`REQUEST_UPDATE: Looking up file for port ${serverPort}`);
        console.log(`REQUEST_UPDATE: Found file mapping: ${fileUri || 'NOT FOUND'}`);
        
        if (!fileUri) {
            console.warn(`REQUEST_UPDATE: No file mapping found for server on port ${serverPort}`);
            console.warn(`REQUEST_UPDATE: Available mappings: ${fileToServerMap.getAllFileUris().join(', ')}`);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('No analysis file associated with this server');
            return;
        }
        
        console.log(`REQUEST_UPDATE: Setting up SSE for analysis file: ${fileUri}`);
        
        // Register the SSE client with the manager
        sseManager.registerClient(fileUri, res);
        
        console.log(`REQUEST_UPDATE: SSE client registration completed for ${fileUri}`);
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
     * Generate fallback HTML page
     * @returns string - HTML content
     */
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
        <p><strong>Attempted File:</strong> ${this.config.mainFile || 'Not specified'}</p>
        <p><strong>Static Root:</strong> ${this.config.staticRoot}</p>
    </div>
    <div class="info">
        <h3>Server Information</h3>
        <p><strong>Port:</strong> ${this.config.port}</p>
        <p><strong>Host:</strong> ${this.config.host}</p>
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
