import * as vscode from 'vscode';
import * as fs from 'fs';
import { VisualizeDataStateManager } from '../state/visualizeDataState';

/**
 * Visualize Data Model
 * Handles state management and validation for visualize data functionality
 */
export class VisualizeDataModel {
    
    /**
     * Reset the visualize data state completely
     * This should be called on extension activation to ensure clean state
     */
    public static resetVisualizeDataState(context: vscode.ExtensionContext): void {
        console.log('VISUALIZE-STATE: Resetting visualize data state on extension activation');
        
        try {
            // Clear any existing state from workspace storage
            context.workspaceState.update('visualizeDataState', undefined);
            console.log('VISUALIZE-STATE: Cleared workspace storage');
            
            // If state manager instance exists, reset it
            if (VisualizeDataStateManager.hasInstance()) {
                const stateManager = VisualizeDataStateManager.getInstance(context);
                stateManager.reset();
                console.log('VISUALIZE-STATE: Reset existing state manager instance');
            }
            
            // Force creation of new clean state manager
            const stateManager = VisualizeDataStateManager.getInstance(context);
            const state = stateManager.getState();
            
            console.log('VISUALIZE-STATE: State reset complete', {
                selectedChart: state.selectedChart?.id || 'none',
                selectedJsonPath: state.selectedJsonPath || 'none',
                dimensionMappings: state.dimensionMappings.length,
                isReadyToLaunch: state.isReadyToLaunch
            });
            
        } catch (error) {
            console.error('VISUALIZE-STATE: Error during state reset:', error);
        }
    }
    
    /**
     * Validate that a file path still exists
     */
    public static validateFilePath(filePath: string): boolean {
        try {
            return fs.existsSync(filePath);
        } catch (error) {
            console.warn('VISUALIZE-STATE: Error checking file existence:', error);
            return false;
        }
    }
    
    /**
     * Validate the current state and clean up invalid entries
     */
    public static validateAndCleanState(context: vscode.ExtensionContext): void {
        console.log('VISUALIZE-STATE: Validating and cleaning current state');
        
        if (!VisualizeDataStateManager.hasInstance()) {
            console.log('VISUALIZE-STATE: No state manager instance to validate');
            return;
        }
        
        const stateManager = VisualizeDataStateManager.getInstance(context);
        const state = stateManager.getState();
        let needsUpdate = false;
        
        // Check if selected JSON file still exists
        if (state.selectedJsonPath) {
            if (!this.validateFilePath(state.selectedJsonPath)) {
                console.log('VISUALIZE-STATE: Selected JSON file no longer exists, clearing:', state.selectedJsonPath);
                stateManager.updateSelectedJson('', '');
                needsUpdate = true;
            } else {
                console.log('VISUALIZE-STATE: Selected JSON file is valid:', state.selectedJsonPath);
            }
        }
        
        // If state was modified, trigger refresh
        if (needsUpdate) {
            console.log('VISUALIZE-STATE: State was cleaned, triggering UI refresh');
            vscode.commands.executeCommand('codexr.servers.refresh');
        } else {
            console.log('VISUALIZE-STATE: State validation complete, no changes needed');
        }
    }
    
    /**
     * Get state summary for debugging
     */
    public static getStateSummary(context: vscode.ExtensionContext): string {
        if (!VisualizeDataStateManager.hasInstance()) {
            return 'No state manager instance';
        }
        
        const stateManager = VisualizeDataStateManager.getInstance(context);
        const state = stateManager.getState();
        
        return `State Summary:
  - Chart: ${state.selectedChart?.name || 'Not selected'}
  - JSON File: ${state.selectedJsonName || 'Not selected'}
  - JSON Path Valid: ${state.selectedJsonPath ? this.validateFilePath(state.selectedJsonPath) : 'N/A'}
  - Dimension Mappings: ${state.dimensionMappings.length}
  - Mapping Configured: ${state.isDimensionMappingConfigured}
  - Ready to Launch: ${state.isReadyToLaunch}`;
    }
}
