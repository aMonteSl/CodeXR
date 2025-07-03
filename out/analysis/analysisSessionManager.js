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
exports.AnalysisSessionManager = exports.AnalysisType = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
/**
 * Analysis session types
 */
var AnalysisType;
(function (AnalysisType) {
    AnalysisType["XR"] = "XR";
    AnalysisType["STATIC"] = "Static";
    AnalysisType["DOM"] = "DOM";
})(AnalysisType || (exports.AnalysisType = AnalysisType = {}));
/**
 * Centralized manager for tracking active analysis sessions
 */
class AnalysisSessionManager {
    static instance;
    sessions = new Map();
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    constructor() { }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!AnalysisSessionManager.instance) {
            AnalysisSessionManager.instance = new AnalysisSessionManager();
        }
        return AnalysisSessionManager.instance;
    }
    /**
     * Generate session key
     */
    getSessionKey(filePath, analysisType) {
        return `${filePath}::${analysisType}`;
    }
    /**
     * Add a new analysis session
     */
    addSession(filePath, analysisType, panelRef) {
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
        const session = {
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
    removeSessionByKey(sessionKey) {
        if (this.sessions.has(sessionKey)) {
            const session = this.sessions.get(sessionKey);
            console.log(`🗑️ Removing analysis session: ${session.fileName} (${session.analysisType})`);
            this.sessions.delete(sessionKey);
            this._onDidChangeTreeData.fire();
        }
    }
    /**
     * Remove session by session ID
     */
    removeSession(sessionIdOrKey) {
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
    getSession(filePath, analysisType) {
        const sessionKey = this.getSessionKey(filePath, analysisType);
        return this.sessions.get(sessionKey);
    }
    /**
     * Get all active sessions
     */
    getAllSessions() {
        return Array.from(this.sessions.values());
    }
    /**
     * Check if session exists
     */
    hasSession(filePath, analysisType) {
        const sessionKey = this.getSessionKey(filePath, analysisType);
        return this.sessions.has(sessionKey);
    }
    /**
     * Close session and dispose panel
     */
    closeSession(filePath, analysisType) {
        const session = this.getSession(filePath, analysisType);
        if (session) {
            try {
                // Dispose panel if it's a webview panel
                if (session.panelRef && session.panelRef.dispose) {
                    session.panelRef.dispose();
                }
            }
            catch (error) {
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
    reopenSession(filePath, analysisType) {
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
            }
            catch (error) {
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
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Clear all sessions
     */
    clearAllSessions() {
        for (const session of this.sessions.values()) {
            try {
                if (session.panelRef && session.panelRef.dispose) {
                    session.panelRef.dispose();
                }
            }
            catch (error) {
                console.warn('Error disposing panel during clear:', error);
            }
        }
        this.sessions.clear();
        this._onDidChangeTreeData.fire();
    }
    /**
     * Get session count
     */
    getSessionCount() {
        return this.sessions.size;
    }
    /**
     * Debug method to print all current state
     */
    debugState() {
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
exports.AnalysisSessionManager = AnalysisSessionManager;
//# sourceMappingURL=analysisSessionManager.js.map