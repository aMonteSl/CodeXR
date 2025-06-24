import * as vscode from 'vscode';
import * as path from 'path';
import { getActiveAnalysisServer, closeExistingAnalysisServer } from '../../analysis/xr/xrAnalysisManager';
import { getActiveDOMVisualizationServer, closeExistingDOMVisualizationServer } from '../../analysis/html/domVisualizationManager';
import { stopServer } from '../../server/serverManager';

/**
 * Server conflict action types
 */
export type ServerConflictAction = 'proceed' | 'open' | 'cancel';

/**
 * Checks if there's an active server for a file and handles user choice
 * @param filePath Path to the file being analyzed
 * @param fileName File name for display
 * @returns Action to take: 'proceed', 'open', or 'cancel'
 */
export async function handleExistingServerConflict(
  filePath: string, 
  fileName: string
): Promise<ServerConflictAction> {
  const existingServer = findExistingServer(filePath, fileName);
  
  if (!existingServer) {
    return 'proceed'; // No existing server found
  }
  
  const serverType = existingServer.type === 'dom' ? 'DOM visualization' : 'XR analysis';
  
  console.log(`🔍 Found existing ${serverType} server for ${fileName}:`, existingServer.url);
  
  // ✅ FIXED: Removed the extra "❌ Cancel" button - VS Code provides default cancel
  const choice = await vscode.window.showInformationMessage(
    `A ${serverType} server is already running for "${fileName}" at ${existingServer.url}`,
    {
      modal: true,
      detail: 'What would you like to do?'
    },
    '🌐 Open in Browser',
    '🔄 Re-analyze (Close & Restart)'
    // ✅ REMOVED: '❌ Cancel' - VS Code already provides this
  );
  
  return await handleUserChoice(choice, existingServer, serverType, fileName);
}

/**
 * Finds existing server for a file
 * @param filePath Path to the file
 * @param fileName Name of the file
 * @returns Server information if found, undefined otherwise
 */
function findExistingServer(filePath: string, fileName: string): ExistingServer | undefined {
  const fileNameWithoutExt = path.basename(fileName, path.extname(fileName));
  
  // Check for XR analysis server
  const xrServer = getActiveAnalysisServer(fileNameWithoutExt);
  if (xrServer) {
    console.log(`🎯 Found XR server for ${fileNameWithoutExt}:`, xrServer);
    return {
      type: 'xr',
      server: xrServer,
      url: xrServer.url,
      fileName: fileNameWithoutExt
    };
  }
  
  // Check for DOM visualization server (HTML files)
  const fileExtension = path.extname(filePath).toLowerCase();
  if (fileExtension === '.html' || fileExtension === '.htm') {
    const domServer = getActiveDOMVisualizationServer(fileNameWithoutExt);
    
    if (domServer) {
      console.log(`🌐 Found DOM server for ${fileNameWithoutExt}:`, domServer);
      return {
        type: 'dom',
        server: domServer,
        url: domServer.url,
        fileName: fileNameWithoutExt
      };
    }
  }
  
  return undefined;
}

/**
 * Handles user choice for server conflict resolution
 * @param choice User's choice from the dialog
 * @param existingServer Information about the existing server
 * @param serverType Type of server for user feedback
 * @param fileName File name for user feedback
 * @returns Action to take
 */
async function handleUserChoice(
  choice: string | undefined,
  existingServer: ExistingServer,
  serverType: string,
  fileName: string
): Promise<ServerConflictAction> {
  switch (choice) {
    case '🌐 Open in Browser':
      console.log(`🌐 Opening browser for ${fileName}: ${existingServer.url}`);
      await vscode.env.openExternal(vscode.Uri.parse(existingServer.url));
      return 'open';
    
    case '🔄 Re-analyze (Close & Restart)':
      console.log(`🔄 Re-analyzing ${fileName}, closing existing server...`);
      
      // ✅ CRITICAL FIX: Properly close the existing server and wait for completion
      const closeSuccess = await closeExistingServerAndWait(existingServer);
      
      if (closeSuccess) {
        console.log(`✅ Successfully closed existing server for ${fileName}`);
        
        vscode.window.showInformationMessage(
          `🔄 Restarting ${serverType} for ${fileName}...`,
          { modal: false }
        );
        
        // ✅ ADD SMALL DELAY: Allow server to fully close before proceeding
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return 'proceed';
      } else {
        console.error(`❌ Failed to close existing server for ${fileName}`);
        vscode.window.showErrorMessage(
          `Failed to close existing ${serverType} server. Please try again.`
        );
        return 'cancel';
      }
    
    // ✅ FIXED: Handle all cancel cases (ESC, X button, or undefined)
    default:
      console.log(`❌ User cancelled re-analysis for ${fileName}`);
      return 'cancel';
  }
}

/**
 * ✅ ENHANCED: Closes an existing server and waits for completion
 * @param existingServer Server information
 * @returns Promise<boolean> indicating success
 */
async function closeExistingServerAndWait(existingServer: ExistingServer): Promise<boolean> {
  try {
    console.log(`🛑 Closing ${existingServer.type} server:`, existingServer.server.id || existingServer.server.port);
    
    if (existingServer.type === 'xr') {
      // ✅ XR Analysis server cleanup
      const success = closeExistingAnalysisServer(existingServer.fileName);
      
      if (success) {
        console.log(`✅ XR server closed successfully for ${existingServer.fileName}`);
        return true;
      } else {
        console.error(`❌ Failed to close XR server for ${existingServer.fileName}`);
        return false;
      }
    } 
    else if (existingServer.type === 'dom') {
      // ✅ DOM visualization server cleanup
      const success = closeExistingDOMVisualizationServer(existingServer.fileName);
      
      if (success) {
        console.log(`✅ DOM server closed successfully for ${existingServer.fileName}`);
        return true;
      } else {
        console.error(`❌ Failed to close DOM server for ${existingServer.fileName}`);
        return false;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error closing existing server:`, error);
    return false;
  }
}

/**
 * Information about an existing server
 */
interface ExistingServer {
  type: 'xr' | 'dom';
  server: any;
  url: string;
  fileName: string; // ✅ ADDED: Track filename for cleanup
}