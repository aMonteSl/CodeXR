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
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        console.log('LIVE_PANEL_PARSER: Initializing LivePanelParser...');
        this.context = context;
        console.log('LIVE_PANEL_PARSER: LivePanelParser initialized successfully');
    }

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
        const templateFiles = await this.loadAllFilesFromDirectory(templatePath);
        const sharedFiles = this.loadSharedComponentFiles();
        const processedFiles = await this.processTemplateFiles(templateFiles, sharedFiles, theme);
        return processedFiles;
    }

    // ── Template path resolution ─────────────────────────────────────

    private getTemplatePath(targetType: string): string {
        // Same source of truth XR/VisualizeDOM parsers use — no extension-registry lookup needed.
        // e.g. …/templates/analysis_livePanel/file/
        return path.join(this.context.extensionPath, 'templates', 'analysis_livePanel', targetType);
    }

    private getSharedComponentsPath(): string {
        // Reusable LivePanel components (e.g. the DataTable) shared by every panel.
        return path.join(this.context.extensionPath, 'templates', 'components', 'livepanel');
    }

    /**
     * Load the shared LivePanel component files (JS/CSS) if the directory exists.
     * These are bundled ahead of each template's own script/stylesheet so all
     * panels share one implementation. Missing directory → empty map (no-op).
     */
    private loadSharedComponentFiles(): Map<string, string> {
        const sharedDir = this.getSharedComponentsPath();
        const sharedFiles = new Map<string, string>();
        if (!fs.existsSync(sharedDir)) {
            return sharedFiles;
        }
        // Deterministic order so the bundle is stable across runs.
        for (const fileName of fs.readdirSync(sharedDir).sort()) {
            const filePath = path.join(sharedDir, fileName);
            if (fs.statSync(filePath).isFile()) {
                sharedFiles.set(fileName, fs.readFileSync(filePath, 'utf8'));
            }
        }
        return sharedFiles;
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
     * Normalise a template's files into what the server will serve:
     *  - HTML  → placeholder replacement (nonce, theme, style.css, main.js)
     *  - JS    → bundled into `main.js`   (shared components first, then the
     *            template's own script — its first non-empty JS file)
     *  - CSS   → bundled into `style.css` (shared components first, then the
     *            template's own stylesheet)
     *  - other → kept as-is (e.g. favicon)
     *
     * Bundling the shared components ahead of the template code is what lets every
     * panel reuse one `DataTable`/`escapeHtml` implementation from a single source.
     */
    private async processTemplateFiles(
        templateFiles: Map<string, string>,
        sharedFiles: Map<string, string>,
        theme?: string,
    ): Promise<Map<string, string>> {
        const processedFiles = new Map<string, string>();
        const nonce = generateNonce();

        const sharedJs = this.collectByExtension(sharedFiles, '.js');
        const sharedCss = this.collectByExtension(sharedFiles, '.css');

        // The template's own script is its first non-empty JS file.
        let templateJs = '';
        for (const [fileName, content] of templateFiles) {
            if (fileName.endsWith('.js') && content.trim().length > 0) {
                templateJs = content;
                break;
            }
        }
        const templateCss = this.collectByExtension(templateFiles, '.css');

        processedFiles.set('main.js', this.bundleParts([...sharedJs, templateJs]));
        processedFiles.set('style.css', this.bundleParts([...sharedCss, ...templateCss]));

        for (const [fileName, content] of templateFiles) {
            if (fileName.endsWith('.html')) {
                processedFiles.set(fileName, await this.processHtmlTemplate(content, nonce, theme));
            } else if (fileName.endsWith('.js') || fileName.endsWith('.css')) {
                // Already folded into main.js / style.css above.
                continue;
            } else {
                processedFiles.set(fileName, content);
            }
        }

        return processedFiles;
    }

    /** Contents of every file in `files` whose name ends with `ext`, in map order. */
    private collectByExtension(files: Map<string, string>, ext: string): string[] {
        const parts: string[] = [];
        for (const [fileName, content] of files) {
            if (fileName.endsWith(ext)) {
                parts.push(content);
            }
        }
        return parts;
    }

    /** Join non-empty bundle parts with a blank line between them. */
    private bundleParts(parts: string[]): string {
        return parts.filter((part) => part.trim().length > 0).join('\n\n');
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
