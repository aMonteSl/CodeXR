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
exports.createAnalysisPanel = createAnalysisPanel;
const vscode = __importStar(require("vscode"));
/**
 * Panel is deprecated as analysis functionality has been removed
 */
async function createAnalysisPanel(extensionUri, analysis) {
    // Create webview panel
    const panel = vscode.window.createWebviewPanel('jsAnalysisPanel', 'CodeXR Panel', vscode.ViewColumn.One, {
        enableScripts: true,
        localResourceRoots: [extensionUri]
    });
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
//# sourceMappingURL=analysisPanel.js.map