"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusBarDelayTimer = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
/**
 * Manages countdown timers in the VS Code status bar for auto-analysis delays
 * Shows remaining time until re-analysis starts and handles timer resets
 */
class StatusBarDelayTimer {
    static instance = null;
    timers = new Map();
    updateInterval = null;
    constructor() {
        console.log('[STATUS_BAR_TIMER] Initializing status bar delay timer manager');
        this.startUpdateLoop();
    }
    /**
     * Get the singleton instance
     */
    static getInstance() {
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
    start(uri, delayMs, onComplete) {
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
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100 // Priority
        );
        // Set up the timeout
        const timeout = setTimeout(() => {
            console.log(`[STATUS_BAR_TIMER] Timer completed for ${fileName}`);
            onComplete();
            this.cancel(uri);
        }, delayMs);
        // Store timer data
        const timerData = {
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
    cancel(uri) {
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
    cancelAll() {
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
    getActiveTimers() {
        return Array.from(this.timers.keys());
    }
    /**
     * Check if a file has an active timer
     */
    hasActiveTimer(uri) {
        return this.timers.has(uri.fsPath);
    }
    /**
     * Start the update loop for status bar displays
     */
    startUpdateLoop() {
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
    updateStatusDisplay(timerData, fileName) {
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
    getTimerInfo(uri) {
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
    dispose() {
        console.log('[STATUS_BAR_TIMER] Disposing status bar delay timer manager');
        this.cancelAll();
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
}
exports.StatusBarDelayTimer = StatusBarDelayTimer;
//# sourceMappingURL=statusBarDelayTimer.js.map