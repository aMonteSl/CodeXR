import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { loadTemplate, generateNonce } from '../../utils/templateUtils';

/**
 * Manages a panel that displays code analysis results
 */
export class AnalysisPanel {
  public static currentPanel: AnalysisPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _analysisResult: any;
  private _disposables: vscode.Disposable[] = [];

  /**
   * Creates or shows the analysis panel
   */
  public static create(extensionUri: vscode.Uri, analysisResult: any): AnalysisPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : vscode.ViewColumn.One;

    // If we already have a panel, show it
    if (AnalysisPanel.currentPanel) {
      AnalysisPanel.currentPanel._panel.reveal(column);
      AnalysisPanel.currentPanel._update(analysisResult);
      return AnalysisPanel.currentPanel;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'jsAnalysisPanel',
      'CodeXR Analysis',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
        retainContextWhenHidden: true
      }
    );

    AnalysisPanel.currentPanel = new AnalysisPanel(panel, extensionUri, analysisResult);
    return AnalysisPanel.currentPanel;
  }

  /**
   * Update existing panel with new analysis data
   */
  public static update(analysisResult: any): void {
    console.log('AnalysisPanel.update called with new data');
    if (AnalysisPanel.currentPanel) {
      AnalysisPanel.currentPanel._update(analysisResult);
    } else {
      console.log('No panel exists, creating a new one');
      const extensionUri = vscode.extensions.getExtension('yourPublisher.codexr')?.extensionUri;
      if (extensionUri) {
        AnalysisPanel.create(extensionUri, analysisResult);
      } else {
        console.error('Could not get extension URI for panel creation');
      }
    }
  }

  /**
   * Private constructor for the AnalysisPanel class
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, analysisResult: any) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._analysisResult = analysisResult;

    // Set the webview's initial html content
    this._update(analysisResult);

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'refresh':
            this._update(this._analysisResult);
            return;
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Updates the content of the panel with new analysis data
   */
  private _update(analysisResult: any): void {
    const panel = this._panel;
    this._analysisResult = analysisResult;
    
    // Generate content for the panel
    panel.title = 'CodeXR Analysis';
    panel.webview.html = this._getHtmlForWebview(panel.webview, analysisResult);
    
    console.log('Panel updated with latest analysis data');
  }

  /**
   * Generates the HTML content for the analysis panel
   */
  private _getHtmlForWebview(webview: vscode.Webview, analysisResult: any): string {
    // Generate nonce for content security policy
    const nonce = generateNonce();

    // Try to format the analysis result for display
    let formattedResult = '<p>No analysis data available</p>';
    
    if (analysisResult) {
      try {
        // Convert analysis result to a formatted display
        formattedResult = `<pre>${JSON.stringify(analysisResult, null, 2)}</pre>`;
      } catch (error) {
        formattedResult = `<p>Error formatting analysis data: ${error}</p>`;
      }
    }

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CodeXR Analysis</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: var(--vscode-foreground); }
        h1 { color: var(--vscode-editor-foreground); border-bottom: 1px solid var(--vscode-panel-border); }
        pre { background-color: var(--vscode-editor-background); padding: 10px; overflow: auto; }
        .analysis-container { margin-top: 20px; }
        button { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 12px; cursor: pointer; }
        button:hover { background-color: var(--vscode-button-hoverBackground); }
      </style>
    </head>
    <body>
      <h1>CodeXR Analysis Results</h1>
      <button id="refreshBtn">Refresh</button>
      <div class="analysis-container">
        ${formattedResult}
      </div>
      
      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        document.getElementById('refreshBtn').addEventListener('click', () => {
          vscode.postMessage({ command: 'refresh' });
        });
      </script>
    </body>
    </html>`;
  }

  /**
   * Cleans up resources when the panel is closed
   */
  public dispose(): void {
    AnalysisPanel.currentPanel = undefined;

    // Clean up resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  /**
   * Helper function for backwards compatibility
   */
  public static async createAnalysisPanel(
    extensionUri: vscode.Uri,
    analysis: any
  ): Promise<vscode.WebviewPanel> {
    const panel = AnalysisPanel.create(extensionUri, analysis);
    return panel._panel;
  }
}

// Add this for backwards compatibility
export async function createAnalysisPanel(
  extensionUri: vscode.Uri,
  analysis: any
): Promise<vscode.WebviewPanel> {
  return AnalysisPanel.createAnalysisPanel(extensionUri, analysis);
}