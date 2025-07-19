import * as vscode from 'vscode';
import * as path from 'path';
import { getPanelManager } from '../../active_servers/services/panelManager';

/**
 * Preview Renderer
 * Handles opening HTML content in browser or VS Code webview panel
 */
export class PreviewRenderer {
    
    /**
     * Open HTML content based on the specified mode
     * @param serverUrl - Server URL where the file is served 
     * @param htmlFilePath - Path to the HTML file (for reference/logging)
     * @param openMode - How to open ('browser' or 'lateralPanel')
     * @param serverId - Optional server ID for panel tracking (required for lateralPanel mode)
     */
    public static async openPreview(
        serverUrl: string,
        htmlFilePath: string, 
        openMode: 'browser' | 'lateralPanel',
        serverId?: string
    ): Promise<void> {
        console.log(`SERVER: Opening preview for ${htmlFilePath} at ${serverUrl} in ${openMode} mode`);
        
        try {
            if (openMode === 'browser') {
                await this.openInBrowser(serverUrl);
            } else if (openMode === 'lateralPanel') {
                if (!serverId) {
                    throw new Error('Server ID is required for lateral panel mode');
                }
                await this.openInWebviewPanel(serverUrl, htmlFilePath, serverId);
            } else {
                throw new Error(`Unsupported open mode: ${openMode}`);
            }
        } catch (error) {
            console.error(`SERVER: Error opening preview: ${error}`);
            vscode.window.showWarningMessage(`Failed to open preview: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Open URL in external browser
     * @private
     */
    private static async openInBrowser(serverUrl: string): Promise<void> {
        console.log(`SERVER: Opening ${serverUrl} in external browser`);
        await vscode.env.openExternal(vscode.Uri.parse(serverUrl));
        vscode.window.showInformationMessage(`Opened ${serverUrl} in browser`);
    }
    
    /**
     * Open server URL in VS Code webview panel using iframe
     * @private
     */
    private static async openInWebviewPanel(serverUrl: string, htmlFilePath: string, serverId: string): Promise<void> {
        console.log(`ACTIVE_SERVER_PANEL: Opening ${serverUrl} in VS Code webview panel for server ${serverId}`);
        
        try {
            const fileName = path.basename(htmlFilePath);
            
            // Create webview panel
            const panel = vscode.window.createWebviewPanel(
                'serverPreview',
                `Local Server Preview - ${fileName}`,
                vscode.ViewColumn.Two,
                {
                    enableScripts: true,
                    enableForms: true,
                    retainContextWhenHidden: true
                }
            );

            // Register panel with panel manager
            const panelManager = getPanelManager();
            panelManager.registerPanel(serverId, panel);
            console.log(`ACTIVE_SERVER_PANEL: Panel registered for server ${serverId}`);
            
            // Create iframe HTML pointing to the server URL
            const iframeHtml = this.createIframeHtml(serverUrl, fileName);
            
            // Set the HTML content
            panel.webview.html = iframeHtml;
            
            // Handle messages from webview
            panel.webview.onDidReceiveMessage(
                message => {
                    console.log(`ACTIVE_SERVER_PANEL: Webview message for server ${serverId}:`, message);
                    switch (message.command) {
                        case 'openExternal':
                            vscode.env.openExternal(vscode.Uri.parse(message.url));
                            break;
                        case 'showError':
                            vscode.window.showErrorMessage(message.text);
                            break;
                        case 'serverError':
                            vscode.window.showWarningMessage(`Server Error: ${message.text}`);
                            break;
                    }
                },
                undefined
            );
            
            // Handle panel disposal
            panel.onDidDispose(() => {
                console.log(`ACTIVE_SERVER_PANEL: Webview panel disposed for server ${serverId}`);
                // Panel manager will automatically clean up via its disposal listener
            });
            
            console.log(`SERVER: Created webview panel for ${serverUrl}`);
            vscode.window.showInformationMessage(`Opened ${fileName} in VS Code panel`);
            
        } catch (error) {
            console.error(`SERVER: Error creating webview panel: ${error}`);
            throw new Error(`Failed to create webview panel: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Create iframe HTML for embedding the server URL
     * @private
     */
    private static createIframeHtml(serverUrl: string, fileName: string): string {
        // Escape template literals in serverUrl for safe injection
        const escapedServerUrl = serverUrl.replace(/'/g, "\\'").replace(/"/g, '\\"');
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Local Server Preview - ${fileName}</title>
    <style>
        body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #1e1e1e;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .loading-container {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #cccccc;
            z-index: 1000;
        }
        
        .loading-spinner {
            border: 3px solid #333;
            border-top: 3px solid #007acc;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .error-container {
            display: none;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #f48771;
            background: #2d2d30;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #f48771;
            max-width: 80%;
        }
        
        .retry-button {
            background: #007acc;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 10px;
        }
        
        .retry-button:hover {
            background: #005a9e;
        }
        
        iframe {
            width: 100%;
            height: 100vh;
            border: none;
            display: none;
        }
        
        iframe.loaded {
            display: block;
        }
    </style>
</head>
<body>
    <div class="loading-container" id="loadingContainer">
        <div class="loading-spinner"></div>
        <div>Loading server content...</div>
        <div style="font-size: 12px; margin-top: 8px; opacity: 0.7;">${escapedServerUrl}</div>
    </div>
    
    <div class="error-container" id="errorContainer">
        <h3>⚠️ Connection Error</h3>
        <p>Could not load content from the local server.</p>
        <p style="font-size: 12px; opacity: 0.8;">URL: ${escapedServerUrl}</p>
        <button class="retry-button" onclick="reloadFrame()">Retry</button>
        <button class="retry-button" onclick="openInBrowser()" style="margin-left: 8px;">Open in Browser</button>
    </div>
    
    <iframe id="contentFrame" src="${escapedServerUrl}" title="Server Content"></iframe>
    
    <script>
        const iframe = document.getElementById('contentFrame');
        const loadingContainer = document.getElementById('loadingContainer');
        const errorContainer = document.getElementById('errorContainer');
        
        let loadTimeout;
        
        function showLoading() {
            loadingContainer.style.display = 'block';
            errorContainer.style.display = 'none';
            iframe.classList.remove('loaded');
        }
        
        function showContent() {
            loadingContainer.style.display = 'none';
            errorContainer.style.display = 'none';
            iframe.classList.add('loaded');
        }
        
        function showError() {
            loadingContainer.style.display = 'none';
            errorContainer.style.display = 'block';
            iframe.classList.remove('loaded');
        }
        
        function reloadFrame() {
            showLoading();
            iframe.src = iframe.src; // Reload
            setupLoadTimeout();
        }
        
        function openInBrowser() {
            if (typeof acquireVsCodeApi !== 'undefined') {
                const vscode = acquireVsCodeApi();
                vscode.postMessage({
                    command: 'openExternal',
                    url: '${escapedServerUrl}'
                });
            }
        }
        
        function setupLoadTimeout() {
            clearTimeout(loadTimeout);
            loadTimeout = setTimeout(() => {
                console.log('SERVER: Load timeout, showing error');
                showError();
            }, 10000); // 10 second timeout
        }
        
        iframe.addEventListener('load', () => {
            console.log('SERVER: Iframe loaded successfully');
            clearTimeout(loadTimeout);
            showContent();
        });
        
        iframe.addEventListener('error', () => {
            console.log('SERVER: Iframe load error');
            clearTimeout(loadTimeout);
            showError();
        });
        
        // Initial setup
        showLoading();
        setupLoadTimeout();
        
        // Send ready message to extension
        if (typeof acquireVsCodeApi !== 'undefined') {
            const vscode = acquireVsCodeApi();
            vscode.postMessage({
                command: 'webviewReady',
                url: '${escapedServerUrl}'
            });
        }
    </script>
</body>
</html>`;
    }
}
