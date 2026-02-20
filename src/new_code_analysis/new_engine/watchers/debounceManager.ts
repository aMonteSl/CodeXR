/**
 * Debounce Manager (Unified)
 * 
 * Single source of truth for all debounce logic in the extension.
 * Handles debounce timing with visual countdown in the VS Code status bar.
 * 
 * Consolidates the former watchers/debounceManager.ts and utils/debounceManager.ts
 * into one clean implementation used by all watchers (file, directory, DOM).
 */

import * as vscode from 'vscode';
import { AnalysisConfigurationStorage } from '../../configuration/analysisConfigurationStorage';
import { ConfigurationConverter } from './configurationConverter';

// ─── Status interface ────────────────────────────────────────────────

/**
 * Snapshot of the current debounce state.
 */
export interface DebounceStatus {
    isActive: boolean;
    remainingMs: number;
    totalMs: number;
}

// ─── DebounceManager class ───────────────────────────────────────────

export class DebounceManager {
    private timeoutId: NodeJS.Timeout | null = null;
    private progressIntervalId: NodeJS.Timeout | null = null;
    private isActive: boolean = false;
    private startTime: number = 0;
    private statusBarItem: vscode.StatusBarItem | null = null;

    constructor(
        private delayMs: number,
        private callback: () => Promise<void> | void,
        private targetFileName?: string,
    ) {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100,
        );
    }

    // ── Static helpers ───────────────────────────────────────────────

    /**
     * Read the debounce delay from user configuration.
     * Returns -1 when auto-analysis is disabled.
     */
    static async getDebounceDelay(context: vscode.ExtensionContext): Promise<number> {
        try {
            const storage = AnalysisConfigurationStorage.getInstance(context);

            const autoAnalysisEnabled = await storage.getAutoAnalysisEnabled();
            if (!autoAnalysisEnabled) {
                return -1; // disabled
            }

            const config = await storage.loadConfiguration();
            return ConfigurationConverter.convertToMilliseconds(config.autoAnalysisDelay);
        } catch (error) {
            console.error('DEBOUNCE_MANAGER: Error reading debounce delay, falling back to 3 000 ms:', error);
            return 3000;
        }
    }

    // ── Lifecycle ────────────────────────────────────────────────────

    /**
     * Start (or restart) the debounce timer.
     * If delay is 0 the callback fires immediately (real-time mode).
     */
    public start(): void {
        // Cancel any previous timer first
        this.cancel();

        if (this.delayMs > 0) {
            this.isActive = true;
            this.startTime = Date.now();
            this.showProgressIndicator();

            this.timeoutId = setTimeout(async () => {
                this.clearVisuals();
                try {
                    await this.callback();
                } catch (err) {
                    console.error('DEBOUNCE_MANAGER: Callback error:', err);
                }
            }, this.delayMs);
        } else {
            // Real-time: fire immediately
            Promise.resolve(this.callback()).catch(err =>
                console.error('DEBOUNCE_MANAGER: Immediate callback error:', err),
            );
        }
    }

    /**
     * Cancel any pending debounce timer without executing the callback.
     */
    public cancel(): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.clearVisuals();
    }

    /**
     * Release all resources. Call this when the owner is being destroyed.
     */
    public dispose(): void {
        this.cancel();
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
            this.statusBarItem = null;
        }
    }

    // ── Queries ──────────────────────────────────────────────────────

    /** Whether the debounce timer is currently counting down. */
    public isRunning(): boolean {
        return this.isActive;
    }

    /** Milliseconds remaining until the callback fires (0 if idle). */
    public getRemainingTime(): number {
        if (!this.isActive || !this.startTime) { return 0; }
        return Math.max(0, this.delayMs - (Date.now() - this.startTime));
    }

    /** Current debounce status snapshot. */
    public getStatus(): DebounceStatus {
        return {
            isActive: this.isActive,
            remainingMs: this.getRemainingTime(),
            totalMs: this.delayMs,
        };
    }

    /** Current delay in milliseconds. */
    public getDelay(): number {
        return this.delayMs;
    }

    // ── Mutation ─────────────────────────────────────────────────────

    /**
     * Update the delay. If a timer is already running it is restarted
     * with the new value.
     */
    public updateDelay(newDelayMs: number): void {
        this.delayMs = newDelayMs;
        if (this.isActive) {
            this.start(); // restart with new delay
        }
    }

    // ── Private helpers ──────────────────────────────────────────────

    private clearVisuals(): void {
        this.isActive = false;
        if (this.progressIntervalId) {
            clearInterval(this.progressIntervalId);
            this.progressIntervalId = null;
        }
        if (this.statusBarItem) {
            this.statusBarItem.hide();
        }
    }

    private showProgressIndicator(): void {
        if (!this.statusBarItem) { return; }

        const fileName = this.targetFileName || 'files';

        this.progressIntervalId = setInterval(() => {
            const remaining = Math.max(0, this.delayMs - (Date.now() - this.startTime));
            if (remaining > 0) {
                const seconds = (remaining / 1000).toFixed(1);
                this.statusBarItem!.text = `$(clock) Analyzing ${fileName} in ${seconds}s`;
                this.statusBarItem!.tooltip = 'Waiting for file changes to settle before re-analyzing';
                this.statusBarItem!.show();
            } else {
                this.clearVisuals();
            }
        }, 100);
    }
}
