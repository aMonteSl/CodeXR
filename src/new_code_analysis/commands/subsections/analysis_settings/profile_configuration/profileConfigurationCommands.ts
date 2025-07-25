/**
 * Profile Configuration Commands
 * Commands for managing analysis configuration profiles
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ProfileConfigurationSetting } from '../../../../views/subsections/analysis_settings/profile_configuration';
import { CommandRegistration } from '../analysis_file_mode';
import { AnalysisConfigurationStorage } from '../../../../configuration/analysisConfigurationStorage';

export class ProfileConfigurationCommands {

    constructor(
        private context: vscode.ExtensionContext,
        private profileConfigurationSetting: ProfileConfigurationSetting
    ) {}

    /**
     * Get command registrations (don't register them yet)
     * This follows the "nested dolls" architecture pattern
     */
    static getCommandRegistrations(
        context: vscode.ExtensionContext, 
        profileConfigurationSetting: ProfileConfigurationSetting,
        refreshCallback: () => void
    ): CommandRegistration[] {
        console.log('PROFILE_CONFIGURATION_COMMANDS: Creating command registrations');
        const commands = new ProfileConfigurationCommands(context, profileConfigurationSetting);

        const registrations = [
            {
                commandId: 'newCodeAnalysis.resetToDefaults',
                callback: async () => {
                    console.log(`PROFILE_CONFIGURATION_COMMANDS: Reset to defaults command TRIGGERED`);
                    await commands.resetToDefaults();
                    refreshCallback();
                },
                description: 'Reset analysis settings to default values'
            },
            {
                commandId: 'newCodeAnalysis.saveProfile',
                callback: async () => {
                    console.log(`PROFILE_CONFIGURATION_COMMANDS: Save profile command TRIGGERED`);
                    await commands.saveProfile();
                    refreshCallback();
                },
                description: 'Save current configuration as a named profile'
            },
            {
                commandId: 'newCodeAnalysis.loadProfile',
                callback: async () => {
                    console.log(`PROFILE_CONFIGURATION_COMMANDS: Load profile command TRIGGERED`);
                    await commands.loadProfile();
                    refreshCallback();
                },
                description: 'Load a previously saved configuration profile'
            },
            {
                commandId: 'newCodeAnalysis.deleteProfile',
                callback: async () => {
                    console.log(`PROFILE_CONFIGURATION_COMMANDS: Delete profile command TRIGGERED`);
                    await commands.deleteProfile();
                    refreshCallback();
                },
                description: 'Delete a previously saved configuration profile'
            }
        ];

        console.log(`PROFILE_CONFIGURATION_COMMANDS: Created ${registrations.length} command registrations`);
        return registrations;
    }

    /**
     * Reset to default values
     */
    private async resetToDefaults(): Promise<void> {
        console.log('PROFILE_CONFIGURATION_COMMANDS: Resetting to default values');
        
        try {
            const shouldReset = await vscode.window.showWarningMessage(
                'This will reset all analysis settings to their default values. Are you sure?',
                'Reset to Defaults', 'Cancel'
            );

            if (shouldReset !== 'Reset to Defaults') {
                console.log('PROFILE_CONFIGURATION_COMMANDS: Reset cancelled by user');
                return;
            }

            // Use the profile configuration setting to reset
            await this.profileConfigurationSetting.resetToDefaults();
            
            console.log('PROFILE_CONFIGURATION_COMMANDS: Reset to defaults completed successfully');
            
        } catch (error) {
            console.error('PROFILE_CONFIGURATION_COMMANDS: Error resetting to defaults:', error);
            vscode.window.showErrorMessage(`Failed to reset to defaults: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Save current configuration as a profile
     */
    private async saveProfile(): Promise<void> {
        console.log('PROFILE_CONFIGURATION_COMMANDS: Saving profile');
        
        try {
            // Ask user for profile name
            const profileName = await vscode.window.showInputBox({
                prompt: 'Enter a name for this configuration profile',
                placeHolder: 'e.g., "My Custom Setup", "Project A Settings"',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Profile name cannot be empty';
                    }
                    if (value.includes('/') || value.includes('\\') || value.includes(':')) {
                        return 'Profile name cannot contain special characters (/, \\, :)';
                    }
                    return null;
                }
            });

            if (!profileName) {
                console.log('PROFILE_CONFIGURATION_COMMANDS: Save profile cancelled - no name provided');
                return;
            }

            // Get current configuration from AnalysisConfigurationStorage
            const storage = AnalysisConfigurationStorage.getInstance(this.context);
            const currentConfig = await storage.loadConfiguration();
            
            console.log('PROFILE_CONFIGURATION_COMMANDS: Current config to save:', JSON.stringify(currentConfig, null, 2));
            
            // Save to globalStorage
            const profilesDir = path.join(this.context.globalStorageUri.fsPath, 'analysis_settings');
            
            // Create directory if it doesn't exist
            if (!fs.existsSync(profilesDir)) {
                fs.mkdirSync(profilesDir, { recursive: true });
            }

            const profilePath = path.join(profilesDir, `${profileName.trim()}.json`);
            
            // Check if profile already exists
            if (fs.existsSync(profilePath)) {
                const shouldOverwrite = await vscode.window.showWarningMessage(
                    `A profile named "${profileName}" already exists. Do you want to overwrite it?`,
                    'Overwrite', 'Cancel'
                );

                if (shouldOverwrite !== 'Overwrite') {
                    console.log('PROFILE_CONFIGURATION_COMMANDS: Save profile cancelled - user chose not to overwrite');
                    return;
                }
            }

            // Add metadata to the profile
            const profileData = {
                name: profileName.trim(),
                savedAt: new Date().toISOString(),
                version: '1.0',
                configuration: currentConfig
            };

            // Save the profile
            fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2));
            
            console.log(`PROFILE_CONFIGURATION_COMMANDS: Profile "${profileName}" saved successfully`);
            vscode.window.showInformationMessage(`Configuration profile "${profileName}" saved successfully`);
            
        } catch (error) {
            console.error('PROFILE_CONFIGURATION_COMMANDS: Error saving profile:', error);
            vscode.window.showErrorMessage(`Failed to save profile: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Load a previously saved profile
     */
    private async loadProfile(): Promise<void> {
        console.log('PROFILE_CONFIGURATION_COMMANDS: Loading profile');
        
        try {
            const profilesDir = path.join(this.context.globalStorageUri.fsPath, 'analysis_settings');
            
            // Check if profiles directory exists
            if (!fs.existsSync(profilesDir)) {
                vscode.window.showInformationMessage('No saved profiles found');
                return;
            }

            // Get list of saved profiles
            const profileFiles = fs.readdirSync(profilesDir).filter(file => file.endsWith('.json'));
            
            if (profileFiles.length === 0) {
                vscode.window.showInformationMessage('No saved profiles found');
                return;
            }

            // Create quick pick items
            const profileItems = profileFiles.map(file => {
                const profilePath = path.join(profilesDir, file);
                try {
                    const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
                    const savedDate = new Date(profileData.savedAt).toLocaleString();
                    return {
                        label: profileData.name || file.replace('.json', ''),
                        description: `Saved: ${savedDate}`,
                        detail: `Version: ${profileData.version || 'Unknown'}`,
                        profilePath: profilePath
                    };
                } catch {
                    return {
                        label: file.replace('.json', ''),
                        description: 'Invalid profile data',
                        detail: 'This profile may be corrupted',
                        profilePath: profilePath
                    };
                }
            });

            // Show profile selection
            const selectedProfile = await vscode.window.showQuickPick(profileItems, {
                placeHolder: 'Select a configuration profile to load',
                title: 'Load Configuration Profile'
            });

            if (!selectedProfile) {
                console.log('PROFILE_CONFIGURATION_COMMANDS: Load profile cancelled');
                return;
            }

            // Confirm loading
            const shouldLoad = await vscode.window.showWarningMessage(
                `This will replace your current configuration with "${selectedProfile.label}". Are you sure?`,
                'Load Profile', 'Cancel'
            );

            if (shouldLoad !== 'Load Profile') {
                console.log('PROFILE_CONFIGURATION_COMMANDS: Load profile cancelled by user');
                return;
            }

            // Load the profile
            const profileData = JSON.parse(fs.readFileSync(selectedProfile.profilePath, 'utf8'));
            
            console.log('PROFILE_CONFIGURATION_COMMANDS: Loaded profile data:', JSON.stringify(profileData.configuration, null, 2));
            
            // Update configuration using AnalysisConfigurationStorage
            const storage = AnalysisConfigurationStorage.getInstance(this.context);
            await storage.updateConfiguration(profileData.configuration);
            
            console.log(`PROFILE_CONFIGURATION_COMMANDS: Profile "${selectedProfile.label}" loaded successfully`);
            vscode.window.showInformationMessage(`Configuration profile "${selectedProfile.label}" loaded successfully`);
            
        } catch (error) {
            console.error('PROFILE_CONFIGURATION_COMMANDS: Error loading profile:', error);
            vscode.window.showErrorMessage(`Failed to load profile: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Delete a saved profile
     */
    private async deleteProfile(): Promise<void> {
        console.log('PROFILE_CONFIGURATION_COMMANDS: Deleting profile');
        
        try {
            const profilesDir = path.join(this.context.globalStorageUri.fsPath, 'analysis_settings');
            
            // Check if profiles directory exists
            if (!fs.existsSync(profilesDir)) {
                vscode.window.showInformationMessage('No saved profiles found');
                return;
            }

            // Get list of saved profiles
            const profileFiles = fs.readdirSync(profilesDir).filter(file => file.endsWith('.json'));
            
            if (profileFiles.length === 0) {
                vscode.window.showInformationMessage('No saved profiles found');
                return;
            }

            // Create quick pick items
            const profileItems = profileFiles.map(file => {
                const profilePath = path.join(profilesDir, file);
                try {
                    const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
                    const savedDate = new Date(profileData.savedAt).toLocaleString();
                    return {
                        label: profileData.name || file.replace('.json', ''),
                        description: `Saved: ${savedDate}`,
                        detail: `Version: ${profileData.version || 'Unknown'}`,
                        profilePath: profilePath
                    };
                } catch {
                    return {
                        label: file.replace('.json', ''),
                        description: 'Invalid profile data',
                        detail: 'This profile may be corrupted',
                        profilePath: profilePath
                    };
                }
            });

            // Show profile selection
            const selectedProfile = await vscode.window.showQuickPick(profileItems, {
                placeHolder: 'Select a configuration profile to delete',
                title: 'Delete Configuration Profile'
            });

            if (!selectedProfile) {
                console.log('PROFILE_CONFIGURATION_COMMANDS: Delete profile cancelled');
                return;
            }

            // Confirm deletion
            const shouldDelete = await vscode.window.showWarningMessage(
                `Are you sure you want to delete the profile "${selectedProfile.label}"? This action cannot be undone.`,
                'Delete Profile', 'Cancel'
            );

            if (shouldDelete !== 'Delete Profile') {
                console.log('PROFILE_CONFIGURATION_COMMANDS: Delete profile cancelled by user');
                return;
            }

            // Delete the profile
            fs.unlinkSync(selectedProfile.profilePath);
            
            console.log(`PROFILE_CONFIGURATION_COMMANDS: Profile "${selectedProfile.label}" deleted successfully`);
            vscode.window.showInformationMessage(`Configuration profile "${selectedProfile.label}" deleted successfully`);
            
        } catch (error) {
            console.error('PROFILE_CONFIGURATION_COMMANDS: Error deleting profile:', error);
            vscode.window.showErrorMessage(`Failed to delete profile: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
