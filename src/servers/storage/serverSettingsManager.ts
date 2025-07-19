import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { generateNonce } from '../../utils/nonceGenerator';

/**
 * Structured server configuration interface
 */
export interface ServerSettings {
    mode: 'HTTP' | 'HTTPS';
    https: {
        certSource: 'default' | 'custom';
        certPath: string;
        keyPath: string;
    };
    defaultPort: number;
    launch: {
        autoOpen: boolean;
        openMode: 'browser' | 'lateralPanel';
    };
    configNonce: string;
    version: string;
}

/**
 * Default server settings
 */
export const DEFAULT_SERVER_SETTINGS: ServerSettings = {
    mode: 'HTTPS',
    https: {
        certSource: 'default',
        certPath: '',
        keyPath: ''
    },
    defaultPort: 3000,
    launch: {
        autoOpen: true,
        openMode: 'browser'
    },
    configNonce: generateNonce(),
    version: '1.0.0'
};

/**
 * Server Settings Manager
 * Handles structured storage and retrieval of server configuration using file system
 */
export class ServerSettingsManager {
    private static instance: ServerSettingsManager;
    private settings: ServerSettings;
    private context: vscode.ExtensionContext;
    private readonly SETTINGS_FILENAME = 'server-settings.json';
    private settingsFilePath: string;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.settings = { ...DEFAULT_SERVER_SETTINGS };
        this.settingsFilePath = path.join(context.globalStorageUri.fsPath, this.SETTINGS_FILENAME);
        this.ensureStorageDirectory();
    }

    /**
     * Ensure the global storage directory exists
     */
    private ensureStorageDirectory(): void {
        const storageDir = path.dirname(this.settingsFilePath);
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
            console.log(`SERVER: Created storage directory: ${storageDir}`);
        }
    }

    /**
     * Get singleton instance
     */
    public static getInstance(context?: vscode.ExtensionContext): ServerSettingsManager {
        if (!ServerSettingsManager.instance) {
            if (!context) {
                throw new Error('SERVER: Context required for first initialization');
            }
            ServerSettingsManager.instance = new ServerSettingsManager(context);
        }
        return ServerSettingsManager.instance;
    }

    /**
     * Get current server settings
     */
    public getServerSettings(): ServerSettings {
        return { ...this.settings };
    }

    /**
     * Get extension context
     */
    public getExtensionContext(): vscode.ExtensionContext {
        return this.context;
    }

    /**
     * Update server settings
     */
    public async updateServerSettings(updates: Partial<ServerSettings>): Promise<void> {
        console.log('SERVER: Updating server settings', updates);
        
        // Deep merge the updates
        this.settings = this.deepMerge(this.settings, updates);
        this.settings.configNonce = generateNonce();
        
        // Persist to file system asynchronously
        await this.persistSettings();
        
        // Refresh the tree view
        vscode.commands.executeCommand('codexr.servers.refresh');
    }

    /**
     * Restore server settings from file system
     */
    public async restoreServerSettings(): Promise<void> {
        console.log('SERVER: Restoring server settings from file system');
        console.log('SERVER: Settings file path:', this.settingsFilePath);
        
        try {
            if (fs.existsSync(this.settingsFilePath)) {
                console.log('SERVER: Settings file exists, reading content...');
                const fileContent = await fs.promises.readFile(this.settingsFilePath, 'utf8');
                const savedSettings = JSON.parse(fileContent) as ServerSettings;
                
                console.log('SERVER: Loaded settings from file:', savedSettings);
                
                // Validate and merge with defaults to ensure all required fields exist
                this.settings = this.deepMerge(DEFAULT_SERVER_SETTINGS, savedSettings);
                
                // Regenerate nonce on restore for security
                this.settings.configNonce = generateNonce();
                
                console.log('SERVER: Settings merged with defaults and nonce regenerated');
                console.log('SERVER: Final restored settings:', this.settings);
                
                // Persist the updated settings with new nonce
                await this.persistSettings();
                
                console.log('SERVER: Settings successfully restored from file system');
            } else {
                console.log('SERVER: No saved settings file found at:', this.settingsFilePath);
                console.log('SERVER: Using default settings and creating initial file');
                this.settings = { ...DEFAULT_SERVER_SETTINGS };
                await this.persistSettings();
                console.log('SERVER: Default settings applied and file created');
            }
        } catch (error) {
            console.error('SERVER: Error restoring settings from file system:', error);
            console.log('SERVER: Falling back to default settings');
            this.settings = { ...DEFAULT_SERVER_SETTINGS };
            await this.persistSettings();
        }
    }

    /**
     * Persist settings to file system
     */
    private async persistSettings(): Promise<void> {
        try {
            this.ensureStorageDirectory();
            
            const settingsJson = JSON.stringify(this.settings, null, 2);
            await fs.promises.writeFile(this.settingsFilePath, settingsJson, 'utf8');
            
            console.log(`SERVER: Settings persisted to file system: ${this.settingsFilePath}`);
        } catch (error) {
            console.error('SERVER: Error persisting settings to file system', error);
            throw error;
        }
    }

    /**
     * Reset settings to defaults
     */
    public async resetSettings(): Promise<void> {
        console.log('SERVER: Resetting settings to defaults');
        this.settings = { ...DEFAULT_SERVER_SETTINGS };
        this.settings.configNonce = generateNonce();
        await this.persistSettings();
        vscode.commands.executeCommand('codexr.servers.refresh');
    }

    /**
     * Get the path to the settings file
     */
    public getSettingsFilePath(): string {
        return this.settingsFilePath;
    }

    /**
     * Deep merge utility for partial updates
     */
    private deepMerge(target: any, source: any): any {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }

    /**
     * Get settings in legacy format for UI compatibility
     */
    public getLegacyConfig(): {
        httpMode: string;
        port: number;
        autoOpen: boolean;
        openMode: string;
    } {
        let httpModeDisplay: string;
        
        if (this.settings.mode === 'HTTP') {
            httpModeDisplay = 'HTTP';
        } else {
            // HTTPS mode
            if (this.settings.https.certSource === 'default') {
                httpModeDisplay = 'HTTPS (default certificates)';
            } else {
                // Custom certificates - show paths if available for debugging
                const certInfo = this.settings.https.certPath && this.settings.https.keyPath 
                    ? ` [Cert: ${this.settings.https.certPath}, Key: ${this.settings.https.keyPath}]`
                    : ' [Paths not configured]';
                httpModeDisplay = `HTTPS (custom certificates)${certInfo}`;
                
                console.log('SERVER: Custom HTTPS certificate status:', {
                    certPath: this.settings.https.certPath,
                    keyPath: this.settings.https.keyPath,
                    certSource: this.settings.https.certSource
                });
            }
        }
        
        const openModeDisplay = this.settings.launch.openMode === 'browser' ? 'Browser' : 'Lateral Panel';
        
        const config = {
            httpMode: httpModeDisplay,
            port: this.settings.defaultPort,
            autoOpen: this.settings.launch.autoOpen,
            openMode: openModeDisplay
        };
        
        console.log('SERVER: Legacy config generated:', config);
        return config;
    }

    /**
     * Update settings from legacy format
     */
    public async updateFromLegacyConfig(updates: any): Promise<void> {
        const newUpdates: Partial<ServerSettings> = {};
        
        // Handle HTTP mode changes
        if (updates.httpMode) {
            if (updates.httpMode === 'HTTP') {
                newUpdates.mode = 'HTTP';
            } else if (updates.httpMode === 'HTTPS (default certificates)') {
                newUpdates.mode = 'HTTPS';
                newUpdates.https = { 
                    ...this.settings.https,
                    certSource: 'default'
                };
            } else if (updates.httpMode === 'HTTPS (custom certificates)') {
                newUpdates.mode = 'HTTPS';
                newUpdates.https = { 
                    ...this.settings.https,
                    certSource: 'custom'
                };
            }
        }
        
        // Handle certificate and key path updates
        // Merge these into the existing https object to avoid overwriting
        if (updates.customCertPath !== undefined || updates.customKeyPath !== undefined) {
            const currentHttps = newUpdates.https || this.settings.https;
            newUpdates.https = {
                ...currentHttps,
                ...(updates.customCertPath !== undefined && { certPath: updates.customCertPath }),
                ...(updates.customKeyPath !== undefined && { keyPath: updates.customKeyPath })
            };
            
            console.log('SERVER: Updating HTTPS certificate paths', {
                certPath: newUpdates.https.certPath,
                keyPath: newUpdates.https.keyPath,
                certSource: newUpdates.https.certSource
            });
        }
        
        // Handle port updates
        if (updates.port !== undefined) {
            newUpdates.defaultPort = updates.port;
        }
        
        // Handle launch configuration updates
        if (updates.autoOpen !== undefined || updates.openMode !== undefined) {
            newUpdates.launch = {
                ...this.settings.launch,
                ...(updates.autoOpen !== undefined && { autoOpen: updates.autoOpen }),
                ...(updates.openMode !== undefined && { 
                    openMode: updates.openMode === 'Browser' ? 'browser' : 'lateralPanel' 
                })
            };
        }
        
        console.log('SERVER: Legacy config update merged:', newUpdates);
        await this.updateServerSettings(newUpdates);
    }
}
