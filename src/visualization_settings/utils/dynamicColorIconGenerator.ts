import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Dynamic SVG Color Icon Generator
 * Generates and manages SVG icons for color visualization in tree items
 */
export class DynamicColorIconGenerator {
    private static readonly VISUALIZATION_CONFIG_DIR = 'visualization-configuration';
    private static readonly ICON_SIZE = 16; // 16x16 pixels for VS Code tree items
    
    /**
     * Generate a square SVG icon for a given hex color
     */
    private static generateColorSVG(hexColor: string): string {
        // Ensure the color is properly formatted
        const cleanColor = hexColor.startsWith('#') ? hexColor : `#${hexColor}`;
        
        console.log(`COLOR-PICKER: Generating SVG for color ${cleanColor}`);
        
        return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${this.ICON_SIZE}" height="${this.ICON_SIZE}" viewBox="0 0 ${this.ICON_SIZE} ${this.ICON_SIZE}" xmlns="http://www.w3.org/2000/svg">
    <!-- Background square with subtle border -->
    <rect x="1" y="1" width="14" height="14" 
          fill="${cleanColor}" 
          stroke="rgba(255,255,255,0.3)" 
          stroke-width="0.5" 
          rx="2" ry="2"/>
    <!-- Subtle inner shadow effect -->
    <rect x="1.5" y="1.5" width="13" height="13" 
          fill="none" 
          stroke="rgba(0,0,0,0.15)" 
          stroke-width="0.5" 
          rx="1.5" ry="1.5"/>
</svg>`;
    }
    
    /**
     * Get the global storage directory for color icons
     */
    private static getColorIconsDirectory(context: vscode.ExtensionContext): string {
        const globalStorageUri = context.globalStorageUri;
        const colorIconsPath = path.join(globalStorageUri.fsPath, this.VISUALIZATION_CONFIG_DIR);
        
        console.log(`COLOR-PICKER: Visualization configuration directory: ${colorIconsPath}`);
        return colorIconsPath;
    }
    
    /**
     * Ensure the color icons directory exists
     */
    private static ensureColorIconsDirectory(context: vscode.ExtensionContext): void {
        const configPath = this.getColorIconsDirectory(context);
        
        try {
            if (!fs.existsSync(configPath)) {
                console.log(`COLOR-PICKER: Creating visualization configuration directory: ${configPath}`);
                fs.mkdirSync(configPath, { recursive: true });
            }
        } catch (error) {
            console.error(`COLOR-PICKER: Error creating visualization configuration directory:`, error);
            throw new Error(`Failed to create visualization configuration directory: ${error}`);
        }
    }
    
    /**
     * Generate filename for a color icon
     */
    private static getColorIconFilename(settingKey: string, hexColor: string): string {
        // Remove # from hex color and make it safe for filename
        const cleanColor = hexColor.replace('#', '').toLowerCase();
        return `${settingKey}_${cleanColor}.svg`;
    }
    
    /**
     * Generate and save a color icon, return the file URI
     */
    public static async generateColorIcon(
        context: vscode.ExtensionContext,
        settingKey: string,
        hexColor: string
    ): Promise<vscode.Uri> {
        console.log(`COLOR-PICKER: Generating color icon for ${settingKey} with color ${hexColor}`);
        
        try {
            // Ensure directory exists
            this.ensureColorIconsDirectory(context);
            
            // Generate SVG content
            const svgContent = this.generateColorSVG(hexColor);
            
            // Create filename and full path
            const filename = this.getColorIconFilename(settingKey, hexColor);
            const configPath = this.getColorIconsDirectory(context);
            const iconPath = path.join(configPath, filename);
            
            // Write SVG file
            fs.writeFileSync(iconPath, svgContent, 'utf8');
            console.log(`COLOR-PICKER: Color icon saved to: ${iconPath}`);
            
            // Return VS Code URI
            const iconUri = vscode.Uri.file(iconPath);
            console.log(`COLOR-PICKER: Color icon URI: ${iconUri.toString()}`);
            
            return iconUri;
            
        } catch (error) {
            console.error(`COLOR-PICKER: Error generating color icon for ${settingKey}:`, error);
            throw new Error(`Failed to generate color icon: ${error}`);
        }
    }
    
    /**
     * Get existing color icon URI if it exists, otherwise generate new one
     */
    public static async getOrCreateColorIcon(
        context: vscode.ExtensionContext,
        settingKey: string,
        hexColor: string
    ): Promise<vscode.Uri> {
        console.log(`COLOR-PICKER: Getting or creating color icon for ${settingKey} with color ${hexColor}`);
        
        try {
            const configPath = this.getColorIconsDirectory(context);
            const filename = this.getColorIconFilename(settingKey, hexColor);
            const iconPath = path.join(configPath, filename);
            
            if (fs.existsSync(iconPath)) {
                console.log(`COLOR-PICKER: Using existing color icon: ${iconPath}`);
                return vscode.Uri.file(iconPath);
            } else {
                console.log(`COLOR-PICKER: Creating new color icon for ${settingKey}`);
                return await this.generateColorIcon(context, settingKey, hexColor);
            }
            
        } catch (error) {
            console.error(`COLOR-PICKER: Error getting/creating color icon:`, error);
            throw error;
        }
    }
    
    /**
     * Clean up old color icons for a specific setting
     */
    public static cleanupOldColorIcons(
        context: vscode.ExtensionContext,
        settingKey: string,
        currentHexColor: string
    ): void {
        console.log(`COLOR-PICKER: Cleaning up old color icons for ${settingKey}`);
        
        try {
            const configPath = this.getColorIconsDirectory(context);
            
            if (!fs.existsSync(configPath)) {
                return;
            }
            
            // Read directory and find old icons for this setting
            const files = fs.readdirSync(configPath);
            const currentFilename = this.getColorIconFilename(settingKey, currentHexColor);
            
            let cleanedCount = 0;
            files.forEach(file => {
                if (file.startsWith(`${settingKey}_`) && file.endsWith('.svg') && file !== currentFilename) {
                    const oldIconPath = path.join(configPath, file);
                    try {
                        fs.unlinkSync(oldIconPath);
                        cleanedCount++;
                        console.log(`COLOR-PICKER: Removed old color icon: ${file}`);
                    } catch (error) {
                        console.warn(`COLOR-PICKER: Failed to remove old icon ${file}:`, error);
                    }
                }
            });
            
            if (cleanedCount > 0) {
                console.log(`COLOR-PICKER: Cleaned up ${cleanedCount} old color icons for ${settingKey}`);
            }
            
        } catch (error) {
            console.error(`COLOR-PICKER: Error during cleanup for ${settingKey}:`, error);
            // Don't throw - cleanup is non-critical
        }
    }
    
    /**
     * Validate hex color format
     */
    public static isValidHexColor(color: string): boolean {
        const hexPattern = /^#[0-9A-Fa-f]{6}$/;
        return hexPattern.test(color);
    }
    
    /**
     * Normalize hex color to uppercase with # prefix
     */
    public static normalizeHexColor(color: string): string {
        if (!color) {
            return '#FFFFFF';
        }
        
        let normalized = color.trim().toUpperCase();
        if (!normalized.startsWith('#')) {
            normalized = `#${normalized}`;
        }
        
        return this.isValidHexColor(normalized) ? normalized : '#FFFFFF';
    }
}
