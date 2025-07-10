import * as vscode from 'vscode';
import { TreeItem } from '../../ui/treeItems/baseItems';
import { TreeItemType } from '../../ui/treeProvider';
import { DimensionMappingItem } from './dimensionMappingTreeItem';
import { 
  getTreeDisplayConfig, 
  getSortMethodDisplayText,
  LanguageSortMethod,
  FileSortMethod,
  SortDirection
} from './treeDisplayConfig';
import { 
  AnalysisModeOptionItem,
  AnalysisDirectoryModeOptionItem,
  AnalysisDelayOptionItem,
  AnalysisAutoOptionItem,
  AnalysisChartTypeOptionItem,
  AnalysisResetItem
} from './analysisTreeItems';

/**
 * Interface for analysis settings configuration
 */
export interface AnalysisSettings {
  mode: string;
  directoryMode: string;
  debounceDelay: number;
  autoAnalysis: boolean;
  chartType: string;
}

/**
 * Manages analysis settings and provides tree items for configuration
 */
export class AnalysisSettingsManager {
  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Gets current analysis settings from VS Code configuration
   */
  public async getCurrentSettings(): Promise<AnalysisSettings> {
    const config = vscode.workspace.getConfiguration();
    
    return {
      mode: config.get<string>('codexr.analysisMode', 'XR'), // ✅ CHANGED: Default from 'Static' to 'XR'
      directoryMode: config.get<string>('codexr.analysis.directoryMode', 'shallow'),
      debounceDelay: config.get<number>('codexr.analysis.debounceDelay', 2000),
      autoAnalysis: config.get<boolean>('codexr.analysis.autoAnalysis', true),
      chartType: this.context.globalState.get<string>('codexr.analysis.chartType') || 
                config.get<string>('codexr.analysis.chartType', 'boats')
    };
  }

  /**
   * Gets all settings children tree items
   */
  public async getSettingsChildren(): Promise<TreeItem[]> {
    const settings = await this.getCurrentSettings();
    const extensionPath = this.context.extensionPath;
    
    const items: TreeItem[] = [];

    // Analysis Mode Setting (Fixed to work properly)
    items.push(new AnalysisModeOptionItem(
      settings.mode,
      settings.mode === 'Static', // This will be used to show current selection
      extensionPath
    ));

    // Directory Analysis Mode Setting
    items.push(new AnalysisDirectoryModeOptionItem(
      settings.directoryMode,
      extensionPath
    ));

    // Debounce Delay Setting
    items.push(new AnalysisDelayOptionItem(
      settings.debounceDelay,
      extensionPath
    ));

    // Auto-Analysis Toggle
    items.push(new AnalysisAutoOptionItem(
      settings.autoAnalysis,
      extensionPath
    ));

    // Chart Type Setting
    items.push(new AnalysisChartTypeOptionItem(
      settings.chartType,
      extensionPath
    ));

    // Dimension Mapping Setting
    items.push(new DimensionMappingItem(
      settings.chartType,
      extensionPath,
      this.context
    ));

    // Tree Display Configuration
    items.push(new TreeDisplayConfigItem(extensionPath, this.context));

    // Reset to Defaults
    items.push(new AnalysisResetItem(extensionPath));

    return items;
  }

  /**
   * Updates a specific setting
   */
  public async updateSetting(
    settingKey: string, 
    value: any, 
    isGlobalState: boolean = false
  ): Promise<void> {
    if (isGlobalState) {
      await this.context.globalState.update(settingKey, value);
    } else {
      const config = vscode.workspace.getConfiguration();
      await config.update(settingKey, value, vscode.ConfigurationTarget.Global);
    }
  }

  /**
   * Resets all settings to defaults
   */
  public async resetToDefaults(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration();
      
      // ✅ FIXED: Only reset registered VS Code configuration properties
      await config.update('codexr.analysisMode', 'XR', vscode.ConfigurationTarget.Global);
      await config.update('codexr.analysis.directoryMode', 'shallow', vscode.ConfigurationTarget.Global);
      await config.update('codexr.analysis.debounceDelay', 2000, vscode.ConfigurationTarget.Global);
      await config.update('codexr.analysis.autoAnalysis', true, vscode.ConfigurationTarget.Global);
      await config.update('codexr.analysis.chartType', 'boats', vscode.ConfigurationTarget.Global);
      
      // ✅ FIXED: Reset tree display settings with registered configuration keys
      await config.update('codexr.analysis.tree.maxFilesPerLanguage', 0, vscode.ConfigurationTarget.Global);
      await config.update('codexr.analysis.tree.languageSortMethod', 'fileCount', vscode.ConfigurationTarget.Global);
      await config.update('codexr.analysis.tree.languageSortDirection', 'descending', vscode.ConfigurationTarget.Global);
      await config.update('codexr.analysis.tree.fileSortMethod', 'alphabetical', vscode.ConfigurationTarget.Global);
      await config.update('codexr.analysis.tree.fileSortDirection', 'ascending', vscode.ConfigurationTarget.Global);
      
      // ✅ FIXED: Reset global state items (not VS Code configuration)
      await this.context.globalState.update('codexr.analysis.chartType', 'boats');
      
      // ✅ FIXED: Reset dimension mappings for all chart types
      const chartTypes = ['boats', 'bars', 'cylinders', 'pie', 'donut', 'barsmap'];
      for (const chartType of chartTypes) {
        await this.context.globalState.update(`codexr.analysis.dimensionMapping.${chartType}`, undefined);
      }
      
      console.log('✅ All analysis settings reset to defaults (XR mode, shallow directory mode, 2000ms delay, auto-analysis enabled)');
    } catch (error) {
      console.error('❌ Error resetting analysis settings:', error);
      throw error; // Re-throw to be handled by the command
    }
  }
}

/**
 * ✅ UPDATED: Tree item for tree display configuration with new sorting system
 */
export class TreeDisplayConfigItem extends TreeItem {
  constructor(extensionPath: string, private context: vscode.ExtensionContext) {
    const config = getTreeDisplayConfig(context);
    
    // Create descriptive label showing current settings
    const languageSortText = getSortMethodDisplayText(config.languageSortMethod, config.languageSortDirection);
    const fileSortText = getSortMethodDisplayText(config.fileSortMethod, config.fileSortDirection);
    const limitText = config.maxFilesPerLanguage === 0 ? 'unlimited' : `max ${config.maxFilesPerLanguage}`;
    
    super(
      'Tree Display Settings',
      `Configure how files are sorted and displayed in the tree`,
      TreeItemType.ANALYSIS_SETTING_OPTION,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexr.configureTreeDisplay',
        title: 'Configure Tree Display',
        arguments: []
      },
      new vscode.ThemeIcon('settings-gear')
    );
    
    // ✅ SHOW CURRENT SETTINGS IN DESCRIPTION
    this.description = `${languageSortText} • ${fileSortText} • ${limitText}`;
    
    // ✅ DETAILED TOOLTIP
    this.tooltip = `Tree Display Settings
Languages: ${languageSortText}
Files: ${fileSortText}
Limit: ${limitText}

Click to configure sorting and display options`;
  }
}