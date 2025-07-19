import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Status bar item data for tracking countdown timers
 */
interface TimerData {
    statusBarItem: vscode.StatusBarItem;
    timeout: NodeJS.Timeout;
    startTime: number;
    delayMs: number;
    filePath: string;
}

/**
 * Manages countdown timers in the VS Code status bar for auto-analysis delays
 * Shows remaining time until re-analysis starts and handles timer resets
 */
export class StatusBarDelayTimer {
    private static instance: StatusBarDelayTimer | null = null;
    private timers: Map<string, TimerData> = new Map();
    private updateInterval: NodeJS.Timeout | null = null;

    private constructor() {
        console.log('[STATUS_BAR_TIMER] Initializing status bar delay timer manager');
        this.startUpdateLoop();
    }

    /**
     * Get the singleton instance
     */
    static getInstance(): StatusBarDelayTimer {
        if (!StatusBarDelayTimer.instance) {
            StatusBarDelayTimer.instance = new StatusBarDelayTimer();
        }
        return StatusBarDelayTimer.instance;
    }

    /**
     * Start or restart a delay timer for a file
     * @param uri File URI that changed
     * @param delayMs Delay in milliseconds before analysis
     * @param onComplete Callback to execute when timer completes
     */
    start(uri: vscode.Uri, delayMs: number, onComplete: () => void): void {
        const filePath = uri.fsPath;
        const fileName = path.basename(filePath);
        
        console.log(`[STATUS_BAR_TIMER] Starting ${delayMs}ms delay timer for ${fileName}`);
        
        // Cancel existing timer for this file if any
        this.cancel(uri);
        
        // For real-time (0ms), execute immediately
        if (delayMs === 0) {
            console.log(`[STATUS_BAR_TIMER] Real-time mode: executing immediately for ${fileName}`);
            onComplete();
            return;
        }
        
        // Create status bar item
        const statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left, 
            100 // Priority
        );
        
        // Set up the timeout
        const timeout = setTimeout(() => {
            console.log(`[STATUS_BAR_TIMER] Timer completed for ${fileName}`);
            onComplete();
            this.cancel(uri);
        }, delayMs);
        
        // Store timer data
        const timerData: TimerData = {
            statusBarItem,
            timeout,
            startTime: Date.now(),
            delayMs,
            filePath
        };
        
        this.timers.set(filePath, timerData);
        
        // Show initial status
        this.updateStatusDisplay(timerData, fileName);
        statusBarItem.show();
    }

    /**
     * Cancel the timer for a specific file
     * @param uri File URI to cancel timer for
     */
    cancel(uri: vscode.Uri): void {
        const filePath = uri.fsPath;
        const timerData = this.timers.get(filePath);
        
        if (timerData) {
            const fileName = path.basename(filePath);
            console.log(`[STATUS_BAR_TIMER] Cancelling timer for ${fileName}`);
            
            clearTimeout(timerData.timeout);
            timerData.statusBarItem.dispose();
            this.timers.delete(filePath);
        }
    }

    /**
     * Cancel all active timers
     */
    cancelAll(): void {
        console.log(`[STATUS_BAR_TIMER] Cancelling all ${this.timers.size} active timers`);
        
        for (const timerData of this.timers.values()) {
            clearTimeout(timerData.timeout);
            timerData.statusBarItem.dispose();
        }
        
        this.timers.clear();
    }

    /**
     * Get list of files with active timers
     */
    getActiveTimers(): string[] {
        return Array.from(this.timers.keys());
    }

    /**
     * Check if a file has an active timer
     */
    hasActiveTimer(uri: vscode.Uri): boolean {
        return this.timers.has(uri.fsPath);
    }

    /**
     * Start the update loop for status bar displays
     */
    private startUpdateLoop(): void {
        this.updateInterval = setInterval(() => {
            for (const [filePath, timerData] of this.timers.entries()) {
                const fileName = path.basename(filePath);
                this.updateStatusDisplay(timerData, fileName);
            }
        }, 100); // Update every 100ms for smooth countdown
    }

    /**
     * Update the status bar display for a timer
     */
    private updateStatusDisplay(timerData: TimerData, fileName: string): void {
        const elapsed = Date.now() - timerData.startTime;
        const remaining = Math.max(0, timerData.delayMs - elapsed);
        
        if (remaining <= 0) {
            // Timer should have completed by now
            return;
        }
        
        const remainingSeconds = (remaining / 1000).toFixed(1);
        
        // Format the status message
        timerData.statusBarItem.text = `$(clock) ${fileName}: ${remainingSeconds}s`;
        timerData.statusBarItem.tooltip = `Auto-analysis for ${fileName} will start in ${remainingSeconds} seconds`;
        timerData.statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
    }

    /**
     * Get timing info for a file (for debugging)
     */
    getTimerInfo(uri: vscode.Uri): { remaining: number; total: number } | null {
        const timerData = this.timers.get(uri.fsPath);
        if (!timerData) {
            return null;
        }
        
        const elapsed = Date.now() - timerData.startTime;
        const remaining = Math.max(0, timerData.delayMs - elapsed);
        
        return {
            remaining,
            total: timerData.delayMs
        };
    }

    /**
     * Dispose all resources
     */
    dispose(): void {
        console.log('[STATUS_BAR_TIMER] Disposing status bar delay timer manager');
        
        this.cancelAll();
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
}
