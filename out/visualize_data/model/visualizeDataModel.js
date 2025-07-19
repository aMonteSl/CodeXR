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
exports.VisualizeDataModel = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const visualizeDataState_1 = require("../state/visualizeDataState");
/**
 * Visualize Data Model
 * Handles state management and validation for visualize data functionality
 */
class VisualizeDataModel {
    /**
     * Reset the visualize data state completely
     * This should be called on extension activation to ensure clean state
     */
    static resetVisualizeDataState(context) {
        console.log('VISUALIZE-STATE: Resetting visualize data state on extension activation');
        try {
            // Clear any existing state from workspace storage
            context.workspaceState.update('visualizeDataState', undefined);
            console.log('VISUALIZE-STATE: Cleared workspace storage');
            // If state manager instance exists, reset it
            if (visualizeDataState_1.VisualizeDataStateManager.hasInstance()) {
                const stateManager = visualizeDataState_1.VisualizeDataStateManager.getInstance(context);
                stateManager.reset();
                console.log('VISUALIZE-STATE: Reset existing state manager instance');
            }
            // Force creation of new clean state manager
            const stateManager = visualizeDataState_1.VisualizeDataStateManager.getInstance(context);
            const state = stateManager.getState();
            console.log('VISUALIZE-STATE: State reset complete', {
                selectedChart: state.selectedChart?.id || 'none',
                selectedJsonPath: state.selectedJsonPath || 'none',
                dimensionMappings: state.dimensionMappings.length,
                isReadyToLaunch: state.isReadyToLaunch
            });
        }
        catch (error) {
            console.error('VISUALIZE-STATE: Error during state reset:', error);
        }
    }
    /**
     * Validate that a file path still exists
     */
    static validateFilePath(filePath) {
        try {
            return fs.existsSync(filePath);
        }
        catch (error) {
            console.warn('VISUALIZE-STATE: Error checking file existence:', error);
            return false;
        }
    }
    /**
     * Validate the current state and clean up invalid entries
     */
    static validateAndCleanState(context) {
        console.log('VISUALIZE-STATE: Validating and cleaning current state');
        if (!visualizeDataState_1.VisualizeDataStateManager.hasInstance()) {
            console.log('VISUALIZE-STATE: No state manager instance to validate');
            return;
        }
        const stateManager = visualizeDataState_1.VisualizeDataStateManager.getInstance(context);
        const state = stateManager.getState();
        let needsUpdate = false;
        // Check if selected JSON file still exists
        if (state.selectedJsonPath) {
            if (!this.validateFilePath(state.selectedJsonPath)) {
                console.log('VISUALIZE-STATE: Selected JSON file no longer exists, clearing:', state.selectedJsonPath);
                stateManager.updateSelectedJson('', '');
                needsUpdate = true;
            }
            else {
                console.log('VISUALIZE-STATE: Selected JSON file is valid:', state.selectedJsonPath);
            }
        }
        // If state was modified, trigger refresh
        if (needsUpdate) {
            console.log('VISUALIZE-STATE: State was cleaned, triggering UI refresh');
            vscode.commands.executeCommand('codexr.servers.refresh');
        }
        else {
            console.log('VISUALIZE-STATE: State validation complete, no changes needed');
        }
    }
    /**
     * Get state summary for debugging
     */
    static getStateSummary(context) {
        if (!visualizeDataState_1.VisualizeDataStateManager.hasInstance()) {
            return 'No state manager instance';
        }
        const stateManager = visualizeDataState_1.VisualizeDataStateManager.getInstance(context);
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
exports.VisualizeDataModel = VisualizeDataModel;
//# sourceMappingURL=visualizeDataModel.js.map