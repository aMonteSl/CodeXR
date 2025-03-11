import * as vscode from 'vscode';  // Importa la API de VS Code para acceder a sus funcionalidades

/**
 * Clase que implementa el proveedor de datos para la vista de árbol (Tree View)
 * Esta clase es responsable de proporcionar los elementos que se mostrarán
 * en el panel lateral de la extensión
 */
export class LocalServerProvider implements vscode.TreeDataProvider<LocalServerItem> {
  // EventEmitter que notifica a VS Code cuando los datos del árbol han cambiado
  // y es necesario refrescar la vista
  private _onDidChangeTreeData: vscode.EventEmitter<LocalServerItem | undefined | void> = new vscode.EventEmitter<LocalServerItem | undefined | void>();
  
  // Evento que VS Code escucha para saber cuándo actualizar la vista
  readonly onDidChangeTreeData: vscode.Event<LocalServerItem | undefined | void> = this._onDidChangeTreeData.event;

  /**
   * Devuelve el elemento de UI que se mostrará para cada item del árbol
   * @param element - El item para el que se debe generar un TreeItem
   */
  getTreeItem(element: LocalServerItem): vscode.TreeItem {
    return element;  // Simplemente devuelve el elemento, ya que LocalServerItem ya extiende TreeItem
  }

  /**
   * Obtiene los hijos de un elemento, o los elementos raíz si no se proporciona ningún elemento
   * @param element - Elemento padre opcional del cual obtener los hijos
   */
  getChildren(element?: LocalServerItem): Thenable<LocalServerItem[]> {
    if (!element) {
      // Si no hay elemento (estamos en la raíz), devolvemos un único elemento que funciona como botón
      return Promise.resolve([new LocalServerItem()]);
    }
    // Si se proporciona un elemento, no mostramos hijos (estructura plana)
    return Promise.resolve([]);
  }
}

/**
 * Clase que representa un elemento en la vista de árbol
 * En este caso, representa un botón para iniciar el servidor local
 */
export class LocalServerItem extends vscode.TreeItem {
  constructor() {
    // Inicializa el elemento con el texto "Iniciar Servidor Local" y sin posibilidad de expandirse
    super('Iniciar Servidor Local', vscode.TreeItemCollapsibleState.None);
    
    // Establece un tooltip que aparece al pasar el ratón sobre el elemento
    this.tooltip = 'Haz clic para seleccionar un archivo index.html y arrancar el servidor';
    
    // Define el comando que se ejecutará al hacer clic en este elemento
    this.command = {
      command: 'first-vscode-extension.startLocalServer',  // ID del comando a ejecutar
      title: 'Iniciar Servidor Local'  // Título del comando
    };
    
    // Establece un icono de servidor del conjunto de iconos del tema de VS Code
    this.iconPath = new vscode.ThemeIcon('server');
  }
}
