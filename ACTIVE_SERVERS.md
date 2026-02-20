# Code-XR Active Servers Subsystem Technical Documentation

## Overview and Purpose

The Active Servers subsystem provides centralized tracking, management, and UI integration for all running HTTP/HTTPS servers in the Code-XR extension. It serves as the control center that bridges the server runtime (launcher, individual server instances) with the VS Code user interface, offering real-time monitoring, control actions, and state management for concurrent server instances.

### Core Responsibilities
- **Registry Management**: Centralized tracking of all active server instances with metadata
- **UI Integration**: Tree view display with interactive controls and context menus
- **Lifecycle Management**: Server registration, status updates, and cleanup operations
- **User Actions**: Browser/panel opening, URL copying, server stopping, and detailed information display
- **State Synchronization**: Real-time updates between server runtime and UI components

## Architecture and File Structure

The Active Servers subsystem follows a layered architecture with clear separation between data models, registry logic, UI components, and action handlers:

```
src/active_servers/
├── model/
│   └── activeServerModel.ts          # Core data types and interfaces
├── registry/
│   └── activeServerRegistry.ts       # Centralized server state management
├── services/
│   ├── serverRegistrar.ts           # Registration validation and delegation
│   └── panelManager.ts              # WebviewPanel lifecycle management
├── runtime/
│   └── serverControl.ts             # Server lifecycle operations
├── views/
│   ├── index.ts                     # View exports
│   ├── items/
│   │   └── serverItems.ts           # Tree item creation and formatting
│   └── interactions/
│       └── handleServerActions.ts   # User action handlers
└── commands/
    └── activeServersCommands.ts     # VS Code command registration
```

### UI Integration Files
```
src/views/active_servers/
├── ActiveServersSectionProvider.ts  # Tree view section provider
├── items/
│   └── activeServerItems.ts        # UI-specific tree items
└── interactions/
    └── handleActiveServerClicks.ts # Click handling for tree items
```

## Data Models and Interfaces

### Core ActiveServer Interface

```typescript
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
        // Analysis session metadata
        sessionId?: string;
        serverType?: string;
        originalPort?: number;
        portChanged?: boolean;
        httpsOverridden?: boolean;
        launcherId?: string;
        serverInstanceId?: string;
    };
}
```

### Supporting Type Definitions

```typescript
// Certificate mode used by the server
export type CertMode = 'http' | 'https-default' | 'https-custom';

// Launch mode for server opening
export type LaunchMode = 'browser' | 'lateralPanel';

// Server status information
export type ServerStatus = 'running' | 'stopped' | 'error';

// Server action types for UI interactions
export type ServerAction = 'openBrowser' | 'openPanel' | 'copyUrl' | 'stop' | 'details';

// Registry event types for state change notifications
export type RegistryEventType = 'serverAdded' | 'serverRemoved' | 'serverUpdated' | 'registryCleared';
```

### Registry Event System

```typescript
export interface RegistryEvent {
    type: RegistryEventType;
    serverId?: string;
    server?: ActiveServer;
    timestamp: number;
}
```

## Registry Functionality

### ActiveServerRegistry (Singleton Pattern)

The `ActiveServerRegistry` class serves as the central state store for all active servers:

**Core Registration Methods**:
```typescript
// Register a new server with validation and event emission
public registerServer(config: {
    port: number;
    url: string;
    launchMode: LaunchMode;
    certMode: CertMode;
    timestamp: number;
    htmlFile?: string;
    customName?: string;
    serverInstance?: any;
    metadata?: any;
}): ActiveServer

// Remove server and trigger cleanup
public unregisterServer(serverId: string): boolean

// Update server status with validation
public updateServerStatus(serverId: string, status: ServerStatus): boolean
```

**Query and Management Methods**:
```typescript
// Retrieve servers by various criteria
public getServer(serverId: string): ActiveServer | undefined
public getAllServers(): ActiveServer[]
public getServersByStatus(status: ServerStatus): ActiveServer[]
public getServerByPort(port: number): ActiveServer | undefined

// Registry maintenance
public cleanupInactiveServers(): number
public clearAll(): void
public getStats(): RegistryStatistics
```

### Server Registration Process

1. **Validation**: ServerRegistrar validates configuration parameters
2. **ID Generation**: Unique server ID created: `server-${port}-${timestamp}`
3. **Registry Storage**: Server added to internal Map with full metadata
4. **Event Emission**: `serverAdded` event fired to update UI components
5. **Logging**: Comprehensive logging for debugging and monitoring

```typescript
// Registration flow example
const registrar = getServerRegistrar();
const activeServer = registrar.registerServer({
    port: 3000,
    url: 'http://localhost:3000',
    launchMode: 'browser',
    certMode: 'http',
    timestamp: Date.now(),
    customName: 'My Visualization',
    serverInstance: serverInstance,
    metadata: {
        serverType: 'http',
        launcherId: 'multi-server'
    }
});
```

### Cleanup and State Management

**Automatic Cleanup Triggers**:
- Server stop operations remove entries from registry
- Status updates to 'stopped' or 'error' can trigger removal
- Extension deactivation clears all registry entries
- Periodic cleanup removes inactive servers

**State Consistency**:
- Registry maintains single source of truth for server state
- Event-driven updates ensure UI synchronization
- Server instance references allow direct control operations

## UI Integration

### Tree View Integration

The Active Servers subsystem integrates with VS Code's unified tree view through the `ActiveServersSectionProvider`:

**Section Structure**:
```
ACTIVE SERVERS (X running)
├── Stop All Servers          # (shown when ≥2 servers running)
├── MyServer1 (Browser)        # Individual server items
├── localhost:3001 (Panel)     # Default naming when no custom name
└── MyVisualization (Browser)  # Custom named server
```

**UI Components**:
- **Section Header**: Displays total server count and running status
- **Control Options**: Stop All Servers (conditional display)
- **Server Items**: Individual servers with status, mode, and actions
- **No Servers Message**: Informational display when registry is empty

### Server Item Display Logic

**Label Generation**:
```typescript
// Priority: customName > localhost:port fallback
const label = server.customName?.trim() || `localhost:${server.port}`;
```

**Description Format**: `{LaunchMode}` with optional status indicators
- "Browser" / "Panel" for normal operation
- "Browser (stopped)" / "Panel (error)" for non-running states

**Icon Selection**:
- **HTTP**: Globe icon (less secure indicator)
- **HTTPS Default**: Shield icon (secure with default certificates)
- **HTTPS Custom**: Shield-check icon (most secure)
- **Color Coding**: Green (running), Gray (stopped), Red (error)

### Available User Actions

**Primary Actions** (via tree item click):
1. **Show Actions**: Quick pick menu with all available operations
2. **Open in Browser**: Launch in system default browser
3. **Open in Panel**: Display in VS Code lateral panel (HTTP only)
4. **Copy URL**: Clipboard operations with local/network URL options
5. **Server Info**: Detailed modal with comprehensive server information
6. **Stop Server**: Confirmation dialog and graceful shutdown

**Context Menu Actions** (right-click):
- HTTP servers: All actions available
- HTTPS servers: Limited to browser opening (panel incompatible)

**Bulk Operations**:
- **Stop All Servers**: Available when 2+ servers are running
- **Refresh**: Manual trigger for registry state updates

### VS Code Command Integration

**Command Registration** (from `package.json`):
```json
{
  "command": "codeXR.activeServers.showActions",
  "title": "Show Server Actions",
  "icon": "$(menu)"
},
{
  "command": "codeXR.activeServers.openInBrowser",
  "title": "Open in Browser",
  "icon": "$(browser)"
},
{
  "command": "codeXR.activeServers.stopAllServers",
  "title": "Stop All Servers",
  "icon": "$(stop)"
}
```

**Menu Contributions**:
```json
"menus": {
  "view/title": [
    {
      "command": "codeXR.activeServers.refreshServers",
      "when": "view == codexrTree",
      "group": "navigation@1"
    },
    {
      "command": "codeXR.activeServers.stopAllServers",
      "when": "view == codexrTree",
      "group": "navigation@2"
    }
  ]
}
```

## Persistence and State Management

### Session-Only Registry

The Active Servers registry is **ephemeral** and does not persist across VS Code sessions:

**Rationale**:
- Servers are runtime instances that don't survive application restarts
- Port availability changes between sessions
- Security considerations for certificate and network state
- Clean slate approach prevents stale server references

**State Lifecycle**:
1. **Extension Activation**: Empty registry initialization
2. **Server Launch**: Dynamic registration as servers start
3. **Runtime Updates**: Status changes, additions, removals
4. **Extension Deactivation**: Complete registry cleanup

### Integration with ServerSettingsManager

**Separation of Concerns**:
- **ServerSettingsManager**: Persistent configuration (HTTP mode, ports, auto-open preferences)
- **ActiveServerRegistry**: Runtime state tracking (active instances, status, metadata)

**Configuration Flow**:
```typescript
// Persistent settings influence new server launches
const settings = ServerSettingsManager.getInstance().getServerSettings();
const serverType = settings.mode; // 'HTTP' | 'HTTPS'
const defaultPort = settings.defaultPort;

// Runtime registry tracks the resulting server instances
const activeServer = registry.registerServer({
    port: actualPort,
    certMode: determinedCertMode,
    // ... other runtime parameters
});
```

## Error Handling and User Feedback

### Comprehensive Error Management

**Server Operation Errors**:
```typescript
// Stop server with error handling
try {
    const success = await ServerControl.stopServer(serverId);
    if (success) {
        vscode.window.showInformationMessage(`Stopped server ${server.url}`);
    } else {
        vscode.window.showErrorMessage(`Failed to stop server ${server.url}`);
    }
} catch (error) {
    vscode.window.showErrorMessage(
        `Error stopping server: ${error.message}`
    );
}
```

**HTTPS + Lateral Panel Conflict**:
```typescript
// Automatic conflict detection and user guidance
if (server.certMode !== 'http') {
    const response = await vscode.window.showWarningMessage(
        'HTTPS content cannot be displayed in VS Code panels due to security restrictions.',
        'Open in Browser Instead',
        'Cancel'
    );
    
    if (response === 'Open in Browser Instead') {
        return this.openInBrowser(serverId);
    }
}
```

**Port Conflict Resolution**:
- Automatic alternative port discovery with user notification
- Clear messaging about port changes: "Port 3000 was busy, launching server on port 3001 instead"
- Network access information for external device connectivity

### User Notification Patterns

**Success Messages**:
- Server launch confirmations with URL information
- Network access details for VR/mobile devices
- Action completion confirmations

**Warning Messages**:
- Certificate mode incompatibilities
- Port conflicts and resolutions
- Bulk operation confirmations

**Error Messages**:
- Server start/stop failures with actionable advice
- Network or certificate configuration issues
- Registry inconsistencies or cleanup failures

## Technical Details

### Key Classes and Services

#### ActiveServerRegistry
**Purpose**: Central state management singleton
**Key Methods**:
- `registerServer()`: Add new server with validation
- `unregisterServer()`: Remove server with cleanup
- `updateServerStatus()`: Status transitions with events
- `getStats()`: Comprehensive registry analytics

#### ServerRegistrar
**Purpose**: Registration validation and abstraction layer
**Functionality**:
- Input parameter validation
- Error handling and logging
- Registry delegation with consistent interface

#### ServerControl
**Purpose**: Server lifecycle operations and integration coordination
**Key Operations**:
```typescript
// Comprehensive server shutdown with cleanup
public static async stopServer(serverId: string): Promise<boolean> {
    // 1. Close lateral panels
    // 2. Clean up SSE clients  
    // 3. Remove file-to-server mappings
    // 4. Close analysis sessions
    // 5. Stop server instance
    // 6. Update registry
}
```

#### PanelManager
**Purpose**: WebviewPanel lifecycle management for lateral panel mode
**Features**:
- Panel registration and disposal tracking
- Automatic cleanup on user-initiated panel closure
- Bulk operations for multi-server scenarios

### Server Identification and Cleanup

**ID Generation Strategy**:
```typescript
private generateServerId(port: number, timestamp: number): string {
    return `server-${port}-${timestamp}`;
}
```

**Cleanup Integration Points**:
1. **SSE Manager**: Remove real-time update clients
2. **File-to-Server Mapping**: Clean up analysis file associations  
3. **Panel Manager**: Dispose lateral panel Webviews
4. **Analysis Sessions**: Close associated code analysis sessions
5. **Registry Events**: Trigger UI updates and notifications

**Zombie Prevention**:
- Server instance health checking with `refreshServerStatus()`
- Periodic cleanup of inactive servers
- Event-driven state synchronization
- Graceful error recovery with status updates

### Registry Consistency Mechanisms

**Event-Driven Updates**:
```typescript
// Registry change propagation
registry.onRegistryChange(() => {
    console.log('Active servers registry changed, refreshing UI');
    this.refresh();
});
```

**Status Validation**:
- Server instance health queries
- Automatic status correction for inconsistent states
- Registry cleanup for stopped/error servers

**UI Synchronization**:
- Real-time tree view updates via event emitters
- Consistent command availability based on server state
- Context menu adaptation for HTTP vs HTTPS servers

## API Reference

### ActiveServerRegistry Methods

```typescript
class ActiveServerRegistry {
    // Core registration operations
    registerServer(config: ServerRegistrationConfig): ActiveServer
    unregisterServer(serverId: string): boolean
    updateServerStatus(serverId: string, status: ServerStatus): boolean
    
    // Query operations
    getServer(serverId: string): ActiveServer | undefined
    getAllServers(): ActiveServer[]
    getServersByStatus(status: ServerStatus): ActiveServer[]
    getServerByPort(port: number): ActiveServer | undefined
    
    // Management operations
    cleanupInactiveServers(): number
    clearAll(): void
    getStats(): RegistryStatistics
    
    // Event handling
    readonly onRegistryChange: vscode.Event<RegistryEvent>
}
```

### ServerControl Operations

```typescript
class ServerControl {
    // Lifecycle management
    static async stopServer(serverId: string): Promise<boolean>
    static async stopAllServers(): Promise<number>
    static async refreshServerStatus(serverId: string): Promise<boolean>
    static async refreshAllServerStatuses(): Promise<void>
    
    // Information retrieval
    static getServerStatus(serverId: string): ServerStatusInfo | null
    static getRegistryInfo(): RegistryInfo
    static cleanupInactiveServers(): number
}
```

### ServerActionHandlers

```typescript
class ServerActionHandlers {
    // User actions
    static async openInBrowser(serverId: string): Promise<void>
    static async openInPanel(serverId: string): Promise<void>
    static async copyUrl(serverId: string): Promise<void>
    static async stopServer(serverId: string): Promise<void>
    static async showServerDetails(serverId: string): Promise<void>
    
    // Bulk operations
    static async stopAllServers(): Promise<void>
    static async refreshServers(): Promise<void>
}
```

## Integration Patterns

### Server Launch Integration
```typescript
// From MultiServerLauncher to ActiveServerRegistry
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

### Analysis Session Association
```typescript
// Bidirectional cleanup between servers and analysis sessions
if (server.metadata?.sessionId) {
    const sessionRegistry = UnifiedSessionRegistry.getInstance(context);
    const success = sessionRegistry.closeSession(server.metadata.sessionId);
}
```

### Tree View Integration
```typescript
// Registry events trigger UI updates
registry.onRegistryChange(() => {
    console.log('Active servers registry changed, refreshing section');
    this.refresh();
});
```

## Performance and Monitoring

### Memory Management
- Efficient Map-based storage for O(1) server lookups
- Automatic cleanup prevents memory leaks from stopped servers
- Weak references to server instances where appropriate

### Event Performance
- Debounced UI updates for rapid registry changes
- Selective event emission to minimize unnecessary updates
- Efficient tree view refresh strategies

### Logging and Debugging
- Comprehensive console logging with prefixed categories
- Server lifecycle tracking with detailed metadata
- Error context preservation for troubleshooting

---

*This documentation provides complete coverage of the Active Servers subsystem architecture, implementation details, and integration patterns. For specific usage examples, refer to the source code in `src/active_servers/` and related UI components in `src/views/active_servers/`.*
