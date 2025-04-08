import * as vscode from 'vscode';
import * as path from 'path';
import { LocalServerProvider } from '../ui/treeProvider';
import { ServerMode, ServerInfo } from '../server/models/serverModel';
import { startServer, stopServer, getActiveServers, createServer } from '../server/serverManager';
import { defaultCertificatesExist } from '../server/certificateManager';

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
    vscode.commands.registerCommand('integracionvsaframe.changeServerMode', 
      (mode: ServerMode) => treeDataProvider.changeServerMode(mode)
    )
  );

  // Command to start server with current configuration
  disposables.push(
    vscode.commands.registerCommand('integracionvsaframe.startServerWithConfig', async () => {
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
    vscode.commands.registerCommand('integracionvsaframe.startLocalServer', async () => {
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
    vscode.commands.registerCommand('integracionvsaframe.stopLocalServer', (serverId?: string) => {
      stopServer(serverId);
      treeDataProvider.refresh();
    })
  );

  // Command to show options for an active server
  disposables.push(
    vscode.commands.registerCommand('integracionvsaframe.serverOptions', async (serverInfo: ServerInfo) => {
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
    vscode.commands.registerCommand('integracionvsaframe.serverStatusActions', async () => {
      try {
        const activeServers = getActiveServers();
        
        if (activeServers.length === 0) {
          vscode.window.showInformationMessage('No active servers');
          return;
        }
        
        // If there's only one server, show options directly
        if (activeServers.length === 1) {
          vscode.commands.executeCommand('integracionvsaframe.serverOptions', activeServers[0]);
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
          vscode.commands.executeCommand('integracionvsaframe.serverOptions', selected.server);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error showing server status: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  // Command to check certificate status
  disposables.push(
    vscode.commands.registerCommand('integracionvsaframe.checkCertificates', async () => {
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
    vscode.commands.registerCommand('integracionvsaframe.stopAllServers', async () => {
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

  // Command to launch a BabiaXR example with server
  disposables.push(
    vscode.commands.registerCommand('integracionvsaframe.launchBabiaXRExample', async (examplePath: string) => {
      try {
        if (!examplePath) {
          vscode.window.showErrorMessage('No example path provided');
          return;
        }
        
        // Check if file exists
        if (!vscode.workspace.fs.stat(vscode.Uri.file(examplePath))) {
          vscode.window.showErrorMessage(`Example file not found: ${examplePath}`);
          return;
        }
        
        // Open the file in the editor first
        await vscode.window.showTextDocument(vscode.Uri.file(examplePath));
        
        // Ask if user wants to launch server
        const launchServer = await vscode.window.showInformationMessage(
          'Do you want to start the server to view this example?',
          'Yes', 'No'
        );
        
        if (launchServer === 'Yes') {
          // Create a server for this example
          const serverMode = context.globalState.get<ServerMode>('serverMode') || 
                          ServerMode.HTTPS_DEFAULT_CERTS;
          
          // Get the directory of the example rather than the file itself
          const exampleDir = path.dirname(examplePath);
          
          // Use the example directory as the working directory
          const serverInfo = await createServer(examplePath, serverMode, context);
          
          if (serverInfo) {
            // Open browser
            vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
            
            // Show confirmation
            vscode.window.showInformationMessage(
              `Server started at ${serverInfo.url}`
            );
            
            // Refresh the tree to show the new server
            treeDataProvider.refresh();
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error launching example: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );
  
  return disposables;
}
