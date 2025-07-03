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
exports.FileSystemWatcher = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Manages file system watching for automatic tree refresh
 */
class FileSystemWatcher {
    static instance;
    watchers = [];
    refreshCallback;
    debounceTimer;
    DEBOUNCE_DELAY = 300; // Reduced from 500ms to 300ms for faster response
    /**
     * Gets the singleton instance
     */
    static getInstance() {
        if (!FileSystemWatcher.instance) {
            FileSystemWatcher.instance = new FileSystemWatcher();
        }
        return FileSystemWatcher.instance;
    }
    /**
     * Initializes the file system watcher
     * @param refreshCallback Function to call when files change
     */
    initialize(refreshCallback) {
        this.refreshCallback = refreshCallback;
        this.setupWatchers();
    }
    /**
     * Sets up file system watchers for supported file types
     */
    setupWatchers() {
        // Cleanup existing watchers
        this.dispose();
        if (!vscode.workspace.workspaceFolders) {
            console.log('🔍 FileSystemWatcher: No workspace folders found');
            return;
        }
        console.log('🔍 FileSystemWatcher: Setting up watchers for workspace folders');
        // Define file patterns to watch (all supported languages + HTML)
        const filePatterns = [
            '**/*.{js,jsx,ts,tsx,py,c,h,cpp,cc,cxx,cs,vue,rb,java,m,mm,swift,ttcn3,ttcn,3mp,php,phtml,php3,php4,php5,phps,scala,sc,gd,go,lua,rs,f,f77,f90,f95,f03,f08,for,ftn,kt,kts,sol,erl,hrl,zig,pl,pm,pod,t,html,htm}'
        ];
        filePatterns.forEach(pattern => {
            try {
                console.log(`🔍 FileSystemWatcher: Creating watcher for pattern: ${pattern}`);
                const watcher = vscode.workspace.createFileSystemWatcher(pattern);
                // ✅ FIX: Handle file creation (new files)
                watcher.onDidCreate(uri => {
                    console.log(`📁 FileSystemWatcher: File created: ${uri.fsPath}`);
                    this.scheduleRefresh('create', uri.fsPath);
                });
                // ✅ FIX: Handle file deletion
                watcher.onDidDelete(uri => {
                    console.log(`🗑️ FileSystemWatcher: File deleted: ${uri.fsPath}`);
                    this.scheduleRefresh('delete', uri.fsPath);
                });
                // Handle file changes (optional - might be too noisy)
                watcher.onDidChange(uri => {
                    console.log(`📝 FileSystemWatcher: File changed: ${uri.fsPath}`);
                    this.scheduleRefresh('change', uri.fsPath);
                });
                this.watchers.push(watcher);
            }
            catch (error) {
                console.error(`❌ FileSystemWatcher: Error creating watcher for ${pattern}:`, error);
            }
        });
        // ✅ FIX: Watch for workspace folder changes
        const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(event => {
            console.log(`📂 FileSystemWatcher: Workspace folders changed`);
            console.log(`  Added: ${event.added.length}`);
            console.log(`  Removed: ${event.removed.length}`);
            // Immediately refresh when workspace structure changes
            if (this.refreshCallback) {
                this.refreshCallback();
            }
            // Re-setup watchers for new workspace structure
            this.setupWatchers();
        });
        // Store workspace watcher (cast to vscode.FileSystemWatcher for uniform handling)
        this.watchers.push(workspaceWatcher);
        console.log(`✅ FileSystemWatcher: Created ${this.watchers.length} watchers`);
    }
    /**
     * Schedules a refresh with debouncing to avoid excessive updates
     * @param eventType Type of file system event
     * @param fileName Name of the affected file
     */
    scheduleRefresh(eventType, fileName) {
        // ✅ FIX: Clear existing timer
        if (this.debounceTimer) {
            console.log('⏱️ FileSystemWatcher: Clearing existing debounce timer');
            clearTimeout(this.debounceTimer);
        }
        console.log(`⏱️ FileSystemWatcher: Scheduling refresh in ${this.DEBOUNCE_DELAY}ms for ${eventType} event on ${fileName}`);
        // ✅ FIX: Create new timer with proper callback
        this.debounceTimer = setTimeout(() => {
            console.log(`🔄 FileSystemWatcher: Executing refresh after ${eventType} event`);
            if (this.refreshCallback) {
                try {
                    console.log('🔄 FileSystemWatcher: Calling refresh callback...');
                    this.refreshCallback();
                    console.log(`✅ FileSystemWatcher: Refresh completed successfully`);
                }
                catch (error) {
                    console.error(`❌ FileSystemWatcher: Error during refresh:`, error);
                }
            }
            else {
                console.warn(`⚠️ FileSystemWatcher: No refresh callback available`);
            }
            // Clear the timer reference
            this.debounceTimer = undefined;
        }, this.DEBOUNCE_DELAY);
    }
    /**
     * Manually triggers a refresh (for external use)
     */
    triggerRefresh() {
        console.log(`🔄 FileSystemWatcher: Manual refresh triggered`);
        this.scheduleRefresh('workspace', 'manual-trigger');
    }
    /**
     * Disposes all watchers
     */
    dispose() {
        console.log(`🧹 FileSystemWatcher: Disposing ${this.watchers.length} watchers`);
        // Clear any pending timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = undefined;
        }
        // Dispose all watchers
        this.watchers.forEach(watcher => {
            try {
                watcher.dispose();
            }
            catch (error) {
                console.error('❌ FileSystemWatcher: Error disposing watcher:', error);
            }
        });
        this.watchers = [];
        console.log('✅ FileSystemWatcher: All watchers disposed');
    }
    /**
     * Gets the status of the file system watcher
     */
    getStatus() {
        return {
            isActive: this.watchers.length > 0,
            watcherCount: this.watchers.length,
            hasCallback: this.refreshCallback !== undefined,
            hasPendingRefresh: this.debounceTimer !== undefined
        };
    }
    /**
     * Updates the refresh callback
     * @param callback New callback function
     */
    setRefreshCallback(callback) {
        console.log('🔗 FileSystemWatcher: Setting new refresh callback');
        this.refreshCallback = callback;
    }
}
exports.FileSystemWatcher = FileSystemWatcher;
//# sourceMappingURL=fileSystemWatcher.js.map