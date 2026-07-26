import * as vscode from 'vscode';
import {
    SettingFieldType,
    PREDEFINED_COLORS,
    ENVIRONMENT_PRESETS,
    CHART_PALETTES,
    isValidHexColor,
    EnvironmentPreset,
    ChartPalette,
    DEFAULT_VISUALIZATION_SETTINGS
} from '../../model/settingsModel';
import { VisualizationSettingsStorage } from '../../storage/settingsStorage';
import { ColorPickerUtils, ColorPickerOptions } from '../../utils/colorPickerUtils';
import { DynamicColorIconGenerator } from '../../utils/dynamicColorIconGenerator';

/**
 * Handle Visualization Settings Interactions
 * Manages user interactions with visualization settings items
 */
export class VisualizationSettingsInteractionHandler {
    private storage: VisualizationSettingsStorage;

    constructor(private context: vscode.ExtensionContext) {
        console.log('VISUALIZATION-SETTINGS: Interaction handler initialized');
        this.storage = new VisualizationSettingsStorage(context);
    }

    /**
     * Handle configuration of a specific setting field
     */
    public async handleSettingConfiguration(settingKey: SettingFieldType): Promise<void> {
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
        } catch (error) {
            console.error(`VISUALIZATION-SETTINGS: Error configuring ${settingKey}:`, error);
            vscode.window.showErrorMessage(`Failed to configure ${settingKey}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Restore every visualization setting to its default value
     */
    public async handleResetToDefaults(): Promise<void> {
        console.log('VISUALIZATION-SETTINGS: Resetting all settings to defaults');

        const current = this.storage.getSettings();
        const alreadyDefault = (Object.keys(DEFAULT_VISUALIZATION_SETTINGS) as (keyof typeof DEFAULT_VISUALIZATION_SETTINGS)[])
            .every(key => current[key] === DEFAULT_VISUALIZATION_SETTINGS[key]);

        if (alreadyDefault) {
            vscode.window.showInformationMessage('Visualization settings already use their default values.');
            return;
        }

        const confirmation = await vscode.window.showWarningMessage(
            'Reset visualization settings to default?',
            {
                modal: true,
                detail: [
                    `Background Color: ${current.backgroundColor} → ${DEFAULT_VISUALIZATION_SETTINGS.backgroundColor}`,
                    `Ground Color: ${current.groundColor} → ${DEFAULT_VISUALIZATION_SETTINGS.groundColor}`,
                    `Environment Preset: ${current.environmentPreset} → ${DEFAULT_VISUALIZATION_SETTINGS.environmentPreset}`,
                    `Chart Palette: ${current.chartPalette} → ${DEFAULT_VISUALIZATION_SETTINGS.chartPalette}`,
                ].join('\n'),
            },
            'Reset to Default',
        );

        if (confirmation !== 'Reset to Default') {
            console.log('VISUALIZATION-SETTINGS: Reset to defaults cancelled');
            return;
        }

        await this.storage.resetSettings();

        // Rebuild the swatch icons so the tree shows the default colors immediately.
        for (const colorKey of ['backgroundColor', 'groundColor'] as const) {
            const defaultColor = DynamicColorIconGenerator.normalizeHexColor(
                DEFAULT_VISUALIZATION_SETTINGS[colorKey],
            );
            try {
                await DynamicColorIconGenerator.getOrCreateColorIcon(this.context, colorKey, defaultColor);
                DynamicColorIconGenerator.cleanupOldColorIcons(this.context, colorKey, defaultColor);
            } catch (iconError) {
                console.error(`COLOR-PICKER: Error restoring default icon for ${colorKey}:`, iconError);
                // The tree regenerates the icon on render, so keep going.
            }
        }

        // Refresh the tree view
        vscode.commands.executeCommand('codexr.servers.refresh');

        vscode.window.showInformationMessage(
            `Visualization settings reset to default: background ${DEFAULT_VISUALIZATION_SETTINGS.backgroundColor}, `
            + `ground ${DEFAULT_VISUALIZATION_SETTINGS.groundColor}, `
            + `environment '${DEFAULT_VISUALIZATION_SETTINGS.environmentPreset}', `
            + `palette '${DEFAULT_VISUALIZATION_SETTINGS.chartPalette}'.`,
        );
    }

    /**
     * Handle color configuration (background or ground color) using HTML-based color picker
     */
    private async handleColorConfiguration(colorType: 'backgroundColor' | 'groundColor'): Promise<void> {
        console.log(`VISUALIZATION-SETTINGS: Configuring ${colorType} with HTML color picker`);

        const currentSettings = this.storage.getSettings();
        const currentValue = currentSettings[colorType];

        try {
            // Prepare color picker options
            const fieldName = colorType === 'backgroundColor' ? 'Background Color' : 'Ground Color';
            const options: ColorPickerOptions = {
                fieldName,
                currentColor: ColorPickerUtils.normalizeColor(currentValue)
            };

            // Create webview panel
            const panel = ColorPickerUtils.createColorPickerWebview(this.context, options);

            // Load and set HTML content
            const htmlContent = await ColorPickerUtils.loadColorPickerTemplate(this.context, options);
            panel.webview.html = htmlContent;

            // Handle messages from the webview
            const messageDisposable = panel.webview.onDidReceiveMessage(
                async (message) => {
                    switch (message.type) {
                        case 'colorPicker.confirm':
                            const newColor = ColorPickerUtils.normalizeColor(message.color);
                            console.log(`VISUALIZATION-SETTINGS: Color confirmed for ${colorType}: ${newColor}`);
                            console.log(`COLOR-PICKER: Generating new icon for ${colorType} with color ${newColor}`);
                            
                            try {
                                // Generate new color icon
                                const iconUri = await DynamicColorIconGenerator.getOrCreateColorIcon(
                                    this.context, 
                                    colorType, 
                                    newColor
                                );
                                console.log(`COLOR-PICKER: Successfully generated icon for ${colorType}: ${iconUri.toString()}`);
                                
                                // Clean up old icons
                                DynamicColorIconGenerator.cleanupOldColorIcons(this.context, colorType, newColor);
                                
                            } catch (iconError) {
                                console.error(`COLOR-PICKER: Error generating icon for ${colorType}:`, iconError);
                                // Continue with setting update even if icon generation fails
                            }
                            
                            // Update the setting
                            await this.storage.updateSetting(colorType, newColor);
                            
                            // Refresh the tree view to show new icon
                            vscode.commands.executeCommand('codexr.servers.refresh');
                            
                            vscode.window.showInformationMessage(
                                `${fieldName} set to: ${newColor}`
                            );
                            
                            // Close the panel
                            panel.dispose();
                            break;
                            
                        case 'colorPicker.cancel':
                            console.log(`VISUALIZATION-SETTINGS: Color picker cancelled for ${colorType}`);
                            panel.dispose();
                            break;
                    }
                }
            );

            // Clean up when panel is disposed
            panel.onDidDispose(() => {
                messageDisposable.dispose();
                console.log(`VISUALIZATION-SETTINGS: Color picker panel disposed for ${colorType}`);
            });

        } catch (error) {
            console.error(`VISUALIZATION-SETTINGS: Error opening color picker for ${colorType}:`, error);
            vscode.window.showErrorMessage(`Failed to open color picker: ${error}`);
            
            // Fallback to the original QuickPick method
            await this.handleColorConfigurationFallback(colorType);
        }
    }

    /**
     * Fallback color configuration using QuickPick (in case HTML color picker fails)
     */
    private async handleColorConfigurationFallback(colorType: 'backgroundColor' | 'groundColor'): Promise<void> {
        console.log(`VISUALIZATION-SETTINGS: Using fallback QuickPick for ${colorType}`);

        const currentSettings = this.storage.getSettings();
        const currentValue = currentSettings[colorType];

        // Create QuickPick options
        const colorOptions = [
            ...PREDEFINED_COLORS.map(color => ({
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

        let newColor: string;

        if (selectedOption.value === 'custom') {
            const customColor = await this.getCustomColorInput(colorType, currentValue);
            if (!customColor) {
                return; // User cancelled custom color input
            }
            newColor = customColor;
        } else {
            newColor = selectedOption.value;
        }

        // Generate color icon before updating setting
        try {
            console.log(`COLOR-PICKER: Generating fallback icon for ${colorType} with color ${newColor}`);
            
            const iconUri = await DynamicColorIconGenerator.getOrCreateColorIcon(
                this.context, 
                colorType, 
                newColor
            );
            console.log(`COLOR-PICKER: Successfully generated fallback icon for ${colorType}: ${iconUri.toString()}`);
            
            // Clean up old icons
            DynamicColorIconGenerator.cleanupOldColorIcons(this.context, colorType, newColor);
            
        } catch (iconError) {
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
    private async getCustomColorInput(colorType: string, currentValue: string): Promise<string | undefined> {
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
                    if (!isValidHexColor(value)) {
                        return 'Invalid hex color format. Use format: #RRGGBB (e.g., #FF5733)';
                    }
                    return null;
                }
            });

            if (customColor === undefined) {
                console.log(`VISUALIZATION-SETTINGS: Custom ${colorType} input cancelled`);
                return undefined;
            }

            if (isValidHexColor(customColor)) {
                console.log(`VISUALIZATION-SETTINGS: Valid custom ${colorType} entered: ${customColor}`);
                return customColor;
            }

            attempts++;
            console.log(`VISUALIZATION-SETTINGS: Invalid ${colorType} format attempt ${attempts}/${maxAttempts}: ${customColor}`);
            
            if (attempts < maxAttempts) {
                const retry = await vscode.window.showErrorMessage(
                    `Invalid hex color format: ${customColor}. Please use format #RRGGBB (e.g., #FF5733)`,
                    'Try Again',
                    'Cancel'
                );
                
                if (retry !== 'Try Again') {
                    console.log(`VISUALIZATION-SETTINGS: Custom ${colorType} input cancelled after ${attempts} attempts`);
                    return undefined;
                }
            } else {
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
    private async handleEnvironmentPresetConfiguration(): Promise<void> {
        console.log('VISUALIZATION-SETTINGS: Configuring environment preset');

        const currentSettings = this.storage.getSettings();
        const currentValue = currentSettings.environmentPreset;

        const presetOptions = ENVIRONMENT_PRESETS.map(preset => ({
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
        await this.storage.updateSetting('environmentPreset', selectedPreset.value as EnvironmentPreset);
        
        // Refresh the tree view
        vscode.commands.executeCommand('codexr.servers.refresh');

        console.log(`VISUALIZATION-SETTINGS: Environment preset updated to '${selectedPreset.value}'`);
        vscode.window.showInformationMessage(`Environment preset set to: ${selectedPreset.label} - ${selectedPreset.description}`);
    }

    /**
     * Handle chart palette configuration
     */
    private async handleChartPaletteConfiguration(): Promise<void> {
        console.log('VISUALIZATION-SETTINGS: Configuring chart palette');

        const currentSettings = this.storage.getSettings();
        const currentValue = currentSettings.chartPalette;

        const paletteOptions = CHART_PALETTES.map(palette => ({
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
        await this.storage.updateSetting('chartPalette', selectedPalette.value as ChartPalette);
        
        // Refresh the tree view
        vscode.commands.executeCommand('codexr.servers.refresh');

        console.log(`VISUALIZATION-SETTINGS: Chart palette updated to '${selectedPalette.value}'`);
        vscode.window.showInformationMessage(`Chart palette set to: ${selectedPalette.label} - ${selectedPalette.description}`);
    }

    /**
     * Get current storage instance for external access
     */
    public getStorage(): VisualizationSettingsStorage {
        return this.storage;
    }

    /**
     * Cleanup resources
     */
    public dispose(): void {
        console.log('VISUALIZATION-SETTINGS: Interaction handler disposed');
    }
}
