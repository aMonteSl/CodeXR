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
exports.stopServer = stopServer;
const vscode = __importStar(require("vscode")); // API de VS Code para mostrar mensajes y abrir enlaces
const http = __importStar(require("http")); // Módulo HTTP para crear el servidor web
const fs = __importStar(require("fs")); // Sistema de archivos para leer archivos y observar cambios
const path = __importStar(require("path")); // Utilidades para manejar rutas de archivos
// Variable para almacenar el servidor activo (accesible desde toda la extensión)
let activeServer;
// Variable para almacenar el temporizador de auto-cierre
let shutdownTimer;
// Tiempo de inactividad antes de cerrar el servidor (30 segundos)
const INACTIVITY_TIMEOUT = 30000;
/**
 * Inicia un servidor HTTP local que sirve un archivo HTML y sus recursos asociados
 * con capacidad de recarga en vivo (live reload)
 *
 * @param selectedFile - Ruta completa al archivo HTML principal a servir
 * @param context - Contexto de la extensión para registrar recursos que deben limpiarse
 */
async function startServer(selectedFile, context) {
    // Si hay un servidor activo, lo cerramos primero
    if (activeServer) {
        stopServer();
    }
    // Obtiene el directorio donde se encuentra el archivo HTML seleccionado
    const fileDir = path.dirname(selectedFile);
    // Importación dinámica de get-port (módulo ESM)
    // Esta librería encuentra puertos disponibles en el sistema
    const getPortModule = await import('get-port');
    const getPort = getPortModule.default;
    // Busca un puerto libre en el rango de 3000 a 3100 para el servidor
    const port = await getPort({ port: [...Array(101).keys()].map(i => i + 3000) });
    // Array para almacenar las conexiones SSE (Server-Sent Events) activas
    // Estas conexiones permitirán notificar al navegador cuando deba recargar la página
    let sseClients = [];
    // Observa cambios en el archivo HTML para notificar a los clientes SSE
    // Cuando el archivo cambia, envía un mensaje a todos los clientes conectados
    const watcher = fs.watch(selectedFile, (eventType, filename) => {
        sseClients.forEach(client => {
            client.write('data: reload\n\n'); // Formato específico de SSE para enviar datos
        });
    });
    // Función para comprobar si hay clientes conectados e iniciar el temporizador de cierre
    const checkForActiveConnections = () => {
        // Cancela cualquier temporizador existente
        if (shutdownTimer) {
            clearTimeout(shutdownTimer);
            shutdownTimer = undefined;
        }
        // Si no hay clientes conectados, inicia temporizador para cerrar el servidor
        if (sseClients.length === 0 && activeServer) {
            shutdownTimer = setTimeout(() => {
                vscode.window.showInformationMessage('Cerrando servidor por inactividad...');
                stopServer();
            }, INACTIVITY_TIMEOUT);
        }
    };
    // Crea el servidor HTTP que manejará las peticiones
    const server = http.createServer((req, res) => {
        // Endpoint especial para conexiones SSE (live reload)
        if (req.url === '/livereload') {
            // Configura los encabezados para una conexión SSE
            res.writeHead(200, {
                'Content-Type': 'text/event-stream', // Tipo de contenido para SSE
                'Cache-Control': 'no-cache', // Evita el cacheo
                'Connection': 'keep-alive' // Mantiene la conexión abierta
            });
            res.write('\n'); // Envía un salto de línea inicial para iniciar la conexión
            // Registra esta respuesta como un cliente SSE activo
            sseClients.push(res);
            // Si hay clientes conectados, cancela cualquier temporizador de cierre
            if (shutdownTimer) {
                clearTimeout(shutdownTimer);
                shutdownTimer = undefined;
            }
            // Cuando el cliente cierra la conexión, lo elimina de la lista
            req.on('close', () => {
                sseClients = sseClients.filter(client => client !== res);
                // Comprueba si quedan clientes activos
                checkForActiveConnections();
            });
            return; // Termina el manejo de esta ruta
        }
        // Para las demás rutas, determina qué archivo servir
        let filePath = path.join(fileDir, req.url || '');
        // Si se solicita la raíz ('/'), sirve el archivo HTML seleccionado
        if (req.url === '/' || req.url === '') {
            filePath = selectedFile;
        }
        // Verifica si el archivo existe
        fs.exists(filePath, exists => {
            if (!exists) {
                // Si el archivo no existe, devuelve un error 404
                res.writeHead(404);
                res.end('Archivo no encontrado');
                return;
            }
            // Determina el tipo MIME según la extensión del archivo
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
            // Usa el tipo MIME correspondiente o 'text/plain' si no está en la lista
            const contentType = mimeTypes[ext] || 'text/plain';
            // Tratamiento especial para el archivo HTML principal
            if (filePath === selectedFile && contentType === 'text/html') {
                // Lee el archivo como texto
                fs.readFile(filePath, 'utf8', (err, data) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Error al leer el archivo');
                        return;
                    }
                    let injectedData;
                    // Verifica si ya tiene el script de LiveReload
                    if (data.indexOf('<!-- LiveReload -->') === -1) {
                        // Si encuentra la etiqueta </body>, inserta el script justo antes
                        if (data.indexOf('</body>') !== -1) {
                            injectedData = data.replace('</body>', `<!-- LiveReload -->
<script>
  const evtSource = new EventSource('/livereload');
  evtSource.onmessage = function(e) {
    if (e.data === 'reload') {
      window.location.reload();
    }
  };
  // Detectar cierre de ventana
  window.addEventListener('beforeunload', function() {
    evtSource.close();
  });
</script>
</body>`);
                        }
                        else {
                            // Si no encuentra </body>, añade el script al final
                            injectedData = data + `\n<!-- LiveReload -->
<script>
  const evtSource = new EventSource('/livereload');
  evtSource.onmessage = function(e) {
    if (e.data === 'reload') {
      window.location.reload();
    }
  };
  // Detectar cierre de ventana
  window.addEventListener('beforeunload', function() {
    evtSource.close();
  });
</script>`;
                        }
                    }
                    else {
                        // Si ya tiene el script, no modifica nada
                        injectedData = data;
                    }
                    // Envía el HTML con el script de LiveReload inyectado
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(injectedData);
                });
            }
            else {
                // Para archivos que no son el HTML principal, los sirve sin modificar
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
    // Guarda referencia al servidor activo
    activeServer = server;
    // Inicia el servidor en el puerto seleccionado
    server.listen(port, () => {
        // Muestra un mensaje informativo en VS Code
        vscode.window.showInformationMessage(`Servidor corriendo en http://localhost:${port}`, 'Detener Servidor')
            .then(selection => {
            if (selection === 'Detener Servidor') {
                stopServer();
            }
        });
        // Abre automáticamente el navegador con la URL del servidor
        vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${port}`));
    });
    // Registra un disposable para cerrar el servidor cuando la extensión se desactive
    // Esto garantiza que el puerto se libere cuando ya no se necesite
    context.subscriptions.push({
        dispose: () => {
            stopServer();
        }
    });
}
/**
 * Detiene el servidor activo y libera recursos
 */
function stopServer() {
    if (activeServer) {
        activeServer.close(() => {
            vscode.window.showInformationMessage('Servidor local detenido');
        });
        activeServer = undefined;
    }
    if (shutdownTimer) {
        clearTimeout(shutdownTimer);
        shutdownTimer = undefined;
    }
}
//# sourceMappingURL=server.js.map