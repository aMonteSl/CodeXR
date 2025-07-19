"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerActiveServersCommands = registerActiveServersCommands;
exports.getActiveServersCommandIds = getActiveServersCommandIds;
const activeServersCommands_1 = require("../../active_servers/commands/activeServersCommands");
/**
 * Active Servers Commands Wrapper
 * Re-exports active servers commands for centralized command registration
 */
/**
 * Register all active servers commands
 * @param context VS Code extension context
 * @param treeDataProvider Any tree data provider that supports refresh operations
 */
function registerActiveServersCommands(context, treeDataProvider) {
    console.log('COMMANDS: Registering active servers commands');
    activeServersCommands_1.ActiveServersCommands.registerCommands(context, treeDataProvider);
}
/**
 * Get active servers command IDs for external reference
 */
function getActiveServersCommandIds() {
    return activeServersCommands_1.ActiveServersCommands.getCommandIds();
}
//# sourceMappingURL=activeServersCommands.js.map