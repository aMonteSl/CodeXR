import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileAnalysis, ProjectAnalysis } from '../../analysis/models/analysisModel';
import { generateNonce } from '../../utils/nonceUtils';

/**
 * Creates a WebView panel to display code analysis results
 * @param extensionUri Extension URI for loading resources
 * @param analysis Analysis data to display
 */
export async function createAnalysisPanel(
  extensionUri: vscode.Uri,
  analysis: FileAnalysis | ProjectAnalysis
): Promise<vscode.WebviewPanel> {
  // Create webview panel
  const panel = vscode.window.createWebviewPanel(
    'jsAnalysisPanel',
    'JavaScript Analysis Results',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [extensionUri]
    }
  );

  // Load HTML template
  const htmlContent = await loadAnalysisPanelTemplate(panel.webview, extensionUri);
  panel.webview.html = htmlContent;

  // Send data to webview
  setTimeout(() => {
    const isFileAnalysis = 'fileName' in analysis;
    panel.webview.postMessage({
      command: isFileAnalysis ? 'showFileAnalysis' : 'showProjectAnalysis',
      analysis
    });
  }, 500);

  return panel;
}

/**
 * Loads and processes the HTML template for the analysis panel
 * @param webview Webview for creating URIs
 * @param extensionUri Extension URI
 * @returns Processed HTML content
 */
async function loadAnalysisPanelTemplate(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): Promise<string> {
  // Get paths to resources
  const scriptPath = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'analysis', 'main.js')
  );
  
  const stylePath = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'analysis', 'style.css')
  );
  
  // Generate nonce for CSP
  const nonce = generateNonce();
  
  // Load template
  try {
    const templatePath = path.join(extensionUri.fsPath, 'templates', 'analysisPanel.html');
    
    // Check if template exists
    if (fs.existsSync(templatePath)) {
      // Read and process template
      let template = fs.readFileSync(templatePath, 'utf-8');
      
      // Replace variables
      return template
        .replace(/\${webview.cspSource}/g, webview.cspSource)
        .replace(/\${nonce}/g, nonce)
        .replace(/\${scriptUri}/g, scriptPath.toString())
        .replace(/\${styleUri}/g, stylePath.toString());
    } else {
      // Fall back to inline template if file doesn't exist
      return getInlineAnalysisTemplate(webview.cspSource, nonce, scriptPath.toString(), stylePath.toString());
    }
  } catch (error) {
    console.error('Error loading analysis panel template:', error);
    // Fall back to inline template
    return getInlineAnalysisTemplate(webview.cspSource, nonce, scriptPath.toString(), stylePath.toString());
  }
}

/**
 * Returns an inline template as fallback
 */
function getInlineAnalysisTemplate(
  cspSource: string,
  nonce: string,
  scriptUri: string,
  styleUri: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource}; script-src 'nonce-${nonce}';">
  <link href="${styleUri}" rel="stylesheet">
  <title>Code Analysis</title>
</head>
<body>
  <div id="app">
    <div class="header">
      <h1>Code Analysis</h1>
      <p class="subtitle">Analysis Results</p>
    </div>
    
    <div id="no-data" class="message">
      <p>Loading analysis data...</p>
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
        
        <div class="chart-container">
          <div class="pie-chart">
            <div class="pie">
              <div class="pie-center">0 Lines</div>
            </div>
            <div class="pie-legend">
              <div class="legend-item code">
                <div class="legend-color code"></div>
                <span>Code: <span class="legend-percent">0% (0)</span></span>
              </div>
              <div class="legend-item comments">
                <div class="legend-color comments"></div>
                <span>Comments: <span class="legend-percent">0% (0)</span></span>
              </div>
              <div class="legend-item blank">
                <div class="legend-color blank"></div>
                <span>Blank: <span class="legend-percent">0% (0)</span></span>
              </div>
            </div>
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