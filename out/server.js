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
exports.startServer = startServer;
const vscode = __importStar(require("vscode"));
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function startServer(selectedFile, context) {
    const fileDir = path.dirname(selectedFile);
    // Importación dinámica de get-port (ESM)
    const getPortModule = await import('get-port');
    const getPort = getPortModule.default;
    // Buscar un puerto libre en el rango de 3000 a 3100
    const port = await getPort({ port: [...Array(101).keys()].map(i => i + 3000) });
    // Array para almacenar las conexiones SSE activas
    let sseClients = [];
    // Observa cambios en el archivo HTML para notificar a los clientes SSE
    fs.watch(selectedFile, (eventType, filename) => {
        sseClients.forEach(client => {
            client.write('data: reload\n\n');
        });
    });
    const server = http.createServer((req, res) => {
        // Endpoint SSE para LiveReload
        if (req.url === '/livereload') {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });
            res.write('\n');
            sseClients.push(res);
            req.on('close', () => {
                sseClients = sseClients.filter(client => client !== res);
            });
            return;
        }
        let filePath = path.join(fileDir, req.url || '');
        // Si se solicita la raíz, se sirve el archivo HTML seleccionado
        if (req.url === '/' || req.url === '') {
            filePath = selectedFile;
        }
        fs.exists(filePath, exists => {
            if (!exists) {
                res.writeHead(404);
                res.end('Archivo no encontrado');
                return;
            }
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
            // Si se solicita el archivo HTML principal, inyecta el script de LiveReload
            if (filePath === selectedFile && contentType === 'text/html') {
                fs.readFile(filePath, 'utf8', (err, data) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Error al leer el archivo');
                        return;
                    }
                    let injectedData;
                    if (data.indexOf('<!-- LiveReload -->') === -1) {
                        if (data.indexOf('</body>') !== -1) {
                            injectedData = data.replace('</body>', `<!-- LiveReload -->
<script>
  const evtSource = new EventSource('/livereload');
  evtSource.onmessage = function(e) {
    if (e.data === 'reload') {
      window.location.reload();
    }
  };
</script>
</body>`);
                        }
                        else {
                            injectedData = data + `\n<!-- LiveReload -->
<script>
  const evtSource = new EventSource('/livereload');
  evtSource.onmessage = function(e) {
    if (e.data === 'reload') {
      window.location.reload();
    }
  };
</script>`;
                        }
                    }
                    else {
                        injectedData = data;
                    }
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(injectedData);
                });
            }
            else {
                // Servir el archivo normalmente
                fs.readFile(filePath, (err, data) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Error al leer el archivo');
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(data);
                });
            }
        });
    });
    server.listen(port, () => {
        vscode.window.showInformationMessage(`Servidor corriendo en http://localhost:${port}`);
        vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${port}`));
    });
    // Asegura que el servidor se cierre al desactivar la extensión
    context.subscriptions.push({
        dispose: () => {
            server.close();
        }
    });
}
//# sourceMappingURL=server.js.map