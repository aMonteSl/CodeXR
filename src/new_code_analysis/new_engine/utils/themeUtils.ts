import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Theme utilities for new analysis engine
 * 
 * This utility provides functions to retrieve and apply user's theme preferences
 * from the analysis configuration storage.
 */
export class ThemeUtils {

    private static context: vscode.ExtensionContext | null = null;
    private static readonly STORAGE_FOLDER = 'codexr_analysis';
    private static readonly CONFIG_FILE = 'configuration_analysis.json';

    /**
     * Initialize the theme utils with extension context
     */
    public static initialize(context: vscode.ExtensionContext): void {
        this.context = context;
        console.log('THEME_UTILS:  Initialized with extension context');
        console.log(`THEME_UTILS:  GlobalStorage path: ${context.globalStorageUri.fsPath}`);
        
        // Test configuration loading immediately
        this.testConfigurationAccess();
    }

    /**
     * Test if we can access the configuration file
     */
    private static async testConfigurationAccess(): Promise<void> {
        try {
            const theme = await this.getUserTheme();
            console.log(`THEME_UTILS:  Initialization test - detected theme: ${theme}`);
        } catch (error) {
            console.error('THEME_UTILS:  Initialization test failed:', error);
        }
    }

    /**
     * Get the full path to the configuration file
     */
    private static getConfigPath(): string {
        if (!this.context) {
            throw new Error('THEME_UTILS: Context not initialized');
        }
        
        return path.join(
            this.context.globalStorageUri.fsPath,
            this.STORAGE_FOLDER,
            this.CONFIG_FILE
        );
    }

    /**
     * Load configuration from the actual file
     */
    private static async loadConfiguration(): Promise<any> {
        try {
            const configPath = this.getConfigPath();
            console.log(`THEME_UTILS: Loading configuration from ${configPath}`);
            
            // Check if file exists
            if (!fs.existsSync(configPath)) {
                console.warn(`THEME_UTILS:  Configuration file not found at ${configPath}`);
                return null;
            }
            
            // Check file stats
            const stats = fs.statSync(configPath);
            console.log(`THEME_UTILS:  File size: ${stats.size} bytes, modified: ${stats.mtime}`);
            
            const configContent = fs.readFileSync(configPath, 'utf8');
            console.log(`THEME_UTILS:  Raw content length: ${configContent.length} chars`);
            
            const config = JSON.parse(configContent);
            
            console.log(`THEME_UTILS:  Configuration loaded successfully`);
            console.log(`THEME_UTILS:  ViewTheme value: ${config?.configuration?.viewTheme}`);
            
            return config;
            
        } catch (error) {
            console.error(`THEME_UTILS:  Error loading configuration:`, error);
            if (error instanceof Error) {
                console.error(`THEME_UTILS:  Error type: ${error.constructor.name}`);
                console.error(`THEME_UTILS:  Error message: ${error.message}`);
            }
            return null;
        }
    }

    /**
     * Get the user's selected theme from analysis settings
     * @returns The theme name ('light' or 'dark')
     */
    public static async getUserTheme(): Promise<string> {
        console.log(`THEME_UTILS:  getUserTheme called, context initialized: ${!!this.context}`);
        
        if (!this.context) {
            console.warn('THEME_UTILS:  Extension context not initialized, trying fallback method');
            // Try fallback method without context
            return this.getUserThemeFallback();
        }

        try {
            const config = await this.loadConfiguration();
            
            if (!config || !config.configuration || !config.configuration.viewTheme) {
                console.warn('THEME_UTILS:  No viewTheme found in configuration, trying fallback');
                return this.getUserThemeFallback();
            }
            
            const viewTheme = config.configuration.viewTheme;
            console.log(`THEME_UTILS:  Retrieved viewTheme from config: ${viewTheme}`);
            
            // Convert the viewTheme value to template theme class (simply "dark" or "light")
            let templateTheme: string;
            if (viewTheme === 'Dark' || viewTheme === 'dark') {
                templateTheme = 'dark';
            } else if (viewTheme === 'Light' || viewTheme === 'light') {
                templateTheme = 'light';
            } else {
                console.warn(`THEME_UTILS:  Unknown viewTheme '${viewTheme}', using default light theme`);
                templateTheme = 'light';
            }
            
            console.log(`THEME_UTILS:  Converted to template theme: ${templateTheme}`);
            return templateTheme;
            
        } catch (error) {
            console.error('THEME_UTILS:  Error retrieving user theme:', error);
            console.warn('THEME_UTILS:  Trying fallback method');
            return this.getUserThemeFallback();
        }
    }

    /**
     * Fallback method to get theme without context dependency
     */
    private static getUserThemeFallback(): string {
        try {
            // Try to read directly from the known path
            const fallbackPath = '/home/adrian/.config/Code/User/globalStorage/amontesl.code-xr/codexr_analysis/configuration_analysis.json';
            console.log(`THEME_UTILS:  Trying fallback path: ${fallbackPath}`);
            
            if (fs.existsSync(fallbackPath)) {
                const configContent = fs.readFileSync(fallbackPath, 'utf8');
                const config = JSON.parse(configContent);
                
                if (config?.configuration?.viewTheme) {
                    const viewTheme = config.configuration.viewTheme;
                    console.log(`THEME_UTILS:  Fallback found viewTheme: ${viewTheme}`);
                    
                    if (viewTheme === 'Dark' || viewTheme === 'dark') {
                        return 'dark';
                    } else if (viewTheme === 'Light' || viewTheme === 'light') {
                        return 'light';
                    }
                }
            }
        } catch (error) {
            console.error('THEME_UTILS:  Fallback method failed:', error);
        }
        
        console.log('THEME_UTILS:  All methods failed, using default light theme');
        return 'light';
    }

    /**
     * Get the user's selected theme synchronously (if context is available)
     * Note: This is a fallback method, prefer async getUserTheme()
     */
    public static getUserThemeSync(): string {
        // For now, return default theme for sync calls
        // This could be enhanced to cache the last known theme
        console.warn('THEME_UTILS: Sync theme access requested, returning default');
        return 'light';
    }

    /**
     * Get CSS class name for the user's theme
     * @returns The CSS class name for the theme
     */
    public static async getUserThemeClass(): Promise<string> {
        const theme = await this.getUserTheme();
        return theme; // The theme name is already the CSS class name
    }

    /**
     * Check if user has dark theme enabled
     * @returns true if dark theme is enabled
     */
    public static async isDarkTheme(): Promise<boolean> {
        const theme = await this.getUserTheme();
        return theme === 'dark';
    }

    /**
     * Check if user has light theme enabled
     * @returns true if light theme is enabled
     */
    public static async isLightTheme(): Promise<boolean> {
        const theme = await this.getUserTheme();
        return theme === 'light';
    }

    /**
     * Get theme-specific color values for charts and UI elements
     * @returns Object with theme-specific colors
     */
    public static async getThemeColors(): Promise<{ foreground: string; background: string; border: string }> {
        const isDark = await this.isDarkTheme();
        
        return {
            foreground: isDark ? '#ffffff' : '#000000',
            background: isDark ? '#1e1e1e' : '#ffffff', 
            border: isDark ? '#404040' : '#e0e0e0'
        };
    }
}
