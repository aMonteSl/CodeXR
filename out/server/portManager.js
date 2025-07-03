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
exports.portManager = exports.PortManager = void 0;
const net = __importStar(require("net"));
const vscode = __importStar(require("vscode"));
/**
 * Unified Port Manager for CodeXR
 * Manages all ports between 3000-3100 for analysis, servers, and other services
 */
class PortManager {
    static instance;
    activePorts = new Map();
    config = {
        startPort: 3000,
        endPort: 3100,
        preferredPorts: [3000, 8080, 8000, 3001, 3002] // Puertos preferidos en orden
    };
    portProtocolHistory = new Map();
    constructor() { }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!PortManager.instance) {
            PortManager.instance = new PortManager();
        }
        return PortManager.instance;
    }
    /**
     * Checks if a specific port is available
     */
    async isPortAvailable(port) {
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
    async findFreePort(preferredPort, protocol = 'http') {
        const { startPort, endPort, preferredPorts } = this.config;
        console.log(`🔍 Finding free port for ${protocol.toUpperCase()} in range ${startPort}-${endPort}`);
        console.log(`🔍 Currently managed ports:`, Array.from(this.activePorts.keys()));
        console.log(`🔍 Protocol history:`, Object.fromEntries(this.portProtocolHistory));
        // ✅ FUNCIÓN HELPER PARA VERIFICAR SI UN PUERTO ES REALMENTE UTILIZABLE
        const isPortReallyFree = async (port) => {
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
    reservePort(port, service, description, protocol = 'http') {
        const activePort = {
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
    releasePort(port) {
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
    getActivePorts() {
        return Array.from(this.activePorts.values()).sort((a, b) => a.port - b.port);
    }
    /**
     * Check if a port is managed by CodeXR
     */
    isPortManaged(port) {
        return this.activePorts.has(port);
    }
    /**
     * Get detailed port status
     */
    async getPortStatus() {
        const { startPort, endPort } = this.config;
        const managed = this.getActivePorts();
        const available = [];
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
    releaseAllPorts() {
        const count = this.activePorts.size;
        this.activePorts.clear();
        console.log(`🧹 Released all ${count} managed ports`);
        vscode.commands.executeCommand('codexr.refreshView');
    }
}
exports.PortManager = PortManager;
/**
 * Global port manager instance
 */
exports.portManager = PortManager.getInstance();
//# sourceMappingURL=portManager.js.map