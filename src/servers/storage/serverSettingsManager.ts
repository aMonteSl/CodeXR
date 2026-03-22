import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { generateNonce } from '../../utils/nonceGenerator';
import { CodeXRLogger } from '../../core/logging/logger';

const logger = CodeXRLogger.getLogger('SERVER_SETTINGS');

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
        keyPath: '',
    },
    defaultPort: 3000,
    launch: {
        autoOpen: true,
        openMode: 'browser',
    },
    configNonce: generateNonce(),
    version: '1.0.0',
};

/**
 * Server Settings Manager
 * Handles structured storage and retrieval of server configuration using file system.
 */
export class ServerSettingsManager {
    private static instance: ServerSettingsManager;
    private settings: ServerSettings;
    private context: vscode.ExtensionContext;
    private readonly SETTINGS_FILENAME = 'server-settings.json';
    private settingsFilePath: string;
    private initializationPromise: Promise<void> | null = null;
    private initialized = false;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.settings = { ...DEFAULT_SERVER_SETTINGS, configNonce: generateNonce() };
        this.settingsFilePath = path.join(context.globalStorageUri.fsPath, this.SETTINGS_FILENAME);
        this.ensureStorageDirectory();
    }

    /**
     * Ensure the global storage directory exists.
     */
    private ensureStorageDirectory(): void {
        const storageDir = path.dirname(this.settingsFilePath);
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
        }
    }

    /**
     * Get singleton instance.
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
     * Ensure settings have been loaded from disk.
     */
    public async ensureInitialized(): Promise<void> {
        if (this.initialized) {
            return;
        }

        if (!this.initializationPromise) {
            this.initializationPromise = this.restoreServerSettingsInternal();
        }

        await this.initializationPromise;
    }

    /**
     * Backward-compatible restore entry point.
     */
    public async restoreServerSettings(): Promise<void> {
        await this.ensureInitialized();
    }

    /**
     * Get current server settings.
     */
    public getServerSettings(): ServerSettings {
        return { ...this.settings };
    }

    /**
     * Get extension context.
     */
    public getExtensionContext(): vscode.ExtensionContext {
        return this.context;
    }

    /**
     * Update server settings.
     */
    public async updateServerSettings(updates: Partial<ServerSettings>): Promise<void> {
        await this.ensureInitialized();

        this.settings = this.withRuntimeNonce(this.deepMerge(this.settings, updates));
        await this.persistSettings();
        void vscode.commands.executeCommand('codexr.servers.refresh');
    }

    /**
     * Restore server settings from file system.
     */
    private async restoreServerSettingsInternal(): Promise<void> {
        try {
            if (!fs.existsSync(this.settingsFilePath)) {
                this.settings = this.withRuntimeNonce({ ...DEFAULT_SERVER_SETTINGS });
                await this.persistSettings();
                this.initialized = true;
                return;
            }

            const fileContent = await fs.promises.readFile(this.settingsFilePath, 'utf8');
            const savedSettings = JSON.parse(fileContent) as Partial<ServerSettings>;
            const normalizedPersistedSettings = this.normalizePersistedSettings(savedSettings);
            const shouldPersist = this.shouldPersistNormalizedSettings(savedSettings, normalizedPersistedSettings);

            this.settings = this.withRuntimeNonce(normalizedPersistedSettings);

            if (shouldPersist) {
                await this.persistSettings();
            }

            this.initialized = true;
        } catch (error) {
            logger.warn('Failed to restore server settings, falling back to defaults.', error);
            this.settings = this.withRuntimeNonce({ ...DEFAULT_SERVER_SETTINGS });
            await this.persistSettings();
            this.initialized = true;
        }
    }

    /**
     * Persist settings to file system.
     */
    private async persistSettings(): Promise<void> {
        this.ensureStorageDirectory();

        const persistedSettings = this.toPersistedSettings(this.settings);
        const settingsJson = JSON.stringify(persistedSettings, null, 2);
        await fs.promises.writeFile(this.settingsFilePath, settingsJson, 'utf8');
    }

    /**
     * Reset settings to defaults.
     */
    public async resetSettings(): Promise<void> {
        await this.ensureInitialized();
        this.settings = this.withRuntimeNonce({ ...DEFAULT_SERVER_SETTINGS });
        await this.persistSettings();
        void vscode.commands.executeCommand('codexr.servers.refresh');
    }

    /**
     * Get the path to the settings file.
     */
    public getSettingsFilePath(): string {
        return this.settingsFilePath;
    }

    /**
     * Deep merge utility for partial updates.
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
     * Get settings in legacy format for UI compatibility.
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
        } else if (this.settings.https.certSource === 'default') {
            httpModeDisplay = 'HTTPS (generated local certificates)';
        } else {
            const certInfo = this.settings.https.certPath && this.settings.https.keyPath
                ? ` [Cert: ${this.settings.https.certPath}, Key: ${this.settings.https.keyPath}]`
                : ' [Paths not configured]';
            httpModeDisplay = `HTTPS (custom certificates)${certInfo}`;
        }

        return {
            httpMode: httpModeDisplay,
            port: this.settings.defaultPort,
            autoOpen: this.settings.launch.autoOpen,
            openMode: this.settings.launch.openMode === 'browser' ? 'Browser' : 'Lateral Panel',
        };
    }

    /**
     * Update settings from legacy format.
     */
    public async updateFromLegacyConfig(updates: any): Promise<void> {
        await this.ensureInitialized();

        const newUpdates: Partial<ServerSettings> = {};

        if (updates.httpMode) {
            if (updates.httpMode === 'HTTP') {
                newUpdates.mode = 'HTTP';
            } else if (updates.httpMode === 'HTTPS (generated local certificates)') {
                newUpdates.mode = 'HTTPS';
                newUpdates.https = {
                    ...this.settings.https,
                    certSource: 'default',
                };
            } else if (updates.httpMode === 'HTTPS (custom certificates)') {
                newUpdates.mode = 'HTTPS';
                newUpdates.https = {
                    ...this.settings.https,
                    certSource: 'custom',
                };
            }
        }

        if (updates.customCertPath !== undefined || updates.customKeyPath !== undefined) {
            const currentHttps = newUpdates.https || this.settings.https;
            newUpdates.https = {
                ...currentHttps,
                ...(updates.customCertPath !== undefined && { certPath: updates.customCertPath }),
                ...(updates.customKeyPath !== undefined && { keyPath: updates.customKeyPath }),
            };
        }

        if (updates.port !== undefined) {
            newUpdates.defaultPort = updates.port;
        }

        if (updates.autoOpen !== undefined || updates.openMode !== undefined) {
            newUpdates.launch = {
                ...this.settings.launch,
                ...(updates.autoOpen !== undefined && { autoOpen: updates.autoOpen }),
                ...(updates.openMode !== undefined && {
                    openMode: updates.openMode === 'Browser' ? 'browser' : 'lateralPanel',
                }),
            };
        }

        await this.updateServerSettings(newUpdates);
    }

    private normalizePersistedSettings(savedSettings: Partial<ServerSettings>): ServerSettings {
        const mergedSettings = this.deepMerge(DEFAULT_SERVER_SETTINGS, savedSettings);
        return {
            ...mergedSettings,
            configNonce: mergedSettings.configNonce || DEFAULT_SERVER_SETTINGS.configNonce,
        };
    }

    private shouldPersistNormalizedSettings(
        savedSettings: Partial<ServerSettings>,
        normalizedSettings: ServerSettings,
    ): boolean {
        const persistedSavedSettings = this.normalizeForComparison(savedSettings);
        const persistedNormalizedSettings = this.normalizeForComparison(normalizedSettings);
        return JSON.stringify(persistedSavedSettings) !== JSON.stringify(persistedNormalizedSettings);
    }

    private normalizeForComparison(settings: Partial<ServerSettings>): Partial<ServerSettings> {
        const sanitizedSettings = { ...settings };
        if (!sanitizedSettings.configNonce) {
            delete sanitizedSettings.configNonce;
        }
        return sanitizedSettings;
    }

    private withRuntimeNonce(settings: ServerSettings): ServerSettings {
        return {
            ...settings,
            configNonce: generateNonce(),
        };
    }

    private toPersistedSettings(settings: ServerSettings): ServerSettings {
        return {
            ...settings,
        };
    }
}

