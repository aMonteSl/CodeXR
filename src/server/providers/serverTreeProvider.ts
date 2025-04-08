import * as vscode from 'vscode';
import * as path from 'path';
import { getActiveServers } from '../serverManager';
import { ServerMode, ServerInfo } from '../models/serverModel';
import { defaultCertificatesExist } from '../certificateManager';
import { TreeItem } from '../../ui/treeItems/baseItems';
import { TreeItemType } from '../../ui/treeProvider';
import { 
  ServerConfigItem, 
  ServerModeItem, 
  StartServerItem, 
  ActiveServersContainer, 
  ActiveServerItem 
} from '../../ui/treeItems/serverItems';

/**
 * Provider for server-related tree items
 */
export class ServerTreeProvider {
  /**
   * Constructor for the Server Tree Provider
   * @param context Extension context for storage
   */
  constructor(private readonly context: vscode.ExtensionContext) {}
  
  /**
   * Gets child elements of the servers section
   * @returns Tree items for servers section
   */
  public getServersChildren(): Thenable<TreeItem[]> {
    const currentMode = this.context.globalState.get<ServerMode>('serverMode') || 
      ServerMode.HTTPS_DEFAULT_CERTS;
    
    const defaultCertsExist = defaultCertificatesExist(this.context);
    const activeServers = getActiveServers();
    
    const children: TreeItem[] = [
      new ServerConfigItem(this.context, currentMode),
      new StartServerItem(currentMode, defaultCertsExist)
    ];
    
    if (activeServers.length > 0) {
      children.push(new ActiveServersContainer(activeServers.length));
    }
    
    return Promise.resolve(children);
  }
  
  /**
   * Gets server configuration options
   * @returns Tree items for server configuration
   */
  public getServerConfigChildren(): Thenable<TreeItem[]> {
    const currentMode = this.context.globalState.get<ServerMode>('serverMode');
    return Promise.resolve([
      new ServerModeItem(ServerMode.HTTP, this.context),
      new ServerModeItem(ServerMode.HTTPS_DEFAULT_CERTS, this.context),
      new ServerModeItem(ServerMode.HTTPS_CUSTOM_CERTS, this.context)
    ]);
  }
  
  /**
   * Gets the list of active servers
   * @returns Tree items for active servers
   */
  public getActiveServersChildren(): Thenable<TreeItem[]> {
    const activeServers = getActiveServers();
    return Promise.resolve(
      activeServers.map(server => new ActiveServerItem(server))
    );
  }
  
  /**
   * Creates a section item for servers
   * @returns Section tree item for servers
   */
  public getServersSectionItem(): TreeItem {
    return new TreeItem(
      "Servers", 
      "Local server management", 
      TreeItemType.SERVERS_SECTION,
      vscode.TreeItemCollapsibleState.Expanded,
      undefined,
      new vscode.ThemeIcon('server-environment')
    );
  }
  
  /**
   * Changes the server mode
   * @param mode New server mode to set
   * @returns Promise that resolves when mode is changed
   */
  public async changeServerMode(mode: ServerMode): Promise<void> {
    console.log('Changing server mode to:', mode);
    
    if (mode === ServerMode.HTTP) {
      const selection = await vscode.window.showWarningMessage(
        'HTTP mode is not compatible with virtual reality devices due to security restrictions. ' +
        'Do you want to continue?',
        'Yes, I understand', 'Cancel'
      );
      
      if (selection !== 'Yes, I understand') {
        return;
      }
    }
    
    // Si el usuario selecciona el modo de certificados personalizados,
    // pedir inmediatamente que seleccione los archivos
    if (mode === ServerMode.HTTPS_CUSTOM_CERTS) {
      try {
        // Diálogo para seleccionar el archivo de clave privada
        const keyOptions: vscode.OpenDialogOptions = {
          canSelectMany: false,
          openLabel: 'Select private key file (.key or .pem)',
          filters: { 'Certificates': ['key', 'pem'] }
        };
        
        console.log('Showing key file picker dialog...');
        const keyUri = await vscode.window.showOpenDialog(keyOptions);
        console.log('Key file picker result:', keyUri);
        
        if (!keyUri || keyUri.length === 0) {
          vscode.window.showWarningMessage('No private key file was selected. Mode change cancelled.');
          return;
        }
        
        // Diálogo para seleccionar el archivo de certificado
        const certOptions: vscode.OpenDialogOptions = {
          canSelectMany: false,
          openLabel: 'Select certificate file (.cert or .pem)',
          filters: { 'Certificates': ['cert', 'pem', 'crt'] }
        };
        
        console.log('Showing certificate file picker dialog...');
        const certUri = await vscode.window.showOpenDialog(certOptions);
        console.log('Certificate file picker result:', certUri);
        
        if (!certUri || certUri.length === 0) {
          vscode.window.showWarningMessage('No certificate file was selected. Mode change cancelled.');
          return;
        }
        
        // Guardar las rutas de los archivos seleccionados en el contexto
        await this.context.globalState.update('customKeyPath', keyUri[0].fsPath);
        await this.context.globalState.update('customCertPath', certUri[0].fsPath);
        
        vscode.window.showInformationMessage(
          'Custom certificates have been configured. The server will use these certificates when started.'
        );
      } catch (error) {
        console.error('Error selecting certificates:', error);
        vscode.window.showErrorMessage(
          `Error selecting certificates: ${error instanceof Error ? error.message : String(error)}`
        );
        return;
      }
    }
    
    // Actualizar el modo en el contexto global
    await this.context.globalState.update('serverMode', mode);
    console.log('Server mode updated to:', mode);
  }
}