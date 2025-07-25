/**
 * VisualizeDOM Launcher
 * Launches DOM visualization analysis for HTML files using the new engine
 */

import * as vscode from 'vscode';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { UnifiedSessionRegistry } from '../core/sessionRegistry';

export class LauncherVisualizeDOM {
    
    /**
     * Launch VisualizeDOM analysis for HTML files
     */
    static async launchVisualizeDOMAnalysis(
        session: UnifiedAnalysisSession, 
        context: vscode.ExtensionContext
    ): Promise<void> {
        console.log(`LAUNCHER_VISUALIZE_DOM: 🌐 Starting VisualizeDOM analysis for: ${session.targetPath}`);
        console.log(`LAUNCHER_VISUALIZE_DOM: 📋 Session ID: ${session.id}`);
        
        try {
            // Update session status to analyzing
            const registry = UnifiedSessionRegistry.getInstance(context);
            registry.updateSessionStatus(session.id, 'analyzing', 10);
            
            // Show informative message that we've reached the new launcher
            vscode.window.showInformationMessage(
                `✅ VisualizeDOM Analysis Connected to New Engine! File: ${session.targetName}`,
                'View Details'
            ).then(selection => {
                if (selection === 'View Details') {
                    console.log(`LAUNCHER_VISUALIZE_DOM: 📊 Session Details:`, {
                        id: session.id,
                        targetName: session.targetName,
                        targetPath: session.targetPath,
                        analysisMode: session.analysisMode,
                        targetType: session.targetType,
                        status: session.status
                    });
                }
            });
            
            console.log(`LAUNCHER_VISUALIZE_DOM: 🔄 VisualizeDOM launcher reached successfully!`);
            console.log(`LAUNCHER_VISUALIZE_DOM: 📝 TODO: Implement the following 4 steps for ALL VisualizeDOM analyses:`);
            console.log(`LAUNCHER_VISUALIZE_DOM: 📝 Step 1: Validate HTML file and parse DOM structure`);
            console.log(`LAUNCHER_VISUALIZE_DOM: 📝 Step 2: Generate visualization templates and required files`);
            console.log(`LAUNCHER_VISUALIZE_DOM: 📝 Step 3: Launch local server for DOM visualization`);
            console.log(`LAUNCHER_VISUALIZE_DOM: 📝 Step 4: Update session status and integrate with Active Analyses UI`);
            
            // Update progress to show we're processing
            registry.updateSessionStatus(session.id, 'analyzing', 50);
            
            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Complete the session for now
            registry.updateSessionStatus(session.id, 'monitoring', 100);
            
            console.log(`LAUNCHER_VISUALIZE_DOM: ✅ VisualizeDOM analysis completed for session ${session.id}`);
            
        } catch (error) {
            console.error(`LAUNCHER_VISUALIZE_DOM: ❌ Error in VisualizeDOM analysis:`, error);
            
            // Update session status to error
            const registry = UnifiedSessionRegistry.getInstance(context);
            registry.updateSessionStatus(
                session.id, 
                'error', 
                undefined, 
                `VisualizeDOM analysis failed: ${error instanceof Error ? error.message : String(error)}`
            );
            
            vscode.window.showErrorMessage(
                `VisualizeDOM analysis failed: ${error instanceof Error ? error.message : String(error)}`
            );
            
            throw error;
        }
    }
    
    /**
     * Validate if file can be visualized with DOM analysis
     */
    static canVisualizeFile(filePath: string): boolean {
        // Check if file is HTML
        const htmlExtensions = ['.html', '.htm', '.xhtml'];
        return htmlExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
    }
}
