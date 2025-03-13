import * as vscode from 'vscode';  // Importa la API de VS Code
import * as fs from 'fs';          // Para verificar archivos
import * as path from 'path';      // Para manejar rutas
import { getActiveServers, ServerInfo } from './server';

// Enumerado para los tipos de servidor disponibles
export enum ServerMode {
  HTTP = 'HTTP',
  HTTPS_DEFAULT_CERTS = 'HTTPS (certificados predeterminados)',
  HTTPS_CUSTOM_CERTS = 'HTTPS (certificados personalizados)'
}

/**
 * Clase que implementa el proveedor de datos para la vista de árbol (Tree View)
 */
export class LocalServerProvider implements vscode.TreeDataProvider<TreeItem> {
  // EventEmitter para notificar cambios en los datos
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | void> = 
    new vscode.EventEmitter<TreeItem | undefined | void>();
  
  // Evento que VS Code escucha para actualizar la vista
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | void> = 
    this._onDidChangeTreeData.event;
  
  // Contexto de la extensión para acceder al almacenamiento
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    
    // Inicializa con valores predeterminados si no existe configuración previa
    if (!this.context.globalState.get('serverMode')) {
      this.context.globalState.update('serverMode', ServerMode.HTTPS_DEFAULT_CERTS);
    }
  }

  /**
   * Refresca la vista del árbol
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Devuelve el elemento de UI para un item
   */
  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Obtiene los elementos hijos de un elemento o los elementos raíz
   */
  getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if (!element) {
      // Elementos raíz
      const currentMode = this.context.globalState.get<ServerMode>('serverMode') || 
        ServerMode.HTTPS_DEFAULT_CERTS;
      
      // Comprueba si existen certificados predeterminados
      const extensionPath = this.context.extensionPath;
      const keyPath = path.join(extensionPath, 'certs', 'babia_key.pem');
      const certPath = path.join(extensionPath, 'certs', 'babia_cert.pem');
      const defaultCertsExist = fs.existsSync(keyPath) && fs.existsSync(certPath);
      
      // Obtener los servidores activos
      const activeServers = getActiveServers();
      
      const rootItems: TreeItem[] = [
        new ServerConfigItem(this.context, currentMode),
        new StartServerItem(currentMode, defaultCertsExist)
      ];
      
      // Si hay servidores activos, añadir el contenedor de servidores
      if (activeServers.length > 0) {
        rootItems.push(new ActiveServersContainer(activeServers.length));
      }
      
      return Promise.resolve(rootItems);
    }
    
    // Si el elemento es de configuración, devuelve opciones
    if (element instanceof ServerConfigItem && element.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
      return Promise.resolve([
        new ServerModeItem(ServerMode.HTTP, this.context),
        new ServerModeItem(ServerMode.HTTPS_DEFAULT_CERTS, this.context),
        new ServerModeItem(ServerMode.HTTPS_CUSTOM_CERTS, this.context)
      ]);
    }
    
    // Si el elemento es el contenedor de servidores activos, devuelve la lista de servidores
    if (element instanceof ActiveServersContainer) {
      const activeServers = getActiveServers();
      return Promise.resolve(
        activeServers.map(server => new ActiveServerItem(server))
      );
    }
    
    return Promise.resolve([]);
  }

  /**
   * Cambia el modo de servidor
   */
  async changeServerMode(mode: ServerMode): Promise<void> {
    if (mode === ServerMode.HTTP) {
      // Advertir sobre limitaciones en dispositivos VR
      const selection = await vscode.window.showWarningMessage(
        'El modo HTTP no es compatible con dispositivos de realidad virtual debido a restricciones de seguridad. ' +
        '¿Desea continuar?',
        'Sí, entiendo', 'Cancelar'
      );
      
      if (selection !== 'Sí, entiendo') {
        return;
      }
    }
    
    // Guardar el modo seleccionado
    await this.context.globalState.update('serverMode', mode);
    this.refresh();
  }
}

/**
 * Clase base para los elementos del árbol
 */
abstract class TreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }
}

/**
 * Elemento para iniciar el servidor
 */
class StartServerItem extends TreeItem {
  constructor(currentMode: ServerMode, defaultCertsExist: boolean) {
    super('Iniciar Servidor Local', vscode.TreeItemCollapsibleState.None);
    
    // Determine el tipo de descripción según el modo actual
    let description: string;
    switch(currentMode) {
      case ServerMode.HTTP:
        description = "Modo HTTP (sin certificados)";
        break;
      case ServerMode.HTTPS_DEFAULT_CERTS:
        description = defaultCertsExist 
          ? "HTTPS con certificados predeterminados" 
          : "⚠️ Certificados predeterminados no encontrados";
        break;
      case ServerMode.HTTPS_CUSTOM_CERTS:
        description = "HTTPS con certificados personalizados";
        break;
    }
    
    this.description = description;
    
    // Establece el tooltip según el modo
    this.tooltip = 'Iniciar servidor en modo ' + currentMode + 
      '\nSelecciona un archivo HTML para servir';
    
    // Define el comando al hacer clic
    this.command = {
      command: 'integracionvsaframe.startServerWithConfig',
      title: 'Iniciar Servidor'
    };
    
    // Establece el icono
    this.iconPath = new vscode.ThemeIcon('server');
    
    // Contexto para colorear el elemento en caso de advertencia
    this.contextValue = currentMode === ServerMode.HTTPS_DEFAULT_CERTS && !defaultCertsExist 
      ? 'warning' : undefined;
  }
}

/**
 * Elemento para la configuración del servidor
 */
class ServerConfigItem extends TreeItem {
  constructor(context: vscode.ExtensionContext, currentMode: ServerMode) {
    super('Configuración del servidor', vscode.TreeItemCollapsibleState.Collapsed);
    
    this.description = currentMode;
    this.tooltip = 'Configuración para el servidor local';
    this.iconPath = new vscode.ThemeIcon('gear');
  }
}

/**
 * Elemento para cada modo de servidor disponible
 */
class ServerModeItem extends TreeItem {
  constructor(mode: ServerMode, context: vscode.ExtensionContext) {
    super(mode, vscode.TreeItemCollapsibleState.None);
    
    const currentMode = context.globalState.get<ServerMode>('serverMode');
    
    // Si es el modo actual, marcarlo como seleccionado
    if (mode === currentMode) {
      this.description = '✓ Seleccionado';
    }
    
    // Establece tooltip explicativo según el modo
    switch (mode) {
      case ServerMode.HTTP:
        this.tooltip = 'Usar HTTP simple (sin cifrado)\n⚠️ No funciona con dispositivos VR';
        this.iconPath = new vscode.ThemeIcon('globe');
        break;
      case ServerMode.HTTPS_DEFAULT_CERTS:
        this.tooltip = 'Usar HTTPS con los certificados incluidos en la extensión';
        this.iconPath = new vscode.ThemeIcon('shield');
        break;
      case ServerMode.HTTPS_CUSTOM_CERTS:
        this.tooltip = 'Usar HTTPS con certificados personalizados (deberás seleccionarlos)';
        this.iconPath = new vscode.ThemeIcon('key');
        break;
    }
    
    // Define el comando al hacer clic para cambiar el modo
    this.command = {
      command: 'integracionvsaframe.changeServerMode',
      title: 'Cambiar modo de servidor',
      arguments: [mode]
    };
  }
}

// Añadir nuevas clases de elementos para los servidores activos
class ActiveServersContainer extends TreeItem {
  constructor(count: number) {
    super(`Servidores Activos (${count})`, vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon('server-environment');
    this.contextValue = 'serverContainer';
    this.tooltip = 'Servidores actualmente en ejecución';
  }
}

class ActiveServerItem extends TreeItem {
  constructor(private serverInfo: ServerInfo) {
    super(path.basename(serverInfo.filePath), vscode.TreeItemCollapsibleState.None);
    
    this.description = serverInfo.url;
    this.tooltip = `Servidor ${serverInfo.protocol.toUpperCase()} 
Ruta: ${serverInfo.filePath}
URL: ${serverInfo.url}
Haz clic para ver opciones`;
    
    this.iconPath = new vscode.ThemeIcon(
      serverInfo.useHttps ? 'shield' : 'globe'
    );
    
    this.contextValue = 'activeServer';
    
    // Al hacer clic en el servidor, mostrará opciones
    this.command = {
      command: 'integracionvsaframe.serverOptions',
      title: 'Opciones del Servidor',
      arguments: [serverInfo]
    };
  }
}
