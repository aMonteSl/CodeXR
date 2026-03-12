/**
 * Debug Theme Configuration Problem
 * Script to diagnose why theme settings are not being saved/loaded correctly
 */

import * as vscode from 'vscode';
import { AnalysisConfigurationStorage } from './analysisConfigurationStorage';
import * as fs from 'fs';
import * as path from 'path';

export class DebugThemeProblem {
    
    /**
     * Main debug function to check theme configuration
     */
    static async debugThemeConfiguration(context: vscode.ExtensionContext): Promise<void> {
        console.log('\n===  DEBUG THEME CONFIGURATION PROBLEM ===');
        
        try {
            const storage = AnalysisConfigurationStorage.getInstance(context);
            
            // 1. Check current configuration file path
            const configPath = storage.getConfigurationFilePath();
            console.log(`\n1 Configuration file path: ${configPath}`);
            
            // 2. Check if configuration file exists
            const exists = await storage.configurationExists();
            console.log(`   File exists: ${exists}`);
            
            if (exists) {
                // 3. Read raw file content
                const rawContent = await storage.debugGetConfigurationFileContent();
                console.log(`\n2 Raw configuration file content:`);
                console.log(rawContent);
                
                // 4. Check file permissions and metadata
                try {
                    const stats = fs.statSync(configPath);
                    console.log(`\n3 File metadata:`);
                    console.log(`   Size: ${stats.size} bytes`);
                    console.log(`   Modified: ${stats.mtime}`);
                    console.log(`   Permissions: ${stats.mode.toString(8)}`);
                } catch (statsError) {
                    console.error(`   Error reading file stats: ${statsError}`);
                }
            }
            
            // 5. Load configuration using the storage manager
            console.log(`\n4 Loading configuration through storage manager:`);
            const loadedConfig = await storage.loadConfiguration();
            console.log(`   Loaded config:`, JSON.stringify(loadedConfig, null, 2));
            
            // 6. Check current theme specifically
            const currentTheme = await storage.getViewTheme();
            console.log(`\n5 Current theme from storage: ${currentTheme}`);
            
            // 7. Force reload and check again
            console.log(`\n6 Force reloading configuration:`);
            const reloadedConfig = await storage.forceReloadConfiguration();
            console.log(`   Reloaded config:`, JSON.stringify(reloadedConfig, null, 2));
            const reloadedTheme = await storage.getViewTheme();
            console.log(`   Reloaded theme: ${reloadedTheme}`);
            
            // 8. Test saving a different theme
            console.log(`\n7 Testing theme save operation:`);
            const originalTheme = currentTheme;
            const testTheme = originalTheme === 'Dark' ? 'Light' : 'Dark';
            
            console.log(`   Original theme: ${originalTheme}`);
            console.log(`   Setting test theme: ${testTheme}`);
            await storage.setViewTheme(testTheme);
            
            // Check if it was saved
            const savedTheme = await storage.getViewTheme();
            console.log(`   Theme after save: ${savedTheme}`);
            
            // Read file again to verify
            if (await storage.configurationExists()) {
                const updatedContent = await storage.debugGetConfigurationFileContent();
                console.log(`\n8 Updated file content after theme change:`);
                console.log(updatedContent);
            }
            
            // 9. Restore original theme
            console.log(`\n9 Restoring original theme: ${originalTheme}`);
            await storage.setViewTheme(originalTheme);
            const restoredTheme = await storage.getViewTheme();
            console.log(`   Restored theme: ${restoredTheme}`);
            
            // 10. Check directory permissions
            console.log(`\n Checking directory permissions:`);
            const configDir = path.dirname(configPath);
            try {
                const dirStats = fs.statSync(configDir);
                console.log(`   Directory: ${configDir}`);
                console.log(`   Directory permissions: ${dirStats.mode.toString(8)}`);
                console.log(`   Directory writable: ${fs.constants.W_OK}`);
                
                // Test write permissions
                fs.accessSync(configDir, fs.constants.W_OK);
                console.log(`    Directory is writable`);
            } catch (dirError) {
                console.error(`    Directory access error: ${dirError}`);
            }
            
            console.log('\n===  DEBUG COMPLETE ===\n');
            
        } catch (error) {
            console.error('\n DEBUG ERROR:', error);
        }
    }
    
    /**
     * Specific test for theme configuration workflow
     */
    static async testThemeWorkflow(context: vscode.ExtensionContext): Promise<void> {
        console.log('\n===  TESTING THEME WORKFLOW ===');
        
        try {
            const storage = AnalysisConfigurationStorage.getInstance(context);
            
            // Step 1: Get initial state
            console.log('\n1 Initial state:');
            const initialTheme = await storage.getViewTheme();
            console.log(`   Initial theme: ${initialTheme}`);
            
            // Step 2: Change to opposite theme
            const newTheme = initialTheme === 'Dark' ? 'Light' : 'Dark';
            console.log(`\n2 Changing to: ${newTheme}`);
            await storage.setViewTheme(newTheme);
            
            // Step 3: Verify change was saved
            const verifyTheme = await storage.getViewTheme();
            console.log(`   Verified theme: ${verifyTheme}`);
            console.log(`   Change successful: ${verifyTheme === newTheme ? '' : ''}`);
            
            // Step 4: Force reload from disk
            console.log('\n3 Force reloading from disk:');
            const reloadedTheme = await storage.forceReloadConfiguration();
            console.log(`   Reloaded theme: ${reloadedTheme.viewTheme}`);
            console.log(`   Reload matches: ${reloadedTheme.viewTheme === newTheme ? '' : ''}`);
            
            // Step 5: Check file content directly
            const fileContent = await storage.debugGetConfigurationFileContent();
            if (fileContent) {
                const parsed = JSON.parse(fileContent);
                console.log(`\n4 File content theme: ${parsed.configuration.viewTheme}`);
                console.log(`   File matches: ${parsed.configuration.viewTheme === newTheme ? '' : ''}`);
            }
            
            // Step 6: Restore original
            console.log(`\n5 Restoring original theme: ${initialTheme}`);
            await storage.setViewTheme(initialTheme);
            const finalTheme = await storage.getViewTheme();
            console.log(`   Final theme: ${finalTheme}`);
            console.log(`   Restore successful: ${finalTheme === initialTheme ? '' : ''}`);
            
            console.log('\n===  WORKFLOW TEST COMPLETE ===\n');
            
        } catch (error) {
            console.error('\n WORKFLOW TEST ERROR:', error);
        }
    }
    
    /**
     * Register debug commands
     */
    static registerDebugCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
        return [
            vscode.commands.registerCommand('codexr.debug.themeConfiguration', async () => {
                await DebugThemeProblem.debugThemeConfiguration(context);
                vscode.window.showInformationMessage('Theme configuration debug completed. Check console for details.');
            }),
            
            vscode.commands.registerCommand('codexr.debug.themeWorkflow', async () => {
                await DebugThemeProblem.testThemeWorkflow(context);
                vscode.window.showInformationMessage('Theme workflow test completed. Check console for details.');
            })
        ];
    }
}
