import * as vscode from 'vscode';

export class LocalServerProvider implements vscode.TreeDataProvider<LocalServerItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<LocalServerItem | undefined | void> = new vscode.EventEmitter<LocalServerItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<LocalServerItem | undefined | void> = this._onDidChangeTreeData.event;

  getTreeItem(element: LocalServerItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: LocalServerItem): Thenable<LocalServerItem[]> {
    if (!element) {
      // Devuelve un único elemento que actúa como botón
      return Promise.resolve([new LocalServerItem()]);
    }
    return Promise.resolve([]);
  }
}

export class LocalServerItem extends vscode.TreeItem {
  constructor() {
    super('Iniciar Servidor Local', vscode.TreeItemCollapsibleState.None);
    this.tooltip = 'Haz clic para seleccionar un archivo index.html y arrancar el servidor';
    this.command = {
      command: 'first-vscode-extension.startLocalServer',
      title: 'Iniciar Servidor Local'
    };
    this.iconPath = new vscode.ThemeIcon('server');
  }
}
