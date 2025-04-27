import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { loadTemplate, generateNonce } from '../../utils/templateUtils';

/**
 * Panel is deprecated as analysis functionality has been removed
 */
export async function createAnalysisPanel(
  extensionUri: vscode.Uri,
  analysis: any
): Promise<vscode.WebviewPanel> {
  // Create webview panel
  const panel = vscode.window.createWebviewPanel(
    'jsAnalysisPanel',
    'CodeXR Panel',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [extensionUri]
    }
  );

  // Set simple content since analysis functionality has been removed
  panel.webview.html = `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CodeXR</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
      .message { text-align: center; margin-top: 100px; }
    </style>
  </head>
  <body>
    <div class="message">
      <h1>CodeXR</h1>
      <p>Analysis functionality has been removed.</p>
    </div>
  </body>
  </html>`;

  return panel;
}