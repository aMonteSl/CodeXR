import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { generateNonce } from '../../../utils/nonceGenerator';
import { ThemeUtils } from '../utils/themeUtils';

/**
 * Directory Parser for LivePanel Analysis - NEW FLOW
 * 
 * This class:
 * - Receives analysis type and mode from LivePanelDirectoryRequirements
 * - Loads template files from templates/analysis_livePanel/directory/
 * - Returns loaded files (actual content, not paths)
 */
export class DirectoryLivePanelParser {

    constructor() {
        console.log('DIRECTORY_LIVE_PANEL_PARSER: Initializing DirectoryLivePanelParser...');
    }

    /**
     * Load template files from the corresponding directory
     * 
     * @param targetType - Analysis type (file/directory)
     * @param analysisMode - Analysis mode (LivePanel/XR)
     * @param theme - Current user theme (optional, defaults to 'vscode-light')
     * @returns Map with fileName -> fileContent
     */
    public async loadTemplateFiles(targetType: string, analysisMode: string, theme?: string): Promise<Map<string, string>> {
        console.log(`DIRECTORY_LIVE_PANEL_PARSER: 🔍 Loading template files for ${targetType} ${analysisMode} analysis`);
        console.log(`DIRECTORY_LIVE_PANEL_PARSER: Theme: ${theme || 'default'}`);
        
        try {
            // Build path to templates
            const templatePath = this.getTemplatePath(targetType);
            console.log(`DIRECTORY_LIVE_PANEL_PARSER: 📂 Template path: ${templatePath}`);
            
            // Load all files from template directory
            const loadedFiles = await this.loadAllFilesFromDirectory(templatePath);
            
            // Process files with placeholders
            const processedFiles = await this.processTemplateFiles(loadedFiles, targetType, analysisMode, theme);
            
            console.log(`DIRECTORY_LIVE_PANEL_PARSER: ✅ Processed ${processedFiles.size} template files`);
            
            // Print details of processed files
            if (processedFiles.size > 0) {
                console.log(`DIRECTORY_LIVE_PANEL_PARSER: 📋 Processed template files:`);
                for (const [fileName, content] of processedFiles) {
                    console.log(`DIRECTORY_LIVE_PANEL_PARSER: 📄 ${fileName} (${content.length} chars)`);
                }
            } else {
                console.log(`DIRECTORY_LIVE_PANEL_PARSER: ⚠️ No template files processed`);
            }
            
            return processedFiles;
            
        } catch (error) {
            console.error(`DIRECTORY_LIVE_PANEL_PARSER: ❌ Error loading template files:`, error);
            throw error;
        }
    }

    /**
     * Build path to templates directory
     */
    private getTemplatePath(targetType: string): string {
        // Get extension path
        const extensionPath = this.getExtensionPath();
        
        // Build path directly to existing templates:
        // /CodeXR/templates/analysis_livePanel/directory/
        return path.join(extensionPath, 'templates', 'analysis_livePanel', targetType);
    }

    /**
     * Load all files from a directory
     */
    private async loadAllFilesFromDirectory(dirPath: string): Promise<Map<string, string>> {
        const loadedFiles = new Map<string, string>();
        
        try {
            // Verify directory exists
            if (!fs.existsSync(dirPath)) {
                throw new Error(`Template directory does not exist: ${dirPath}`);
            }
            
            // Read all files from directory
            const files = fs.readdirSync(dirPath);
            console.log(`DIRECTORY_LIVE_PANEL_PARSER: Found ${files.length} files in template directory`);
            
            for (const fileName of files) {
                const filePath = path.join(dirPath, fileName);
                const stats = fs.statSync(filePath);
                
                // Only process files (not directories)
                if (stats.isFile()) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    loadedFiles.set(fileName, content);
                    console.log(`DIRECTORY_LIVE_PANEL_PARSER: 📖 Loaded ${fileName}`);
                }
            }
            
        } catch (error) {
            console.error(`DIRECTORY_LIVE_PANEL_PARSER: Error reading directory ${dirPath}:`, error);
            throw error;
        }
        
        return loadedFiles;
    }

    /**
     * Get extension base path
     */
    private getExtensionPath(): string {
        const extension = vscode.extensions.getExtension('amonteSl.code-xr');
        if (!extension) {
            throw new Error('Extension not found');
        }
        return extension.extensionPath;
    }

    /**
     * Process template files replacing placeholders
     */
    private async processTemplateFiles(
        loadedFiles: Map<string, string>, 
        targetType: string, 
        analysisMode: string,
        theme?: string
    ): Promise<Map<string, string>> {
        console.log(`DIRECTORY_LIVE_PANEL_PARSER: 🔄 Processing ${loadedFiles.size} template files...`);
        console.log(`DIRECTORY_LIVE_PANEL_PARSER: Using theme: ${theme || 'light'}`);
        
        const processedFiles = new Map<string, string>();
        const nonce = generateNonce(); // Generate unique nonce for this session
        
        for (const [fileName, content] of loadedFiles) {
            let processedContent = content;
            
            if (fileName.endsWith('.html')) {
                console.log(`DIRECTORY_LIVE_PANEL_PARSER: Processing HTML file: ${fileName}`);
                processedContent = await this.processHtmlTemplate(content, nonce, theme);
            } else if (fileName.endsWith('.js')) {
                console.log(`DIRECTORY_LIVE_PANEL_PARSER: Processing JS file: ${fileName} -> main.js`);
                // Rename JS file to main.js as requested
                processedFiles.set('main.js', content);
                continue;
            } else if (fileName.endsWith('.css')) {
                console.log(`DIRECTORY_LIVE_PANEL_PARSER: Processing CSS file: ${fileName} -> style.css`);
                // Rename CSS file to style.css
                processedFiles.set('style.css', content);
                continue;
            }
            
            processedFiles.set(fileName, processedContent);
        }
        
        console.log(`DIRECTORY_LIVE_PANEL_PARSER: ✅ Template processing completed`);
        return processedFiles;
    }

    /**
     * Process HTML templates replacing placeholders
     */
    private async processHtmlTemplate(content: string, nonce: string, theme?: string): Promise<string> {
        console.log(`DIRECTORY_LIVE_PANEL_PARSER: 🔄 Processing HTML template...`);
        console.log(`DIRECTORY_LIVE_PANEL_PARSER: 📋 Received theme parameter: '${theme}'`);
        
        // Get user's preferred theme from settings if not provided
        let actualTheme = theme;
        if (!actualTheme) {
            console.log(`DIRECTORY_LIVE_PANEL_PARSER: 🔍 No theme parameter, calling ThemeUtils.getUserTheme()`);
            try {
                actualTheme = await ThemeUtils.getUserTheme();
                console.log(`DIRECTORY_LIVE_PANEL_PARSER: ✅ Retrieved user theme from settings: ${actualTheme}`);
            } catch (error) {
                console.warn(`DIRECTORY_LIVE_PANEL_PARSER: ❌ Failed to get user theme, using default: ${error}`);
                actualTheme = 'light';
            }
        } else {
            console.log(`DIRECTORY_LIVE_PANEL_PARSER: 🔄 Converting theme parameter '${theme}'`);
            // Convert the theme parameter to template format (Dark -> dark, Light -> light)
            if (actualTheme === 'Dark' || actualTheme === 'dark') {
                actualTheme = 'dark';
                console.log(`DIRECTORY_LIVE_PANEL_PARSER: ✅ Converted 'Dark' to 'dark'`);
            } else if (actualTheme === 'Light' || actualTheme === 'light') {
                actualTheme = 'light';
                console.log(`DIRECTORY_LIVE_PANEL_PARSER: ✅ Converted 'Light' to 'light'`);
            } else {
                console.warn(`DIRECTORY_LIVE_PANEL_PARSER: ⚠️ Unknown theme '${actualTheme}', using default light`);
                actualTheme = 'light';
            }
            console.log(`DIRECTORY_LIVE_PANEL_PARSER: 🎯 Final conversion: '${theme}' → '${actualTheme}'`);
        }
        
        console.log(`DIRECTORY_LIVE_PANEL_PARSER: 🎨 Final theme to apply: '${actualTheme}'`);
        
        return content
            .replace(/\$\{nonce\}/g, nonce)
            .replace(/\$\{styleUri\}/g, 'style.css')  // Processed CSS file
            .replace(/\$\{scriptUri\}/g, 'main.js')   // Processed JS file as main.js
            .replace(/\$\{theme\}/g, actualTheme);     // User's current theme
    }
}
