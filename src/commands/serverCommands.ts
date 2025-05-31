import * as vscode from 'vscode';
import * as path from 'path';
import { LocalServerProvider } from '../ui/treeProvider';
// Fix the incorrect import path:
import { ServerMode, ServerInfo } from '../server/models/serverModel';
import { startServer, stopServer, getActiveServers, createServer } from '../server/serverManager';
import { defaultCertificatesExist } from '../server/certificateManager';
import { portManager } from '../server/portManager';


/**
 * Registers all server-related commands
 * @param context Extension context for storage
 * @param treeDataProvider The main tree data provider
 * @returns Array of disposables for registered commands
 */
export function registerServerCommands(
  context: vscode.ExtensionContext,
  treeDataProvider: LocalServerProvider
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];
  
  // Command to change server mode
  disposables.push(
    vscode.commands.registerCommand('codexr.changeServerMode', 
      (mode: ServerMode) => treeDataProvider.changeServerMode(mode)
    )
  );

  // Command to start server with current configuration
  disposables.push(
    vscode.commands.registerCommand('codexr.startServerWithConfig', async () => {
      const currentMode = context.globalState.get<ServerMode>('serverMode') || 
        ServerMode.HTTPS_DEFAULT_CERTS;
      
      // Add this diagnostic logging
      console.log('Current server mode:', currentMode);
      
      try {
        // Configure file picker for HTML files
        const options: vscode.OpenDialogOptions = {
          canSelectMany: false,
          openLabel: 'Select HTML File',
          filters: { 'HTML': ['html', 'htm'] }
        };

        // Show file picker dialog
        const fileUri = await vscode.window.showOpenDialog(options);
        if (!fileUri || fileUri.length === 0) {
          return;
        }

        // Get full path of selected file
        const selectedFile = fileUri[0].fsPath;
        
        // Define server mode based on configuration
        let useHttps = false;
        let useDefaultCerts = false;

        // Determine server modes correctly
        if (currentMode === ServerMode.HTTPS_DEFAULT_CERTS) {
          useHttps = true;
          useDefaultCerts = true;
        } else if (currentMode === ServerMode.HTTPS_CUSTOM_CERTS) {
          useHttps = true;
          useDefaultCerts = false;
        }
        
        // Add more diagnostic logging
        console.log('useHttps:', useHttps, 'useDefaultCerts:', useDefaultCerts);
        
        // Check for certificate existence if using default certs
        if (useHttps && useDefaultCerts && !defaultCertificatesExist(context)) {
          const warningResult = await vscode.window.showWarningMessage(
            'Default SSL certificates not found. Server will not work with VR headsets. ' +
            'Do you want to continue with HTTP instead?',
            'Use HTTP', 'Cancel'
          );
          
          if (warningResult === 'Use HTTP') {
            // Fall back to HTTP
            await startServer(selectedFile, context, false, false);
            treeDataProvider.refresh();
            return;
          }
          
          return;
        }

        // Start server with selected configuration
        await startServer(selectedFile, context, useHttps, useDefaultCerts);
        treeDataProvider.refresh();
      } catch (error) {
        console.error('Error in startServerWithConfig:', error);
        vscode.window.showErrorMessage(`Error starting server: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  // Legacy command to start server (maintains compatibility)
  disposables.push(
    vscode.commands.registerCommand('codexr.startLocalServer', async () => {
      try {
        // First, ask user if they want to use HTTPS
        const serverType = await vscode.window.showQuickPick(
          ['HTTP', 'HTTPS (requires certificates)'],
          { placeHolder: 'Select server type' }
        );
        
        if (!serverType) {
          return; // User cancelled the selection
        }

        const useHttps = serverType === 'HTTPS (requires certificates)';
        
        // If the user selected HTTPS, prompt for custom certificates
        if (useHttps) {
          // Dialog to select private key file
          const keyOptions: vscode.OpenDialogOptions = {
            canSelectMany: false,
            openLabel: 'Select private key file (.key or .pem)',
            filters: { 'Certificates': ['key', 'pem'] }
          };
          
          const keyUri = await vscode.window.showOpenDialog(keyOptions);
          if (!keyUri || keyUri.length === 0) {
            vscode.window.showWarningMessage('No private key file was selected. Server startup cancelled.');
            return;
          }
          
          // Dialog to select certificate file
          const certOptions: vscode.OpenDialogOptions = {
            canSelectMany: false,
            openLabel: 'Select certificate file (.cert or .pem)',
            filters: { 'Certificates': ['cert', 'pem', 'crt'] }
          };
          
          const certUri = await vscode.window.showOpenDialog(certOptions);
          if (!certUri || certUri.length === 0) {
            vscode.window.showWarningMessage('No certificate file was selected. Server startup cancelled.');
            return;
          }
          
          // Store selected certificate paths in context
          await context.globalState.update('customKeyPath', keyUri[0].fsPath);
          await context.globalState.update('customCertPath', certUri[0].fsPath);
        }
        
        // Configure file picker for HTML files
        const options: vscode.OpenDialogOptions = {
          canSelectMany: false,
          openLabel: 'Select HTML File',
          filters: { 'HTML': ['html', 'htm'] }
        };

        // Show file picker dialog
        const fileUri = await vscode.window.showOpenDialog(options);
        if (!fileUri || fileUri.length === 0) {
          return;
        }

        const selectedFile = fileUri[0].fsPath;
        await startServer(selectedFile, context, useHttps, false);
        treeDataProvider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`Error starting server: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  // Command to stop server
  disposables.push(
    vscode.commands.registerCommand('codexr.stopLocalServer', (serverId?: string) => {
      stopServer(serverId);
      treeDataProvider.refresh();
    })
  );

  // Command to show options for an active server
  disposables.push(
    vscode.commands.registerCommand('codexr.serverOptions', async (serverInfo: ServerInfo) => {
      try {
        const selection = await vscode.window.showQuickPick(
          [
            { label: '$(globe) Open in Browser', id: 'open' },
            { label: '$(file-binary) View Server Info', id: 'info' },
            { label: '$(stop) Stop Server', id: 'stop' }
          ],
          {
            placeHolder: `Server ${serverInfo.url}`,
            title: `Options for ${path.basename(serverInfo.filePath)}`
          }
        );
        
        if (!selection) {
          return;
        }
        
        if (selection.id === 'open') {
          vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
        } else if (selection.id === 'info') {
          // New functionality: Display detailed server info
          // Add null check for startTime
          const timeRunning = serverInfo.startTime 
            ? Math.floor((Date.now() - serverInfo.startTime) / 1000)
            : 0;
          const minutes = Math.floor(timeRunning / 60);
          const seconds = timeRunning % 60;
          
          const infoMessage = 
            `Server: ${serverInfo.url}\n` +
            `Protocol: ${serverInfo.protocol.toUpperCase()}\n` +
            `Port: ${serverInfo.port}\n` +
            `File: ${serverInfo.filePath}\n` +
            `Running time: ${minutes}m ${seconds}s`;
          
          vscode.window.showInformationMessage(infoMessage);
        } else if (selection.id === 'stop') {
          stopServer(serverInfo.id);
          treeDataProvider.refresh();
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error executing server action: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  // Command for server status actions
  disposables.push(
    vscode.commands.registerCommand('codexr.serverStatusActions', async () => {
      try {
        const activeServers = getActiveServers();
        
        if (activeServers.length === 0) {
          vscode.window.showInformationMessage('No active servers');
          return;
        }
        
        // If there's only one server, show options directly
        if (activeServers.length === 1) {
          vscode.commands.executeCommand('codexr.serverOptions', activeServers[0]);
          return;
        }
        
        // If there are multiple servers, show list to select
        const items = activeServers.map(server => ({
          label: path.basename(server.filePath),
          description: server.url,
          server: server
        }));
        
        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a server',
        });
        
        if (selected) {
          vscode.commands.executeCommand('codexr.serverOptions', selected.server);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error showing server status: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  // Command to check certificate status
  disposables.push(
    vscode.commands.registerCommand('codexr.checkCertificates', async () => {
      const certStatus = defaultCertificatesExist(context);
      if (certStatus) {
        vscode.window.showInformationMessage(
          'Default SSL certificates are present and ready to use for HTTPS servers.'
        );
      } else {
        const result = await vscode.window.showWarningMessage(
          'Default SSL certificates not found. HTTPS servers will not work properly without them.',
          'Generate Certificates', 'Learn More'
        );
        
        if (result === 'Learn More') {
          vscode.env.openExternal(vscode.Uri.parse(
            'https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Fundamentals#https'
          ));
        } else if (result === 'Generate Certificates') {
          // Certificate generation placeholder
          vscode.window.showInformationMessage(
            'Certificate generation will be implemented in a future update.'
          );
        }
      }
    })
  );

  // Command to stop all active servers
  disposables.push(
    vscode.commands.registerCommand('codexr.stopAllServers', async () => {
      try {
        const activeServers = getActiveServers();
        
        if (activeServers.length === 0) {
          vscode.window.showInformationMessage('No active servers to stop');
          return;
        }
        
        // Ask for confirmation if multiple servers are running
        if (activeServers.length > 1) {
          const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to stop all ${activeServers.length} running servers?`,
            'Yes', 'No'
          );
          
          if (confirm !== 'Yes') {
            return;
          }
        }
        
        // Stop each server one by one
        for (const server of activeServers) {
          stopServer(server.id);
        }
        
        vscode.window.showInformationMessage(`Stopped ${activeServers.length} servers successfully`);
        
        // Refresh the view
        treeDataProvider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error stopping servers: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  /**
   * Command to show port status
   */
  disposables.push(
    vscode.commands.registerCommand('codexr.showPortStatus', async () => {
      try {
        const status = await portManager.getPortStatus();
        
        const statusMessage = `Port Status (${status.range.start}-${status.range.end}):\n\n` +
          `🔒 Active Services (${status.managed.length}):\n` +
          status.managed.map(port => 
            `  • Port ${port.port}: ${port.service} - ${port.description}`
          ).join('\n') +
          `\n\n✅ Available Ports: ${status.available.length}/${status.total}\n` +
          `📋 Some available: ${status.available.slice(0, 10).join(', ')}${status.available.length > 10 ? '...' : ''}`;
        
        vscode.window.showInformationMessage(statusMessage, { modal: true });
      } catch (error) {
        vscode.window.showErrorMessage(`Error getting port status: ${error}`);
      }
    })
  );

  /**
   * Helper function to stop all servers
   */
  function stopAllServers(): void {
    const activeServers = getActiveServers();
    for (const server of activeServers) {
      stopServer(server.id);
    }
  }

  /**
   * Command to release all managed ports
   */
  disposables.push(
    vscode.commands.registerCommand('codexr.releaseAllPorts', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'This will stop all CodeXR servers and release all managed ports. Continue?',
        'Release All Ports',
        'Cancel'
      );
      
      if (confirm === 'Release All Ports') {
        // Stop all servers first
        stopAllServers();
        
        // Release all managed ports
        portManager.releaseAllPorts();
        
        vscode.window.showInformationMessage('All ports released successfully');
      }
    })
  );

  /**
   * Command to check specific port
   */
  disposables.push(
    vscode.commands.registerCommand('codexr.checkPort', async () => {
      const input = await vscode.window.showInputBox({
        prompt: 'Enter port number to check (3000-3100)',
        placeHolder: '3000',
        validateInput: (value) => {
          const port = parseInt(value);
          if (isNaN(port) || port < 3000 || port > 3100) {
            return 'Please enter a valid port number (3000-3100)';
          }
          return null;
        }
      });
      
      if (input) {
        const port = parseInt(input);
        
        if (portManager.isPortManaged(port)) {
          const activePorts = portManager.getActivePorts();
          const activePort = activePorts.find(p => p.port === port);
          vscode.window.showInformationMessage(
            `Port ${port} is managed by CodeXR:\n${activePort?.service} - ${activePort?.description}`
          );
        } else {
          try {
            const nextFree = await portManager.findFreePort(port);
            if (nextFree === port) {
              vscode.window.showInformationMessage(`✅ Port ${port} is available`);
            } else {
              vscode.window.showWarningMessage(
                `❌ Port ${port} is in use by another application.\nNext available port: ${nextFree}`
              );
            }
          } catch (error) {
            vscode.window.showErrorMessage(`Error checking port: ${error}`);
          }
        }
      }
    })
  );

  /**
   * Command to stop all servers from tree (with confirmation)
   */
  disposables.push(
    vscode.commands.registerCommand('codexr.stopAllServersFromTree', async (serverCount: number) => {
      try {
        const confirm = await vscode.window.showWarningMessage(
          `Are you sure you want to stop all ${serverCount} running servers?`,
          { modal: true },
          'Stop All Servers',
          'Cancel'
        );
        
        if (confirm === 'Stop All Servers') {
          const activeServers = getActiveServers();
          
          // Mostrar progreso mientras se detienen los servidores
          await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Stopping servers...",
            cancellable: false
          }, async (progress) => {
            const increment = 100 / activeServers.length;
            
            for (let i = 0; i < activeServers.length; i++) {
              const server = activeServers[i];
              progress.report({ 
                increment: increment, 
                message: `Stopping ${path.basename(server.filePath)} (${i + 1}/${activeServers.length})` 
              });
              
              stopServer(server.id);
              
              // Pequeña pausa para dar tiempo al cierre
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          });
          
          vscode.window.showInformationMessage(
            `✅ Successfully stopped ${serverCount} servers`,
            { modal: false }
          );
          
          // Refresh the view
          treeDataProvider.refresh();
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error stopping servers: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  /**
   * Command to debug server status
   */
  disposables.push(
    vscode.commands.registerCommand('codexr.debugServerStatus', async () => {
      const activeServers = getActiveServers();
      const portStatus = await portManager.getPortStatus();
      
      const debugInfo = `🔍 Server Debug Info:\n\n` +
        `Active Servers (${activeServers.length}):\n` +
        activeServers.map(server => 
          `  • ${server.id}: ${server.url} (port ${server.port})`
        ).join('\n') +
        `\n\nManaged Ports (${portStatus.managed.length}):\n` +
        portStatus.managed.map(port => 
          `  • Port ${port.port}: ${port.service} - ${port.description}`
        ).join('\n') +
        `\n\nAvailable Ports: ${portStatus.available.length}/${portStatus.total}`;
      
      console.log(debugInfo);
      vscode.window.showInformationMessage(debugInfo, { modal: true });
    })
  );

  return disposables;
}
