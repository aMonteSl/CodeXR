import * as vscode from 'vscode';   // API de VS Code para mostrar mensajes y abrir enlaces
import * as http from 'http';       // Módulo HTTP para crear el servidor web
import * as https from 'https';     // Módulo HTTPS para crear un servidor seguro
import * as fs from 'fs';           // Sistema de archivos para leer archivos y observar cambios
import * as path from 'path';       // Utilidades para manejar rutas de archivos

// Estructura para almacenar información de servidores activos
export interface ServerInfo {
  id: string;
  url: string;
  protocol: string;
  port: number;
  filePath: string;
  useHttps: boolean;
}

// Modifica la estructura para rastrear todos los servidores activos con sus referencias HTTP/HTTPS
interface ActiveServerEntry {
  server: http.Server | https.Server;
  info: ServerInfo;
}

// Lista para almacenar todas las instancias del servidor
let activeServerList: ActiveServerEntry[] = [];

// Variable para tracking del servidor más reciente
let activeServer: ActiveServerEntry | undefined;

// Función para obtener la lista de servidores activos
export function getActiveServers(): ServerInfo[] {
  return activeServerList.map(entry => entry.info);
}

// Variables para almacenar el servidor activo
let sseClients: http.ServerResponse[] = [];
let statusBarItem: vscode.StatusBarItem | undefined;

/**
 * Inicia un servidor HTTP o HTTPS local que sirve un archivo HTML 
 * con capacidad de recarga en vivo (live reload)
 * 
 * @param selectedFile - Ruta completa al archivo HTML principal a servir
 * @param context - Contexto de la extensión para registrar recursos que deben limpiarse
 * @param useHttps - Si es true, usará HTTPS en lugar de HTTP
 * @param useDefaultCerts - Si es true, usará certificados predeterminados en lugar de personalizados
 */
export async function startServer(
  selectedFile: string, 
  context: vscode.ExtensionContext,
  useHttps: boolean = false,
  useDefaultCerts: boolean = true
): Promise<void> {
  // Obtiene el directorio donde se encuentra el archivo HTML seleccionado
  const fileDir = path.dirname(selectedFile);

  // Importación dinámica de get-port (módulo ESM)
  const getPortModule = await import('get-port');
  const getPort = getPortModule.default;
  // Busca un puerto libre en el rango de 3000 a 3100 para el servidor
  const port = await getPort({ port: [...Array(101).keys()].map(i => i + 3000) });

  // Función para crear el manejador de solicitudes (común para HTTP y HTTPS)
  const requestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => {
    // Endpoint especial para conexiones SSE (live reload)
    if (req.url === '/livereload') {
      // Configura los encabezados para una conexión SSE
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write('\n');
      
      // Registra esta respuesta como un cliente SSE activo
      sseClients.push(res);
      
      // Cuando el cliente cierra la conexión, lo elimina de la lista
      req.on('close', () => {
        sseClients = sseClients.filter(client => client !== res);
      });
      return;
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
        res.writeHead(404);
        res.end('Archivo no encontrado');
        return;
      }

      // Determina el tipo MIME según la extensión del archivo
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
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

      // Tratamiento especial para el archivo HTML principal
      if (filePath === selectedFile && contentType === 'text/html') {
        // Lee el archivo como texto
        fs.readFile(filePath, 'utf8', (err, data) => {
          if (err) {
            res.writeHead(500);
            res.end('Error al leer el archivo');
            return;
          }
          
          let injectedData: string;
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
  // Detectar cierre de ventana para limpieza
  window.addEventListener('beforeunload', function() {
    evtSource.close();
  });
</script>
</body>`);
            } else {
              // Si no encuentra </body>, añade el script al final
              injectedData = data + `\n<!-- LiveReload -->
<script>
  const evtSource = new EventSource('/livereload');
  evtSource.onmessage = function(e) {
    if (e.data === 'reload') {
      window.location.reload();
    }
  };
  // Detectar cierre de ventana para limpieza
  window.addEventListener('beforeunload', function() {
    evtSource.close();
  });
</script>`;
            }
          } else {
            // Si ya tiene el script, no modifica nada
            injectedData = data;
          }
          // Envía el HTML con el script de LiveReload inyectado
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(injectedData);
        });
      } else {
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
  };

  // Crear servidor HTTP o HTTPS según la opción elegida
  let server: http.Server | https.Server;

  try {
    if (useHttps) {
      let key: Buffer;
      let cert: Buffer;
      
      if (useDefaultCerts) {
        // Usa los certificados predeterminados en ./certs
        const extensionPath = context.extensionPath;
        const keyPath = path.join(extensionPath, 'certs', 'babia_key.pem');
        const certPath = path.join(extensionPath, 'certs', 'babia_cert.pem');
        
        // Comprueba si los certificados existen
        if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
          throw new Error('Los certificados predeterminados no existen en ./certs');
        }
        
        try {
          key = fs.readFileSync(keyPath);
          cert = fs.readFileSync(certPath);
        } catch (err) {
          if (err instanceof Error) {
            throw new Error(`Error al leer los certificados predeterminados: ${err.message}`);
          } else {
            throw new Error('Error al leer los certificados predeterminados');
          }
        }
      } else {
        // Diálogo para seleccionar el archivo de clave privada
        const keyOptions: vscode.OpenDialogOptions = {
          canSelectMany: false,
          openLabel: 'Selecciona el archivo de clave privada (.key o .pem)',
          filters: { 'Certificados': ['key', 'pem'] }
        };
        
        const keyUri = await vscode.window.showOpenDialog(keyOptions);
        if (!keyUri || keyUri.length === 0) {
          throw new Error('No se seleccionó el archivo de clave privada');
        }
        
        // Diálogo para seleccionar el archivo de certificado
        const certOptions: vscode.OpenDialogOptions = {
          canSelectMany: false,
          openLabel: 'Selecciona el archivo de certificado (.cert o .pem)',
          filters: { 'Certificados': ['cert', 'pem'] }
        };
        
        const certUri = await vscode.window.showOpenDialog(certOptions);
        if (!certUri || certUri.length === 0) {
          throw new Error('No se seleccionó el archivo de certificado');
        }
        
        // Carga los archivos de certificado y clave
        key = fs.readFileSync(keyUri[0].fsPath);
        cert = fs.readFileSync(certUri[0].fsPath);
      }
      
      // Crea servidor HTTPS con los certificados
      server = https.createServer({ key, cert }, requestHandler);
    } else {
      // Crea servidor HTTP estándar
      server = http.createServer(requestHandler);
    }
    
    // Observa cambios en el archivo HTML para notificar a los clientes SSE
    const watcher = fs.watch(selectedFile, (eventType, filename) => {
      sseClients.forEach(client => {
        client.write('data: reload\n\n');
      });
    });

    // Registra un disposable para limpiar el watcher cuando la extensión se desactive
    context.subscriptions.push({
      dispose: () => {
        watcher.close();
      }
    });

    // Inicia el servidor en el puerto seleccionado
    server.listen(port, () => {
      const protocol = useHttps ? 'https' : 'http';
      const serverUrl = `${protocol}://localhost:${port}`;
      
      // Crea un ID único para este servidor
      const serverId = `server-${Date.now()}`;
      
      // Información del servidor
      const serverInfo: ServerInfo = {
        id: serverId,
        url: serverUrl,
        protocol,
        port,
        filePath: selectedFile,
        useHttps
      };
      
      // Crea una entrada para el nuevo servidor
      const serverEntry: ActiveServerEntry = {
        server, 
        info: serverInfo
      };
      
      // Guarda como servidor activo y en la lista
      activeServer = serverEntry;
      activeServerList.push(serverEntry);
      
      // Notificar que hay un nuevo servidor para actualizar la UI
      vscode.commands.executeCommand('integracionvsaframe.refreshServerView');
      
      // Muestra la notificación inicial con las opciones
      vscode.window.showInformationMessage(
        `Servidor ${protocol.toUpperCase()} corriendo en ${serverUrl}`,
        'Abrir en navegador', 'Detener servidor'
      ).then(selection => {
        if (selection === 'Abrir en navegador') {
          vscode.env.openExternal(vscode.Uri.parse(serverUrl));
        } else if (selection === 'Detener servidor') {
          stopServer();
        }
      });
      
      // Crea un elemento en la barra de estado para información persistente
      if (statusBarItem) {
        statusBarItem.dispose(); // Elimina cualquier elemento anterior
      }
      
      statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
      statusBarItem.text = `$(globe) Servidor: ${serverUrl}`;
      statusBarItem.tooltip = `Servidor ${protocol.toUpperCase()} activo\nHaz clic para ver opciones`;
      statusBarItem.command = 'integracionvsaframe.serverStatusActions';
      statusBarItem.show();
      
      // Abre automáticamente el navegador con la URL del servidor
      vscode.env.openExternal(vscode.Uri.parse(serverUrl));
    });

    // Registra un disposable para cerrar el servidor cuando la extensión se desactive
    context.subscriptions.push({
      dispose: () => {
        stopServer();
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error al iniciar servidor: ${errorMessage}`);
  }
}

/**
 * Detiene el servidor activo y limpia los recursos asociados
 */
export function stopServer(serverId?: string): void {
  if (!serverId && activeServer) {
    // Código existente...
    activeServer.server.close(() => {
      vscode.window.showInformationMessage('Servidor detenido correctamente');
    });
    
    // Eliminar de la lista de servidores activos
    activeServerList = activeServerList.filter(entry => entry.info.id !== activeServer?.info.id);
    
    // Actualizar el servidor activo (si hay alguno)
    activeServer = activeServerList.length > 0 ? activeServerList[activeServerList.length - 1] : undefined;
  } else if (serverId) {
    // Buscar el servidor por ID
    const serverEntryIndex = activeServerList.findIndex(entry => entry.info.id === serverId);
    
    if (serverEntryIndex >= 0) {
      const serverEntry = activeServerList[serverEntryIndex];
      
      // Importante: cerrar el servidor para liberar el puerto
      serverEntry.server.close(() => {
        vscode.window.showInformationMessage(`Servidor ${serverEntry.info.url} detenido correctamente`);
      });
      
      // Actualizar el servidor activo si es necesario
      if (activeServer && activeServer.info.id === serverId) {
        activeServer = undefined;
      }
      
      // Eliminar de la lista
      activeServerList.splice(serverEntryIndex, 1);
      
      // Si quedan servidores, establecer el último como activo
      if (activeServerList.length > 0 && !activeServer) {
        activeServer = activeServerList[activeServerList.length - 1];
      }
    }
  }
  
  // Actualizar UI
  vscode.commands.executeCommand('integracionvsaframe.refreshServerView');
  
  // Actualizar barra de estado
  if (activeServerList.length === 0 && statusBarItem) {
    statusBarItem.dispose();
    statusBarItem = undefined;
  } else if (activeServerList.length > 0) {
    updateStatusBar(activeServerList[activeServerList.length - 1].info);
  }
}

// Función para actualizar la barra de estado
function updateStatusBar(serverInfo: ServerInfo) {
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  }
  
  statusBarItem.text = `$(globe) Servidor: ${serverInfo.url}`;
  statusBarItem.tooltip = `Servidor ${serverInfo.protocol.toUpperCase()} activo\nHaz clic para ver opciones`;
  statusBarItem.command = 'integracionvsaframe.serverStatusActions';
  statusBarItem.show();
}
