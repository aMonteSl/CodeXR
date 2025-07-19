import * as vscode from 'vscode';
import { updateServerConfig, getServerConfig } from '../items/configurationItems';

/**
 * Handle HTTP Mode configuration click
 */
export async function handleHttpModeClick(): Promise<void> {
    console.log('SERVER: HTTP Mode configuration clicked');
    
    const options = [
        'HTTP',
        'HTTPS (default certificates)',
        'HTTPS (custom certificates)'
    ];
    
    const selected = await vscode.window.showQuickPick(options, {
        placeHolder: 'Select HTTP mode',
        canPickMany: false
    });
    
    if (selected) {
        // Handle HTTP mode selection with confirmation dialog
        if (selected === 'HTTP') {
            const confirmed = await vscode.window.showWarningMessage(
                'HTTP is not secure and XR features like VR will not work. Are you sure you want to proceed?',
                { modal: true },
                'Yes',
                'No'
            );
            
            if (confirmed !== 'Yes') {
                console.log('SERVER: HTTP mode selection cancelled by user');
                return;
            }
            
            console.log('SERVER: HTTP mode confirmed by user');
        }
        
        // Handle HTTPS with custom certificates
        if (selected === 'HTTPS (custom certificates)') {
            console.log('SERVER: HTTPS custom certificates selected, opening file pickers');
            
            // First: Select certificate file (cert.pem)
            const certFileUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'Certificate files': ['pem', 'crt', 'cert']
                },
                openLabel: 'Select Certificate File (cert.pem)'
            });
            
            if (!certFileUri || certFileUri.length === 0) {
                console.log('SERVER: Certificate file selection cancelled');
                return;
            }
            
            const certPath = certFileUri[0].fsPath;
            console.log(`SERVER: Certificate file selected: ${certPath}`);
            
            // Second: Select private key file (key.pem)
            const keyFileUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'Key files': ['pem', 'key']
                },
                openLabel: 'Select Private Key File (key.pem)'
            });
            
            if (!keyFileUri || keyFileUri.length === 0) {
                console.log('SERVER: Private key file selection cancelled');
                return;
            }
            
            const keyPath = keyFileUri[0].fsPath;
            console.log(`SERVER: Private key file selected: ${keyPath}`);
            console.log(`SERVER: Custom certificate configuration - Cert: ${certPath}, Key: ${keyPath}`);
            
            // Store the custom certificate configuration in a single update
            await updateServerConfig({ 
                httpMode: selected,
                customCertPath: certPath,
                customKeyPath: keyPath
            });
            
            console.log(`SERVER: HTTP mode changed to ${selected} with custom certificates`);
            vscode.window.showInformationMessage(`SERVER: HTTPS mode updated with custom certificates`);
        } else {
            // Handle HTTP and HTTPS with default certificates
            await updateServerConfig({ httpMode: selected });
            console.log(`SERVER: HTTP mode changed to ${selected}`);
            vscode.window.showInformationMessage(`SERVER: HTTP mode updated to ${selected}`);
        }
    }
}

/**
 * Handle Default Port configuration click
 */
export async function handlePortClick(): Promise<void> {
    console.log('SERVER: Port configuration clicked');
    
    const input = await vscode.window.showInputBox({
        prompt: 'Enter port number (3000-8080)',
        placeHolder: '3000',
        validateInput: (value: string) => {
            const num = parseInt(value);
            if (isNaN(num)) {
                return 'Please enter a valid number';
            }
            if (num < 3000 || num > 8080) {
                return 'Port must be between 3000 and 8080';
            }
            return null;
        }
    });
    
    if (input) {
        const port = parseInt(input);
        await updateServerConfig({ port });
        console.log(`SERVER: Port changed to ${port}`);
        vscode.window.showInformationMessage(`SERVER: Port updated to ${port}`);
    }
}

/**
 * Handle Auto-Open toggle click
 */
export async function handleAutoOpenClick(): Promise<void> {
    console.log('SERVER: Auto-Open toggle clicked');
    
    const currentConfig = getServerConfig();
    const newValue = !currentConfig.autoOpen;
    
    await updateServerConfig({ autoOpen: newValue });
    console.log(`SERVER: Auto-Open toggled to ${newValue ? 'Yes' : 'No'}`);
    
    const message = newValue ? 'Auto-Open enabled' : 'Auto-Open disabled';
    vscode.window.showInformationMessage(`SERVER: ${message}`);
}

/**
 * Handle Open Mode configuration click
 */
export async function handleOpenModeClick(): Promise<void> {
    console.log('SERVER: Open Mode configuration clicked');
    
    const currentConfig = getServerConfig();
    const newMode = currentConfig.openMode === 'Browser' ? 'Lateral Panel' : 'Browser';
    
    await updateServerConfig({ openMode: newMode });
    console.log(`SERVER: Open Mode changed to ${newMode}`);
    vscode.window.showInformationMessage(`SERVER: Open Mode set to ${newMode}`);
}
