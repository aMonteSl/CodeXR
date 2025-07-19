import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { launchServerWithFile } from '../../servers/runtime/index';
import { getActiveServerRegistry } from '../../active_servers/registry/activeServerRegistry';

/**
 * Interface for stored visualization metadata
 */
export interface StoredVisualization {
    /** Original visualization name */
    name: string;
    
    /** Full folder name with nonce (e.g., "ventas_abc123") */
    folderName: string;
    
    /** Full path to the visualization folder */
    folderPath: string;
    
    /** Path to index.html file */
    indexPath: string;
    
    /** Path to data.json file */
    dataPath: string;
    
    /** Whether the required files exist */
    isValid: boolean;
}

/**
 * Visualization Restorer
 * Responsible for scanning and relaunching stored visualizations
 */
export class VisualizationRestorer {
    private context: vscode.ExtensionContext;
    private visualizeDataPath: string;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.visualizeDataPath = path.join(context.globalStorageUri.fsPath, 'visualize-data');
        console.log('BROWSE-VISUALIZATIONS: Restorer initialized with path:', this.visualizeDataPath);
    }

    /**
     * Scan the visualize-data directory for stored visualizations
     */
    public async scanStoredVisualizations(): Promise<StoredVisualization[]> {
        console.log('BROWSE-VISUALIZATIONS: Scanning for stored visualizations...');
        
        const visualizations: StoredVisualization[] = [];

        try {
            // Ensure the visualize-data directory exists
            if (!fs.existsSync(this.visualizeDataPath)) {
                console.log('BROWSE-VISUALIZATIONS: visualize-data directory does not exist yet');
                return visualizations;
            }

            // Read directory contents
            const entries = await fs.promises.readdir(this.visualizeDataPath, { withFileTypes: true });
            const folders = entries.filter(entry => entry.isDirectory());

            console.log(`BROWSE-VISUALIZATIONS: Found ${folders.length} folders in visualize-data directory`);

            for (const folder of folders) {
                const folderName = folder.name;
                const folderPath = path.join(this.visualizeDataPath, folderName);
                
                // Extract name from folder name (everything before the last underscore)
                const lastUnderscoreIndex = folderName.lastIndexOf('_');
                const name = lastUnderscoreIndex > 0 ? folderName.substring(0, lastUnderscoreIndex) : folderName;
                
                // Check for required files
                const indexPath = path.join(folderPath, 'index.html');
                const dataPath = path.join(folderPath, 'data.json');
                
                const indexExists = fs.existsSync(indexPath);
                const dataExists = fs.existsSync(dataPath);
                const isValid = indexExists && dataExists;

                const visualization: StoredVisualization = {
                    name,
                    folderName,
                    folderPath,
                    indexPath,
                    dataPath,
                    isValid
                };

                visualizations.push(visualization);

                console.log(`BROWSE-VISUALIZATIONS: Found visualization "${name}" (${folderName}), valid: ${isValid}`);
                if (!isValid) {
                    console.warn(`BROWSE-VISUALIZATIONS: Invalid visualization - index.html exists: ${indexExists}, data.json exists: ${dataExists}`);
                }
            }

        } catch (error) {
            console.error('BROWSE-VISUALIZATIONS: Error scanning visualizations:', error);
            vscode.window.showErrorMessage(`Failed to scan visualizations: ${error instanceof Error ? error.message : String(error)}`);
        }

        console.log(`BROWSE-VISUALIZATIONS: Scan completed, found ${visualizations.length} visualizations`);
        return visualizations;
    }

    /**
     * Launch a stored visualization
     */
    public async launchVisualization(visualization: StoredVisualization): Promise<void> {
        console.log(`BROWSE-VISUALIZATIONS: Launching visualization "${visualization.name}"`);

        try {
            if (!visualization.isValid) {
                throw new Error(`Visualization "${visualization.name}" is missing required files`);
            }

            // Check if visualization is already running
            const activeRegistry = getActiveServerRegistry();
            const activeServers = activeRegistry.getAllServers();
            
            // Check by custom name or by path
            const alreadyActive = activeServers.some((server: any) => 
                server.customName === visualization.name || 
                server.filePath === visualization.indexPath
            );

            if (alreadyActive) {
                console.log(`BROWSE-VISUALIZATIONS: Visualization "${visualization.name}" is already active`);
                vscode.window.showInformationMessage(`Visualization "${visualization.name}" is already running`);
                return;
            }

            // Launch the visualization using the existing server launcher
            console.log(`BROWSE-VISUALIZATIONS: Launching server for visualization "${visualization.name}" with file: ${visualization.indexPath}`);
            
            await launchServerWithFile(
                this.context,
                visualization.indexPath,
                visualization.name // Use the extracted name as customName
            );

            console.log(`BROWSE-VISUALIZATIONS: Successfully launched visualization "${visualization.name}"`);
            vscode.window.showInformationMessage(`Launched visualization: ${visualization.name}`);

        } catch (error) {
            console.error(`BROWSE-VISUALIZATIONS: Error launching visualization "${visualization.name}":`, error);
            vscode.window.showErrorMessage(`Failed to launch visualization "${visualization.name}": ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Delete all stored visualizations (Reset All)
     */
    public async resetAllVisualizations(): Promise<void> {
        console.log('BROWSE-VISUALIZATIONS: Resetting all visualizations...');

        try {
            if (!fs.existsSync(this.visualizeDataPath)) {
                console.log('BROWSE-VISUALIZATIONS: No visualize-data directory to reset');
                return;
            }

            // Get list of folders to delete
            const entries = await fs.promises.readdir(this.visualizeDataPath, { withFileTypes: true });
            const folders = entries.filter(entry => entry.isDirectory());

            if (folders.length === 0) {
                console.log('BROWSE-VISUALIZATIONS: No visualizations to reset');
                vscode.window.showInformationMessage('No stored visualizations to reset');
                return;
            }

            // Confirm deletion
            const confirmResult = await vscode.window.showWarningMessage(
                `Delete all ${folders.length} stored visualizations? This action cannot be undone.`,
                { modal: true },
                'Delete All',
                'Cancel'
            );

            if (confirmResult !== 'Delete All') {
                console.log('BROWSE-VISUALIZATIONS: Reset cancelled by user');
                return;
            }

            // Delete each folder
            for (const folder of folders) {
                const folderPath = path.join(this.visualizeDataPath, folder.name);
                console.log(`BROWSE-VISUALIZATIONS: Deleting folder: ${folderPath}`);
                
                try {
                    await fs.promises.rm(folderPath, { recursive: true, force: true });
                } catch (deleteError) {
                    console.error(`BROWSE-VISUALIZATIONS: Error deleting folder ${folderPath}:`, deleteError);
                }
            }

            console.log(`BROWSE-VISUALIZATIONS: Reset completed, deleted ${folders.length} visualizations`);
            vscode.window.showInformationMessage(`Deleted ${folders.length} stored visualizations`);

            // Trigger refresh of the tree view
            vscode.commands.executeCommand('codexr.servers.refresh');

        } catch (error) {
            console.error('BROWSE-VISUALIZATIONS: Error during reset:', error);
            vscode.window.showErrorMessage(`Failed to reset visualizations: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get the visualize-data directory path
     */
    public getVisualizeDataPath(): string {
        return this.visualizeDataPath;
    }
}
