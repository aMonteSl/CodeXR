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
suite('Active Servers Model Tests', () => {
    test('ActiveServer interface should have correct structure', () => {
        const mockServer = {
            id: 'test-server-123',
            port: 3000,
            url: 'http://localhost:3000',
            launchMode: 'browser',
            certMode: 'http',
            timestamp: Date.now(),
            status: 'running',
            htmlFile: 'index.html',
            metadata: {
                host: 'localhost',
                description: 'Test server'
            }
        };
        assert.strictEqual(mockServer.port, 3000);
        assert.strictEqual(mockServer.launchMode, 'browser');
        assert.strictEqual(mockServer.certMode, 'http');
        assert.strictEqual(mockServer.status, 'running');
    });
    test('LaunchMode type should accept valid values', () => {
        const validModes = ['browser', 'lateralPanel'];
        assert.strictEqual(validModes.length, 2);
        assert.ok(validModes.includes('browser'));
        assert.ok(validModes.includes('lateralPanel'));
    });
    test('CertMode type should accept valid values', () => {
        const validModes = ['http', 'https-default', 'https-custom'];
        assert.strictEqual(validModes.length, 3);
        assert.ok(validModes.includes('http'));
        assert.ok(validModes.includes('https-default'));
        assert.ok(validModes.includes('https-custom'));
    });
    test('ServerStatus type should accept valid values', () => {
        const validStatuses = ['running', 'stopped', 'error'];
        assert.strictEqual(validStatuses.length, 3);
        assert.ok(validStatuses.includes('running'));
        assert.ok(validStatuses.includes('stopped'));
        assert.ok(validStatuses.includes('error'));
    });
});
//# sourceMappingURL=activeServerModel.test.js.map