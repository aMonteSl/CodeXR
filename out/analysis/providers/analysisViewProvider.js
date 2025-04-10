"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisViewProvider = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Provides a webview for displaying code analysis results
 */
class AnalysisViewProvider {
    _extensionUri;
    static viewType = 'codexr.analysisView';
    _view;
    _pendingAnalysis;
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
        console.log('AnalysisViewProvider constructor called');
    }
    /**
     * Called when the view is initially created
     */
    resolveWebviewView(webviewView, context, _token) {
        console.log('AnalysisViewProvider.resolveWebviewView called');
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        console.log('Webview HTML set, view should be visible now');
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(message => {
            console.log('Received message from webview:', message);
            switch (message.command) {
                case 'showDetails':
                    // Show details for a specific file
                    this._showFileDetails(message.filePath);
                    return;
            }
        });
        // Si hay análisis pendientes, enviarlos al webview después de inicializar
        setTimeout(() => {
            if (this._pendingAnalysis && this._view) {
                console.log('Sending pending analysis to initialized webview');
                this._view.webview.postMessage({
                    command: this._pendingAnalysis.type === 'file' ? 'showFileAnalysis' : 'showProjectAnalysis',
                    analysis: this._pendingAnalysis.data
                });
                this._pendingAnalysis = undefined;
            }
        }, 500);
    }
    /**
     * Display results for a single file analysis
     */
    showFileAnalysis(analysis) {
        console.log('showFileAnalysis called, view exists:', !!this._view);
        if (this._view) {
            console.log('Sending file analysis to webview');
            this._view.webview.postMessage({
                command: 'showFileAnalysis',
                analysis
            });
        }
        else {
            console.log('Storing analysis as pending for later display');
            // Guardar para mostrar cuando la vista esté disponible
            this._pendingAnalysis = {
                type: 'file',
                data: analysis
            };
            // En lugar de mostrar mensaje de error, intentar crear la vista
            this._createAnalysisPanel(analysis);
        }
    }
    /**
     * Display results for a project/directory analysis
     */
    showProjectAnalysis(analysis) {
        console.log('showProjectAnalysis called, view exists:', !!this._view);
        if (this._view) {
            console.log('Sending project analysis to webview');
            this._view.webview.postMessage({
                command: 'showProjectAnalysis',
                analysis
            });
        }
        else {
            console.log('Storing analysis as pending for later display');
            // Guardar para mostrar cuando la vista esté disponible
            this._pendingAnalysis = {
                type: 'project',
                data: analysis
            };
            // En lugar de mostrar mensaje de error, intentar crear un panel
            this._createAnalysisPanel(analysis);
        }
    }
    /**
     * Show results in a webview panel if the view is not available
     */
    _createAnalysisPanel(analysis) {
        // Crear un panel webview como alternativa
        const panel = vscode.window.createWebviewPanel('jsAnalysisPanel', 'JavaScript Analysis Results', vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        });
        // Generar HTML similar al de la vista
        panel.webview.html = this._getHtmlForWebview(panel.webview);
        // Enviar datos de análisis al panel
        setTimeout(() => {
            const isFileAnalysis = 'fileName' in analysis;
            panel.webview.postMessage({
                command: isFileAnalysis ? 'showFileAnalysis' : 'showProjectAnalysis',
                analysis
            });
        }, 500);
    }
    /**
     * Open a file in the editor and highlight it
     */
    _showFileDetails(filePath) {
        vscode.workspace.openTextDocument(filePath).then(doc => {
            vscode.window.showTextDocument(doc);
        });
    }
    /**
     * Generate the HTML for the webview
     */
    _getHtmlForWebview(webview) {
        // Get the local path to scripts and styles
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'analysis', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'analysis', 'style.css'));
        const nonce = this._getNonce();
        return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
      <link href="${styleUri}" rel="stylesheet">
      <title>Code Analysis</title>
    </head>
    <body>
      <div id="app">
        <div class="header">
          <h1>Code Analysis</h1>
          <p class="subtitle">Select a file or directory to analyze</p>
        </div>
        
        <div id="no-data" class="message">
          <p>No analysis data to display yet. Run an analysis to see results here.</p>
        </div>
        
        <div id="results" class="hidden">
          <div id="summary" class="section">
            <h2>Summary</h2>
            <div class="metrics-grid">
              <div class="metric">
                <div class="metric-value" id="total-lines">0</div>
                <div class="metric-label">Total Lines</div>
              </div>
              <div class="metric">
                <div class="metric-value" id="code-lines">0</div>
                <div class="metric-label">Code Lines</div>
              </div>
              <div class="metric">
                <div class="metric-value" id="comment-lines">0</div>
                <div class="metric-label">Comment Lines</div>
              </div>
              <div class="metric">
                <div class="metric-value" id="blank-lines">0</div>
                <div class="metric-label">Blank Lines</div>
              </div>
              <div class="metric">
                <div class="metric-value" id="function-count">0</div>
                <div class="metric-label">Functions</div>
              </div>
              <div class="metric">
                <div class="metric-value" id="class-count">0</div>
                <div class="metric-label">Classes</div>
              </div>
            </div>
          </div>
          
          <div id="files-section" class="section hidden">
            <h2>Files</h2>
            <div id="files-list" class="files-list"></div>
          </div>
        </div>
      </div>
      
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
    }
    /**
     * Generate a nonce for script security
     */
    _getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
exports.AnalysisViewProvider = AnalysisViewProvider;
//# sourceMappingURL=analysisViewProvider.js.map