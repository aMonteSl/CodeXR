import * as vscode from 'vscode';
import * as path from 'path';
import { TreeItem } from '../../ui/treeItems/baseItems';
import { TreeItemType } from '../../ui/treeProvider';

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
 * Item for an analyzable file
 */
export class AnalysisFileItem extends TreeItem {
  constructor(fileUri: vscode.Uri, extensionPath: string) {
    const fileName = path.basename(fileUri.fsPath);
    const fileExtension = path.extname(fileUri.fsPath).toLowerCase();
    const language = getLanguageFromExtension(fileExtension);
    const languageIcon = getLanguageIcon(language, extensionPath);
    
    // Get the configured analysis mode
    const config = vscode.workspace.getConfiguration();
    const analysisMode = config.get<string>('codexr.analysisMode', 'Static');
    
    // Use our new commands that first open the file, then analyze it
    const command = analysisMode === 'XR' ? 'codexr.openAndAnalyzeFile3D' : 'codexr.openAndAnalyzeFile';
    
    super(
      fileName,
      `Analyze ${fileName} using ${analysisMode} mode`,
      TreeItemType.ANALYSIS_FILE,
      vscode.TreeItemCollapsibleState.None,
      {
        command: command,
        title: `Analyze File (${analysisMode})`,
        arguments: [fileUri]
      },
      languageIcon
    );
    
    // Use the resource URI to enable VS Code's built-in file handling capabilities
    this.resourceUri = fileUri;
  }
}

/**
 * Item for analysis settings section
 */
export class AnalysisSettingsItem extends TreeItem {
  constructor(extensionPath: string) {
    super(
      'Settings',
      'Configure analysis preferences',
      TreeItemType.ANALYSIS_SETTINGS,
      vscode.TreeItemCollapsibleState.Expanded, // Change from Collapsed to Expanded
      undefined,
      new vscode.ThemeIcon('gear')
    );
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
  // Convert language name to lowercase for filename
  const languageFileName = language.toLowerCase() + '.png';
  
  // Handle special case for JavaScript (correct casing in filename)
  const iconFileName = language === 'JavaScript' 
    ? 'javascript.png' 
    : languageFileName;
  
  // Return custom icon paths
  return {
    light: vscode.Uri.file(path.join(extensionPath, 'resources', 'languajes_icons', iconFileName)),
    dark: vscode.Uri.file(path.join(extensionPath, 'resources', 'languajes_icons', iconFileName))
  };
}