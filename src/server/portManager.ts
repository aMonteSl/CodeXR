import * as net from 'net';
import * as vscode from 'vscode';

/**
 * Configuration for port management
 */
interface PortManagerConfig {
  startPort: number;
  endPort: number;
  preferredPorts: number[];
}

/**
 * Active port tracking
 */
interface ActivePort {
  port: number;
  service: string;
  startTime: number;
  description: string;
}

/**
 * Unified Port Manager for CodeXR
 * Manages all ports between 3000-3100 for analysis, servers, and other services
 */
export class PortManager {
  private static instance: PortManager;
  private activePorts: Map<number, ActivePort> = new Map();
  private config: PortManagerConfig = {
    startPort: 3000,
    endPort: 3100,
    preferredPorts: [3000, 8080, 8000, 3001, 3002] // Puertos preferidos en orden
  };
  private portProtocolHistory: Map<number, 'http' | 'https'> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): PortManager {
    if (!PortManager.instance) {
      PortManager.instance = new PortManager();
    }
    return PortManager.instance;
  }

  /**
   * Checks if a specific port is available
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.listen(port, () => {
        server.once('close', () => {
          resolve(true);
        });
        server.close();
      });
      
      server.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Find the first available port, avoiding protocol conflicts
   */
  public async findFreePort(preferredPort?: number, protocol: 'http' | 'https' = 'http'): Promise<number> {
    const { startPort, endPort, preferredPorts } = this.config;
    
    console.log(`🔍 Finding free port for ${protocol.toUpperCase()} in range ${startPort}-${endPort}`);
    console.log(`🔍 Currently managed ports:`, Array.from(this.activePorts.keys()));
    console.log(`🔍 Protocol history:`, Object.fromEntries(this.portProtocolHistory));
    
    // ✅ FUNCIÓN HELPER PARA VERIFICAR SI UN PUERTO ES REALMENTE UTILIZABLE
    const isPortReallyFree = async (port: number): Promise<boolean> => {
      // 1. Verificar si está gestionado por nosotros
      if (this.activePorts.has(port)) {
        console.log(`❌ Port ${port} is managed by CodeXR`);
        return false;
      }
      
      // 2. Verificar disponibilidad del sistema
      const systemAvailable = await this.isPortAvailable(port);
      if (!systemAvailable) {
        console.log(`❌ Port ${port} is in use by system`);
        return false;
      }
      
      // 3. Verificar conflictos de protocolo
      const previousProtocol = this.portProtocolHistory.get(port);
      if (previousProtocol && previousProtocol !== protocol) {
        console.log(`⚠️ Port ${port} has protocol conflict (was ${previousProtocol.toUpperCase()}, need ${protocol.toUpperCase()})`);
        return false;
      }
      
      return true;
    };
    
    // Si se especifica un puerto preferido, verificar si es utilizable
    if (preferredPort && preferredPort >= startPort && preferredPort <= endPort) {
      console.log(`🎯 Checking preferred port: ${preferredPort}`);
      
      if (await isPortReallyFree(preferredPort)) {
        console.log(`✅ Preferred port ${preferredPort} is available and compatible`);
        return preferredPort;
      }
    }

    // Probar puertos preferidos del sistema
    for (const port of preferredPorts) {
      if (port >= startPort && port <= endPort && port !== preferredPort) {
        console.log(`🎯 Checking preferred system port: ${port}`);
        
        if (await isPortReallyFree(port)) {
          console.log(`✅ System port ${port} is available and compatible`);
          return port;
        }
      }
    }

    // Buscar secuencialmente en todo el rango
    for (let port = startPort; port <= endPort; port++) {
      // Saltar puertos que ya verificamos
      if (preferredPorts.includes(port) || port === preferredPort) {
        continue;
      }
      
      if (await isPortReallyFree(port)) {
        console.log(`✅ Found free and compatible port: ${port}`);
        return port;
      }
    }

    throw new Error(`No compatible port found in range ${startPort}-${endPort} for ${protocol.toUpperCase()}. All ports are either in use or have protocol conflicts.`);
  }

  /**
   * Reserve a port for a specific service with protocol tracking
   */
  public reservePort(port: number, service: string, description: string, protocol: 'http' | 'https' = 'http'): void {
    const activePort: ActivePort = {
      port,
      service,
      startTime: Date.now(),
      description: `${description} (${protocol.toUpperCase()})`
    };
    
    this.activePorts.set(port, activePort);
    this.portProtocolHistory.set(port, protocol);
    
    console.log(`🔒 Reserved port ${port} for ${service} using ${protocol.toUpperCase()}: ${description}`);
    vscode.commands.executeCommand('codexr.refreshView');
  }

  /**
   * Release a port
   */
  public releasePort(port: number): void {
    const activePort = this.activePorts.get(port);
    if (activePort) {
      this.activePorts.delete(port);
      console.log(`🔓 Released port ${port} from ${activePort.service}`);
      
      // Emit event for UI updates
      vscode.commands.executeCommand('codexr.refreshView');
    }
  }

  /**
   * Get all active ports
   */
  public getActivePorts(): ActivePort[] {
    return Array.from(this.activePorts.values()).sort((a, b) => a.port - b.port);
  }

  /**
   * Check if a port is managed by CodeXR
   */
  public isPortManaged(port: number): boolean {
    return this.activePorts.has(port);
  }

  /**
   * Get detailed port status
   */
  public async getPortStatus(): Promise<{
    managed: ActivePort[];
    available: number[];
    total: number;
    range: { start: number; end: number };
  }> {
    const { startPort, endPort } = this.config;
    const managed = this.getActivePorts();
    const available: number[] = [];
    
    // Check availability of unmanaged ports
    for (let port = startPort; port <= endPort; port++) {
      if (!this.isPortManaged(port) && await this.isPortAvailable(port)) {
        available.push(port);
      }
    }
    
    return {
      managed,
      available,
      total: endPort - startPort + 1,
      range: { start: startPort, end: endPort }
    };
  }

  /**
   * Force release all ports (cleanup)
   */
  public releaseAllPorts(): void {
    const count = this.activePorts.size;
    this.activePorts.clear();
    console.log(`🧹 Released all ${count} managed ports`);
    vscode.commands.executeCommand('codexr.refreshView');
  }
}

/**
 * Global port manager instance
 */
export const portManager = PortManager.getInstance();