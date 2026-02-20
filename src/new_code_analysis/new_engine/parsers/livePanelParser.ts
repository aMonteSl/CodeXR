/**
 * LivePanel Parser (Unified)
 *
 * Single parser for both file-level and directory-level LivePanel analysis.
 * Loads template files from `templates/analysis_livePanel/{targetType}/`,
 * processes placeholders (nonce, theme, style/script URIs) and returns a
 * `Map<string, string>` of processed template contents.
 *
 * Replaces the former `FileLivePanelParser` and `DirectoryLivePanelParser`
 * which were ~95 % identical.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { generateNonce } from '../../../utils/nonceGenerator';
import { ThemeUtils } from '../utils/themeUtils';

export class LivePanelParser {

    // ── Public API ───────────────────────────────────────────────────

    /**
     * Load and process template files for a LivePanel analysis session.
     *
     * @param targetType  - `'file'` or `'directory'` (determines the template subfolder)
     * @param analysisMode - Analysis mode label (e.g. `'LivePanel'`)
     * @param theme        - Optional theme override (`'Dark'` | `'Light'`)
     * @returns A Map of `fileName → processedContent`
     */
    public async loadTemplateFiles(
        targetType: string,
        analysisMode: string,
        theme?: string,
    ): Promise<Map<string, string>> {
        const templatePath = this.getTemplatePath(targetType);
        const loadedFiles = await this.loadAllFilesFromDirectory(templatePath);
        const processedFiles = await this.processTemplateFiles(loadedFiles, theme);
        return processedFiles;
    }

    // ── Template path resolution ─────────────────────────────────────

    private getTemplatePath(targetType: string): string {
        const extensionPath = this.getExtensionPath();
        // e.g. …/templates/analysis_livePanel/file/
        return path.join(extensionPath, 'templates', 'analysis_livePanel', targetType);
    }

    private getExtensionPath(): string {
        const extension = vscode.extensions.getExtension('amonteSl.code-xr');
        if (!extension) {
            throw new Error('Extension amonteSl.code-xr not found');
        }
        return extension.extensionPath;
    }

    // ── File loading ─────────────────────────────────────────────────

    private async loadAllFilesFromDirectory(dirPath: string): Promise<Map<string, string>> {
        if (!fs.existsSync(dirPath)) {
            throw new Error(`Template directory does not exist: ${dirPath}`);
        }

        const loadedFiles = new Map<string, string>();

        for (const fileName of fs.readdirSync(dirPath)) {
            const filePath = path.join(dirPath, fileName);
            if (fs.statSync(filePath).isFile()) {
                loadedFiles.set(fileName, fs.readFileSync(filePath, 'utf8'));
            }
        }

        return loadedFiles;
    }

    // ── Template processing ──────────────────────────────────────────

    /**
     * Walk through loaded files and normalise them:
     *  - HTML  → placeholder replacement  (nonce, theme, style.css, main.js)
     *  - JS    → renamed to `main.js`     (first non-empty JS wins)
     *  - CSS   → renamed to `style.css`
     *  - other → kept as-is
     */
    private async processTemplateFiles(
        loadedFiles: Map<string, string>,
        theme?: string,
    ): Promise<Map<string, string>> {
        const processedFiles = new Map<string, string>();
        const nonce = generateNonce();

        // Find the first non-empty JS file to use as main.js
        let mainJsContent: string | null = null;
        let mainJsFileName: string | null = null;
        for (const [fileName, content] of loadedFiles) {
            if (fileName.endsWith('.js') && content.trim().length > 0) {
                mainJsContent = content;
                mainJsFileName = fileName;
                break;
            }
        }

        for (const [fileName, content] of loadedFiles) {
            if (fileName.endsWith('.html')) {
                processedFiles.set(fileName, await this.processHtmlTemplate(content, nonce, theme));
            } else if (fileName.endsWith('.js')) {
                // Only emit the first non-empty JS file as main.js
                if (mainJsContent && fileName === mainJsFileName) {
                    processedFiles.set('main.js', mainJsContent);
                }
                // Skip any other JS files (empty or duplicates)
            } else if (fileName.endsWith('.css')) {
                processedFiles.set('style.css', content);
            } else {
                processedFiles.set(fileName, content);
            }
        }

        return processedFiles;
    }

    // ── HTML placeholder replacement ─────────────────────────────────

    private async processHtmlTemplate(
        content: string,
        nonce: string,
        theme?: string,
    ): Promise<string> {
        const resolvedTheme = await this.resolveTheme(theme);

        return content
            .replace(/\$\{nonce\}/g, nonce)
            .replace(/\$\{styleUri\}/g, 'style.css')
            .replace(/\$\{scriptUri\}/g, 'main.js')
            .replace(/\$\{theme\}/g, resolvedTheme);
    }

    // ── Theme resolution ─────────────────────────────────────────────

    /**
     * Normalise a theme value to `'dark'` or `'light'`.
     * Falls back to the user preference stored in configuration,
     * and ultimately defaults to `'light'`.
     */
    private async resolveTheme(theme?: string): Promise<string> {
        if (!theme) {
            try {
                return await ThemeUtils.getUserTheme();
            } catch {
                return 'light';
            }
        }

        const lower = theme.toLowerCase();
        if (lower === 'dark' || lower === 'light') {
            return lower;
        }
        return 'light';
    }
}
