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
const http = __importStar(require("http"));
const httpServer_1 = require("../../servers/runtime/httpServer");
const portManager_1 = require("../../servers/runtime/portManager");
suite('HttpServer Tests', () => {
    let server;
    let testPort;
    suiteSetup(async () => {
        // Find an available port for testing
        testPort = await portManager_1.PortManager.findAvailablePort(8000);
    });
    teardown(async () => {
        if (server && server.getIsRunning()) {
            await server.stop();
        }
    });
    test('should create server with default config', () => {
        server = new httpServer_1.HttpServer({
            port: testPort,
            host: 'localhost'
        });
        const config = server.getConfig();
        assert.strictEqual(config.port, testPort);
        assert.strictEqual(config.host, 'localhost');
        assert.strictEqual(config.enableCors, true);
        assert.ok(Array.isArray(config.allowedOrigins));
    });
    test('should create server with custom config', () => {
        const customConfig = {
            port: testPort,
            host: 'localhost',
            staticRoot: '/custom/path',
            enableCors: false,
            allowedOrigins: ['http://example.com']
        };
        server = new httpServer_1.HttpServer(customConfig);
        const config = server.getConfig();
        assert.strictEqual(config.port, testPort);
        assert.strictEqual(config.host, 'localhost');
        assert.strictEqual(config.staticRoot, '/custom/path');
        assert.strictEqual(config.enableCors, false);
        assert.deepStrictEqual(config.allowedOrigins, ['http://example.com']);
    });
    test('should start and stop server', async () => {
        server = new httpServer_1.HttpServer({
            port: testPort,
            host: 'localhost'
        });
        // Initially not running
        assert.strictEqual(server.getIsRunning(), false);
        assert.strictEqual(server.getServerUrl(), null);
        // Start server
        const serverUrl = await server.start();
        assert.strictEqual(server.getIsRunning(), true);
        assert.strictEqual(serverUrl, `http://localhost:${testPort}`);
        assert.strictEqual(server.getServerUrl(), `http://localhost:${testPort}`);
        // Stop server
        await server.stop();
        assert.strictEqual(server.getIsRunning(), false);
        assert.strictEqual(server.getServerUrl(), null);
    });
    test('should handle server start error on busy port', async () => {
        // Start first server
        const server1 = new httpServer_1.HttpServer({
            port: testPort,
            host: 'localhost'
        });
        await server1.start();
        try {
            // Try to start second server on same port
            const server2 = new httpServer_1.HttpServer({
                port: testPort,
                host: 'localhost'
            });
            try {
                await server2.start();
                assert.fail('Should have thrown an error');
            }
            catch (error) {
                assert.ok(error instanceof Error);
                assert.ok(error.message.includes('already in use'));
            }
        }
        finally {
            await server1.stop();
        }
    });
    test('should serve basic HTTP responses', async () => {
        server = new httpServer_1.HttpServer({
            port: testPort,
            host: 'localhost'
        });
        await server.start();
        // Test API endpoint
        const response = await makeRequest(`http://localhost:${testPort}/api/health`);
        assert.strictEqual(response.statusCode, 200);
        const data = JSON.parse(response.data);
        assert.strictEqual(data.status, 'ok');
        assert.strictEqual(data.service, 'CodeXR Server');
    });
    test('should handle 404 for unknown paths', async () => {
        server = new httpServer_1.HttpServer({
            port: testPort,
            host: 'localhost'
        });
        await server.start();
        const response = await makeRequest(`http://localhost:${testPort}/nonexistent`);
        assert.strictEqual(response.statusCode, 404);
    });
    test('should serve CORS headers when enabled', async () => {
        server = new httpServer_1.HttpServer({
            port: testPort,
            host: 'localhost',
            enableCors: true,
            allowedOrigins: ['*']
        });
        await server.start();
        const response = await makeRequest(`http://localhost:${testPort}/api/health`);
        assert.ok(response.headers['access-control-allow-origin']);
        assert.ok(response.headers['access-control-allow-methods']);
        assert.ok(response.headers['access-control-allow-headers']);
    });
    test('should not serve CORS headers when disabled', async () => {
        server = new httpServer_1.HttpServer({
            port: testPort,
            host: 'localhost',
            enableCors: false
        });
        await server.start();
        const response = await makeRequest(`http://localhost:${testPort}/api/health`);
        assert.strictEqual(response.headers['access-control-allow-origin'], undefined);
    });
    test('should prevent starting already running server', async () => {
        server = new httpServer_1.HttpServer({
            port: testPort,
            host: 'localhost'
        });
        await server.start();
        try {
            await server.start();
            assert.fail('Should have thrown an error');
        }
        catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('already running'));
        }
    });
    test('should handle stop when not running', async () => {
        server = new httpServer_1.HttpServer({
            port: testPort,
            host: 'localhost'
        });
        // Should not throw error when stopping a server that's not running
        await server.stop();
        assert.strictEqual(server.getIsRunning(), false);
    });
    test('should get server information', async () => {
        server = new httpServer_1.HttpServer({
            port: testPort,
            host: 'localhost'
        });
        // Check initial state
        assert.strictEqual(server.getIsRunning(), false);
        assert.strictEqual(server.getServerUrl(), null);
        // Check after starting
        await server.start();
        assert.strictEqual(server.getIsRunning(), true);
        assert.strictEqual(server.getServerUrl(), `http://localhost:${testPort}`);
        const config = server.getConfig();
        assert.strictEqual(config.port, testPort);
        assert.strictEqual(config.host, 'localhost');
    });
});
/**
 * Helper function to make HTTP requests for testing
 */
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode || 0,
                    headers: res.headers,
                    data: data
                });
            });
        });
        req.on('error', (error) => {
            reject(error);
        });
        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}
//# sourceMappingURL=httpServer.test.js.map