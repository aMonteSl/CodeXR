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
 * Creates the HTTP request handler function
 * @param fileDir Directory of the HTML file
 * @param selectedFile Path to the HTML file
 * @returns Request handler function
 */
function createRequestHandler(fileDir, selectedFile) {
    // Calcular la ruta base de la extensión CORRECTAMENTE
    // __dirname es /home/adrian/codexr/src/server/
    // Necesitamos subir solo DOS niveles para llegar a la raíz del proyecto
    const extensionPath = path.resolve(__dirname, '../..');
    const examplesDataPath = path.join(extensionPath, 'examples', 'data');
    console.log(`Ruta base de la extensión: ${extensionPath}`);
    console.log(`Ruta de datos de ejemplos: ${examplesDataPath}`);
    return (req, res) => {
        // Get URL path or default to '/'
        let urlPath = req.url || '/';
        // Handle default route
        if (urlPath === '/') {
            urlPath = '/' + path.basename(selectedFile);
        }
        // Handle livereload endpoint
        if (urlPath === '/livereload') {
            handleLiveReload(req, res);
            return;
        }
        // Decode URL to handle spaces and special characters
        urlPath = decodeURIComponent(urlPath);
        // Log the requested URL for debugging
        console.log(`Requested URL: ${urlPath}`);
        // PASO 1: Determinar si se está solicitando un archivo JSON de datos
        if (urlPath.includes('/data/') && urlPath.endsWith('.json')) {
            // Es una solicitud de datos JSON
            const jsonFileName = path.basename(urlPath);
            // Usar la ruta relativa calculada al inicio
            const correctJsonPath = path.join(examplesDataPath, jsonFileName);
            console.log(`Intentando acceder JSON desde ruta dinámica: ${correctJsonPath}`);
            if (fs.existsSync(correctJsonPath)) {
                // Archivo encontrado, servirlo inmediatamente
                console.log(`Archivo JSON encontrado: ${correctJsonPath}`);
                serveFile(correctJsonPath, res);
                return;
            }
        }
        // Procedimiento normal para otros archivos
        let filePath = path.join(fileDir, urlPath.replace(/^\//, ''));
        // Check if file exists
        fs.stat(filePath, (err, stats) => {
            if (err) {
                console.error(`File not found: ${filePath}`);
                // PASO 2: Para cualquier archivo no encontrado que sea JSON, intentar desde la ruta correcta
                if (urlPath.endsWith('.json')) {
                    const jsonFileName = path.basename(urlPath);
                    // Usar la ruta relativa calculada al inicio
                    const correctJsonPath = path.join(examplesDataPath, jsonFileName);
                    console.log(`Último intento con ruta: ${correctJsonPath}`);
                    fs.stat(correctJsonPath, (jsonErr, jsonStats) => {
                        if (jsonErr) {
                            res.writeHead(404, { 'Content-Type': 'text/plain' });
                            res.end(`File not found: ${urlPath}`);
                            return;
                        }
                        // Servir desde la ruta correcta
                        serveFile(correctJsonPath, res);
                    });
                    return;
                }
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end(`File not found: ${urlPath}`);
                return;
            }
            // Serve the file
            serveFile(filePath, res);
        });
    };
    // Helper function to serve a file
    function serveFile(filePath, res) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = getContentType(ext);
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end(`Server Error: ${err.message}`);
                return;
            }
            // Process HTML content
            if (ext === '.html') {
                // Inject live reload script
                const processedData = (0, liveReloadManager_1.injectLiveReloadScript)(data.toString());
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(processedData);
            }
            else {
                // Serve other files as-is
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data);
            }
        });
    }
}
//# sourceMappingURL=requestHandler.js.map