/**
 * Active Server Model
 * Type definitions for active server tracking
 */

/**
 * Certificate mode used by the server
 */
export type CertMode = 'http' | 'https-default' | 'https-custom';

/**
 * Launch mode for server opening
 */
export type LaunchMode = 'browser' | 'lateralPanel';

/**
 * Server status information
 */
export type ServerStatus = 'running' | 'stopped' | 'error';

/**
 * Active server information
 */
export interface ActiveServer {
    /** Unique identifier for the server */
    id: string;
    
    /** Server port */
    port: number;
    
    /** Complete server URL */
    url: string;
    
    /** Launch mode (browser/lateralPanel) */
    launchMode: LaunchMode;
    
    /** Certificate mode (http/https-default/https-custom) */
    certMode: CertMode;
    
    /** Timestamp when server was launched */
    timestamp: number;
    
    /** Current server status */
    status: ServerStatus;

    /** Optional public tunnel state for this server. */
    remoteAccess?: RemoteAccessState;
    
    /** HTML file being served (if any) */
    htmlFile?: string;
    
    /** Custom display name for the server (overrides default filename display) */
    customName?: string;
    
    /** Server instance reference for control operations */
    serverInstance?: any;
    
    /** Additional metadata */
    metadata?: {
        host?: string;
        staticRoot?: string;
        description?: string;
    };
}

/**
 * Server action types for UI interactions
 */
export type ServerAction = 'openBrowser' | 'openPanel' | 'copyUrl' | 'stop' | 'details';

/**
 * Server action command context
 */
export interface ServerActionContext {
    serverId: string;
    action: ServerAction;
    server: ActiveServer;
}

/**
 * Registry event types
 */
export type RegistryEventType = 'serverAdded' | 'serverRemoved' | 'serverUpdated' | 'registryCleared';

/**
 * Registry event data
 */
export interface RegistryEvent {
    type: RegistryEventType;
    serverId?: string;
    server?: ActiveServer;
    timestamp: number;
}
import { RemoteAccessState } from '../../remote_access/model/remoteAccessModel';
