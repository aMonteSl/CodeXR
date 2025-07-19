"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBabiaExamplesCommands = registerBabiaExamplesCommands;
const babiaExamplesCommands_1 = require("../../babia_examples/commands/babiaExamplesCommands");
/**
 * Register Babia Examples Commands
 * Entry point for registering all Babia examples related commands
 */
function registerBabiaExamplesCommands(context, treeDataProvider) {
    console.log('EXAMPLES: Registering Babia examples commands...');
    babiaExamplesCommands_1.BabiaExamplesCommands.registerCommands(context, treeDataProvider);
    console.log('EXAMPLES: Babia examples commands registration complete');
}
//# sourceMappingURL=babiaExamplesCommands.js.map