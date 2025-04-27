"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRequestHandler = createRequestHandler;
const fs = __importStar(require("fs"));
const fsPromises = __importStar(require("fs/promises")); // Add this import for Promise-based fs methods
const path = __importStar(require("path"));
const liveReloadManager_1 = require("./liveReloadManager");
/**
 * Handles live reload requests
 * @param req Incoming HTTP request
 * @param res HTTP response
 */
function handleLiveReload(req, res) {
    // Set headers for an SSE connection
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    res.write('\n');
    // Register this response as an active SSE client
    (0, liveReloadManager_1.addSSEClient)(res);
    // When the client closes the connection, remove it from the list
    req.on('close', () => {
        (0, liveReloadManager_1.removeSSEClient)(res);
    });
}
/**
 * Determines the content type based on file extension
 * @param ext File extension
 * @returns Content type
 */
function getContentType(ext) {
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif'
    };
    return mimeTypes[ext] || 'text/plain';
}
/**
 * Creates a request handler for serving static files with live reload support
 * @param baseDir Base directory for serving files
 * @param mainFilePath Path to the main HTML file
 * @returns Request handler function
 */
function createRequestHandler(baseDir, mainFilePath) {
    return async function (req, res) {
        const requestUrl = req.url || '/';
        console.log(`Server received request: ${requestUrl} [${req.method}]`);
        // Handle live reload endpoint
        if (requestUrl === '/live-reload') {
            handleLiveReload(req, res);
            return;
        }
        // Add this section to check for SSE-related headers with better detection
        const isSSEUpdate = req.headers['x-requested-with'] === 'XMLHttpRequest' ||
            req.headers['accept']?.includes('text/event-stream') ||
            req.headers['x-requested-by'] === 'SSE-Update' ||
            (req.headers.referer && (requestUrl === '/index.html' || requestUrl === '/'));
        // If it looks like an SSE-initiated request for index.html or root, block the reload
        if (requestUrl === '/' || requestUrl === '/index.html') {
            // More aggressive check to catch all reload attempts during updates
            if (isSSEUpdate || req.headers.referer) {
                console.log('Preventing index.html reload during possible SSE update');
                res.writeHead(304, {
                    'Cache-Control': 'no-store, no-cache, must-revalidate',
                    'Pragma': 'no-cache'
                });
                res.end();
                return;
            }
        }
        // Fix the file check for JSON files - BEFORE requesting the rest of the file
        if (requestUrl.includes('latest-analysis.json') || requestUrl.includes('data.json')) {
            console.log(`JSON request detected: ${requestUrl}`);
            // Extract the base part of the URL (without query parameters)
            const urlWithoutQuery = requestUrl.split('?')[0];
            // Get the path to the requested file
            const filePath = path.join(baseDir, decodeURIComponent(urlWithoutQuery));
            console.log(`Serving JSON file: ${filePath} (from URL: ${requestUrl})`);
            // Check if the file exists
            try {
                const stat = await fsPromises.stat(filePath); // Use Promise-based fs.stat
                if (stat.isFile()) {
                    // Serve the file with appropriate headers
                    const ext = path.extname(filePath);
                    const contentType = getContentType(ext);
                    res.writeHead(200, {
                        'Content-Type': contentType,
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    });
                    const fileStream = fs.createReadStream(filePath);
                    fileStream.pipe(res);
                    return;
                }
            }
            catch (error) {
                // If latest-analysis.json doesn't exist, try fallback to data.json
                if (urlWithoutQuery.endsWith('latest-analysis.json')) {
                    const dataJsonPath = path.join(baseDir, 'data.json');
                    try {
                        const stat = await fsPromises.stat(dataJsonPath);
                        if (stat.isFile()) {
                            // Serve data.json instead
                            res.writeHead(200, {
                                'Content-Type': 'application/json',
                                'Cache-Control': 'no-cache, no-store, must-revalidate'
                            });
                            const fileStream = fs.createReadStream(dataJsonPath);
                            fileStream.pipe(res);
                            return;
                        }
                    }
                    catch (fallbackError) {
                        // Both files not found
                        res.writeHead(404);
                        res.end('Not Found');
                        return;
                    }
                }
                // File not found
                res.writeHead(404);
                res.end(`JSON File not found: ${filePath}`);
                return;
            }
        }
        // Get the path to the requested file
        let filePath;
        if (requestUrl === '/') {
            // If requesting the root, serve the main HTML file
            console.log('Serving main HTML file for root request');
            filePath = mainFilePath;
        }
        else {
            // Normalize the URL by removing any query parameters and hash
            const cleanUrl = decodeURIComponent(requestUrl).split('?')[0].split('#')[0];
            // IMPORTANT FIX: Always resolve paths relative to the baseDir
            filePath = path.join(baseDir, cleanUrl);
            console.log(`Resolving path: ${baseDir} + ${cleanUrl} = ${filePath}`);
            // Additional security check - make sure the file is within the baseDir
            const normalizedPath = path.normalize(filePath);
            if (!normalizedPath.startsWith(baseDir)) {
                console.error(`Security warning: Attempted to access file outside server root: ${normalizedPath}`);
                res.statusCode = 403; // Forbidden
                res.end('Access denied: Cannot access files outside server root');
                return;
            }
        }
        // Check if the requested path is a directory
        try {
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
                // If it's a directory, look for index.html inside it
                const indexPath = path.join(filePath, 'index.html');
                // Check if index.html exists in the directory
                if (fs.existsSync(indexPath)) {
                    filePath = indexPath;
                }
                else {
                    // Directory doesn't have an index.html file
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Directory does not contain an index.html file');
                    return;
                }
            }
        }
        catch (error) {
            // If there's an error accessing the file, continue with the original path
            // The error will be handled in the file serving logic below
        }
        // Serve the requested file
        fs.readFile(filePath, (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    // File not found
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('File not found');
                }
                else {
                    // Server error
                    console.error(`Error serving file: ${err.message}`);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end(`Server Error: ${err.code}: ${err.message}`);
                }
                return;
            }
            // Set content type based on file extension
            const contentType = getContentType(path.extname(filePath));
            // If this is the main HTML file, inject the live reload script
            if (filePath === mainFilePath || path.extname(filePath) === '.html') {
                const htmlWithLiveReload = (0, liveReloadManager_1.injectLiveReloadScript)(data.toString());
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(htmlWithLiveReload);
            }
            else {
                // Serve the file as-is
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data);
            }
        });
    };
}
//# sourceMappingURL=requestHandler.js.map