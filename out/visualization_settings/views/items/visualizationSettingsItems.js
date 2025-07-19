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
exports.VisualizationSettingsIcons = exports.VisualizationSettingsItemFactory = exports.VisualizationSettingsTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const settingsModel_1 = require("../../model/settingsModel");
const dynamicColorIconGenerator_1 = require("../../utils/dynamicColorIconGenerator");
/**
 * Tree item for visualization settings
 */
class VisualizationSettingsTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    type;
    settingField;
    currentValue;
    command;
    iconPath;
    tooltip;
    description;
    contextValue;
    constructor(label, collapsibleState, type, settingField, currentValue, command, iconPath, tooltip, description, contextValue) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.type = type;
        this.settingField = settingField;
        this.currentValue = currentValue;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip;
        this.description = description;
        this.contextValue = contextValue;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.VisualizationSettingsTreeItem = VisualizationSettingsTreeItem;
/**
 * Factory for creating visualization settings items
 */
class VisualizationSettingsItemFactory {
    /**
     * Create all visualization settings items with dynamic color icons
     */
    static async createVisualizationSettingsItems(settings, context) {
        console.log('VISUALIZATION-SETTINGS: Creating settings items with dynamic color icons...');
        const items = await Promise.all(settingsModel_1.SETTING_FIELDS.map(field => this.createSettingItem(field, settings, context)));
        console.log(`VISUALIZATION-SETTINGS: Created ${items.length} setting items`);
        return items;
    }
    /**
     * Create individual setting tree item with dynamic color icon support
     */
    static async createSettingItem(field, settings, context) {
        const currentValue = settings[field.key];
        // Format the display value (remove Unicode block for color fields since we have icons now)
        let displayValue = String(currentValue);
        let iconPath;
        if (field.type === 'color') {
            console.log(`COLOR-PICKER: Processing color field ${field.key} with value ${currentValue}`);
            try {
                // Generate dynamic color icon
                const normalizedColor = dynamicColorIconGenerator_1.DynamicColorIconGenerator.normalizeHexColor(currentValue);
                const colorIconUri = await dynamicColorIconGenerator_1.DynamicColorIconGenerator.getOrCreateColorIcon(context, field.key, normalizedColor);
                // Clean up old icons for this setting
                dynamicColorIconGenerator_1.DynamicColorIconGenerator.cleanupOldColorIcons(context, field.key, normalizedColor);
                iconPath = colorIconUri;
                console.log(`COLOR-PICKER: Successfully created color icon for ${field.key}`);
            }
            catch (error) {
                console.error(`COLOR-PICKER: Error creating color icon for ${field.key}:`, error);
                // Fallback to theme icon
                iconPath = new vscode.ThemeIcon(field.icon);
            }
        }
        else {
            // Use regular theme icon for non-color fields
            iconPath = new vscode.ThemeIcon(field.icon);
        }
        const item = new VisualizationSettingsTreeItem(field.label, vscode.TreeItemCollapsibleState.None, 'settings-field', field, displayValue, {
            command: 'codeXR.visualizationSettings.configure',
            title: `Configure ${field.label}`,
            arguments: [field.key]
        }, iconPath, `${field.description}\nCurrent value: ${currentValue}`, displayValue, 'visualization-settings-field');
        return item;
    }
    /**
     * Create setting item with updated value
     */
    static async createUpdatedSettingItem(field, newValue, context) {
        const dummySettings = { [field.key]: newValue };
        return await this.createSettingItem(field, dummySettings, context);
    }
}
exports.VisualizationSettingsItemFactory = VisualizationSettingsItemFactory;
/**
 * Icons for visualization settings items
 */
class VisualizationSettingsIcons {
    static backgroundColor = new vscode.ThemeIcon('color-mode');
    static groundColor = new vscode.ThemeIcon('symbol-color');
    static environmentPreset = new vscode.ThemeIcon('globe');
    static chartPalette = new vscode.ThemeIcon('symbol-misc');
    static section = new vscode.ThemeIcon('settings-gear');
}
exports.VisualizationSettingsIcons = VisualizationSettingsIcons;
//# sourceMappingURL=visualizationSettingsItems.js.map