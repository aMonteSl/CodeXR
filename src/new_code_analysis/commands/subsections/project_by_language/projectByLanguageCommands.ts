/**
 * Project Structure Commands
 * Commands for analyzing files and directories from project structure
 */

import * as vscode from 'vscode';
import { CommandRegistration } from '../analysis_settings/analysis_file_mode';
import { AnalysisConfigurationStorage } from '../../../configuration/analysisConfigurationStorage';

export class ProjectByLanguageCommands {
    
    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Get project structure command registrations (nested dolls pattern)
     */
    static getCommandRegistrations(
        context: vscode.ExtensionContext, 
        refreshCallback: () => void
    ): CommandRegistration[] {
        console.log('NEW_CODE_ANALYSIS: Collecting Project Structure command registrations');
        const commands = new ProjectByLanguageCommands(context);
        
        const commandRegistrations: CommandRegistration[] = [
            {
                commandId: 'newCodeAnalysis.analyzeFile',
                callback: async (filePath: string) => {
                    console.log(`PROJECT_STRUCTURE_COMMANDS: Analyze file command TRIGGERED for: ${filePath}`);
                    await commands.analyzeFile(filePath);
                    refreshCallback();
                },
                description: 'Analyze a file using the configured analysis mode'
            },
            {
                commandId: 'newCodeAnalysis.analyzeDirectory',
                callback: async (directoryPath: string) => {
                    console.log(`PROJECT_STRUCTURE_COMMANDS: Analyze directory command TRIGGERED for: ${directoryPath}`);
                    await commands.analyzeDirectory(directoryPath);
                    refreshCallback();
                },
                description: 'Analyze a directory using the configured analysis mode'
            }
        ];

        console.log(`NEW_CODE_ANALYSIS: Collected ${commandRegistrations.length} Project Structure command registrations`);
        return commandRegistrations;
    }

    /**
     * Analyze a file using the configured file analysis mode
     */
    private async analyzeFile(filePath: string): Promise<void> {
        console.log(`PROJECT_STRUCTURE_COMMANDS: Analyzing file: ${filePath}`);
        
        try {
            const storage = AnalysisConfigurationStorage.getInstance(this.context);
            const fileMode = await storage.getAnalysisFileMode();
            
            console.log(`PROJECT_STRUCTURE_COMMANDS: Using file analysis mode: ${fileMode}`);
            
            // Determine which command to execute based on configuration
            let commandToExecute: string;
            
            switch (fileMode) {
                case 'XR':
                    commandToExecute = 'newCodeAnalysis.analyzeFileXR';
                    break;
                case 'LivePanel':
                    commandToExecute = 'newCodeAnalysis.analyzeFileLivePanel';
                    break;
                default:
                    commandToExecute = 'newCodeAnalysis.analyzeFileXR'; // Default fallback
                    break;
            }
            
            console.log(`PROJECT_STRUCTURE_COMMANDS: Executing command: ${commandToExecute}`);
            
            // Execute the appropriate analysis command
            await vscode.commands.executeCommand(commandToExecute, filePath);
            
            vscode.window.showInformationMessage(`Started ${fileMode} analysis for file: ${filePath.split('/').pop()}`);
            
        } catch (error) {
            console.error('PROJECT_STRUCTURE_COMMANDS: Error analyzing file:', error);
            vscode.window.showErrorMessage(`Failed to analyze file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Analyze a directory using the configured directory analysis mode
     */
    private async analyzeDirectory(directoryPath: string): Promise<void> {
        console.log(`PROJECT_STRUCTURE_COMMANDS: Analyzing directory: ${directoryPath}`);
        
        try {
            const storage = AnalysisConfigurationStorage.getInstance(this.context);
            const directoryMode = await storage.getAnalysisDirectoryMode();
            
            console.log(`PROJECT_STRUCTURE_COMMANDS: Using directory analysis mode: ${directoryMode}`);
            
            // Determine which command to execute based on configuration
            let commandToExecute: string;
            
            switch (directoryMode) {
                case 'XR':
                    commandToExecute = 'newCodeAnalysis.analyzeDirectoryXR';
                    break;
                case 'XRDeep':
                    commandToExecute = 'newCodeAnalysis.analyzeDirectoryXRDeep';
                    break;
                case 'LivePanel':
                    commandToExecute = 'newCodeAnalysis.analyzeDirectoryLivePanel';
                    break;
                case 'LivePanelDeep':
                    commandToExecute = 'newCodeAnalysis.analyzeDirectoryLivePanelDeep';
                    break;
                default:
                    commandToExecute = 'newCodeAnalysis.analyzeDirectoryXR'; // Default fallback
                    break;
            }
            
            console.log(`PROJECT_STRUCTURE_COMMANDS: Executing command: ${commandToExecute}`);
            
            // Execute the appropriate analysis command
            await vscode.commands.executeCommand(commandToExecute, directoryPath);
            
            vscode.window.showInformationMessage(`Started ${directoryMode} analysis for directory: ${directoryPath.split('/').pop()}`);
            
        } catch (error) {
            console.error('PROJECT_STRUCTURE_COMMANDS: Error analyzing directory:', error);
            vscode.window.showErrorMessage(`Failed to analyze directory: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
