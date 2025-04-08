/**
 * Creates a debounced function that delays invoking func until after wait milliseconds have elapsed
 * since the last time the debounced function was invoked.
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function(...args: Parameters<T>): void {
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
export class DebounceMap {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  
  /**
   * Debounce a function call for a specific ID
   * @param id Unique identifier for this debounce
   * @param func Function to call
   * @param wait Milliseconds to wait
   */
  debounce(id: string, func: () => void, wait: number): void {
    // Clear existing timer if any
    if (this.timers.has(id)) {
      clearTimeout(this.timers.get(id)!);
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
  clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
  
  /**
   * Cancel a specific debounced function
   * @param id ID of the debounce to cancel
   */
  cancel(id: string): void {
    if (this.timers.has(id)) {
      clearTimeout(this.timers.get(id)!);
      this.timers.delete(id);
    }
  }
}