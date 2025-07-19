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
exports.ExampleLauncher = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const multiServerLauncher_1 = require("../../servers/runtime/multiServerLauncher");
/**
 * Example Launcher
 * Responsible for launching Babia examples using the existing server infrastructure
 */
class ExampleLauncher {
    context;
    multiServerLauncher;
    examplesCache = [];
    lastScanTime = 0;
    CACHE_DURATION = 30000; // 30 seconds
    constructor(context) {
        this.context = context;
        this.multiServerLauncher = new multiServerLauncher_1.MultiServerLauncher(context);
        console.log('EXAMPLES: Example launcher initialized');
    }
    /**
     * Scan for Babia examples in the charts directory
     * @returns Promise<ExampleScanResult>
     */
    async scanExamples() {
        console.log('EXAMPLES: Scanning for Babia examples...');
        const result = {
            examples: [],
            validCount: 0,
            invalidCount: 0,
            errors: []
        };
        try {
            // First, try to use the extension's own path to find CodeXR directory
            let workspaceRoot;
            // Method 1: Use extension context to find CodeXR directory
            const extensionPath = this.context.extensionPath;
            console.log(`EXAMPLES: Extension path: ${extensionPath}`);
            if (extensionPath.includes('CodeXR')) {
                // Extract CodeXR root from extension path
                const codeXRPath = extensionPath.substring(0, extensionPath.lastIndexOf('CodeXR') + 6);
                workspaceRoot = codeXRPath;
                console.log(`EXAMPLES: Found CodeXR from extension path: ${workspaceRoot}`);
            }
            else {
                // Method 2: Force use the known CodeXR path
                workspaceRoot = '/home/adrian/CodeXR';
                console.log(`EXAMPLES: Using hardcoded CodeXR path: ${workspaceRoot}`);
            }
            // Verify the path exists and has examples/charts
            let chartsPath = path.join(workspaceRoot, 'examples', 'charts');
            if (!fs.existsSync(chartsPath)) {
                // Method 3: Try to find from VS Code workspace folders as fallback
                const workspaceRoots = vscode.workspace.workspaceFolders;
                if (workspaceRoots && workspaceRoots.length > 0) {
                    const potentialCodeXRRoot = workspaceRoots.find(folder => folder.name === 'CodeXR' ||
                        folder.uri.fsPath.includes('CodeXR') ||
                        fs.existsSync(path.join(folder.uri.fsPath, 'examples', 'charts')));
                    if (potentialCodeXRRoot) {
                        workspaceRoot = potentialCodeXRRoot.uri.fsPath;
                        chartsPath = path.join(workspaceRoot, 'examples', 'charts');
                        console.log(`EXAMPLES: Found CodeXR from workspace folders: ${workspaceRoot}`);
                    }
                    else {
                        result.errors.push('Could not find CodeXR directory with examples/charts');
                        return result;
                    }
                }
                else {
                    result.errors.push('No workspace folder open and CodeXR path not found');
                    return result;
                }
            }
            console.log(`EXAMPLES: Using workspace root: ${workspaceRoot}`);
            console.log(`EXAMPLES: Scanning charts directory: ${chartsPath}`);
            if (!fs.existsSync(chartsPath)) {
                result.errors.push(`Charts directory not found: ${chartsPath}`);
                return result;
            }
            const chartDirectories = fs.readdirSync(chartsPath)
                .filter(item => {
                const itemPath = path.join(chartsPath, item);
                return fs.statSync(itemPath).isDirectory();
            });
            console.log(`EXAMPLES: Found ${chartDirectories.length} chart directories`);
            for (const chartDir of chartDirectories) {
                const chartPath = path.join(chartsPath, chartDir);
                const example = await this.processExampleDirectory(chartPath, chartDir);
                if (example) {
                    console.log(`EXAMPLES: FOUND chart ${chartDir} example`);
                    result.examples.push(example);
                    if (example.isValid) {
                        result.validCount++;
                    }
                    else {
                        result.invalidCount++;
                    }
                }
            }
            // Update cache
            this.examplesCache = result.examples;
            this.lastScanTime = Date.now();
            console.log(`EXAMPLES: total found ${result.examples.length}`);
            console.log(`EXAMPLES: Scan complete. Found ${result.validCount} valid and ${result.invalidCount} invalid examples`);
        }
        catch (error) {
            const errorMsg = `Failed to scan examples: ${error instanceof Error ? error.message : String(error)}`;
            console.error('EXAMPLES:', errorMsg);
            result.errors.push(errorMsg);
        }
        return result;
    }
    /**
     * Get cached examples or scan if cache is stale
     * @returns Promise<BabiaExample[]>
     */
    async getExamples() {
        const now = Date.now();
        if (this.examplesCache.length === 0 || (now - this.lastScanTime) > this.CACHE_DURATION) {
            console.log('EXAMPLES: Cache is stale, rescanning...');
            const result = await this.scanExamples();
            return result.examples;
        }
        console.log(`EXAMPLES: Using cached examples (${this.examplesCache.length} items)`);
        return this.examplesCache;
    }
    /**
     * Launch a specific Babia example
     * @param example The example to launch
     * @returns Promise<MultiServerLaunchResult>
     */
    async launchExample(example) {
        console.log(`EXAMPLES: Launching example "${example.name}" from ${example.htmlFilePath}`);
        try {
            if (!example.isValid) {
                throw new Error(`Example "${example.name}" is not valid - missing HTML file`);
            }
            if (!fs.existsSync(example.htmlFilePath)) {
                throw new Error(`HTML file not found: ${example.htmlFilePath}`);
            }
            console.log(`EXAMPLES: Delegating launch to multi-server launcher with user configuration`);
            // Create custom name in format "ExampleName" (already ends with proper format from scanning)
            const customName = example.name; // e.g., "DonutExample", "BarsExample"
            console.log(`SERVER: Using custom name '${customName}' for example server`);
            // Delegate everything to the multi-server launcher
            // This will handle:
            // - Reading current user configuration (HTTP mode, port, auto-open, lateral panel vs browser)
            // - Launching server with correct settings
            // - Auto-opening in the configured mode (if enabled)
            // - Registering in Active Servers
            const result = await this.multiServerLauncher.launchServer(example.htmlFilePath, customName);
            if (result.success) {
                console.log(`EXAMPLES: Successfully launched example "${example.name}" on port ${result.port}`);
                console.log(`EXAMPLES: Server configuration and auto-opening handled by shared infrastructure`);
            }
            else {
                console.error(`EXAMPLES: Failed to launch example "${example.name}":`, result.error);
                vscode.window.showErrorMessage(`Failed to launch example "${example.name}": ${result.error}`);
            }
            return result;
        }
        catch (error) {
            const errorMsg = `Failed to launch example "${example.name}": ${error instanceof Error ? error.message : String(error)}`;
            console.error('EXAMPLES:', errorMsg);
            vscode.window.showErrorMessage(errorMsg);
            return {
                success: false,
                error: errorMsg
            };
        }
    }
    /**
     * Process a single example directory
     * @private
     */
    async processExampleDirectory(directoryPath, categoryName) {
        try {
            console.log(`EXAMPLES: Processing directory: ${directoryPath}`);
            // Look for HTML files in the directory
            const files = fs.readdirSync(directoryPath);
            const htmlFiles = files.filter(file => file.toLowerCase().endsWith('.html'));
            console.log(`EXAMPLES: Found ${htmlFiles.length} HTML files in ${categoryName}: ${htmlFiles.join(', ')}`);
            if (htmlFiles.length === 0) {
                console.log(`EXAMPLES: No HTML files found in ${categoryName}`);
                return {
                    id: this.generateExampleId(categoryName, 'no-html'),
                    name: categoryName,
                    htmlFilePath: '',
                    directory: directoryPath,
                    category: categoryName,
                    description: 'No HTML files found',
                    isValid: false
                };
            }
            // Prefer index.html, then first HTML file
            let selectedFile = htmlFiles.find(file => file.toLowerCase() === 'index.html') || htmlFiles[0];
            const htmlFilePath = path.join(directoryPath, selectedFile);
            const stats = fs.statSync(htmlFilePath);
            const example = {
                id: this.generateExampleId(categoryName, selectedFile),
                name: this.formatExampleName(categoryName),
                htmlFilePath: htmlFilePath,
                directory: directoryPath,
                category: categoryName,
                description: this.generateDescription(categoryName, selectedFile),
                isValid: true,
                lastModified: stats.mtime.getTime()
            };
            console.log(`EXAMPLES: Created example: ${example.name} (${example.id})`);
            return example;
        }
        catch (error) {
            console.error(`EXAMPLES: Error processing directory ${directoryPath}:`, error);
            return null;
        }
    }
    /**
     * Generate a unique ID for an example
     * @private
     */
    generateExampleId(category, filename) {
        return `example_${category}_${filename}`.replace(/[^a-zA-Z0-9_]/g, '_');
    }
    /**
     * Format example name for display
     * @private
     */
    formatExampleName(category) {
        // Convert kebab-case or snake_case to Title Case
        return category
            .split(/[-_]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
    /**
     * Generate description for example
     * @private
     */
    generateDescription(category, filename) {
        const formattedCategory = this.formatExampleName(category);
        if (filename.toLowerCase() === 'index.html') {
            return `${formattedCategory} visualization example`;
        }
        else {
            const formattedFilename = filename.replace('.html', '').replace(/[-_]/g, ' ');
            return `${formattedCategory} - ${formattedFilename}`;
        }
    }
    /**
     * Cleanup method
     */
    async cleanup() {
        console.log('EXAMPLES: Cleaning up example launcher...');
        // The MultiServerLauncher will handle its own cleanup
        this.examplesCache = [];
        this.lastScanTime = 0;
    }
}
exports.ExampleLauncher = ExampleLauncher;
//# sourceMappingURL=exampleLauncher.js.map