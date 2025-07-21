/**
 * File Analysis Commands
 * Main coordinator for all file analysis commands (LivePanel and XR)
 * Russian dolls pattern: FileAnalysisCommands -> LivePanel/XR Commands
 */

import * as vscode from 'vscode';
import { FileAnalysisLivePanelCommands } from './fileAnalysisLivePanelCommands';
import { FileAnalysisXRCommands } from './fileAnalysisXRCommands';

export class FileAnalysisCommands {

    /**
     * Register all file analysis commands (coordinates LivePanel and XR)
     */
    static registerCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
        console.log('FILE_ANALYSIS_COMMANDS: Registering all file analysis commands...');
        
        const disposables: vscode.Disposable[] = [];
        
        // Register LivePanel commands
        console.log('FILE_ANALYSIS_COMMANDS: Registering LivePanel commands...');
        const livePanelCommands = FileAnalysisLivePanelCommands.registerCommands(context);
        disposables.push(...livePanelCommands);
        
        // Register XR commands  
        console.log('FILE_ANALYSIS_COMMANDS: Registering XR commands...');
        const xrCommands = FileAnalysisXRCommands.registerCommands(context);
        disposables.push(...xrCommands);
        
        console.log(`FILE_ANALYSIS_COMMANDS: Successfully registered ${disposables.length} file analysis commands`);
        return disposables;
    }
}
