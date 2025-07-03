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
exports.loadTemplate = loadTemplate;
exports.saveTemplate = saveTemplate;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Loads an HTML template from the templates directory
 * @param extensionUri Extension URI
 * @param templateName Template file name
 * @param options Template loading options
 * @returns The loaded template content
 */
function loadTemplate(extensionUri, templateName, options = {}) {
    try {
        // Get template path
        const templatePath = path.join(extensionUri.fsPath, 'templates', templateName);
        // Check if file exists
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template file not found: ${templatePath}`);
        }
        // Read template content
        let templateContent = fs.readFileSync(templatePath, 'utf-8');
        // Replace variables if provided
        if (options.variables) {
            templateContent = replaceVariables(templateContent, options.variables);
        }
        // Apply post-processing if provided
        if (options.postProcess) {
            templateContent = options.postProcess(templateContent);
        }
        return templateContent;
    }
    catch (error) {
        console.error(`Error loading template ${templateName}:`, error);
        throw error;
    }
}
/**
 * Replace variables in a template
 * @param template Template content
 * @param variables Variables to replace
 * @returns Processed template
 */
function replaceVariables(template, variables) {
    let result = template;
    // Replace each variable
    for (const [key, value] of Object.entries(variables)) {
        // Use regex to replace all occurrences of ${key}
        const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
        result = result.replace(regex, value);
    }
    return result;
}
/**
 * Save a template to a file
 * @param content Template content
 * @param filePath Path to save the file
 */
async function saveTemplate(content, filePath) {
    try {
        // Ensure directory exists
        const directory = path.dirname(filePath);
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }
        // Write file
        fs.writeFileSync(filePath, content, 'utf-8');
    }
    catch (error) {
        console.error(`Error saving template to ${filePath}:`, error);
        throw error;
    }
}
//# sourceMappingURL=templateLoader.js.map