"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActiveServerClickHandler = void 0;
const handleServerActions_1 = require("../../../active_servers/views/interactions/handleServerActions");
/**
 * Handler for Active Server section interactions
 */
class ActiveServerClickHandler {
    context;
    constructor(context) {
        this.context = context;
    }
    /**
     * Handle clicks on active server items
     */
    async handleActiveServerClick(item) {
        console.log(`ACTIVE_SERVERS_MODULAR: Handling click on active server item: ${item.label} (type: ${item.activeServerItemType})`);
        switch (item.activeServerItemType) {
            case 'server-item':
                await this.handleServerItemClick(item);
                break;
            case 'control-option':
                await this.handleControlOptionClick(item);
                break;
            case 'no-servers':
                // No action needed for informational item
                console.log('ACTIVE_SERVERS_MODULAR: Clicked on "No active servers" info item');
                break;
            default:
                console.warn(`ACTIVE_SERVERS_MODULAR: Unknown active server item type: ${item.activeServerItemType}`);
        }
    }
    /**
     * Handle click on individual server item
     */
    async handleServerItemClick(item) {
        if (!item.activeServer) {
            console.error('ACTIVE_SERVERS_MODULAR: No active server data in server item');
            return;
        }
        console.log(`ACTIVE_SERVERS_MODULAR: Handling server item click for server: ${item.activeServer.id}`);
        // Delegate to existing server actions handler
        await handleServerActions_1.ServerActionHandlers.showServerActions(item.activeServer.id);
    }
    /**
     * Handle click on control options (like "Stop All Servers")
     */
    async handleControlOptionClick(item) {
        console.log(`ACTIVE_SERVERS_MODULAR: Handling control option click: ${item.label}`);
        if (item.contextValue === 'stopAllServers') {
            await this.handleStopAllServers();
        }
        else {
            console.warn(`ACTIVE_SERVERS_MODULAR: Unknown control option: ${item.contextValue}`);
        }
    }
    /**
     * Handle "Stop All Servers" action
     */
    async handleStopAllServers() {
        console.log('ACTIVE_SERVERS_MODULAR: Handling stop all servers action');
        // Delegate to existing stop all servers handler
        await handleServerActions_1.ServerActionHandlers.stopAllServers();
    }
    /**
     * Handle right-click context menu actions
     */
    async handleContextMenuAction(action, item) {
        console.log(`ACTIVE_SERVERS_MODULAR: Handling context menu action: ${action} on item: ${item.label}`);
        switch (action) {
            case 'refresh':
                console.log('ACTIVE_SERVERS_MODULAR: Refreshing active servers view');
                await handleServerActions_1.ServerActionHandlers.refreshServers();
                break;
            case 'stopServer':
                if (item.activeServer) {
                    console.log(`ACTIVE_SERVERS_MODULAR: Stopping server: ${item.activeServer.id}`);
                    await handleServerActions_1.ServerActionHandlers.stopServer(item.activeServer.id);
                }
                break;
            case 'openBrowser':
                if (item.activeServer) {
                    console.log(`ACTIVE_SERVERS_MODULAR: Opening server in browser: ${item.activeServer.id}`);
                    await handleServerActions_1.ServerActionHandlers.openInBrowser(item.activeServer.id);
                }
                break;
            case 'openPanel':
                if (item.activeServer) {
                    console.log(`ACTIVE_SERVERS_MODULAR: Opening server in panel: ${item.activeServer.id}`);
                    await handleServerActions_1.ServerActionHandlers.openInPanel(item.activeServer.id);
                }
                break;
            case 'copyUrl':
                if (item.activeServer) {
                    console.log(`ACTIVE_SERVERS_MODULAR: Copying server URL: ${item.activeServer.id}`);
                    await handleServerActions_1.ServerActionHandlers.copyUrl(item.activeServer.id);
                }
                break;
            case 'showDetails':
                if (item.activeServer) {
                    console.log(`ACTIVE_SERVERS_MODULAR: Showing server details: ${item.activeServer.id}`);
                    await handleServerActions_1.ServerActionHandlers.showServerDetails(item.activeServer.id);
                }
                break;
            default:
                console.warn(`ACTIVE_SERVERS_MODULAR: Unknown context menu action: ${action}`);
        }
    }
}
exports.ActiveServerClickHandler = ActiveServerClickHandler;
//# sourceMappingURL=handleActiveServerClicks.js.map