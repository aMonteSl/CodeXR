# Code-XR Servers Subsystem Technical Documentation

## Overview

The Code-XR servers subsystem provides comprehensive HTTP/HTTPS server management for the extension, enabling local and network-accessible visualization serving. The system supports multiple concurrent servers, dynamic port allocation, certificate management, and integrated UI controls.

## Architecture

The servers subsystem follows a modular architecture with clear separation of concerns:

```
src/servers/
├── runtime/                 # Core server implementations
│   ├── index.ts            # Main exports and utilities
│   ├── multiServerLauncher.ts
│   ├── httpServer.ts
│   ├── httpsDefaultServer.ts
│   ├── httpsCustomServer.ts
│   └── portManager.ts
├── storage/                # Configuration management
│   └── serverSettingsManager.ts
├── utils/                  # Network utilities
│   └── networkUtils.ts
└── runtime/sse/           # Server-Sent Events
    └── SSEManager.ts
```

### Core Components

1. **MultiServerLauncher**: Central orchestrator for managing multiple concurrent servers
2. **Server Implementations**: HTTP and HTTPS variants with different certificate modes
3. **ServerSettingsManager**: Persistent configuration storage and management
4. **PortManager**: Dynamic port discovery and allocation
5. **NetworkUtils**: Network interface detection and URL generation
6. **Active Servers Registry**: Centralized tracking and UI integration

## Server Types and Implementations

### 1. HTTP Server (`HttpServer`)

**Purpose**: Basic HTTP server for development and testing scenarios.

**Key Features**:
- Standard HTTP/1.1 protocol support
- CORS configuration with customizable origins
- Static file serving with MIME type detection
- Health check endpoints (`/health`, `/api/status`)
- Server-Sent Events support for real-time updates
- Network interface detection for VR/mobile access

**Configuration**:
```typescript
interface HttpServerConfig {
    port: number;
    host?: string;                  // Default: '0.0.0.0'
    staticRoot?: string;            // Default: extension templates
    enableCors?: boolean;           // Default: true
    allowedOrigins?: string[];      // Default: ['*']
    mainFile?: string;              // Optional specific HTML file
}
```

**Network Access**:
- Binds to `0.0.0.0` for all network interfaces
- Automatically detects local IP for external device access
- Provides both localhost and network URLs

### 2. HTTPS Default Server (`HttpsDefaultServer`)

**Purpose**: HTTPS server using extension-bundled certificates for secure development.

**Features**:
- Pre-configured certificates embedded in extension
- Automatic certificate loading from extension resources
- Same HTTP features with TLS encryption
- Compatible with lateral panel mode (with HTTP fallback)

**Certificate Location**: `certs/babia_cert.pem` and `certs/babia_key.pem`

### 3. HTTPS Custom Server (`HttpsCustomServer`)

**Purpose**: HTTPS server with user-provided certificates for production scenarios.

**Configuration Requirements**:
- User must specify certificate file path (`certPath`)
- User must specify private key file path (`keyPath`)
- Certificates validated before server start
- Full OpenSSL certificate support

## Multi-Server Management

### MultiServerLauncher Architecture

The `MultiServerLauncher` class manages concurrent servers with these capabilities:

**Dynamic Port Allocation**:
```typescript
// Automatic port discovery starting from preferred port
const finalPort = await this.findAvailablePortWithLogging(requestedPort);
if (finalPort !== requestedPort) {
    vscode.window.showInformationMessage(
        `Port ${requestedPort} was busy, launching server on port ${finalPort} instead.`
    );
}
```

**Server Registry Integration**:
- Each server automatically registered with active servers registry
- Unique server IDs generated: `server_${timestamp}_${random}`
- Metadata tracking for UI display and control

**Conflict Resolution**:
- HTTPS + Lateral Panel conflict detection
- Automatic HTTP fallback with user notification
- Non-blocking warnings with actionable advice

### Concurrent Server Support

**Server Tracking**:
```typescript
interface RunningServerInfo {
    id: string;                    // Internal launcher ID
    server: ServerInstance;        // Server implementation instance
    serverType: ServerType;        // 'http' | 'https-default' | 'https-custom'
    port: number;                  // Assigned port
    htmlFile?: string;             // HTML file being served
    activeServerId: string;        // Registry ID for UI integration
}
```

**Lifecycle Management**:
- Individual server stop/start operations
- Bulk operations (stop all servers)
- Graceful shutdown with registry cleanup
- Error recovery and state consistency

## Configuration System

### ServerSettingsManager

**Persistent Storage**: File-based storage in VS Code's global storage directory:
- Location: `{globalStorageUri}/server-settings.json`
- Atomic updates with deep merge support
- Version tracking and migration support

**Configuration Structure**:
```typescript
interface ServerSettings {
    mode: 'HTTP' | 'HTTPS';
    https: {
        certSource: 'default' | 'custom';
        certPath: string;
        keyPath: string;
    };
    defaultPort: number;
    launch: {
        autoOpen: boolean;
        openMode: 'browser' | 'lateralPanel';
    };
    configNonce: string;           // Security nonce regenerated on updates
    version: string;               // Configuration version for migrations
}
```

**Default Configuration**:
- Mode: HTTPS with default certificates
- Port: 3000
- Auto-open: enabled in browser mode
- Security: nonce-based configuration validation

### Legacy Compatibility

**UI Adapter Methods**:
- `getLegacyConfig()`: Converts modern structure to UI-friendly format
- `updateFromLegacyConfig()`: Handles updates from existing UI components
- Certificate path display with security redaction

## Port Management

### PortManager Utilities

**Port Discovery Algorithm**:
1. Check requested port availability on `0.0.0.0`
2. If unavailable, use `get-port` library for sequential search
3. Fallback to manual sequential checking if library fails
4. Configurable range limits (default: 3000-8080)

**Advanced Features**:
- Multi-port allocation for multiple servers
- Port validation (1-65535 range)
- Privileged port detection (1-1023)
- Service-specific port suggestions

**Network Interface Support**:
- Binds to all interfaces (`0.0.0.0`) for network access
- Validates availability across all network interfaces
- Comprehensive error reporting

## Network Configuration

### NetworkUtils Features

**IP Address Detection**:
```typescript
static getLocalIPAddress(): string {
    // Scans all network interfaces
    // Returns first non-internal IPv4 address
    // Fallback to localhost if no external interface found
}
```

**URL Generation**:
- Localhost URLs for local testing
- Network URLs for external device access
- Protocol-aware URL construction
- VR/mobile device compatibility

**Network Diagnostics**:
- Interface enumeration and status
- Accessibility testing
- Debug information logging

## Server-Sent Events (SSE)

### Real-time Update System

**Integration Points**:
- HTTP server provides `/events` endpoint
- SSE manager handles client registration
- File-to-server mapping for targeted updates
- Analysis engine integration for live visualization updates

**Client Management**:
```typescript
// Automatic client registration
if (url === '/events') {
    const fileUri = fileToServerMap.findFileByPort(serverPort);
    sseManager.registerClient(fileUri, res);
}
```

## Integration with Active Servers

### Registry System

**Registration Process**:
1. Server launched by MultiServerLauncher
2. Server details registered with ServerRegistrar
3. ActiveServerRegistry maintains central state
4. UI components automatically updated

**Server Metadata**:
```typescript
const activeServer = registrar.registerServer({
    port: finalPort,
    url: result.serverUrl,
    launchMode: launchMode,
    certMode: certMode,
    timestamp: Date.now(),
    htmlFile: htmlFile,
    customName: customName,
    serverInstance: result.serverInstance,
    metadata: {
        serverType: serverType,
        originalPort: requestedPort,
        portChanged: portChanged,
        httpsOverridden: isHttpsOverridden,
        launcherId: 'multi-server',
        serverInstanceId: serverId
    }
});
```

### UI Integration

**Action Handlers**:
- Browser opening with system default browser
- Lateral panel integration with VS Code webview
- URL copying to clipboard
- Server lifecycle control (start/stop)

**Status Display**:
- Real-time server status in tree view
- Network access information
- Certificate mode indicators
- Performance metrics

## Security Considerations

### Certificate Management

**Default Certificates**:
- Embedded in extension for development use
- Automatically loaded from extension resources
- No user configuration required

**Custom Certificates**:
- User-provided certificate validation
- Secure path storage with redacted display
- OpenSSL compatibility verification

**Configuration Security**:
- Nonce-based configuration validation
- Secure storage in VS Code global storage
- Certificate path redaction in logs

### Network Security

**CORS Configuration**:
- Configurable origin restrictions
- Default wildcard for development
- Production-ready restriction options

**Interface Binding**:
- Explicit `0.0.0.0` binding for network access
- No accidental localhost-only binding
- Clear network access notifications

## Error Handling and Recovery

### Robust Error Management

**Port Conflicts**:
- Automatic alternative port discovery
- User notification with clear messaging
- Graceful degradation to available ports

**Certificate Errors**:
- Validation before server start
- Clear error messages for certificate issues
- Fallback suggestions (HTTP mode, default certs)

**Network Failures**:
- Interface detection fallbacks
- Network diagnostic information
- Recovery suggestions

### Logging and Debugging

**Comprehensive Logging**:
- Server lifecycle events
- Network configuration details
- Error conditions with context
- Performance metrics

**Debug Information**:
- Network interface enumeration
- Certificate loading status
- Port allocation details
- SSE client connections

## API Reference

### Key Classes and Methods

#### MultiServerLauncher
```typescript
class MultiServerLauncher {
    async launchServer(htmlFile?: string, customName?: string): Promise<MultiServerLaunchResult>
    async stopServer(serverId: string): Promise<boolean>
    async stopAllServers(): Promise<boolean>
    getRunningServers(): Array<ServerInfo>
    hasRunningServers(): boolean
}
```

#### ServerSettingsManager
```typescript
class ServerSettingsManager {
    static getInstance(context?: vscode.ExtensionContext): ServerSettingsManager
    getServerSettings(): ServerSettings
    async updateServerSettings(updates: Partial<ServerSettings>): Promise<void>
    async restoreServerSettings(): Promise<void>
    async resetSettings(): Promise<void>
}
```

#### PortManager
```typescript
class PortManager {
    static async isPortAvailable(port: number, host?: string): Promise<boolean>
    static async findAvailablePort(startPort?: number, endPort?: number): Promise<number>
    static async findMultipleAvailablePorts(count: number, startPort?: number): Promise<number[]>
    static isValidPort(port: number): boolean
}
```

### Launch Result Interfaces

```typescript
interface MultiServerLaunchResult {
    success: boolean;
    serverUrl?: string;
    serverType?: ServerType;
    serverId?: string;
    error?: string;
    port?: number;
    httpsOverridden?: boolean;
    portChanged?: boolean;
    originalPort?: number;
}
```

## Performance Characteristics

### Startup Performance
- Server startup time: < 100ms for HTTP, < 200ms for HTTPS
- Port discovery: < 50ms for available ports
- Certificate loading: < 100ms for default certs

### Memory Usage
- Base server overhead: ~10MB per server instance
- Static file caching: configurable, default disabled
- SSE client overhead: ~1KB per connected client

### Network Performance
- Static file serving: direct Node.js streaming
- CORS overhead: minimal headers addition
- SSE latency: < 10ms for local updates

## Best Practices

### Development Guidelines
1. Always use MultiServerLauncher for server management
2. Implement proper error handling for network operations
3. Use ServerSettingsManager for all configuration storage
4. Leverage PortManager for port allocation
5. Register servers with ActiveServerRegistry for UI integration

### Performance Optimization
1. Use appropriate server type for use case
2. Configure CORS origins restrictively in production
3. Implement proper SSL certificate management
4. Monitor port usage and cleanup unused servers

### Security Recommendations
1. Use HTTPS for production deployments
2. Validate custom certificates before use
3. Restrict CORS origins in sensitive environments
4. Monitor network access and log security events

---

*This documentation covers the complete servers subsystem architecture, implementation details, and usage patterns. For specific implementation examples, refer to the source code in `src/servers/` and integration examples in `src/active_servers/`.*
