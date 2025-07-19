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
exports.registerAllCommands = registerAllCommands;
const vscode = __importStar(require("vscode"));
const serverCommands_1 = require("./servers/serverCommands");
const activeServersCommands_1 = require("./active_servers/activeServersCommands");
const babiaExamplesCommands_1 = require("./babia_examples/babiaExamplesCommands");
const visualizeDataCommands_1 = require("./visualize_data/visualizeDataCommands");
const analysisCommands_1 = require("./code_analysis/analysisCommands");
const generalCommands_1 = require("./common/generalCommands");
const pythonEnv = __importStar(require("../python_env"));
/**
 * Entry point that registers all extension commands
 */
function registerAllCommands(context, treeDataProvider, babiaExamplesTreeDataProvider) {
    // Register general/common commands first
    (0, generalCommands_1.registerGeneralCommands)(context);
    // Register server commands
    (0, serverCommands_1.registerServerCommands)(context);
    // Register active servers commands with any refreshable tree data provider
    (0, activeServersCommands_1.registerActiveServersCommands)(context, treeDataProvider);
    // Always register Babia examples commands (they work independently now)
    (0, babiaExamplesCommands_1.registerBabiaExamplesCommands)(context, babiaExamplesTreeDataProvider);
    // Register visualize data commands
    (0, visualizeDataCommands_1.registerVisualizeDataCommands)(context);
    // Register code analysis commands
    (0, analysisCommands_1.registerCodeAnalysisCommands)(context);
    // Register Python environment commands
    pythonEnv.register(context);
    // Register the existing hello world command
    const helloWorldCommand = vscode.commands.registerCommand('CodeXR.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from Code-XR!');
    });
    context.subscriptions.push(helloWorldCommand);
}
//# sourceMappingURL=index.js.map