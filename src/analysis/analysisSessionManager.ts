import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Analysis session types
 */
export enum AnalysisType {
  XR = 'XR',
  STATIC = 'Static',
  DOM = 'DOM'
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
  public addSession(filePath: string, analysisType: AnalysisType, panelRef: vscode.WebviewPanel | any): string {
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
      fileName: path.basename(filePath)
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
      this.sessions.delete(sessionKey);
      this._onDidChangeTreeData.fire();
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
      } catch (error) {
        console.warn('Error disposing panel:', error);
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
