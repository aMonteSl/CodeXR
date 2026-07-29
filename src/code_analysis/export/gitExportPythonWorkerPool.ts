import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const WORKER_PROTOCOL_VERSION = 1;
const MAX_TASKS_PER_WORKER = 500;
const WORKER_READY_TIMEOUT_MS = 10_000;

export interface WorkerPoolCancelSignal {
    readonly isCancellationRequested: boolean;
    onCancellationRequested?: (
        listener: () => void,
    ) => { dispose(): void };
}

export interface GitExportAnalysisJob {
    id: string;
    inputPath: string;
    outputPath: string;
    targetType: 'file' | 'directory';
    prepareInput: () => Promise<void>;
    cleanupInput?: () => Promise<void>;
}

export interface GitExportWorkerProgress {
    completed: number;
    total: number;
    workerCount: number;
    filesPerSecond: number;
    etaSeconds: number;
}

export interface GitExportWorkerPoolResult {
    failures: Map<string, string>;
    maxActiveWorkers: number;
}

interface WorkerMessage {
    type?: string;
    protocol?: number;
    id?: string;
    error?: string;
}

class PersistentPythonWorker {
    private readonly child: childProcess.ChildProcessWithoutNullStreams;
    private stdoutBuffer = '';
    private stderrTail = '';
    private readyResolve!: () => void;
    private readyReject!: (reason: Error) => void;
    private readonly readyPromise: Promise<void>;
    private pending:
        | { jobId: string; resolve: () => void; reject: (reason: Error) => void }
        | undefined;
    private stopped = false;
    private completedTasks = 0;

    public constructor(
        pythonExecutable: string,
        workerScriptPath: string,
    ) {
        this.readyPromise = new Promise<void>((resolve, reject) => {
            this.readyResolve = resolve;
            this.readyReject = reject;
        });
        this.child = childProcess.spawn(
            pythonExecutable,
            [workerScriptPath],
            {
                cwd: path.dirname(workerScriptPath),
                windowsHide: true,
                stdio: ['pipe', 'pipe', 'pipe'],
            },
        );
        this.child.stdout.setEncoding('utf8');
        this.child.stdout.on('data', (chunk: string) => {
            this.stdoutBuffer += chunk;
            this.parseMessages();
        });
        this.child.stderr.setEncoding('utf8');
        this.child.stderr.on('data', (chunk: string) => {
            this.stderrTail = `${this.stderrTail}${chunk}`.slice(-4_096);
        });
        this.child.on('error', (error) => this.fail(
            new Error(`python-export-worker-start-failed: ${error.message}`),
        ));
        this.child.on('close', (code) => {
            if (!this.stopped) {
                this.fail(new Error(
                    `python-export-worker-closed (${String(code)}): ${this.stderrTail.trim() || 'no diagnostic'}`,
                ));
            }
        });
        this.child.stdin.on('error', (error) => {
            if (!this.stopped) {
                this.fail(new Error(`python-export-worker-input-failed: ${error.message}`));
            }
        });
    }

    public get taskCount(): number {
        return this.completedTasks;
    }

    public async ready(): Promise<void> {
        let timer: NodeJS.Timeout | undefined;
        try {
            await Promise.race([
                this.readyPromise,
                new Promise<never>((_, reject) => {
                    timer = setTimeout(
                        () => reject(new Error('python-export-worker-ready-timeout')),
                        WORKER_READY_TIMEOUT_MS,
                    );
                }),
            ]);
        } finally {
            if (timer) {
                clearTimeout(timer);
            }
        }
    }

    public async analyze(job: GitExportAnalysisJob): Promise<void> {
        await this.ready();
        if (this.stopped || this.child.exitCode !== null) {
            throw new Error('python-export-worker-not-running');
        }
        if (this.pending) {
            throw new Error('python-export-worker-busy');
        }
        return new Promise<void>((resolve, reject) => {
            this.pending = {
                jobId: job.id,
                resolve: () => {
                    this.completedTasks += 1;
                    resolve();
                },
                reject,
            };
            this.child.stdin.write(`${JSON.stringify({
                type: 'analyze',
                id: job.id,
                inputPath: job.inputPath,
                outputPath: job.outputPath,
                targetType: job.targetType,
            })}\n`, 'utf8');
        });
    }

    public async stop(force = false): Promise<void> {
        if (this.stopped) {
            await this.waitForClose();
            return;
        }
        this.stopped = true;
        if (force) {
            this.pending?.reject(new Error('python-export-worker-cancelled'));
            this.pending = undefined;
            this.child.kill();
            await this.waitForClose();
            return;
        }
        if (this.child.exitCode !== null) {
            return;
        }
        this.child.stdin.write(`${JSON.stringify({ type: 'shutdown' })}\n`, 'utf8');
        this.child.stdin.end();
        await this.waitForClose();
    }

    private parseMessages(): void {
        let newline = this.stdoutBuffer.indexOf('\n');
        while (newline >= 0) {
            const line = this.stdoutBuffer.slice(0, newline).trim();
            this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
            if (line) {
                this.handleMessage(line);
            }
            newline = this.stdoutBuffer.indexOf('\n');
        }
    }

    private handleMessage(line: string): void {
        let message: WorkerMessage;
        try {
            message = JSON.parse(line) as WorkerMessage;
        } catch {
            this.fail(new Error(`python-export-worker-invalid-json: ${line.slice(0, 200)}`));
            return;
        }
        if (message.type === 'ready') {
            if (message.protocol !== WORKER_PROTOCOL_VERSION) {
                this.readyReject(new Error(
                    `python-export-worker-protocol-mismatch: ${String(message.protocol)}`,
                ));
            } else {
                this.readyResolve();
            }
            return;
        }
        if (message.type === 'complete' && this.pending && message.id === this.pending.jobId) {
            const pending = this.pending;
            this.pending = undefined;
            pending.resolve();
            return;
        }
        if (message.type === 'error' && this.pending && message.id === this.pending.jobId) {
            const pending = this.pending;
            this.pending = undefined;
            pending.reject(new Error(message.error || 'python-export-worker-analysis-failed'));
        }
    }

    private fail(error: Error): void {
        this.readyReject(error);
        this.pending?.reject(error);
        this.pending = undefined;
    }

    private async waitForClose(): Promise<void> {
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
}

/**
 * Bounded pool of direct Python children. Jobs may number in the thousands,
 * but only `workerCount` interpreters are alive and every interpreter handles
 * many files before being recycled.
 */
export class GitExportPythonWorkerPool {
    private readonly workers = new Set<PersistentPythonWorker>();
    private cancellationSubscription: { dispose(): void } | undefined;
    private disposed = false;
    private maxActiveWorkers = 0;

    public constructor(
        private readonly pythonExecutable: string,
        private readonly workerScriptPath: string,
        private readonly workerCount: number,
        private readonly token?: WorkerPoolCancelSignal,
    ) {}

    public async run(
        jobs: GitExportAnalysisJob[],
        onProgress?: (progress: GitExportWorkerProgress) => void,
    ): Promise<GitExportWorkerPoolResult> {
        if (jobs.length === 0) {
            return { failures: new Map(), maxActiveWorkers: 0 };
        }
        if (!fs.existsSync(this.pythonExecutable)) {
            throw new Error(`Python executable does not exist: ${this.pythonExecutable}`);
        }
        if (!fs.existsSync(this.workerScriptPath)) {
            throw new Error(`Python export worker does not exist: ${this.workerScriptPath}`);
        }

        this.cancellationSubscription = this.token?.onCancellationRequested?.(() => {
            void this.dispose(true);
        });
        const failures = new Map<string, string>();
        const attempts = new Map<string, number>();
        const startedAt = Date.now();
        let nextIndex = 0;
        let completed = 0;
        const actualWorkers = Math.min(
            Math.max(1, Math.floor(this.workerCount)),
            jobs.length,
        );

        const loops = Array.from({ length: actualWorkers }, async () => {
            let worker = await this.createWorker();
            try {
                while (true) {
                    this.throwIfCancelled();
                    const index = nextIndex;
                    nextIndex += 1;
                    if (index >= jobs.length) {
                        return;
                    }
                    const job = jobs[index];
                    let finished = false;
                    while (!finished) {
                        this.throwIfCancelled();
                        try {
                            await job.prepareInput();
                            await worker.analyze(job);
                            finished = true;
                        } catch (error) {
                            const attempt = (attempts.get(job.id) || 0) + 1;
                            attempts.set(job.id, attempt);
                            await worker.stop(true);
                            this.workers.delete(worker);
                            if (attempt > 1) {
                                failures.set(
                                    job.id,
                                    error instanceof Error ? error.message : String(error),
                                );
                                finished = true;
                                worker = await this.createWorker();
                            } else {
                                worker = await this.createWorker();
                            }
                        } finally {
                            await job.cleanupInput?.().catch(() => undefined);
                        }
                    }
                    completed += 1;
                    const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.001);
                    const filesPerSecond = completed / elapsedSeconds;
                    onProgress?.({
                        completed,
                        total: jobs.length,
                        workerCount: actualWorkers,
                        filesPerSecond,
                        etaSeconds: Math.max(0, (jobs.length - completed) / filesPerSecond),
                    });
                    if (worker.taskCount >= MAX_TASKS_PER_WORKER && completed < jobs.length) {
                        await worker.stop();
                        this.workers.delete(worker);
                        worker = await this.createWorker();
                    }
                }
            } finally {
                await worker.stop(this.token?.isCancellationRequested === true);
                this.workers.delete(worker);
            }
        });
        await Promise.all(loops);
        this.cancellationSubscription?.dispose();
        this.cancellationSubscription = undefined;
        this.throwIfCancelled();
        return { failures, maxActiveWorkers: this.maxActiveWorkers };
    }

    public async dispose(force = false): Promise<void> {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.cancellationSubscription?.dispose();
        this.cancellationSubscription = undefined;
        await Promise.all(Array.from(this.workers, async (worker) => {
            await worker.stop(force);
        }));
        this.workers.clear();
    }

    private async createWorker(): Promise<PersistentPythonWorker> {
        this.throwIfCancelled();
        const worker = new PersistentPythonWorker(
            this.pythonExecutable,
            this.workerScriptPath,
        );
        this.workers.add(worker);
        this.maxActiveWorkers = Math.max(this.maxActiveWorkers, this.workers.size);
        try {
            await worker.ready();
            return worker;
        } catch (error) {
            await worker.stop(true);
            this.workers.delete(worker);
            throw error;
        }
    }

    private throwIfCancelled(): void {
        if (this.token?.isCancellationRequested || this.disposed) {
            throw new Error('git-export-cancelled');
        }
    }
}
