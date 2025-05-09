import * as crypto from 'crypto';

/**
 * Generates a cryptographically secure nonce string for CSP
 * @returns A random string to use as nonce
 */
export function generateNonce(): string {
  // Generate 32 bytes of random data (256 bits)
  const buffer = crypto.randomBytes(32);
  // Convert to base64 string for more efficient representation
  return buffer.toString('base64');
}