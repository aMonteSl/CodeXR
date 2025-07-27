/**
 * Project Structure Commands
 * Commands for analyzing files and directories from project structure
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { CommandRegistration } from '../analysis_settings/analysis_file_mode';
import { AnalysisConfigurationStorage } from '../../../configuration/analysisConfigurationStorage';
import { AnalysisOrchestrator } from '../../../new_engine/analysisOrchestrator';
import { getLanguageByExtension } from '../../../../utils/supportedLanguages';

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
                commandId: 'newCodeAnalysis.projectStructure.analyzeFile',
                callback: async (filePath: string) => {
                    console.log(`PROJECT_STRUCTURE_COMMANDS: Analyze file command TRIGGERED for: ${filePath}`);
                    console.log(`PROJECT_STRUCTURE_COMMANDS: Callback argument type: ${typeof filePath}`);
                    console.log(`PROJECT_STRUCTURE_COMMANDS: Callback argument value: "${filePath}"`);
                    await commands.analyzeFile(filePath);
                    refreshCallback();
                },
                description: 'Analyze a file using the configured analysis mode from Project Structure'
            },
            {
                commandId: 'newCodeAnalysis.projectStructure.analyzeDirectory',
                callback: async (directoryPath: string) => {
                    console.log(`PROJECT_STRUCTURE_COMMANDS: Analyze directory command TRIGGERED for: ${directoryPath}`);
                    console.log(`PROJECT_STRUCTURE_COMMANDS: Callback argument type: ${typeof directoryPath}`);
                    console.log(`PROJECT_STRUCTURE_COMMANDS: Callback argument value: "${directoryPath}"`);
                    await commands.analyzeDirectory(directoryPath);
                    refreshCallback();
                },
                description: 'Analyze a directory using the configured analysis mode from Project Structure'
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
        console.log(`PROJECT_STRUCTURE_COMMANDS: FilePath type: ${typeof filePath}`);
        console.log(`PROJECT_STRUCTURE_COMMANDS: FilePath value: "${filePath}"`);
        
        try {
            // Validate input
            if (!filePath || typeof filePath !== 'string') {
                console.error('PROJECT_STRUCTURE_COMMANDS: Invalid filePath received:', filePath);
                vscode.window.showErrorMessage('Invalid file path received');
                return;
            }

            const storage = AnalysisConfigurationStorage.getInstance(this.context);
            const analysisMode = await storage.getAnalysisMode();
            
            console.log(`PROJECT_STRUCTURE_COMMANDS: Using analysis mode: ${analysisMode}`);
            
            // Get file extension and language
            const ext = path.extname(filePath).toLowerCase();
            const languageConfig = getLanguageByExtension(ext);
            const languageName = languageConfig?.name || 'Unknown';
            
            console.log(`PROJECT_STRUCTURE_COMMANDS: Running analysis for ${filePath} (${languageName}) in ${analysisMode} mode`);

            // Determine which analysis to run based on file type and configuration
            if (languageName === 'HTML') {
                // HTML files always use DOM Visualization using NEW ENGINE
                console.log('PROJECT_STRUCTURE_COMMANDS: Running DOM Visualization for HTML file using NEW ENGINE');
                await AnalysisOrchestrator.orchestrateAnalysis(
                    filePath,
                    'VisualizeDOM',
                    'file',
                    this.context,
                    false
                );
            } else {
                // For other files, use the configured analysis mode with NEW ENGINE
                if (analysisMode === 'XR') {
                    console.log('PROJECT_STRUCTURE_COMMANDS: Running XR Analysis using NEW ENGINE');
                    await AnalysisOrchestrator.orchestrateAnalysis(
                        filePath,
                        'XR',
                        'file',
                        this.context,
                        false
                    );
                } else if (analysisMode === 'LivePanel') {
                    console.log('PROJECT_STRUCTURE_COMMANDS: Running LivePanel Analysis using NEW ENGINE');
                    await AnalysisOrchestrator.orchestrateAnalysis(
                        filePath,
                        'LivePanel',
                        'file',
                        this.context,
                        false
                    );
                } else {
                    vscode.window.showWarningMessage(`Unknown analysis mode: ${analysisMode}`);
                }
            }
            
            vscode.window.showInformationMessage(`Started ${analysisMode} analysis for file: ${path.basename(filePath)}`);
            
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
        console.log(`PROJECT_STRUCTURE_COMMANDS: DirectoryPath type: ${typeof directoryPath}`);
        console.log(`PROJECT_STRUCTURE_COMMANDS: DirectoryPath value: "${directoryPath}"`);
        
        try {
            // Validate input
            if (!directoryPath || typeof directoryPath !== 'string') {
                console.error('PROJECT_STRUCTURE_COMMANDS: Invalid directoryPath received:', directoryPath);
                vscode.window.showErrorMessage('Invalid directory path received');
                return;
            }

            const storage = AnalysisConfigurationStorage.getInstance(this.context);
            const directoryAnalysisMode = await storage.getAnalysisDirectoryMode();
            
            console.log(`PROJECT_STRUCTURE_COMMANDS: Using directory analysis mode: ${directoryAnalysisMode}`);
            
            // Map directory analysis mode to AnalysisOrchestrator parameters
            let analysisMode: 'XR' | 'LivePanel';
            let isDeep: boolean;
            
            switch (directoryAnalysisMode) {
                case 'XR':
                    analysisMode = 'XR';
                    isDeep = false;
                    break;
                case 'XRDeep':
                    analysisMode = 'XR';
                    isDeep = true;
                    break;
                case 'LivePanel':
                    analysisMode = 'LivePanel';
                    isDeep = false;
                    break;
                case 'LivePanelDeep':
                    analysisMode = 'LivePanel';
                    isDeep = true;
                    break;
                default:
                    vscode.window.showWarningMessage(`Unknown directory analysis mode: ${directoryAnalysisMode}`);
                    return;
            }
            
            console.log(`PROJECT_STRUCTURE_COMMANDS: Running ${analysisMode} Directory Analysis (Deep: ${isDeep}) using NEW ENGINE`);
            await AnalysisOrchestrator.orchestrateAnalysis(
                directoryPath,
                analysisMode,
                'directory',
                this.context,
                isDeep
            );
            
            vscode.window.showInformationMessage(`Started ${directoryAnalysisMode} analysis for directory: ${path.basename(directoryPath)}`);
            
        } catch (error) {
            console.error('PROJECT_STRUCTURE_COMMANDS: Error analyzing directory:', error);
            vscode.window.showErrorMessage(`Failed to analyze directory: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
