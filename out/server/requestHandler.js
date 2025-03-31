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
const path = __importStar(require("path"));
const liveReloadManager_1 = require("./liveReloadManager");
/**
 * Creates the HTTP request handler function
 * @param fileDir Directory of the HTML file
 * @param selectedFile Path to the HTML file
 * @returns Request handler function
 */
function createRequestHandler(fileDir, selectedFile) {
    return (req, res) => {
        // Special endpoint for SSE connections (live reload)
        if (req.url === '/livereload') {
            // Set headers for an SSE connection
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });
            res.write('\n');
            // Register this response as an active SSE client
            // Using the centralized client management in liveReloadManager
            (0, liveReloadManager_1.addSSEClient)(res);
            // When the client closes the connection, remove it from the list
            req.on('close', () => {
                (0, liveReloadManager_1.removeSSEClient)(res);
            });
            return;
        }
        // For all other routes, determine which file to serve
        let filePath = path.join(fileDir, req.url || '');
        // If the root ('/') is requested, serve the selected HTML file
        if (req.url === '/' || req.url === '') {
            filePath = selectedFile;
        }
        // Check if file exists
        fs.exists(filePath, exists => {
            if (!exists) {
                res.writeHead(404);
                res.end('File not found');
                return;
            }
            // Determine MIME type based on file extension
            const ext = path.extname(filePath).toLowerCase();
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
            const contentType = mimeTypes[ext] || 'text/plain';
            // Special handling for the main HTML file
            if (filePath === selectedFile && contentType === 'text/html') {
                // Read file as text
                fs.readFile(filePath, 'utf8', (err, data) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Error reading the file');
                        return;
                    }
                    // Inject live reload script if not already present
                    const injectedData = (0, liveReloadManager_1.injectLiveReloadScript)(data);
                    // Send HTML with injected LiveReload script
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(injectedData);
                });
            }
            else {
                // For files other than the main HTML, serve them without modification
                fs.readFile(filePath, (err, data) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Error reading the file');
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(data);
                });
            }
        });
    };
}
//# sourceMappingURL=requestHandler.js.map