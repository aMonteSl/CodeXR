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
exports.CommonCommands = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Common commands utility for shared functionality across the extension
 */
class CommonCommands {
    static modularTreeProvider;
    /**
     * Set the modular tree provider for refresh operations
     */
    static setModularTreeProvider(provider) {
        this.modularTreeProvider = provider;
        console.log('COMMON_COMMANDS: Modular tree provider set for refresh operations');
    }
    /**
     * Refresh the entire tree view
     * This replaces the legacy 'codexr.servers.refresh' command
     */
    static refreshTreeView() {
        console.log('COMMON_COMMANDS: Refreshing tree view');
        if (this.modularTreeProvider && typeof this.modularTreeProvider.refresh === 'function') {
            this.modularTreeProvider.refresh();
            console.log('COMMON_COMMANDS: Tree view refreshed successfully');
        }
        else {
            console.warn('COMMON_COMMANDS: No modular tree provider available for refresh');
            // Fallback: try to execute any existing refresh commands
            try {
                vscode.commands.executeCommand('codeXR.modularTree.refresh');
            }
            catch (error) {
                console.error('COMMON_COMMANDS: Failed to refresh tree view:', error);
            }
        }
    }
    /**
     * Legacy method for backward compatibility
     * @deprecated Use refreshTreeView() instead
     */
    static refreshServers() {
        console.log('COMMON_COMMANDS: Legacy refresh servers called, delegating to refreshTreeView');
        this.refreshTreeView();
    }
}
exports.CommonCommands = CommonCommands;
//# sourceMappingURL=commonCommands.js.map