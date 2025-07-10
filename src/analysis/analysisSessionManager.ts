import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Analysis session types
 */
export enum AnalysisType {
  XR = 'XR',
  STATIC = 'Static',
  DOM = 'DOM',
  DIRECTORY = 'Directory'
}

/**
 * Analysis session interface
 */
export interface AnalysisSession {
  id: string;
  filePath: string;
  analysisType: AnalysisType;
  panelRef: vscode.WebviewPanel | any; // 'any' for browser panels
  created: Date;
  fileName: string;
  metadata?: {
    mode?: 'shallow' | 'deep'; // For directory analysis mode
    [key: string]: any; // Allow for future extensions
  };
}

/**
 * Centralized manager for tracking active analysis sessions
 */
export class AnalysisSessionManager {
  private static instance: AnalysisSessionManager;
  private sessions: Map<string, AnalysisSession> = new Map();
  private _onDidChangeTreeData: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData: vscode.Event<void> = this._onDidChangeTreeData.event;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): AnalysisSessionManager {
    if (!AnalysisSessionManager.instance) {
      AnalysisSessionManager.instance = new AnalysisSessionManager();
    }
    return AnalysisSessionManager.instance;
  }

  /**
   * Generate session key
   */
  private getSessionKey(filePath: string, analysisType: AnalysisType): string {
    return `${filePath}::${analysisType}`;
  }

  /**
   * Add a new analysis session
   */
  public addSession(
    filePath: string, 
    analysisType: AnalysisType, 
    panelRef: vscode.WebviewPanel | any,
    metadata?: { mode?: 'shallow' | 'deep'; [key: string]: any }
  ): string {
    const sessionId = this.generateSessionId();
    const sessionKey = this.getSessionKey(filePath, analysisType);
    
    console.log(`🔍 [SessionManager] Adding session: ${filePath} (${analysisType})`);
    console.log(`🔍 [SessionManager] Session key: ${sessionKey}`);
    console.log(`🔍 [SessionManager] Current sessions count: ${this.sessions.size}`);
    
    // Close existing session if any
    if (this.sessions.has(sessionKey)) {
      console.log(`🔍 [SessionManager] Found existing session, removing it first`);
      this.removeSession(sessionKey);
    }

    const session: AnalysisSession = {
      id: sessionId,
      filePath,
      analysisType,
      panelRef,
      created: new Date(),
      fileName: path.basename(filePath),
      metadata
    };

    this.sessions.set(sessionKey, session);
    
    console.log(`📊 [SessionManager] Added analysis session: ${session.fileName} (${analysisType})`);
    console.log(`📊 [SessionManager] Total sessions now: ${this.sessions.size}`);
    
    // List all current sessions for debugging
    console.log(`📊 [SessionManager] All sessions:`);
    for (const [key, sess] of this.sessions.entries()) {
      console.log(`  - ${sess.fileName} (${sess.analysisType}) - ${sess.id}`);
    }
    
    // Listen for panel disposal
    if (panelRef && panelRef.onDidDispose) {
      panelRef.onDidDispose(() => {
        this.removeSessionByKey(sessionKey);
      });
    }

    console.log(`� [SessionManager] Firing tree data change event...`);
    this._onDidChangeTreeData.fire();
    console.log(`✅ [SessionManager] Tree data change event fired!`);
    
    return sessionId;
  }

  /**
   * Remove session by key
   */
  private removeSessionByKey(sessionKey: string): void {
    if (this.sessions.has(sessionKey)) {
      const session = this.sessions.get(sessionKey)!;
      console.log(`🗑️ Removing analysis session: ${session.fileName} (${session.analysisType})`);
      
      // Call appropriate cleanup based on analysis type
      this.cleanupSessionResources(session);
      
      this.sessions.delete(sessionKey);
      this._onDidChangeTreeData.fire();
    }
  }

  /**
   * Cleanup session-specific resources
   */
  private cleanupSessionResources(session: AnalysisSession): void {
    try {
      switch (session.analysisType) {
        case AnalysisType.DIRECTORY:
          // For directory analysis, check if it's XR mode by looking at panelRef type
          if (session.panelRef && typeof session.panelRef === 'object' && 'id' in session.panelRef) {
            // This is a ServerInfo object, indicating XR analysis
            console.log(`🛑 Cleaning up Directory XR resources for: ${session.filePath}`);
            this.cleanupDirectoryXRSession(session.filePath);
          } else {
            // This is a webview panel, handled by default disposal
            console.log(`🛑 Directory static panel cleanup handled by panel disposal for: ${session.filePath}`);
          }
          break;
          
        case AnalysisType.STATIC:
          // Static analysis cleanup is handled by panel disposal
          console.log(`🛑 Static analysis cleanup handled by panel disposal for: ${session.filePath}`);
          break;
          
        case AnalysisType.XR:
          // File XR analysis cleanup
          console.log(`🛑 Cleaning up File XR resources for: ${session.filePath}`);
          this.cleanupFileXRSession(session.filePath);
          break;
          
        default:
          console.log(`🛑 No specific cleanup for analysis type: ${session.analysisType}`);
      }
    } catch (error) {
      console.warn(`⚠️ Error during session cleanup for ${session.filePath}:`, error);
    }
  }

  /**
   * Cleanup Directory XR session resources
   */
  private cleanupDirectoryXRSession(directoryPath: string): void {
    console.log(`DIRECTORY-ANALYSIS: XR Cleaning up resources for session removal: ${directoryPath}`);
    
    // Use a try-catch with require to avoid TypeScript module resolution issues
    try {
      const directoryXRManager = require('../xr/directoryXRAnalysisManager');
      if (directoryXRManager && directoryXRManager.cleanupDirectoryXRResources) {
        directoryXRManager.cleanupDirectoryXRResources(directoryPath);
      }
    } catch (error) {
      console.warn(`⚠️ Could not cleanup Directory XR resources:`, error);
    }
  }

  /**
   * Cleanup File XR session resources  
   */
  private cleanupFileXRSession(filePath: string): void {
    console.log(`DIRECTORY-ANALYSIS: XR Cleaning up file XR resources for session removal: ${filePath}`);
    
    // Use a try-catch with require to avoid TypeScript module resolution issues
    try {
      const xrManager = require('../xr/xrAnalysisManager');
      if (xrManager && xrManager.cleanupVisualizationForFile) {
        xrManager.cleanupVisualizationForFile(filePath);
      }
    } catch (error) {
      console.warn(`⚠️ Could not cleanup File XR resources:`, error);
    }
  }

  /**
   * Remove session by session ID
   */
  public removeSession(sessionIdOrKey: string): void {
    // Try to find by session key first
    if (this.sessions.has(sessionIdOrKey)) {
      this.removeSessionByKey(sessionIdOrKey);
      return;
    }

    // Try to find by session ID
    for (const [key, session] of this.sessions.entries()) {
      if (session.id === sessionIdOrKey) {
        this.removeSessionByKey(key);
        return;
      }
    }
  }

  /**
   * Get session by file path and type
   */
  public getSession(filePath: string, analysisType: AnalysisType): AnalysisSession | undefined {
    const sessionKey = this.getSessionKey(filePath, analysisType);
    return this.sessions.get(sessionKey);
  }

  /**
   * Get all active sessions
   */
  public getAllSessions(): AnalysisSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Check if session exists
   */
  public hasSession(filePath: string, analysisType: AnalysisType): boolean {
    const sessionKey = this.getSessionKey(filePath, analysisType);
    return this.sessions.has(sessionKey);
  }

  /**
   * Close session and dispose panel
   */
  public closeSession(filePath: string, analysisType: AnalysisType): void {
    const session = this.getSession(filePath, analysisType);
    if (session) {
      try {
        // Dispose panel if it's a webview panel
        if (session.panelRef && session.panelRef.dispose) {
          session.panelRef.dispose();
        }
        
        // For XR and DOM analyses, also stop the related server
        if (analysisType === AnalysisType.XR || analysisType === AnalysisType.DOM || analysisType === AnalysisType.DIRECTORY) {
          console.log(`🔄 Closing ${analysisType} analysis - checking for related server to stop`);
          
          // Import server manager to avoid circular dependencies
          const { getActiveServers, stopServer } = require('../server/serverManager');
          const activeServers = getActiveServers();
          
          // Find server associated with this session
          const relatedServer = activeServers.find((server: any) => {
            // For directory XR analysis, check for DIR: prefix in analysisFileName
            if (analysisType === AnalysisType.DIRECTORY && session.metadata?.visualizationType === 'xr') {
              return server.filePath === session.filePath && 
                     server.analysisFileName?.startsWith('DIR:');
            }
            
            // For file XR analysis, check for matching file path or analysis file name
            if (analysisType === AnalysisType.XR) {
              // Check if server is serving from the same file path
              if (server.filePath === session.filePath) {
                return true;
              }
              
              // Check if analysis file name matches (for file-based XR)
              if (server.analysisFileName) {
                const sessionFileName = path.basename(session.filePath, path.extname(session.filePath));
                return server.analysisFileName === sessionFileName ||
                       server.analysisFileName.includes(sessionFileName);
              }
            }
            
            // For other analyses, use existing logic
            return server.filePath === session.filePath && (
              server.analysisFileName?.includes(analysisType) ||
              server.analysisFileName?.includes('XR')
            );
          });
          
          if (relatedServer) {
            console.log(`🛑 Stopping related server for ${analysisType} analysis: ${relatedServer.id}`);
            stopServer(relatedServer.id);
          } else {
            // If we didn't find the server with the primary logic, try alternative approaches
            console.log(`⚠️ Could not find server with primary logic, trying alternative approaches...`);
            
            // For XR analyses, try finding by visualization directory pattern
            if (analysisType === AnalysisType.XR || (analysisType === AnalysisType.DIRECTORY && session.metadata?.visualizationType === 'xr')) {
              const alternativeServer = activeServers.find((server: any) => {
                // Check if server path contains visualization directories
                return server.filePath.includes('visualizations') && 
                       (server.filePath.includes('xr') || server.analysisFileName);
              });
              
              if (alternativeServer) {
                console.log(`🛑 Found and stopping alternative XR server: ${alternativeServer.id}`);
                stopServer(alternativeServer.id);
              }
            }
          }
          
          // Comprehensive cleanup for XR analyses
          if (analysisType === AnalysisType.XR) {
            // File XR analysis cleanup
            try {
              console.log(`🧹 Performing file XR cleanup for: ${session.filePath}`);
              // Import file XR manager to perform cleanup
              const xrManager = require('../xr/xrAnalysisManager');
              if (xrManager && xrManager.cleanupVisualizationForFile) {
                xrManager.cleanupVisualizationForFile(session.filePath);
              }
            } catch (error) {
              console.warn('Error during file XR analysis cleanup:', error);
            }
          } else if (analysisType === AnalysisType.DIRECTORY && session.metadata?.visualizationType === 'xr') {
            // Directory XR analysis cleanup - try both managers to ensure comprehensive cleanup
            try {
              console.log(`🧹 Performing comprehensive XR directory cleanup for: ${session.filePath}`);
              
              // Try shared XR analysis manager first
              try {
                const { XRAnalysisManager } = require('../shared/xrAnalysisManager');
                XRAnalysisManager.cleanupXRVisualization(session.filePath);
              } catch (error) {
                console.warn('Shared XR analysis manager cleanup failed:', error);
              }
              
              // Also try old directory XR analysis manager
              try {
                const directoryXRManager = require('../xr/directoryXRAnalysisManager');
                if (directoryXRManager && directoryXRManager.cleanupDirectoryXRVisualization) {
                  directoryXRManager.cleanupDirectoryXRVisualization(session.filePath);
                }
              } catch (error) {
                console.warn('Directory XR analysis manager cleanup failed:', error);
              }
              
            } catch (error) {
              console.warn('Error during XR directory analysis cleanup:', error);
            }
          }
        }
      } catch (error) {
        console.warn('Error disposing panel or stopping server:', error);
      }
      
      // Remove from tracking
      const sessionKey = this.getSessionKey(filePath, analysisType);
      this.removeSessionByKey(sessionKey);
    }
  }

  /**
   * Reopen/focus existing session
   */
  public reopenSession(filePath: string, analysisType: AnalysisType): boolean {
    const session = this.getSession(filePath, analysisType);
    if (session && session.panelRef) {
      try {
        // For webview panels, reveal them
        if (session.panelRef.reveal) {
          session.panelRef.reveal(vscode.ViewColumn.One);
          return true;
        }
        
        // For browser-based panels, we might need to reopen the URL
        // This would be handled by the specific analysis command
        return true;
      } catch (error) {
        console.warn('Error reopening session:', error);
        // If we can't reopen, remove the stale session
        this.removeSession(session.id);
        return false;
      }
    }
    return false;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all sessions
   */
  public clearAllSessions(): void {
    for (const session of this.sessions.values()) {
      try {
        if (session.panelRef && session.panelRef.dispose) {
          session.panelRef.dispose();
        }
      } catch (error) {
        console.warn('Error disposing panel during clear:', error);
      }
    }
    this.sessions.clear();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get session count
   */
  public getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Debug method to print all current state
   */
  public debugState(): void {
    console.log('🔍 [SessionManager] === DEBUG STATE ===');
    console.log(`🔍 [SessionManager] Total sessions: ${this.sessions.size}`);
    console.log('🔍 [SessionManager] Active sessions:');
    for (const [key, session] of this.sessions.entries()) {
      console.log(`  📋 Key: ${key}`);
      console.log(`     - ID: ${session.id}`);
      console.log(`     - File: ${session.fileName} (${session.filePath})`);
      console.log(`     - Type: ${session.analysisType}`);
      console.log(`     - Created: ${session.created.toISOString()}`);
      console.log(`     - Panel Ref: ${session.panelRef ? 'EXISTS' : 'NULL'}`);
    }
    console.log('🔍 [SessionManager] === END DEBUG STATE ===');
  }
}
