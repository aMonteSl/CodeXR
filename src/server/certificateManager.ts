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
    // Get paths of stored custom certificates
    const customKeyPath = context.globalState.get<string>('customKeyPath');
    const customCertPath = context.globalState.get<string>('customCertPath');
    
    // Verify paths exist
    if (!customKeyPath || !customCertPath) {
      throw new Error('No custom certificate paths stored. Please select certificate files first.');
    }
    
    if (!fs.existsSync(customKeyPath) || !fs.existsSync(customCertPath)) {
      throw new Error('Custom certificate files not found at the stored paths.');
    }
    
    try {
      // Read certificate files
      const key = fs.readFileSync(customKeyPath);
      const cert = fs.readFileSync(customCertPath);
      return { key, cert };
    } catch (err) {
      if (err instanceof Error) {
        throw new Error(`Error reading custom certificates: ${err.message}`);
      } else {
        throw new Error('Error reading custom certificates');
      }
    }
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