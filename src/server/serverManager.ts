import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import * as fs from 'fs';
import { ServerInfo, ActiveServerEntry, ServerMode } from './models/serverModel';

// Fix 1: Use relative path from src root to avoid module resolution issues
import { getCertificates, defaultCertificatesExist } from '../server/certificateManager';
import { createRequestHandler } from '../server/requestHandler';
import { notifyClients } from '../server/liveReloadManager';
import { updateStatusBar, disposeStatusBar } from '../ui/statusBarManager';

// List to store all server instances
let activeServerList: ActiveServerEntry[] = [];

// Variable to track the most recent server
let activeServer: ActiveServerEntry | undefined;

/**
 * Gets all active servers
 * @returns Array of active servers
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
      
      // Extract the filename without extension for use in the URL display
      const filename = path.basename(selectedFile, path.extname(selectedFile));
      
      // The actual URL will still use localhost, but the display will include the filename
      const serverUrl = `${protocol}://localhost:${port}`;
      const displayUrl = `${protocol}://${filename}:${port}`;
      
      // Create a unique ID for this server
      const serverId = `server-${Date.now()}`;
      
      // Server information
      const serverInfo: ServerInfo = {
        id: serverId,
        url: serverUrl,
        displayUrl: displayUrl,  // Add a new field for display purposes
        protocol,
        port,
        filePath: selectedFile,
        useHttps,
        startTime: Date.now()
      };
      
      // Create an entry for the new server
      const serverEntry: ActiveServerEntry = {
        server, 
        info: serverInfo
      };
      
      // Save as active server and add to the list
      activeServer = serverEntry;
      activeServerList.push(serverEntry);
      
      // Notify that there's a new server to update the UI
      vscode.commands.executeCommand('codexr.refreshView');
      
      // Show initial notification with options
      vscode.window.showInformationMessage(
        `${protocol.toUpperCase()} server running at ${displayUrl}`,
        'Open in browser', 'Stop server'
      ).then(selection => {
        if (selection === 'Open in browser') {
          vscode.env.openExternal(vscode.Uri.parse(serverUrl));
        } else if (selection === 'Stop server') {
          // Fixed: pass the specific ID of the current server
          stopServer(serverId);
        }
      });
      
      // Update status bar using the new module with the display URL
      updateStatusBar(serverInfo);
      
      // Automatically open the browser with the actual server URL
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
  vscode.commands.executeCommand('codexr.refreshView');
  
  // Update status bar using the new module
  if (activeServerList.length === 0) {
    disposeStatusBar();
  } else {
    updateStatusBar(activeServerList[activeServerList.length - 1].info);
  }
}

/**
 * Creates and starts a server
 * @param rootPath Root path of files to serve
 * @param mode Server mode
 * @param context Extension context
 * @param port Optional port to use (if not specified, a free port will be found)
 * @returns Server info or undefined on error
 */
export async function createServer(
  rootPath: string, 
  mode: ServerMode = ServerMode.HTTP, 
  context: vscode.ExtensionContext,
  port?: number
): Promise<ServerInfo | undefined> {
  try {
    // Use provided port or find a free one
    const serverPort = port || await findFreePort();
    
    // Determine the file to serve (use index.html if rootPath is a directory)
    let fileToServe = rootPath;
    const stats = fs.statSync(rootPath);
    if (stats.isDirectory()) {
      fileToServe = path.join(rootPath, 'index.html');
    }
    
    // Get the directory where the file is located
    const fileDir = path.dirname(fileToServe);
    
    // Create request handler
    const requestHandler = createRequestHandler(fileDir, fileToServe);
    
    // Create HTTP or HTTPS server based on the mode
    let server: http.Server | https.Server;
    
    // Choose protocol based on mode
    const useHttps = mode !== ServerMode.HTTP;
    const useDefaultCerts = mode === ServerMode.HTTPS_DEFAULT_CERTS;
    
    if (useHttps) {
      const { key, cert } = await getCertificates(context, useDefaultCerts);
      server = https.createServer({ key, cert }, requestHandler);
    } else {
      server = http.createServer(requestHandler);
    }
    
    // Create a promise to handle server startup
    return new Promise<ServerInfo | undefined>((resolve) => {
      server.listen(serverPort, () => {
        const protocol = useHttps ? 'https' : 'http';
        
        // Extract filename without extension for display
        const filename = path.basename(fileToServe, path.extname(fileToServe));
        
        // Create server URLs
        const serverUrl = `${protocol}://localhost:${serverPort}`;
        const displayUrl = `${protocol}://${filename}:${serverPort}`;
        
        // Create server ID
        const serverId = `server-${Date.now()}`;
        
        // Create server info
        const serverInfo: ServerInfo = {
          id: serverId,
          url: serverUrl,
          displayUrl: displayUrl,
          protocol,
          port: serverPort,
          filePath: fileToServe,
          useHttps,
          startTime: Date.now()
        };
        
        // Create server entry and add to active servers
        const serverEntry: ActiveServerEntry = {
          server,
          info: serverInfo
        };
        
        activeServerList.push(serverEntry);
        
        // Set up file watchers
        const htmlWatcher = fs.watch(fileToServe, () => notifyClients());
        const jsonWatcher = fs.watch(fileDir, (eventType, filename) => {
          if (filename && (filename.endsWith('.json') || filename.endsWith('.csv'))) {
            setTimeout(() => notifyClients(), 300);
          }
        });
        
        // Register watchers for cleanup
        context.subscriptions.push({
          dispose: () => {
            htmlWatcher.close();
            jsonWatcher.close();
          }
        });
        
        // Register server for cleanup
        context.subscriptions.push({
          dispose: () => {
            server.close();
            activeServerList = activeServerList.filter(entry => entry.info.id !== serverId);
          }
        });
        
        // Refresh the UI
        vscode.commands.executeCommand('codexr.refreshView');
        
        // Resolve with the server info
        resolve(serverInfo);
      });
      
      // Handle potential server setup errors
      server.on('error', (err) => {
        vscode.window.showErrorMessage(`Error starting server: ${err.message}`);
        resolve(undefined);
      });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error creating server: ${errorMessage}`);
    return undefined;
  }
}

/**
 * Finds a free port in the range 3000-3100
 * @returns A free port number
 */
async function findFreePort(): Promise<number> {
  try {
    // Dynamic import of get-port (ESM module)
    const getPortModule = await import('get-port');
    const getPort = getPortModule.default;
    
    // Find a free port in the range 3000-3100 for the server
    return await getPort({ port: [...Array(101).keys()].map(i => i + 3000) });
  } catch (error) {
    console.error('Error finding free port:', error);
    // Return a fallback port if get-port fails
    return 3000;
  }
}

// Export the required state variables for other modules to use
export { activeServerList, activeServer };