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
exports.ColorPickerUtils = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ColorPickerUtils {
    static TEMPLATE_PATH = 'templates/utils/color-picker.html';
    /**
     * Load and process the color picker HTML template
     */
    static async loadColorPickerTemplate(context, options) {
        try {
            const templatePath = path.join(context.extensionPath, this.TEMPLATE_PATH);
            let templateContent = fs.readFileSync(templatePath, 'utf8');
            // Replace placeholders
            templateContent = templateContent
                .replace(/\$\{FIELD_NAME\}/g, options.fieldName)
                .replace(/\$\{CURRENT_COLOR\}/g, options.currentColor);
            return templateContent;
        }
        catch (error) {
            console.error('[VISUALIZATION-SETTINGS] Error loading color picker template:', error);
            throw new Error(`Failed to load color picker template: ${error}`);
        }
    }
    /**
     * Create and configure a webview for the color picker
     */
    static createColorPickerWebview(context, options) {
        const panel = vscode.window.createWebviewPanel('colorPicker', `Color Picker - ${options.fieldName}`, vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(context.extensionPath, 'templates'))
            ]
        });
        // Set the icon for the panel
        panel.iconPath = {
            light: vscode.Uri.file(path.join(context.extensionPath, 'resources', 'icon.svg')),
            dark: vscode.Uri.file(path.join(context.extensionPath, 'resources', 'icon.svg'))
        };
        return panel;
    }
    /**
     * Validate hex color format
     */
    static validateHexColor(color) {
        return /^#[0-9a-fA-F]{6}$/.test(color);
    }
    /**
     * Normalize color to uppercase hex format
     */
    static normalizeColor(color) {
        if (this.validateHexColor(color)) {
            return color.toUpperCase();
        }
        return '#FFFFFF'; // Default fallback
    }
    /**
     * Get predefined colors for fallback
     */
    static getPredefinedColors() {
        return [
            '#FFFFFF', // White
            '#000000', // Black
            '#B10DC9', // Purple
            '#FF4081', // Pink
            '#F44336', // Red
            '#FF9800', // Orange
            '#FFEB3B', // Yellow
            '#4CAF50', // Green
            '#2196F3', // Blue
            '#9C27B0', // Violet
            '#607D8B', // Blue Grey
            '#795548' // Brown
        ];
    }
}
exports.ColorPickerUtils = ColorPickerUtils;
//# sourceMappingURL=colorPickerUtils.js.map