import * as vscode from 'vscode';
import * as path from 'path';
import { TreeItem } from '../../ui/treeItems/baseItems';
import { TreeItemType } from '../../ui/treeProvider';
import { DimensionMappingItem } from './dimensionMappingTreeItem';

/**
 * Item for the main analysis section
 */
export class AnalysisSectionItem extends TreeItem {
  constructor(extensionPath: string) {
    super(
      'Code Analysis',
      'Analyze code metrics and complexity',
      TreeItemType.ANALYSIS_SECTION,
      vscode.TreeItemCollapsibleState.Expanded,
      undefined,
      new vscode.ThemeIcon('microscope')
    );
  }
}

/**
 * Container for language file groups
 */
export class LanguageGroupItem extends TreeItem {
  constructor(language: string, fileCount: number, extensionPath: string) {
    const languageIcon = getLanguageIcon(language, extensionPath);
    
    super(
      language,
      `${language} files that can be analyzed`,
      TreeItemType.ANALYSIS_LANGUAGE_GROUP,
      vscode.TreeItemCollapsibleState.Expanded,
      undefined,
      languageIcon
    );
    
    this.description = `(${fileCount} files)`;
  }
}

/**
 * Individual file item in the analysis tree
 */
export class AnalysisFileItem extends TreeItem {
  constructor(
    filePath: string,
    relativePath: string,
    language: string,
    extensionPath: string
  ) {
    const fileName = path.basename(filePath);
    
    super(
      fileName,
      `${language} file - ${relativePath}`,
      TreeItemType.ANALYSIS_FILE,
      vscode.TreeItemCollapsibleState.None,
      {
        // ✅ CAMBIAR EL COMANDO INEXISTENTE
        command: 'codexr.analyzeFileFromTree', // ✅ USAR COMANDO QUE SÍ EXISTE
        title: 'Analyze File',
        arguments: [filePath] // ✅ PASAR LA RUTA COMO ARGUMENTO
      },
      new vscode.ThemeIcon('file-code')
    );
    
    this.resourceUri = vscode.Uri.file(filePath);
    this.tooltip = `Analyze ${fileName} (${language})`;
  }
}

/**
 * Analysis settings container
 */
export class AnalysisSettingsItem extends TreeItem {
  private extensionPath: string;
  private context: vscode.ExtensionContext;

  constructor(extensionPath: string, context: vscode.ExtensionContext) {
    super(
      'Settings',
      'Configure analysis preferences',
      TreeItemType.ANALYSIS_SETTINGS,
      vscode.TreeItemCollapsibleState.Expanded,
      undefined,
      new vscode.ThemeIcon('gear')
    );
    
    this.extensionPath = extensionPath;
    this.context = context;
  }
  
  /**
   * Gets current analysis settings from VS Code configuration
   */
  private async getCurrentSettings() {
    const config = vscode.workspace.getConfiguration();
    
    // ✅ LEER CHART TYPE DESDE GLOBAL STATE PRIMERO
    const chartType = this.context.globalState.get<string>('codexr.analysis.chartType') || 
                     config.get<string>('codexr.analysis.chartType', 'boats');
    
    return {
      currentMode: config.get<string>('codexr.analysisMode', 'Static'),
      debounceDelay: config.get<number>('codexr.analysis.debounceDelay', 2000),
      autoAnalysis: config.get<boolean>('codexr.analysis.autoAnalysis', true),
      chartType
    };
  }
  
  async getChildren(): Promise<TreeItem[]> {
    console.log('🔧 AnalysisSettingsItem.getChildren() called');
    
    // Get current settings
    const { currentMode, debounceDelay, autoAnalysis, chartType } = await this.getCurrentSettings();
    
    console.log('🔧 Current settings in getChildren:', { currentMode, chartType });
    
    const items: TreeItem[] = [
      new AnalysisModeOptionItem('Static', currentMode === 'Static', this.extensionPath),
      new AnalysisModeOptionItem('XR', currentMode === 'XR', this.extensionPath),
      new AnalysisDelayOptionItem(debounceDelay, this.extensionPath),
      new AnalysisAutoOptionItem(autoAnalysis, this.extensionPath),
      new AnalysisChartTypeOptionItem(chartType, this.extensionPath)
    ];

    // Add dimension mapping only for XR mode
    if (currentMode === 'XR') {
      console.log('🎯 Adding DimensionMappingItem for chart type:', chartType);
      items.push(new DimensionMappingItem(chartType, this.extensionPath, this.context));
    } else {
      console.log('🔧 Not adding DimensionMappingItem because mode is:', currentMode);
    }

    // ✅ AÑADIR RESET BUTTON AL FINAL
    items.push(new AnalysisResetItem(this.extensionPath));

    console.log('🔧 Returning items:', items.map(item => item.label));
    return items;
  }
}

/**
 * Item for an analysis mode setting option
 */
export class AnalysisModeOptionItem extends TreeItem {
  constructor(mode: string, isSelected: boolean, extensionPath: string) {
    super(
      `Analysis Mode: ${mode}`, // Make the label more descriptive
      `Use ${mode} as default analysis mode`,
      TreeItemType.ANALYSIS_SETTING_OPTION,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexr.setAnalysisMode',
        title: 'Set Analysis Mode',
        arguments: [mode]
      },
      isSelected ? new vscode.ThemeIcon('check') : new vscode.ThemeIcon('circle-outline')
    );
    
    // Add a highlight for the selected option
    if (isSelected) {
      this.description = '(current)';
    }
  }
}

/**
 * Item for setting debounce delay
 */
export class AnalysisDelayOptionItem extends TreeItem {
  constructor(delay: number, extensionPath: string) {
    const delayLabels: Record<number, string> = {
      500: "Very Quick (500ms)",
      1000: "Quick (1 second)",
      2000: "Standard (2 seconds)",
      3000: "Relaxed (3 seconds)",
      5000: "Extended (5 seconds)"
    };
    
    const label = `Debounce Delay: ${delayLabels[delay] || delay + 'ms'}`;
    
    super(
      label,
      "Set the delay before auto-analysis after a file change",
      TreeItemType.ANALYSIS_SETTING_OPTION,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexr.setAnalysisDebounceDelay',
        title: 'Set Analysis Debounce Delay',
        arguments: []
      },
      new vscode.ThemeIcon('clock')
    );
  }
}

/**
 * Item for toggling auto-analysis
 */
export class AnalysisAutoOptionItem extends TreeItem {
  constructor(enabled: boolean, extensionPath: string) {
    super(
      `Auto-Analysis: ${enabled ? 'Enabled' : 'Disabled'}`,
      "Toggle automatic re-analysis of files when they change",
      TreeItemType.ANALYSIS_SETTING_OPTION,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexr.toggleAutoAnalysis',
        title: 'Toggle Auto Analysis',
        arguments: []
      },
      enabled ? new vscode.ThemeIcon('check') : new vscode.ThemeIcon('close')
    );
    
    // Add a highlight for the current state
    this.description = enabled ? '(active)' : '(inactive)';
  }
}

/**
 * Item for setting chart type for analysis visualizations
 */
export class AnalysisChartTypeOptionItem extends TreeItem {
  constructor(currentChart: string, extensionPath: string) {
    const chartLabels: Record<string, string> = {
      'boats': "Boats (3D blocks)",
      'bars': "Bars (2D bars)",
      'cyls': "Cylinders (3D cylinders)",
      'barsmap': "Bars Map (3D layout)",
      'pie': "Pie Chart",
      'donut': "Donut Chart"
    };
    
    const label = `Chart Type: ${chartLabels[currentChart] || currentChart}`;
    
    super(
      label,
      "Select which chart type to use for code analysis visualization",
      TreeItemType.ANALYSIS_SETTING_OPTION,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexr.setAnalysisChartType',
        title: 'Set Analysis Chart Type',
        arguments: []
      },
      new vscode.ThemeIcon('pie-chart')
    );
  }
}

/**
 * ✅ NUEVO ITEM PARA RESET DE CONFIGURACIÓN
 */
export class AnalysisResetItem extends TreeItem {
  constructor(extensionPath: string) {
    super(
      'Reset to Defaults',
      'Reset chart type to Boats and dimension mapping to default values',
      TreeItemType.ANALYSIS_RESET,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexr.resetAnalysisDefaults',
        title: 'Reset Analysis Configuration',
        arguments: []
      },
      new vscode.ThemeIcon('refresh')
    );
  }
}

/**
 * Gets language name from file extension
 */
function getLanguageFromExtension(ext: string): string {
  switch (ext) {
    case '.py':
      return 'Python';
    case '.js':
      return 'JavaScript';
    case '.ts':
      return 'TypeScript';
    case '.c':
      return 'C';
    // Add new language support
    case '.cpp':
    case '.cc':
    case '.cxx':
      return 'C++';
    case '.cs':
      return 'C#';
    case '.vue':
      return 'Vue';
    case '.rb':
      return 'Ruby';
    default:
      return 'Unknown';
  }
}

/**
 * Gets appropriate icon for language
 */
function getLanguageIcon(language: string, extensionPath: string): any {
  // ✅ FIX: Handle special cases for C# and C++ language names
  let iconFileName: string;
  
  switch (language) {
    case 'C#':
      iconFileName = 'csharp.png';
      break;
    case 'C++':
    case 'C++ Header':
      iconFileName = 'cpp.png';
      break;
    case 'JavaScript':
    case 'JavaScript (JSX)':
      iconFileName = 'javascript.png';
      break;
    case 'TypeScript':
    case 'TypeScript (TSX)':
      iconFileName = 'typescript.png';
      break;
    case 'Python':
      iconFileName = 'python.png';
      break;
    case 'C':
    case 'C Header':
      iconFileName = 'c.png';
      break;
    case 'Vue':
      iconFileName = 'vue.png';
      break;
    case 'Ruby':
      iconFileName = 'ruby.png';
      break;
    default:
      // For any other language, convert to lowercase and add .png
      iconFileName = language.toLowerCase() + '.png';
      break;
  }
  
  console.log(`🎨 Language: "${language}" → Icon: "${iconFileName}"`);
  
  // Return custom icon paths
  return {
    light: vscode.Uri.file(path.join(extensionPath, 'resources', 'languajes_icons', iconFileName)),
    dark: vscode.Uri.file(path.join(extensionPath, 'resources', 'languajes_icons', iconFileName))
  };
}