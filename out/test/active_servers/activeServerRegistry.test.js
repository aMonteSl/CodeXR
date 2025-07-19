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
const assert = __importStar(require("assert"));
const activeServerRegistry_1 = require("../../active_servers/registry/activeServerRegistry");
suite('Active Server Registry Tests', () => {
    let registry;
    setup(() => {
        // Get fresh registry instance for each test
        registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        // Clear any existing servers
        const allServers = registry.getAllServers();
        allServers.forEach((server) => {
            registry.unregisterServer(server.id);
        });
    });
    teardown(() => {
        // Clean up after each test
        const allServers = registry.getAllServers();
        allServers.forEach((server) => {
            registry.unregisterServer(server.id);
        });
    });
    test('Registry should be singleton', () => {
        const registry1 = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const registry2 = (0, activeServerRegistry_1.getActiveServerRegistry)();
        assert.strictEqual(registry1, registry2);
    });
    test('Should register a server successfully', () => {
        const serverConfig = {
            port: 3000,
            url: 'http://localhost:3000',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now(),
            htmlFile: 'test.html'
        };
        const server = (0, activeServerRegistry_1.registerActiveServer)(serverConfig);
        assert.ok(server.id);
        assert.strictEqual(server.port, 3000);
        assert.strictEqual(server.url, 'http://localhost:3000');
        assert.strictEqual(server.launchMode, 'browser');
        assert.strictEqual(server.certMode, 'http');
        assert.strictEqual(server.status, 'running');
    });
    test('Should retrieve registered server', () => {
        const serverConfig = {
            port: 3001,
            url: 'http://localhost:3001',
            launchMode: 'lateralPanel',
            certMode: 'https-default',
            timestamp: Date.now()
        };
        const registeredServer = (0, activeServerRegistry_1.registerActiveServer)(serverConfig);
        const retrievedServer = registry.getServer(registeredServer.id);
        assert.ok(retrievedServer);
        assert.strictEqual(retrievedServer.id, registeredServer.id);
        assert.strictEqual(retrievedServer.port, 3001);
        assert.strictEqual(retrievedServer.launchMode, 'lateralPanel');
    });
    test('Should unregister server successfully', () => {
        const serverConfig = {
            port: 3002,
            url: 'http://localhost:3002',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now()
        };
        const server = (0, activeServerRegistry_1.registerActiveServer)(serverConfig);
        assert.ok(registry.getServer(server.id));
        const unregistered = registry.unregisterServer(server.id);
        assert.strictEqual(unregistered, true);
        assert.strictEqual(registry.getServer(server.id), undefined);
    });
    test('Should update server status', () => {
        const serverConfig = {
            port: 3003,
            url: 'http://localhost:3003',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now()
        };
        const server = (0, activeServerRegistry_1.registerActiveServer)(serverConfig);
        assert.strictEqual(server.status, 'running');
        const updated = registry.updateServerStatus(server.id, 'stopped');
        assert.strictEqual(updated, true);
        const updatedServer = registry.getServer(server.id);
        assert.strictEqual(updatedServer?.status, 'stopped');
    });
    test('Should get all servers', () => {
        const config1 = {
            port: 3004,
            url: 'http://localhost:3004',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now()
        };
        const config2 = {
            port: 3005,
            url: 'http://localhost:3005',
            launchMode: 'lateralPanel',
            certMode: 'https-custom',
            timestamp: Date.now()
        };
        (0, activeServerRegistry_1.registerActiveServer)(config1);
        (0, activeServerRegistry_1.registerActiveServer)(config2);
        const allServers = registry.getAllServers();
        assert.strictEqual(allServers.length, 2);
    });
    test('Should filter servers by status', () => {
        const config1 = {
            port: 3006,
            url: 'http://localhost:3006',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now()
        };
        const config2 = {
            port: 3007,
            url: 'http://localhost:3007',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now()
        };
        const server1 = (0, activeServerRegistry_1.registerActiveServer)(config1);
        const server2 = (0, activeServerRegistry_1.registerActiveServer)(config2);
        // Update one server to stopped
        registry.updateServerStatus(server2.id, 'stopped');
        const runningServers = registry.getServersByStatus('running');
        const stoppedServers = registry.getServersByStatus('stopped');
        assert.strictEqual(runningServers.length, 1);
        assert.strictEqual(stoppedServers.length, 1);
        assert.strictEqual(runningServers[0].id, server1.id);
        assert.strictEqual(stoppedServers[0].id, server2.id);
    });
    test('Should get server count', () => {
        assert.strictEqual(registry.getServerCount(), 0);
        (0, activeServerRegistry_1.registerActiveServer)({
            port: 3008,
            url: 'http://localhost:3008',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now()
        });
        assert.strictEqual(registry.getServerCount(), 1);
    });
    test('Should get running server count', () => {
        const config1 = {
            port: 3009,
            url: 'http://localhost:3009',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now()
        };
        const config2 = {
            port: 3010,
            url: 'http://localhost:3010',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now()
        };
        const server1 = (0, activeServerRegistry_1.registerActiveServer)(config1);
        const server2 = (0, activeServerRegistry_1.registerActiveServer)(config2);
        assert.strictEqual(registry.getRunningServerCount(), 2);
        registry.updateServerStatus(server1.id, 'stopped');
        assert.strictEqual(registry.getRunningServerCount(), 1);
    });
    test('Should find server by port', () => {
        const config = {
            port: 3011,
            url: 'http://localhost:3011',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now()
        };
        const server = (0, activeServerRegistry_1.registerActiveServer)(config);
        const foundServer = registry.getServerByPort(3011);
        assert.ok(foundServer);
        assert.strictEqual(foundServer.id, server.id);
        assert.strictEqual(foundServer.port, 3011);
    });
    test('Should check if server exists', () => {
        const config = {
            port: 3012,
            url: 'http://localhost:3012',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now()
        };
        const server = (0, activeServerRegistry_1.registerActiveServer)(config);
        assert.strictEqual(registry.hasServer(server.id), true);
        assert.strictEqual(registry.hasServer('non-existent-id'), false);
    });
    test('Should cleanup inactive servers', () => {
        const config1 = {
            port: 3013,
            url: 'http://localhost:3013',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now()
        };
        const config2 = {
            port: 3014,
            url: 'http://localhost:3014',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now()
        };
        const server1 = (0, activeServerRegistry_1.registerActiveServer)(config1);
        const server2 = (0, activeServerRegistry_1.registerActiveServer)(config2);
        // Stop one server
        registry.updateServerStatus(server1.id, 'stopped');
        assert.strictEqual(registry.getServerCount(), 2);
        const cleanedCount = registry.cleanupInactiveServers();
        assert.strictEqual(cleanedCount, 1);
        assert.strictEqual(registry.getServerCount(), 1);
        assert.strictEqual(registry.getServer(server1.id), undefined);
        assert.ok(registry.getServer(server2.id));
    });
});
//# sourceMappingURL=activeServerRegistry.test.js.map