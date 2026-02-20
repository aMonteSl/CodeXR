/**
 * Configuration Debug Tool
 * Utility to debug configuration storage issues
 */

import * as vscode from 'vscode';
import { AnalysisConfigurationStorage } from './analysisConfigurationStorage';

/**
 * Debug configuration storage
 */
export async function debugConfiguration(context: vscode.ExtensionContext): Promise<void> {
    const storage = AnalysisConfigurationStorage.getInstance(context);
    
    console.log('=== NEW_CODE_ANALYSIS DEBUG ===');
    
    // Check if configuration file exists
    const exists = await storage.configurationExists();
    console.log(`Configuration file exists: ${exists}`);
    console.log(`Configuration file path: ${storage.getConfigurationFilePath()}`);
    
    // Get current configuration
    const config = await storage.loadConfiguration();
    console.log('Current configuration loaded:', JSON.stringify(config, null, 2));
    
    // Get raw file content
    const rawContent = await storage.debugGetConfigurationFileContent();
    if (rawContent) {
        console.log('Raw configuration file content:');
        console.log(rawContent);
    } else {
        console.log('No configuration file found');
    }
    
    // Test each setting
    console.log('\n=== Testing individual settings ===');
    
    // Test theme
    const currentTheme = await storage.getViewTheme();
    console.log(`Current theme from storage: ${currentTheme}`);
    
    // Test analysis file mode
    const currentMode = await storage.getAnalysisFileMode();
    console.log(`Current analysis mode from storage: ${currentMode}`);
    
    // Test auto-analysis delay
    const currentDelay = await storage.getAutoAnalysisDelay();
    console.log(`Current auto-analysis delay from storage:`, JSON.stringify(currentDelay, null, 2));
    
    console.log('=== DEBUG COMPLETE ===');
}

/**
 * Test configuration changes
 */
export async function testConfigurationChanges(context: vscode.ExtensionContext): Promise<void> {
    const storage = AnalysisConfigurationStorage.getInstance(context);
    
    console.log('=== TESTING CONFIGURATION CHANGES ===');
    
    // Test theme change
    console.log('\n1. Testing theme change...');
    const originalTheme = await storage.getViewTheme();
    console.log(`Original theme: ${originalTheme}`);
    
    const newTheme = originalTheme === 'Dark' ? 'Light' : 'Dark';
    await storage.setViewTheme(newTheme);
    console.log(`Changed theme to: ${newTheme}`);
    
    // Force reload and verify
    const reloadedTheme = await storage.forceReloadConfiguration();
    console.log(`Theme after reload: ${reloadedTheme.viewTheme}`);
    
    // Test analysis mode change
    console.log('\n2. Testing analysis mode change...');
    const originalMode = await storage.getAnalysisFileMode();
    console.log(`Original mode: ${originalMode}`);
    
    const newMode = originalMode === 'XR' ? 'LivePanel' : 'XR';
    await storage.setAnalysisFileMode(newMode);
    console.log(`Changed mode to: ${newMode}`);
    
    // Force reload and verify
    const reloadedConfig = await storage.forceReloadConfiguration();
    console.log(`Mode after reload: ${reloadedConfig.analysisFileMode}`);
    
    // Restore original values
    console.log('\n3. Restoring original values...');
    await storage.setViewTheme(originalTheme);
    await storage.setAnalysisFileMode(originalMode);
    
    const finalConfig = await storage.forceReloadConfiguration();
    console.log('Final configuration:', JSON.stringify(finalConfig, null, 2));
    
    console.log('=== TEST COMPLETE ===');
}

export { AnalysisConfigurationStorage };
