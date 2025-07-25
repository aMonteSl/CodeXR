/**
 * Directory Analysis XR Commands
 * Commands for analyzing directories in XR mode
 */

import * as vscode from 'vscode';
import { LaunchAnalyzeDirectoryXR } from '../../engine';

export class DirectoryAnalysisXRCommands {

    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Register directory analysis XR commands
     */
    static registerCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
        console.log('DIRECTORY_ANALYSIS_XR_COMMANDS: Registering XR analysis commands...');
        
        const commands = new DirectoryAnalysisXRCommands(context);
        
        const analyzeDirectoryXRCommand = vscode.commands.registerCommand(
            'newCodeAnalysis.analyzeDirectoryXR',
            (uri?: vscode.Uri) => commands.analyzeDirectoryXR(uri)
        );

        const analyzeDirectoryXRDeepCommand = vscode.commands.registerCommand(
            'newCodeAnalysis.analyzeDirectoryXRDeep',
            (uri?: vscode.Uri) => commands.analyzeDirectoryXRDeep(uri)
        );

        const analyzeProjectXRCommand = vscode.commands.registerCommand(
            'newCodeAnalysis.analyzeProjectXR',
            () => commands.analyzeProjectXR()
        );

        const analyzeProjectXRDeepCommand = vscode.commands.registerCommand(
            'newCodeAnalysis.analyzeProjectXRDeep',
            () => commands.analyzeProjectXRDeep()
        );

        console.log('DIRECTORY_ANALYSIS_XR_COMMANDS: XR commands registered successfully');
        return [analyzeDirectoryXRCommand, analyzeDirectoryXRDeepCommand, analyzeProjectXRCommand, analyzeProjectXRDeepCommand];
    }

    /**
     * Analyze directory in XR mode command handler
     */
    private async analyzeDirectoryXR(uri?: vscode.Uri): Promise<void> {
        try {
            let directoryPath: string;

            if (uri) {
                // Called from context menu or command palette with URI
                if (uri.scheme === 'file') {
                    const stat = await vscode.workspace.fs.stat(uri);
                    if (stat.type === vscode.FileType.Directory) {
                        directoryPath = uri.fsPath;
                        console.log(`DIRECTORY_ANALYSIS_XR_COMMANDS: XR analysis requested from context menu for directory: ${directoryPath}`);
                    } else {
                        // If it's a file, use its parent directory
                        directoryPath = vscode.Uri.file(uri.fsPath).with({ path: uri.path.substring(0, uri.path.lastIndexOf('/')) }).fsPath;
                        console.log(`DIRECTORY_ANALYSIS_XR_COMMANDS: XR analysis requested from file context, using parent directory: ${directoryPath}`);
                    }
                } else {
                    vscode.window.showErrorMessage('Invalid file path for directory analysis');
                    return;
                }
            } else {
                // Called from command palette without URI - ask user to select directory
                const folderUris = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: 'Select Directory to Analyze (XR)'
                });

                if (!folderUris || folderUris.length === 0) {
                    console.log('DIRECTORY_ANALYSIS_XR_COMMANDS: User cancelled directory selection');
                    return;
                }

                directoryPath = folderUris[0].fsPath;
                console.log(`DIRECTORY_ANALYSIS_XR_COMMANDS: XR analysis requested from dialog for directory: ${directoryPath}`);
            }

            // Use the XR directory analysis engine (unified progress tracking handles the progress bar)
            try {
                const launcher = LaunchAnalyzeDirectoryXR.getInstance();
                await launcher.launch(directoryPath, this.context, false);
                
            } catch (error) {
                console.error('DIRECTORY_ANALYSIS_XR_COMMANDS: Directory XR analysis failed:', error);
                vscode.window.showErrorMessage(
                    `Directory XR analysis failed: ${error instanceof Error ? error.message : String(error)}`
                );
            }
            
        } catch (error) {
            console.error('DIRECTORY_ANALYSIS_XR_COMMANDS: Error in analyzeDirectoryXR:', error);
            vscode.window.showErrorMessage(
                `Failed to start directory XR analysis: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Analyze directory in XR Deep mode
     */
    async analyzeDirectoryXRDeep(uri?: vscode.Uri): Promise<void> {
        console.log('DIRECTORY_ANALYSIS_XR_COMMANDS: Starting XR Deep directory analysis command...');
        
        try {
            let directoryPath: string;

            if (uri) {
                // Called from context menu or command palette with URI
                if (uri.scheme === 'file') {
                    const stat = await vscode.workspace.fs.stat(uri);
                    if (stat.type === vscode.FileType.Directory) {
                        directoryPath = uri.fsPath;
                        console.log(`DIRECTORY_ANALYSIS_XR_COMMANDS: XR Deep analysis requested from context menu for directory: ${directoryPath}`);
                    } else {
                        // If it's a file, use its parent directory
                        directoryPath = vscode.Uri.file(uri.fsPath).with({ path: uri.path.substring(0, uri.path.lastIndexOf('/')) }).fsPath;
                        console.log(`DIRECTORY_ANALYSIS_XR_COMMANDS: XR Deep analysis requested from file context, using parent directory: ${directoryPath}`);
                    }
                } else {
                    vscode.window.showErrorMessage('Invalid file path for directory XR Deep analysis');
                    return;
                }
            } else {
                // Called from command palette without URI, prompt for directory selection
                const folderUris = await vscode.window.showOpenDialog({
                    canSelectFolders: true,
                    canSelectFiles: false,
                    canSelectMany: false,
                    openLabel: 'Select Directory for XR Deep Analysis'
                });

                if (!folderUris || folderUris.length === 0) {
                    console.log('DIRECTORY_ANALYSIS_XR_COMMANDS: XR Deep analysis cancelled by user');
                    return;
                }

                directoryPath = folderUris[0].fsPath;
                console.log(`DIRECTORY_ANALYSIS_XR_COMMANDS: XR Deep analysis requested from command palette for directory: ${directoryPath}`);
            }

            console.log(`DIRECTORY_ANALYSIS_XR_COMMANDS: XR Deep analysis for directory: ${directoryPath}`);

            // Use the XR Deep directory analysis engine (unified progress tracking handles the progress bar)
            try {
                const launcher = LaunchAnalyzeDirectoryXR.getInstance();
                await launcher.launchDeep(directoryPath, this.context);
                
            } catch (error) {
                console.error('DIRECTORY_ANALYSIS_XR_COMMANDS: Directory XR Deep analysis failed:', error);
                vscode.window.showErrorMessage(
                    `Directory XR Deep analysis failed: ${error instanceof Error ? error.message : String(error)}`
                );
            }
            
        } catch (error) {
            console.error('DIRECTORY_ANALYSIS_XR_COMMANDS: Error in analyzeDirectoryXRDeep:', error);
            vscode.window.showErrorMessage(
                `Failed to start directory XR Deep analysis: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Analyze project in XR mode command handler
     */
    private async analyzeProjectXR(): Promise<void> {
        try {
            console.log('DIRECTORY_ANALYSIS_XR_COMMANDS: Starting Project XR analysis...');

            // Get the workspace folder (project root)
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('No workspace folder found. Please open a project folder first.');
                return;
            }

            let projectPath: string;
            if (workspaceFolders.length === 1) {
                // Single workspace folder
                projectPath = workspaceFolders[0].uri.fsPath;
            } else {
                // Multiple workspace folders - let user choose
                const selectedFolder = await vscode.window.showQuickPick(
                    workspaceFolders.map(folder => ({
                        label: folder.name,
                        description: folder.uri.fsPath,
                        folder: folder
                    })),
                    { placeHolder: 'Select project to analyze (XR)' }
                );

                if (!selectedFolder) {
                    console.log('DIRECTORY_ANALYSIS_XR_COMMANDS: User cancelled project selection');
                    return;
                }

                projectPath = selectedFolder.folder.uri.fsPath;
            }

            console.log(`DIRECTORY_ANALYSIS_XR_COMMANDS: Project XR analysis for: ${projectPath}`);

            // Use directory XR launcher for project analysis (unified progress tracking handles the progress bar)
            try {
                const launcher = LaunchAnalyzeDirectoryXR.getInstance();
                await launcher.launch(projectPath, this.context, false);
                
            } catch (error) {
                console.error('DIRECTORY_ANALYSIS_XR_COMMANDS: Project XR analysis failed:', error);
                vscode.window.showErrorMessage(
                    `Project XR analysis failed: ${error instanceof Error ? error.message : String(error)}`
                );
            }

        } catch (error) {
            console.error('DIRECTORY_ANALYSIS_XR_COMMANDS: Error in analyzeProjectXR:', error);
            vscode.window.showErrorMessage(
                `Failed to start project XR analysis: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Analyze project in XR Deep mode command handler
     */
    private async analyzeProjectXRDeep(): Promise<void> {
        try {
            console.log('DIRECTORY_ANALYSIS_XR_COMMANDS: Starting Project XR Deep analysis...');

            // Get the workspace folder (project root)
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('No workspace folder found. Please open a project folder first.');
                return;
            }

            let projectPath: string;
            if (workspaceFolders.length === 1) {
                // Single workspace folder
                projectPath = workspaceFolders[0].uri.fsPath;
            } else {
                // Multiple workspace folders - let user choose
                const selectedFolder = await vscode.window.showQuickPick(
                    workspaceFolders.map(folder => ({
                        label: folder.name,
                        description: folder.uri.fsPath,
                        folder: folder
                    })),
                    { placeHolder: 'Select project to analyze (XR Deep)' }
                );

                if (!selectedFolder) {
                    console.log('DIRECTORY_ANALYSIS_XR_COMMANDS: User cancelled project selection');
                    return;
                }

                projectPath = selectedFolder.folder.uri.fsPath;
            }

            console.log(`DIRECTORY_ANALYSIS_XR_COMMANDS: Project XR Deep analysis for: ${projectPath}`);

            // Show progress notification
            // Use directory XR Deep launcher for project analysis (unified progress tracking handles the progress bar)
            try {
                const launcher = LaunchAnalyzeDirectoryXR.getInstance();
                await launcher.launchDeep(projectPath, this.context);
                
            } catch (error) {
                console.error('DIRECTORY_ANALYSIS_XR_COMMANDS: Project XR Deep analysis failed:', error);
                vscode.window.showErrorMessage(
                    `Project XR Deep analysis failed: ${error instanceof Error ? error.message : String(error)}`
                );
            }

        } catch (error) {
            console.error('DIRECTORY_ANALYSIS_XR_COMMANDS: Error in analyzeProjectXRDeep:', error);
            vscode.window.showErrorMessage(
                `Failed to start project XR Deep analysis: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}