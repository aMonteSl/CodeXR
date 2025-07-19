import * as vscode from 'vscode';

/**
 * Panel Manager Service
 * Manages WebviewPanel instances for servers launched in lateral panel mode
 */
export class PanelManager {
    private static instance: PanelManager;
    private panels: Map<string, vscode.WebviewPanel> = new Map();

    private constructor() {
        console.log('ACTIVE_SERVER_PANEL: Panel manager initialized');
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): PanelManager {
        if (!PanelManager.instance) {
            PanelManager.instance = new PanelManager();
        }
        return PanelManager.instance;
    }

    /**
     * Register a panel for a server
     * @param serverId - Server ID
     * @param panel - WebviewPanel instance
     */
    public registerPanel(serverId: string, panel: vscode.WebviewPanel): void {
        console.log(`ACTIVE_SERVER_PANEL: Registering panel for server ${serverId}`);
        
        // Remove any existing panel for this server first
        this.removePanel(serverId);
        
        // Register the new panel
        this.panels.set(serverId, panel);
        
        // Set up disposal listener to auto-cleanup
        panel.onDidDispose(() => {
            console.log(`ACTIVE_SERVER_PANEL: Panel for server ${serverId} was disposed by user`);
            this.panels.delete(serverId);
        });
        
        console.log(`ACTIVE_SERVER_PANEL: Panel registered for server ${serverId}, total panels: ${this.panels.size}`);
    }

    /**
     * Remove and dispose a panel for a server
     * @param serverId - Server ID
     * @returns true if panel was found and disposed, false otherwise
     */
    public removePanel(serverId: string): boolean {
        const panel = this.panels.get(serverId);
        if (panel) {
            console.log(`ACTIVE_SERVER_PANEL: Disposing panel for server ${serverId}`);
            try {
                panel.dispose();
                this.panels.delete(serverId);
                console.log(`ACTIVE_SERVER_PANEL: Panel for server ${serverId} disposed successfully`);
                return true;
            } catch (error) {
                console.warn(`ACTIVE_SERVER_PANEL: Error disposing panel for server ${serverId}:`, error);
                // Still remove from map even if disposal failed
                this.panels.delete(serverId);
                return false;
            }
        }
        return false;
    }

    /**
     * Remove and dispose all panels
     * @returns number of panels that were disposed
     */
    public removeAllPanels(): number {
        console.log(`ACTIVE_SERVER_PANEL: Disposing all ${this.panels.size} panels`);
        
        let disposedCount = 0;
        const panelEntries = Array.from(this.panels.entries());
        
        for (const [serverId, panel] of panelEntries) {
            try {
                console.log(`ACTIVE_SERVER_PANEL: Disposing panel for server ${serverId}`);
                panel.dispose();
                this.panels.delete(serverId);
                disposedCount++;
            } catch (error) {
                console.warn(`ACTIVE_SERVER_PANEL: Error disposing panel for server ${serverId}:`, error);
                // Still remove from map even if disposal failed
                this.panels.delete(serverId);
            }
        }
        
        console.log(`ACTIVE_SERVER_PANEL: Disposed ${disposedCount}/${panelEntries.length} panels`);
        return disposedCount;
    }

    /**
     * Get panel for a server (if exists)
     * @param serverId - Server ID
     * @returns WebviewPanel or undefined
     */
    public getPanel(serverId: string): vscode.WebviewPanel | undefined {
        return this.panels.get(serverId);
    }

    /**
     * Check if a server has an associated panel
     * @param serverId - Server ID
     * @returns true if panel exists
     */
    public hasPanel(serverId: string): boolean {
        return this.panels.has(serverId);
    }

    /**
     * Get number of currently managed panels
     * @returns number of active panels
     */
    public getPanelCount(): number {
        return this.panels.size;
    }

    /**
     * Get all server IDs that have panels
     * @returns array of server IDs
     */
    public getServerIdsWithPanels(): string[] {
        return Array.from(this.panels.keys());
    }

    /**
     * Remove panels for multiple servers
     * @param serverIds - Array of server IDs
     * @returns number of panels that were disposed
     */
    public removePanelsForServers(serverIds: string[]): number {
        console.log(`ACTIVE_SERVER_PANEL: Disposing panels for ${serverIds.length} servers`);
        
        let disposedCount = 0;
        
        for (const serverId of serverIds) {
            if (this.removePanel(serverId)) {
                disposedCount++;
            }
        }
        
        console.log(`ACTIVE_SERVER_PANEL: Disposed ${disposedCount}/${serverIds.length} requested panels`);
        return disposedCount;
    }

    /**
     * Get debug information about current panels
     * @returns debug information
     */
    public getDebugInfo(): { serverCount: number; serverIds: string[] } {
        return {
            serverCount: this.panels.size,
            serverIds: Array.from(this.panels.keys())
        };
    }
}

/**
 * Get global panel manager instance
 */
export function getPanelManager(): PanelManager {
    return PanelManager.getInstance();
}
