# VISUALIZATION_SETTINGS.md - Visualization Settings Subsystem Technical Documentation

## Overview & Purpose

The Visualization Settings subsystem provides comprehensive configuration management for visual rendering preferences in Code-XR's WebXR/AR/VR visualizations. Users can configure four core aspects of visualization appearance:

- **Background Color**: Scene background color in hex format (#RRGGBB)
- **Ground Color**: Environment ground surface color in hex format (#RRGGBB)  
- **Environment Preset**: A-Frame environment component presets (forest, tron, egypt, etc.)
- **Chart Palette**: BabiaXR chart color schemes (ubuntu, blues, commerce, etc.)

These settings are globally applied to all generated visualizations, affecting both data visualization charts and code analysis XR environments. The subsystem integrates with the main Code-XR TreeView under the "VISUALIZATION SETTINGS" section, providing an intuitive interface for configuration management.

### UI Location and Integration

The settings appear in the main Code-XR TreeView as:
```
Code-XR Extension
├── Servers
├── Active Servers  
├── Babia Examples
├── Visualize Data
└── VISUALIZATION SETTINGS          # Collapsible section
    ├── Background Color   🟦        # Dynamic color swatch icon
    ├── Ground Color       🟤        # Dynamic color swatch icon
    ├── Environment Preset 🌍        # Globe icon
    └── Chart Palette      🎨        # Misc symbol icon
```

## Architecture & File Map

The subsystem follows a modular architecture with clear separation of concerns:

### Core Components

- **`src/visualization_settings/model/settingsModel.ts`**: TypeScript interfaces, enums, validation rules, and configuration constants
- **`src/visualization_settings/storage/settingsStorage.ts`**: File-based persistence using globalStorage with legacy migration support
- **`src/visualization_settings/commands/visualizationSettingsCommands.ts`**: VS Code command registration and delegation to interaction handlers
- **`src/visualization_settings/views/interactions/handleSettingsInteraction.ts`**: Main interaction logic for color pickers, QuickPick selections, and validation
- **`src/visualization_settings/utils/colorPickerUtils.ts`**: HTML-based color picker webview creation and template processing
- **`src/visualization_settings/utils/dynamicColorIconGenerator.ts`**: SVG icon generation for color swatch visualization in TreeView
- **`src/visualization_settings/utils/settingsAccessors.ts`**: Clean accessor functions for template integration (no VS Code dependencies)
- **`src/visualization_settings/views/items/visualizationSettingsItems.ts`**: TreeView item factory with dynamic color icon support

### View Integration Layer

- **`src/views/visualization_settings/VisualizationSettingsSectionProvider.ts`**: Modular TreeView section provider for main Code-XR tree integration
- **`src/views/visualization_settings/items/visualizationSettingsItems.ts`**: Modular tree item factories for sectioned display
- **`src/views/visualization_settings/interactions/handleVisualizationSettingsClicks.ts`**: Click handling delegation to core interaction logic

### Template Integration

- **`src/utils/getVisualizationConfiguration.ts`**: Centralized settings retrieval for template processors with fallback defaults
- Applied in: `src/babia_templates/processing/templateProcessor.ts`, `src/babia_templates/processing/templateHTMLProcessor.ts`

## Data Model & Persistence

### Core TypeScript Interfaces

```typescript
interface VisualizationSettings {
    backgroundColor: string;        // Hex color (e.g., "#FFFFFF")
    groundColor: string;           // Hex color (e.g., "#000000") 
    environmentPreset: EnvironmentPreset;  // Enum value
    chartPalette: ChartPalette;    // Enum value
}

type EnvironmentPreset = 
    | 'none' | 'default' | 'forest' | 'egypt' | 'dream' | 'volcano' 
    | 'arches' | 'tron' | 'japan' | 'threetowers' | 'poison' | 'contact';

type ChartPalette = 
    | 'ubuntu' | 'blues' | 'bussiness' | 'commerce' | 'flat' 
    | 'foxy' | 'icecream' | 'pearl' | 'sunset';

interface SettingField {
    key: SettingFieldType;         // 'backgroundColor' | 'groundColor' | 'environmentPreset' | 'chartPalette'
    label: string;                 // Display label
    type: 'color' | 'preset' | 'palette';  // UI interaction type
    description: string;           // Tooltip description
    icon: string;                  // VS Code ThemeIcon name
}
```

### JSON Storage Schema

**Storage Location**: `~/.config/Code/User/globalStorage/amontesl.code-xr/visualization-configuration/visualization-settings.json`

**Example JSON Structure**:
```json
{
  "backgroundColor": "#FFFFFF",
  "groundColor": "#000000", 
  "environment": "forest",
  "palette": "ubuntu"
}
```

### Storage Architecture

#### Dual-Layer Persistence
1. **Primary Storage**: File-based JSON in globalStorage directory
2. **Legacy Fallback**: VS Code globalState for backward compatibility
3. **Migration Support**: Automatic migration from legacy globalState to file storage

#### Atomic Write Operations
```typescript
public async saveSettings(settings: VisualizationSettings): Promise<void> {
    // 1. Ensure directory exists
    this.ensureConfigDirectory();
    
    // 2. Write to JSON file
    const jsonSettings = {
        backgroundColor: settings.backgroundColor,
        groundColor: settings.groundColor,
        environment: settings.environmentPreset,
        palette: settings.chartPalette
    };
    fs.writeFileSync(settingsFilePath, JSON.stringify(jsonSettings, null, 2), 'utf8');
    
    // 3. Also save to globalState for backward compatibility
    await this.context.globalState.update('visualizationSettings', settings);
}
```

#### Workspace vs Global Scope
- **Scope**: Global across all VS Code workspaces (stored in user's global storage)
- **Lifetime**: Persistent across sessions until manually reset
- **Access**: Available to all workspace instances of Code-XR extension

## UI/UX Flow

### Tree Items Display

```typescript
// Settings displayed as flat list under collapsible section
VISUALIZATION SETTINGS (🔧 settings-gear icon)
├── Background Color: #FFFFFF (🟦 dynamic color swatch)
├── Ground Color: #000000 (🟤 dynamic color swatch)  
├── Environment Preset: forest (🌍 globe icon)
└── Chart Palette: ubuntu (🎨 symbol-misc icon)
```

### Color Selection Workflow

#### Primary: HTML Color Picker
1. **Webview Creation**: Custom HTML panel with native color input
2. **Template Processing**: Loads `templates/utils/color-picker.html` with current color
3. **User Interaction**: Native browser color picker with live preview
4. **Validation**: Client-side hex format validation (#RRGGBB)
5. **Confirmation**: Message passing between webview and extension

#### Fallback: QuickPick Selection  
1. **Predefined Options**: Common colors with descriptive labels
2. **Custom Input**: Manual hex entry with validation
3. **Retry Logic**: Up to 3 attempts for invalid input with user-friendly error messages

### Color Validation Rules

```typescript
// Strict hex color validation
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

function isValidHexColor(color: string): boolean {
    return HEX_COLOR_REGEX.test(color);
}

// Validation features:
// - Requires # prefix
// - Exactly 6 hex digits
// - Case insensitive (normalized to uppercase)
// - No shorthand (#RGB) or alpha (#RRGGBBAA) support
```

### Dynamic Color Swatch Rendering

The TreeView displays actual color swatches using dynamically generated SVG icons:

```typescript
// SVG generation for 16x16 color squares
private static generateColorSVG(hexColor: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
    <!-- Background square with subtle border -->
    <rect x="1" y="1" width="14" height="14" 
          fill="${hexColor}" 
          stroke="rgba(255,255,255,0.3)" 
          stroke-width="0.5" 
          rx="2" ry="2"/>
    <!-- Subtle inner shadow effect -->
    <rect x="1.5" y="1.5" width="13" height="13" 
          fill="none" 
          stroke="rgba(0,0,0,0.15)" 
          stroke-width="0.5" 
          rx="1.5" ry="1.5"/>
</svg>`;
}
```

**Icon Management**:
- **Location**: `~/.config/Code/User/globalStorage/amontesl.code-xr/visualization-configuration/`
- **Naming**: `{settingKey}_{hexcolor}.svg` (e.g., `backgroundColor_ffffff.svg`)
- **Cleanup**: Automatic removal of old color icons when settings change
- **Caching**: Icons reused if color hasn't changed

### Environment Preset Options

Complete list of supported A-Frame environment presets:

| Value | Label | Description |
|-------|-------|-------------|
| `none` | none | No environment, just a sky |
| `default` | default | Default environment with hills and sky |
| `forest` | forest | A forest with trees and directional light |
| `egypt` | egypt | Egyptian landscape with sand and pyramids |
| `dream` | dream | Surreal dreamlike environment |
| `volcano` | volcano | Volcanic terrain with lava and smoke |
| `arches` | arches | Desert with rock arches |
| `tron` | tron | Futuristic Tron-like environment |
| `japan` | japan | Stylized Japanese landscape |
| `threetowers` | threetowers | Fantasy environment with three towers |
| `poison` | poison | Toxic environment with green fog |
| `contact` | contact | Sci-fi environment with landing pad |

### Chart Palette Options

BabiaXR supported color palettes with descriptions:

| Value | Label | Description |
|-------|-------|-------------|
| `ubuntu` | ubuntu | Ubuntu style colors (default) |
| `blues` | blues | Variations of blue colors |
| `bussiness` | bussiness | Professional business colors |
| `commerce` | commerce | E-commerce friendly palette |
| `flat` | flat | Flat design color scheme |
| `foxy` | foxy | FireFox palette with oranges and blues |
| `icecream` | icecream | Sweet pastel colors |
| `pearl` | pearl | Pearlescent subtle colors |
| `sunset` | sunset | Warm sunset color gradients |

### Commands Exposed

| Command ID | Title | Context | Arguments |
|------------|-------|---------|-----------|
| `codeXR.visualizationSettings.configure` | Configure Visualization Setting | TreeView item click | `settingKey: SettingFieldType` |

**Internal Command Flow**:
1. Command registered in `VisualizationSettingsCommands.registerCommands()`
2. Delegates to `VisualizationSettingsInteractionHandler.handleSettingConfiguration()`
3. Routes to specific handlers based on setting type (color/preset/palette)
4. Updates storage and refreshes TreeView with `codexr.servers.refresh`

## Application of Settings

### Template Integration Points

Settings are injected into visualization templates through a centralized configuration system:

```typescript
// Primary integration point
export async function getVisualizationConfiguration(): Promise<VisualizationSettings> {
    const { 
        getSelectedPalette,
        getSelectedEnvironment, 
        getSelectedBackgroundColor,
        getSelectedGroundColor
    } = require('../visualization_settings');

    return {
        palette: await getSelectedPalette(),
        environment: await getSelectedEnvironment(), 
        backgroundColor: await getSelectedBackgroundColor(),
        groundColor: await getSelectedGroundColor()
    };
}
```

### A-Frame/Babia Attribute Mapping

Settings are mapped to specific A-Frame component attributes in generated HTML:

#### Background Color → Scene Background
```html
<a-scene background="color: ${BACKGROUND_COLOR}">
```

#### Environment Preset → Environment Component  
```html
<a-entity environment="preset: ${ENVIRONMENT_PRESET}; groundColor: ${GROUND_COLOR}">
```

#### Ground Color → Environment Ground
```html  
<a-entity environment="preset: forest; groundColor: ${GROUND_COLOR}">
```

#### Chart Palette → Babia Chart Components
```html
<a-entity babia-bars="palette: ${PALETTE}; data: ...">
<a-entity babia-pie="palette: ${PALETTE}; data: ...">
```

### Template Processing Flow

1. **Template Load**: XR base template loaded from `templates/xr/file/xr-visualization.html`
2. **Settings Retrieval**: `getVisualizationConfiguration()` called
3. **Variable Preparation**: Settings mapped to template placeholders
4. **Placeholder Replacement**: String substitution with regex patterns
5. **HTML Generation**: Final XR-ready HTML with applied settings

```typescript
// Template variable preparation
const variables = {
    BACKGROUND_COLOR: visualizationSettings.backgroundColor,    // → scene background
    ENVIRONMENT_PRESET: visualizationSettings.environment,      // → environment preset  
    GROUND_COLOR: visualizationSettings.groundColor,           // → environment ground
    PALETTE: visualizationSettings.palette,                    // → chart palette
    // ... other template variables
};
```

### Order of Precedence and Defaults

```typescript
const DEFAULT_VISUALIZATION_SETTINGS: VisualizationSettings = {
    backgroundColor: '#FFFFFF',      // White background
    groundColor: '#000000',          // Black ground
    environmentPreset: 'default',    // Default A-Frame environment
    chartPalette: 'ubuntu'           // Ubuntu color scheme
};
```

**Precedence Order**:
1. **User Configuration**: Saved settings in JSON file
2. **Legacy Settings**: Migrated from VS Code globalState  
3. **Default Values**: Hardcoded fallbacks if no configuration exists

## State Diagram / Sequence

### Setting Update Sequence

```
User Click on TreeView Item
         ↓
Command: codeXR.visualizationSettings.configure(settingKey)
         ↓
VisualizationSettingsInteractionHandler.handleSettingConfiguration()
         ↓
Type-specific handler (color/preset/palette)
         ↓
User Input (Color Picker/QuickPick)
         ↓
Validation (hex format/enum values)
         ↓
VisualizationSettingsStorage.updateSetting()
         ↓
File write + GlobalState backup
         ↓
Dynamic color icon generation (if color setting)
         ↓  
TreeView refresh: vscode.commands.executeCommand('codexr.servers.refresh')
         ↓
Next visualization inherits new settings via getVisualizationConfiguration()
```

### Event Flow Details

- **No Debouncing**: Settings updates are immediate
- **Event Emitter**: TreeView uses standard VS Code `EventEmitter<TreeItem>` pattern  
- **Refresh Strategy**: Full tree refresh rather than selective updates for simplicity
- **Icon Cleanup**: Old color icons cleaned up asynchronously after new icon generation

## Edge Cases & Validation

### Invalid Hex Color Handling

```typescript
// Multi-attempt input with user guidance
private async getCustomColorInput(colorType: string, currentValue: string): Promise<string | undefined> {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        const customColor = await vscode.window.showInputBox({
            validateInput: (value) => {
                if (!value) return 'Color value is required';
                if (!isValidHexColor(value)) {
                    return 'Invalid hex color format. Use format: #RRGGBB (e.g., #FF5733)';
                }
                return null;
            }
        });

        if (isValidHexColor(customColor)) {
            return customColor;
        }
        
        attempts++;
        if (attempts < maxAttempts) {
            const retry = await vscode.window.showErrorMessage(
                `Invalid hex color format: ${customColor}. Please use format #RRGGBB`,
                'Try Again', 'Cancel'
            );
            if (retry !== 'Try Again') return undefined;
        }
    }
    return undefined;
}
```

### Empty Input and Cancel Flow

- **Color Picker Cancel**: Webview message handling with proper cleanup
- **QuickPick Cancel**: Graceful return without state changes
- **Input Validation**: Real-time validation prevents invalid submissions
- **Transaction Safety**: Settings only updated after successful validation

### Unsupported Environment/Palette Keys

```typescript
// Validation with fallback to defaults
public validateSettings(settings: any): settings is VisualizationSettings {
    return (
        typeof settings === 'object' &&
        typeof settings.backgroundColor === 'string' &&
        typeof settings.groundColor === 'string' &&
        typeof settings.environmentPreset === 'string' &&
        typeof settings.chartPalette === 'string'
    );
}

// Runtime fallback behavior
const environment = settings?.environment || DEFAULT_VISUALIZATION_SETTINGS.environmentPreset;
const palette = settings?.palette || DEFAULT_VISUALIZATION_SETTINGS.chartPalette;
```

### Backwards Compatibility & Migration

```typescript
// Automatic migration from legacy globalState
private migrateLegacySettings(): void {
    try {
        const legacySettings = this.context.globalState.get<VisualizationSettings>('visualizationSettings');
        
        if (legacySettings && !fs.existsSync(this.getSettingsFilePath())) {
            console.log('VISUALIZATION-SETTINGS: Migrating legacy settings to file system');
            
            const jsonSettings = {
                backgroundColor: legacySettings.backgroundColor,
                groundColor: legacySettings.groundColor,
                environment: legacySettings.environmentPreset,
                palette: legacySettings.chartPalette
            };
            
            fs.writeFileSync(settingsFilePath, JSON.stringify(jsonSettings, null, 2), 'utf8');
        }
    } catch (error) {
        console.error('VISUALIZATION-SETTINGS: Error during legacy migration:', error);
        // Migration failure doesn't prevent normal operation
    }
}
```

## Command & Menu Reference

### Registered Commands

| Command ID | Description | Invocation Context | Arguments |
|------------|-------------|-------------------|-----------|
| `codeXR.visualizationSettings.configure` | Configure individual visualization setting | TreeView item click | `settingKey: 'backgroundColor' \| 'groundColor' \| 'environmentPreset' \| 'chartPalette'` |

### Context Menu Integration

Currently no context menu actions are implemented. All interactions occur through direct TreeView item clicks.

### Command Registration Location

```typescript
// Primary registration
src/visualization_settings/commands/visualizationSettingsCommands.ts:
VisualizationSettingsCommands.registerCommands(context)

// VS Code contribution point
package.json: contributes.commands section (command IDs declared)
```

## Examples

### Example JSON Configuration File

**File**: `~/.config/Code/User/globalStorage/amontesl.code-xr/visualization-configuration/visualization-settings.json`

```json
{
  "backgroundColor": "#1E1E1E",
  "groundColor": "#2D2D30", 
  "environment": "tron",
  "palette": "foxy"
}
```

### Example Generated HTML Template Integration

```html
<!DOCTYPE html>
<html>
<head>
    <title>Sales Data Visualization</title>
    <script src="https://aframe.io/releases/1.7.1/aframe.min.js"></script>
    <script src="https://unpkg.com/aframe-babia-components/dist/aframe-babia-components.min.js"></script>
    <script src="https://unpkg.com/aframe-environment-component@1.5.0/dist/aframe-environment-component.min.js"></script>
</head>
<body>
    <a-scene background="color: #1E1E1E" xr-mode-ui="enabled: true">
        
        <!-- Environment with user settings -->
        <a-entity environment="preset: tron; groundColor: #2D2D30"></a-entity>
        
        <!-- Chart with user palette -->
        <a-entity babia-bars="palette: foxy; legend: true; axis: true"
                  position="0 0 -10">
        </a-entity>
        
        <a-entity movement-controls="fly: true" position="0 1.2 12">
            <a-entity camera position="0 3 4" look-controls></a-entity>
        </a-entity>
    </a-scene>
</body>
</html>
```

### Before/After Screenshots References

- `visualization-settings-ui-before.png` - Default settings TreeView appearance
- `visualization-settings-ui-after.png` - Custom settings with color swatches
- `color-picker-webview.png` - HTML color picker interface
- `tron-environment-example.png` - Generated visualization with Tron environment
- `foxy-palette-chart.png` - Chart using Foxy color palette

## Checklist (TL;DR)

### Steps to Add a New Environment Preset

1. **Add to Enum**: Update `EnvironmentPreset` type in `src/visualization_settings/model/settingsModel.ts`
2. **Add Metadata**: Include entry in `ENVIRONMENT_PRESETS` array with label and description
3. **Validate A-Frame Support**: Ensure preset exists in A-Frame environment component
4. **Test Integration**: Verify preset appears in QuickPick and applies correctly in templates

### Steps to Add a New Chart Palette

1. **Add to Enum**: Update `ChartPalette` type in `src/visualization_settings/model/settingsModel.ts`  
2. **Add Metadata**: Include entry in `CHART_PALETTES` array with label and description
3. **Validate Babia Support**: Ensure palette exists in BabiaXR components
4. **Test Charts**: Verify palette works with all chart types (bars, pie, bubbles, etc.)

### How to Reset to Defaults

```typescript
// Programmatic reset
const storage = new VisualizationSettingsStorage(context);
await storage.resetSettings();

// Manual reset (delete files)
// Delete: ~/.config/Code/User/globalStorage/amontesl.code-xr/visualization-configuration/
// Delete: VS Code globalState key 'visualizationSettings'
```

### How to Verify Settings Are Applied

1. **Check JSON File**: Verify settings saved in `visualization-settings.json`
2. **Inspect Generated HTML**: Look for template placeholder replacements:
   - `background="color: ${BACKGROUND_COLOR}"` → `background="color: #1E1E1E"`
   - `environment="preset: ${ENVIRONMENT_PRESET}"` → `environment="preset: tron"`
   - `babia-bars="palette: ${PALETTE}"` → `babia-bars="palette: foxy"`
3. **Visual Verification**: Launch visualization and confirm visual appearance matches settings
4. **Console Logs**: Check VS Code Output → Log (Extension Host) for setting retrieval logs

## Known Limitations

### Color Support Restrictions

- **No Alpha Channel**: Only 6-digit hex colors supported (#RRGGBB), no transparency (#RRGGBBAA)
- **No Color Names**: Only hex format accepted, no named colors ("red", "blue", etc.)
- **No Shorthand Hex**: Must use full 6-digit format, no 3-digit shorthand (#RGB)

### Palette Size Expectations

- **BabiaXR Dependent**: Palette effectiveness depends on BabiaXR component implementation
- **Chart Type Variations**: Some palettes may work better with certain chart types
- **Color Count**: No validation of minimum/maximum colors in palette

### Icon Generation Limitations

- **SVG Only**: Color swatches generated as SVG files, no PNG/bitmap support
- **Fixed Size**: Icons hard-coded to 16x16 pixels for VS Code TreeView compatibility
- **Theme Independence**: Color swatches don't adapt to VS Code light/dark theme changes
- **Cleanup Timing**: Old icon cleanup is asynchronous and may briefly leave orphaned files

### Platform and Storage Limitations

- **File System Dependency**: Requires write access to VS Code globalStorage directory
- **Cross-Platform Paths**: globalStorage path varies by OS, may cause issues in containerized environments
- **No Sync Support**: Settings don't sync across VS Code instances (not part of VS Code Settings Sync)
- **Migration Edge Cases**: Legacy migration may fail silently, falling back to defaults

### Template Integration Constraints

- **Static Replacement**: Template placeholders replaced at generation time, no runtime updates
- **A-Frame Dependency**: Environment presets limited to what A-Frame environment component supports
- **BabiaXR Coupling**: Chart palettes tied to BabiaXR component palette implementation
- **No Validation**: No runtime validation that environment/palette values are actually supported by components
