import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Manages file system watching for automatic tree refresh
 */
export class FileSystemWatcher {
  private static instance: FileSystemWatcher | undefined;
  private watchers: vscode.FileSystemWatcher[] = [];
  private refreshCallback: (() => void) | undefined;
  private debounceTimer: NodeJS.Timeout | undefined;
  private readonly DEBOUNCE_DELAY = 300; // Reduced from 500ms to 300ms for faster response

  /**
   * Gets the singleton instance
   */
  public static getInstance(): FileSystemWatcher {
    if (!FileSystemWatcher.instance) {
      FileSystemWatcher.instance = new FileSystemWatcher();
    }
    return FileSystemWatcher.instance;
  }

  /**
   * Initializes the file system watcher
   * @param refreshCallback Function to call when files change
   */
  public initialize(refreshCallback: () => void): void {
    this.refreshCallback = refreshCallback;
    this.setupWatchers();
  }

  /**
   * Sets up file system watchers for supported file types
   */
  private setupWatchers(): void {
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
      } catch (error) {
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
    this.watchers.push(workspaceWatcher as any);

    console.log(`✅ FileSystemWatcher: Created ${this.watchers.length} watchers`);
  }

  /**
   * Schedules a refresh with debouncing to avoid excessive updates
   * @param eventType Type of file system event
   * @param fileName Name of the affected file
   */
  private scheduleRefresh(eventType: 'create' | 'delete' | 'change' | 'workspace', fileName: string): void {
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
        } catch (error) {
          console.error(`❌ FileSystemWatcher: Error during refresh:`, error);
        }
      } else {
        console.warn(`⚠️ FileSystemWatcher: No refresh callback available`);
      }
      
      // Clear the timer reference
      this.debounceTimer = undefined;
    }, this.DEBOUNCE_DELAY);
  }

  /**
   * Manually triggers a refresh (for external use)
   */
  public triggerRefresh(): void {
    console.log(`🔄 FileSystemWatcher: Manual refresh triggered`);
    this.scheduleRefresh('workspace', 'manual-trigger');
  }

  /**
   * Disposes all watchers
   */
  public dispose(): void {
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
      } catch (error) {
        console.error('❌ FileSystemWatcher: Error disposing watcher:', error);
      }
    });
    
    this.watchers = [];
    console.log('✅ FileSystemWatcher: All watchers disposed');
  }

  /**
   * Gets the status of the file system watcher
   */
  public getStatus(): {
    isActive: boolean;
    watcherCount: number;
    hasCallback: boolean;
    hasPendingRefresh: boolean;
  } {
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
  public setRefreshCallback(callback: () => void): void {
    console.log('🔗 FileSystemWatcher: Setting new refresh callback');
    this.refreshCallback = callback;
  }
}