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
exports.ServerConfigManager = void 0;
const vscode = __importStar(require("vscode"));
const defaultServerConfig_1 = require("./defaultServerConfig");
/**
 * Server Configuration Manager
 * Handles persistence and state management for server configuration
 */
class ServerConfigManager {
    static instance;
    config;
    context;
    CONFIG_KEY = 'codexr.serverConfig';
    constructor(context) {
        this.context = context;
        this.config = { ...defaultServerConfig_1.DEFAULT_SERVER_CONFIG };
    }
    /**
     * Get singleton instance
     */
    static getInstance(context) {
        if (!ServerConfigManager.instance) {
            if (!context) {
                throw new Error('SERVER: Context required for first initialization');
            }
            ServerConfigManager.instance = new ServerConfigManager(context);
        }
        return ServerConfigManager.instance;
    }
    /**
     * Get current server configuration
     */
    getServerConfig() {
        return { ...this.config };
    }
    /**
     * Update server configuration
     */
    updateServerConfig(updates) {
        this.config = { ...this.config, ...updates };
        console.log('SERVER: Configuration updated', updates);
        // Persist to global state
        this.persistConfig();
        // Refresh the tree view
        vscode.commands.executeCommand('codexr.servers.refresh');
    }
    /**
     * Restore server configuration from global state
     */
    restoreServerConfig() {
        console.log('SERVER: Restoring server configuration from global state');
        const savedConfig = this.context.globalState.get(this.CONFIG_KEY);
        if (savedConfig) {
            // Validate and merge with defaults
            this.config = {
                ...defaultServerConfig_1.DEFAULT_SERVER_CONFIG,
                ...savedConfig
            };
            console.log('SERVER: Configuration restored from global state', this.config);
        }
        else {
            console.log('SERVER: No saved configuration found, using defaults');
            this.config = { ...defaultServerConfig_1.DEFAULT_SERVER_CONFIG };
        }
    }
    /**
     * Persist configuration to global state
     */
    persistConfig() {
        this.context.globalState.update(this.CONFIG_KEY, this.config);
        console.log('SERVER: Configuration persisted to global state');
    }
    /**
     * Reset configuration to defaults
     */
    resetConfig() {
        console.log('SERVER: Resetting configuration to defaults');
        this.config = { ...defaultServerConfig_1.DEFAULT_SERVER_CONFIG };
        this.persistConfig();
        vscode.commands.executeCommand('codexr.servers.refresh');
    }
    /**
     * Get configuration for legacy compatibility
     */
    getLegacyConfig() {
        const httpModeDisplay = {
            'http': 'HTTP',
            'https-default': 'HTTPS (default certificates)',
            'https-custom': 'HTTPS (custom certificates)'
        };
        const openModeDisplay = {
            'browser': 'Browser',
            'lateral-panel': 'Lateral Panel'
        };
        return {
            httpMode: httpModeDisplay[this.config.httpMode],
            port: this.config.port,
            autoOpen: this.config.autoOpen,
            openMode: openModeDisplay[this.config.openMode]
        };
    }
}
exports.ServerConfigManager = ServerConfigManager;
//# sourceMappingURL=serverConfigManager.js.map