import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { UnifiedSessionRegistry } from '../engine/core/sessionRegistry';
import { ExecutePython } from '../engine/utils/executePython';
import { DependencyGraphDataset, DependencyRefreshRequest } from './dependencyGraphModels';

export class DependencyGraphService {
    private activeJob: Promise<DependencyGraphDataset> | null = null;
    private revision = 0;
    private generated = false;
    private readonly extractionCachePath: string;
    private readonly fileScopeCache = new Map<string, DependencyGraphDataset>();

    public constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly sessionId: string,
        private readonly staticRoot: string,
    ) {
        const privateStorageRoot = context.storageUri?.fsPath || context.globalStorageUri.fsPath;
        this.extractionCachePath = path.join(
            privateStorageRoot,
            'dependency-graphs',
            sessionId,
            'extraction-cache.json',
        );
    }

    public getAvailability(): { enabled: boolean; reason: string | null } {
        const session = this.getSession();
        if (session.analysisMode !== 'XR' && session.analysisMode !== 'LivePanel') {
            return {
                enabled: false,
                reason: 'Dependency graphs are available for XR file/directory/project analyses '
                    + 'and LivePanel directory/project analyses.',
            };
        }
        return { enabled: true, reason: null };
    }

    public isBusy(): boolean {
        return this.activeJob !== null;
    }

    public getInitialScope(): { kind: 'file' | 'directory'; relativePath: string } {
        const session = this.getSession();
        return session.targetType === 'file'
            ? { kind: 'file', relativePath: path.basename(session.targetPath) }
            : { kind: 'directory', relativePath: '' };
    }

    public analyze(
        request?: DependencyRefreshRequest,
        onProgress?: (message: string) => void,
    ): Promise<DependencyGraphDataset> {
        if (this.activeJob) {
            return this.activeJob;
        }
        const job = this.executeAnalysis(request, onProgress);
        this.activeJob = job;
        const clearActiveJob = () => {
            if (this.activeJob === job) {
                this.activeJob = null;
            }
        };
        void job.then(clearActiveJob, clearActiveJob);
        return job;
    }

    public async dispose(): Promise<void> {
        this.activeJob = null;
        this.fileScopeCache.clear();
    }

    public async analyzeFileScope(
        relativePath?: string,
        onProgress?: (message: string) => void,
    ): Promise<DependencyGraphDataset> {
        const session = this.getSession();
        const analysisRoot = session.targetType === 'directory'
            ? path.resolve(session.targetPath)
            : path.dirname(path.resolve(session.targetPath));
        const targetPath = session.targetType === 'file'
            ? path.resolve(session.targetPath)
            : path.resolve(analysisRoot, String(relativePath || ''));
        const relative = path.relative(analysisRoot, targetPath);
        if (
            relative.startsWith('..')
            || path.isAbsolute(relative)
            || !fs.existsSync(targetPath)
            || !fs.statSync(targetPath).isFile()
        ) {
            throw new Error('The requested dependency file is outside the active analysis.');
        }
        const contentHash = crypto.createHash('sha256')
            .update(await fs.promises.readFile(targetPath))
            .digest('hex');
        const cacheKey = `${targetPath}\0${contentHash}\0dependency-schema-2`;
        const cached = this.fileScopeCache.get(cacheKey);
        if (cached) {
            const dataset = {
                ...cached,
                revision: ++this.revision,
                generatedAt: new Date().toISOString(),
            };
            await this.writeFileScopeDataset(dataset);
            return dataset;
        }
        onProgress?.('Analyzing symbols and calls in the selected file...');
        const result = await new ExecutePython(this.context).executeDependencyAnalysis(
            targetPath,
            'file',
            false,
            undefined,
            undefined,
            this.resolveProjectRoot(targetPath),
        );
        if (!result || result.error === true || !Array.isArray(result.nodes) || !Array.isArray(result.edges)) {
            throw new Error(String(result?.message || 'File dependency analysis returned an invalid dataset.'));
        }
        const dataset: DependencyGraphDataset = {
            ...result,
            schemaVersion: 2,
            revision: ++this.revision,
            sourceRevision: 0,
            targetType: 'file',
            targetRelativePath: relative.replace(/\\/g, '/'),
            generatedAt: new Date().toISOString(),
        };
        for (const key of this.fileScopeCache.keys()) {
            if (key.startsWith(`${targetPath}\0`)) {
                this.fileScopeCache.delete(key);
            }
        }
        this.fileScopeCache.set(cacheKey, dataset);
        await this.writeFileScopeDataset(dataset);
        return dataset;
    }

    private async writeFileScopeDataset(dataset: DependencyGraphDataset): Promise<void> {
        const outputDirectory = path.join(this.staticRoot, 'dependencies');
        await fs.promises.mkdir(outputDirectory, { recursive: true });
        await fs.promises.writeFile(
            path.join(outputDirectory, `dependency-scope-${dataset.revision}.json`),
            JSON.stringify(dataset, null, 2),
            'utf8',
        );
    }

    private async executeAnalysis(
        request?: DependencyRefreshRequest,
        onProgress?: (message: string) => void,
    ): Promise<DependencyGraphDataset> {
        const session = this.getSession();
        const refreshRequest: DependencyRefreshRequest = request || {
            sourceRevision: 0,
            changedFiles: [],
            addedFiles: [],
            removedFiles: [],
            forceFullScan: true,
        };
        const requestDirectory = path.dirname(this.extractionCachePath);
        await fs.promises.mkdir(requestDirectory, { recursive: true });
        const requestPath = path.join(requestDirectory, 'refresh-request.json');
        await fs.promises.writeFile(requestPath, JSON.stringify(refreshRequest), 'utf8');
        onProgress?.(refreshRequest.forceFullScan
            ? 'Scanning supported source files...'
            : 'Updating changed dependency sources...');
        const result = await new ExecutePython(this.context).executeDependencyAnalysis(
            session.targetPath,
            session.targetType,
            session.isDeep,
            this.extractionCachePath,
            requestPath,
            session.targetType === 'file' ? this.resolveProjectRoot(session.targetPath) : undefined,
        );
        if (!result || result.error === true || !Array.isArray(result.nodes) || !Array.isArray(result.edges)) {
            throw new Error(String(result?.message || 'Dependency analysis returned an invalid dataset.'));
        }

        onProgress?.('Calculating graph metrics and cycles...');
        const dataset: DependencyGraphDataset = {
            ...result,
            schemaVersion: Number(result.schemaVersion) === 2 ? 2 : 1,
            revision: ++this.revision,
            targetType: session.targetType,
            targetRelativePath: session.targetType === 'file'
                ? path.basename(session.targetPath)
                : '',
            sourceRevision: refreshRequest.sourceRevision,
            generatedAt: new Date().toISOString(),
        };
        this.generated = true;
        const outputDirectory = path.join(this.staticRoot, 'dependencies');
        await fs.promises.mkdir(outputDirectory, { recursive: true });
        const fileName = `dependency-graph-${dataset.revision}.json`;
        await fs.promises.writeFile(
            path.join(outputDirectory, fileName),
            JSON.stringify(dataset, null, 2),
            'utf8',
        );
        await fs.promises.writeFile(
            path.join(this.staticRoot, 'dependency-graph.json'),
            JSON.stringify(dataset, null, 2),
            'utf8',
        );
        onProgress?.('Dependency graph ready.');
        return dataset;
    }

    public hasGeneratedDataset(): boolean {
        return this.generated;
    }

    private getSession() {
        const session = UnifiedSessionRegistry.getInstance(this.context).getSession(this.sessionId);
        if (!session) {
            throw new Error(`Analysis session not found: ${this.sessionId}`);
        }
        return session;
    }

    private resolveProjectRoot(targetPath: string): string {
        const resolvedTarget = path.resolve(targetPath);
        const workspace = vscode.workspace.workspaceFolders
            ?.map((folder) => path.resolve(folder.uri.fsPath))
            .filter((folderPath) => {
                const relative = path.relative(folderPath, resolvedTarget);
                return !relative.startsWith('..') && !path.isAbsolute(relative);
            })
            .sort((left, right) => right.length - left.length)[0];
        if (workspace) {
            return workspace;
        }
        let current = path.dirname(resolvedTarget);
        while (true) {
            if (fs.existsSync(path.join(current, '.git'))) {
                return current;
            }
            const parent = path.dirname(current);
            if (parent === current) {
                return path.dirname(resolvedTarget);
            }
            current = parent;
        }
    }
}
