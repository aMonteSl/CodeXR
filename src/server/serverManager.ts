import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import * as fs from 'fs';
import { ServerInfo, ActiveServerEntry, ServerMode } from '../models/serverModel';

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
      vscode.commands.executeCommand('integracionvsaframe.refreshView');
      
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
  vscode.commands.executeCommand('integracionvsaframe.refreshView');
  
  // Update status bar using the new module
  if (activeServerList.length === 0) {
    disposeStatusBar();
  } else {
    updateStatusBar(activeServerList[activeServerList.length - 1].info);
  }
}

/**
 * Creates a server but returns the server info without opening a browser
 * Useful for programmatic server creation like example launching
 * 
 * @param filePath Path to HTML file to serve
 * @param mode The server mode to use
 * @param context Extension context
 * @returns ServerInfo object or undefined if server creation failed
 */
export async function createServer(
  filePath: string,
  mode: ServerMode,
  context: vscode.ExtensionContext
): Promise<ServerInfo | undefined> {
  try {
    // Extract server mode parameters
    const useHttps = mode !== ServerMode.HTTP;
    const useDefaultCerts = mode === ServerMode.HTTPS_DEFAULT_CERTS;
    
    // Get the directory where the selected HTML file is located
    const fileDir = path.dirname(filePath);

    // Find a free port
    const getPortModule = await import('get-port');
    const getPort = getPortModule.default;
    const port = await getPort({ port: [...Array(101).keys()].map(i => i + 3000) });

    // Create request handler
    const requestHandler = createRequestHandler(fileDir, filePath);

    // Create HTTP or HTTPS server based on the chosen option
    let server: http.Server | https.Server;

    if (useHttps) {
      const { key, cert } = await getCertificates(context, useDefaultCerts);
      server = https.createServer({ key, cert }, requestHandler);
    } else {
      server = http.createServer(requestHandler);
    }
    
    // Set up file watching for live reload
    const htmlWatcher = fs.watch(filePath, () => notifyClients());
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

    // Generate server info
    const protocol = useHttps ? 'https' : 'http';
    const filename = path.basename(filePath, path.extname(filePath));
    const serverUrl = `${protocol}://localhost:${port}`;
    const displayUrl = `${protocol}://${filename}:${port}`;
    const serverId = `server-${Date.now()}`;
    
    const serverInfo: ServerInfo = {
      id: serverId,
      url: serverUrl,
      displayUrl: displayUrl,
      protocol,
      port,
      filePath,
      useHttps,
      startTime: Date.now()
    };
    
    // Create server entry and start the server
    const serverEntry: ActiveServerEntry = {
      server,
      info: serverInfo
    };
    
    // Start the server and wait for it to be ready
    await new Promise<void>((resolve) => {
      server.listen(port, () => resolve());
    });
    
    // Add to active servers list
    activeServer = serverEntry;
    activeServerList.push(serverEntry);
    
    // Register cleanup for extension deactivation
    context.subscriptions.push({
      dispose: () => {
        server.close();
      }
    });
    
    // Notify that there's a new server to update the UI
    vscode.commands.executeCommand('integracionvsaframe.refreshView');
    
    return serverInfo;
  } catch (error) {
    vscode.window.showErrorMessage(
      `Error creating server: ${error instanceof Error ? error.message : String(error)}`
    );
    return undefined;
  }
}

// Export the required state variables for other modules to use
export { activeServerList, activeServer };