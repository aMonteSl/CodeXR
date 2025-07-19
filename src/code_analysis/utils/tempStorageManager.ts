import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { generateNonce } from '../../utils/nonceGenerator';
import { launchServerWithFile } from '../../servers/runtime/index';
import { AnalysisSettingsStorage } from '../../utils/analysisSettingsStorage';
import { fileToServerMap } from '../../utils/fileToServerMap';
import { XRTemplateRenderer } from './xrTemplateRenderer';

/**
 * Temporary Storage Manager for Analysis Results
 * 
 * Manages the creation and storage of analysis result files in workspace-scoped
 * temporary directories under context.storageUri/analysis_temp/
 */

/**
 * Store analysis JSON data in a temporary workspace-scoped folder
 * 
 * Creates a unique folder structure:
 * {context.storageUri}/analysis_temp/{baseFileName}_{nonce}/data.json
 * 
 * @param context - VS Code extension context providing storage URI
 * @param fileName - Name of the analyzed file (with or without path)
 * @param data - Analysis data object to be stored as JSON
 * @returns Promise<vscode.Uri> - URI of the created subfolder containing data.json
 */
export async function storeAnalysisJson(
    context: vscode.ExtensionContext,
    fileName: string,
    data: object
): Promise<vscode.Uri> {
    
    // Ensure we have a storage URI
    if (!context.storageUri) {
        throw new Error('Extension storage URI not available');
    }
    
    // Extract the base file name without extension or path
    const baseName = path.parse(fileName).name;
    
    // Generate a unique nonce for this analysis session
    const nonce = generateNonce();
    
    // Create the target folder path: analysis_temp/{baseName}_{nonce}
    const targetFolder = vscode.Uri.joinPath(
        context.storageUri, 
        'analysis_temp', 
        `${baseName}_${nonce}`
    );
    
    try {
        // Ensure the folder exists (create recursively)
        await fs.mkdir(targetFolder.fsPath, { recursive: true });
        
        // Create the data.json file path
        const dataPath = vscode.Uri.joinPath(targetFolder, 'data.json');
        
        // Write the analysis data as formatted JSON
        await fs.writeFile(
            dataPath.fsPath, 
            JSON.stringify(data, null, 2), 
            'utf8'
        );
        
        console.log(`ANALYSIS_STORAGE: Successfully stored analysis data at ${dataPath.fsPath}`);
        
        // Return the folder URI (not the file URI)
        return targetFolder;
        
    } catch (error) {
        console.error(`ANALYSIS_STORAGE: Error storing analysis data: ${error}`);
        throw new Error(`Failed to store analysis data: ${error}`);
    }
}

/**
 * Clean up all temporary analysis folders
 * 
 * Removes the entire analysis_temp directory and all its contents.
 * This should be called during extension deactivation.
 * 
 * @param context - VS Code extension context providing storage URI
 */
export async function cleanupAnalysisTemp(context: vscode.ExtensionContext): Promise<void> {
    if (!context.storageUri) {
        console.log('ANALYSIS_STORAGE: No storage URI available for cleanup');
        return;
    }
    
    const cleanupPath = vscode.Uri.joinPath(context.storageUri, 'analysis_temp');
    
    try {
        await fs.rm(cleanupPath.fsPath, { recursive: true, force: true });
        console.log(`ANALYSIS_STORAGE: Successfully cleaned up temporary analysis folder at ${cleanupPath.fsPath}`);
    } catch (error) {
        // Ignore errors if folder doesn't exist
        console.log(`ANALYSIS_STORAGE: Cleanup completed (folder may not have existed): ${error}`);
    }
}

/**
 * List all stored analysis results
 * 
 * Returns information about all currently stored analysis results
 * in the analysis_temp directory.
 * 
 * @param context - VS Code extension context providing storage URI
 * @returns Promise<string[]> - Array of folder names containing analysis results
 */
export async function listStoredAnalyses(context: vscode.ExtensionContext): Promise<string[]> {
    if (!context.storageUri) {
        return [];
    }
    
    const analysisTempPath = vscode.Uri.joinPath(context.storageUri, 'analysis_temp');
    
    try {
        const entries = await fs.readdir(analysisTempPath.fsPath, { withFileTypes: true });
        return entries
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name);
    } catch (error) {
        // Return empty array if directory doesn't exist
        return [];
    }
}

/**
 * Prepare static analysis viewer assets and launch server
 * 
 * Creates a complete static analysis viewer by:
 * 1. Creating a temporary folder with unique nonce
 * 2. Copying template files (HTML, CSS, JS)
 * 3. Saving analysis data as data.json
 * 4. Launching a local server to serve the viewer
 * 
 * @param context - VS Code extension context providing storage URI
 * @param fileName - Name of the analyzed file (with or without path)
 * @param analysisData - Analysis data object to be stored and displayed
 * @returns Promise<vscode.Uri> - URI of the created viewer folder
 */
export async function prepareStaticAnalysisViewerAssets(
    context: vscode.ExtensionContext,
    fileName: string,
    analysisData: object
): Promise<vscode.Uri> {
    
    // Ensure we have a storage URI
    if (!context.storageUri) {
        throw new Error('Extension storage URI not available');
    }
    
    // Extract the base file name without extension or path
    const baseName = path.parse(fileName).name;
    
    // Get the full filename with extension for server name
    const fullFileName = path.basename(fileName);
    
    // Generate a unique nonce for this analysis viewer session
    const nonce = generateNonce();
    
    // Create the target folder path: analysis_temp/{baseName}_{nonce}
    const targetFolder = vscode.Uri.joinPath(
        context.storageUri, 
        'analysis_temp', 
        `${baseName}_${nonce}`
    );
    
    try {
        // Ensure the folder exists (create recursively)
        await fs.mkdir(targetFolder.fsPath, { recursive: true });
        console.log(`ANALYSIS_VIEWER: Created viewer folder at ${targetFolder.fsPath}`);
        
        // Get extension path for source files
        const extensionPath = context.extensionPath;
        
        // Define source file paths
        const templateHtmlPath = path.join(extensionPath, 'templates', 'analysis_static', 'fileAnalysis.html');
        const mainJsPath = path.join(extensionPath, 'media', 'analysis', 'fileAnalysismain.js');
        const styleCssPath = path.join(extensionPath, 'media', 'analysis', 'fileAnalysisstyle.css');
        
        // Define destination file paths
        const indexHtmlPath = path.join(targetFolder.fsPath, 'index.html');
        const jsDestPath = path.join(targetFolder.fsPath, 'fileAnalysismain.js');
        const cssDestPath = path.join(targetFolder.fsPath, 'fileAnalysisstyle.css');
        const dataJsonPath = path.join(targetFolder.fsPath, 'data.json');
        
        // Step 1: Copy the HTML template and rename to index.html
        console.log(`ANALYSIS_VIEWER: Copying HTML template from ${templateHtmlPath}`);
        let htmlContent = await fs.readFile(templateHtmlPath, 'utf8');
        
        // Process the HTML template to work in static server mode
        const currentTheme = await AnalysisSettingsStorage.getCurrentTheme(context);
        htmlContent = processStaticAnalysisTemplate(htmlContent, analysisData, currentTheme);
        
        await fs.writeFile(indexHtmlPath, htmlContent, 'utf8');
        console.log(`ANALYSIS_VIEWER: Created index.html at ${indexHtmlPath}`);
        
        // Step 2: Copy the JavaScript file
        console.log(`ANALYSIS_VIEWER: Copying JavaScript from ${mainJsPath}`);
        await fs.copyFile(mainJsPath, jsDestPath);
        console.log(`ANALYSIS_VIEWER: Created fileAnalysismain.js at ${jsDestPath}`);
        
        // Step 3: Copy the CSS file
        console.log(`ANALYSIS_VIEWER: Copying CSS from ${styleCssPath}`);
        await fs.copyFile(styleCssPath, cssDestPath);
        console.log(`ANALYSIS_VIEWER: Created fileAnalysisstyle.css at ${cssDestPath}`);
        
        // Step 4: Write the analysis data as data.json
        await fs.writeFile(dataJsonPath, JSON.stringify(analysisData, null, 2), 'utf8');
        console.log(`ANALYSIS_VIEWER: Created data.json at ${dataJsonPath}`);
        
        // Step 5: Launch the local server
        const customServerName = `Analysis Static ${fullFileName}`;
        console.log(`ANALYSIS_VIEWER: Launching server with name: ${customServerName}`);
        
        const launchResult = await launchServerWithFile(context, indexHtmlPath, customServerName);
        
        if (launchResult.success) {
            console.log(`ANALYSIS_VIEWER: Server launched successfully at ${launchResult.serverUrl}`);
            
            // Register the file-to-server mapping for SSE notifications
            if (launchResult.port) {
                console.log(`ANALYSIS_VIEWER: Registering file-to-server mapping for ${fileName}`);
                
                fileToServerMap.registerMapping(fileName, {
                    port: launchResult.port,
                    tempDir: targetFolder.fsPath,
                    fileUri: fileName,
                    serverRef: null as any // Server reference not available from launch result
                });
                
                console.log(`ANALYSIS_VIEWER: File-to-server mapping registered for ${fileName} on port ${launchResult.port}`);
            }
            
            // Show success message with server URL
            vscode.window.showInformationMessage(
                `Static analysis viewer launched for ${fullFileName}`,
                'Open in Browser'
            ).then(selection => {
                if (selection === 'Open in Browser' && launchResult.serverUrl) {
                    vscode.env.openExternal(vscode.Uri.parse(launchResult.serverUrl));
                }
            });
        } else {
            throw new Error(`Failed to launch server: ${launchResult.error}`);
        }
        
        console.log(`ANALYSIS_VIEWER: Static analysis viewer assets prepared successfully at ${targetFolder.fsPath}`);
        
        // Return the folder URI
        return targetFolder;
        
    } catch (error) {
        console.error(`ANALYSIS_VIEWER: Error preparing static analysis viewer: ${error}`);
        throw new Error(`Failed to prepare static analysis viewer: ${error}`);
    }
}

/**
 * Update the data.json file in an existing analysis folder
 * 
 * Finds existing analysis folders for a file and updates the data.json
 * while preserving other assets (HTML, CSS, JS files).
 * 
 * @param context - VS Code extension context providing storage URI
 * @param filePath - Path of the analyzed file
 * @param newData - New analysis data to write to data.json
 * @returns Promise<vscode.Uri[]> - URIs of updated folders
 */
export async function updateDataJson(
    context: vscode.ExtensionContext,
    filePath: string,
    newData: object
): Promise<vscode.Uri[]> {
    console.log(`[TEMP_STORAGE] Updating data.json for ${path.basename(filePath)}`);
    
    if (!context.storageUri) {
        throw new Error('Extension storage URI not available');
    }
    
    const baseName = path.parse(filePath).name;
    const analysisTempPath = vscode.Uri.joinPath(context.storageUri, 'analysis_temp');
    
    try {
        // Read all directories in analysis_temp
        const entries = await fs.readdir(analysisTempPath.fsPath, { withFileTypes: true });
        const matchingFolders: vscode.Uri[] = [];
        
        for (const entry of entries) {
            if (entry.isDirectory() && entry.name.startsWith(`${baseName}_`)) {
                const folderPath = vscode.Uri.joinPath(analysisTempPath, entry.name);
                const dataJsonPath = vscode.Uri.joinPath(folderPath, 'data.json');
                
                try {
                    // Update the data.json file
                    console.log(`[TEMP_STORAGE] DEBUG: Writing data.json to: ${dataJsonPath.fsPath}`);
                    await fs.writeFile(
                        dataJsonPath.fsPath, 
                        JSON.stringify(newData, null, 2), 
                        'utf8'
                    );
                    
                    // Verify file was written by checking if it exists and reading size
                    const stats = await fs.stat(dataJsonPath.fsPath);
                    console.log(`[TEMP_STORAGE] DEBUG: Verified data.json written - Size: ${stats.size} bytes`);
                    
                    // Check if this is an XR analysis folder by looking for index.html
                    const indexHtmlPath = vscode.Uri.joinPath(folderPath, 'index.html');
                    try {
                        await fs.access(indexHtmlPath.fsPath);
                        // index.html exists, this is likely an XR analysis - regenerate it
                        console.log(`[TEMP_STORAGE] Detected XR analysis folder, regenerating index.html for ${entry.name}`);
                        
                        try {
                            await XRTemplateRenderer.generateXRVisualization(context, folderPath, filePath, newData);
                            console.log(`[TEMP_STORAGE] ✅ Regenerated XR index.html for ${entry.name}`);
                        } catch (xrError) {
                            console.error(`[TEMP_STORAGE] ⚠️ Failed to regenerate XR index.html for ${entry.name}: ${xrError}`);
                            // Continue with the process even if XR HTML generation fails
                        }
                    } catch (indexError) {
                        // index.html doesn't exist, probably a static analysis folder
                        console.log(`[TEMP_STORAGE] No index.html found in ${entry.name}, assuming static analysis folder`);
                    }
                    
                    console.log(`[TEMP_STORAGE] Updated data.json in ${entry.name}`);
                    matchingFolders.push(folderPath);
                } catch (error) {
                    console.error(`[TEMP_STORAGE] Failed to update data.json in ${entry.name}:`, error);
                    // Continue with other folders
                }
            }
        }
        
        if (matchingFolders.length === 0) {
            console.log(`[TEMP_STORAGE] No existing analysis folders found for ${baseName}`);
        } else {
            console.log(`[TEMP_STORAGE] Updated ${matchingFolders.length} analysis folder(s) for ${baseName}`);
        }
        
        return matchingFolders;
        
    } catch (error) {
        console.error(`[TEMP_STORAGE] Error updating data.json:`, error);
        return [];
    }
}

/**
 * Process the static analysis HTML template for standalone server use
 * 
 * Replaces VS Code webview placeholders with static server equivalents
 * and injects analysis data directly into the HTML.
 * 
 * @param htmlContent - Original HTML template content
 * @param analysisData - Analysis data to inject
 * @param theme - Theme mode ('light' or 'dark')
 * @returns Processed HTML content ready for static server
 */
function processStaticAnalysisTemplate(htmlContent: string, analysisData: any, theme: string): string {
    // Replace VS Code webview placeholders with static equivalents
    let processedHtml = htmlContent
        // Replace CSS reference
        .replace('${styleUri}', './fileAnalysisstyle.css')
        // Replace JS reference  
        .replace('${scriptUri}', './fileAnalysismain.js')
        // Remove nonce references for static use
        .replace(/nonce-\$\{nonce\}/g, '')
        .replace(/\$\{nonce\}/g, '')
        // Update CSP for static server
        .replace(
            /content="default-src 'none'; style-src \$\{webview\.cspSource\}; script-src 'nonce-\$\{nonce\}' https:\/\/cdn\.jsdelivr\.net; img-src data:;"/,
            'content="default-src \'self\'; script-src \'self\' \'unsafe-inline\' https://cdn.jsdelivr.net; style-src \'self\' \'unsafe-inline\'; img-src data: \'self\';"'
        );
    
    // Inject analysis data directly into the HTML
    const dataInjectionScript = `
    <script>
        // Inject analysis data for static server mode
        window.analysisData = ${JSON.stringify(analysisData)};
        // Inject theme setting
        window.initialTheme = '${theme}';
        console.log('ANALYSIS_VIEWER: Analysis data injected into window.analysisData');
        console.log('ANALYSIS_VIEWER: Theme set to:', window.initialTheme);
    </script>`;
    
    // Insert the data injection script before the main script
    processedHtml = processedHtml.replace(
        /<script[^>]*src="\.\/fileAnalysismain\.js"[^>]*><\/script>/,
        dataInjectionScript + '\n    <script src="./fileAnalysismain.js"></script>'
    );
    
    return processedHtml;
}

/**
 * Prepare XR Analysis Viewer Assets and Launch Server
 * 
 * Uses the existing index.html generated by XRTemplateRenderer and launches a server
 * 
 * @param context - VS Code extension context
 * @param tempFolder - URI of the temp folder containing index.html and data.json
 * @param fileName - Name of the analyzed file
 * @returns Promise<vscode.Uri> - URI of the viewer folder
 */
export async function prepareXRAnalysisViewerAssets(
    context: vscode.ExtensionContext,
    tempFolder: vscode.Uri,
    fileName: string
): Promise<vscode.Uri> {
    
    try {
        const baseName = path.basename(fileName);
        const indexHtmlPath = path.join(tempFolder.fsPath, 'index.html');
        
        // Verify that index.html exists (should be generated by XRTemplateRenderer)
        try {
            await fs.access(indexHtmlPath);
            console.log(`XR_ANALYSIS_VIEWER: Found index.html at ${indexHtmlPath}`);
        } catch (error) {
            throw new Error(`index.html not found at ${indexHtmlPath}. XR template generation may have failed.`);
        }
        
        // Launch the local server for XR analysis
        const customServerName = `Analysis XR ${baseName}`;
        console.log(`XR_ANALYSIS_VIEWER: Launching XR server with name: ${customServerName}`);
        
        const launchResult = await launchServerWithFile(context, indexHtmlPath, customServerName);
        
        if (launchResult.success) {
            console.log(`XR_ANALYSIS_VIEWER: XR server launched successfully at ${launchResult.serverUrl}`);
            
            // Register the file-to-server mapping for SSE notifications
            if (launchResult.port) {
                console.log(`XR_ANALYSIS_VIEWER: Registering file-to-server mapping for ${fileName}`);
                
                fileToServerMap.registerMapping(fileName, {
                    port: launchResult.port,
                    tempDir: tempFolder.fsPath,
                    fileUri: fileName,
                    serverRef: null as any // Server reference not available from launch result
                });
                
                console.log(`XR_ANALYSIS_VIEWER: File-to-server mapping registered for ${fileName} on port ${launchResult.port}`);
            }
            
            // Show success message with server URL
            vscode.window.showInformationMessage(
                `XR analysis viewer launched for ${baseName}`,
                'Open in Browser'
            ).then(selection => {
                if (selection === 'Open in Browser' && launchResult.serverUrl) {
                    vscode.env.openExternal(vscode.Uri.parse(launchResult.serverUrl));
                }
            });
        } else {
            throw new Error(`Failed to launch XR server: ${launchResult.error}`);
        }
        
        console.log(`XR_ANALYSIS_VIEWER: XR analysis viewer assets prepared successfully at ${tempFolder.fsPath}`);
        return tempFolder;
        
    } catch (error) {
        console.error(`XR_ANALYSIS_VIEWER: Error preparing XR analysis viewer: ${error}`);
        throw new Error(`Failed to prepare XR analysis viewer: ${error}`);
    }
}
