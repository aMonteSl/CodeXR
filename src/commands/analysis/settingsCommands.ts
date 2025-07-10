import * as vscode from 'vscode';
import { 
  getChartDimensions, 
  getDimensionMapping, 
  setDimensionMapping, 
  ANALYSIS_FIELDS 
} from '../../analysis/xr/dimensionMapping';
import { AnalysisSettingsManager } from '../../analysis/tree/analysisSettingsManager';
import { refreshTreeProvider } from '../shared/commandHelpers';
import { ChartTypeOption } from '../shared/types';

/**
 * Commands for analysis settings management
 */

/**
 * Registers analysis settings related commands
 * @param context Extension context
 * @returns Array of disposables for the registered commands
 */
export function registerAnalysisSettingsCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];
  
  const settingsManager = new AnalysisSettingsManager(context);
  
  // Core settings commands
  disposables.push(registerToggleAnalysisModeCommand());
  disposables.push(registerToggleDirectoryAnalysisModeCommand());
  disposables.push(registerSetAnalysisDebounceDelayCommand());
  disposables.push(registerToggleAutoAnalysisCommand());
  disposables.push(registerSetAnalysisChartTypeCommand(context));
  disposables.push(registerSetDimensionMappingCommand(context));
  disposables.push(registerResetAnalysisDefaultsCommand(context, settingsManager));
  
  return disposables;
}

/**
 * Registers the toggle analysis mode command
 * @returns Command disposable
 */
function registerToggleAnalysisModeCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.toggleAnalysisMode', async () => {
    try {
      const config = vscode.workspace.getConfiguration();
      const currentMode = config.get<string>('codexr.analysisMode', 'XR'); // ✅ CHANGED: Default from 'Static' to 'XR'
      
      // Toggle between modes
      const newMode = currentMode === 'Static' ? 'XR' : 'Static';
      
      // Update configuration
      await config.update('codexr.analysisMode', newMode, vscode.ConfigurationTarget.Global);
      
      // Show success message
      vscode.window.showInformationMessage(
        `✅ Analysis mode changed to: ${newMode}`,
        { modal: false }
      );
      
      // Refresh tree to show updated mode
      const treeDataProvider = (global as any).treeDataProvider;
      if (treeDataProvider && typeof treeDataProvider.refresh === 'function') {
        treeDataProvider.refresh();
      }
      
      console.log(`🔄 Analysis mode changed from ${currentMode} to ${newMode}`);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error changing analysis mode: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

/**
 * Registers the toggle directory analysis mode command
 * @returns Command disposable
 */
function registerToggleDirectoryAnalysisModeCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.toggleDirectoryAnalysisMode', async () => {
    try {
      const config = vscode.workspace.getConfiguration();
      const currentMode = config.get<string>('codexr.analysis.directoryMode', 'shallow');
      
      // Toggle between modes
      const newMode = currentMode === 'shallow' ? 'deep' : 'shallow';
      
      // Update configuration
      await config.update('codexr.analysis.directoryMode', newMode, vscode.ConfigurationTarget.Global);
      
      // Show success message
      const modeDescription = newMode === 'shallow' 
        ? 'Shows filenames only' 
        : 'Shows full file paths';
      
      vscode.window.showInformationMessage(
        `✅ Directory analysis mode changed to: ${newMode} (${modeDescription})`,
        { modal: false }
      );
      
      // Refresh tree to show updated mode
      const treeDataProvider = (global as any).treeDataProvider;
      if (treeDataProvider && typeof treeDataProvider.refresh === 'function') {
        treeDataProvider.refresh();
      }
      
      console.log(`🔄 Directory analysis mode changed from ${currentMode} to ${newMode}`);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error changing directory analysis mode: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

/**
 * Registers the set analysis debounce delay command
 * @returns Command disposable
 */
function registerSetAnalysisDebounceDelayCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.setAnalysisDebounceDelay', async () => {
    try {
      const config = vscode.workspace.getConfiguration();
      const currentDelay = config.get<number>('codexr.analysis.debounceDelay', 2000);
      
      // ✅ ENHANCED: Preset delay options with better descriptions
      const presetOptions = [
        { label: '100ms', description: 'Very fast - Immediate analysis (may impact performance)', value: 100 },
        { label: '500ms', description: 'Fast - Quick response for small files', value: 500 },
        { label: '1000ms (1s)', description: 'Balanced - Good for most files', value: 1000 },
        { label: '2000ms (2s)', description: 'Default - Recommended for large files', value: 2000 },
        { label: '3000ms (3s)', description: 'Slow - For very large files or slow systems', value: 3000 },
        { label: '5000ms (5s)', description: 'Very slow - Maximum stability', value: 5000 },
        { label: '$(edit) Custom...', description: 'Enter a custom delay value', value: -1 }
      ];
      
      // Mark current selection
      const enhancedOptions = presetOptions.map(option => ({
        ...option,
        label: option.value === currentDelay ? `$(check) ${option.label}` : option.label,
        description: option.value === currentDelay 
          ? `${option.description} (current)` 
          : option.description
      }));
      
      const selection = await vscode.window.showQuickPick(enhancedOptions, {
        placeHolder: 'Select debounce delay for auto-analysis',
        title: 'Analysis Debounce Delay',
        matchOnDescription: true
      });
      
      if (!selection) {
        return;
      }
      
      let newDelay: number;
      
      if (selection.value === -1) {
        // Custom value
        const input = await vscode.window.showInputBox({
          prompt: 'Enter debounce delay in milliseconds (100-10000)',
          placeHolder: currentDelay.toString(),
          value: currentDelay.toString(),
          validateInput: (value) => {
            const num = parseInt(value);
            if (isNaN(num) || num < 100 || num > 10000) {
              return 'Please enter a number between 100 and 10000 milliseconds';
            }
            return undefined;
          }
        });
        
        if (!input) {
          return;
        }
        
        newDelay = parseInt(input);
      } else {
        newDelay = selection.value;
      }
      
      // ✅ SAVE TO CONFIGURATION FIRST
      await config.update('codexr.analysis.debounceDelay', newDelay, vscode.ConfigurationTarget.Global);
      
      console.log(`⚙️ Configuration updated: debounce delay set to ${newDelay}ms`);
      
      // ✅ APPLY TO FILEWATCHMANAGER IMMEDIATELY
      await updateFileWatchManager(newDelay);
      
      // Show success message
      vscode.window.showInformationMessage(`Analysis delay updated to ${newDelay}ms`);
      
      // Refresh tree to show the change
      refreshTreeProvider();
      
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error setting analysis delay: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

/**
 * Registers the toggle auto analysis command
 * @returns Command disposable
 */
function registerToggleAutoAnalysisCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.toggleAutoAnalysis', async () => {
    try {
      const config = vscode.workspace.getConfiguration();
      const currentValue = config.get<boolean>('codexr.analysis.autoAnalysis', true);
      const newValue = !currentValue;
      
      await config.update('codexr.analysis.autoAnalysis', newValue, vscode.ConfigurationTarget.Global);
      
      const message = newValue 
        ? 'Auto-analysis is now enabled'
        : 'Auto-analysis is now disabled';
      
      vscode.window.showInformationMessage(message);
      
      // Update file watch manager if available
      await updateAutoAnalysisSetting(newValue);
      
      // Refresh tree
      refreshTreeProvider();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error toggling auto-analysis: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

/**
 * Registers the set analysis chart type command
 * @param context Extension context
 * @returns Command disposable
 */
function registerSetAnalysisChartTypeCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.setAnalysisChartType', async () => {
    try {
      const chartOptions: ChartTypeOption[] = [
        { label: 'Boats Chart', value: 'boats', description: 'Area-based 3D boat-like visualization' },
        { label: 'Bars Chart', value: 'bars', description: 'Traditional bar chart in 3D' },
        { label: 'Cylinders Chart', value: 'cyls', description: 'Cylindrical bars with radius and height' },
        { label: 'Bubbles Chart', value: 'bubbles', description: '3D bubbles with X/Z positioning and radius/height' },
        { label: 'Barsmap Chart', value: 'barsmap', description: '3D bars with Z-axis grouping' },
        { label: 'Pie Chart', value: 'pie', description: 'Circular sectors' },
        { label: 'Donut Chart', value: 'donut', description: 'Circular with center hole' }
      ];

      const currentChartType = context.globalState.get<string>('codexr.analysis.chartType') || 'boats';
      
      // Mark current selection
      const options = chartOptions.map(option => ({
        label: `${option.label}${option.value === currentChartType ? ' ✓' : ''}`,
        description: option.description,
        value: option.value
      }));

      const selection = await vscode.window.showQuickPick(options, {
        placeHolder: 'Select chart type for analysis visualizations',
        matchOnDescription: true
      });

      if (selection) {
        await context.globalState.update('codexr.analysis.chartType', selection.value);
        
        vscode.window.showInformationMessage(
          `Analysis chart type set to: ${selection.label.replace(' ✓', '')}`
        );
        
        // Refresh tree to show updated settings
        const treeDataProvider = (global as any).treeDataProvider;
        if (treeDataProvider && typeof treeDataProvider.refresh === 'function') {
          treeDataProvider.refresh();
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error setting chart type: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

/**
 * Registers the set dimension mapping command
 * @param context Extension context
 * @returns Command disposable
 */
function registerSetDimensionMappingCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand(
    'codexr.setDimensionMapping',
    async (chartType: string, dimensionKey: string, dimensionLabel: string) => {
      console.log(`Setting dimension mapping for ${chartType}, ${dimensionKey}: ${dimensionLabel}`);
      
      // Get available analysis fields
      const fieldOptions = ANALYSIS_FIELDS.map(field => ({
        label: field.displayName,
        description: field.description,
        value: field.key
      }));
      
      const selection = await vscode.window.showQuickPick(fieldOptions, {
        placeHolder: `Select data field for ${dimensionLabel}`,
        title: `Dimension Mapping: ${dimensionLabel}`
      });
      
      if (selection) {
        // Set the dimension mapping
        setDimensionMapping(context, chartType, dimensionKey, selection.value);
        
        vscode.window.showInformationMessage(
          `${dimensionLabel} mapped to: ${selection.label}`
        );
        
        // Refresh tree view
        refreshTreeProvider();
      }
    }
  );
}

/**
 * Registers the reset analysis defaults command
 * @param context Extension context
 * @param settingsManager Settings manager instance
 * @returns Command disposable
 */
function registerResetAnalysisDefaultsCommand(
  context: vscode.ExtensionContext, 
  settingsManager: AnalysisSettingsManager
): vscode.Disposable {
  return vscode.commands.registerCommand('codexr.resetAnalysisDefaults', async () => {
    try {
      // ✅ FIXED: Show confirmation dialog with only one option (VS Code will add Cancel automatically)
      const confirm = await vscode.window.showWarningMessage(
        'This will reset all analysis settings to their default values:',
        {
          modal: true,
          detail: `• Analysis Mode: XR
• Auto-Analysis: Enabled  
• Debounce Delay: 2000ms
• Chart Type: Boats
• Tree Display: Reset sorting and limits
• Dimension Mappings: Reset to defaults

This action cannot be undone.`
        },
        'Reset to Defaults'  // ✅ REMOVED: 'Cancel' - VS Code adds this automatically
      );

      if (confirm === 'Reset to Defaults') {
        // ✅ ENHANCED: Show progress and better error handling
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Resetting analysis settings...',
          cancellable: false
        }, async (progress) => {
          progress.report({ increment: 0, message: 'Resetting configuration...' });
          
          try {
            // Reset settings using the manager
            await settingsManager.resetToDefaults();
            
            progress.report({ increment: 50, message: 'Updating file watchers...' });
            
            // ✅ ENHANCED: Update FileWatchManager with new defaults
            await updateFileWatchManager(2000); // Default delay
            await updateAutoAnalysisSetting(true); // Default enabled
            
            progress.report({ increment: 100, message: 'Complete!' });
            
            // Show success message
            vscode.window.showInformationMessage(
              '✅ Analysis settings have been reset to defaults'
            );
            
          } catch (error) {
            console.error('❌ Error during settings reset:', error);
            
            // ✅ ENHANCED: More specific error messages
            const errorMessage = error instanceof Error ? error.message : String(error);
            let userMessage = 'Failed to reset analysis settings';
            
            if (errorMessage.includes('not a registered configuration')) {
              userMessage = 'Configuration error: Some settings could not be reset. Please check the extension configuration.';
            } else if (errorMessage.includes('FileWatchManager')) {
              userMessage = 'Settings reset but file watcher update failed. Restart VS Code to complete the reset.';
            }
            
            vscode.window.showErrorMessage(`${userMessage}: ${errorMessage}`);
            throw error; // Re-throw for outer catch
          }
        });
        
        // Refresh tree to show updated settings
        refreshTreeProvider();
      }
      // ✅ NOTE: No need to handle 'Cancel' case explicitly - VS Code handles this when user clicks Cancel or presses Esc
    } catch (error) {
      console.error('❌ Error in reset command:', error);
      // Error is already shown to user in the inner try-catch
    }
  });
}

/**
 * 
 * ✅ ENHANCED: Updates file watch manager with new debounce delay
 * @param delay New delay value
 */
async function updateFileWatchManager(delay: number): Promise<void> {
  try {
    // ✅ FIXED: Use proper import syntax with .js extension
    const { FileWatchManager } = await import('../../analysis/watchers/fileWatchManager.js');
    const watchManager = FileWatchManager.getInstance();
    
    if (watchManager) {
      console.log(`⏰ Updating FileWatchManager debounce delay to ${delay}ms`);
      
      // Get current status before update
      const beforeStatus = watchManager.getWatcherStatus();
      
      // ✅ CRITICAL: Apply the new delay immediately
      watchManager.setDebounceDelay(delay);
      
      // Get status after update
      const afterStatus = watchManager.getWatcherStatus();
      
      console.log(`✅ FileWatchManager updated successfully with ${delay}ms delay`);
      console.log(`📊 Active timers before: ${beforeStatus.activeTimers}, after: ${afterStatus.activeTimers}`);
      
      // ✅ SHOW DETAILED CONFIRMATION TO USER
      if (afterStatus.activeTimers > 0) {
        const fileList = afterStatus.activeTimerDetails.map((detail: any) => detail.file).join(', '); // ✅ FIXED: Add type annotation
        vscode.window.setStatusBarMessage(
          `$(clock) CodeXR: ${afterStatus.activeTimers} active timer(s) updated to ${delay}ms for: ${fileList}`, 
          5000
        );
      } else {
        vscode.window.setStatusBarMessage(
          `$(clock) CodeXR: Auto-analysis delay set to ${delay}ms (will apply to future file changes)`, 
          4000
        );
      }
    } else {
      console.warn('⚠️ FileWatchManager not available for debounce delay update');
      
      vscode.window.showWarningMessage(
        'Debounce delay setting saved, but file watcher is not active. The new delay will apply when you analyze files.'
      );
    }
  } catch (error) {
    console.error('❌ Could not update file watch manager:', error);
    
    vscode.window.showWarningMessage(
      'Debounce delay setting saved, but could not update active watchers. Try refreshing the analysis tree.'
    );
  }
}

/**
 * Updates auto analysis setting in file watch manager
 * @param enabled Whether auto analysis is enabled
 */
async function updateAutoAnalysisSetting(enabled: boolean): Promise<void> {
  try {
    // ✅ FIXED: Use proper import syntax with .js extension
    const { FileWatchManager } = await import('../../analysis/watchers/fileWatchManager.js');
    const watchManager = FileWatchManager.getInstance();
    if (watchManager) {
      watchManager.setAutoAnalysis(enabled);
    }
  } catch (error) {
    console.warn('Could not update auto analysis setting:', error);
  }
}