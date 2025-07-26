/**
 * Manage Debounce Time Utility
 * Handles debounce timing logic with visual countdown for file watchers
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { AnalysisConfigurationStorage } from '../../configuration/analysisConfigurationStorage';

export interface DebounceManager {
    statusBarItem: vscode.StatusBarItem;
    countdownTimer?: NodeJS.Timeout;
    debounceTimer?: NodeJS.Timeout;
    debounceMs: number;
    filePath: string;
}

export class ManageDebounceTime {
    
    /**
     * Get debounce delay from user configuration
     */
    static async getDebounceDelay(context: vscode.ExtensionContext): Promise<number> {
        try {
            const storage = AnalysisConfigurationStorage.getInstance(context);
            const delayConfig = await storage.getAutoAnalysisDelay();
            
            switch (delayConfig.type) {
                case 'RealTime':
                    return 0;
                case '1s':
                    return 1000;
                case '3s':
                    return 3000;
                case '5s':
                    return 5000;
                case '10s':
                    return 10000;
                case 'Custom':
                    return delayConfig.customMs || 300;
                default:
                    return 300; // fallback
            }
        } catch (error) {
            console.error('DEBOUNCE_MANAGER: Error getting debounce delay, using default 300ms:', error);
            return 300;
        }
    }

    /**
     * Create a new debounce manager for a file
     */
    static createDebounceManager(filePath: string, debounceMs: number): DebounceManager {
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        statusBarItem.hide(); // Initially hidden

        return {
            statusBarItem,
            countdownTimer: undefined,
            debounceTimer: undefined,
            debounceMs,
            filePath
        };
    }

    /**
     * Start countdown visual in status bar
     */
    static startCountdown(
        manager: DebounceManager, 
        onComplete: () => Promise<void>
    ): void {
        if (!manager.statusBarItem) {
            return;
        }

        // Clear any existing countdown timer to prevent multiple countdowns
        if (manager.countdownTimer) {
            clearInterval(manager.countdownTimer);
            manager.countdownTimer = undefined;
        }

        let remainingMs = manager.debounceMs;
        const fileName = path.basename(manager.filePath);
        
        // Update every 100ms for smooth countdown
        const updateInterval = 100;
        
        manager.countdownTimer = setInterval(() => {
            // Check if manager is still valid (not disposed)
            if (!manager.statusBarItem) {
                if (manager.countdownTimer) {
                    clearInterval(manager.countdownTimer);
                    manager.countdownTimer = undefined;
                }
                return;
            }

            remainingMs -= updateInterval;
            
            if (remainingMs <= 0) {
                // Countdown finished - clear countdown timer
                if (manager.countdownTimer) {
                    clearInterval(manager.countdownTimer);
                    manager.countdownTimer = undefined;
                }
                
                // Show analyzing message
                manager.statusBarItem.text = `$(sync~spin) Analyzing ${fileName}...`;
                manager.statusBarItem.tooltip = `Analyzing ${fileName}`;
                manager.statusBarItem.show();
                
                // Execute the callback
                onComplete().then(() => {
                    // Hide status bar after analysis completes
                    ManageDebounceTime.hideStatusBar(manager);
                }).catch((error) => {
                    console.error('DEBOUNCE_MANAGER: Error in analysis callback:', error);
                    // Hide status bar even on error
                    ManageDebounceTime.hideStatusBar(manager);
                });
                
            } else {
                // Show countdown
                const seconds = (remainingMs / 1000).toFixed(1);
                manager.statusBarItem.text = `$(clock) ${fileName}: ${seconds}s`;
                manager.statusBarItem.tooltip = `File analysis will start in ${seconds} seconds`;
                manager.statusBarItem.show();
            }
        }, updateInterval);
    }

    /**
     * Setup debounced execution with visual countdown
     */
    static setupDebouncedExecution(
        manager: DebounceManager,
        context: vscode.ExtensionContext,
        onExecute: () => Promise<void>
    ): void {
        // Clear existing timers to prevent multiple timers running
        ManageDebounceTime.clearTimers(manager);

        // Get fresh debounce delay in case user changed it
        ManageDebounceTime.getDebounceDelay(context).then(currentDebounceMs => {
            manager.debounceMs = currentDebounceMs;

            // Start countdown visual if debounce > 0
            if (currentDebounceMs > 0) {
                ManageDebounceTime.startCountdown(manager, onExecute);
            } else {
                // Execute immediately if debounce is 0 (RealTime)
                onExecute().catch(error => {
                    console.error('DEBOUNCE_MANAGER: Error in immediate execution:', error);
                    // Hide status bar on error
                    ManageDebounceTime.hideStatusBar(manager);
                });
            }

            // Set up debounced execution as backup
            manager.debounceTimer = setTimeout(async () => {
                try {
                    console.log(`DEBOUNCE_MANAGER: Backup timeout executing for: ${manager.filePath}`);
                    
                    // Clear the timer reference
                    manager.debounceTimer = undefined;
                    
                    // Only execute if no countdown is running (countdown should handle execution)
                    if (!manager.countdownTimer) {
                        await onExecute();
                    }
                    
                } catch (error) {
                    console.error(`DEBOUNCE_MANAGER: Error in backup execution:`, error);
                    
                    // Hide status bar on error
                    ManageDebounceTime.hideStatusBar(manager);
                }
            }, currentDebounceMs);

            console.log(`DEBOUNCE_MANAGER: Debounce timer set for: ${manager.filePath} (${currentDebounceMs}ms)`);
        }).catch(error => {
            console.error('DEBOUNCE_MANAGER: Error setting up debounced execution:', error);
            ManageDebounceTime.hideStatusBar(manager);
        });
    }

    /**
     * Hide and clear status bar
     */
    static hideStatusBar(manager: DebounceManager): void {
        if (manager.statusBarItem) {
            manager.statusBarItem.hide();
        }
    }

    /**
     * Clear all timers for a debounce manager
     */
    static clearTimers(manager: DebounceManager): void {
        // Clear debounce timer
        if (manager.debounceTimer) {
            clearTimeout(manager.debounceTimer);
            manager.debounceTimer = undefined;
            console.log(`DEBOUNCE_MANAGER: Cleared debounce timer for: ${manager.filePath}`);
        }

        // Clear countdown timer
        if (manager.countdownTimer) {
            clearInterval(manager.countdownTimer);
            manager.countdownTimer = undefined;
            console.log(`DEBOUNCE_MANAGER: Cleared countdown timer for: ${manager.filePath}`);
        }
    }

    /**
     * Dispose of a debounce manager completely
     */
    static dispose(manager: DebounceManager): void {
        // Clear all timers
        ManageDebounceTime.clearTimers(manager);

        // Hide and dispose status bar item
        if (manager.statusBarItem) {
            manager.statusBarItem.hide();
            manager.statusBarItem.dispose();
            console.log(`DEBOUNCE_MANAGER: Disposed status bar item for: ${manager.filePath}`);
        }
    }

    /**
     * Update debounce delay and restart countdown if active
     */
    static async updateDebounceDelay(
        manager: DebounceManager, 
        context: vscode.ExtensionContext
    ): Promise<void> {
        const newDebounceMs = await ManageDebounceTime.getDebounceDelay(context);
        manager.debounceMs = newDebounceMs;
        console.log(`DEBOUNCE_MANAGER: Updated debounce delay to ${newDebounceMs}ms for: ${manager.filePath}`);
    }
}
