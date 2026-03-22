/**
 * Session Server Models
 * Interfaces para la gestión de servidores por sesión
 */

export interface SessionServerInfo {
    sessionId: string;
    targetPath: string;
    port: number;
    serverUrl: string;
    serverType: 'http' | 'https-default' | 'https-custom';
    serverId: string;
    tempDir: string;
    isActive: boolean;
    startedAt: Date;
}

export interface ServerLaunchRequest {
    sessionId: string;
    targetPath: string;
    preferredPort?: number;
    serverType?: 'http' | 'https-default' | 'https-custom';
}

export interface ServerLaunchResult {
    success: boolean;
    sessionServerInfo?: SessionServerInfo;
    error?: string;
    portChanged?: boolean;
    originalPort?: number;
}

export interface SSENotification {
    type: 'file-changed' | 'analysis-updated' | 'server-started' | 'server-stopped';
    sessionId: string;
    timestamp: Date;
    data?: any;
}

export interface SessionServerStatus {
    sessionId: string;
    isServerActive: boolean;
    isWatcherActive: boolean;
    port?: number;
    serverUrl?: string;
    lastUpdate?: Date;
}
