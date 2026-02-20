import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { generateNonce } from '../../../utils/nonceGenerator';
import { ThemeUtils } from '../utils/themeUtils';

/**
 * File Parser for LivePanel Analysis - NEW FLOW
 * 
 * This class:
 * - Receives analysis type and mode from LivePanelFileRequirements
 * - Loads template files from templates/analysis_livePanel/file/
 * - Returns loaded files (actual content, not paths)
 */
export class FileLivePanelParser {

    constructor() {
        console.log('FILE_LIVE_PANEL_PARSER: Initializing FileLivePanelParser...');
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
        console.log(`FILE_LIVE_PANEL_PARSER: 🔍 Loading template files for ${targetType} ${analysisMode} analysis`);
        console.log(`FILE_LIVE_PANEL_PARSER: Theme: ${theme || 'default'}`);
        
        try {
            // Construir la ruta a los templates
            const templatePath = this.getTemplatePath(targetType);
            console.log(`FILE_LIVE_PANEL_PARSER: 📂 Template path: ${templatePath}`);
            
            // Cargar todos los archivos del directorio template
            const loadedFiles = await this.loadAllFilesFromDirectory(templatePath);
            
            // Procesar los archivos con placeholders
            const processedFiles = await this.processTemplateFiles(loadedFiles, targetType, analysisMode, theme);
            
            console.log(`FILE_LIVE_PANEL_PARSER: ✅ Processed ${processedFiles.size} template files`);
            
            // Imprimir detalles de los archivos procesados
            if (processedFiles.size > 0) {
                console.log(`FILE_LIVE_PANEL_PARSER: 📋 Processed template files:`);
                for (const [fileName, content] of processedFiles) {
                    console.log(`FILE_LIVE_PANEL_PARSER: 📄 ${fileName} (${content.length} chars)`);
                }
            } else {
                console.log(`FILE_LIVE_PANEL_PARSER: ⚠️ No template files processed`);
            }
            
            return processedFiles;
            
        } catch (error) {
            console.error(`FILE_LIVE_PANEL_PARSER: ❌ Error loading template files:`, error);
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
        // /CodeXR/templates/analysis_livePanel/file/
        return path.join(extensionPath, 'templates', 'analysis_livePanel', targetType);
    }

    /**
     * Load all files from a directory
     */
    private async loadAllFilesFromDirectory(dirPath: string): Promise<Map<string, string>> {
        const loadedFiles = new Map<string, string>();
        
        try {
            // Verificar que el directorio existe
            if (!fs.existsSync(dirPath)) {
                throw new Error(`Template directory does not exist: ${dirPath}`);
            }
            
            // Leer todos los archivos del directorio
            const files = fs.readdirSync(dirPath);
            console.log(`FILE_LIVE_PANEL_PARSER: Found ${files.length} files in template directory`);
            
            for (const fileName of files) {
                const filePath = path.join(dirPath, fileName);
                const stats = fs.statSync(filePath);
                
                // Solo procesar archivos (no directorios)
                if (stats.isFile()) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    loadedFiles.set(fileName, content);
                    console.log(`FILE_LIVE_PANEL_PARSER: 📖 Loaded ${fileName}`);
                }
            }
            
        } catch (error) {
            console.error(`FILE_LIVE_PANEL_PARSER: Error reading directory ${dirPath}:`, error);
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
        console.log(`FILE_LIVE_PANEL_PARSER: 🔄 Processing ${loadedFiles.size} template files...`);
        console.log(`FILE_LIVE_PANEL_PARSER: Using theme: ${theme || 'light'}`);
        
        const processedFiles = new Map<string, string>();
        const nonce = generateNonce(); // Generar nonce único para esta sesión
        
        // Buscar el archivo JS principal (el que no está vacío)
        let mainJsContent = '';
        let mainJsFound = false;
        
        for (const [fileName, content] of loadedFiles) {
            if (fileName.endsWith('.js') && content.trim().length > 0) {
                console.log(`FILE_LIVE_PANEL_PARSER: Found main JS file: ${fileName} (${content.length} chars)`);
                mainJsContent = content;
                mainJsFound = true;
                break; // Usar el primer archivo JS no vacío
            }
        }
        
        for (const [fileName, content] of loadedFiles) {
            let processedContent = content;
            
            if (fileName.endsWith('.html')) {
                console.log(`FILE_LIVE_PANEL_PARSER: Processing HTML file: ${fileName}`);
                processedContent = await this.processHtmlTemplate(content, nonce, theme);
                processedFiles.set(fileName, processedContent);
            } else if (fileName.endsWith('.js')) {
                // Solo procesar el primer archivo JS no vacío encontrado
                if (mainJsFound && fileName === Array.from(loadedFiles.keys()).find(name => 
                    name.endsWith('.js') && loadedFiles.get(name)?.trim().length! > 0)) {
                    console.log(`FILE_LIVE_PANEL_PARSER: Processing main JS file: ${fileName} -> main.js (${mainJsContent.length} chars)`);
                    processedFiles.set('main.js', mainJsContent);
                } else {
                    console.log(`FILE_LIVE_PANEL_PARSER: Skipping JS file: ${fileName} (empty or duplicate)`);
                }
            } else if (fileName.endsWith('.css')) {
                console.log(`FILE_LIVE_PANEL_PARSER: Processing CSS file: ${fileName} -> style.css`);
                processedFiles.set('style.css', content);
            } else {
                // Otros archivos se mantienen tal como están
                processedFiles.set(fileName, processedContent);
            }
        }
        
        console.log(`FILE_LIVE_PANEL_PARSER: ✅ Template processing completed`);
        return processedFiles;
    }

    /**
     * Process HTML templates replacing placeholders
     */
    private async processHtmlTemplate(content: string, nonce: string, theme?: string): Promise<string> {
        console.log(`FILE_LIVE_PANEL_PARSER: 🔄 Processing HTML template...`);
        console.log(`FILE_LIVE_PANEL_PARSER: 📋 Received theme parameter: '${theme}'`);
        
        // Get user's preferred theme from settings if not provided
        let actualTheme = theme;
        if (!actualTheme) {
            console.log(`FILE_LIVE_PANEL_PARSER: 🔍 No theme parameter, calling ThemeUtils.getUserTheme()`);
            try {
                actualTheme = await ThemeUtils.getUserTheme();
                console.log(`FILE_LIVE_PANEL_PARSER: ✅ Retrieved user theme from settings: ${actualTheme}`);
            } catch (error) {
                console.warn(`FILE_LIVE_PANEL_PARSER: ❌ Failed to get user theme, using default: ${error}`);
                actualTheme = 'light';
            }
        } else {
            console.log(`FILE_LIVE_PANEL_PARSER: 🔄 Converting theme parameter '${theme}'`);
            // Convert the theme parameter to template format (Dark -> dark, Light -> light)
            if (actualTheme === 'Dark' || actualTheme === 'dark') {
                actualTheme = 'dark';
                console.log(`FILE_LIVE_PANEL_PARSER: ✅ Converted 'Dark' to 'dark'`);
            } else if (actualTheme === 'Light' || actualTheme === 'light') {
                actualTheme = 'light';
                console.log(`FILE_LIVE_PANEL_PARSER: ✅ Converted 'Light' to 'light'`);
            } else {
                console.warn(`FILE_LIVE_PANEL_PARSER: ⚠️ Unknown theme '${actualTheme}', using default light`);
                actualTheme = 'light';
            }
            console.log(`FILE_LIVE_PANEL_PARSER: 🎯 Final conversion: '${theme}' → '${actualTheme}'`);
        }
        
        console.log(`FILE_LIVE_PANEL_PARSER: 🎨 Final theme to apply: '${actualTheme}'`);
        
        return content
            .replace(/\$\{nonce\}/g, nonce)
            .replace(/\$\{styleUri\}/g, 'style.css')  // Processed CSS file
            .replace(/\$\{scriptUri\}/g, 'main.js')   // Processed JS file as main.js
            .replace(/\$\{theme\}/g, actualTheme);     // User's current theme
    }
}
