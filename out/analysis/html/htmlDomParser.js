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
exports.parseHTMLFile = parseHTMLFile;
exports.prepareHTMLForTemplate = prepareHTMLForTemplate;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const analysisUtils_1 = require("../utils/analysisUtils");
const processUtils_1 = require("../../pythonEnv/utils/processUtils");
const pathUtils_1 = require("../../pythonEnv/utils/pathUtils");
/**
 * Calls the Python script to parse the HTML file and returns the analysis result.
 * @param filePath Path to the HTML file
 * @returns The result from the Python script
 */
async function callPythonDOMParser(filePath) {
    // Create an output channel for debugging
    const outputChannel = vscode.window.createOutputChannel('CodeXR DOM Analysis');
    const pythonScriptPath = (0, analysisUtils_1.resolveAnalyzerScriptPath)('html_dom_parser.py', outputChannel);
    outputChannel.appendLine(`Resolved script path: ${pythonScriptPath}`);
    // Verify the script exists
    if (!fs.existsSync(pythonScriptPath)) {
        outputChannel.appendLine(`❌ Script does not exist at: ${pythonScriptPath}`);
        throw new Error(`Python script not found at: ${pythonScriptPath}`);
    }
    // First try with system Python if virtual environment is not available
    let pythonExecutable;
    let usingVenv = false;
    const venvPath = (0, pathUtils_1.getVenvPath)();
    outputChannel.appendLine(`Virtual environment path: ${venvPath}`);
    if (venvPath && fs.existsSync(venvPath)) {
        const venvPython = (0, pathUtils_1.getPythonExecutable)(venvPath);
        if (fs.existsSync(venvPython)) {
            pythonExecutable = venvPython;
            usingVenv = true;
        }
        else {
            // Fallback to system Python
            pythonExecutable = process.platform === 'win32' ? 'python.exe' : 'python3';
        }
    }
    else {
        // Use system Python
        pythonExecutable = process.platform === 'win32' ? 'python.exe' : 'python3';
    }
    outputChannel.appendLine(`Using Python executable: ${pythonExecutable} (venv: ${usingVenv})`);
    try {
        const stdout = await (0, processUtils_1.executeCommand)(pythonExecutable, [pythonScriptPath, filePath], { showOutput: false });
        outputChannel.appendLine(`✅ Python script executed successfully`);
        return JSON.parse(stdout);
    }
    catch (error) {
        outputChannel.appendLine(`❌ Error executing Python DOM parser: ${error}`);
        // If virtual environment failed, try with system Python
        if (usingVenv) {
            outputChannel.appendLine('Retrying with system Python...');
            try {
                const systemPython = process.platform === 'win32' ? 'python.exe' : 'python3';
                const stdout = await (0, processUtils_1.executeCommand)(systemPython, [pythonScriptPath, filePath], { showOutput: false });
                outputChannel.appendLine(`✅ System Python executed successfully`);
                return JSON.parse(stdout);
            }
            catch (systemError) {
                outputChannel.appendLine(`❌ System Python also failed: ${systemError}`);
                outputChannel.show(); // Show the output channel for debugging
                throw new Error(`Failed to execute Python DOM parser script. Error: ${systemError}`);
            }
        }
        else {
            outputChannel.show(); // Show the output channel for debugging
            throw new Error(`Failed to execute Python DOM parser script. Error: ${error}`);
        }
    }
}
/**
 * Parses HTML file and extracts DOM structure using Python parser
 * @param filePath Path to the HTML file
 * @returns DOM analysis result
 */
async function parseHTMLFile(filePath) {
    try {
        // Read the HTML file first for content
        const htmlContent = await fs.promises.readFile(filePath, 'utf-8');
        const fileName = path.basename(filePath);
        // Use Python script for DOM parsing
        const pythonResult = await callPythonDOMParser(filePath);
        if (pythonResult.error) {
            throw new Error(pythonResult.error);
        }
        const result = {
            fileName,
            filePath,
            totalElements: pythonResult.totalElements,
            maxDepth: pythonResult.maxDepth,
            htmlContent: htmlContent,
            domTree: pythonResult.domTree,
            elementCounts: pythonResult.elementCounts,
            timestamp: new Date().toISOString()
        };
        return result;
    }
    catch (error) {
        throw new Error(`Failed to parse HTML file: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Prepares HTML content for template injection
 * @param domAnalysis DOM analysis result
 * @returns Clean HTML ready for babia-html attribute (single line, no escaping)
 */
function prepareHTMLForTemplate(domAnalysis) {
    let htmlContent = domAnalysis.htmlContent;
    // Extract only the body content, not the full HTML document
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
        htmlContent = bodyMatch[1].trim();
    }
    else {
        // If no body tag, try to extract content between <html> tags
        const htmlMatch = htmlContent.match(/<html[^>]*>([\s\S]*?)<\/html>/i);
        if (htmlMatch) {
            // Remove head section and keep only what would be in body
            let content = htmlMatch[1];
            const headMatch = content.match(/<head[^>]*>[\s\S]*?<\/head>/i);
            if (headMatch) {
                content = content.replace(headMatch[0], '').trim();
            }
            htmlContent = content;
        }
    }
    // Clean up the HTML content - CRITICAL: Convert to single line and remove problematic content
    let cleanHTML = htmlContent
        .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
        .replace(/<script[\s\S]*?<\/script>/gi, '') // Remove script tags
        .replace(/<style[\s\S]*?<\/style>/gi, '') // Remove style tags
        .replace(/\r\n/g, ' ') // Replace Windows line endings with spaces
        .replace(/\n/g, ' ') // Replace Unix line endings with spaces  
        .replace(/\r/g, ' ') // Replace Mac line endings with spaces
        .replace(/\t/g, ' ') // Replace tabs with spaces
        .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
        .trim(); // Remove leading/trailing whitespace
    // If the HTML is too long, truncate it but keep it valid
    if (cleanHTML.length > 3000) {
        // Find a good place to cut (try to end at a closing tag)
        const cutPoint = cleanHTML.lastIndexOf('>', 3000);
        if (cutPoint > 2500) {
            cleanHTML = cleanHTML.substring(0, cutPoint + 1);
        }
        else {
            cleanHTML = cleanHTML.substring(0, 3000);
        }
    }
    // Ensure we have some basic content if extraction failed
    if (!cleanHTML || cleanHTML.length < 10) {
        cleanHTML = `<div><h1>Sample Content</h1><p>HTML content extracted from ${domAnalysis.fileName}</p></div>`;
    }
    // CRITICAL: Return as single line without any escaping
    // The babia-html component expects raw HTML, not escaped HTML
    return cleanHTML;
}
//# sourceMappingURL=htmlDomParser.js.map