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
const serverControl_1 = require("../../active_servers/runtime/serverControl");
const activeServerRegistry_1 = require("../../active_servers/registry/activeServerRegistry");
suite('Server Control Tests', () => {
    let registry;
    setup(() => {
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
    test('Should get server status', () => {
        const config = {
            port: 4000,
            url: 'http://localhost:4000',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now(),
            htmlFile: 'test.html'
        };
        const server = (0, activeServerRegistry_1.registerActiveServer)(config);
        const status = serverControl_1.ServerControl.getServerStatus(server.id);
        assert.ok(status);
        assert.strictEqual(status.server.id, server.id);
        assert.strictEqual(status.server.port, 4000);
        assert.strictEqual(status.server.status, 'running');
        assert.ok(status.uptime >= 0);
    });
    test('Should return null for non-existent server status', () => {
        const status = serverControl_1.ServerControl.getServerStatus('non-existent-id');
        assert.strictEqual(status, null);
    });
    test('Should format uptime correctly', () => {
        // Test the uptime formatting by creating a server with known timestamp
        const pastTimestamp = Date.now() - 65000; // 1 minute and 5 seconds ago
        const config = {
            port: 4001,
            url: 'http://localhost:4001',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: pastTimestamp
        };
        const server = (0, activeServerRegistry_1.registerActiveServer)(config);
        const status = serverControl_1.ServerControl.getServerStatus(server.id);
        assert.ok(status);
        assert.ok(status.uptime >= 60000); // Should be at least 1 minute (65000ms - some tolerance)
        assert.ok(status.details.includes('Uptime:')); // Should contain uptime information
    });
    test('Should handle multiple servers status check', async () => {
        const config1 = {
            port: 4002,
            url: 'http://localhost:4002',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now()
        };
        const config2 = {
            port: 4003,
            url: 'http://localhost:4003',
            launchMode: 'lateralPanel',
            certMode: 'https-default',
            timestamp: Date.now()
        };
        const server1 = (0, activeServerRegistry_1.registerActiveServer)(config1);
        const server2 = (0, activeServerRegistry_1.registerActiveServer)(config2);
        // Update one server to stopped
        registry.updateServerStatus(server2.id, 'stopped');
        // Test refresh all statuses (this should work without errors)
        try {
            await serverControl_1.ServerControl.refreshAllServerStatuses();
            assert.ok(true, 'Refresh all statuses completed without error');
        }
        catch (error) {
            assert.fail(`Refresh should not throw error: ${error}`);
        }
    });
    test('Should handle server not found gracefully', () => {
        // Test various methods with non-existent server ID
        const nonExistentId = 'server-does-not-exist';
        const status = serverControl_1.ServerControl.getServerStatus(nonExistentId);
        assert.strictEqual(status, null);
        // These should not throw errors but handle gracefully
        assert.doesNotThrow(() => {
            serverControl_1.ServerControl.stopServer(nonExistentId);
        });
    });
    test('Should handle empty registry gracefully', async () => {
        // Ensure registry is empty
        assert.strictEqual(registry.getServerCount(), 0);
        // These operations should work with empty registry
        try {
            await serverControl_1.ServerControl.refreshAllServerStatuses();
            await serverControl_1.ServerControl.stopAllServers();
            assert.ok(true, 'Operations on empty registry completed successfully');
        }
        catch (error) {
            assert.fail(`Operations should not fail on empty registry: ${error}`);
        }
    });
});
//# sourceMappingURL=serverControl.test.js.map