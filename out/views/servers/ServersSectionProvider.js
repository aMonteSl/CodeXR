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
exports.ServersSectionProvider = void 0;
const vscode = __importStar(require("vscode"));
const serverItems_1 = require("./items/serverItems");
const handleServerClicks_1 = require("./interactions/handleServerClicks");
const serverSettingsManager_1 = require("../../servers/storage/serverSettingsManager");
/**
 * Servers section provider for the modular tree view architecture
 */
class ServersSectionProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    constructor(context) {
        this.context = context;
        console.log('SERVERS: Servers section provider initialized');
    }
    /**
     * Get the main section item
     */
    getSectionItem() {
        console.log('SERVERS: Creating main SERVERS section item');
        return new serverItems_1.ServerTreeItem('SERVERS', vscode.TreeItemCollapsibleState.Expanded, 'config-group', undefined, new vscode.ThemeIcon('server-environment'), 'Server configuration and launch options');
    }
    /**
     * Get children for the servers section
     */
    async getChildren(element) {
        if (!element) {
            // Return main section children
            console.log('SERVERS: Loading main servers section children');
            return this.getMainSectionChildren();
        }
        // Handle sub-items based on type
        switch (element.serverItemType) {
            case 'config-group':
                if (element.label === 'Server Configuration') {
                    return this.getConfigurationChildren();
                }
                break;
            default:
                return [];
        }
        return [];
    }
    /**
     * Get main section children
     */
    getMainSectionChildren() {
        console.log('SERVERS: Creating main section children');
        // Get current server configuration for the start server option
        const port = this.getServerPort();
        const httpMode = this.getHttpMode();
        return [
            serverItems_1.ServerItemFactory.createConfigurationGroup(),
            serverItems_1.ServerItemFactory.createStartServerOption(port, httpMode)
        ];
    }
    /**
     * Get configuration children
     */
    getConfigurationChildren() {
        console.log('SERVERS: Creating configuration children');
        return serverItems_1.ServerItemFactory.createConfigurationOptions();
    }
    /**
     * Get current server port from configuration
     */
    getServerPort() {
        const config = serverSettingsManager_1.ServerSettingsManager.getInstance().getLegacyConfig();
        return config.port;
    }
    /**
     * Get current HTTP mode from configuration
     */
    getHttpMode() {
        const config = serverSettingsManager_1.ServerSettingsManager.getInstance().getLegacyConfig();
        return config.httpMode;
    }
    /**
     * Refresh the section
     */
    refresh() {
        console.log('SERVERS: Refreshing servers section');
        this._onDidChangeTreeData.fire();
    }
    /**
     * Get section name
     */
    getSectionName() {
        return 'SERVERS';
    }
    /**
     * Handle tree item clicks
     */
    async handleItemClick(item) {
        console.log(`SERVERS: Item clicked: ${item.label} (type: ${item.serverItemType})`);
        switch (item.serverItemType) {
            case 'config-group':
                await handleServerClicks_1.ServerClickHandler.handleConfigGroupClick(item);
                break;
            case 'launch-option':
                await handleServerClicks_1.ServerClickHandler.handleLaunchServerClick();
                break;
            case 'config-option':
                const labelStr = typeof item.label === 'string' ? item.label : item.label?.label || '';
                const optionType = this.getConfigOptionType(labelStr);
                await handleServerClicks_1.ServerClickHandler.handleConfigOptionClick(optionType);
                break;
        }
    }
    /**
     * Determine configuration option type from label
     */
    getConfigOptionType(label) {
        if (label.includes('HTTP Mode')) {
            return 'httpMode';
        }
        if (label.includes('Port')) {
            return 'port';
        }
        if (label.includes('Auto-Open')) {
            return 'autoOpen';
        }
        if (label.includes('Open Mode')) {
            return 'openMode';
        }
        if (label.includes('Reset')) {
            return 'reset';
        }
        return 'unknown';
    }
}
exports.ServersSectionProvider = ServersSectionProvider;
//# sourceMappingURL=ServersSectionProvider.js.map