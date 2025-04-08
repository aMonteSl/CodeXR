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
exports.showColorPickerWebView = showColorPickerWebView;
const vscode = __importStar(require("vscode"));
/**
 * Shows a visual color picker using a custom WebView
 * @param title Title for the picker
 * @param defaultColor Current color value in hex format
 * @returns Selected color in hex format, or undefined if canceled
 */
function showColorPickerWebView(title, defaultColor) {
    return new Promise((resolve) => {
        // Create and show panel
        const panel = vscode.window.createWebviewPanel('colorPicker', title, vscode.ViewColumn.Active, {
            enableScripts: true,
            localResourceRoots: []
        });
        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'colorSelected':
                    resolve(message.color);
                    panel.dispose();
                    break;
                case 'cancelled':
                    resolve(undefined);
                    panel.dispose();
                    break;
            }
        }, undefined, []);
        // Set the webview's HTML content
        panel.webview.html = getWebviewContent(title, defaultColor);
        // Handle panel being closed
        panel.onDidDispose(() => {
            resolve(undefined);
        });
    });
}
/**
 * Generate the HTML content for the WebView
 */
function getWebviewContent(title, defaultColor) {
    return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
      body {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
        padding: 20px;
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        color: var(--vscode-foreground);
        background-color: var(--vscode-editor-background);
      }
      .container {
        width: 100%;
        max-width: 400px;
        text-align: center;
      }
      /* Enhanced color display */
      .color-display {
        width: 100%;
        height: 80px; /* Larger display area */
        margin: 20px 0;
        border-radius: 8px; /* Rounded corners */
        background-color: ${defaultColor};
        box-shadow: 0 4px 10px rgba(0,0,0,0.2); /* More visible shadow */
        transition: background-color 0.3s ease;
        border: 1px solid var(--vscode-input-border); /* Border to show edges on white/light colors */
      }
      
      /* Add checkerboard background for transparency indication */
      .color-display-wrapper {
        position: relative;
        width: 100%;
        height: 80px;
        margin: 20px 0;
        border-radius: 8px;
        background-image: linear-gradient(45deg, #ccc 25%, transparent 25%),
                         linear-gradient(-45deg, #ccc 25%, transparent 25%),
                         linear-gradient(45deg, transparent 75%, #ccc 75%),
                         linear-gradient(-45deg, transparent 75%, #ccc 75%);
        background-size: 20px 20px;
        background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
      }
      
      /* Make color label more prominent */
      .color-label {
        font-size: 18px;
        font-weight: bold;
        margin: 10px 0;
        font-family: monospace;
        padding: 5px 10px;
        background-color: var(--vscode-input-background);
        border-radius: 4px;
        display: inline-block;
      }
      .button-container {
        display: flex;
        justify-content: space-between;
        margin-top: 20px;
      }
      button {
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 8px 16px;
        border-radius: 2px;
        cursor: pointer;
        font-size: 14px;
        min-width: 100px;
      }
      button:hover {
        background-color: var(--vscode-button-hoverBackground);
      }
      .color-inputs {
        display: flex;
        margin: 20px 0;
        justify-content: center;
        gap: 10px;
      }
      input[type="color"] {
        width: 40px;
        height: 40px;
        cursor: pointer;
        border: none;
        background: none;
      }
      input[type="text"] {
        width: 100px;
        padding: 8px;
        border: 1px solid var(--vscode-input-border);
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        font-family: monospace;
        border-radius: 2px;
      }
      .presets {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 20px 0;
        justify-content: center;
      }
      .preset {
        width: 30px;
        height: 30px;
        border-radius: 4px;
        cursor: pointer;
        transition: transform 0.1s ease;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .preset:hover {
        transform: scale(1.1);
      }
      h2 {
        margin-bottom: 10px;
        font-size: 16px;
        font-weight: normal;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>${title}</h1>
      
      <!-- Use a wrapper with checkerboard background -->
      <div class="color-display-wrapper">
        <div class="color-display" id="colorDisplay"></div>
      </div>
      <div class="color-label" id="colorLabel">${defaultColor}</div>
      
      <div class="color-inputs">
        <input type="color" id="colorPicker" value="${defaultColor}">
        <input type="text" id="hexInput" value="${defaultColor}" placeholder="#RRGGBB">
      </div>
      
      <h2>Presets</h2>
      <div class="presets" id="presets">
        <!-- Presets will be added by JavaScript -->
      </div>
      
      <div class="button-container">
        <button id="cancelButton">Cancel</button>
        <button id="confirmButton">Confirm</button>
      </div>
    </div>
    
    <script>
      (function() {
        // Color presets
        const presets = [
          { name: 'Dark Blue', hex: '#112233' },
          { name: 'Navy', hex: '#001f3f' },
          { name: 'Blue', hex: '#0074D9' },
          { name: 'Aqua', hex: '#7FDBFF' },
          { name: 'Teal', hex: '#39CCCC' },
          { name: 'Forest Green', hex: '#2ECC40' },
          { name: 'Lime', hex: '#01FF70' },
          { name: 'Yellow', hex: '#FFDC00' },
          { name: 'Orange', hex: '#FF851B' },
          { name: 'Red', hex: '#FF4136' },
          { name: 'Maroon', hex: '#85144b' },
          { name: 'Purple', hex: '#B10DC9' },
          { name: 'Gray', hex: '#AAAAAA' },
          { name: 'Silver', hex: '#DDDDDD' },
          { name: 'Black', hex: '#111111' },
          { name: 'White', hex: '#FFFFFF' }
        ];
        
        // Initialize elements
        const colorDisplay = document.getElementById('colorDisplay');
        const colorLabel = document.getElementById('colorLabel');
        const colorPicker = document.getElementById('colorPicker');
        const hexInput = document.getElementById('hexInput');
        const confirmButton = document.getElementById('confirmButton');
        const cancelButton = document.getElementById('cancelButton');
        const presetsContainer = document.getElementById('presets');
        
        // Initialize with default color
        let currentColor = '${defaultColor}';
        colorDisplay.style.backgroundColor = currentColor;
        colorLabel.textContent = currentColor;
        colorPicker.value = currentColor;
        hexInput.value = currentColor;
        
        // Create preset elements
        presets.forEach(preset => {
          const presetEl = document.createElement('div');
          presetEl.className = 'preset';
          presetEl.style.backgroundColor = preset.hex;
          presetEl.title = preset.name;
          presetEl.addEventListener('click', () => {
            updateColor(preset.hex);
          });
          presetsContainer.appendChild(presetEl);
        });
        
        // Color picker change
        colorPicker.addEventListener('input', (e) => {
          updateColor(e.target.value);
        });
        
        // Hex input change
        hexInput.addEventListener('input', (e) => {
          const value = e.target.value;
          if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
            updateColor(value);
          }
        });
        
        // Update all UI elements with new color
        function updateColor(color) {
          currentColor = color;
          colorDisplay.style.backgroundColor = color;
          colorLabel.textContent = color;
          colorPicker.value = color;
          hexInput.value = color;
        }
        
        // Confirm button click
        confirmButton.addEventListener('click', () => {
          // Validate format
          if (!/^#[0-9A-Fa-f]{6}$/.test(currentColor)) {
            currentColor = colorPicker.value; // Fallback to color picker value
          }
          
          // Send message back to extension
          vscode.postMessage({
            command: 'colorSelected',
            color: currentColor
          });
        });
        
        // Cancel button click
        cancelButton.addEventListener('click', () => {
          vscode.postMessage({
            command: 'cancelled'
          });
        });
        
        // VS Code API
        const vscode = acquireVsCodeApi();
      })();
    </script>
  </body>
  </html>`;
}
//# sourceMappingURL=colorPickerWebView.js.map