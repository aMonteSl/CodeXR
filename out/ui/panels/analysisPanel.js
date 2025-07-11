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
exports.AnalysisPanel = void 0;
exports.createAnalysisPanel = createAnalysisPanel;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const nonceUtils_1 = require("../../utils/nonceUtils");
const functionAnalysisPanel_1 = require("./functionAnalysisPanel");
/**
 * Manages a panel that displays code analysis results
 */
class AnalysisPanel {
    static currentPanel;
    _panel;
    _extensionUri;
    _analysisResult;
    _disposables = [];
    /**
     * Creates or shows the analysis panel
     */
    static create(extensionUri, analysisResult) {
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
        const panel = vscode.window.createWebviewPanel('jsAnalysisPanel', 'CodeXR Analysis', column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [extensionUri],
            retainContextWhenHidden: true
        });
        AnalysisPanel.currentPanel = new AnalysisPanel(panel, extensionUri, analysisResult);
        return AnalysisPanel.currentPanel;
    }
    /**
     * Update existing panel with new analysis data
     */
    /**
     * Update the panel with new analysis data, using the correct extensionUri.
     * If no panel exists, creates one with the provided extensionUri.
     */
    static update(analysisResult, extensionUri) {
        console.log('AnalysisPanel.update called with new data');
        if (AnalysisPanel.currentPanel) {
            AnalysisPanel.currentPanel._update(analysisResult);
        }
        else {
            console.log('No panel exists, creating a new one');
            AnalysisPanel.create(extensionUri, analysisResult);
        }
    }
    /**
     * Private constructor for the AnalysisPanel class
     */
    constructor(panel, extensionUri, analysisResult) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._analysisResult = analysisResult;
        // Set the webview's initial html content
        this._update(analysisResult);
        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'refresh':
                    this._update(this._analysisResult);
                    return;
                case 'openFunctionDetails':
                    this._openFunctionDetails(message.data);
                    return;
            }
        }, null, this._disposables);
    }
    /**
     * Updates the content of the panel with new analysis data
     */
    _update(analysisResult) {
        const panel = this._panel;
        this._analysisResult = analysisResult;
        // Generate content for the panel
        panel.title = 'CodeXR Analysis';
        panel.webview.html = this._getHtmlForWebview(panel.webview, analysisResult);
        console.log('Panel updated with latest analysis data');
    }
    /**
     * Generates the HTML content for the analysis panel using the proper template
     */
    _getHtmlForWebview(webview, analysisResult) {
        // Generate nonce for content security policy
        const nonce = (0, nonceUtils_1.generateNonce)();
        try {
            // Read the static analysis template
            const templatePath = path.join(this._extensionUri.fsPath, 'templates', 'analysis', 'fileAnalysis.html');
            let template = fs.readFileSync(templatePath, 'utf-8');
            if (analysisResult) {
                // Replace template variables with actual data
                template = template.replace(/\{\{fileName\}\}/g, analysisResult.fileName || 'Unknown');
                template = template.replace(/\{\{filePath\}\}/g, analysisResult.filePath || 'Unknown');
                template = template.replace(/\{\{language\}\}/g, analysisResult.language || 'Unknown');
                template = template.replace(/\{\{fileSize\}\}/g, analysisResult.fileSize || 'Unknown');
                template = template.replace(/\{\{totalLines\}\}/g, (analysisResult.totalLines || 0).toString());
                template = template.replace(/\{\{codeLines\}\}/g, (analysisResult.codeLines || 0).toString());
                template = template.replace(/\{\{commentLines\}\}/g, (analysisResult.commentLines || 0).toString());
                template = template.replace(/\{\{blankLines\}\}/g, (analysisResult.blankLines || 0).toString());
                template = template.replace(/\{\{functionCount\}\}/g, (analysisResult.functionCount || 0).toString());
                template = template.replace(/\{\{classCount\}\}/g, (analysisResult.classCount || 0).toString());
                template = template.replace(/\{\{timestamp\}\}/g, analysisResult.timestamp || new Date().toLocaleString());
                // Replace complexity metrics
                const complexity = analysisResult.complexity || {};
                template = template.replace(/\{\{averageComplexity\}\}/g, (complexity.averageComplexity || 0).toFixed(2));
                template = template.replace(/\{\{maxComplexity\}\}/g, (complexity.maxComplexity || 0).toString());
                template = template.replace(/\{\{highComplexityFunctions\}\}/g, (complexity.highComplexityFunctions || 0).toString());
                template = template.replace(/\{\{criticalComplexityFunctions\}\}/g, (complexity.criticalComplexityFunctions || 0).toString());
                // Generate functions table HTML
                let functionsTableHTML = '';
                if (analysisResult.functions && analysisResult.functions.length > 0) {
                    functionsTableHTML = analysisResult.functions.map((func) => `
            <tr>
              <td>${func.name || 'Unknown'}</td>
              <td>${func.lineStart || 0}</td>
              <td>${func.lineEnd || 0}</td>
              <td>${func.lineCount || 0}</td>
              <td>${func.parameters || 0}</td>
              <td class="complexity-${this.getComplexityClass(func.complexity || 0)}">${func.complexity || 0}</td>
              <td>${func.cyclomaticDensity ? func.cyclomaticDensity.toFixed(2) : '0.00'}</td>
            </tr>
          `).join('');
                }
                else {
                    functionsTableHTML = '<tr><td colspan="7">No functions found</td></tr>';
                }
                template = template.replace(/\{\{functionsTable\}\}/g, functionsTableHTML);
            }
            // Replace nonce and CSP
            template = template.replace(/\{\{nonce\}\}/g, nonce);
            template = template.replace(/\$\{webview\.cspSource\}/g, webview.cspSource);
            // Get the stylesheet URI
            const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'analysis', 'fileAnalysisstyle.css'));
            template = template.replace(/\$\{styleUri\}/g, styleUri.toString());
            return template;
        }
        catch (error) {
            console.error('Error loading analysis template:', error);
            // Fallback to simple HTML
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
          .error { color: var(--vscode-errorForeground); }
        </style>
      </head>
      <body>
        <h1>CodeXR Analysis Results</h1>
        <div class="error">Error loading template: ${error instanceof Error ? error.message : String(error)}</div>
        <pre>${JSON.stringify(analysisResult, null, 2)}</pre>
      </body>
      </html>`;
        }
    }
    /**
     * Get CSS class for complexity level
     */
    getComplexityClass(complexity) {
        if (complexity <= 5) {
            return 'low';
        }
        if (complexity <= 10) {
            return 'medium';
        }
        if (complexity <= 20) {
            return 'high';
        }
        return 'critical';
    }
    /**
     * Opens a function details panel for the specified function
     */
    async _openFunctionDetails(data) {
        try {
            console.log('Opening function details for:', data.function?.name);
            // Create function analysis panel
            functionAnalysisPanel_1.FunctionAnalysisPanel.create(this._extensionUri, data);
        }
        catch (error) {
            console.error('Error opening function details:', error);
            vscode.window.showErrorMessage(`Failed to open function details: ${error}`);
        }
    }
    /**
     * Cleans up resources when the panel is closed
     */
    dispose() {
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
    static async createAnalysisPanel(extensionUri, analysis) {
        const panel = AnalysisPanel.create(extensionUri, analysis);
        return panel._panel;
    }
}
exports.AnalysisPanel = AnalysisPanel;
// Add this for backwards compatibility
async function createAnalysisPanel(extensionUri, analysis) {
    return AnalysisPanel.createAnalysisPanel(extensionUri, analysis);
}
//# sourceMappingURL=analysisPanel.js.map