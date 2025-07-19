"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerVisualizeDataCommands = registerVisualizeDataCommands;
const visualizeDataCommands_1 = require("../../visualize_data/commands/visualizeDataCommands");
/**
 * Register Visualize Data Commands
 * Entry point for registering all visualize data related commands
 */
function registerVisualizeDataCommands(context) {
    console.log('VISUALIZE_DATA: Registering visualize data commands...');
    visualizeDataCommands_1.VisualizeDataCommands.registerCommands(context);
    console.log('VISUALIZE_DATA: Visualize data commands registration complete');
}
//# sourceMappingURL=visualizeDataCommands.js.map