"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebounceMap = void 0;
exports.debounce = debounce;
/**
 * Creates a debounced function that delays invoking func until after wait milliseconds have elapsed
 * since the last time the debounced function was invoked.
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @returns Debounced function
 */
function debounce(func, wait) {
    let timeout = null;
    return function (...args) {
        const later = () => {
            timeout = null;
            func(...args);
        };
        if (timeout !== null) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(later, wait);
    };
}
/**
 * Map to store and manage debounce timers for multiple IDs
 */
class DebounceMap {
    timers = new Map();
    /**
     * Debounce a function call for a specific ID
     * @param id Unique identifier for this debounce
     * @param func Function to call
     * @param wait Milliseconds to wait
     */
    debounce(id, func, wait) {
        // Clear existing timer if any
        if (this.timers.has(id)) {
            clearTimeout(this.timers.get(id));
        }
        // Set new timer
        const timer = setTimeout(() => {
            this.timers.delete(id);
            func();
        }, wait);
        this.timers.set(id, timer);
    }
    /**
     * Cancel all pending debounced functions
     */
    clear() {
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
    }
    /**
     * Cancel a specific debounced function
     * @param id ID of the debounce to cancel
     */
    cancel(id) {
        if (this.timers.has(id)) {
            clearTimeout(this.timers.get(id));
            this.timers.delete(id);
        }
    }
}
exports.DebounceMap = DebounceMap;
//# sourceMappingURL=debounceUtils.js.map