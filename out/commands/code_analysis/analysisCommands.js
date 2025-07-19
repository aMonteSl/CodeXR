"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCodeAnalysisCommands = registerCodeAnalysisCommands;
const analysisCommands_1 = require("../../code_analysis/commands/analysisCommands");
/**
 * Register Code Analysis Commands
 * Entry point for registering all code analysis related commands
 */
function registerCodeAnalysisCommands(context) {
    console.log('[CODE_ANALYSIS] Registering code analysis commands...');
    analysisCommands_1.CodeAnalysisCommands.registerCommands(context);
    console.log('[CODE_ANALYSIS] Code analysis commands registration complete');
}
//# sourceMappingURL=analysisCommands.js.map