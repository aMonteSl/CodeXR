import { randomBytes } from 'crypto';

/**
 * Generates a cryptographically secure nonce (number used once) for configuration tracking.
 * Uses Node.js crypto module to create unpredictable random values.
 * 
 * @param length - The length of the nonce in bytes (default: 16 bytes = 128 bits)
 * @returns A hex-encoded string representing the nonce
 */
export function generateNonce(length: number = 16): string {
    return randomBytes(length).toString('hex');
}

/**
 * Generates a timestamped nonce that includes both time and random components.
 * Useful for scenarios where temporal ordering is important alongside uniqueness.
 * 
 * @param length - The length of the random component in bytes (default: 8 bytes)
 * @returns A hex-encoded string with timestamp prefix and random suffix
 */
export function generateTimestampedNonce(length: number = 8): string {
    const timestamp = Date.now().toString(16);
    const random = randomBytes(length).toString('hex');
    return `${timestamp}-${random}`;
}

/**
 * Validates that a nonce has the expected format and length.
 * 
 * @param nonce - The nonce to validate
 * @param expectedLength - Expected length in bytes (default: 16)
 * @returns True if the nonce is valid, false otherwise
 */
export function validateNonce(nonce: string, expectedLength: number = 16): boolean {
    if (typeof nonce !== 'string') {
        return false;
    }
    
    // Check if it's a hex string of expected length
    const expectedHexLength = expectedLength * 2;
    
    // Special case: zero length is valid if we expect zero length
    if (expectedHexLength === 0) {
        return nonce.length === 0;
    }
    
    // Check non-empty nonce
    if (!nonce) {
        return false;
    }
    
    const hexPattern = /^[0-9a-f]+$/i;
    
    return nonce.length === expectedHexLength && hexPattern.test(nonce);
}

/**
 * Validates timestamped nonce format.
 * 
 * @param nonce - The timestamped nonce to validate
 * @returns True if the nonce has valid timestamped format, false otherwise
 */
export function validateTimestampedNonce(nonce: string): boolean {
    if (!nonce || typeof nonce !== 'string') {
        return false;
    }
    
    // Check format: timestamp-random
    const parts = nonce.split('-');
    if (parts.length !== 2) {
        return false;
    }
    
    const [timestampHex, randomHex] = parts;
    const hexPattern = /^[0-9a-f]+$/i;
    
    return hexPattern.test(timestampHex) && hexPattern.test(randomHex);
}
