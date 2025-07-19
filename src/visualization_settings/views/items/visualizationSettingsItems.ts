import * as vscode from 'vscode';
import { VisualizationSettings, SETTING_FIELDS, SettingField } from '../../model/settingsModel';
import { DynamicColorIconGenerator } from '../../utils/dynamicColorIconGenerator';

/**
 * Tree item types for visualization settings
 */
export type VisualizationSettingsItemType = 'settings-field';

/**
 * Tree item for visualization settings
 */
export class VisualizationSettingsTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: VisualizationSettingsItemType,
        public readonly settingField: SettingField,
        public readonly currentValue: string,
        public readonly command?: vscode.Command,
        public readonly iconPath?: vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri },
        public readonly tooltip?: string,
        public readonly description?: string,
        public readonly contextValue?: string
    ) {
        super(label, collapsibleState);
        
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip;
        this.description = description;
        this.contextValue = contextValue;
    }
}

/**
 * Factory for creating visualization settings items
 */
export class VisualizationSettingsItemFactory {
    /**
     * Create all visualization settings items with dynamic color icons
     */
    public static async createVisualizationSettingsItems(
        settings: VisualizationSettings, 
        context: vscode.ExtensionContext
    ): Promise<VisualizationSettingsTreeItem[]> {
        console.log('VISUALIZATION-SETTINGS: Creating settings items with dynamic color icons...');

        const items = await Promise.all(
            SETTING_FIELDS.map(field => 
                this.createSettingItem(field, settings, context)
            )
        );

        console.log(`VISUALIZATION-SETTINGS: Created ${items.length} setting items`);
        return items;
    }

    /**
     * Create individual setting tree item with dynamic color icon support
     */
    private static async createSettingItem(
        field: SettingField, 
        settings: VisualizationSettings, 
        context: vscode.ExtensionContext
    ): Promise<VisualizationSettingsTreeItem> {
        const currentValue = settings[field.key];
        
        // Format the display value (remove Unicode block for color fields since we have icons now)
        let displayValue = String(currentValue);
        let iconPath: vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri };
        
        if (field.type === 'color') {
            console.log(`COLOR-PICKER: Processing color field ${field.key} with value ${currentValue}`);
            
            try {
                // Generate dynamic color icon
                const normalizedColor = DynamicColorIconGenerator.normalizeHexColor(currentValue);
                const colorIconUri = await DynamicColorIconGenerator.getOrCreateColorIcon(
                    context, 
                    field.key, 
                    normalizedColor
                );
                
                // Clean up old icons for this setting
                DynamicColorIconGenerator.cleanupOldColorIcons(context, field.key, normalizedColor);
                
                iconPath = colorIconUri;
                console.log(`COLOR-PICKER: Successfully created color icon for ${field.key}`);
                
            } catch (error) {
                console.error(`COLOR-PICKER: Error creating color icon for ${field.key}:`, error);
                // Fallback to theme icon
                iconPath = new vscode.ThemeIcon(field.icon);
            }
        } else {
            // Use regular theme icon for non-color fields
            iconPath = new vscode.ThemeIcon(field.icon);
        }

        const item = new VisualizationSettingsTreeItem(
            field.label,
            vscode.TreeItemCollapsibleState.None,
            'settings-field',
            field,
            displayValue,
            {
                command: 'codeXR.visualizationSettings.configure',
                title: `Configure ${field.label}`,
                arguments: [field.key]
            },
            iconPath,
            `${field.description}\nCurrent value: ${currentValue}`,
            displayValue,
            'visualization-settings-field'
        );

        return item;
    }

    /**
     * Create setting item with updated value
     */
    public static async createUpdatedSettingItem(
        field: SettingField, 
        newValue: string, 
        context: vscode.ExtensionContext
    ): Promise<VisualizationSettingsTreeItem> {
        const dummySettings = { [field.key]: newValue } as any;
        return await this.createSettingItem(field, dummySettings, context);
    }
}

/**
 * Icons for visualization settings items
 */
export class VisualizationSettingsIcons {
    public static readonly backgroundColor = new vscode.ThemeIcon('color-mode');
    public static readonly groundColor = new vscode.ThemeIcon('symbol-color');
    public static readonly environmentPreset = new vscode.ThemeIcon('globe');
    public static readonly chartPalette = new vscode.ThemeIcon('symbol-misc');
    public static readonly section = new vscode.ThemeIcon('settings-gear');
}
