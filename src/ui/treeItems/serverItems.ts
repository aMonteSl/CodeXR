import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TreeItem } from './baseItems';
import { TreeItemType } from '../treeProvider';
import { ServerMode, ServerInfo } from '../../server/models/serverModel';

/**
 * Item to start the server
 */
export class StartServerItem extends TreeItem {
  constructor(currentMode: ServerMode, defaultCertsExist: boolean) {
    // Determine description type based on current mode
    let description: string;
    switch(currentMode) {
      case ServerMode.HTTP:
        description = "HTTP mode (no certificates)";
        break;
      case ServerMode.HTTPS_DEFAULT_CERTS:
        description = defaultCertsExist 
          ? "HTTPS with default certificates" 
          : "⚠️ Default certificates not found";
        break;
      case ServerMode.HTTPS_CUSTOM_CERTS:
        description = "HTTPS with custom certificates";
        break;
    }

    // Determine the initial contextValue based on conditions
    const initialContextValue = currentMode === ServerMode.HTTPS_DEFAULT_CERTS && !defaultCertsExist 
      ? 'warning' 
      : TreeItemType.START_SERVER;
    
    super(
      'Start Local Server',
      'Start server in ' + currentMode + ' mode\nSelect an HTML file to serve',
      initialContextValue,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexr.startServerWithConfig',
        title: 'Start Server'
      },
      new vscode.ThemeIcon('play')
    );
    
    this.description = description;
  }
}

/**
 * Item for server configuration
 */
export class ServerConfigItem extends TreeItem {
  constructor(context: vscode.ExtensionContext, currentMode: ServerMode) {
    super(
      'Server Configuration',
      'Configuration for the local server',
      TreeItemType.SERVER_CONFIG,
      vscode.TreeItemCollapsibleState.Collapsed,
      undefined,
      new vscode.ThemeIcon('gear')
    );
    
    this.description = currentMode;
  }
}

/**
 * Item for each available server mode
 */
export class ServerModeItem extends TreeItem {
  constructor(mode: ServerMode, context: vscode.ExtensionContext) {
    const currentMode = context.globalState.get<ServerMode>('serverMode');
    
    let tooltip: string;
    let iconPath: vscode.ThemeIcon;
    
    // Set explanatory tooltip based on mode
    switch (mode) {
      case ServerMode.HTTP:
        tooltip = 'Use simple HTTP (no encryption)\n⚠️ Does not work with VR devices';
        iconPath = new vscode.ThemeIcon('globe');
        break;
      case ServerMode.HTTPS_DEFAULT_CERTS:
        tooltip = 'Use HTTPS with certificates included in the extension';
        iconPath = new vscode.ThemeIcon('shield');
        break;
      case ServerMode.HTTPS_CUSTOM_CERTS:
        tooltip = 'Use HTTPS with custom certificates (you will need to select them)';
        iconPath = new vscode.ThemeIcon('key');
        break;
    }
    
    super(
      mode,
      tooltip,
      TreeItemType.SERVER_MODE,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexr.changeServerMode',
        title: 'Change server mode',
        arguments: [mode]
      },
      iconPath
    );
    
    // If it's the current mode, mark as selected
    if (mode === currentMode) {
      this.description = '✓ Selected';
    }
  }
}

/**
 * Item for the active servers container
 */
export class ActiveServersContainer extends TreeItem {
  constructor(count: number) {
    super(
      `Active Servers (${count})`,
      'Currently running servers',
      'serverContainer', // Use this string directly instead of TreeItemType.SERVERS_CONTAINER
      vscode.TreeItemCollapsibleState.Expanded,
      undefined,
      new vscode.ThemeIcon('server-environment')
    );
  }
}

/**
 * Item for an active server
 */
export class ActiveServerItem extends TreeItem {
  constructor(serverInfo: ServerInfo) {
    super(
      path.basename(serverInfo.filePath),
      `${serverInfo.protocol.toUpperCase()} Server
Path: ${serverInfo.filePath}
URL: ${serverInfo.url}
Click to see options`,
      TreeItemType.ACTIVE_SERVER,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexr.serverOptions',
        title: 'Server Options',
        arguments: [serverInfo]
      },
      new vscode.ThemeIcon(serverInfo.useHttps ? 'shield' : 'globe')
    );
    
    this.description = serverInfo.url;
  }
}