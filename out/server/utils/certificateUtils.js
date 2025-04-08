"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultCertificatePaths = getDefaultCertificatePaths;
exports.certificatesExist = certificatesExist;
exports.createSelfSignedCertificate = createSelfSignedCertificate;
exports.loadCertificates = loadCertificates;
exports.saveCertificates = saveCertificates;
exports.getCertificateInfo = getCertificateInfo;
exports.getCertificateFingerprint = getCertificateFingerprint;
exports.validateCertificate = validateCertificate;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
/**
 * Gets paths for default certificates
 * @param context Extension context for accessing extension directory
 * @returns Object with paths to key and certificate files
 */
function getDefaultCertificatePaths(context) {
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
function certificatesExist(paths) {
    return fs.existsSync(paths.keyPath) && fs.existsSync(paths.certPath);
}
/**
 * Creates a self-signed certificate
 * @param options Certificate options
 * @returns Object with key and certificate
 */
function createSelfSignedCertificate(options) {
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
async function loadCertificates(paths) {
    try {
        // Check if both files exist
        if (!certificatesExist(paths)) {
            throw new Error('Certificate files do not exist');
        }
        // Read files
        const key = fs.readFileSync(paths.keyPath);
        const cert = fs.readFileSync(paths.certPath);
        return { key, cert };
    }
    catch (err) {
        if (err instanceof Error) {
            throw new Error(`Error reading certificates: ${err.message}`);
        }
        else {
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
async function saveCertificates(data, paths) {
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
        }
        catch (error) {
            console.warn('Could not set permissions on key file:', error);
        }
    }
    catch (err) {
        if (err instanceof Error) {
            throw new Error(`Error saving certificates: ${err.message}`);
        }
        else {
            throw new Error('Error saving certificates');
        }
    }
}
/**
 * Gets certificate information
 * @param certPath Path to certificate file
 * @returns Certificate information as string
 */
function getCertificateInfo(certPath) {
    try {
        // Read certificate file
        const certData = fs.readFileSync(certPath);
        // This is a simplified placeholder - in a real implementation,
        // we would parse the certificate data and extract information
        return 'Certificate information not implemented';
    }
    catch (error) {
        return `Error reading certificate: ${error instanceof Error ? error.message : String(error)}`;
    }
}
/**
 * Generates a SHA-256 fingerprint of a certificate
 * @param certPath Path to certificate file
 * @returns Fingerprint as hexadecimal string
 */
function getCertificateFingerprint(certPath) {
    try {
        // Read certificate file
        const certData = fs.readFileSync(certPath);
        // Generate fingerprint
        const fingerprint = crypto.createHash('sha256').update(certData).digest('hex');
        // Format with colons
        return fingerprint.replace(/(.{2})(?=.)/g, '$1:');
    }
    catch (error) {
        return `Error calculating fingerprint: ${error instanceof Error ? error.message : String(error)}`;
    }
}
/**
 * Validates a certificate
 * @param certPath Path to certificate file
 * @returns Validation result
 */
function validateCertificate(certPath) {
    try {
        // Read certificate file
        const certData = fs.readFileSync(certPath);
        // This is a simplified placeholder - in a real implementation,
        // we would validate the certificate format, expiration, etc.
        return {
            isValid: true,
            message: 'Certificate validation not implemented'
        };
    }
    catch (error) {
        return {
            isValid: false,
            message: `Error validating certificate: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}
//# sourceMappingURL=certificateUtils.js.map