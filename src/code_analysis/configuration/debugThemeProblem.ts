/**
 * Debug Theme Configuration Problem
 * Script to diagnose why theme settings are not being saved/loaded correctly
 */

import * as vscode from 'vscode';
import { AnalysisConfigurationStorage } from './analysisConfigurationStorage';
import * as fs from 'fs';
import * as path from 'path';
import { ExtensionCommandRegistration } from '../../commands/shared';

export class DebugThemeProblem {
    static async debugThemeConfiguration(context: vscode.ExtensionContext): Promise<void> {
        console.log('\n=== DEBUG THEME CONFIGURATION PROBLEM ===');

        try {
            const storage = AnalysisConfigurationStorage.getInstance(context);
            const configPath = storage.getConfigurationFilePath();
            console.log(`\n1. Configuration file path: ${configPath}`);

            const exists = await storage.configurationExists();
            console.log(`   File exists: ${exists}`);

            if (exists) {
                const rawContent = await storage.debugGetConfigurationFileContent();
                console.log(`\n2. Raw configuration file content:`);
                console.log(rawContent);

                try {
                    const stats = fs.statSync(configPath);
                    console.log(`\n3. File metadata:`);
                    console.log(`   Size: ${stats.size} bytes`);
                    console.log(`   Modified: ${stats.mtime}`);
                    console.log(`   Permissions: ${stats.mode.toString(8)}`);
                } catch (statsError) {
                    console.error(`   Error reading file stats: ${statsError}`);
                }
            }

            console.log(`\n4. Loading configuration through storage manager:`);
            const loadedConfig = await storage.loadConfiguration();
            console.log(`   Loaded config:`, JSON.stringify(loadedConfig, null, 2));

            const currentTheme = await storage.getViewTheme();
            console.log(`\n5. Current theme from storage: ${currentTheme}`);

            console.log(`\n6. Force reloading configuration:`);
            const reloadedConfig = await storage.forceReloadConfiguration();
            console.log(`   Reloaded config:`, JSON.stringify(reloadedConfig, null, 2));
            const reloadedTheme = await storage.getViewTheme();
            console.log(`   Reloaded theme: ${reloadedTheme}`);

            console.log(`\n7. Testing theme save operation:`);
            const originalTheme = currentTheme;
            const testTheme = originalTheme === 'Dark' ? 'Light' : 'Dark';

            console.log(`   Original theme: ${originalTheme}`);
            console.log(`   Setting test theme: ${testTheme}`);
            await storage.setViewTheme(testTheme);

            const savedTheme = await storage.getViewTheme();
            console.log(`   Theme after save: ${savedTheme}`);

            if (await storage.configurationExists()) {
                const updatedContent = await storage.debugGetConfigurationFileContent();
                console.log(`\n8. Updated file content after theme change:`);
                console.log(updatedContent);
            }

            console.log(`\n9. Restoring original theme: ${originalTheme}`);
            await storage.setViewTheme(originalTheme);
            const restoredTheme = await storage.getViewTheme();
            console.log(`   Restored theme: ${restoredTheme}`);

            console.log(`\n10. Checking directory permissions:`);
            const configDir = path.dirname(configPath);
            try {
                const dirStats = fs.statSync(configDir);
                console.log(`   Directory: ${configDir}`);
                console.log(`   Directory permissions: ${dirStats.mode.toString(8)}`);
                fs.accessSync(configDir, fs.constants.W_OK);
                console.log('   Directory is writable');
            } catch (dirError) {
                console.error(`   Directory access error: ${dirError}`);
            }

            console.log('\n=== DEBUG COMPLETE ===\n');
        } catch (error) {
            console.error('\nDEBUG ERROR:', error);
        }
    }

    static async testThemeWorkflow(context: vscode.ExtensionContext): Promise<void> {
        console.log('\n=== TESTING THEME WORKFLOW ===');

        try {
            const storage = AnalysisConfigurationStorage.getInstance(context);
            const initialTheme = await storage.getViewTheme();
            console.log(`\n1. Initial theme: ${initialTheme}`);

            const newTheme = initialTheme === 'Dark' ? 'Light' : 'Dark';
            console.log(`\n2. Changing to: ${newTheme}`);
            await storage.setViewTheme(newTheme);

            const verifyTheme = await storage.getViewTheme();
            console.log(`   Verified theme: ${verifyTheme}`);
            console.log(`   Change successful: ${verifyTheme === newTheme}`);

            console.log('\n3. Force reloading from disk:');
            const reloadedTheme = await storage.forceReloadConfiguration();
            console.log(`   Reloaded theme: ${reloadedTheme.viewTheme}`);
            console.log(`   Reload matches: ${reloadedTheme.viewTheme === newTheme}`);

            const fileContent = await storage.debugGetConfigurationFileContent();
            if (fileContent) {
                const parsed = JSON.parse(fileContent);
                console.log(`\n4. File content theme: ${parsed.configuration.viewTheme}`);
                console.log(`   File matches: ${parsed.configuration.viewTheme === newTheme}`);
            }

            console.log(`\n5. Restoring original theme: ${initialTheme}`);
            await storage.setViewTheme(initialTheme);
            const finalTheme = await storage.getViewTheme();
            console.log(`   Final theme: ${finalTheme}`);
            console.log(`   Restore successful: ${finalTheme === initialTheme}`);

            console.log('\n=== WORKFLOW TEST COMPLETE ===\n');
        } catch (error) {
            console.error('\nWORKFLOW TEST ERROR:', error);
        }
    }

    static getCommandRegistrations(
        context: vscode.ExtensionContext,
    ): ExtensionCommandRegistration[] {
        return [
            {
                id: 'codexr.debug.themeConfiguration',
                module: 'ANALYSIS_DEBUG',
                description: 'Debug theme configuration',
                handler: async () => {
                    await DebugThemeProblem.debugThemeConfiguration(context);
                    vscode.window.showInformationMessage('Theme configuration debug completed. Check console for details.');
                },
                errorMessage: 'Failed to debug theme configuration'
            },
            {
                id: 'codexr.debug.themeWorkflow',
                module: 'ANALYSIS_DEBUG',
                description: 'Test theme workflow',
                handler: async () => {
                    await DebugThemeProblem.testThemeWorkflow(context);
                    vscode.window.showInformationMessage('Theme workflow test completed. Check console for details.');
                },
                errorMessage: 'Failed to test theme workflow'
            }
        ];
    }
}

