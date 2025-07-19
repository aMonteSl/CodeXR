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
exports.ServersTreeDataProvider = exports.ServerTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const serverCommands_1 = require("../commands/serverCommands");
const configurationItems_1 = require("./items/configurationItems");
const serverNodeIcons_1 = require("./items/serverNodeIcons");
class ServerTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    type;
    command;
    iconPath;
    tooltip;
    description;
    children;
    constructor(label, collapsibleState, type, command, iconPath, tooltip, description, children) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.type = type;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip;
        this.description = description;
        this.children = children;
        this.tooltip = tooltip || this.label;
        this.iconPath = iconPath;
        this.description = description;
    }
}
exports.ServerTreeItem = ServerTreeItem;
class ServersTreeDataProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    constructor() {
        console.log('SERVER: ServersTreeDataProvider initialized');
        // Register refresh command
        vscode.commands.registerCommand('codexr.servers.refresh', () => {
            this.refresh();
        });
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            // Root level - return server configuration and launch items directly
            console.log('SERVER: Loading root server items');
            const config = (0, serverCommands_1.getCurrentServerConfig)();
            return Promise.resolve([
                new ServerTreeItem('Server Configuration', vscode.TreeItemCollapsibleState.Expanded, 'config-group', undefined, serverNodeIcons_1.ServerNodeIcons.configuration, 'Configure server settings'),
                new ServerTreeItem('Start Local Server', vscode.TreeItemCollapsibleState.None, 'option', {
                    command: 'codexr.server.launch',
                    title: 'Start Local Server'
                }, serverNodeIcons_1.ServerNodeIcons.startServer, 'Launch a local server with current configuration')
            ]);
        }
        if (element.type === 'config-group' && element.label === 'Server Configuration') {
            // Children of Server Configuration group - return the configuration options
            console.log('SERVER: Loading server configuration options');
            return Promise.resolve((0, configurationItems_1.createConfigurationItems)());
        }
        return Promise.resolve([]);
    }
    refresh() {
        console.log('SERVER: Refreshing servers tree view');
        this._onDidChangeTreeData.fire();
    }
}
exports.ServersTreeDataProvider = ServersTreeDataProvider;
//# sourceMappingURL=serversTreeView.js.map