/**
 * Project Analysis Commands
 * Commands for analyzing projects from anywhere in VS Code
 */

import * as vscode from 'vscode';
import { LaunchAnalyzeDirectoryLivePanel } from '../../engine';

export class ProjectAnalysisCommands {

    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Register project analysis commands
     */
    static registerCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
        console.log('PROJECT_ANALYSIS_COMMANDS: Registering project analysis commands...');
        
        const commands = new ProjectAnalysisCommands(context);
        
        const analyzeProjectCommand = vscode.commands.registerCommand(
            'newCodeAnalysis.analyzeProject',
            () => commands.analyzeProjectLivePanel()
        );

        const analyzeProjectDeepCommand = vscode.commands.registerCommand(
            'newCodeAnalysis.analyzeProjectDeep',
            () => commands.analyzeProjectLivePanelDeep()
        );

        console.log('PROJECT_ANALYSIS_COMMANDS: Project analysis commands registered successfully');
        return [analyzeProjectCommand, analyzeProjectDeepCommand];
    }

    /**
     * Analyze current workspace/project in LivePanel mode
     */
    private async analyzeProjectLivePanel(): Promise<void> {
        try {
            console.log('PROJECT_ANALYSIS_COMMANDS: LivePanel project analysis requested');
            
            // Get the current workspace folder
            const workspaceFolders = vscode.workspace.workspaceFolders;
            
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showErrorMessage(
                    'No workspace is currently open. Please open a project folder to analyze.'
                );
                return;
            }
            
            let projectPath: string;
            
            if (workspaceFolders.length === 1) {
                // Single workspace folder - use it directly
                projectPath = workspaceFolders[0].uri.fsPath;
                console.log(`PROJECT_ANALYSIS_COMMANDS: Using single workspace folder: ${projectPath}`);
            } else {
                // Multiple workspace folders - let user choose
                const workspaceItems = workspaceFolders.map(folder => ({
                    label: folder.name,
                    description: folder.uri.fsPath,
                    folder: folder
                }));
                
                const selectedItem = await vscode.window.showQuickPick(workspaceItems, {
                    placeHolder: 'Select workspace folder to analyze',
                    canPickMany: false
                });
                
                if (!selectedItem) {
                    console.log('PROJECT_ANALYSIS_COMMANDS: User cancelled workspace selection');
                    return;
                }
                
                projectPath = selectedItem.folder.uri.fsPath;
                console.log(`PROJECT_ANALYSIS_COMMANDS: User selected workspace folder: ${projectPath}`);
            }
            
            // Show progress notification
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Analyzing Project",
                cancellable: false
            }, async (progress) => {
                progress.report({ message: "Starting project analysis..." });
                
                try {
                    // Use the existing directory analysis logic
                    await LaunchAnalyzeDirectoryLivePanel.analyzeDirectory(projectPath, this.context);
                    
                    vscode.window.showInformationMessage(
                        `Project analysis completed successfully! ✅`,
                        'View Results'
                    ).then(action => {
                        if (action === 'View Results') {
                            // The analysis will have opened the results automatically
                            console.log('PROJECT_ANALYSIS_COMMANDS: User chose to view results');
                        }
                    });
                    
                } catch (error) {
                    console.error('PROJECT_ANALYSIS_COMMANDS: Project analysis failed:', error);
                    vscode.window.showErrorMessage(
                        `Project analysis failed: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
            });
            
        } catch (error) {
            console.error('PROJECT_ANALYSIS_COMMANDS: Error in analyzeProjectLivePanel:', error);
            vscode.window.showErrorMessage(
                `Failed to start project analysis: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Analyze current workspace/project in LivePanel Deep mode
     */
    private async analyzeProjectLivePanelDeep(): Promise<void> {
        try {
            console.log('PROJECT_ANALYSIS_COMMANDS: LivePanel DEEP project analysis requested');
            
            // Get the current workspace folder
            const workspaceFolders = vscode.workspace.workspaceFolders;
            
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showErrorMessage(
                    'No workspace is currently open. Please open a project folder to analyze.'
                );
                return;
            }
            
            let projectPath: string;
            
            if (workspaceFolders.length === 1) {
                // Single workspace folder - use it directly
                projectPath = workspaceFolders[0].uri.fsPath;
                console.log(`PROJECT_ANALYSIS_COMMANDS: Using single workspace folder for DEEP analysis: ${projectPath}`);
            } else {
                // Multiple workspace folders - let user choose
                const workspaceItems = workspaceFolders.map(folder => ({
                    label: folder.name,
                    description: folder.uri.fsPath,
                    folder: folder
                }));
                
                const selectedItem = await vscode.window.showQuickPick(workspaceItems, {
                    placeHolder: 'Select workspace folder to analyze (Deep)',
                    canPickMany: false
                });
                
                if (!selectedItem) {
                    console.log('PROJECT_ANALYSIS_COMMANDS: User cancelled workspace selection for DEEP analysis');
                    return;
                }
                
                projectPath = selectedItem.folder.uri.fsPath;
                console.log(`PROJECT_ANALYSIS_COMMANDS: User selected workspace folder for DEEP analysis: ${projectPath}`);
            }
            
            // Show warning about deep analysis
            const continueDeep = await vscode.window.showWarningMessage(
                'Deep analysis will scan ALL subdirectories recursively. This may take longer for large projects. Continue?',
                'Continue',
                'Cancel'
            );
            
            if (continueDeep !== 'Continue') {
                console.log('PROJECT_ANALYSIS_COMMANDS: User cancelled deep analysis warning');
                return;
            }
            
            // Show progress notification
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Analyzing Project (Deep)",
                cancellable: false
            }, async (progress) => {
                progress.report({ message: "Starting deep project analysis (all subdirectories)..." });
                
                try {
                    // Use the existing directory deep analysis logic
                    await LaunchAnalyzeDirectoryLivePanel.analyzeDirectoryDeep(projectPath, this.context);
                    
                    vscode.window.showInformationMessage(
                        `Deep project analysis completed successfully! 🎯`,
                        'View Results'
                    ).then(action => {
                        if (action === 'View Results') {
                            // The analysis will have opened the results automatically
                            console.log('PROJECT_ANALYSIS_COMMANDS: User chose to view deep analysis results');
                        }
                    });
                    
                } catch (error) {
                    console.error('PROJECT_ANALYSIS_COMMANDS: Deep project analysis failed:', error);
                    vscode.window.showErrorMessage(
                        `Deep project analysis failed: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
            });
            
        } catch (error) {
            console.error('PROJECT_ANALYSIS_COMMANDS: Error in analyzeProjectLivePanelDeep:', error);
            vscode.window.showErrorMessage(
                `Failed to start deep project analysis: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}
