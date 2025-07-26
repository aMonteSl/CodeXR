/**
 * File Analysis XR Commands
 * Commands for analyzing individual files in XR mode
 * NOW REDIRECTED TO NEW ENGINE
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { getLanguageForFile } from '../../../utils/languageMetadata';
import { AnalysisOrchestrator } from '../../new_engine/analysisOrchestrator';

export class FileAnalysisXRCommands {

    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Register XR file analysis commands
     */
    static registerCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
        console.log('FILE_ANALYSIS_XR_COMMANDS: 🔗 Registering XR analysis commands (redirected to new engine)...');
        
        const commands = new FileAnalysisXRCommands(context);
        
        const analyzeFileXRCommand = vscode.commands.registerCommand(
            'newCodeAnalysis.analyzeFileXR',
            (uri?: vscode.Uri) => commands.analyzeFileXR(uri)
        );

        console.log('FILE_ANALYSIS_XR_COMMANDS: ✅ XR commands registered successfully (new engine)');
        return [analyzeFileXRCommand];
    }

    /**
     * Analyze file in XR mode command handler (redirected to new engine)
     */
    private async analyzeFileXR(uri?: vscode.Uri): Promise<void> {
        console.log('FILE_ANALYSIS_XR_COMMANDS: 🥽 XR File analysis requested - redirecting to new engine...');
        
        try {
            let filePath: string;

            if (uri) {
                filePath = uri.fsPath;
                console.log(`FILE_ANALYSIS_XR_COMMANDS: 📄 Using provided URI: ${filePath}`);
            } else {
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor) {
                    vscode.window.showWarningMessage('CodeXR: No file selected for XR analysis 🥽');
                    return;
                }
                filePath = activeEditor.document.fileName;
                console.log(`FILE_ANALYSIS_XR_COMMANDS: 📄 Using active editor: ${filePath}`);
            }

            // Check if file is supported using new language detection
            const languageInfo = getLanguageForFile(filePath);
            if (!languageInfo) {
                vscode.window.showWarningMessage(
                    `CodeXR: File "${path.basename(filePath)}" - Language not supported for XR analysis 🥽`
                );
                return;
            }

            console.log(`FILE_ANALYSIS_XR_COMMANDS: ✅ File language supported: ${languageInfo.name}`);

            console.log('FILE_ANALYSIS_XR_COMMANDS: 🚀 Passing to AnalysisOrchestrator...');
            
            // Pass to new engine orchestrator with correct parameters
            await AnalysisOrchestrator.orchestrateAnalysis(
                filePath,        // targetPath
                'XR',           // analysisMode
                'file',         // targetType
                this.context,   // context
                false           // isDeep (not applicable for files)
            );

            console.log('FILE_ANALYSIS_XR_COMMANDS: ✅ XR file analysis completed through new engine');

        } catch (error) {
            console.error('FILE_ANALYSIS_XR_COMMANDS: ❌ Error in XR file analysis:', error);
            vscode.window.showErrorMessage(`CodeXR: XR analysis failed 🥽 - ${error}`);
        }
    }
}
