import * as vscode from 'vscode';
import * as path from 'path';
import { startServer, stopServer, getActiveServers } from './server';
import { LocalServerProvider } from './treeProvider';
import { 
  ChartType, 
  ChartData 
} from './models/chartModel';
import { ServerMode, ServerInfo } from './models/serverModel';
import { 
  createBabiaXRVisualization, 
  launchBabiaXRVisualization,
  collectChartData,
  collectChartOptions
} from './babiaxrManager';

/**
 * This function is executed when the extension is activated
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "integracionvsaframe" is now active.');

  // Register tree data provider for the unified view
  const treeDataProvider = new LocalServerProvider(context);

  // Register tree view
  const treeView = vscode.window.createTreeView('aframeExplorerView', {
    treeDataProvider: treeDataProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);

  // COMMAND REGISTRATION
  // ===================

  // View Management Commands
  // -----------------------
  
  // Command to refresh the view
  const refreshViewCommand = vscode.commands.registerCommand(
    'integracionvsaframe.refreshView', 
    () => treeDataProvider.refresh()
  );
  
  // Server Configuration Commands
  // ---------------------------
  
  // Command to change server mode
  const changeServerModeCommand = vscode.commands.registerCommand(
    'integracionvsaframe.changeServerMode', 
    (mode: ServerMode) => treeDataProvider.changeServerMode(mode)
  );

  // Command to start server with current configuration
  const startServerWithConfigCommand = vscode.commands.registerCommand(
    'integracionvsaframe.startServerWithConfig', 
    async () => {
      const currentMode = context.globalState.get<ServerMode>('serverMode') || 
        ServerMode.HTTPS_DEFAULT_CERTS;
      
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
        const useHttps = currentMode !== ServerMode.HTTP;
        const useDefaultCerts = currentMode === ServerMode.HTTPS_DEFAULT_CERTS;
        
        // Start server with selected configuration
        await startServer(selectedFile, context, useHttps, useDefaultCerts);
      } catch (error) {
        vscode.window.showErrorMessage(`Error starting server: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // Legacy command to start server (maintains compatibility)
  const startServerCommand = vscode.commands.registerCommand(
    'integracionvsaframe.startLocalServer', 
    async () => {
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
      } catch (error) {
        vscode.window.showErrorMessage(`Error starting server: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // Command to stop server
  const stopServerCommand = vscode.commands.registerCommand(
    'integracionvsaframe.stopLocalServer', 
    (serverId?: string) => {
      stopServer(serverId);
      treeDataProvider.refresh();
    }
  );

  // Server Management Commands
  // -------------------------
  
  // Command to show options for an active server
  const serverOptionsCommand = vscode.commands.registerCommand(
    'integracionvsaframe.serverOptions',
    async (serverInfo: ServerInfo) => {
      try {
        const selection = await vscode.window.showQuickPick(
          [
            { label: '$(globe) Open in Browser', id: 'open' },
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
        } else if (selection.id === 'stop') {
          stopServer(serverInfo.id);
          treeDataProvider.refresh();
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error executing server action: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
  
  // Command for status bar actions
  const serverStatusActionsCommand = vscode.commands.registerCommand(
    'integracionvsaframe.serverStatusActions',
    async () => {
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
    }
  );

  // BabiaXR Visualization Commands
  // ----------------------------
  
  // Command to create a BabiaXR visualization
  const createBabiaXRVisualizationCommand = vscode.commands.registerCommand(
    'integracionvsaframe.createBabiaXRVisualization',
    async (chartType: ChartType) => {
      try {
        // Collect chart data from user
        const chartData = await collectChartData(chartType);
        if (!chartData) return;
        
        // Collect chart-specific options
        const options = await collectChartOptions(chartType);
        if (!options) return;
        
        // Generate visualization
        const filePath = await createBabiaXRVisualization(chartType, chartData, context);
        
        if (filePath) {
          // Ask if user wants to launch server
          const launchServer = await vscode.window.showInformationMessage(
            'Visualization created successfully. Do you want to start the server to view it?',
            'Yes', 'No'
          );
          
          if (launchServer === 'Yes') {
            await launchBabiaXRVisualization(filePath, context);
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error creating visualization: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // Register all commands
  context.subscriptions.push(
    // View commands
    refreshViewCommand,
    
    // Server configuration commands
    changeServerModeCommand,
    startServerWithConfigCommand,
    startServerCommand,
    stopServerCommand,
    
    // Server management commands
    serverOptionsCommand,
    serverStatusActionsCommand,
    
    // BabiaXR commands
    createBabiaXRVisualizationCommand
  );
}

/**
 * This function is executed when the extension is deactivated
 */
export function deactivate() {
  stopServer(); // Ensure all servers are stopped when extension is deactivated
}
