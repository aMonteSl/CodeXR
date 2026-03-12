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
    openMode: 'browser',
};

/**
 * Convert internal config format to display format
 */
export function getDisplayFormat(config: ServerConfig): {
    httpMode: string;
    openMode: string;
} {
    const httpModeDisplay: Record<ServerConfig['httpMode'], string> = {
        http: 'HTTP',
        'https-default': 'HTTPS (generated local certificates)',
        'https-custom': 'HTTPS (custom certificates)',
    };

    const openModeDisplay: Record<ServerConfig['openMode'], string> = {
        browser: 'Browser',
        'lateral-panel': 'Lateral Panel',
    };

    return {
        httpMode: httpModeDisplay[config.httpMode],
        openMode: openModeDisplay[config.openMode],
    };
}
