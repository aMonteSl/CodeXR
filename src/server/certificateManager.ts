import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Gets SSL certificates for HTTPS server
 * @param context Extension context
 * @param useDefaultCerts Whether to use default certificates
 * @returns Object with key and cert buffers
 */
export async function getCertificates(
  context: vscode.ExtensionContext, 
  useDefaultCerts: boolean
): Promise<{key: Buffer, cert: Buffer}> {
  if (useDefaultCerts) {
    // Use default certificates in ./certs
    const extensionPath = context.extensionPath;
    const keyPath = path.join(extensionPath, 'certs', 'babia_key.pem');
    const certPath = path.join(extensionPath, 'certs', 'babia_cert.pem');
    
    // Check if certificates exist
    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
      throw new Error('Default certificates do not exist in ./certs');
    }
    
    try {
      const key = fs.readFileSync(keyPath);
      const cert = fs.readFileSync(certPath);
      return { key, cert };
    } catch (err) {
      if (err instanceof Error) {
        throw new Error(`Error reading default certificates: ${err.message}`);
      } else {
        throw new Error('Error reading default certificates');
      }
    }
  } else {
    // Dialog to select private key file
    const keyOptions: vscode.OpenDialogOptions = {
      canSelectMany: false,
      openLabel: 'Select private key file (.key or .pem)',
      filters: { 'Certificates': ['key', 'pem'] }
    };
    
    const keyUri = await vscode.window.showOpenDialog(keyOptions);
    if (!keyUri || keyUri.length === 0) {
      throw new Error('No private key file was selected');
    }
    
    // Dialog to select certificate file
    const certOptions: vscode.OpenDialogOptions = {
      canSelectMany: false,
      openLabel: 'Select certificate file (.cert or .pem)',
      filters: { 'Certificates': ['cert', 'pem'] }
    };
    
    const certUri = await vscode.window.showOpenDialog(certOptions);
    if (!certUri || certUri.length === 0) {
      throw new Error('No certificate file was selected');
    }
    
    // Load certificate and key files
    const key = fs.readFileSync(keyUri[0].fsPath);
    const cert = fs.readFileSync(certUri[0].fsPath);
    return { key, cert };
  }
}

/**
 * Checks if default certificates exist in the extension directory
 * @param context Extension context
 * @returns true if both certificate files exist, false otherwise
 */
export function defaultCertificatesExist(context: vscode.ExtensionContext): boolean {
  const extensionPath = context.extensionPath;
  const keyPath = path.join(extensionPath, 'certs', 'babia_key.pem');
  const certPath = path.join(extensionPath, 'certs', 'babia_cert.pem');
  
  return fs.existsSync(keyPath) && fs.existsSync(certPath);
}