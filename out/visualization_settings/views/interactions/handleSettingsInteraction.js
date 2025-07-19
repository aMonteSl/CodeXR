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
exports.VisualizationSettingsInteractionHandler = void 0;
const vscode = __importStar(require("vscode"));
const settingsModel_1 = require("../../model/settingsModel");
const settingsStorage_1 = require("../../storage/settingsStorage");
const colorPickerUtils_1 = require("../../utils/colorPickerUtils");
const dynamicColorIconGenerator_1 = require("../../utils/dynamicColorIconGenerator");
/**
 * Handle Visualization Settings Interactions
 * Manages user interactions with visualization settings items
 */
class VisualizationSettingsInteractionHandler {
    context;
    storage;
    constructor(context) {
        this.context = context;
        console.log('VISUALIZATION-SETTINGS: Interaction handler initialized');
        this.storage = new settingsStorage_1.VisualizationSettingsStorage(context);
    }
    /**
     * Handle configuration of a specific setting field
     */
    async handleSettingConfiguration(settingKey) {
        console.log(`VISUALIZATION-SETTINGS: Configuring setting '${settingKey}'`);
        try {
            switch (settingKey) {
                case 'backgroundColor':
                case 'groundColor':
                    await this.handleColorConfiguration(settingKey);
                    break;
                case 'environmentPreset':
                    await this.handleEnvironmentPresetConfiguration();
                    break;
                case 'chartPalette':
                    await this.handleChartPaletteConfiguration();
                    break;
                default:
                    throw new Error(`Unknown setting key: ${settingKey}`);
            }
        }
        catch (error) {
            console.error(`VISUALIZATION-SETTINGS: Error configuring ${settingKey}:`, error);
            vscode.window.showErrorMessage(`Failed to configure ${settingKey}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Handle color configuration (background or ground color) using HTML-based color picker
     */
    async handleColorConfiguration(colorType) {
        console.log(`VISUALIZATION-SETTINGS: Configuring ${colorType} with HTML color picker`);
        const currentSettings = this.storage.getSettings();
        const currentValue = currentSettings[colorType];
        try {
            // Prepare color picker options
            const fieldName = colorType === 'backgroundColor' ? 'Background Color' : 'Ground Color';
            const options = {
                fieldName,
                currentColor: colorPickerUtils_1.ColorPickerUtils.normalizeColor(currentValue)
            };
            // Create webview panel
            const panel = colorPickerUtils_1.ColorPickerUtils.createColorPickerWebview(this.context, options);
            // Load and set HTML content
            const htmlContent = await colorPickerUtils_1.ColorPickerUtils.loadColorPickerTemplate(this.context, options);
            panel.webview.html = htmlContent;
            // Handle messages from the webview
            const messageDisposable = panel.webview.onDidReceiveMessage(async (message) => {
                switch (message.type) {
                    case 'colorPicker.confirm':
                        const newColor = colorPickerUtils_1.ColorPickerUtils.normalizeColor(message.color);
                        console.log(`VISUALIZATION-SETTINGS: Color confirmed for ${colorType}: ${newColor}`);
                        console.log(`COLOR-PICKER: Generating new icon for ${colorType} with color ${newColor}`);
                        try {
                            // Generate new color icon
                            const iconUri = await dynamicColorIconGenerator_1.DynamicColorIconGenerator.getOrCreateColorIcon(this.context, colorType, newColor);
                            console.log(`COLOR-PICKER: Successfully generated icon for ${colorType}: ${iconUri.toString()}`);
                            // Clean up old icons
                            dynamicColorIconGenerator_1.DynamicColorIconGenerator.cleanupOldColorIcons(this.context, colorType, newColor);
                        }
                        catch (iconError) {
                            console.error(`COLOR-PICKER: Error generating icon for ${colorType}:`, iconError);
                            // Continue with setting update even if icon generation fails
                        }
                        // Update the setting
                        await this.storage.updateSetting(colorType, newColor);
                        // Refresh the tree view to show new icon
                        vscode.commands.executeCommand('codexr.servers.refresh');
                        vscode.window.showInformationMessage(`${fieldName} set to: ${newColor}`);
                        // Close the panel
                        panel.dispose();
                        break;
                    case 'colorPicker.cancel':
                        console.log(`VISUALIZATION-SETTINGS: Color picker cancelled for ${colorType}`);
                        panel.dispose();
                        break;
                }
            });
            // Clean up when panel is disposed
            panel.onDidDispose(() => {
                messageDisposable.dispose();
                console.log(`VISUALIZATION-SETTINGS: Color picker panel disposed for ${colorType}`);
            });
        }
        catch (error) {
            console.error(`VISUALIZATION-SETTINGS: Error opening color picker for ${colorType}:`, error);
            vscode.window.showErrorMessage(`Failed to open color picker: ${error}`);
            // Fallback to the original QuickPick method
            await this.handleColorConfigurationFallback(colorType);
        }
    }
    /**
     * Fallback color configuration using QuickPick (in case HTML color picker fails)
     */
    async handleColorConfigurationFallback(colorType) {
        console.log(`VISUALIZATION-SETTINGS: Using fallback QuickPick for ${colorType}`);
        const currentSettings = this.storage.getSettings();
        const currentValue = currentSettings[colorType];
        // Create QuickPick options
        const colorOptions = [
            ...settingsModel_1.PREDEFINED_COLORS.map(color => ({
                label: color.label,
                value: color.value,
                picked: color.value === currentValue
            })),
            {
                label: 'Pick a custom color...',
                value: 'custom',
                picked: false
            }
        ];
        const selectedOption = await vscode.window.showQuickPick(colorOptions, {
            placeHolder: `Select ${colorType.replace(/([A-Z])/g, ' $1').toLowerCase()}`,
            title: `Configure ${colorType.replace(/([A-Z])/g, ' $1')}`,
            matchOnDescription: true
        });
        if (!selectedOption) {
            console.log(`VISUALIZATION-SETTINGS: ${colorType} configuration cancelled`);
            return;
        }
        let newColor;
        if (selectedOption.value === 'custom') {
            const customColor = await this.getCustomColorInput(colorType, currentValue);
            if (!customColor) {
                return; // User cancelled custom color input
            }
            newColor = customColor;
        }
        else {
            newColor = selectedOption.value;
        }
        // Generate color icon before updating setting
        try {
            console.log(`COLOR-PICKER: Generating fallback icon for ${colorType} with color ${newColor}`);
            const iconUri = await dynamicColorIconGenerator_1.DynamicColorIconGenerator.getOrCreateColorIcon(this.context, colorType, newColor);
            console.log(`COLOR-PICKER: Successfully generated fallback icon for ${colorType}: ${iconUri.toString()}`);
            // Clean up old icons
            dynamicColorIconGenerator_1.DynamicColorIconGenerator.cleanupOldColorIcons(this.context, colorType, newColor);
        }
        catch (iconError) {
            console.error(`COLOR-PICKER: Error generating fallback icon for ${colorType}:`, iconError);
            // Continue with setting update even if icon generation fails
        }
        // Update the setting
        await this.storage.updateSetting(colorType, newColor);
        // Refresh the tree view
        vscode.commands.executeCommand('codexr.servers.refresh');
        console.log(`VISUALIZATION-SETTINGS: ${colorType} updated to '${newColor}'`);
        vscode.window.showInformationMessage(`${colorType.replace(/([A-Z])/g, ' $1')} set to: ${newColor}`);
    }
    /**
     * Get custom color input from user
     */
    async getCustomColorInput(colorType, currentValue) {
        let attempts = 0;
        const maxAttempts = 3;
        while (attempts < maxAttempts) {
            const customColor = await vscode.window.showInputBox({
                prompt: `Enter hex color for ${colorType.replace(/([A-Z])/g, ' $1').toLowerCase()} (e.g., #FF5733)`,
                value: currentValue,
                validateInput: (value) => {
                    if (!value) {
                        return 'Color value is required';
                    }
                    if (!(0, settingsModel_1.isValidHexColor)(value)) {
                        return 'Invalid hex color format. Use format: #RRGGBB (e.g., #FF5733)';
                    }
                    return null;
                }
            });
            if (customColor === undefined) {
                console.log(`VISUALIZATION-SETTINGS: Custom ${colorType} input cancelled`);
                return undefined;
            }
            if ((0, settingsModel_1.isValidHexColor)(customColor)) {
                console.log(`VISUALIZATION-SETTINGS: Valid custom ${colorType} entered: ${customColor}`);
                return customColor;
            }
            attempts++;
            console.log(`VISUALIZATION-SETTINGS: Invalid ${colorType} format attempt ${attempts}/${maxAttempts}: ${customColor}`);
            if (attempts < maxAttempts) {
                const retry = await vscode.window.showErrorMessage(`Invalid hex color format: ${customColor}. Please use format #RRGGBB (e.g., #FF5733)`, 'Try Again', 'Cancel');
                if (retry !== 'Try Again') {
                    console.log(`VISUALIZATION-SETTINGS: Custom ${colorType} input cancelled after ${attempts} attempts`);
                    return undefined;
                }
            }
            else {
                vscode.window.showErrorMessage(`Failed to set ${colorType} after ${maxAttempts} attempts. Please try again later.`);
                console.log(`VISUALIZATION-SETTINGS: Custom ${colorType} input failed after ${maxAttempts} attempts`);
                return undefined;
            }
        }
        return undefined;
    }
    /**
     * Handle environment preset configuration
     */
    async handleEnvironmentPresetConfiguration() {
        console.log('VISUALIZATION-SETTINGS: Configuring environment preset');
        const currentSettings = this.storage.getSettings();
        const currentValue = currentSettings.environmentPreset;
        const presetOptions = settingsModel_1.ENVIRONMENT_PRESETS.map(preset => ({
            label: preset.label,
            description: preset.description,
            value: preset.value,
            picked: preset.value === currentValue
        }));
        const selectedPreset = await vscode.window.showQuickPick(presetOptions, {
            placeHolder: 'Select environment preset',
            title: 'Configure Environment Preset',
            matchOnDescription: true
        });
        if (!selectedPreset) {
            console.log('VISUALIZATION-SETTINGS: Environment preset configuration cancelled');
            return;
        }
        // Update the setting
        await this.storage.updateSetting('environmentPreset', selectedPreset.value);
        // Refresh the tree view
        vscode.commands.executeCommand('codexr.servers.refresh');
        console.log(`VISUALIZATION-SETTINGS: Environment preset updated to '${selectedPreset.value}'`);
        vscode.window.showInformationMessage(`Environment preset set to: ${selectedPreset.label} - ${selectedPreset.description}`);
    }
    /**
     * Handle chart palette configuration
     */
    async handleChartPaletteConfiguration() {
        console.log('VISUALIZATION-SETTINGS: Configuring chart palette');
        const currentSettings = this.storage.getSettings();
        const currentValue = currentSettings.chartPalette;
        const paletteOptions = settingsModel_1.CHART_PALETTES.map(palette => ({
            label: palette.label,
            description: palette.description,
            value: palette.value,
            picked: palette.value === currentValue
        }));
        const selectedPalette = await vscode.window.showQuickPick(paletteOptions, {
            placeHolder: 'Select chart palette',
            title: 'Configure Chart Palette',
            matchOnDescription: true
        });
        if (!selectedPalette) {
            console.log('VISUALIZATION-SETTINGS: Chart palette configuration cancelled');
            return;
        }
        // Update the setting
        await this.storage.updateSetting('chartPalette', selectedPalette.value);
        // Refresh the tree view
        vscode.commands.executeCommand('codexr.servers.refresh');
        console.log(`VISUALIZATION-SETTINGS: Chart palette updated to '${selectedPalette.value}'`);
        vscode.window.showInformationMessage(`Chart palette set to: ${selectedPalette.label} - ${selectedPalette.description}`);
    }
    /**
     * Get current storage instance for external access
     */
    getStorage() {
        return this.storage;
    }
    /**
     * Cleanup resources
     */
    dispose() {
        console.log('VISUALIZATION-SETTINGS: Interaction handler disposed');
    }
}
exports.VisualizationSettingsInteractionHandler = VisualizationSettingsInteractionHandler;
//# sourceMappingURL=handleSettingsInteraction.js.map