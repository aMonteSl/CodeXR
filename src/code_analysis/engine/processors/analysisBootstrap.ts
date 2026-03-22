import * as vscode from 'vscode';
import * as path from 'path';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { ExecutePython } from '../utils/executePython';
import { LivePanelParser } from '../parsers/livePanelParser';
import { VisualizeDOMParser } from '../parsers/visualizeDOMParser';
import { FileXRParser, ParsedXRFileAnalysis } from '../parsers/fileXRParser';
import { directoryXRParser, DirectoryXRParsingResult } from '../parsers/directoryXRParser';
import { SHA256Generator } from '../../../utils/sha256Generator';
import { buildTrackedFileSnapshot } from '../watchers/directorySnapshot';
import { resolveTrackedSystemPath } from '../watchers/directoryReanalysisData';

export interface BootstrapProcessedRequirements {
    sessionId: string;
    analysisMode: string;
    targetPath: string;
    loadedFiles: Map<string, string>;
    estimatedComplexity: 'low';
    processingTime: Date;
}

export interface SharedPayloadBootstrapResult {
    payload: any[];
    trackedFiles?: { filePath: string; hash: string; size?: number; mtimeMs?: number }[];
}

interface VisualizeDOMAnalysisResult {
    htmlContent?: string;
    originalFile?: string;
    preparedForVisualization?: boolean;
    error?: string;
}

export class AnalysisBootstrap {
    private executePython: ExecutePython;
    private livePanelParser: LivePanelParser;
    private visualizeDOMParser: VisualizeDOMParser;
    private fileXRParser: FileXRParser;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.executePython = new ExecutePython(context);
        this.livePanelParser = new LivePanelParser();
        this.visualizeDOMParser = new VisualizeDOMParser(context);
        this.fileXRParser = new FileXRParser(context);
    }

    public async bootstrap(session: UnifiedAnalysisSession, theme?: string): Promise<BootstrapProcessedRequirements> {
        switch (session.analysisMode) {
            case 'LivePanel':
                return session.targetType === 'file'
                    ? this.bootstrapLivePanelFile(session, theme)
                    : this.bootstrapLivePanelDirectory(session, theme);
            case 'XR':
                return session.targetType === 'file'
                    ? this.bootstrapXRFile(session, theme)
                    : this.bootstrapXRDirectory(session);
            case 'VisualizeDOM':
                return this.bootstrapVisualizeDOM(session, theme);
            default:
                throw new Error(`Unknown analysis mode: ${session.analysisMode}`);
        }
    }

    private async bootstrapLivePanelFile(
        session: UnifiedAnalysisSession,
        theme?: string,
    ): Promise<BootstrapProcessedRequirements> {
        const shared = await this.buildSharedPayload(session);
        const loadedFiles = await this.livePanelParser.loadTemplateFiles(session.targetType, session.analysisMode, theme);
        loadedFiles.set('data.json', JSON.stringify(shared.payload, null, 2));
        this.assignMainHtmlFileName(session, loadedFiles);
        return this.createProcessedRequirements(session, loadedFiles);
    }

    private async bootstrapLivePanelDirectory(
        session: UnifiedAnalysisSession,
        theme?: string,
    ): Promise<BootstrapProcessedRequirements> {
        const shared = await this.buildSharedPayload(session);
        const loadedFiles = await this.livePanelParser.loadTemplateFiles(session.targetType, session.analysisMode, theme);
        loadedFiles.set('data.json', JSON.stringify(shared.payload, null, 2));
        this.assignMainHtmlFileName(session, loadedFiles);
        return this.createProcessedRequirements(session, loadedFiles);
    }

    private async bootstrapXRFile(
        session: UnifiedAnalysisSession,
        theme?: string,
    ): Promise<BootstrapProcessedRequirements> {
        const shared = await this.buildSharedPayload(session);
        const result: ParsedXRFileAnalysis = await this.fileXRParser.parseFileAnalysis(session, theme, shared);
        this.assignMainHtmlFileName(session, result.loadedFiles, 'index.html');
        return this.createProcessedRequirements(session, result.loadedFiles);
    }

    private async bootstrapXRDirectory(session: UnifiedAnalysisSession): Promise<BootstrapProcessedRequirements> {
        const shared = await this.buildSharedPayload(session);
        const result: DirectoryXRParsingResult = await directoryXRParser.parseDirectoryForXR(session, this.context, shared);
        if (!result.success || !result.generatedFiles) {
            throw new Error(result.error || 'XR directory processing failed');
        }

        if (!result.generatedFiles.has('virtualScreenRuntime.js')) {
            throw new Error('XR directory bootstrap failed: missing virtualScreenRuntime.js');
        }

        this.assignMainHtmlFileName(session, result.generatedFiles, 'index.html');
        return this.createProcessedRequirements(session, result.generatedFiles);
    }

    private async bootstrapVisualizeDOM(
        session: UnifiedAnalysisSession,
        theme?: string,
    ): Promise<BootstrapProcessedRequirements> {
        if (session.targetType !== 'file') {
            throw new Error(`VisualizeDOM analysis only supports files, not ${session.targetType}`);
        }

        const analysisResult = await this.executePython.executeAnalysis(session) as VisualizeDOMAnalysisResult;
        if (analysisResult?.error) {
            throw new Error(analysisResult.error);
        }

        const htmlContent = typeof analysisResult?.htmlContent === 'string'
            ? analysisResult.htmlContent.trim()
            : '';

        if (!htmlContent) {
            throw new Error(`No HTML content found in file: ${session.targetName}`);
        }

        session.metadata.domHtmlContent = htmlContent;
        session.metadata.domOriginalFile = analysisResult?.originalFile;
        session.metadata.preparedForVisualization = analysisResult?.preparedForVisualization === true;

        const loadedFiles = await this.visualizeDOMParser.processHTMLTemplates({
            htmlContent,
            fileName: session.targetName,
            filePath: session.targetPath,
            title: `DOM Visualization - ${session.targetName}`,
        }, theme, session.id);

        this.ensureBootstrapFiles(session, loadedFiles, ['index.html', 'main.js', 'virtualScreenRuntime.js']);
        this.assignMainHtmlFileName(session, loadedFiles, 'index.html');
        return this.createProcessedRequirements(session, loadedFiles);
    }

    private async buildSharedPayload(session: UnifiedAnalysisSession): Promise<SharedPayloadBootstrapResult> {
        const analysisResult = await this.executePython.executeAnalysis(session);
        const payload = Array.isArray(analysisResult) ? analysisResult : [];

        if (session.targetType === 'file') {
            session.hash256 = await SHA256Generator.generateFileHash(session.targetPath);
            return { payload };
        }

        const trackedFiles = await this.buildTrackedFiles(session, payload);
        session.filesToHash = trackedFiles;
        return {
            payload,
            trackedFiles,
        };
    }

    private async buildTrackedFiles(
        session: UnifiedAnalysisSession,
        payload: any[],
    ): Promise<{ filePath: string; hash: string; size?: number; mtimeMs?: number }[]> {
        const trackedFiles: { filePath: string; hash: string; size?: number; mtimeMs?: number }[] = [];

        for (const entry of payload) {
            const trackedPath = resolveTrackedSystemPath(session.targetPath, entry);
            if (!trackedPath) {
                console.warn(
                    `ANALYSIS_BOOTSTRAP: Could not resolve tracked path for ${entry?.fileName || entry?.relativePath || 'unknown entry'}`,
                );
                continue;
            }

            try {
                const hash = await SHA256Generator.generateFileHash(trackedPath);
                const snapshot = await buildTrackedFileSnapshot(trackedPath, hash);
                trackedFiles.push(snapshot ?? { filePath: trackedPath, hash });
            } catch (error) {
                console.error(`ANALYSIS_BOOTSTRAP: Error generating hash for ${trackedPath}:`, error);
                trackedFiles.push({ filePath: trackedPath, hash: '' });
            }
        }

        return trackedFiles;
    }

    private assignMainHtmlFileName(
        session: UnifiedAnalysisSession,
        loadedFiles: Map<string, string>,
        preferredFileName?: string,
    ): void {
        const htmlFileName = preferredFileName && loadedFiles.has(preferredFileName)
            ? preferredFileName
            : this.resolveMainHtmlFileName(loadedFiles);

        if (htmlFileName) {
            session.metadata.mainHtmlFileName = htmlFileName;
        }
    }

    private resolveMainHtmlFileName(loadedFiles: Map<string, string>): string | undefined {
        const preferredNames = ['fileAnalysis.html', 'directoryAnalysis.html', 'main.html', 'index.html'];

        for (const preferredName of preferredNames) {
            if (loadedFiles.has(preferredName)) {
                return preferredName;
            }
        }

        for (const fileName of loadedFiles.keys()) {
            if (fileName.toLowerCase().endsWith('.html')) {
                return path.basename(fileName);
            }
        }

        return undefined;
    }

    private ensureBootstrapFiles(
        session: UnifiedAnalysisSession,
        loadedFiles: Map<string, string>,
        requiredFiles: string[],
    ): void {
        const missingFiles = requiredFiles.filter((fileName) => {
            const content = loadedFiles.get(fileName);
            return !content || !content.trim();
        });

        if (missingFiles.length > 0) {
            throw new Error(
                `${session.analysisMode} bootstrap failed: missing generated files (${missingFiles.join(', ')})`,
            );
        }
    }

    private createProcessedRequirements(
        session: UnifiedAnalysisSession,
        loadedFiles: Map<string, string>,
    ): BootstrapProcessedRequirements {
        return {
            sessionId: session.id,
            analysisMode: session.analysisMode,
            targetPath: session.targetPath,
            loadedFiles,
            estimatedComplexity: 'low',
            processingTime: new Date(),
        };
    }
}

