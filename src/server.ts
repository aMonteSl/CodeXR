import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { ServerInfo, ActiveServerEntry, ServerMode } from './models/serverModel';

// List to store all server instances
let activeServerList: ActiveServerEntry[] = [];

// Variable to track the most recent server
let activeServer: ActiveServerEntry | undefined;

// Variables to store active SSE clients for live reload
let sseClients: http.ServerResponse[] = [];

// Status bar item for quick access to server actions
let statusBarItem: vscode.StatusBarItem | undefined;

/**
 * Gets the list of active servers
 * @returns List of active server information
 */
export function getActiveServers(): ServerInfo[] {
  return activeServerList.map(entry => entry.info);
}

/**
 * Starts an HTTP or HTTPS local server that serves an HTML file
 * with live reload capability
 * 
 * @param selectedFile - Full path to the main HTML file to serve
 * @param context - Extension context to register resources that need cleanup
 * @param useHttps - If true, will use HTTPS instead of HTTP
 * @param useDefaultCerts - If true, will use default certificates instead of custom ones
 */
export async function startServer(
  selectedFile: string, 
  context: vscode.ExtensionContext,
  useHttps: boolean = false,
  useDefaultCerts: boolean = true
): Promise<void> {
  // Get the directory where the selected HTML file is located
  const fileDir = path.dirname(selectedFile);

  // Dynamic import of get-port (ESM module)
  const getPortModule = await import('get-port');
  const getPort = getPortModule.default;
  
  // Find a free port in the range 3000-3100 for the server
  const port = await getPort({ port: [...Array(101).keys()].map(i => i + 3000) });

  // Create request handler (common for HTTP and HTTPS)
  const requestHandler = createRequestHandler(fileDir, selectedFile);

  // Create HTTP or HTTPS server based on the chosen option
  let server: http.Server | https.Server;

  try {
    if (useHttps) {
      const { key, cert } = await getCertificates(context, useDefaultCerts);
      // Create HTTPS server with certificates
      server = https.createServer({ key, cert }, requestHandler);
    } else {
      // Create standard HTTP server
      server = http.createServer(requestHandler);
    }
    
    // Watch for changes in the HTML file to notify SSE clients
    const htmlWatcher = fs.watch(selectedFile, (eventType, filename) => {
      notifyClients();
    });

    // Watch for changes in JSON files in the same directory
    const jsonWatcher = fs.watch(fileDir, (eventType, filename) => {
      // Check if the modified file is a JSON
      if (filename && (filename.endsWith('.json') || filename.endsWith('.csv'))) {
        // Wait a brief moment to ensure the file write is complete
        setTimeout(() => {
          notifyClients();
        }, 300);
      }
    });

    // Register both watchers for cleanup
    context.subscriptions.push({
      dispose: () => {
        htmlWatcher.close();
        jsonWatcher.close();
      }
    });

    // Start the server on the selected port
    server.listen(port, () => {
      const protocol = useHttps ? 'https' : 'http';
      const serverUrl = `${protocol}://localhost:${port}`;
      
      // Create a unique ID for this server
      const serverId = `server-${Date.now()}`;
      
      // Server information
      const serverInfo: ServerInfo = {
        id: serverId,
        url: serverUrl,
        protocol,
        port,
        filePath: selectedFile,
        useHttps,
        startTime: Date.now()
      };
      
      // Create an entry for the new server
      const serverEntry: ActiveServerEntry = {
        server, 
        info: serverInfo,
        sseClients: []
      };
      
      // Save as active server and add to the list
      activeServer = serverEntry;
      activeServerList.push(serverEntry);
      
      // Notify that there's a new server to update the UI
      vscode.commands.executeCommand('integracionvsaframe.refreshView');
      
      // Show initial notification with options
      vscode.window.showInformationMessage(
        `${protocol.toUpperCase()} server running at ${serverUrl}`,
        'Open in browser', 'Stop server'
      ).then(selection => {
        if (selection === 'Open in browser') {
          vscode.env.openExternal(vscode.Uri.parse(serverUrl));
        } else if (selection === 'Stop server') {
          // Fixed: pass the specific ID of the current server
          stopServer(serverId);
        }
      });
      
      // Create a status bar item for persistent information
      updateStatusBar(serverInfo);
      
      // Automatically open the browser with the server URL
      vscode.env.openExternal(vscode.Uri.parse(serverUrl));
    });

    // Register a disposable to close the server when the extension is deactivated
    context.subscriptions.push({
      dispose: () => {
        stopServer();
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error starting server: ${errorMessage}`);
  }
}

/**
 * Creates the HTTP request handler function
 * @param fileDir Directory of the HTML file
 * @param selectedFile Path to the HTML file
 * @returns Request handler function
 */
function createRequestHandler(fileDir: string, selectedFile: string): http.RequestListener {
  return (req: http.IncomingMessage, res: http.ServerResponse) => {
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
      sseClients.push(res);
      
      // When the client closes the connection, remove it from the list
      req.on('close', () => {
        sseClients = sseClients.filter(client => client !== res);
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
          const injectedData = injectLiveReloadScript(data);
          
          // Send HTML with injected LiveReload script
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(injectedData);
        });
      } else {
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

/**
 * Injects the LiveReload script into HTML content if not already present
 * @param htmlContent Original HTML content
 * @returns HTML with LiveReload script injected
 */
function injectLiveReloadScript(htmlContent: string): string {
  // Evitar duplicación
  if (htmlContent.indexOf('<!-- LiveReload -->') !== -1) {
    return htmlContent;
  }
  
  const liveReloadScript = `<!-- LiveReload -->
<script>
  // Configuración para la recarga en vivo
  const evtSource = new EventSource('/livereload');
  
  // Manejador de recarga
  evtSource.onmessage = function(e) {
    if (e.data === 'reload') {
      window.location.reload();
    }
  };
  
  // Limpieza al cerrar
  window.addEventListener('beforeunload', function() {
    evtSource.close();
  });
</script>`;

  // Insertar antes del cierre de body
  if (htmlContent.indexOf('</body>') !== -1) {
    return htmlContent.replace('</body>', `${liveReloadScript}\n</body>`);
  } else {
    return htmlContent + `\n${liveReloadScript}`;
  }
}

/**
 * Notifies all SSE clients to reload the page
 */
function notifyClients(): void {
  sseClients.forEach(client => {
    client.write('data: reload\n\n');
  });
}

/**
 * Gets SSL certificates for HTTPS server
 * @param context Extension context
 * @param useDefaultCerts Whether to use default certificates
 * @returns Object with key and cert buffers
 */
async function getCertificates(
  context: vscode.ExtensionContext, 
  useDefaultCerts: boolean
): Promise<{key: Buffer, cert: Buffer}> {
  if (useDefaultCerts) {
    // Use default certificates in ./certs
    const extensionPath = context.extensionPath;
    const keyPath = path.join(extensionPath, 'certs', 'babia_key.pem');
    const certPath = path.join(extensionPath, 'certs', 'babia_cert.pem');
    
    // Check if certificates exist
    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
      throw new Error('Default certificates do not exist in ./certs');
    }
    
    try {
      const key = fs.readFileSync(keyPath);
      const cert = fs.readFileSync(certPath);
      return { key, cert };
    } catch (err) {
      if (err instanceof Error) {
        throw new Error(`Error reading default certificates: ${err.message}`);
      } else {
        throw new Error('Error reading default certificates');
      }
    }
  } else {
    // Dialog to select private key file
    const keyOptions: vscode.OpenDialogOptions = {
      canSelectMany: false,
      openLabel: 'Select private key file (.key or .pem)',
      filters: { 'Certificates': ['key', 'pem'] }
    };
    
    const keyUri = await vscode.window.showOpenDialog(keyOptions);
    if (!keyUri || keyUri.length === 0) {
      throw new Error('No private key file was selected');
    }
    
    // Dialog to select certificate file
    const certOptions: vscode.OpenDialogOptions = {
      canSelectMany: false,
      openLabel: 'Select certificate file (.cert or .pem)',
      filters: { 'Certificates': ['cert', 'pem'] }
    };
    
    const certUri = await vscode.window.showOpenDialog(certOptions);
    if (!certUri || certUri.length === 0) {
      throw new Error('No certificate file was selected');
    }
    
    // Load certificate and key files
    const key = fs.readFileSync(keyUri[0].fsPath);
    const cert = fs.readFileSync(certUri[0].fsPath);
    return { key, cert };
  }
}

/**
 * Stops the active server and cleans up associated resources
 * @param serverId Optional ID of the specific server to stop
 */
export function stopServer(serverId?: string): void {
  if (!serverId && activeServer) {
    // Close the active server
    activeServer.server.close(() => {
      vscode.window.showInformationMessage('Server stopped successfully');
    });
    
    // Remove from the active servers list
    activeServerList = activeServerList.filter(entry => entry.info.id !== activeServer?.info.id);
    
    // Update the active server reference (if any)
    activeServer = activeServerList.length > 0 ? 
      activeServerList[activeServerList.length - 1] : undefined;
  } else if (serverId) {
    // Find server by ID
    const serverEntryIndex = activeServerList.findIndex(entry => entry.info.id === serverId);
    
    if (serverEntryIndex >= 0) {
      const serverEntry = activeServerList[serverEntryIndex];
      
      // Close the server to free the port
      serverEntry.server.close(() => {
        vscode.window.showInformationMessage(`Server ${serverEntry.info.url} stopped successfully`);
      });
      
      // Update active server reference if needed
      if (activeServer && activeServer.info.id === serverId) {
        activeServer = undefined;
      }
      
      // Remove from the list
      activeServerList.splice(serverEntryIndex, 1);
      
      // If servers remain, set the last one as active
      if (activeServerList.length > 0 && !activeServer) {
        activeServer = activeServerList[activeServerList.length - 1];
      }
    }
  }
  
  // Update UI
  vscode.commands.executeCommand('integracionvsaframe.refreshView');
  
  // Update status bar
  if (activeServerList.length === 0 && statusBarItem) {
    statusBarItem.dispose();
    statusBarItem = undefined;
  } else if (activeServerList.length > 0) {
    updateStatusBar(activeServerList[activeServerList.length - 1].info);
  }
}

/**
 * Updates the status bar with server information
 * @param serverInfo Server information to display
 */
function updateStatusBar(serverInfo: ServerInfo): void {
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  }
  
  statusBarItem.text = `$(globe) Server: ${serverInfo.url}`;
  statusBarItem.tooltip = `${serverInfo.protocol.toUpperCase()} server active\nClick to see options`;
  statusBarItem.command = 'integracionvsaframe.serverStatusActions';
  statusBarItem.show();
}