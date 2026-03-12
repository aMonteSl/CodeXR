import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CodeXRLogger } from '../../../core/logging/logger';

const logger = CodeXRLogger.getLogger('THEME_UTILS');

/**
 * Theme utilities for the analysis engine.
 * Reads the persisted CodeXR analysis configuration from globalStorage when available.
 */
export class ThemeUtils {
    private static context: vscode.ExtensionContext | null = null;
    private static readonly STORAGE_FOLDER = 'codexr_analysis';
    private static readonly CONFIG_FILE = 'configuration_analysis.json';

    public static initialize(context: vscode.ExtensionContext): void {
        this.context = context;
        logger.debug(() => `Theme utilities initialized with globalStorage at ${context.globalStorageUri.fsPath}.`);
    }

    public static async getUserTheme(): Promise<string> {
        if (!this.context) {
            logger.debug('Theme utils requested before context initialization; using light theme fallback.');
            return 'light';
        }

        try {
            const config = await this.loadConfiguration();
            const viewTheme = config?.configuration?.viewTheme;

            if (!viewTheme) {
                return 'light';
            }

            return this.normalizeTheme(viewTheme);
        } catch (error) {
            logger.warn('Unable to resolve user theme from analysis configuration.', error);
            return 'light';
        }
    }

    public static getUserThemeSync(): string {
        logger.debug('Synchronous theme access requested; using light fallback.');
        return 'light';
    }

    public static async getUserThemeClass(): Promise<string> {
        return this.getUserTheme();
    }

    public static async isDarkTheme(): Promise<boolean> {
        return (await this.getUserTheme()) === 'dark';
    }

    public static async isLightTheme(): Promise<boolean> {
        return (await this.getUserTheme()) === 'light';
    }

    public static async getThemeColors(): Promise<{ foreground: string; background: string; border: string }> {
        const isDark = await this.isDarkTheme();

        return {
            foreground: isDark ? '#ffffff' : '#000000',
            background: isDark ? '#1e1e1e' : '#ffffff',
            border: isDark ? '#404040' : '#e0e0e0',
        };
    }

    private static async loadConfiguration(): Promise<any | null> {
        const configPath = this.getConfigPath();
        if (!configPath || !fs.existsSync(configPath)) {
            return null;
        }

        const configContent = await fs.promises.readFile(configPath, 'utf8');
        return JSON.parse(configContent);
    }

    private static getConfigPath(): string | null {
        if (!this.context) {
            return null;
        }

        return path.join(
            this.context.globalStorageUri.fsPath,
            this.STORAGE_FOLDER,
            this.CONFIG_FILE,
        );
    }

    private static normalizeTheme(viewTheme: string): 'light' | 'dark' {
        return viewTheme.toLowerCase() === 'dark' ? 'dark' : 'light';
    }
}
