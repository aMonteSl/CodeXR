import * as vscode from 'vscode';
import { startServer } from './server';
import { LocalServerProvider } from './treeProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('La extensión "first-vscode-extension" está activa.');

  // Registro del comando para iniciar el servidor local
  const startServerCommand = vscode.commands.registerCommand('first-vscode-extension.startLocalServer', async () => {
    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      openLabel: 'Selecciona un archivo HTML',
      filters: { 'HTML': ['html', 'htm'] }
    };

    const fileUri = await vscode.window.showOpenDialog(options);
    if (!fileUri || fileUri.length === 0) {
      vscode.window.showErrorMessage('No se seleccionó ningún archivo HTML.');
      return;
    }

    const selectedFile = fileUri[0].fsPath;
    // Inicia el servidor pasando el archivo seleccionado y el contexto
    await startServer(selectedFile, context);
  });
  context.subscriptions.push(startServerCommand);

  // Registro del TreeDataProvider para la vista lateral
  const treeDataProvider = new LocalServerProvider();
  vscode.window.registerTreeDataProvider('localServerView', treeDataProvider);
}

export function deactivate() {}
