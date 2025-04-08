import * as http from 'http';
import * as https from 'https';

/**
 * Available server mode options
 */
export enum ServerMode {
  HTTP = 'HTTP',
  HTTPS_DEFAULT_CERTS = 'HTTPS (default certificates)',
  HTTPS_CUSTOM_CERTS = 'HTTPS (custom certificates)'
}

/**
 * Information about an active server
 */
export interface ServerInfo {
  /** Unique identifier for the server */
  id: string;
  
  /** Full URL including protocol and port */
  url: string;
  
  /** Display version of URL (with filename instead of localhost) */
  displayUrl?: string;
  
  /** Protocol used (http/https) */
  protocol: string;
  
  /** Port number the server is running on */
  port: number;
  
  /** Path to the HTML file being served */
  filePath: string;
  
  /** Whether HTTPS is being used */
  useHttps: boolean;
  
  /** Timestamp when the server was started */
  startTime?: number;
}

/**
 * Complete server entry with server instance and metadata
 */
export interface ActiveServerEntry {
  /** The actual server instance */
  server: http.Server | https.Server;
  
  /** Metadata about the server */
  info: ServerInfo;
}

/**
 * Server event types for the event emitter
 */
export enum ServerEventType {
  STARTED = 'server-started',
  STOPPED = 'server-stopped',
  UPDATED = 'server-updated',
  ERROR = 'server-error'
}

/**
 * Options for creating a server
 */
export interface ServerOptions {
  /** Path to the HTML file to serve */
  filePath: string;
  
  /** Whether to use HTTPS */
  useHttps: boolean;
  
  /** Whether to use default certificates (if HTTPS) */
  useDefaultCerts: boolean;
  
  /** Custom port (optional) */
  port?: number;
}