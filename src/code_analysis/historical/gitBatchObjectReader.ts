import * as childProcess from 'child_process';

export interface GitBatchObject {
    objectName: string;
    objectType: string;
    size: number;
    content: Buffer;
}

export interface GitBatchObjectMetadata {
    objectName: string;
    objectType: string;
    size: number;
}

interface PendingObjectRequest {
    spec: string;
    resolve: (value: GitBatchObject) => void;
    reject: (reason: Error) => void;
}

interface PendingMetadataRequest {
    spec: string;
    resolve: (value: GitBatchObjectMetadata) => void;
    reject: (reason: Error) => void;
}

function gitBatchError(spec: string, detail: string): Error {
    return new Error(`git-object-unavailable (${spec}): ${detail}`);
}

/**
 * Persistent `git cat-file --batch` transport. Responses are framed by the
 * byte size announced in Git's header; no line-based content parsing is used,
 * so source files may contain arbitrary bytes and newline sequences.
 */
export class GitBatchObjectReader {
    private readonly child: childProcess.ChildProcessWithoutNullStreams;
    private readonly pending: PendingObjectRequest[] = [];
    private buffered = Buffer.alloc(0);
    private currentHeader: { objectName: string; objectType: string; size: number } | undefined;
    private terminalError: Error | undefined;
    private disposed = false;

    public constructor(repositoryRoot: string) {
        this.child = childProcess.spawn(
            'git',
            ['-C', repositoryRoot, 'cat-file', '--batch'],
            { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
        );
        this.child.stdout.on('data', (chunk: Buffer) => {
            this.buffered = this.buffered.length
                ? Buffer.concat([this.buffered, chunk])
                : Buffer.from(chunk);
            this.parseAvailableResponses();
        });
        let stderr = '';
        this.child.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString('utf8');
        });
        this.child.on('error', (error) => this.failAll(
            new Error(`git-cat-file-start-failed: ${error.message}`),
        ));
        this.child.on('close', (code) => {
            if (!this.disposed && (code !== 0 || this.pending.length > 0)) {
                this.failAll(new Error(
                    `git-cat-file-closed (${String(code)}): ${stderr.trim() || 'no diagnostic'}`,
                ));
            }
        });
        this.child.stdin.on('error', (error) => {
            if (!this.disposed) {
                this.failAll(new Error(`git-cat-file-input-failed: ${error.message}`));
            }
        });
    }

    public readObject(spec: string): Promise<GitBatchObject> {
        if (this.terminalError) {
            return Promise.reject(this.terminalError);
        }
        if (this.disposed) {
            return Promise.reject(new Error('git-cat-file-reader-disposed'));
        }
        return new Promise<GitBatchObject>((resolve, reject) => {
            this.pending.push({ spec, resolve, reject });
            this.child.stdin.write(`${spec}\n`, 'utf8');
        });
    }

    public async dispose(force = false): Promise<void> {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        if (force) {
            this.failAll(new Error('git-cat-file-cancelled'));
            this.child.kill();
            return;
        }
        this.child.stdin.end();
        if (this.child.exitCode !== null) {
            return;
        }
        await new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
                this.child.kill();
                resolve();
            }, 2_000);
            this.child.once('close', () => {
                clearTimeout(timer);
                resolve();
            });
        });
    }

    private parseAvailableResponses(): void {
        while (this.pending.length > 0) {
            if (!this.currentHeader) {
                const newline = this.buffered.indexOf(0x0a);
                if (newline < 0) {
                    return;
                }
                const header = this.buffered.subarray(0, newline).toString('utf8').trim();
                this.buffered = this.buffered.subarray(newline + 1);
                const request = this.pending[0];
                if (/\s(?:missing|ambiguous)$/.test(header)) {
                    this.pending.shift();
                    request.reject(gitBatchError(request.spec, header));
                    continue;
                }
                const match = /^([0-9a-f]+)\s+(\S+)\s+(\d+)$/.exec(header);
                if (!match) {
                    this.failAll(gitBatchError(request.spec, `invalid header "${header}"`));
                    return;
                }
                this.currentHeader = {
                    objectName: match[1],
                    objectType: match[2],
                    size: Number(match[3]),
                };
            }

            const required = this.currentHeader.size + 1;
            if (this.buffered.length < required) {
                return;
            }
            const request = this.pending.shift() as PendingObjectRequest;
            const content = Buffer.from(this.buffered.subarray(0, this.currentHeader.size));
            const separator = this.buffered[this.currentHeader.size];
            this.buffered = this.buffered.subarray(required);
            const header = this.currentHeader;
            this.currentHeader = undefined;
            if (separator !== 0x0a) {
                request.reject(gitBatchError(request.spec, 'missing object separator'));
                continue;
            }
            request.resolve({ ...header, content });
        }
    }

    private failAll(error: Error): void {
        this.terminalError = error;
        this.currentHeader = undefined;
        while (this.pending.length) {
            this.pending.shift()?.reject(error);
        }
    }
}

/**
 * Size/type companion for the content reader. It keeps one
 * `--batch-check` process alive and makes limit validation cheap without
 * loading every blob into Node during the indexing phase.
 */
export class GitBatchMetadataReader {
    private readonly child: childProcess.ChildProcessWithoutNullStreams;
    private readonly pending: PendingMetadataRequest[] = [];
    private buffered = '';
    private terminalError: Error | undefined;
    private disposed = false;

    public constructor(repositoryRoot: string) {
        this.child = childProcess.spawn(
            'git',
            ['-C', repositoryRoot, 'cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
            { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
        );
        this.child.stdout.setEncoding('utf8');
        this.child.stdout.on('data', (chunk: string) => {
            this.buffered += chunk;
            this.parseAvailableResponses();
        });
        let stderr = '';
        this.child.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString('utf8');
        });
        this.child.on('error', (error) => this.failAll(
            new Error(`git-cat-file-check-start-failed: ${error.message}`),
        ));
        this.child.on('close', (code) => {
            if (!this.disposed && (code !== 0 || this.pending.length > 0)) {
                this.failAll(new Error(
                    `git-cat-file-check-closed (${String(code)}): ${stderr.trim() || 'no diagnostic'}`,
                ));
            }
        });
        this.child.stdin.on('error', (error) => {
            if (!this.disposed) {
                this.failAll(new Error(`git-cat-file-check-input-failed: ${error.message}`));
            }
        });
    }

    public readMetadata(spec: string): Promise<GitBatchObjectMetadata> {
        if (this.terminalError) {
            return Promise.reject(this.terminalError);
        }
        if (this.disposed) {
            return Promise.reject(new Error('git-cat-file-check-reader-disposed'));
        }
        return new Promise<GitBatchObjectMetadata>((resolve, reject) => {
            this.pending.push({ spec, resolve, reject });
            this.child.stdin.write(`${spec}\n`, 'utf8');
        });
    }

    public async dispose(force = false): Promise<void> {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        if (force) {
            this.failAll(new Error('git-cat-file-check-cancelled'));
            this.child.kill();
            return;
        }
        this.child.stdin.end();
        if (this.child.exitCode !== null) {
            return;
        }
        await new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
                this.child.kill();
                resolve();
            }, 2_000);
            this.child.once('close', () => {
                clearTimeout(timer);
                resolve();
            });
        });
    }

    private parseAvailableResponses(): void {
        let newline = this.buffered.indexOf('\n');
        while (newline >= 0 && this.pending.length > 0) {
            const line = this.buffered.slice(0, newline).trim();
            this.buffered = this.buffered.slice(newline + 1);
            const request = this.pending.shift() as PendingMetadataRequest;
            if (/\s(?:missing|ambiguous)$/.test(line)) {
                request.reject(gitBatchError(request.spec, line));
            } else {
                const match = /^([0-9a-f]+)\s+(\S+)\s+(\d+)$/.exec(line);
                if (!match) {
                    request.reject(gitBatchError(request.spec, `invalid metadata "${line}"`));
                } else {
                    request.resolve({
                        objectName: match[1],
                        objectType: match[2],
                        size: Number(match[3]),
                    });
                }
            }
            newline = this.buffered.indexOf('\n');
        }
    }

    private failAll(error: Error): void {
        this.terminalError = error;
        while (this.pending.length) {
            this.pending.shift()?.reject(error);
        }
    }
}
