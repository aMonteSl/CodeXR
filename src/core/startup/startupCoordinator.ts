export interface DeferredStartupTask {
    id: string;
    run: () => Promise<void> | void;
}

export interface StartupCoordinatorLogger {
    debug(message: string | (() => string), metadata?: unknown): void;
    error(message: string | (() => string), metadata?: unknown): void;
}

export interface StartupCoordinatorOptions {
    maxConcurrent?: number;
}

/**
 * Runs deferred startup tasks outside the critical activation path.
 */
export class StartupCoordinator {
    private readonly tasks: DeferredStartupTask[] = [];
    private readonly maxConcurrent: number;
    private started = false;
    private disposed = false;
    private runningCount = 0;
    private timer: NodeJS.Timeout | undefined;

    constructor(
        private readonly logger?: StartupCoordinatorLogger,
        private readonly scheduleCallback: (callback: () => void) => NodeJS.Timeout = (callback) => setTimeout(callback, 0),
        options: StartupCoordinatorOptions = {},
    ) {
        this.maxConcurrent = Math.max(1, options.maxConcurrent ?? 1);
    }

    public schedule(task: DeferredStartupTask): void {
        this.tasks.push(task);

        if (this.started) {
            this.scheduleNextRun();
        }
    }

    public start(): void {
        if (this.started || this.disposed) {
            return;
        }

        this.started = true;
        this.scheduleNextRun();
    }

    public dispose(): void {
        this.disposed = true;

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
    }

    private scheduleNextRun(): void {
        if (
            this.disposed ||
            this.timer ||
            this.tasks.length === 0 ||
            this.runningCount >= this.maxConcurrent
        ) {
            return;
        }

        this.timer = this.scheduleCallback(() => {
            this.timer = undefined;
            void this.runAvailableTasks();
        });
    }

    private async runAvailableTasks(): Promise<void> {
        if (this.disposed) {
            return;
        }

        while (!this.disposed && this.runningCount < this.maxConcurrent) {
            const nextTask = this.tasks.shift();
            if (!nextTask) {
                return;
            }

            this.runningCount += 1;
            void this.runTask(nextTask);
        }
    }

    private async runTask(task: DeferredStartupTask): Promise<void> {
        try {
            this.logger?.debug(() => `Running deferred startup task "${task.id}".`);
            await task.run();
            this.logger?.debug(() => `Deferred startup task "${task.id}" completed.`);
        } catch (error) {
            this.logger?.error(() => `Deferred startup task "${task.id}" failed.`, error);
        } finally {
            this.runningCount = Math.max(0, this.runningCount - 1);
            this.scheduleNextRun();
        }
    }
}
