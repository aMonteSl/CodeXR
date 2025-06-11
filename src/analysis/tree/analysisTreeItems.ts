import * as vscode from 'vscode';
import * as path from 'path';
import { TreeItem } from '../../ui/treeItems/baseItems';
import { TreeItemType } from '../../ui/treeProvider';
import { analysisDataManager } from '../analysisDataManager'; // ✅ VERIFICAR QUE ESTÉ IMPORTADO
import { DimensionMappingItem } from './dimensionMappingTreeItem';

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
    
    // ✅ VERIFICAR SI EL ARCHIVO ESTÁ SIENDO ANALIZADO
    const isBeingAnalyzed = analysisDataManager.isFileBeingAnalyzed(filePath);
    console.log(`🔍 Checking if ${fileName} is being analyzed: ${isBeingAnalyzed}`); // ✅ AÑADIR LOG PARA DEBUG
    
    // ✅ AJUSTAR LABEL Y DESCRIPCIÓN SEGÚN EL ESTADO
    const label = isBeingAnalyzed ? `${fileName} ⚡` : fileName;
    const tooltip = isBeingAnalyzed 
      ? `🔄 Analyzing ${fileName} (${language}) - Please wait...`
      : `Analyze ${fileName} (${language})`;
    
    super(
      label,
      `${language} file - ${relativePath}`,
      TreeItemType.ANALYSIS_FILE,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexr.analyzeFileFromTree',
        title: 'Analyze File',
        arguments: [filePath]
      },
      vscode.ThemeIcon.File // ✅ USAR EL ICONO ESPECÍFICO DEL ARCHIVO
    );
    
    this.resourceUri = vscode.Uri.file(filePath); // ✅ ESTO ES CLAVE
    this.tooltip = tooltip;
    
    // ✅ AÑADIR INDICADOR VISUAL SI ESTÁ SIENDO ANALIZADO
    if (isBeingAnalyzed) {
      // Cambiar el icono a uno de loading/progreso
      this.iconPath = new vscode.ThemeIcon('sync~spin');
      
      // Añadir color distintivo
      this.description = `${relativePath} 🔄 Analyzing...`;
      
      // Deshabilitar el comando mientras se analiza
      this.command = undefined;
    }
  }
}

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
    // ✅ USAR LA FUNCIÓN getLanguageIcon RESTAURADA
    const languageIcon = getLanguageIcon(language, extensionPath);
    
    super(
      language,
      `${language} files that can be analyzed`,
      TreeItemType.ANALYSIS_LANGUAGE_GROUP,
      vscode.TreeItemCollapsibleState.Expanded,
      undefined,
      languageIcon // ✅ USAR EL ICONO DE LA FUNCIÓN
    );
    
    this.description = `(${fileCount} files)`;
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
 * ✅ RESTAURAR LA FUNCIÓN getLanguageIcon CON ICONOS PNG
 * Gets appropriate icon for language using PNG files
 */
function getLanguageIcon(language: string, extensionPath: string): any {
  let iconFileName: string;
  
  switch (language) {
    case 'JavaScript':
      iconFileName = 'javascript.png';
      break;
    case 'TypeScript':
      iconFileName = 'typescript.png';
      break;
    case 'Python':
      iconFileName = 'python.png';
      break;
    case 'Java': // ✅ AÑADIR JAVA
      iconFileName = 'java.png';
      break;
    case 'C':
      iconFileName = 'c.png';
      break;
    case 'C++':
      iconFileName = 'cpp.png';
      break;
    case 'C#':
      iconFileName = 'csharp.png';
      break;
    case 'Ruby':
      iconFileName = 'ruby.png';
      break;
    case 'Vue.js':
      iconFileName = 'vuejs.png';
      break;
    default:
      iconFileName = 'code.png';
  }
  
  console.log(`🎨 Language: "${language}" → Icon: "${iconFileName}"`);
  
  return {
    light: vscode.Uri.file(path.join(extensionPath, 'resources', 'languajes_icons', iconFileName)),
    dark: vscode.Uri.file(path.join(extensionPath, 'resources', 'languajes_icons', iconFileName))
  };
}

/**
 * Gets an example file name for a language to display the correct icon
 */
function getExampleFileForLanguage(language: string): string {
  switch (language.toLowerCase()) {
    case 'python': return 'example.py';
    case 'javascript': return 'example.js';
    case 'typescript': return 'example.ts';
    case 'java': return 'Example.java';
    case 'c': return 'example.c';
    case 'c header': return 'example.h';
    case 'c++': return 'example.cpp';
    case 'c++ header': return 'example.hpp';
    case 'c#': return 'Example.cs';
    case 'vue': return 'Example.vue';
    case 'ruby': return 'example.rb';
    case 'objective-c': return 'example.m';
    case 'objective-c++': return 'example.mm';
    case 'swift': return 'Example.swift';
    case 'php': return 'example.php';
    case 'scala': return 'Example.scala';
    case 'gdscript': return 'example.gd';
    case 'go': return 'example.go';
    case 'lua': return 'example.lua';
    case 'rust': return 'example.rs';
    case 'fortran':
    case 'fortran 77': return 'example.f90';
    case 'kotlin': return 'Example.kt';
    case 'kotlin script': return 'example.kts';
    case 'solidity': return 'Example.sol';
    case 'erlang': return 'example.erl';
    case 'erlang header': return 'example.hrl';
    case 'zig': return 'example.zig';
    case 'perl': return 'example.pl';
    case 'perl module': return 'example.pm';
    case 'perl pod': return 'example.pod';
    case 'perl test': return 'example.t';
    case 'ttcn-3': return 'example.ttcn3';
    default: return 'example.txt';
  }
}