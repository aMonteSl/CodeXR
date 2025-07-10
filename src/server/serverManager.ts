import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import { ServerInfo, ActiveServerEntry, ServerMode } from './models/serverModel';

// Fix 1: Use relative path from src root to avoid module resolution issues
import { getCertificates, defaultCertificatesExist } from '../server/certificateManager';
import { createRequestHandler } from '../server/requestHandler';
import { notifyClients } from '../server/liveReloadManager';
import { updateStatusBar, disposeStatusBar } from '../ui/statusBarManager';
import { portManager } from './portManager';
import { AnalysisSessionManager, AnalysisType } from '../analysis/analysisSessionManager';

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
  try {
    console.log(`🚀 Starting server for: ${selectedFile}`);
    console.log(`🔧 HTTPS: ${useHttps}, Default certs: ${useDefaultCerts}`);
    
    // Determine mode based on parameters
    let mode: ServerMode;
    if (!useHttps) {
      mode = ServerMode.HTTP;
    } else if (useDefaultCerts) {
      mode = ServerMode.HTTPS_DEFAULT_CERTS;
    } else {
      mode = ServerMode.HTTPS_CUSTOM_CERTS;
    }
    
    // Use unified createServer function
    const serverInfo = await createServer(selectedFile, mode, context);
    
    if (serverInfo) {
      console.log(`✅ Server started successfully: ${serverInfo.url}`);
      
      // Show initial notification with options
      vscode.window.showInformationMessage(
        `${serverInfo.protocol.toUpperCase()} server running at ${serverInfo.displayUrl}`,
        'Open in browser', 'Stop server'
      ).then(selection => {
        if (selection === 'Open in browser') {
          vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
        } else if (selection === 'Stop server') {
          stopServer(serverInfo.id);
        }
      });
      
      // Update status bar
      updateStatusBar(serverInfo);
      
      // Automatically open the browser
      vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
    } else {
      throw new Error('Failed to create server');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error starting server:`, error);
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
    const serverToStop = activeServer;
    
    console.log(`🛑 Stopping active server:`, {
      id: serverToStop.info.id,
      url: serverToStop.info.url,
      analysisFileName: serverToStop.info.analysisFileName
    });
    
    serverToStop.server.close(() => {
      console.log(`✅ Active server closed: ${serverToStop.info.url}`);
    });
    
    // ✅ Remove analysis session if this server was used for analysis
    const sessionManager = AnalysisSessionManager.getInstance();
    const activeSessions = sessionManager.getAllSessions();
    const analysisSession = activeSessions.find(session => 
      (session.analysisType === AnalysisType.XR || 
       session.analysisType === AnalysisType.DOM || 
       session.analysisType === AnalysisType.DIRECTORY) && 
      session.filePath === serverToStop.info.filePath
    );
    if (analysisSession) {
      console.log(`🗑️ Removing ${analysisSession.analysisType} analysis session for: ${analysisSession.filePath}`);
      sessionManager.removeSession(analysisSession.id);
    }
    
    // Remove from the active servers list
    const index = activeServerList.findIndex(entry => entry.info.id === serverToStop.info.id);
    if (index !== -1) {
      activeServerList.splice(index, 1);
      console.log(`🧹 Removed server from active list: ${serverToStop.info.id}`);
    }
    
    // Clear active server reference
    activeServer = activeServerList.length > 0 ? activeServerList[activeServerList.length - 1] : undefined;
    
  } else if (serverId) {
    // Close specific server by ID
    const serverEntry = activeServerList.find(entry => entry.info.id === serverId);
    
    if (serverEntry) {
      console.log(`🛑 Stopping specific server:`, {
        id: serverEntry.info.id,
        url: serverEntry.info.url,
        analysisFileName: serverEntry.info.analysisFileName
      });
      
      serverEntry.server.close(() => {
        console.log(`✅ Specific server closed: ${serverEntry.info.url}`);
      });
      
      // ✅ Remove analysis session if this server was used for analysis
      const sessionManager = AnalysisSessionManager.getInstance();
      const activeSessions = sessionManager.getAllSessions();
      
      // Find matching analysis session using multiple strategies
      const analysisSession = activeSessions.find(session => {
        // Strategy 1: Direct file path match (for regular servers)
        if (session.filePath === serverEntry.info.filePath) {
          return true;
        }
        
        // Strategy 2: For XR analyses, match by analysis file name
        if ((session.analysisType === AnalysisType.XR || 
             session.analysisType === AnalysisType.DOM || 
             (session.analysisType === AnalysisType.DIRECTORY && session.metadata?.visualizationType === 'xr')) &&
            serverEntry.info.analysisFileName) {
          
          // For file XR analysis
          if (session.analysisType === AnalysisType.XR) {
            const sessionFileName = path.basename(session.filePath, path.extname(session.filePath));
            return serverEntry.info.analysisFileName === sessionFileName ||
                   serverEntry.info.analysisFileName.includes(sessionFileName);
          }
          
          // For directory XR analysis
          if (session.analysisType === AnalysisType.DIRECTORY && serverEntry.info.analysisFileName.startsWith('DIR:')) {
            const sessionDirName = path.basename(session.filePath);
            const serverDirName = serverEntry.info.analysisFileName.substring(4); // Remove 'DIR:' prefix
            return sessionDirName === serverDirName;
          }
        }
        
        return false;
      });
      if (analysisSession) {
        console.log(`🗑️ Removing ${analysisSession.analysisType} analysis session for: ${analysisSession.filePath}`);
        sessionManager.removeSession(analysisSession.id);
      }
      
      // Remove from list
      const index = activeServerList.findIndex(entry => entry.info.id === serverId);
      if (index !== -1) {
        activeServerList.splice(index, 1);
        console.log(`🧹 Removed server from active list: ${serverId}`);
      }
      
      // Update active server reference
      if (activeServer && activeServer.info.id === serverId) {
        activeServer = activeServerList.length > 0 ? activeServerList[activeServerList.length - 1] : undefined;
      }
    } else {
      console.warn(`⚠️ Server ${serverId} not found for stopping`);
    }
  }
  
  // ✅ UPDATE: Always refresh UI after stopping servers
  vscode.commands.executeCommand('codexr.refreshTreeView');
  
  // Update status bar
  if (activeServerList.length === 0) {
    console.log(`📊 All servers stopped, updating status bar`);
  } else if (activeServer) {
    console.log(`📊 ${activeServerList.length} servers remaining, active: ${activeServer.info.url}`);
  }
}

/**
 * Main unified function for creating servers
 * Creates and starts a server using the unified port manager
 */
export async function createServer(
  rootPath: string, 
  mode: ServerMode = ServerMode.HTTP, 
  context: vscode.ExtensionContext,
  preferredPort?: number
): Promise<ServerInfo | undefined> {
  try {
    console.log(`🚀 Creating server for: ${rootPath}`);
    console.log(`🔧 Mode: ${mode}, Preferred port: ${preferredPort || 'auto'}`);
    
    // Determine protocol based on mode
    const useHttps = mode !== ServerMode.HTTP;
    const protocol = useHttps ? 'https' : 'http';
    const useDefaultCerts = mode === ServerMode.HTTPS_DEFAULT_CERTS;
    
    // Find free port with port manager
    const serverPort = await portManager.findFreePort(preferredPort, protocol);
    console.log(`✅ Port manager assigned port: ${serverPort} for ${protocol.toUpperCase()}`);

    // Determine the file to serve
    let fileToServe = rootPath;
    const stats = fs.statSync(rootPath);
    if (stats.isDirectory()) {
      fileToServe = path.join(rootPath, 'index.html');
    }

    const fileDir = path.dirname(fileToServe);
    const requestHandler = createRequestHandler(fileDir, fileToServe);

    // Create server based on mode
    let server: http.Server | https.Server;

    if (useHttps) {
      const { key, cert } = await getCertificates(context, useDefaultCerts);
      server = https.createServer({ key, cert }, requestHandler);
    } else {
      server = http.createServer(requestHandler);
    }

    // Promise with robust port handling
    return new Promise<ServerInfo | undefined>((resolve) => {
      // Reserve port before starting server
      portManager.reservePort(
        serverPort, 
        'HTTP/HTTPS Server', 
        `Serving ${path.basename(fileToServe)}`,
        protocol
      );
      
      server.listen(serverPort, () => {
        const serverProtocol = useHttps ? 'https' : 'http';
        const filename = path.basename(fileToServe, path.extname(fileToServe));
        const serverUrl = `${serverProtocol}://localhost:${serverPort}`;
        const displayUrl = `${serverProtocol}://${filename}:${serverPort}`;
        const serverId = `server-${Date.now()}`;
        
        // Create server info
        const serverInfo: ServerInfo = {
          id: serverId,
          url: serverUrl,
          displayUrl: displayUrl,
          protocol: serverProtocol,
          port: serverPort,
          filePath: fileToServe,
          useHttps,
          startTime: Date.now()
          // analysisFileName will be set later if needed
        };

        // Add to active servers
        const serverEntry: ActiveServerEntry = { server, info: serverInfo };
        activeServerList.push(serverEntry);
        
        // Update activeServer
        activeServer = serverEntry;
        
        // Set up cleanup function
        const cleanup = () => {
          console.log(`🧹 Cleaning up server on port ${serverPort}`);
          server.close();
          portManager.releasePort(serverPort);
          activeServerList = activeServerList.filter(entry => entry.info.id !== serverId);
          
          // Update activeServer reference
          if (activeServer && activeServer.info.id === serverId) {
            activeServer = activeServerList.length > 0 ? 
              activeServerList[activeServerList.length - 1] : undefined;
          }
        };

        // Register cleanup
        context.subscriptions.push({ dispose: cleanup });
        
        // Set up file watchers
        // Verify files exist before setting up watchers
        
        // Set up file watchers ONLY if files exist
        let htmlWatcher: fs.FSWatcher | undefined;
        let jsonWatcher: fs.FSWatcher | undefined;
        
        // Only set up HTML watcher if file exists
        if (fs.existsSync(fileToServe)) {
          console.log(`📁 Setting up HTML file watcher for: ${fileToServe}`);
          try {
            htmlWatcher = fs.watch(fileToServe, () => {
              console.log(`📁 HTML file changed: ${fileToServe}`);
              notifyClients();
            });
          } catch (error) {
            console.warn(`⚠️ Could not set up HTML file watcher: ${error}`);
          }
        } else {
          console.log(`⚠️ HTML file does not exist, skipping watcher: ${fileToServe}`);
        }
        
        // Only set up directory watcher if directory exists
        if (fs.existsSync(fileDir)) {
          console.log(`📁 Setting up directory watcher for: ${fileDir}`);
          try {
            jsonWatcher = fs.watch(fileDir, (eventType, filename) => {
              if (filename && (filename.endsWith('.json') || filename.endsWith('.csv'))) {
                console.log(`📁 Data file changed: ${filename} (${eventType})`);
                console.log(`📁 Full path: ${path.join(fileDir, filename)}`);
                console.log(`📁 Event type: ${eventType}`);

                // Skip watcher for data.json files (they are managed by FileWatchManager)
                if (filename === 'data.json') {
                  console.log(`📁 Skipping server watcher for data.json - managed by FileWatchManager`);
                  return;
                }
                
                setTimeout(() => {
                  console.log(`📡 Sending notification for ${filename}...`);
                  notifyClients();
                  
                  // Also send specific dataRefresh event
                  const { notifyClientsDataRefresh } = require('./liveReloadManager');
                  notifyClientsDataRefresh();
                  
                  console.log(`📡 Both generic and dataRefresh events sent for ${filename}`);
                }, 300);
              }
            });
          } catch (error) {
            console.warn(`⚠️ Could not set up directory watcher: ${error}`);
          }
        } else {
          console.log(`⚠️ Directory does not exist, skipping watcher: ${fileDir}`);
        }
        
        // Improved cleanup
        server.on('close', () => {
          try {
            if (htmlWatcher) {
              htmlWatcher.close();
              console.log('📁 HTML file watcher closed');
            }
          } catch (error) {
            console.warn('Warning: Error closing HTML watcher:', error);
          }
          
          try {
            if (jsonWatcher) {
              jsonWatcher.close();
              console.log('📁 Directory watcher closed');
            }
          } catch (error) {
            console.warn('Warning: Error closing directory watcher:', error);
          }
        });
        
        console.log(`✅ Server started successfully on port ${serverPort}`);
        vscode.commands.executeCommand('codexr.refreshView');
        
        resolve(serverInfo);
      });
      
      // Enhanced error handling
      server.on('error', (err: any) => {
        console.error(`❌ Server error on port ${serverPort}:`, err);
        
        // Release port on error
        portManager.releasePort(serverPort);
        
        if (err.code === 'EADDRINUSE') {
          vscode.window.showErrorMessage(
            `Port ${serverPort} is already in use. The Port Manager will try a different port on next attempt.`
          );
        } else {
          vscode.window.showErrorMessage(`Error starting server: ${err.message}`);
        }
        
        resolve(undefined);
      });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error creating server:`, error);
    vscode.window.showErrorMessage(`Error creating server: ${errorMessage}`);
    return undefined;
  }
}

/**
 * Get port status for UI display
 */
export async function getServerPortStatus() {
  return await portManager.getPortStatus();
}

/**
 * Function to stop all servers
 */
export function stopAllServers(): void {
  console.log(`🛑 Stopping all ${activeServerList.length} servers`);
  
  const serversToStop = [...activeServerList]; // Copy to avoid modifications during iteration
  
  serversToStop.forEach(serverEntry => {
    stopServer(serverEntry.info.id);
  });
  
  // Clear references
  activeServerList = [];
  activeServer = undefined;
  
  console.log('✅ All servers stopped');
}

/**
 * ✅ ENHANCED: Updates server info for analysis servers with better tracking
 * @param serverId Server ID to update
 * @param updates Partial server info updates
 * @returns true if server was found and updated, false otherwise
 */
export function updateServerDisplayInfo(serverId: string, updates: Partial<ServerInfo>): boolean {
  const serverEntry = activeServerList.find(entry => entry.info.id === serverId);
  
  if (serverEntry) {
    // ✅ UPDATE: Apply all updates to server info
    Object.assign(serverEntry.info, updates);
    
    console.log(`✅ Updated server info for ${serverId}:`, {
      url: serverEntry.info.url,
      displayUrl: serverEntry.info.displayUrl,
      analysisFileName: serverEntry.info.analysisFileName,
      filePath: serverEntry.info.filePath
    });
    
    // ✅ UPDATE: Update active server reference if this is the active one
    if (activeServer && activeServer.info.id === serverId) {
      activeServer = serverEntry;
    }
    
    // ✅ UPDATE: Refresh tree view to show changes
    const treeDataProvider = (global as any).treeDataProvider;
    if (treeDataProvider && typeof treeDataProvider.refresh === 'function') {
      treeDataProvider.refresh();
    }
    
    return true;
  } else {
    console.warn(`⚠️ Server ${serverId} not found for update`);
    return false;
  }
}

// Export the required state variables for other modules to use
export { activeServerList, activeServer };