"use strict";
/**
 * Visualization Settings Module
 * Main entry point for visualization configuration management
 */
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
exports.getAllSelectedSettings = exports.getSelectedPalette = exports.getSelectedEnvironment = exports.getSelectedGroundColor = exports.getSelectedBackgroundColor = exports.initializeSettingsAccessors = exports.VisualizationSettingsInteractionHandler = exports.VisualizationSettingsTreeItem = exports.VisualizationSettingsItemFactory = exports.VisualizationSettingsStorage = exports.DEFAULT_VISUALIZATION_SETTINGS = void 0;
exports.registerVisualizationSettingsCommands = registerVisualizationSettingsCommands;
var settingsModel_1 = require("./model/settingsModel");
Object.defineProperty(exports, "DEFAULT_VISUALIZATION_SETTINGS", { enumerable: true, get: function () { return settingsModel_1.DEFAULT_VISUALIZATION_SETTINGS; } });
var settingsStorage_1 = require("./storage/settingsStorage");
Object.defineProperty(exports, "VisualizationSettingsStorage", { enumerable: true, get: function () { return settingsStorage_1.VisualizationSettingsStorage; } });
var visualizationSettingsItems_1 = require("./views/items/visualizationSettingsItems");
Object.defineProperty(exports, "VisualizationSettingsItemFactory", { enumerable: true, get: function () { return visualizationSettingsItems_1.VisualizationSettingsItemFactory; } });
Object.defineProperty(exports, "VisualizationSettingsTreeItem", { enumerable: true, get: function () { return visualizationSettingsItems_1.VisualizationSettingsTreeItem; } });
var handleSettingsInteraction_1 = require("./views/interactions/handleSettingsInteraction");
Object.defineProperty(exports, "VisualizationSettingsInteractionHandler", { enumerable: true, get: function () { return handleSettingsInteraction_1.VisualizationSettingsInteractionHandler; } });
// Export settings accessors for babia-templates integration
var settingsAccessors_1 = require("./utils/settingsAccessors");
Object.defineProperty(exports, "initializeSettingsAccessors", { enumerable: true, get: function () { return settingsAccessors_1.initializeSettingsAccessors; } });
Object.defineProperty(exports, "getSelectedBackgroundColor", { enumerable: true, get: function () { return settingsAccessors_1.getSelectedBackgroundColor; } });
Object.defineProperty(exports, "getSelectedGroundColor", { enumerable: true, get: function () { return settingsAccessors_1.getSelectedGroundColor; } });
Object.defineProperty(exports, "getSelectedEnvironment", { enumerable: true, get: function () { return settingsAccessors_1.getSelectedEnvironment; } });
Object.defineProperty(exports, "getSelectedPalette", { enumerable: true, get: function () { return settingsAccessors_1.getSelectedPalette; } });
Object.defineProperty(exports, "getAllSelectedSettings", { enumerable: true, get: function () { return settingsAccessors_1.getAllSelectedSettings; } });
const vscode = __importStar(require("vscode"));
const handleSettingsInteraction_2 = require("./views/interactions/handleSettingsInteraction");
const settingsAccessors_2 = require("./utils/settingsAccessors");
/**
 * Register visualization settings commands
 */
function registerVisualizationSettingsCommands(context) {
    console.log('VISUALIZATION-SETTINGS: Registering commands...');
    // Initialize settings accessors for global use
    (0, settingsAccessors_2.initializeSettingsAccessors)(context);
    // Initialize the interaction handler
    const interactionHandler = new handleSettingsInteraction_2.VisualizationSettingsInteractionHandler(context);
    // Command: Configure setting
    const configureSettingCmd = vscode.commands.registerCommand('codeXR.visualizationSettings.configure', async (settingKey) => {
        try {
            console.log(`VISUALIZATION-SETTINGS: Configure command triggered for: ${settingKey}`);
            await interactionHandler.handleSettingConfiguration(settingKey);
        }
        catch (error) {
            console.error('VISUALIZATION-SETTINGS: Error in configure command:', error);
            vscode.window.showErrorMessage(`Failed to configure setting: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Register commands with the extension context
    context.subscriptions.push(configureSettingCmd);
    // Store interaction handler for cleanup
    context.subscriptions.push({
        dispose: () => interactionHandler.dispose()
    });
    console.log('VISUALIZATION-SETTINGS: Commands registered successfully');
}
//# sourceMappingURL=index.js.map