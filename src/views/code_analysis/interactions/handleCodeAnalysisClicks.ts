import * as vscode from 'vscode';
import { CodeAnalysisModularTreeItem } from '../items/codeAnalysisItems';

/**
 * Handler for Code Analysis section interactions
 */
export class CodeAnalysisClickHandler {
    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Handle clicks on code analysis items
     */
    async handleCodeAnalysisClick(item: CodeAnalysisModularTreeItem): Promise<void> {
        console.log(`CODE_ANALYSIS_MODULAR: Handling click on code analysis item: ${item.label} (type: ${item.codeAnalysisItemType})`);

        // For most code analysis items, the command is already attached to the tree item
        // and will be executed automatically by VS Code
        switch (item.codeAnalysisItemType) {
            case 'section':
                console.log('CODE_ANALYSIS_MODULAR: Section item clicked');
                // Section items are typically collapsible, no direct action needed
                break;
                
            case 'subsection':
                console.log('CODE_ANALYSIS_MODULAR: Subsection item clicked');
                // Subsection items may have commands or be collapsible
                break;
                
            case 'language-group':
                console.log('CODE_ANALYSIS_MODULAR: Language group clicked');
                // Language groups are typically collapsible to show files
                break;
                
            case 'file-item':
                console.log('CODE_ANALYSIS_MODULAR: File item clicked');
                // File items typically open the file for editing
                await this.handleFileItemClick(item);
                break;
                
            case 'scanning':
                console.log('CODE_ANALYSIS_MODULAR: Scanning item clicked - no action');
                break;
                
            case 'error':
                console.log('CODE_ANALYSIS_MODULAR: Error item clicked - no action');
                break;
                
            default:
                console.warn(`CODE_ANALYSIS_MODULAR: Unknown code analysis item type: ${item.codeAnalysisItemType}`);
        }
    }

    /**
     * Handle click on file item
     */
    private async handleFileItemClick(item: CodeAnalysisModularTreeItem): Promise<void> {
        // If the item has a command, let VS Code handle it
        if (item.command) {
            console.log(`CODE_ANALYSIS_MODULAR: File item has command: ${item.command.command}`);
            return; // VS Code will execute the command automatically
        }

        // If no command but we have the original item with file info, try to open the file
        if (item.originalCodeAnalysisItem?.fileInfo) {
            const fileInfo = item.originalCodeAnalysisItem.fileInfo;
            console.log(`CODE_ANALYSIS_MODULAR: Opening file: ${fileInfo.relativePath}`);
            
            try {
                const document = await vscode.workspace.openTextDocument(fileInfo.fullPath);
                await vscode.window.showTextDocument(document);
            } catch (error) {
                console.error(`CODE_ANALYSIS_MODULAR: Error opening file ${fileInfo.relativePath}:`, error);
                vscode.window.showErrorMessage(`Failed to open file: ${fileInfo.relativePath}`);
            }
        }
    }

    /**
     * Handle right-click context menu actions
     */
    async handleContextMenuAction(action: string, item: CodeAnalysisModularTreeItem): Promise<void> {
        console.log(`CODE_ANALYSIS_MODULAR: Handling context menu action: ${action} on item: ${item.label}`);

        switch (action) {
            case 'refresh':
                console.log('CODE_ANALYSIS_MODULAR: Refreshing code analysis view');
                // Refresh will be triggered by the provider
                break;
                
            case 'openFile':
                if (item.codeAnalysisItemType === 'file-item') {
                    await this.handleFileItemClick(item);
                }
                break;
                
            case 'analyzeFile':
                await this.handleAnalyzeFile(item);
                break;
                
            case 'showInExplorer':
                await this.handleShowInExplorer(item);
                break;
                
            case 'copyPath':
                await this.handleCopyPath(item);
                break;
                
            case 'scanFiles':
                await this.handleScanFiles();
                break;
                
            default:
                console.warn(`CODE_ANALYSIS_MODULAR: Unknown context menu action: ${action}`);
        }
    }

    /**
     * Handle analyze file action
     */
    private async handleAnalyzeFile(item: CodeAnalysisModularTreeItem): Promise<void> {
        console.log(`CODE_ANALYSIS_MODULAR: Analyzing file: ${item.label}`);
        
        if (item.originalCodeAnalysisItem?.fileInfo) {
            const fileInfo = item.originalCodeAnalysisItem.fileInfo;
            
            // Execute file analysis command if available
            try {
                await vscode.commands.executeCommand('codeXR.codeAnalysis.analyzeFile', fileInfo.fullPath);
            } catch (error) {
                console.error(`CODE_ANALYSIS_MODULAR: Error analyzing file:`, error);
                vscode.window.showErrorMessage(`Failed to analyze file: ${fileInfo.relativePath}`);
            }
        } else {
            vscode.window.showWarningMessage('Cannot analyze: file information not available');
        }
    }

    /**
     * Handle show in explorer action
     */
    private async handleShowInExplorer(item: CodeAnalysisModularTreeItem): Promise<void> {
        console.log(`CODE_ANALYSIS_MODULAR: Showing in explorer: ${item.label}`);
        
        if (item.originalCodeAnalysisItem?.fileInfo) {
            const fileInfo = item.originalCodeAnalysisItem.fileInfo;
            
            try {
                await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(fileInfo.fullPath));
            } catch (error) {
                console.error(`CODE_ANALYSIS_MODULAR: Error showing in explorer:`, error);
                vscode.window.showErrorMessage(`Failed to show in explorer: ${fileInfo.relativePath}`);
            }
        } else {
            vscode.window.showWarningMessage('Cannot show in explorer: file information not available');
        }
    }

    /**
     * Handle copy path action
     */
    private async handleCopyPath(item: CodeAnalysisModularTreeItem): Promise<void> {
        console.log(`CODE_ANALYSIS_MODULAR: Copying path: ${item.label}`);
        
        if (item.originalCodeAnalysisItem?.fileInfo) {
            const fileInfo = item.originalCodeAnalysisItem.fileInfo;
            
            try {
                await vscode.env.clipboard.writeText(fileInfo.fullPath);
                vscode.window.showInformationMessage(`Copied path: ${fileInfo.relativePath}`);
            } catch (error) {
                console.error(`CODE_ANALYSIS_MODULAR: Error copying path:`, error);
                vscode.window.showErrorMessage(`Failed to copy path: ${fileInfo.relativePath}`);
            }
        } else {
            vscode.window.showWarningMessage('Cannot copy path: file information not available');
        }
    }

    /**
     * Handle scan files action
     */
    private async handleScanFiles(): Promise<void> {
        console.log('CODE_ANALYSIS_MODULAR: Triggering file scan');
        
        try {
            await vscode.commands.executeCommand('codeXR.codeAnalysis.scanFiles');
            vscode.window.showInformationMessage('File scanning initiated');
        } catch (error) {
            console.error('CODE_ANALYSIS_MODULAR: Error triggering file scan:', error);
            vscode.window.showErrorMessage('Failed to initiate file scanning');
        }
    }
}
