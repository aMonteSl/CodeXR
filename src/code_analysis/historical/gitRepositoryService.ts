import * as childProcess from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import {
    isDirectoryAnalysisFile,
    shouldIgnoreDirectoryName,
} from '../engine/watchers/analysisFilePolicy';
import type {
    ComparisonSource,
    GitReferenceType,
    GitRevisionType,
    HistoricalComparisonReferences,
} from './historicalComparisonModels';

const execFile = promisify(childProcess.execFile);
const MAX_SNAPSHOT_FILES = 5000;
const MAX_SNAPSHOT_BYTES = 100 * 1024 * 1024;
const MAX_SINGLE_FILE_BYTES = 8 * 1024 * 1024;

interface GitCommandResult {
    stdout: string;
    stderr: string;
}

export interface MaterializedGitTarget {
    targetPath: string | null;
    missingTarget: boolean;
    warnings: string[];
}

export class GitRepositoryService {
    private readonly sourceById = new Map<string, ComparisonSource>();

    public constructor(
        private readonly targetPath: string,
        private readonly snapshotRoot: string,
    ) {}

    public async listReferences(): Promise<HistoricalComparisonReferences> {
        const repositoryRoot = await this.resolveRepositoryRoot();
        const targetRelativePath = this.resolveTargetRelativePath(repositoryRoot);
        const workingTreeDirty = (await this.runGit(
            repositoryRoot,
            ['status', '--porcelain', '--untracked-files=normal', '--', targetRelativePath],
        )).stdout.trim().length > 0;
        const headName = (await this.tryRunGit(repositoryRoot, [
            'symbolic-ref',
            '--quiet',
            '--short',
            'HEAD',
        ]))?.stdout.trim() || null;
        const detachedSha = headName
            ? null
            : (await this.runGit(repositoryRoot, ['rev-parse', '--short=8', 'HEAD'])).stdout.trim();

        const sources: ComparisonSource[] = [{
            id: 'working-copy',
            kind: 'workingCopy',
            label: headName
                ? `${headName} (live)${workingTreeDirty ? ' (modified)' : ''}`
                : `Detached HEAD ${detachedSha} (live)${workingTreeDirty ? ' (modified)' : ''}`,
            activeBranch: headName,
            dirty: workingTreeDirty,
            live: true,
            revisionType: 'working-copy',
        }];

        const branchLines = (await this.runGit(repositoryRoot, [
            'for-each-ref',
            '--format=%(refname)%00%(objectname)%00%(refname:short)',
            'refs/heads',
            'refs/remotes',
        ])).stdout.split(/\r?\n/).filter(Boolean);
        for (const line of branchLines) {
            const [fullRef, commitSha, shortName] = line.split('\0');
            if (!fullRef || !this.isCommitSha(commitSha) || !shortName || shortName.endsWith('/HEAD')) {
                continue;
            }
            if (headName && fullRef === `refs/heads/${headName}`) {
                continue;
            }
            sources.push(this.createGitSource('branch', fullRef, shortName, commitSha));
        }

        const tagLines = (await this.runGit(repositoryRoot, [
            'for-each-ref',
            '--format=%(refname)%00%(*objectname)%00%(objectname)%00%(refname:short)',
            'refs/tags',
        ])).stdout.split(/\r?\n/).filter(Boolean);
        for (const line of tagLines) {
            const [fullRef, peeledSha, objectSha, shortName] = line.split('\0');
            const commitSha = peeledSha || objectSha;
            if (!fullRef || !this.isCommitSha(commitSha) || !shortName) {
                continue;
            }
            sources.push(this.createGitSource('tag', fullRef, shortName, commitSha));
        }

        const commitLines = (await this.runGit(repositoryRoot, [
            'log',
            '--all',
            '--max-count=50',
            '--date=short',
            '--format=%H%x00%ad%x00%P%x00%s',
        ])).stdout.split(/\r?\n/).filter(Boolean);
        for (const line of commitLines) {
            const [commitSha, date, parents, subject] = line.split('\0');
            if (!this.isCommitSha(commitSha)) {
                continue;
            }
            const parentCount = this.countParents(parents);
            sources.push(this.createGitSource(
                'commit',
                commitSha,
                commitSha.slice(0, 8),
                commitSha,
                `${date || ''} ${subject || ''}`.trim(),
                parentCount > 1 ? 'merge' : 'commit',
                parentCount,
            ));
        }

        this.sourceById.clear();
        for (const source of sources) {
            this.sourceById.set(source.id, source);
        }

        return {
            repositoryRoot,
            targetRelativePath,
            workingTreeDirty,
            activeBranch: headName,
            sources,
            pageSize: 5,
        };
    }

    public async resolveSource(sourceId: string): Promise<ComparisonSource> {
        if (sourceId === 'working-copy' || this.sourceById.size === 0) {
            await this.listReferences();
        }
        const source = this.sourceById.get(sourceId);
        if (!source) {
            throw new Error('unknown-comparison-source');
        }
        if (source.kind === 'workingCopy') {
            return { ...source };
        }

        const repositoryRoot = await this.resolveRepositoryRoot();
        const resolved = (await this.runGit(repositoryRoot, [
            'rev-parse',
            '--verify',
            `${source.refName}^{commit}`,
        ])).stdout.trim();
        if (!this.isCommitSha(resolved)) {
            throw new Error('comparison-reference-not-found');
        }
        return { ...source, commitSha: resolved };
    }

    public async listTimelineSources(maxCount = 200): Promise<ComparisonSource[]> {
        const repositoryRoot = await this.resolveRepositoryRoot();
        const safeMaxCount = Math.max(1, Math.min(1000, Math.floor(maxCount)));
        const commitLines = (await this.runGit(repositoryRoot, [
            'log',
            '--all',
            '--reverse',
            `--max-count=${safeMaxCount}`,
            '--date=short',
            '--format=%H%x00%ad%x00%P%x00%s',
        ])).stdout.split(/\r\n/).filter(Boolean);
        const sources: ComparisonSource[] = [];
        for (const line of commitLines) {
            const [commitSha, date, parents, subject] = line.split('\0');
            if (!this.isCommitSha(commitSha)) {
                continue;
            }
            const parentCount = this.countParents(parents);
            sources.push(this.createGitSource(
                'commit',
                commitSha,
                commitSha.slice(0, 8),
                commitSha,
                `${date || ''} ${subject || ''}`.trim(),
                parentCount > 1 ? 'merge' : 'commit',
                parentCount,
            ));
        }
        for (const source of sources) {
            this.sourceById.set(source.id, source);
        }
        return sources;
    }

    public async resolveSourcesInChronologicalOrder(sourceIds: string[]): Promise<ComparisonSource[]> {
        if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
            return [];
        }
        return Promise.all(sourceIds.map((sourceId) => this.resolveSource(sourceId)));
    }

    public async materialize(source: ComparisonSource): Promise<MaterializedGitTarget> {
        if (source.kind === 'workingCopy') {
            return {
                targetPath: this.targetPath,
                missingTarget: false,
                warnings: [],
            };
        }

        const repositoryRoot = await this.resolveRepositoryRoot();
        const targetRelativePath = this.resolveTargetRelativePath(repositoryRoot);
        const sourceDirectory = path.join(this.snapshotRoot, this.safeSnapshotName(source.commitSha));
        const destinationPath = path.join(sourceDirectory, ...targetRelativePath.split('/'));
        this.assertInside(sourceDirectory, destinationPath);
        await fs.promises.rm(sourceDirectory, { recursive: true, force: true });
        await fs.promises.mkdir(sourceDirectory, { recursive: true });

        const targetStat = await fs.promises.stat(this.targetPath);
        return targetStat.isDirectory()
            ? this.materializeDirectory(repositoryRoot, source.commitSha, targetRelativePath, sourceDirectory)
            : this.materializeFile(repositoryRoot, source.commitSha, targetRelativePath, destinationPath);
    }

    public async dispose(): Promise<void> {
        await fs.promises.rm(this.snapshotRoot, { recursive: true, force: true });
    }

    public async resolveRepositoryRoot(): Promise<string> {
        const startPath = (await fs.promises.stat(this.targetPath)).isDirectory()
            ? this.targetPath
            : path.dirname(this.targetPath);
        const result = await this.runGit(startPath, ['rev-parse', '--show-toplevel']);
        const repositoryRoot = path.resolve(result.stdout.trim());
        if (!repositoryRoot) {
            throw new Error('not-a-git-repository');
        }
        this.resolveTargetRelativePath(repositoryRoot);
        return repositoryRoot;
    }

    private async materializeFile(
        repositoryRoot: string,
        commitSha: string,
        targetRelativePath: string,
        destinationPath: string,
    ): Promise<MaterializedGitTarget> {
        const objectSpec = `${commitSha}:${targetRelativePath}`;
        if (!(await this.gitObjectExists(repositoryRoot, objectSpec))) {
            return { targetPath: null, missingTarget: true, warnings: [] };
        }
        const size = Number((await this.runGit(repositoryRoot, ['cat-file', '-s', objectSpec])).stdout.trim());
        if (!Number.isFinite(size) || size > MAX_SINGLE_FILE_BYTES) {
            throw new Error('comparison-file-too-large');
        }
        const content = await this.runGitBuffer(repositoryRoot, ['show', objectSpec]);
        await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
        await fs.promises.writeFile(destinationPath, content);
        return { targetPath: destinationPath, missingTarget: false, warnings: [] };
    }

    private async materializeDirectory(
        repositoryRoot: string,
        commitSha: string,
        targetRelativePath: string,
        sourceDirectory: string,
    ): Promise<MaterializedGitTarget> {
        const isRepositoryRoot = targetRelativePath === '.';
        const treeSpec = isRepositoryRoot
            ? `${commitSha}^{tree}`
            : `${commitSha}:${targetRelativePath}`;
        if (!(await this.gitObjectExists(repositoryRoot, treeSpec))) {
            return { targetPath: null, missingTarget: true, warnings: [] };
        }
        const treeArguments = [
            'ls-tree',
            '-r',
            '-z',
            '-l',
            commitSha,
        ];
        if (!isRepositoryRoot) {
            treeArguments.push('--', targetRelativePath);
        }
        const rawTree = await this.runGitBuffer(repositoryRoot, [
            ...treeArguments,
        ]);
        const entries = rawTree.toString('utf8').split('\0').filter(Boolean);

        let totalBytes = 0;
        const warnings: string[] = [];
        const files: Array<{ repositoryPath: string; size: number }> = [];
        for (const entry of entries) {
            const match = entry.match(/^(\d+)\s+(\w+)\s+([0-9a-f]{40})\s+(-|\d+)\t(.+)$/);
            if (!match) {
                continue;
            }
            const [, mode, type, , rawSize, repositoryPath] = match;
            if (type !== 'blob' || mode === '160000') {
                warnings.push(`Skipped unsupported Git entry: ${repositoryPath}`);
                continue;
            }
            const relativeFromTarget = isRepositoryRoot
                ? repositoryPath
                : path.posix.relative(targetRelativePath, repositoryPath);
            if (!this.shouldMaterializeDirectoryFile(relativeFromTarget)) {
                continue;
            }
            const size = Number(rawSize);
            if (!Number.isFinite(size) || size > MAX_SINGLE_FILE_BYTES) {
                warnings.push(`Skipped oversized file: ${repositoryPath}`);
                continue;
            }
            if (files.length >= MAX_SNAPSHOT_FILES) {
                throw new Error('comparison-snapshot-file-limit');
            }
            totalBytes += size;
            if (totalBytes > MAX_SNAPSHOT_BYTES) {
                throw new Error('comparison-snapshot-size-limit');
            }
            files.push({ repositoryPath, size });
        }

        for (const file of files) {
            const relativeFromTarget = isRepositoryRoot
                ? file.repositoryPath
                : path.posix.relative(targetRelativePath, file.repositoryPath);
            if (!relativeFromTarget || relativeFromTarget.startsWith('../')) {
                continue;
            }
            const destination = path.join(sourceDirectory, ...file.repositoryPath.split('/'));
            this.assertInside(sourceDirectory, destination);
            const content = await this.runGitBuffer(
                repositoryRoot,
                ['show', `${commitSha}:${file.repositoryPath}`],
            );
            await fs.promises.mkdir(path.dirname(destination), { recursive: true });
            await fs.promises.writeFile(destination, content);
        }

        return {
            targetPath: isRepositoryRoot
                ? sourceDirectory
                : path.join(sourceDirectory, ...targetRelativePath.split('/')),
            missingTarget: false,
            warnings,
        };
    }

    private shouldMaterializeDirectoryFile(relativePath: string): boolean {
        if (
            !relativePath
            || relativePath.startsWith('../')
            || path.posix.isAbsolute(relativePath)
        ) {
            return false;
        }
        const pathParts = relativePath.split('/').filter(Boolean);
        const directoryParts = pathParts.slice(0, -1);
        if (directoryParts.some((part) => shouldIgnoreDirectoryName(part))) {
            return false;
        }
        return isDirectoryAnalysisFile(relativePath);
    }

    private createGitSource(
        refType: GitReferenceType,
        refName: string,
        label: string,
        commitSha: string,
        description?: string,
        revisionType: GitRevisionType,
        parentCount: number,
    ): ComparisonSource {
        const id = `${refType}-${crypto.createHash('sha256').update(refName).digest('hex').slice(0, 16)}`;
        return {
            id,
            kind: 'gitRef',
            refType,
            refName,
            commitSha,
            label,
            description,
            live: false,
            revisionType: revisionType || refType,
            parentCount,
        };
    }

    private countParents(value: string | undefined): number {
        return String(value || '').split(/\s+/).filter(Boolean).length;
    }

    private resolveTargetRelativePath(repositoryRoot: string): string {
        const relativePath = path.relative(repositoryRoot, this.targetPath);
        if (!relativePath || relativePath === '.') {
            return '.';
        }
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            throw new Error('analysis-target-outside-repository');
        }
        return relativePath.split(path.sep).join('/');
    }

    private async gitObjectExists(repositoryRoot: string, objectSpec: string): Promise<boolean> {
        try {
            await this.runGit(repositoryRoot, ['cat-file', '-e', objectSpec]);
            return true;
        } catch {
            return false;
        }
    }

    private async runGit(cwd: string, args: string[]): Promise<GitCommandResult> {
        try {
            const result = await execFile('git', ['-C', cwd, ...args], {
                windowsHide: true,
                maxBuffer: 16 * 1024 * 1024,
                encoding: 'utf8',
            });
            return {
                stdout: result.stdout,
                stderr: result.stderr,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`git-command-failed: ${message}`);
        }
    }

    private async tryRunGit(cwd: string, args: string[]): Promise<GitCommandResult | null> {
        try {
            return await this.runGit(cwd, args);
        } catch {
            return null;
        }
    }

    private runGitBuffer(cwd: string, args: string[]): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            childProcess.execFile(
                'git',
                ['-C', cwd, ...args],
                {
                    windowsHide: true,
                    maxBuffer: MAX_SNAPSHOT_BYTES + (16 * 1024 * 1024),
                    encoding: 'buffer',
                },
                (error, stdout) => {
                    if (error) {
                        reject(new Error(`git-command-failed: ${error.message}`));
                        return;
                    }
                    resolve(Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout));
                },
            );
        });
    }

    private assertInside(root: string, candidate: string): void {
        const relativePath = path.relative(path.resolve(root), path.resolve(candidate));
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            throw new Error('comparison-snapshot-path-escape');
        }
    }

    private safeSnapshotName(commitSha: string): string {
        if (!this.isCommitSha(commitSha)) {
            throw new Error('invalid-comparison-commit');
        }
        return commitSha;
    }

    private isCommitSha(value: string): boolean {
        return /^[0-9a-f]{40}$/i.test(value || '');
    }

}
