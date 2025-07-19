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
const portManager_1 = require("../../servers/runtime/portManager");
suite('PortManager Tests', () => {
    test('should check if port is available', async () => {
        // Test with a port that's likely to be free (high port number)
        const port = 65432;
        const isAvailable = await portManager_1.PortManager.isPortAvailable(port);
        assert.strictEqual(typeof isAvailable, 'boolean');
    });
    test('should find available port from starting point', async () => {
        const startPort = 8000;
        const availablePort = await portManager_1.PortManager.findAvailablePort(startPort);
        assert.strictEqual(typeof availablePort, 'number');
        assert.ok(availablePort >= startPort);
        assert.ok(availablePort <= 8080); // Default end port
    });
    test('should find multiple available ports', async () => {
        const count = 3;
        const startPort = 8000;
        const ports = await portManager_1.PortManager.findMultipleAvailablePorts(count, startPort);
        assert.strictEqual(ports.length, count);
        assert.ok(ports.every(port => typeof port === 'number'));
        assert.ok(ports.every(port => port >= startPort));
        // Check that all ports are unique
        const uniquePorts = new Set(ports);
        assert.strictEqual(uniquePorts.size, count);
    });
    test('should validate port numbers correctly', () => {
        assert.strictEqual(portManager_1.PortManager.isValidPort(80), true);
        assert.strictEqual(portManager_1.PortManager.isValidPort(3000), true);
        assert.strictEqual(portManager_1.PortManager.isValidPort(65535), true);
        assert.strictEqual(portManager_1.PortManager.isValidPort(0), false);
        assert.strictEqual(portManager_1.PortManager.isValidPort(-1), false);
        assert.strictEqual(portManager_1.PortManager.isValidPort(65536), false);
        assert.strictEqual(portManager_1.PortManager.isValidPort(1.5), false);
    });
    test('should get suggested ports correctly', () => {
        const httpSuggestions = portManager_1.PortManager.getSuggestedPorts('http');
        const httpsSuggestions = portManager_1.PortManager.getSuggestedPorts('https');
        const devSuggestions = portManager_1.PortManager.getSuggestedPorts('dev');
        assert.ok(Array.isArray(httpSuggestions));
        assert.ok(Array.isArray(httpsSuggestions));
        assert.ok(Array.isArray(devSuggestions));
        assert.ok(httpSuggestions.length > 0);
        assert.ok(httpsSuggestions.length > 0);
        assert.ok(devSuggestions.length > 0);
        assert.ok(httpSuggestions.every(port => portManager_1.PortManager.isValidPort(port)));
        assert.ok(httpsSuggestions.every(port => portManager_1.PortManager.isValidPort(port)));
        assert.ok(devSuggestions.every(port => portManager_1.PortManager.isValidPort(port)));
    });
    test('should handle port range correctly', async () => {
        try {
            const port = await portManager_1.PortManager.findAvailablePort(65530, 65535);
            assert.ok(port >= 65530 && port <= 65535);
        }
        catch (error) {
            // It's okay if no ports are available in this high range
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('No available port found'));
        }
    });
    test('should throw error for invalid port range', async () => {
        try {
            await portManager_1.PortManager.findAvailablePort(8080, 3000); // Invalid range
            assert.fail('Should have thrown an error');
        }
        catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('Invalid port range'));
        }
    });
    test('should handle edge cases for port validation', () => {
        // Test edge cases
        assert.strictEqual(portManager_1.PortManager.isValidPort(1), true);
        assert.strictEqual(portManager_1.PortManager.isValidPort(1024), true);
        assert.strictEqual(portManager_1.PortManager.isValidPort(65535), true);
        // Test invalid types
        assert.strictEqual(portManager_1.PortManager.isValidPort(NaN), false);
        assert.strictEqual(portManager_1.PortManager.isValidPort(Infinity), false);
        assert.strictEqual(portManager_1.PortManager.isValidPort(-Infinity), false);
    });
});
//# sourceMappingURL=portManager.test.js.map