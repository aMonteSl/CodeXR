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

    // ✅ USAR SOLO TreeItemType.START_SERVER
    super(
      'Start Local Server',
      'Start server in ' + currentMode + ' mode\nSelect an HTML file to serve',
      TreeItemType.START_SERVER, // ✅ Usar siempre el mismo tipo
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexr.startServerWithConfig',
        title: 'Start Server'
      },
      new vscode.ThemeIcon('play')
    );
    
    this.description = description;
    
    // ✅ MANEJAR EL WARNING A TRAVÉS DE PROPIEDADES
    if (currentMode === ServerMode.HTTPS_DEFAULT_CERTS && !defaultCertsExist) {
      this.iconPath = new vscode.ThemeIcon('warning');
      this.description = "⚠️ " + description;
    }
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
      TreeItemType.SERVERS_CONTAINER, // Usar la constante en lugar de la cadena literal
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
    // ✅ USE CUSTOM NAME IF IT'S AN XR ANALYSIS (including DOM visualization)
    const displayName = serverInfo.analysisFileName 
      ? `${serverInfo.analysisFileName}: ${serverInfo.port}`
      : path.basename(serverInfo.filePath);
    
    // ✅ CUSTOM DESCRIPTION FOR XR ANALYSIS (including DOM visualization)  
    const description = serverInfo.analysisFileName
      ? `XR Analysis - ${serverInfo.protocol.toUpperCase()}`
      : serverInfo.url;
    
    const tooltip = serverInfo.analysisFileName
      ? `XR Analysis Server
File: ${serverInfo.analysisFileName}
Path: ${serverInfo.filePath}
URL: ${serverInfo.url}
Click to see options`
      : `${serverInfo.protocol.toUpperCase()} Server
Path: ${serverInfo.filePath}
URL: ${serverInfo.url}
Click to see options`;
    
    super(
      displayName,
      tooltip,
      TreeItemType.ACTIVE_SERVER,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexr.serverOptions',
        title: 'Server Options',
        arguments: [serverInfo]
      },
      // ✅ PURPLE ICON FOR XR ANALYSIS (including DOM visualization)
      serverInfo.analysisFileName 
        ? new vscode.ThemeIcon('beaker', new vscode.ThemeColor('charts.purple'))
        : new vscode.ThemeIcon(serverInfo.useHttps ? 'shield' : 'globe')
    );
    
    this.description = description;
    
    // ✅ DIFFERENT CONTEXT VALUE FOR XR ANALYSIS (including DOM visualization)
    this.contextValue = serverInfo.analysisFileName ? 'activeXRAnalysisServer' : 'activeServer';
  }
}

/**
 * Item to stop all servers when multiple servers are active
 */
export class StopAllServersItem extends TreeItem {
  constructor(serverCount: number) {
    super(
      `Stop All Servers (${serverCount})`,
      `Stop all ${serverCount} running servers at once`,
      TreeItemType.STOP_ALL_SERVERS,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexr.stopAllServersFromTree',
        title: 'Stop All Servers',
        arguments: [serverCount]
      },
      new vscode.ThemeIcon('debug-stop', new vscode.ThemeColor('list.errorForeground'))
    );
    
    // Mostrar descripción con el número de servidores
    this.description = `${serverCount} active`;
  }
}