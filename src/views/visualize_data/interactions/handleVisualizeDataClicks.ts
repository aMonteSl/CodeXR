import * as vscode from 'vscode';
import { VisualizeDataModularTreeItem } from '../items/visualizeDataItems';

/**
 * Handler for Visualize Data section interactions
 */
export class VisualizeDataClickHandler {
    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Handle clicks on visualize data items
     */
    async handleVisualizeDataClick(item: VisualizeDataModularTreeItem): Promise<void> {
        console.log(`VISUALIZE_DATA_MODULAR: Handling click on visualize data item: ${item.label} (type: ${item.visualizeDataItemType})`);

        // For most visualize data items, the command is already attached to the tree item
        // and will be executed automatically by VS Code
        switch (item.visualizeDataItemType) {
            case 'chart-type':
                console.log('VISUALIZE_DATA_MODULAR: Chart type selection clicked');
                // Command: 'codeXR.visualizeData.chartType' is already attached
                break;
                
            case 'select-json':
                console.log('VISUALIZE_DATA_MODULAR: Select JSON file clicked');
                // Command: 'codeXR.visualizeData.selectJson' is already attached
                break;
                
            case 'dimension-mapping':
                console.log('VISUALIZE_DATA_MODULAR: Dimension mapping clicked');
                // This is a collapsible item, no direct action needed
                break;
                
            case 'dimension-item':
                console.log('VISUALIZE_DATA_MODULAR: Dimension item clicked');
                // Command varies per dimension item and is already attached
                break;
                
            case 'launch-visualization':
                console.log('VISUALIZE_DATA_MODULAR: Launch visualization clicked');
                // Command: 'codeXR.visualizeData.launchVisualization' is already attached
                break;
                
            case 'browse-visualizations':
                console.log('VISUALIZE_DATA_MODULAR: Browse visualizations clicked');
                // This is a collapsible item, no direct action needed
                break;
                
            case 'stored-visualization':
                console.log('VISUALIZE_DATA_MODULAR: Stored visualization clicked');
                // Command varies per stored visualization and is already attached
                break;
                
            case 'error':
                console.log('VISUALIZE_DATA_MODULAR: Error item clicked - no action');
                break;
                
            default:
                console.warn(`VISUALIZE_DATA_MODULAR: Unknown visualize data item type: ${item.visualizeDataItemType}`);
        }
    }

    /**
     * Handle right-click context menu actions
     */
    async handleContextMenuAction(action: string, item: VisualizeDataModularTreeItem): Promise<void> {
        console.log(`VISUALIZE_DATA_MODULAR: Handling context menu action: ${action} on item: ${item.label}`);

        switch (action) {
            case 'refresh':
                console.log('VISUALIZE_DATA_MODULAR: Refreshing visualize data view');
                // Refresh will be triggered by the provider
                break;
                
            case 'reset':
                await this.handleResetAction(item);
                break;
                
            case 'configure':
                await this.handleConfigureAction(item);
                break;
                
            case 'launch':
                await this.handleLaunchAction(item);
                break;
                
            case 'details':
                await this.handleShowDetails(item);
                break;
                
            default:
                console.warn(`VISUALIZE_DATA_MODULAR: Unknown context menu action: ${action}`);
        }
    }

    /**
     * Handle reset action
     */
    private async handleResetAction(item: VisualizeDataModularTreeItem): Promise<void> {
        console.log(`VISUALIZE_DATA_MODULAR: Handling reset action for: ${item.label}`);
        
        switch (item.visualizeDataItemType) {
            case 'chart-type':
                // Reset chart type selection
                await vscode.commands.executeCommand('codeXR.visualizeData.resetChartType');
                break;
                
            case 'select-json':
                // Reset JSON file selection
                await vscode.commands.executeCommand('codeXR.visualizeData.resetJsonFile');
                break;
                
            case 'dimension-mapping':
                // Reset all dimension mappings
                await vscode.commands.executeCommand('codeXR.visualizeData.resetDimensions');
                break;
                
            default:
                vscode.window.showInformationMessage(`Reset not available for ${item.label}`);
        }
    }

    /**
     * Handle configure action
     */
    private async handleConfigureAction(item: VisualizeDataModularTreeItem): Promise<void> {
        console.log(`VISUALIZE_DATA_MODULAR: Handling configure action for: ${item.label}`);
        
        switch (item.visualizeDataItemType) {
            case 'chart-type':
                await vscode.commands.executeCommand('codeXR.visualizeData.chartType');
                break;
                
            case 'select-json':
                await vscode.commands.executeCommand('codeXR.visualizeData.selectJson');
                break;
                
            case 'dimension-item':
                // Execute the dimension item's command if available
                if (item.command) {
                    await vscode.commands.executeCommand(item.command.command, ...(item.command.arguments || []));
                }
                break;
                
            default:
                vscode.window.showInformationMessage(`Configuration not available for ${item.label}`);
        }
    }

    /**
     * Handle launch action
     */
    private async handleLaunchAction(item: VisualizeDataModularTreeItem): Promise<void> {
        console.log(`VISUALIZE_DATA_MODULAR: Handling launch action for: ${item.label}`);
        
        if (item.visualizeDataItemType === 'stored-visualization' && item.command) {
            // Launch stored visualization
            await vscode.commands.executeCommand(item.command.command, ...(item.command.arguments || []));
        } else {
            // Launch current visualization configuration
            await vscode.commands.executeCommand('codeXR.visualizeData.launchVisualization');
        }
    }

    /**
     * Show details about the item
     */
    private async handleShowDetails(item: VisualizeDataModularTreeItem): Promise<void> {
        console.log(`VISUALIZE_DATA_MODULAR: Showing details for: ${item.label}`);
        
        let details = `Visualize Data Item Details:

Name: ${item.label}
Type: ${item.visualizeDataItemType}
Description: ${item.description || 'No description available'}
Tooltip: ${item.tooltip || 'No tooltip available'}`;

        if (item.command) {
            details += `\nCommand: ${item.command.command}`;
        }

        if (item.contextValue) {
            details += `\nContext: ${item.contextValue}`;
        }

        vscode.window.showInformationMessage(details, { modal: true });
    }
}
