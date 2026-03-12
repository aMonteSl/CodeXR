import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BabiaExample, ExampleScanResult, ExampleLaunchConfig } from '../model/babiaExampleModel';
import { MultiServerLauncher, MultiServerLaunchResult } from '../../servers/runtime/multiServerLauncher';

/**
 * Example Launcher
 * Responsible for launching Babia examples using the existing server infrastructure
 */
export class ExampleLauncher {
    private multiServerLauncher: MultiServerLauncher;
    private examplesCache: BabiaExample[] = [];
    private lastScanTime: number = 0;
    private readonly CACHE_DURATION = 30000; // 30 seconds

    constructor(private context: vscode.ExtensionContext) {
        this.multiServerLauncher = new MultiServerLauncher(context);
        console.log('EXAMPLES: Example launcher initialized');
    }

    /**
     * Scan for Babia examples in the charts directory
     * @returns Promise<ExampleScanResult>
     */
    public async scanExamples(): Promise<ExampleScanResult> {
        console.log('EXAMPLES: Scanning for Babia examples...');
        
        const result: ExampleScanResult = {
            examples: [],
            validCount: 0,
            invalidCount: 0,
            errors: []
        };

        try {            let workspaceRoot = this.context.extensionPath;
            let chartsPath = path.join(workspaceRoot, 'examples', 'charts');
            console.log(`EXAMPLES: Resolved extension root: ${workspaceRoot}`);
            if (!fs.existsSync(chartsPath)) {
                // Method 3: Try to find from VS Code workspace folders as fallback
                const workspaceRoots = vscode.workspace.workspaceFolders;
                if (workspaceRoots && workspaceRoots.length > 0) {
                    const potentialCodeXRRoot = workspaceRoots.find(folder => 
                        folder.name === 'CodeXR' || 
                        folder.uri.fsPath.includes('CodeXR') ||
                        fs.existsSync(path.join(folder.uri.fsPath, 'examples', 'charts'))
                    );
                    
                    if (potentialCodeXRRoot) {
                        workspaceRoot = potentialCodeXRRoot.uri.fsPath;
                        chartsPath = path.join(workspaceRoot, 'examples', 'charts');
                        console.log(`EXAMPLES: Found CodeXR from workspace folders: ${workspaceRoot}`);
                    } else {
                        result.errors.push('Could not find CodeXR directory with examples/charts');
                        return result;
                    }
                } else {
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
                    } else {
                        result.invalidCount++;
                    }
                }
            }

            // Update cache
            this.examplesCache = result.examples;
            this.lastScanTime = Date.now();

            console.log(`EXAMPLES: total found ${result.examples.length}`);
            console.log(`EXAMPLES: Scan complete. Found ${result.validCount} valid and ${result.invalidCount} invalid examples`);

        } catch (error) {
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
    public async getExamples(): Promise<BabiaExample[]> {
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
    public async launchExample(example: BabiaExample): Promise<MultiServerLaunchResult> {
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
            } else {
                console.error(`EXAMPLES: Failed to launch example "${example.name}":`, result.error);
                vscode.window.showErrorMessage(`Failed to launch example "${example.name}": ${result.error}`);
            }

            return result;

        } catch (error) {
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
    private async processExampleDirectory(directoryPath: string, categoryName: string): Promise<BabiaExample | null> {
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
            
            const example: BabiaExample = {
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

        } catch (error) {
            console.error(`EXAMPLES: Error processing directory ${directoryPath}:`, error);
            return null;
        }
    }

    /**
     * Generate a unique ID for an example
     * @private
     */
    private generateExampleId(category: string, filename: string): string {
        return `example_${category}_${filename}`.replace(/[^a-zA-Z0-9_]/g, '_');
    }

    /**
     * Format example name for display
     * @private
     */
    private formatExampleName(category: string): string {
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
    private generateDescription(category: string, filename: string): string {
        const formattedCategory = this.formatExampleName(category);
        if (filename.toLowerCase() === 'index.html') {
            return `${formattedCategory} visualization example`;
        } else {
            const formattedFilename = filename.replace('.html', '').replace(/[-_]/g, ' ');
            return `${formattedCategory} - ${formattedFilename}`;
        }
    }

    /**
     * Cleanup method
     */
    public async cleanup(): Promise<void> {
        console.log('EXAMPLES: Cleaning up example launcher...');
        // The MultiServerLauncher will handle its own cleanup
        this.examplesCache = [];
        this.lastScanTime = 0;
    }
}


