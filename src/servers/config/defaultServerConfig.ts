import * as path from 'path';

/**
 * Server configuration interface
 */
export interface ServerConfig {
    httpMode: 'http' | 'https-default' | 'https-custom';
    port: number;
    autoOpen: boolean;
    openMode: 'browser' | 'lateral-panel';
    customCertPath?: string;
    customKeyPath?: string;
}

/**
 * Default server configuration values
 */
export const DEFAULT_SERVER_CONFIG: ServerConfig = {
    httpMode: 'https-default',
    port: 3000,
    autoOpen: true,
    openMode: 'browser'
};

/**
 * Get default certificate paths
 */
export function getDefaultCertPaths(): { certPath: string; keyPath: string } {
    return {
        certPath: path.join(__dirname, '..', '..', '..', 'certs', 'babia_cert.pem'),
        keyPath: path.join(__dirname, '..', '..', '..', 'certs', 'babia_key.pem')
    };
}

/**
 * Convert internal config format to display format
 */
export function getDisplayFormat(config: ServerConfig): {
    httpMode: string;
    openMode: string;
} {
    const httpModeDisplay = {
        'http': 'HTTP',
        'https-default': 'HTTPS (default certificates)',
        'https-custom': 'HTTPS (custom certificates)'
    };
    
    const openModeDisplay = {
        'browser': 'Browser',
        'lateral-panel': 'Lateral Panel'
    };
    
    return {
        httpMode: httpModeDisplay[config.httpMode],
        openMode: openModeDisplay[config.openMode]
    };
}
