import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Certificate options
 */
export interface CertificateOptions {
  /** Certificate subject */
  subject: string;
  /** Validity period in days */
  days: number;
  /** Key size in bits */
  keySize: number;
}

/**
 * Certificate paths
 */
export interface CertificatePaths {
  /** Path to the private key file */
  keyPath: string;
  /** Path to the certificate file */
  certPath: string;
}

/**
 * Certificate data
 */
export interface CertificateData {
  /** Private key */
  key: Buffer;
  /** Certificate */
  cert: Buffer;
}

/**
 * Gets paths for default certificates
 * @param context Extension context for accessing extension directory
 * @returns Object with paths to key and certificate files
 */
export function getDefaultCertificatePaths(context: vscode.ExtensionContext): CertificatePaths {
  const extensionPath = context.extensionPath;
  return {
    keyPath: path.join(extensionPath, 'certs', 'babia_key.pem'),
    certPath: path.join(extensionPath, 'certs', 'babia_cert.pem')
  };
}

/**
 * Checks if certificate files exist at specified paths
 * @param paths Paths to certificate files
 * @returns true if both files exist, false otherwise
 */
export function certificatesExist(paths: CertificatePaths): boolean {
  return fs.existsSync(paths.keyPath) && fs.existsSync(paths.certPath);
}

/**
 * Creates a self-signed certificate
 * @param options Certificate options
 * @returns Object with key and certificate
 */
export function createSelfSignedCertificate(options: CertificateOptions): {key: string, cert: string} {
  // This is a simplified placeholder - in a real implementation,
  // we would use OpenSSL or a Node.js crypto library to generate certificates
  
  // For now, just throw an error recommending manual certificate creation
  throw new Error('Certificate generation is not implemented. Please use OpenSSL to create your certificates manually.');
}

/**
 * Loads certificate files from disk
 * @param paths Paths to certificate files
 * @returns Promise resolving to certificate data
 */
export async function loadCertificates(paths: CertificatePaths): Promise<CertificateData> {
  try {
    // Check if both files exist
    if (!certificatesExist(paths)) {
      throw new Error('Certificate files do not exist');
    }
    
    // Read files
    const key = fs.readFileSync(paths.keyPath);
    const cert = fs.readFileSync(paths.certPath);
    
    return { key, cert };
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(`Error reading certificates: ${err.message}`);
    } else {
      throw new Error('Error reading certificates');
    }
  }
}

/**
 * Saves certificate files to disk
 * @param data Certificate data
 * @param paths Paths to save certificate files
 * @returns Promise that resolves when files are saved
 */
export async function saveCertificates(data: CertificateData, paths: CertificatePaths): Promise<void> {
  try {
    // Ensure directory exists
    const dirPath = path.dirname(paths.keyPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // Write files
    fs.writeFileSync(paths.keyPath, data.key);
    fs.writeFileSync(paths.certPath, data.cert);
    
    // Set permissions (600) for the key file (POSIX only)
    try {
      fs.chmodSync(paths.keyPath, 0o600);
    } catch (error) {
      console.warn('Could not set permissions on key file:', error);
    }
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(`Error saving certificates: ${err.message}`);
    } else {
      throw new Error('Error saving certificates');
    }
  }
}

/**
 * Gets certificate information
 * @param certPath Path to certificate file
 * @returns Certificate information as string
 */
export function getCertificateInfo(certPath: string): string {
  try {
    // Read certificate file
    const certData = fs.readFileSync(certPath);
    
    // This is a simplified placeholder - in a real implementation,
    // we would parse the certificate data and extract information
    
    return 'Certificate information not implemented';
  } catch (error) {
    return `Error reading certificate: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Generates a SHA-256 fingerprint of a certificate
 * @param certPath Path to certificate file
 * @returns Fingerprint as hexadecimal string
 */
export function getCertificateFingerprint(certPath: string): string {
  try {
    // Read certificate file
    const certData = fs.readFileSync(certPath);
    
    // Generate fingerprint
    const fingerprint = crypto.createHash('sha256').update(certData).digest('hex');
    
    // Format with colons
    return fingerprint.replace(/(.{2})(?=.)/g, '$1:');
  } catch (error) {
    return `Error calculating fingerprint: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Validates a certificate
 * @param certPath Path to certificate file
 * @returns Validation result
 */
export function validateCertificate(certPath: string): {isValid: boolean, message: string} {
  try {
    // Read certificate file
    const certData = fs.readFileSync(certPath);
    
    // This is a simplified placeholder - in a real implementation,
    // we would validate the certificate format, expiration, etc.
    
    return {
      isValid: true,
      message: 'Certificate validation not implemented'
    };
  } catch (error) {
    return {
      isValid: false,
      message: `Error validating certificate: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}