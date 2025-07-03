import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { generateNonce } from '../../utils/nonceUtils';

interface FunctionAnalysisData {
  function: {
    name: string;
    lineStart: number;
    lineEnd: number;
    lineCount: number;
    complexity: number;
    parameters: number;
    cyclomaticDensity?: number;
    maxNestingDepth?: number;
    tokenCount?: number;
  };
  fileName: string;
  filePath: string;
  language: string;
}

/**
 * Manages a panel that displays detailed function analysis
 */
export class FunctionAnalysisPanel {
  public static currentPanel: FunctionAnalysisPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _functionData: FunctionAnalysisData;
  private _disposables: vscode.Disposable[] = [];

  /**
   * Creates or shows the function analysis panel
   */
  public static create(extensionUri: vscode.Uri, functionData: FunctionAnalysisData): FunctionAnalysisPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : vscode.ViewColumn.Two;

    // If we already have a panel, show it
    if (FunctionAnalysisPanel.currentPanel) {
      FunctionAnalysisPanel.currentPanel._panel.reveal(column);
      FunctionAnalysisPanel.currentPanel._update(functionData);
      return FunctionAnalysisPanel.currentPanel;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'functionAnalysisPanel',
      `Function: ${functionData.function.name}`,
      column || vscode.ViewColumn.Two,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
        retainContextWhenHidden: true
      }
    );

    FunctionAnalysisPanel.currentPanel = new FunctionAnalysisPanel(panel, extensionUri, functionData);
    return FunctionAnalysisPanel.currentPanel;
  }

  /**
   * Constructor
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, functionData: FunctionAnalysisData) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._functionData = functionData;

    // Set the webview's initial html content
    this._update(functionData);

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'backToFileAnalysis':
            // Close this panel to go back to file analysis
            this.dispose();
            return;
          case 'openInEditor':
            this._openInEditor(message.data);
            return;
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Updates the content of the panel with new function data
   */
  private _update(functionData: FunctionAnalysisData): void {
    const panel = this._panel;
    this._functionData = functionData;
    
    // Update panel title
    panel.title = `Function: ${functionData.function.name}`;
    panel.webview.html = this._getHtmlForWebview(panel.webview, functionData);
    
    console.log('Function analysis panel updated for:', functionData.function.name);
  }

  /**
   * Generates the HTML content for the function analysis panel
   */
  private _getHtmlForWebview(webview: vscode.Webview, functionData: FunctionAnalysisData): string {
    // Generate nonce for content security policy
    const nonce = generateNonce();

    try {
      // Read the function analysis template
      const templatePath = path.join(this._extensionUri.fsPath, 'templates', 'analysis', 'functionAnalysis.html');
      let template = fs.readFileSync(templatePath, 'utf-8');
      
      // Get resource URIs
      const styleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, 'media', 'analysis', 'functionAnalysisstyle.css')
      );
      const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, 'media', 'analysis', 'functionAnalysismain.js')
      );

      // Replace template variables
      template = template.replace(/\$\{webview\.cspSource\}/g, webview.cspSource);
      template = template.replace(/\$\{nonce\}/g, nonce);
      template = template.replace(/\$\{styleUri\}/g, styleUri.toString());
      template = template.replace(/\$\{scriptUri\}/g, scriptUri.toString());

      // Inject function data and additional analysis
      const analysisResult = this._generateAnalysisResult(functionData);
      const dataScript = `
        <script nonce="${nonce}">
          window.functionData = ${JSON.stringify(analysisResult)};
        </script>
      `;

      // Insert the data script before the closing </body> tag
      template = template.replace('</body>', dataScript + '</body>');

      return template;
    } catch (error) {
      console.error('Error generating function analysis HTML:', error);
      return `
        <html>
          <body>
            <h1>Error</h1>
            <p>Unable to load function analysis template: ${error}</p>
          </body>
        </html>
      `;
    }
  }

  /**
   * Generates analysis result with recommendations and complexity category
   */
  private _generateAnalysisResult(functionData: FunctionAnalysisData): any {
    const complexity = functionData.function.complexity || 0;
    const lineCount = functionData.function.lineCount || 0;
    const parameters = functionData.function.parameters || 0;
    
    // Determine complexity category
    let complexityCategory = 'Unknown';
    if (complexity <= 5) {
      complexityCategory = 'Simple';
    } else if (complexity <= 10) {
      complexityCategory = 'Moderate';
    } else if (complexity <= 20) {
      complexityCategory = 'Complex';
    } else {
      complexityCategory = 'Very Complex';
    }

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (complexity > 10) {
      recommendations.push('Consider breaking this function into smaller, more focused functions.');
    }
    
    if (parameters > 5) {
      recommendations.push('Consider reducing the number of parameters by using objects or data structures.');
    }
    
    if (lineCount > 50) {
      recommendations.push('This function is quite long. Consider splitting it into smaller functions.');
    }
    
    if (complexity > 20) {
      recommendations.push('This function has very high complexity. It may be difficult to test and maintain.');
    }
    
    if (functionData.function.maxNestingDepth && functionData.function.maxNestingDepth > 4) {
      recommendations.push('Deep nesting detected. Consider using early returns or extracting nested logic.');
    }

    if (recommendations.length === 0) {
      recommendations.push('This function looks well-structured with reasonable complexity.');
    }

    return {
      ...functionData,
      complexityCategory,
      recommendations
    };
  }

  /**
   * Opens the function in the editor at the specified line
   */
  private async _openInEditor(data: { filePath: string; lineNumber: number }): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(data.filePath);
      const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
      
      // Go to the specified line
      const position = new vscode.Position(Math.max(0, data.lineNumber - 1), 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
      
    } catch (error) {
      console.error('Error opening file in editor:', error);
      vscode.window.showErrorMessage(`Failed to open file: ${error}`);
    }
  }

  /**
   * Cleans up resources when the panel is closed
   */
  public dispose(): void {
    FunctionAnalysisPanel.currentPanel = undefined;

    // Clean up resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
