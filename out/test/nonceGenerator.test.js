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
// Update the import path if the file is located elsewhere, for example '../nonceGenerator.ts'
const nonceGenerator_1 = require("../utils/nonceGenerator");
// Or, if the file does not exist, create 'src/utils/nonceGenerator.ts' and export the required functions.
suite('NonceGenerator Tests', () => {
    test('generateNonce should create hex string of correct length', () => {
        // Test default length (16 bytes = 32 hex chars)
        const nonce = (0, nonceGenerator_1.generateNonce)();
        assert.strictEqual(nonce.length, 32);
        assert.match(nonce, /^[0-9a-f]+$/i);
    });
    test('generateNonce should create different values on each call', () => {
        const nonce1 = (0, nonceGenerator_1.generateNonce)();
        const nonce2 = (0, nonceGenerator_1.generateNonce)();
        assert.notStrictEqual(nonce1, nonce2);
    });
    test('generateNonce should respect custom length', () => {
        const nonce8 = (0, nonceGenerator_1.generateNonce)(8);
        assert.strictEqual(nonce8.length, 16); // 8 bytes = 16 hex chars
        const nonce32 = (0, nonceGenerator_1.generateNonce)(32);
        assert.strictEqual(nonce32.length, 64); // 32 bytes = 64 hex chars
    });
    test('generateTimestampedNonce should have correct format', () => {
        const nonce = (0, nonceGenerator_1.generateTimestampedNonce)();
        assert.match(nonce, /^[0-9a-f]+-[0-9a-f]+$/i);
        const parts = nonce.split('-');
        assert.strictEqual(parts.length, 2);
        // Timestamp part should be reasonable length
        assert.ok(parts[0].length >= 8);
        // Random part should be 16 hex chars (8 bytes default)
        assert.strictEqual(parts[1].length, 16);
    });
    test('validateNonce should validate correct format', () => {
        const validNonce = (0, nonceGenerator_1.generateNonce)();
        assert.ok((0, nonceGenerator_1.validateNonce)(validNonce));
        const validNonce8 = (0, nonceGenerator_1.generateNonce)(8);
        assert.ok((0, nonceGenerator_1.validateNonce)(validNonce8, 8));
    });
    test('validateNonce should reject invalid format', () => {
        assert.ok(!(0, nonceGenerator_1.validateNonce)(''));
        assert.ok(!(0, nonceGenerator_1.validateNonce)('not-hex'));
        assert.ok(!(0, nonceGenerator_1.validateNonce)('123')); // Too short
        assert.ok(!(0, nonceGenerator_1.validateNonce)('g'.repeat(32))); // Invalid hex chars
        assert.ok(!(0, nonceGenerator_1.validateNonce)(null));
        assert.ok(!(0, nonceGenerator_1.validateNonce)(undefined));
    });
    test('validateTimestampedNonce should validate correct format', () => {
        const validNonce = (0, nonceGenerator_1.generateTimestampedNonce)();
        assert.ok((0, nonceGenerator_1.validateTimestampedNonce)(validNonce));
    });
    test('validateTimestampedNonce should reject invalid format', () => {
        assert.ok(!(0, nonceGenerator_1.validateTimestampedNonce)(''));
        assert.ok(!(0, nonceGenerator_1.validateTimestampedNonce)('no-dash'));
        assert.ok(!(0, nonceGenerator_1.validateTimestampedNonce)('abc-def-ghi')); // Too many parts
        assert.ok(!(0, nonceGenerator_1.validateTimestampedNonce)('123-xyz')); // Non-hex
        assert.ok(!(0, nonceGenerator_1.validateTimestampedNonce)(null));
        assert.ok(!(0, nonceGenerator_1.validateTimestampedNonce)(undefined));
    });
    test('nonce generation should be cryptographically secure', () => {
        // Generate multiple nonces and check for uniqueness
        const nonces = new Set();
        const iterations = 1000;
        for (let i = 0; i < iterations; i++) {
            const nonce = (0, nonceGenerator_1.generateNonce)();
            assert.ok(!nonces.has(nonce), `Duplicate nonce found: ${nonce}`);
            nonces.add(nonce);
        }
        assert.strictEqual(nonces.size, iterations);
    });
    test('timestamped nonces should be ordered chronologically', async () => {
        const nonce1 = (0, nonceGenerator_1.generateTimestampedNonce)();
        // Wait a small amount to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
        const nonce2 = (0, nonceGenerator_1.generateTimestampedNonce)();
        const timestamp1 = parseInt(nonce1.split('-')[0], 16);
        const timestamp2 = parseInt(nonce2.split('-')[0], 16);
        assert.ok(timestamp2 > timestamp1);
    });
    test('edge cases should be handled gracefully', () => {
        // Test with minimum length
        const minNonce = (0, nonceGenerator_1.generateNonce)(1);
        assert.strictEqual(minNonce.length, 2);
        assert.ok((0, nonceGenerator_1.validateNonce)(minNonce, 1));
        // Test with zero length should still work
        const zeroNonce = (0, nonceGenerator_1.generateNonce)(0);
        assert.strictEqual(zeroNonce.length, 0);
        assert.ok((0, nonceGenerator_1.validateNonce)(zeroNonce, 0));
    });
});
//# sourceMappingURL=nonceGenerator.test.js.map