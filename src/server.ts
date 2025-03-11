import * as vscode from 'vscode';   // API de VS Code para mostrar mensajes y abrir enlaces
import * as http from 'http';       // Módulo HTTP para crear el servidor web
import * as fs from 'fs';           // Sistema de archivos para leer archivos y observar cambios
import * as path from 'path';       // Utilidades para manejar rutas de archivos

/**
 * Inicia un servidor HTTP local que sirve un archivo HTML y sus recursos asociados
 * con capacidad de recarga en vivo (live reload)
 * 
 * @param selectedFile - Ruta completa al archivo HTML principal a servir
 * @param context - Contexto de la extensión para registrar recursos que deben limpiarse
 */
export async function startServer(selectedFile: string, context: vscode.ExtensionContext): Promise<void> {
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
  let sseClients: http.ServerResponse[] = [];

  // Observa cambios en el archivo HTML para notificar a los clientes SSE
  // Cuando el archivo cambia, envía un mensaje a todos los clientes conectados
  fs.watch(selectedFile, (eventType, filename) => {
    sseClients.forEach(client => {
      client.write('data: reload\n\n');  // Formato específico de SSE para enviar datos
    });
  });

  // Crea el servidor HTTP que manejará las peticiones
  const server = http.createServer((req, res) => {
    // Endpoint especial para conexiones SSE (live reload)
    if (req.url === '/livereload') {
      // Configura los encabezados para una conexión SSE
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',  // Tipo de contenido para SSE
        'Cache-Control': 'no-cache',          // Evita el cacheo
        'Connection': 'keep-alive'            // Mantiene la conexión abierta
      });
      res.write('\n');  // Envía un salto de línea inicial para iniciar la conexión
      
      // Registra esta respuesta como un cliente SSE activo
      sseClients.push(res);
      
      // Cuando el cliente cierra la conexión, lo elimina de la lista
      req.on('close', () => {
        sseClients = sseClients.filter(client => client !== res);
      });
      return;  // Termina el manejo de esta ruta
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
  });

  // Inicia el servidor en el puerto seleccionado
  server.listen(port, () => {
    // Muestra un mensaje informativo en VS Code
    vscode.window.showInformationMessage(`Servidor corriendo en http://localhost:${port}`);
    // Abre automáticamente el navegador con la URL del servidor
    vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${port}`));
  });

  // Registra un disposable para cerrar el servidor cuando la extensión se desactive
  // Esto garantiza que el puerto se libere cuando ya no se necesite
  context.subscriptions.push({
    dispose: () => {
      server.close();
    }
  });
}
