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
exports.getCertificates = getCertificates;
exports.defaultCertificatesExist = defaultCertificatesExist;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Gets SSL certificates for HTTPS server
 * @param context Extension context
 * @param useDefaultCerts Whether to use default certificates
 * @returns Object with key and cert buffers
 */
async function getCertificates(context, useDefaultCerts) {
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
        }
        catch (err) {
            if (err instanceof Error) {
                throw new Error(`Error reading default certificates: ${err.message}`);
            }
            else {
                throw new Error('Error reading default certificates');
            }
        }
    }
    else {
        // Get paths of stored custom certificates
        const customKeyPath = context.globalState.get('customKeyPath');
        const customCertPath = context.globalState.get('customCertPath');
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
        }
        catch (err) {
            if (err instanceof Error) {
                throw new Error(`Error reading custom certificates: ${err.message}`);
            }
            else {
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
function defaultCertificatesExist(context) {
    const extensionPath = context.extensionPath;
    const keyPath = path.join(extensionPath, 'certs', 'babia_key.pem');
    const certPath = path.join(extensionPath, 'certs', 'babia_cert.pem');
    return fs.existsSync(keyPath) && fs.existsSync(certPath);
}
//# sourceMappingURL=certificateManager.js.map